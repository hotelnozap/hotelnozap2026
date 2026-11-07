/**
 * api/infinitepay-pix.js
 * Endpoint Serverless seguro para integração do Checkout Integrado InfinitePay (Pix & Cartão).
 * A chave de API secreta (inchk_...) NUNCA é exposta no frontend.
 */

import { getSupabaseAdmin } from './_supabase.js';
import { applyCors } from './_cors.js';

// Rate Limiter em memória para proteção contra flooding
const rateLimitMap = global._infinitePayRateLimit || (global._infinitePayRateLimit = new Map());

function isRateLimited(ip, maxRequests = 15, windowMs = 60000) {
  if (!ip || ip === 'unknown') return false;
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) || []).filter(ts => now - ts < windowMs);
  if (timestamps.length >= maxRequests) {
    return true;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

const DEFAULT_INFINITEPAY_KEY = process.env.INFINITEPAY_API_KEY || 'inchk_dGT5_7LqxwjNQifWRpIF9aO8r5PFfgiyZCI9JvVbFj0';

function maskApiKey(key) {
  if (!key || key.length < 10) return '••••••••';
  return key.slice(0, 6) + '••••••••••••••••' + key.slice(-4);
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET,POST,OPTIONS')) return;

  const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      success: false,
      error: 'Muitas requisições em pouco tempo. Aguarde um minuto.'
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const action = req.query?.action || body?.action || 'test';
  let supabaseAdmin = null;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    console.warn('[InfinitePay] Falha ao obter Supabase Admin:', e.message);
  }

  // Obter chave da API do InfinitePay:
  // 1. Chave enviada explicitamente na requisição (se houver alteração pelo painel)
  // 2. Chave salva nos parâmetros do sistema no banco
  // 3. Variável de ambiente INFINITEPAY_API_KEY ou chave padrão segura
  let apiKey = (body?.apiKey || '').trim();

  if (!apiKey && supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin
        .from('parametros_sistema')
        .select('infinitepay_api_key, infinitepay_handle')
        .limit(1)
        .maybeSingle();

      if (data?.infinitepay_api_key) {
        apiKey = data.infinitepay_api_key.trim();
      }
    } catch (e) {
      console.warn('[InfinitePay] Aviso ao consultar parametros_sistema:', e);
    }
  }

  if (!apiKey) {
    apiKey = DEFAULT_INFINITEPAY_KEY;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AÇÃO: TESTAR CONEXÃO
  // ──────────────────────────────────────────────────────────────────────────
  if (action === 'test') {
    try {
      const testPayload = {
        order_nsu: `test-${Date.now()}`,
        amount: 100, // R$ 1,00
        items: [
          {
            description: 'Teste de Validação HotelNoZap',
            quantity: 1,
            price: 100
          }
        ]
      };

      const response = await fetch('https://api.checkout.infinitepay.io/links', {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload)
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.url) {
        // Extrai o handle da URL gerada, ex: https://checkout.infinitepay.io/everaldo-souza-6yb/abc123
        let detectedHandle = '';
        try {
          const parsed = new URL(data.url);
          const parts = parsed.pathname.split('/').filter(Boolean);
          if (parts.length > 0) detectedHandle = parts[0];
        } catch {}

        return res.status(200).json({
          success: true,
          message: 'Conexão com InfinitePay validada com sucesso! Checkout e Pix prontos.',
          detectedHandle,
          sampleUrl: data.url,
          maskedKey: maskApiKey(apiKey)
        });
      } else {
        return res.status(400).json({
          success: false,
          error: data?.message || data?.error || 'Chave rejeitada pela InfinitePay.',
          details: data
        });
      }
    } catch (err) {
      console.error('[InfinitePay] Erro no teste de conexão:', err);
      return res.status(500).json({
        success: false,
        error: 'Falha na comunicação com a InfinitePay: ' + (err.message || String(err))
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AÇÃO: OBTER CONFIGURAÇÃO PÚBLICA (MASCARADA - NUNCA EXPÕE A CHAVE)
  // ──────────────────────────────────────────────────────────────────────────
  if (action === 'get_config') {
    return res.status(200).json({
      success: true,
      configured: !!apiKey,
      maskedKey: maskApiKey(apiKey),
      gateway: 'infinitepay',
      pixFee: '0%'
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AÇÃO: CRIAR LINK DE PAGAMENTO / PIX
  // ──────────────────────────────────────────────────────────────────────────
  if (action === 'create_link') {
    const { order_nsu, amount, items, redirect_url, webhook_url, customer } = body;

    if (!order_nsu) {
      return res.status(400).json({ success: false, error: 'order_nsu é obrigatório.' });
    }

    // Amount deve ser em centavos inteiros (ex: R$ 150,50 -> 15050)
    let centavos = 0;
    if (typeof amount === 'number') {
      // Se vier em reais (ex: 150.5), converte para centavos; se já for >= 1000 e inteiro, verifica contexto
      centavos = Math.round(amount * 100);
    } else if (typeof amount === 'string') {
      const parsed = parseFloat(amount.replace(',', '.'));
      centavos = Math.round(parsed * 100);
    }

    if (!centavos || centavos < 100) {
      return res.status(400).json({ success: false, error: 'Valor mínimo para pagamento é R$ 1,00.' });
    }

    const payloadItems = (Array.isArray(items) && items.length > 0)
      ? items.map(item => ({
          description: String(item.description || 'Hospedagem / Consumo').substring(0, 100),
          quantity: Number(item.quantity) || 1,
          price: Math.round(Number(item.price || amount) * 100) || centavos
        }))
      : [
          {
            description: `Reserva HotelNoZap #${order_nsu}`,
            quantity: 1,
            price: centavos
          }
        ];

    const payload = {
      order_nsu: String(order_nsu),
      amount: centavos,
      items: payloadItems,
      redirect_url: redirect_url || 'https://hotelnozap.com.br',
      webhook_url: webhook_url || 'https://hotelnozap.com.br/api/infinitepay-webhook'
    };

    if (customer?.name || customer?.email) {
      payload.customer = {
        name: customer.name || undefined,
        email: customer.email || undefined,
        phone_number: customer.phone || undefined
      };
    }

    try {
      console.log(`[InfinitePay] Criando checkout link order_nsu=${order_nsu} amount=${centavos}`);
      const response = await fetch('https://api.checkout.infinitepay.io/links', {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.url) {
        return res.status(200).json({
          success: true,
          url: data.url,
          order_nsu,
          amount_cents: centavos
        });
      } else {
        console.error('[InfinitePay] Erro retorno criação link:', data);
        return res.status(400).json({
          success: false,
          error: data?.message || data?.error || 'Não foi possível gerar o link na InfinitePay.',
          details: data
        });
      }
    } catch (err) {
      console.error('[InfinitePay] Exceção ao gerar link:', err);
      return res.status(500).json({
        success: false,
        error: 'Erro de comunicação com a InfinitePay: ' + (err.message || String(err))
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AÇÃO: SALVAR CONFIGURAÇÃO (PARAMETROS_SISTEMA)
  // ──────────────────────────────────────────────────────────────────────────
  if (action === 'save_config') {
    const newApiKey = (body?.newApiKey || '').trim();
    const handle = (body?.handle || '').trim();

    if (!newApiKey) {
      return res.status(400).json({ success: false, error: 'Chave não informada.' });
    }

    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('parametros_sistema')
          .update({
            infinitepay_api_key: newApiKey,
            infinitepay_handle: handle,
            updated_at: new Date().toISOString()
          })
          .eq('id', 1);
      } catch (e) {
        console.warn('[InfinitePay] Aviso ao salvar em parametros_sistema:', e);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Configurações da InfinitePay salvas com segurança no servidor!',
      maskedKey: maskApiKey(newApiKey)
    });
  }

  return res.status(400).json({ success: false, error: `Ação '${action}' não reconhecida.` });
}
