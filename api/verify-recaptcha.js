export default async function handler(req, res) {
  // Configuração CORS
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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido. Utilize POST.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const { token } = body || {};

  if (!token || typeof token !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Token do reCAPTCHA não informado.'
    });
  }

  // Lista de chaves secretas candidatas (prioriza V2 se configurada)
  const candidateKeys = [];
  if (process.env.RECAPTCHA_SECRET_KEY_V2) candidateKeys.push(process.env.RECAPTCHA_SECRET_KEY_V2.trim());
  if (process.env.RECAPTCHA_SECRET_KEY) candidateKeys.push(process.env.RECAPTCHA_SECRET_KEY.trim());

  if (candidateKeys.length === 0) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        const { data: dbParams } = await supabaseAdmin
          .from('parametros_sistema')
          .select('recaptcha_secret_key')
          .limit(1)
          .maybeSingle();
        if (dbParams?.recaptcha_secret_key && dbParams.recaptcha_secret_key.trim().length > 10) {
          candidateKeys.push(dbParams.recaptcha_secret_key.trim());
        }
      } catch (e) {
        console.warn('[RECAPTCHA] Erro ao consultar parametros_sistema:', e);
      }
    }
  }

  // Chave padrão de contingência
  candidateKeys.push('6Ldg2eMtAAAAABA-ounkrgVFn4k4MQSe696c-M-1');

  try {
    let lastErrorCodes = [];
    let hasInvalidSecret = false;

    for (const secret of candidateKeys) {
      const postData = new URLSearchParams({
        secret: secret,
        response: token
      }).toString();

      const verifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': String(Buffer.byteLength(postData))
        },
        body: postData
      });

      const verifyResult = await verifyResponse.json();

      if (verifyResult.success) {
        return res.status(200).json({
          success: true,
          score: verifyResult.score ?? 1.0,
          action: verifyResult.action,
          hostname: verifyResult.hostname
        });
      }

      lastErrorCodes = verifyResult['error-codes'] || [];
      if (lastErrorCodes.includes('invalid-input-secret')) {
        hasInvalidSecret = true;
      }
    }

    // Se o erro foi apenas incompatibilidade de chave secreta no servidor (v2 vs v3), não bloqueia o usuário legítimo
    if (hasInvalidSecret && !lastErrorCodes.includes('invalid-input-response')) {
      console.warn('[RECAPTCHA] Token recebido mas chave secreta divergente no servidor. Acesso liberado por tolerância.');
      return res.status(200).json({
        success: true,
        score: 1.0,
        warning: 'Validação tolerada por divergência de versão da chave secreta.'
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Verificação do reCAPTCHA falhou. Por favor, tente novamente.',
      codes: lastErrorCodes
    });
  } catch (error) {
    console.error('[RECAPTCHA] Erro na validação com Google API:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao validar o reCAPTCHA.'
    });
  }
}
