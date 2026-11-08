import { getSupabaseAdmin } from './_supabase.js';
import { applyCors } from './_cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST,DELETE,OPTIONS')) return;

  const supabaseAdmin = getSupabaseAdmin();

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
        console.error('[push-subscribe] Erro ao salvar inscrição:', error);
        return res.status(500).json({ error: 'Erro ao gravar inscrição no banco: ' + error.message });
      }

      return res.status(200).json({
        success: true,
        id: data?.id,
        tipoDispositivo: data?.tipo_dispositivo
      });
    } catch (err) {
      console.error('[push-subscribe] Erro interno:', err);
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

  return res.status(405).json({ error: 'Método não permitido.' });
}
