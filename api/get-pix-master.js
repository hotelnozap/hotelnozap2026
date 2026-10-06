export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const DEFAULT_PIX_KEY = process.env.DEFAULT_PIX_KEY || '';

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    if (req.method === 'POST') {
      return res.status(500).json({
        success: false,
        error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente do servidor.'
      });
    }
    return res.status(200).json({
      success: true,
      chavePix: DEFAULT_PIX_KEY,
      provider: 'mercadopago',
      source: DEFAULT_PIX_KEY ? 'env_default' : 'missing'
    });
  }

  // 1. SALVAR CHAVE PIX MASTER OU CREDENCIAIS (POST)
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { 
      chavePix, 
      gatewayToken, 
      gatewayPublicKey, 
      gatewayEnvironment, 
      gatewayProvider,
      metaPixelId,
      googleMetaTag,
      googleAnalyticsId,
      recaptchaSiteKey,
      recaptchaSecretKey
    } = body || {};

    const patchPayload = {
      atualizado_em: new Date().toISOString()
    };
    if (chavePix !== undefined) patchPayload.chave_pix_master = String(chavePix).trim();
    if (gatewayToken !== undefined) patchPayload.gateway_token = String(gatewayToken).trim();
    if (gatewayPublicKey !== undefined) patchPayload.gateway_public_key = String(gatewayPublicKey).trim();
    if (gatewayEnvironment !== undefined) patchPayload.gateway_environment = String(gatewayEnvironment).trim();
    if (gatewayProvider !== undefined) patchPayload.gateway_provider = String(gatewayProvider).trim();
    if (metaPixelId !== undefined) patchPayload.meta_pixel_id = String(metaPixelId).trim();
    if (googleMetaTag !== undefined) patchPayload.google_meta_tag = String(googleMetaTag).trim();
    if (googleAnalyticsId !== undefined) patchPayload.google_analytics_id = String(googleAnalyticsId).trim();
    if (recaptchaSiteKey !== undefined) patchPayload.recaptcha_site_key = String(recaptchaSiteKey).trim();
    if (recaptchaSecretKey !== undefined) patchPayload.recaptcha_secret_key = String(recaptchaSecretKey).trim();

    try {
      // Atualiza o registro mestre (id 00000000-0000-0000-0000-000000000001)
      let patchRes = await fetch(`${supabaseUrl}/rest/v1/parametros_sistema?id=eq.00000000-0000-0000-0000-000000000001`, {
        method: 'PATCH',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(patchPayload)
      });

      // Se falhar por colunas ainda não existentes, tenta fallback salvando colunas base
      if (!patchRes.ok) {
        const fallbackPayload = {
          atualizado_em: new Date().toISOString()
        };
        if (chavePix !== undefined) fallbackPayload.chave_pix_master = String(chavePix).trim();
        if (gatewayToken !== undefined) fallbackPayload.gateway_token = String(gatewayToken).trim();
        if (gatewayPublicKey !== undefined) fallbackPayload.gateway_public_key = String(gatewayPublicKey).trim();
        if (gatewayEnvironment !== undefined) fallbackPayload.gateway_environment = String(gatewayEnvironment).trim();
        if (gatewayProvider !== undefined) fallbackPayload.gateway_provider = String(gatewayProvider).trim();

        patchRes = await fetch(`${supabaseUrl}/rest/v1/parametros_sistema?id=eq.00000000-0000-0000-0000-000000000001`, {
          method: 'PATCH',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(fallbackPayload)
        });
      }

      if (patchRes.ok) {
        const updated = await patchRes.json();
        return res.status(200).json({
          success: true,
          message: 'Chave PIX e parâmetros Master salvos com sucesso.',
          data: updated?.[0] || patchPayload
        });
      } else {
        const errText = await patchRes.text();
        return res.status(500).json({ success: false, error: errText });
      }
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // 2. CONSULTAR CHAVE PIX MASTER E CREDENCIAIS (GET)
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/parametros_sistema?select=*&limit=1`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });

    if (response.ok) {
      const rows = await response.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const item = rows[0];
        return res.status(200).json({
          success: true,
          chavePix: item.chave_pix_master?.trim() || DEFAULT_PIX_KEY,
          hasToken: Boolean(item.gateway_token && item.gateway_token.length > 15),
          token: item.gateway_token || '',
          publicKey: item.gateway_public_key || '',
          environment: item.gateway_environment || 'production',
          provider: item.gateway_provider || 'mercadopago',
          metaPixelId: item.meta_pixel_id || '',
          googleMetaTag: item.google_meta_tag || '',
          googleAnalyticsId: item.google_analytics_id || '',
          recaptchaSiteKey: item.recaptcha_site_key || '',
          recaptchaSecretKey: item.recaptcha_secret_key || '',
          source: 'database'
        });
      }
    }

    return res.status(200).json({
      success: true,
      chavePix: DEFAULT_PIX_KEY,
      source: 'fallback'
    });
  } catch (err) {
    return res.status(200).json({
      success: true,
      chavePix: DEFAULT_PIX_KEY,
      source: 'error_fallback'
    });
  }
}
