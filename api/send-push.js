import { getSupabaseAdmin } from './_supabase.js';
import { applyCors } from './_cors.js';
import webpush from 'web-push';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET,OPTIONS,POST')) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  // 1. VALIDAÇÃO DE AUTENTICAÇÃO E PERMISSÃO
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

  const {
    title,
    message,
    url,
    imageUrl,
    hotelId,
    publicoAlvo = 'all' // 'all' | 'app' | 'web'
  } = req.body || {};

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

  if (!title || !message) {
    return res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });
  }

  // 2. CONFIGURAÇÃO VAPID NATIVA
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:contato@hotelnozap.com.br';
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BNssYPXA_K4D951xVf3i7Uc__CzL_roft6oTXiJ27t3JvNbT_ftbGaqPvVaBc6CHpUZP1nfA8xqUZqosT_hlxzA';
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (!vapidPrivateKey) {
    return res.status(500).json({
      error: 'Chave privada VAPID_PRIVATE_KEY não configurada no ambiente do servidor.'
    });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  // 3. CONSULTA DE INSCRITOS NO SUPABASE
  let query = supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, tipo_dispositivo, hotel_id')
    .eq('ativo', true);

  if (!isMasterAdmin && hotelData) {
    query = query.eq('hotel_id', hotelData.id);
  } else if (hotelId && hotelId !== 'all') {
    query = query.eq('hotel_id', hotelId);
  }

  if (publicoAlvo === 'app') {
    query = query.eq('tipo_dispositivo', 'app');
  } else if (publicoAlvo === 'web') {
    query = query.eq('tipo_dispositivo', 'web');
  }

  const { data: subscriptions, error: subsError } = await query;

  if (subsError) {
    console.error('[send-push] Erro ao buscar inscrições:', subsError);
    return res.status(500).json({
      error: 'Erro ao consultar base de inscritos: ' + subsError.message + '. Certifique-se de executar o script SQL no Supabase.'
    });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return res.status(200).json({
      success: true,
      recipients: 0,
      sent: 0,
      failed: 0,
      message: 'Nenhum inscrito encontrado para o filtro selecionado.'
    });
  }

  // 4. PREPARAÇÃO DO PAYLOAD NATIVO (W3C PUSH)
  const finalUrl = url || (hotelData?.slug 
    ? `https://hotelnozap.com.br/?hotel=${hotelData.slug}` 
    : (hotelData?.id ? `https://hotelnozap.com.br/?hotel=${hotelData.id}` : 'https://hotelnozap.com.br'));

  const finalImage = imageUrl || hotelData?.imagem_url || hotelData?.logo_url || null;

  const pushPayload = JSON.stringify({
    title,
    body: message,
    message,
    icon: hotelData?.logo_url || 'https://hotelnozap.com.br/icon-192.png',
    badge: 'https://hotelnozap.com.br/icon-192.png',
    image: finalImage,
    url: finalUrl,
    vibrate: [200, 100, 200],
    data: {
      url: finalUrl,
      hotelId: hotelData?.id || null,
      hotelNome: hotelData?.nome || null,
      sentBy: userEmail,
      timestamp: Date.now()
    }
  });

  // 5. DISPARO EM LOTES CONCORRENTES COM LIMPEZA DE DISPOSITIVOS EXPIRADOS
  let sentCount = 0;
  let failCount = 0;
  const expiredEndpoints = [];

  const BATCH_SIZE = 25;
  for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + BATCH_SIZE);
    
    await Promise.allSettled(
      batch.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        try {
          await webpush.sendNotification(pushSubscription, pushPayload, {
            TTL: 86400, // 24 horas no cache do Google FCM / Apple APNs se aparelho estiver offline
            urgency: 'high'
          });
          sentCount++;
        } catch (err) {
          failCount++;
          // Se o dispositivo desinstalou o app ou cancelou a permissão (404/410 Gone)
          if (err.statusCode === 404 || err.statusCode === 410) {
            expiredEndpoints.push(sub.endpoint);
          } else {
            console.warn('[send-push] Erro ao enviar para endpoint:', sub.id, err.message);
          }
        }
      })
    );
  }

  // 6. LIMPEZA AUTOMÁTICA DE DISPOSITIVOS INATIVOS NO BANCO
  if (expiredEndpoints.length > 0) {
    await supabaseAdmin
      .from('push_subscriptions')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .in('endpoint', expiredEndpoints)
      .catch((err) => console.error('[send-push] Falha ao inativar endpoints expirados:', err));
  }

  return res.status(200).json({
    success: true,
    recipients: subscriptions.length,
    sent: sentCount,
    failed: failCount,
    cleaned: expiredEndpoints.length,
    id: `push-${Date.now()}`
  });
}
