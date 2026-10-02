import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Mercado Pago pode enviar via GET para validação de endpoint
  if (req.method === 'GET' && !req.query?.id && !req.query?.['data.id']) {
    return res.status(200).json({ status: 'ok', message: 'Mercado Pago Webhook endpoint active' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ia3ZnbHV1bmJua3R6dWx6amZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzg0OTMyOCwiZXhwIjoyMTAzNDI1MzI4fQ.VlbPt6MgzjMJHbUt9nuCWhBNEv_6dmkeZnaVH9zJe3E';

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Extrai o ID do pagamento enviado pelo Mercado Pago
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const paymentId =
    req.query?.id ||
    req.query?.['data.id'] ||
    body?.data?.id ||
    body?.id;

  const topic = req.query?.topic || req.query?.type || body?.type || body?.action;

  console.log(`[Webhook Mercado Pago] Recebido evento: topic=${topic}, paymentId=${paymentId}`);

  // Se não for evento de pagamento ou não tiver ID, confirma recebimento (200 OK) para não re-enviar
  if (!paymentId) {
    return res.status(200).json({ received: true, message: 'Sem paymentId informado' });
  }

  try {
    // Busca credenciais na tabela parametros_sistema
    const { data: dbParams } = await supabaseAdmin
      .from('parametros_sistema')
      .select('gateway_token')
      .limit(1)
      .maybeSingle();

    const masterToken = (dbParams?.gateway_token || process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();

    if (!masterToken || masterToken.length < 15) {
      console.warn('[Webhook Mercado Pago] Access Token Master não configurado.');
      return res.status(200).json({ received: true, warning: 'Token não configurado' });
    }

    // Consulta status oficial do pagamento na API do Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${masterToken}` }
    });

    if (!mpRes.ok) {
      const errText = await mpRes.text();
      console.warn(`[Webhook Mercado Pago] Erro ao consultar pagamento ${paymentId}:`, errText);
      return res.status(200).json({ received: true, error: 'Pagamento não encontrado no MP' });
    }

    const mpPayment = await mpRes.json();
    const status = mpPayment.status;
    const hotelId = mpPayment.external_reference;

    console.log(`[Webhook Mercado Pago] Pagamento ${paymentId}: status=${status}, hotelId=${hotelId}`);

    // Se o pagamento foi aprovado e temos o hotelId
    if (status === 'approved' && hotelId) {
      // 1. Atualiza status do hotel para 'ativo'
      const { error: updateErr } = await supabaseAdmin
        .from('hoteis')
        .update({
          status: 'ativo',
          notes: `Ativação automática via Webhook Mercado Pago (Payment ID: ${paymentId}) em ${new Date().toLocaleString('pt-BR')}`
        })
        .eq('id', hotelId);

      if (updateErr) {
        console.error('[Webhook Mercado Pago] Erro ao atualizar hotel:', updateErr);
      } else {
        console.log(`[Webhook Mercado Pago] Hotel ${hotelId} ativado com sucesso após aprovação do PIX!`);
      }
    }

    return res.status(200).json({
      received: true,
      paymentId,
      status,
      hotelId: hotelId || null
    });
  } catch (err) {
    console.error('[Webhook Mercado Pago] Exceção no webhook handler:', err);
    return res.status(200).json({ received: true, error: err.message });
  }
}
