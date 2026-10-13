import { createClient } from '@supabase/supabase-js';

// Utilitário para calcular os dias e créditos a partir do plano e valor
function parsePlanDays(planName, amount) {
  const n = String(planName || '').toLowerCase();
  const valor = Number(amount || 0);

  if (n.includes('12') || n.includes('anual') || valor >= 2000) {
    return { diasBase: 365, diasBonus: 60, totalDias: 425, creditos: 12, nomePadrao: '12 Créditos (Anual)' };
  }
  if (n.includes('8') || valor >= 1500) {
    return { diasBase: 240, diasBonus: 30, totalDias: 270, creditos: 8, nomePadrao: '8 Créditos' };
  }
  if (n.includes('7') || valor >= 1300) {
    return { diasBase: 210, diasBonus: 0, totalDias: 210, creditos: 7, nomePadrao: '7 Créditos' };
  }
  if (n.includes('6') || n.includes('semest') || valor >= 1100) {
    return { diasBase: 180, diasBonus: 45, totalDias: 225, creditos: 6, nomePadrao: '6 Créditos (Semestral)' };
  }
  if (n.includes('5') || valor >= 900) {
    return { diasBase: 150, diasBonus: 30, totalDias: 180, creditos: 5, nomePadrao: '5 Créditos' };
  }
  if (n.includes('4') || valor >= 700) {
    return { diasBase: 120, diasBonus: 30, totalDias: 150, creditos: 4, nomePadrao: '4 Créditos' };
  }
  if (n.includes('3') || n.includes('trimest') || valor >= 500) {
    return { diasBase: 90, diasBonus: 30, totalDias: 120, creditos: 3, nomePadrao: '3 Créditos (Trimestre de Ouro)' };
  }
  if (n.includes('2') || n.includes('bimest') || valor >= 300) {
    return { diasBase: 60, diasBonus: 15, totalDias: 75, creditos: 2, nomePadrao: '2 Créditos (Bimestral)' };
  }
  return { diasBase: 30, diasBonus: 15, totalDias: 45, creditos: 1, nomePadrao: '1 Crédito' };
}

// Extrai metadados de créditos anteriores salvos em observações
function extractExistingCredits(observacoes) {
  if (!observacoes) return null;
  const match = observacoes.match(/<!-- HOTEL_CREDITOS_JSON:(.*?):END_HOTEL_CREDITOS -->/s);
  if (!match || !match[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

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

  console.log(`[MP-WEBHOOK] Início method=${req.method} query=${JSON.stringify(req.query || {})} serviceKey_present=${!!serviceKey}`);

  if (!serviceKey) {
    console.error('[MP-WEBHOOK] ERRO CRÍTICO: SUPABASE_SERVICE_ROLE_KEY ausente em runtime Vercel.');
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

  console.log(`[MP-WEBHOOK] Evento extraído: topic=${topic || 'null'} paymentId=${paymentId || 'null'}`);

  if (!paymentId) {
    console.warn('[MP-WEBHOOK] Sem paymentId informado. Retornando 200.');
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
      console.warn('[MP-WEBHOOK] Access Token Master não configurado (length<15).');
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
    const description = mpPayment.description || '';

    console.log(`[MP-WEBHOOK] Pagamento ${paymentId} MP: status=${status} valor=${mpValor} hotelId=${hotelId || 'null'} desc=${description}`);

    if (status === 'approved' && hotelId) {
      console.log(`[MP-WEBHOOK] STATUS=APPROVED para hotel ${hotelId}. Executando liberação e cálculo server-side...`);

      // 1. Busca dados atuais do hotel
      const { data: currentHotel, error: getHotelErr } = await supabaseAdmin
        .from('hoteis')
        .select('id, nome, plano, observacoes, status')
        .eq('id', hotelId)
        .maybeSingle();

      if (getHotelErr) {
        console.warn('[MP-WEBHOOK] Aviso ao buscar dados do hotel:', getHotelErr);
      }

      // 2. Determina o plano e cálculo de dias com bônus
      const planDetails = parsePlanDays(description || currentHotel?.plano, mpValor);
      const resolvedPlanoNome = currentHotel?.plano || planDetails.nomePadrao;

      // 3. Calcula prorrogação cumulativa de validade
      const existingCredits = extractExistingCredits(currentHotel?.observacoes);
      let baseTime = Date.now();

      if (existingCredits && existingCredits.expiracao) {
        const currentExpTime = new Date(existingCredits.expiracao).getTime();
        // Se ainda está com dias ativos vigentes, acumula os novos dias no final da validade atual
        if (currentExpTime > baseTime) {
          baseTime = currentExpTime;
        }
      }

      const novaExpiracao = new Date(baseTime + planDetails.totalDias * 24 * 60 * 60 * 1000);
      const novoSaldoCreditos = (existingCredits?.saldoCreditos || 0) + planDetails.creditos;

      // 4. Monta objeto de créditos padronizado
      const creditosInfo = {
        saldoCreditos: novoSaldoCreditos,
        expiracao: novaExpiracao.toISOString(),
        dataCompra: new Date().toISOString().split('T')[0],
        emDegustacao: false,
        plano: resolvedPlanoNome,
        valor: mpValor,
        paymentId: String(paymentId),
        metodo: 'pix_mercadopago',
        origem: 'webhook_server'
      };

      // 5. Prepara coluna observacoes preservando histórico
      const cleanObs = (currentHotel?.observacoes || '').replace(/\s*<!-- HOTEL_CREDITOS_JSON:.*?:END_HOTEL_CREDITOS -->\s*/gs, '').trim();
      const auditText = `[PAGAMENTO APROVADO] Plano "${resolvedPlanoNome}" ativado via Webhook MP (ID: ${paymentId}) em ${new Date().toLocaleString('pt-BR')}. Validade: ${novaExpiracao.toLocaleDateString('pt-BR')} (+${planDetails.totalDias} dias).`;
      const creditosTag = `<!-- HOTEL_CREDITOS_JSON:${JSON.stringify(creditosInfo)}:END_HOTEL_CREDITOS -->`;
      const updatedObservacoes = cleanObs ? `${cleanObs}\n${auditText}\n${creditosTag}` : `${auditText}\n${creditosTag}`;

      // 6. Atualização atômica do hotel no Supabase
      const updatePayload = {
        status: 'ativo',
        plano: resolvedPlanoNome,
        observacoes: updatedObservacoes
      };

      const { error: updateErr } = await supabaseAdmin
        .from('hoteis')
        .update(updatePayload)
        .eq('id', hotelId);

      if (updateErr) {
        console.error('[MP-WEBHOOK] ERRO AO ATUALIZAR HOTEL NO SUPABASE:', JSON.stringify(updateErr));
      } else {
        console.log(`[MP-WEBHOOK] SUCESSO! Hotel ${hotelId} ATIVADO + CRÉDITOS SALVOS SERVER-SIDE até ${novaExpiracao.toISOString()}!`);
      }

      // 7. Registro de auditoria no log do sistema
      try {
        await supabaseAdmin.from('logs_sistema').insert({
          modulo: 'financeiro',
          nivel: 'success',
          acao: `Assinatura Aprovada via Webhook Server (${resolvedPlanoNome})`,
          detalhes: `Hotel "${currentHotel?.nome || hotelId}" liberado para uso. Validade até ${novaExpiracao.toLocaleDateString('pt-BR')} (+${planDetails.totalDias} dias). Ref MP: ${paymentId}.`,
          hotel_id: hotelId,
          criado_em: new Date().toISOString()
        });
      } catch (logErr) {
        // Ignora caso tabela de log não exista
      }

      return res.status(200).json({
        received: true,
        paymentId,
        status,
        mpValor,
        hotelId,
        diasLiberados: planDetails.totalDias,
        novaExpiracao: novaExpiracao.toISOString()
      });
    } else {
      console.warn(`[MP-WEBHOOK] Ação ignorada. status===approved? ${status === 'approved'} | hotelId existe? ${!!hotelId}.`);
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
