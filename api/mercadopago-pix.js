import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabaseAdmin = serviceKey
    ? createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

  // Busca credenciais na tabela parametros_sistema
  let dbParams = null;
  if (supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin
        .from('parametros_sistema')
        .select('*')
        .limit(1)
        .maybeSingle();
      dbParams = data;
    } catch (e) {
      console.warn('Erro ao consultar parametros_sistema:', e);
    }
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const action = req.query?.action || body?.action || 'check';
  const masterToken = (body?.token || dbParams?.gateway_token || process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
  const chavePixMaster = (dbParams?.chave_pix_master || 'def0e87a-f7d0-4c54-830b-473206cf78c6').trim();

  // ─────────────────────────────────────────────────────────────────────────
  // 1. AÇÃO: CRIAR PAGAMENTO PIX (VIA MERCADO PAGO SERVER-SIDE)
  // ─────────────────────────────────────────────────────────────────────────
  if (action === 'create') {
    const { hotelId, hotelNome, planoNome, valor, pagadorEmail, pagadorNome, pagadorDoc } = body || {};
    const valorNum = Number(Number(valor || 1).toFixed(2));

    // Se temos Access Token do Mercado Pago, cria pagamento oficial dinâmico
    if (masterToken && masterToken.length > 15) {
      try {
        const cleanDoc = (pagadorDoc || '').replace(/\D/g, '') || '00000000000';
        const docType = cleanDoc.length > 11 ? 'CNPJ' : 'CPF';
        const nameParts = (pagadorNome || hotelNome || 'Cliente').trim().split(' ');
        const firstName = nameParts[0] || 'Cliente';
        const lastName = nameParts.slice(1).join(' ') || 'Hotel';

        const idempotencyKey = `hoteis_mp_${hotelId || 'new'}_${Date.now()}`;
        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${masterToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify({
            transaction_amount: valorNum,
            description: `Assinatura ${planoNome || 'Plano'} - ${hotelNome || 'Hotel'}`,
            payment_method_id: 'pix',
            payer: {
              email: pagadorEmail || 'financeiro@hotelnozap.com.br',
              first_name: firstName,
              last_name: lastName,
              identification: {
                type: docType,
                number: cleanDoc
              }
            },
            external_reference: hotelId || `hotel_${Date.now()}`
          })
        });

        if (mpResponse.ok) {
          const mpData = await mpResponse.json();
          const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code || '';
          const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || '';
          const ticketUrl = mpData.point_of_interaction?.transaction_data?.ticket_url || '';

          return res.status(200).json({
            success: true,
            paymentId: String(mpData.id),
            status: mpData.status || 'pending',
            qrCode,
            qrCodeBase64: qrCodeBase64 ? `data:image/png;base64,${qrCodeBase64}` : undefined,
            fallbackQrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrCode)}`,
            ticketUrl,
            gateway: 'mercadopago'
          });
        } else {
          const errText = await mpResponse.text();
          console.warn('Mercado Pago API retornou erro no create:', errText);
        }
      } catch (err) {
        console.warn('Exceção ao chamar API Mercado Pago:', err);
      }
    }

    // Fallback: Chave PIX Master direta
    const txid = `HNZ${String(hotelId || '').replace(/\D/g, '').substring(0, 10)}${Date.now().toString().slice(-6)}`;
    
    // Gerador BR Code EMV
    const formatField = (id, val) => `${id}${String(val.length).padStart(2, '0')}${val}`;
    const chave = chavePixMaster;
    const nome = 'HOTEL NO ZAP SAAS';
    const cidade = 'BRASILIA';
    const valorStr = valorNum.toFixed(2);

    let mai = formatField('00', 'br.gov.bcb.pix') + formatField('01', chave);
    if (planoNome) {
      mai += formatField('02', String(planoNome).substring(0, 35));
    }
    const additional = formatField('05', txid);
    const payloadSemCrc =
      formatField('00', '01') +
      formatField('26', mai) +
      formatField('52', '0000') +
      formatField('53', '986') +
      formatField('54', valorStr) +
      formatField('58', 'BR') +
      formatField('59', nome) +
      formatField('60', cidade) +
      formatField('62', additional) +
      '6304';

    // CRC16-CCITT
    let crc = 0xFFFF;
    for (let i = 0; i < payloadSemCrc.length; i++) {
      crc ^= (payloadSemCrc.charCodeAt(i) << 8);
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        else crc = (crc << 1) & 0xFFFF;
      }
    }
    const crcHex = crc.toString(16).toUpperCase().padStart(4, '0');
    const pixCopiaECola = payloadSemCrc + crcHex;

    return res.status(200).json({
      success: true,
      paymentId: `pix_hnz_${Date.now()}`,
      status: 'pending',
      qrCode: pixCopiaECola,
      fallbackQrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(pixCopiaECola)}`,
      gateway: 'pix_chave'
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. AÇÃO: CONSULTAR STATUS DO PAGAMENTO EM TEMPO REAL
  // ─────────────────────────────────────────────────────────────────────────
  const paymentId = req.query?.paymentId || body?.paymentId;
  const hotelId = req.query?.hotelId || body?.hotelId;
  const valorEsperado = Number(req.query?.valor || body?.valor || 0);

  // 1. Verifica se o hotel já foi ativado no Supabase
  if (hotelId && supabaseAdmin) {
    try {
      const { data: h } = await supabaseAdmin
        .from('hoteis')
        .select('id, status')
        .eq('id', hotelId)
        .maybeSingle();

      if (h && (h.status === 'ativo' || h.status === 'Ativo')) {
        return res.status(200).json({ approved: true, status: 'approved', source: 'database_hotel_active' });
      }
    } catch (e) {
      console.warn('Erro ao verificar status do hotel no Supabase:', e);
    }
  }

  // 2. Se temos Access Token do Mercado Pago, consulta status oficial
  if (masterToken && masterToken.length > 15) {
    // A) Se o paymentId é um ID numérico do Mercado Pago
    if (paymentId && /^\d+$/.test(String(paymentId).trim())) {
      try {
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { 'Authorization': `Bearer ${masterToken}` }
        });

        if (mpRes.ok) {
          const mpData = await mpRes.json();
          if (mpData.status === 'approved') {
            // Ativa o hotel no Supabase se hotelId informado
            if (hotelId && supabaseAdmin) {
              await supabaseAdmin.from('hoteis').update({ status: 'ativo' }).eq('id', hotelId);
            }
            return res.status(200).json({ approved: true, status: 'approved', source: 'mercadopago_payment_id' });
          }
          return res.status(200).json({ approved: false, status: mpData.status || 'pending' });
        }
      } catch (err) {
        console.warn('Erro ao consultar paymentId no Mercado Pago:', err);
      }
    }

    // B) Busca pagamentos recentes na conta Mercado Pago (para identificar pagamentos via PIX)
    try {
      const searchRes = await fetch('https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=10', {
        headers: { 'Authorization': `Bearer ${masterToken}` }
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const results = searchData?.results || [];

        const now = Date.now();
        // Procura pagamento aprovado recente (últimos 15 minutos)
        for (const p of results) {
          const createdAt = new Date(p.date_created).getTime();
          const isRecent = (now - createdAt) < (15 * 60 * 1000);
          const isApproved = p.status === 'approved';
          const matchAmount = valorEsperado > 0 ? Math.abs(Number(p.transaction_amount) - valorEsperado) < 0.05 : true;
          const matchRef = hotelId ? (p.external_reference === hotelId || String(p.description || '').includes(hotelId)) : false;

          if (isApproved && isRecent && (matchRef || (matchAmount && valorEsperado > 0))) {
            // Ativa o hotel no Supabase
            if (hotelId && supabaseAdmin) {
              await supabaseAdmin.from('hoteis').update({ status: 'ativo' }).eq('id', hotelId);
            }
            return res.status(200).json({
              approved: true,
              status: 'approved',
              matchedPaymentId: p.id,
              source: 'mercadopago_recent_search'
            });
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao buscar pagamentos recentes no Mercado Pago:', e);
    }
  }

  return res.status(200).json({ approved: false, status: 'pending' });
}
