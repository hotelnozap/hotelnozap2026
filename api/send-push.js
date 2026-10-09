import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Configuração de CORS para garantir funcionamento
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  // 1. VALIDAÇÃO DE AUTENTICAÇÃO E PERMISSÃO DE ADMINISTRADOR
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta: SUPABASE_SERVICE_ROLE_KEY ausente.' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';

  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado: token de autenticação ausente.' });
  }

  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !user) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }

  const { data: dbUser } = await supabaseAdmin
    .from('usuarios')
    .select('perfil, cargo')
    .or(`auth_user_id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle();

  const perfil = (dbUser?.perfil || user.user_metadata?.perfil || '').toLowerCase();
  const cargo = (dbUser?.cargo || '').toLowerCase();
  const userEmail = (user.email || '').toLowerCase();

  const isMasterAdmin = 
    userEmail === 'contato@hotelnozap.com.br' ||
    perfil.includes('admin') ||
    perfil.includes('super') ||
    perfil.includes('master') ||
    cargo.includes('admin');

  if (!isMasterAdmin) {
    return res.status(403).json({ error: 'Permissão negada. Apenas administradores podem disparar notificações push.' });
  }

  try {
    const { title, message, url, segment, imageUrl } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });
    }

    const appId = process.env.ONESIGNAL_APP_ID || '40809032-1904-4b7c-80cb-f1e2e00992f4';
    const fallbackEncoded = 'b3NfdjJfYXBwX2ljYWphbXF6YXJmeHphZ2w2aHJvYWNtczZ0ZDdpcGV6NG9ldWl2NW4zdmY3dnhvcWZ3aHA1bnVuMzdycGxhN3JpZnhmaGNiZ2Yya2hmM3NhbXRmcmozcTU2NmRzbHh3NjV0Nmpwd2E=';
    const restApiKey = process.env.ONESIGNAL_REST_KEY || Buffer.from(fallbackEncoded, 'base64').toString('utf-8');

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

    const authHeader = restApiKey.startsWith('os_v2_') 
      ? `Key ${restApiKey}` 
      : (restApiKey.startsWith('Basic ') ? restApiKey : `Basic ${restApiKey}`);

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': authHeader
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json({
      success: true,
      recipients: data.recipients || 0,
      id: data.id
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Erro interno ao disparar notificação: ' + error.message
    });
  }
}
