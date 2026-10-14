/**
 * Endpoint Serverless Vercel: /api/importar-todas-cidades
 * Aciona o robô em background do n8n para raspar todas as 142 cidades de MT
 */

export default async function handler(req, res) {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
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
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const { uf = 'MT' } = req.body || {};

    const n8nWebhookUrl = 'https://portaln8n.hotelnozap.com.br/webhook/importar-todas-cidades-mt';

    // Dispara a requisição para o n8n sem travar o usuário
    fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uf,
        iniciadoEm: new Date().toISOString(),
        origem: 'Painel Administrativo Hotel no Zap'
      })
    }).catch(err => {
      console.warn('Disparo n8n background capturado:', err.message);
    });

    return res.status(200).json({
      success: true,
      message: `Varredura automática para todas as cidades de ${uf} iniciada com sucesso em segundo plano!`,
      uf,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao acionar importação em background:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno ao acionar robô de busca.'
    });
  }
}
