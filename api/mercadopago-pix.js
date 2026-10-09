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

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const action = req.query?.action || body?.action || 'check';
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(`[MP-PIX] Início requisição action=${action} method=${req.method} serviceKey_present=${!!serviceKey} serviceKey_length=${serviceKey?.length || 0}`);

  if (!serviceKey) {
    console.error('[MP-PIX] ERRO CRÍTICO: SUPABASE_SERVICE_ROLE_KEY ausente em runtime Vercel');
    return res.status(500).json({
      success: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente do servidor.'
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

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

  let masterToken = (body?.token || dbParams?.gateway_token || process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
  if (masterToken.includes('9812401928409182') || masterToken === 'APP_USR-...') {
    masterToken = '';
  }
  const envDefaultPix = process.env.DEFAULT_PIX_KEY || '';
  const chavePixMaster = (dbParams?.chave_pix_master || envDefaultPix).trim();

  console.log(`[MP-PIX] action=${action} masterToken_length=${masterToken?.length || 0} masterToken_ok=${masterToken?.length > 15} chavePix_length=${chavePixMaster?.length || 0} env_defaultPix_present=${!!process.env.DEFAULT_PIX_KEY} env_mpToken_present=${!!process.env.MERCADOPAGO_ACCESS_TOKEN}`);

  // ─────────────────────────────────────────────────────────────────────────
  // 0. AÇÃO: TESTAR CONEXÃO / ACCESS TOKEN COM MERCADO PAGO
  // ─────────────────────────────────────────────────────────────────────────
  if (action === 'test_token') {
    if (!masterToken || masterToken.length < 15) {
      return res.status(400).json({
        success: false,
        error: 'Access Token do Mercado Pago não configurado ou muito curto.'
      });
    }

    try {
      const testRes = await fetch('https://api.mercadopago.com/v1/users/me', {
        headers: { 'Authorization': `Bearer ${masterToken}` }
      });

      if (testRes.ok) {
        const userData = await testRes.json();
        return res.status(200).json({
          success: true,
          liveMode: userData.live_mode !== false,
          user: userData.nickname || userData.email || 'Conta Mercado Pago',
          email: userData.email,
          message: `Conexão validada com sucesso! Conta: ${userData.nickname || userData.email || 'Mercado Pago'}`
        });
      } else {
        const errData = await testRes.json().catch(() => ({}));
        return res.status(400).json({
          success: false,
          error: errData.message || 'Token inválido ou não autorizado pelo Mercado Pago.'
        });
      }
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. AÇÃO: CRIAR PAGAMENTO PIX (VIA MERCADO PAGO SERVER-SIDE)
  // ─────────────────────────────────────────────────────────────────────────
  if (action === 'create') {
    const { hotelId, hotelNome, planoNome, valor, pagadorEmail, pagadorNome, pagadorDoc } = body || {};
    const valorNum = Number(Number(valor || 1).toFixed(2));

    console.log(`[MP-PIX] action=create entrada hotelId=${hotelId} valor=${valorNum} hotelNome=${hotelNome || 'N/D'} planoNome=${planoNome || 'N/D'}`);

    if (masterToken && masterToken.length > 15) {
      try {
        console.log(`[MP-PIX] action=create RAMO OFICIAL Mercado Pago paymentId NUMÉRICO (terá external_reference + webhook MP)`);
        const cleanDoc = (pagadorDoc || '').replace(/\D/g, '');
        const nameParts = (pagadorNome || hotelNome || 'Cliente Hotel').trim().split(' ');
        const firstName = nameParts[0] || 'Cliente';
        const lastName = nameParts.slice(1).join(' ') || 'Hotel';

        // Validação de e-mail seguro para Mercado Pago
        const safeEmail = (pagadorEmail && pagadorEmail.includes('@') && !pagadorEmail.includes('teste@'))
          ? pagadorEmail.trim()
          : (pagadorEmail && pagadorEmail.includes('@') ? pagadorEmail.trim() : 'contato@hotelnozap.com.br');

        const payerObj = {
          email: safeEmail,
          first_name: firstName,
          last_name: lastName
        };

        // Só envia identification se for um documento com comprimento válido de CPF ou CNPJ
        if (cleanDoc.length === 11) {
          payerObj.identification = { type: 'CPF', number: cleanDoc };
        } else if (cleanDoc.length === 14) {
          payerObj.identification = { type: 'CNPJ', number: cleanDoc };
        }

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
            payer: payerObj,
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
    console.log(`[MP-PIX] action=create RAMO FALLBACK pix_chave (Copia-e-Cola EMV). paymentId= pix_hnz_*, SEM external_reference MP, SEM disparo de webhook MP. Detecção posterior via SEARCH por valor.`);
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
  const isFallbackPixChave = String(paymentId || '').startsWith('pix_hnz_') || !paymentId || /^\d+$/.test(String(paymentId)) === false;

  console.log(`[MP-PIX] action=check ENTRADA paymentId=${paymentId} hotelId=${hotelId} valorEsperado=${valorEsperado} isFallbackPixChave=${isFallbackPixChave}`);

  // FASE 1: Verifica se o hotel já foi ativado no Supabase (fonte primária de verdade)
  if (hotelId && supabaseAdmin) {
    try {
      const { data: h } = await supabaseAdmin
        .from('hoteis')
        .select('id, status, criado_em')
        .eq('id', hotelId)
        .maybeSingle();

      if (h && (h.status === 'ativo' || h.status === 'Ativo')) {
        console.log(`[MP-PIX] action=check FASE1 OK hotel ${hotelId} já está status=${h.status}. Retornando approved=true source=database_hotel_active.`);
        return res.status(200).json({ approved: true, status: 'approved', source: 'database_hotel_active', hotelStatus: h.status });
      } else {
        console.log(`[MP-PIX] action=check FASE1 hotel ${hotelId} status atual=${h?.status || 'null/não encontrado'}. Prosseguindo busca MP.`);
      }
    } catch (e) {
      console.warn('[MP-PIX] action=check FASE1 Erro ao verificar status do hotel no Supabase:', e);
    }
  } else {
    console.log(`[MP-PIX] action=check FASE1 PULADO: hotelId_present=${!!hotelId} supabaseAdmin_present=${!!supabaseAdmin}`);
  }

  // FASE 2: Se temos Access Token do Mercado Pago, consulta status oficial
  if (masterToken && masterToken.length > 15) {
    // 2A) Se o paymentId é um ID numérico do Mercado Pago
    if (paymentId && /^\d+$/.test(String(paymentId).trim())) {
      try {
        console.log(`[MP-PIX] action=check FASE2A paymentId NUMÉRICO MP: consultando /v1/payments/${paymentId}`);
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { 'Authorization': `Bearer ${masterToken}` }
        });

        if (mpRes.ok) {
          const mpData = await mpRes.json();
          console.log(`[MP-PIX] action=check FASE2A MP retornou status=${mpData.status} transaction_amount=${mpData.transaction_amount} external_reference=${mpData.external_reference}`);
          if (mpData.status === 'approved') {
            if (hotelId && supabaseAdmin) {
              try {
                const { data: alreadyUsed } = await supabaseAdmin
                  .from('hoteis')
                  .select('id, nome')
                  .like('notes', `%MP_ID=${paymentId}%`)
                  .maybeSingle();

                if (alreadyUsed && alreadyUsed.id !== hotelId) {
                  console.warn(`[MP-PIX] FASE2A: Pagamento ${paymentId} já consumido por outro hotel (${alreadyUsed.id}).`);
                  return res.status(400).json({ approved: false, error: 'Este pagamento já foi vinculado a outro hotel.' });
                }

                await supabaseAdmin.from('hoteis').update({ 
                  status: 'ativo',
                  notes: `Ativação via paymentId MP_ID=${paymentId} em ${new Date().toLocaleString('pt-BR')}`
                }).eq('id', hotelId); 
                console.log(`[MP-PIX] action=check FASE2A hotel ${hotelId} status atualizado PARA ATIVO via paymentId MP.`); 
              } catch (uerr) { console.warn('[MP-PIX] FASE2A update erro:', uerr); }
            }
            return res.status(200).json({ approved: true, status: 'approved', source: 'mercadopago_payment_id', mpStatus: mpData.status });
          }
          return res.status(200).json({ approved: false, status: mpData.status || 'pending', mpStatus: mpData.status });
        } else {
          console.warn(`[MP-PIX] action=check FASE2A /payments/${paymentId} HTTP ${mpRes.status}`);
        }
      } catch (err) {
        console.warn('[MP-PIX] Erro ao consultar paymentId no Mercado Pago:', err);
      }
    } else {
      console.log(`[MP-PIX] action=check FASE2A PULADO: paymentId "${paymentId}" NÃO é numérico MP (é fallback pix_chave ou outro formato).`);
    }

    // 2B) Busca pagamentos recentes na conta Mercado Pago (ESTRATÉGIA PRINCIPAL PARA FALLBACK pix_chave = Copia-e-Cola)
    try {
      const buscaLimit = isFallbackPixChave ? 100 : 50;
      console.log(`[MP-PIX] action=check FASE2B MP /payments/search limit=${buscaLimit} isFallbackPixChave=${isFallbackPixChave} valorEsperado=${valorEsperado}`);
      const searchRes = await fetch(`https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=${buscaLimit}`, {
        headers: { 'Authorization': `Bearer ${masterToken}` }
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const results = searchData?.results || [];
        const total = searchData?.paging?.total || results.length;
        console.log(`[MP-PIX] action=check FASE2B MP search retornou ${results.length}/${total} pagamentos.`);

        const now = Date.now();
        let candidatoMatch = null;
        const horarioJanelaSegundos = isFallbackPixChave ? (60 * 30) : (60 * 15); // 30min para fallback, 15min para normal
        const janelaMs = horarioJanelaSegundos * 1000;

        for (let i = 0; i < results.length; i++) {
          const p = results[i];
          const createdAt = new Date(p.date_created).getTime();
          const isRecent = (now - createdAt) < janelaMs;
          const isApproved = p.status === 'approved';
          const matchAmount = valorEsperado > 0 ? Math.abs(Number(p.transaction_amount) - valorEsperado) < 0.05 : true;
          const matchRef = hotelId ? (p.external_reference === hotelId || String(p.description || '').includes(hotelId)) : false;

          if (!isApproved || !isRecent) continue;

          // Proteção Anti-Replay: Verifica se este paymentId já foi consumido por outro hotel
          if (supabaseAdmin) {
            try {
              const { data: alreadyUsed } = await supabaseAdmin
                .from('hoteis')
                .select('id, nome')
                .like('notes', `%MP_ID=${p.id}%`)
                .maybeSingle();

              if (alreadyUsed && alreadyUsed.id !== hotelId) {
                console.warn(`[MP-PIX] Pagamento ${p.id} já consumido pelo hotel ${alreadyUsed.id} (${alreadyUsed.nome}). Pulando.`);
                continue;
              }
            } catch (errCheck) {
              console.warn('[MP-PIX] Aviso ao verificar reuso de paymentId:', errCheck);
            }
          }

          // REGRA ESPECIAL FALLBACK pix_chave (Copia-e-Cola): NÃO necessita external_reference, basta VALOR
          if (isFallbackPixChave && matchAmount && valorEsperado > 0) {
            console.log(`[MP-PIX] action=check FASE2B MATCH FALLBACK pix_chave! idx=${i} paymentId=${p.id} amount=${p.transaction_amount} valorEsperado=${valorEsperado} date=${p.date_created}`);
            candidatoMatch = p;
            break;
          }

          // RAMO NORMAL (OFICIAL MP): precisa external_reference OU valor
          if (!isFallbackPixChave && (matchRef || (matchAmount && valorEsperado > 0))) {
            console.log(`[MP-PIX] action=check FASE2B MATCH RAMO NORMAL! idx=${i} paymentId=${p.id} matchRef=${matchRef} matchAmount=${matchAmount} ref=${p.external_reference} desc=${p.description}`);
            candidatoMatch = p;
            break;
          }
        }

        if (candidatoMatch) {
          if (hotelId && supabaseAdmin) {
            try {
              await supabaseAdmin.from('hoteis').update({
                status: 'ativo',
                notes: `Ativação via polling check Mercado Pago Search MP_ID=${candidatoMatch.id} em ${new Date().toLocaleString('pt-BR')}`
              }).eq('id', hotelId);
              console.log(`[MP-PIX] action=check FASE2B hotel ${hotelId} ATUALIZADO PARA ATIVO!`);
            } catch (uerr) {
              console.warn('[MP-PIX] FASE2B update hotel erro:', uerr);
            }
          }
          return res.status(200).json({
            approved: true,
            status: 'approved',
            matchedPaymentId: candidatoMatch.id,
            matchedAmount: candidatoMatch.transaction_amount,
            matchedDate: candidatoMatch.date_created,
            source: isFallbackPixChave ? 'mercadopago_search_fallback_pix_chave' : 'mercadopago_recent_search'
          });
        } else {
          console.log(`[MP-PIX] action=check FASE2B NENHUM MATCH ENCONTRADO nos ${results.length} resultados.`);
        }
      } else {
        console.warn(`[MP-PIX] action=check FASE2B MP search HTTP ${searchRes.status}`);
      }
    } catch (e) {
      console.warn('[MP-PIX] Erro ao buscar pagamentos recentes no Mercado Pago:', e);
    }
  } else {
    console.log(`[MP-PIX] action=check FASE2 PULADO COMPLETAMENTE: masterToken ausente ou curto. masterToken_length=${masterToken?.length || 0}. OBS.: Nenhuma consulta MP será feita, SÓ retorna approved se FASE1 DB já marcou hotel ativo.`);
  }

  console.log(`[MP-PIX] action=check FINAL PENDING: Nenhuma fase encontrou aprovação. Retornando approved=false. paymentId=${paymentId}`);
  return res.status(200).json({ approved: false, status: 'pending', debug: { isFallbackPixChave, hotelId: !!hotelId, masterToken_ok: masterToken?.length > 15, valorEsperado } });
}
