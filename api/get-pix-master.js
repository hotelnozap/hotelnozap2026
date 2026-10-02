export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Chave PIX Master oficial padrão do Hotel no Zap
  const DEFAULT_PIX_KEY = 'def0e87a-f7d0-4c54-830b-473206cf78c6';

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    return res.status(200).json({
      success: true,
      chavePix: DEFAULT_PIX_KEY,
      provider: 'mercadopago',
      source: 'default'
    });
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/parametros_sistema?select=chave_pix_master,gateway_provider,gateway_token,gateway_public_key&limit=1`, {
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
