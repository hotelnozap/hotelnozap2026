export default async function handler(req, res) {
  // Configuração de CORS para garantir funcionamento
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { title, message, url, segment, imageUrl } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });
    }

    const appId = process.env.ONESIGNAL_APP_ID || '40809032-1904-4b7c-80cb-f1e2e00992f4';
    const restApiKey = process.env.ONESIGNAL_REST_KEY;

    if (!restApiKey) {
      return res.status(500).json({
        error: 'Chave ONESIGNAL_REST_KEY não configurada no ambiente do servidor.'
      });
    }

    const payload = {
      app_id: appId,
      included_segments: segment === 'active' ? ['Active Subscriptions'] : ['Total Subscriptions'],
      headings: {
        en: title,
        pt: title
      },
      contents: {
        en: message,
        pt: message
      },
      url: url || 'https://hotelnozap.com.br',
      chrome_web_icon: 'https://hotelnozap.com.br/icon-192.png',
      chrome_web_badge: 'https://hotelnozap.com.br/icon-192.png'
    };

    if (imageUrl) {
      payload.chrome_web_image = imageUrl;
      payload.big_picture = imageUrl;
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${restApiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.errors || data.message || 'Erro ao enviar notificação no OneSignal',
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      id: data.id,
      recipients: data.recipients ?? 0,
      external_id: data.external_id
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Erro interno ao processar notificação'
    });
  }
}
