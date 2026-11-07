import { getSupabaseAdmin } from './_supabase.js';
import { applyCors } from './_cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET,OPTIONS,PATCH,DELETE,POST,PUT')) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  // 1. VALIDAÇÃO DE AUTENTICAÇÃO E PERMISSÃO DE ADMINISTRADOR
  const supabaseAdmin = getSupabaseAdmin();

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
    .select('perfil, cargo, hotel_id, email, nome')
    .or(`auth_user_id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle();

  const perfil = (dbUser?.perfil || user.user_metadata?.perfil || '').toLowerCase();
  const cargo = (dbUser?.cargo || '').toLowerCase();
  const userEmail = (user.email || '').toLowerCase();

  const isMasterAdmin = 
    userEmail === 'contato@hotelnozap.com.br' ||
    userEmail === 'everaldozs@gmail.com' ||
    perfil.includes('admin') ||
    perfil.includes('super') ||
    perfil.includes('master') ||
    cargo.includes('admin');

  const { title, message, url, segment, imageUrl, hotelId } = req.body || {};

  const targetHotelId = dbUser?.hotel_id || user.user_metadata?.hotel_id || hotelId;
  let hotelData = null;

  if (targetHotelId) {
    const { data: h } = await supabaseAdmin
      .from('hoteis')
      .select('id, nome, cidade, estado, imagem_url, logo_url, slug')
      .eq('id', targetHotelId)
      .maybeSingle();
    hotelData = h;
  }

  const isHotelAuthorized = Boolean(hotelData);

  if (!isMasterAdmin && !isHotelAuthorized) {
    return res.status(403).json({ error: 'Permissão negada. Apenas administradores do sistema e gestores de hotéis podem disparar notificações push.' });
  }

  try {
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

    const finalUrl = url || (hotelData?.slug 
      ? `https://hotelnozap.com.br/?hotel=${hotelData.slug}` 
      : (hotelData?.id ? `https://hotelnozap.com.br/?hotel=${hotelData.id}` : 'https://hotelnozap.com.br'));

    const finalImage = imageUrl || hotelData?.imagem_url || hotelData?.logo_url;

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
      url: finalUrl,
      chrome_web_icon: hotelData?.logo_url || 'https://hotelnozap.com.br/icon-192.png',
      chrome_web_badge: 'https://hotelnozap.com.br/icon-192.png',
      data: {
        type: hotelData ? 'hotel_push' : 'admin_broadcast',
        hotel_id: hotelData?.id || null,
        hotel_nome: hotelData?.nome || null,
        sent_by: user.email,
        timestamp: new Date().toISOString()
      }
    };

    if (finalImage) {
      payload.chrome_web_image = finalImage;
      payload.big_picture = finalImage;
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
