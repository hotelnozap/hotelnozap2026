import { getSupabaseAdmin } from './_supabase.js';
import { applyCors } from './_cors.js';
import * as webpush from 'web-push';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET,OPTIONS,POST,DELETE')) return;

  const supabaseAdmin = getSupabaseAdmin();
  const action = req.query.action || req.body?.action;

  // ──────────────────────────────────────────────────────────────────────────
  // AÇÃO 1: OBTER CHAVE PÚBLICA VAPID
  // ──────────────────────────────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'vapid-public-key') {
    const publicKey = (process.env.VAPID_PUBLIC_KEY || 'BNssYPXA_K4D951xVf3i7Uc__CzL_roft6oTXiJ27t3JvNbT_ftbGaqPvVaBc6CHpUZP1nfA8xqUZqosT_hlxzA').trim();
    return res.status(200).json({ publicKey });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AÇÃO 2: ESTATÍSTICAS DE INSCRITOS (APP VS WEB)
  // ──────────────────────────────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'stats') {
    const hotelId = req.query.hotelId || null;
    try {
      let queryTotal = supabaseAdmin.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('ativo', true);
      let queryApp = supabaseAdmin.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('ativo', true).eq('tipo_dispositivo', 'app');
      let queryWeb = supabaseAdmin.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('ativo', true).eq('tipo_dispositivo', 'web');

      if (hotelId) {
        queryTotal = queryTotal.eq('hotel_id', hotelId);
        queryApp = queryApp.eq('hotel_id', hotelId);
        queryWeb = queryWeb.eq('hotel_id', hotelId);
      }

      const [resTotal, resApp, resWeb] = await Promise.all([queryTotal, queryApp, queryWeb]);

      return res.status(200).json({
        total: resTotal.count ?? 0,
        app: resApp.count ?? 0,
        web: resWeb.count ?? 0
      });
    } catch (err) {
      return res.status(200).json({ total: 0, app: 0, web: 0 });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AÇÃO 3: INSCREVER DISPOSITIVO (POST) OU CANCELAR (DELETE)
  // ──────────────────────────────────────────────────────────────────────────
  if (action === 'subscribe') {
    if (req.method === 'POST') {
      try {
        const { subscription, tipoDispositivo = 'web', hotelId = null, userAgent = '' } = req.body || {};

        if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
          return res.status(400).json({ error: 'Assinatura Push inválida ou incompleta.' });
        }

        const tipo = tipoDispositivo === 'app' ? 'app' : 'web';

        const payload = {
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          tipo_dispositivo: tipo,
          hotel_id: hotelId || null,
          user_agent: userAgent || (req.headers['user-agent'] || ''),
          ativo: true,
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabaseAdmin
          .from('push_subscriptions')
          .upsert(payload, { onConflict: 'endpoint' })
          .select('id, tipo_dispositivo, hotel_id')
          .single();

        if (error) {
          console.error('[send-push:subscribe] Erro ao salvar inscrição:', error);
          return res.status(500).json({ error: 'Erro ao gravar inscrição no banco: ' + error.message });
        }

        return res.status(200).json({
          success: true,
          id: data?.id,
          tipoDispositivo: data?.tipo_dispositivo
        });
      } catch (err) {
        console.error('[send-push:subscribe] Erro interno:', err);
        return res.status(500).json({ error: 'Falha interna: ' + err.message });
      }
    }

    if (req.method === 'DELETE') {
      try {
        const { endpoint } = req.body || {};
        if (!endpoint) {
          return res.status(400).json({ error: 'Endpoint obrigatório para cancelamento.' });
        }

        await supabaseAdmin
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', endpoint);

        return res.status(200).json({ success: true, message: 'Inscrição removida.' });
      } catch (err) {
        return res.status(500).json({ error: 'Falha ao remover inscrição: ' + err.message });
      }
    }

    return res.status(405).json({ error: 'Método não permitido para subscribe.' });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AÇÃO 4: DISPARO DE NOTIFICAÇÃO PUSH NATIVA
  // ──────────────────────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  // 1. Validação de autenticação de administrador ou hotel
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

  // 2. Configuração VAPID
  const vapidSubject = (process.env.VAPID_SUBJECT || 'mailto:contato@hotelnozap.com.br').trim();
  const vapidPublicKey = (process.env.VAPID_PUBLIC_KEY || 'BNssYPXA_K4D951xVf3i7Uc__CzL_roft6oTXiJ27t3JvNbT_ftbGaqPvVaBc6CHpUZP1nfA8xqUZqosT_hlxzA').trim();
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim();

  if (!vapidPrivateKey) {
    return res.status(500).json({
      error: 'Chave privada VAPID_PRIVATE_KEY não configurada no ambiente do servidor.'
    });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  // 3. Consulta de inscritos filtrados
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

  // 4. Preparação do payload nativo
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

  // 5. Disparo em lotes com limpeza de endpoints expirados
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
            TTL: 86400,
            urgency: 'high'
          });
          sentCount++;
        } catch (err) {
          failCount++;
          if (err.statusCode === 404 || err.statusCode === 410) {
            expiredEndpoints.push(sub.endpoint);
          }
        }
      })
    );
  }

  // 6. Limpeza automática de inativos
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
