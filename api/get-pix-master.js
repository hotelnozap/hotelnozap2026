export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Chave PIX Master oficial padrão do Hotel no Zap
  const DEFAULT_PIX_KEY = 'def0e87a-f7d0-4c54-830b-473206cf78c6';

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    if (req.method === 'POST') {
      return res.status(500).json({ success: false, error: 'Chave de serviço Supabase não configurada.' });
    }
    return res.status(200).json({
      success: true,
      chavePix: DEFAULT_PIX_KEY,
      provider: 'mercadopago',
      source: 'default'
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

    const { chavePix, gatewayToken, gatewayPublicKey, gatewayEnvironment } = body || {};

    const patchPayload = {
      atualizado_em: new Date().toISOString()
    };
    if (chavePix !== undefined) patchPayload.chave_pix_master = String(chavePix).trim();
    if (gatewayToken !== undefined) patchPayload.gateway_token = String(gatewayToken).trim();
    if (gatewayPublicKey !== undefined) patchPayload.gateway_public_key = String(gatewayPublicKey).trim();
    if (gatewayEnvironment !== undefined) patchPayload.gateway_environment = String(gatewayEnvironment).trim();

    try {
      // Atualiza o registro mestre (id 00000000-0000-0000-0000-000000000001)
      const patchRes = await fetch(`${supabaseUrl}/rest/v1/parametros_sistema?id=eq.00000000-0000-0000-0000-000000000001`, {
        method: 'PATCH',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(patchPayload)
      });

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
    const response = await fetch(`${supabaseUrl}/rest/v1/parametros_sistema?select=chave_pix_master,gateway_provider,gateway_token,gateway_public_key,gateway_environment&limit=1`, {
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
