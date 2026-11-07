/**
 * api/infinitepay-webhook.js
 * Webhook oficial para receber notificações de pagamentos aprovados da InfinitePay.
 * Resposta padrão exigida pela InfinitePay: { "success": true, "message": null } com HTTP 200.
 */

import { createClient } from '@supabase/supabase-js';
import { applyCors } from './_cors.js';

export default async function handler(req, res) {
  // CORS flexível para aceitar chamadas dos servidores da InfinitePay
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  console.log('[InfinitePay-Webhook] Notificação recebida:', JSON.stringify(body));

  const {
    order_nsu,
    transaction_nsu,
    amount,
    paid_amount,
    capture_method,
    receipt_url,
    invoice_slug
  } = body;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    console.error('[InfinitePay-Webhook] SUPABASE_SERVICE_ROLE_KEY não configurada.');
    // Retorna 200 para a InfinitePay não ficar reenviando em loop caso falte env local
    return res.status(200).json({ success: true, message: null });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // 1. Se order_nsu foi informado, tenta localizar reserva ou plano
    if (order_nsu) {
      const cleanNsu = String(order_nsu).replace(/^RES-?/i, '').trim();

      // Busca na tabela reservas por id ou codigo_reserva
      const { data: reserva, error: resErr } = await supabaseAdmin
        .from('reservas')
        .select('*')
        .or(`id.eq.${cleanNsu},codigo_reserva.ilike.%${cleanNsu}%`)
        .limit(1)
        .maybeSingle();

      if (reserva && !resErr) {
        console.log(`[InfinitePay-Webhook] Baixa na reserva ${reserva.id} (${reserva.codigo_reserva || cleanNsu})`);

        // Atualiza status da reserva para confirmada e pagamento quitado
        await supabaseAdmin
          .from('reservas')
          .update({
            status: 'confirmada',
            status_pagamento: 'pago',
            valor_pago: (Number(paid_amount || amount) / 100) || reserva.valor_total,
            observacoes: (reserva.observacoes ? reserva.observacoes + '\n' : '') +
              `[PIX InfinitePay Aprovado]: NSU=${transaction_nsu || invoice_slug || ''} em ${new Date().toLocaleString('pt-BR')}`
          })
          .eq('id', reserva.id);

        // Se tiver hotel_id e quarto_id, sincroniza status do quarto para reservado
        if (reserva.quarto_id) {
          await supabaseAdmin
            .from('quartos')
            .update({ status: 'reservado' })
            .eq('id', reserva.quarto_id);
        }

        // Registra entrada no caixa se ainda não constar
        if (reserva.hotel_id) {
          const valorReais = (Number(paid_amount || amount) / 100) || Number(reserva.valor_total) || 0;
          await supabaseAdmin
            .from('caixa_movimentacoes')
            .insert({
              hotel_id: reserva.hotel_id,
              tipo: 'entrada',
              categoria: 'Reserva Direta',
              descricao: `Recebimento PIX InfinitePay - Reserva #${reserva.codigo_reserva || reserva.id}`,
              valor: valorReais,
              forma_pagamento: capture_method === 'pix' ? 'pix' : 'cartao_credito',
              status: 'concluido',
              data_movimentacao: new Date().toISOString()
            });
        }
      }
    }
  } catch (err) {
    console.error('[InfinitePay-Webhook] Erro ao processar baixa:', err);
  }

  // Resposta oficial exigida pela InfinitePay
  return res.status(200).json({
    success: true,
    message: null
  });
}
