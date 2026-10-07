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

  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    console.warn('[RECAPTCHA] RECAPTCHA_SECRET_KEY não encontrada nas variáveis de ambiente do servidor.');
    // Se a secret key não estiver definida no runtime da Vercel, não bloqueia o login
    return res.status(200).json({
      success: true,
      score: 1.0,
      warning: 'Validação ignorada: chave secreta não configurada no servidor.'
    });
  }

  try {
    const postData = new URLSearchParams({
      secret: secretKey,
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

    return res.status(400).json({
      success: false,
      error: 'Verificação do reCAPTCHA falhou. Por favor, tente novamente.',
      codes: verifyResult['error-codes']
    });
  } catch (error) {
    console.error('[RECAPTCHA] Erro na validação com Google API:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao validar o reCAPTCHA.'
    });
  }
}
