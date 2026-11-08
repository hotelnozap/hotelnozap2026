import { getSupabaseAdmin } from './_supabase.js';
import { applyCors } from './_cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET,OPTIONS')) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const supabaseAdmin = getSupabaseAdmin();
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

    const [resTotal, resApp, resWeb] = await Promise.all([
      queryTotal,
      queryApp,
      queryWeb
    ]);

    return res.status(200).json({
      total: resTotal.count ?? 0,
      app: resApp.count ?? 0,
      web: resWeb.count ?? 0
    });
  } catch (err) {
    return res.status(200).json({
      total: 0,
      app: 0,
      web: 0,
      warning: 'Tabela push_subscriptions pendente no Supabase.'
    });
  }
}
