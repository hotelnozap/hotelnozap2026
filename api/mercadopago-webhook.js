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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(`[MP-WEBHOOK] Início method=${req.method} query=${JSON.stringify(req.query || {})} serviceKey_present=${!!serviceKey} serviceKey_length=${serviceKey?.length || 0}`);

  if (!serviceKey) {
    console.error('[MP-WEBHOOK] ERRO CRÍTICO: SUPABASE_SERVICE_ROLE_KEY ausente em runtime Vercel. Webhook NÃO conseguirá salvar aprovação no DB.');
    return res.status(500).json({
      success: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente do servidor.'
    });
  }

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

  console.log(`[MP-WEBHOOK] Evento extraído: topic=${topic || 'null'} paymentId=${paymentId || 'null'} body_keys=${Object.keys(body || {}).join(',')}`);

  if (!paymentId) {
    console.warn('[MP-WEBHOOK] Sem paymentId informado. Retornando 200 para não reenviar.');
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

    console.log(`[MP-WEBHOOK] masterToken: length=${masterToken?.length || 0} token_ok=${masterToken?.length > 15} env_MERCADOPAGO_present=${!!process.env.MERCADOPAGO_ACCESS_TOKEN}`);

    if (!masterToken || masterToken.length < 15) {
      console.warn('[MP-WEBHOOK] Access Token Master não configurado (length<15). Não conseguirei confirmar status do pagamento no MP.');
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
    const mpValor = mpPayment.transaction_amount;

    console.log(`[MP-WEBHOOK] Pagamento ${paymentId} CONFIRMADO MP: status=${status} valor=${mpValor} external_reference(hotelId)=${hotelId || 'null'} desc=${mpPayment.description || 'N/D'}`);

    if (status === 'approved' && hotelId) {
      console.log(`[MP-WEBHOOK] STATUS=APPROVED + hotelId EXISTE. EXECUTANDO UPDATE hoteis SET status='ativo' WHERE id=${hotelId} ...`);
      const { data: beforeData, error: beforeErr } = await supabaseAdmin.from('hoteis').select('id, status').eq('id', hotelId).maybeSingle();
      if (beforeErr) console.warn('[MP-WEBHOOK] Aviso: não consegui ler status ANTES do update:', beforeErr);
      else console.log(`[MP-WEBHOOK] Status ANTES do update: ${beforeData?.status || 'não encontrado'}`);

      const { error: updateErr } = await supabaseAdmin
        .from('hoteis')
        .update({
          status: 'ativo',
          notes: `Ativação automática via Webhook Mercado Pago (Payment ID: ${paymentId}) em ${new Date().toLocaleString('pt-BR')}`
        })
        .eq('id', hotelId);

      if (updateErr) {
        console.error('[MP-WEBHOOK] ERRO AO ATUALIZAR HOTEL NO SUPABASE:', JSON.stringify(updateErr));
      } else {
        console.log(`[MP-WEBHOOK] SUCESSO! Hotel ${hotelId} ATIVADO via Webhook!`);
      }
    } else {
      console.warn(`[MP-WEBHOOK] Ação ignorada. status===approved? ${status === 'approved'} | hotelId existe? ${!!hotelId}. Nenhum update executado.`);
    }

    return res.status(200).json({
      received: true,
      paymentId,
      status,
      mpValor,
      hotelId: hotelId || null
    });
  } catch (err) {
    console.error('[MP-WEBHOOK] EXCEÇÃO no handler completo:', JSON.stringify({ message: err.message, stack: err.stack?.substring(0, 300) }));
    return res.status(200).json({ received: true, error: err.message });
  }
}
