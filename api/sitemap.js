import { createClient } from '@supabase/supabase-js';

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function normalizeCitySlug(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');

  const BASE_URL = 'https://hotelnozap.com.br';
  const nowIso = new Date().toISOString().split('T')[0];

  // 1. Páginas estáticas principais
  const staticRoutes = [
    { loc: `${BASE_URL}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${BASE_URL}/cidades`, priority: '0.9', changefreq: 'daily' },
    { loc: `${BASE_URL}/parceiros`, priority: '0.8', changefreq: 'weekly' },
    { loc: `${BASE_URL}/assinar`, priority: '0.8', changefreq: 'weekly' },
    { loc: `${BASE_URL}/quem-somos`, priority: '0.7', changefreq: 'monthly' },
    { loc: `${BASE_URL}/fale-conosco`, priority: '0.7', changefreq: 'monthly' },
    { loc: `${BASE_URL}/informacoes-empresa`, priority: '0.6', changefreq: 'monthly' },
    { loc: `${BASE_URL}/termos`, priority: '0.3', changefreq: 'yearly' },
    { loc: `${BASE_URL}/privacidade`, priority: '0.3', changefreq: 'yearly' }
  ];

  // 2. Destinos e cidades principais
  const topCities = [
    'ipojuca-porto-de-galinhas',
    'recife',
    'maragogi',
    'porto-seguro',
    'salvador',
    'arraial-d-ajuda',
    'trancoso',
    'fortaleza',
    'jericoacoara',
    'armacao-dos-buzios',
    'paraty',
    'rio-de-janeiro',
    'ubatuba',
    'campos-do-jordao',
    'ilhabela',
    'florianopolis',
    'balneario-camboriu',
    'bombinhas',
    'gramado',
    'canela',
    'caldas-novas',
    'monte-verde',
    'belo-horizonte',
    'sao-paulo'
  ];

  const cityRoutes = topCities.map(c => ({
    loc: `${BASE_URL}/cidades/${c}`,
    priority: '0.85',
    changefreq: 'weekly'
  }));

  // 3. Busca hotéis do Supabase
  let hotelRoutes = [];
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      const { data: dbHoteis } = await supabaseAdmin
        .from('hoteis')
        .select('id, nome, cidade, link, criado_em')
        .order('nome', { ascending: true })
        .limit(2000);

      if (dbHoteis && dbHoteis.length > 0) {
        const seenSlugs = new Set();

        dbHoteis.forEach(h => {
          let slug = '';
          if (h.link && h.link.includes('/hoteis/')) {
            slug = h.link.split('/hoteis/')[1].split('?')[0].replace(/\/+$/, '');
          }
          if (!slug && h.nome) {
            slug = slugify(h.nome);
          }

          if (slug && !seenSlugs.has(slug)) {
            seenSlugs.add(slug);
            const dataMod = h.criado_em ? h.criado_em.split('T')[0] : nowIso;
            hotelRoutes.push({
              loc: `${BASE_URL}/hoteis/${slug}`,
              lastmod: dataMod,
              priority: '0.8',
              changefreq: 'weekly'
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn('[SITEMAP] Aviso ao carregar hotéis dinâmicos:', err);
  }

  // 4. Monta XML
  const allRoutes = [...staticRoutes, ...cityRoutes, ...hotelRoutes];

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes
  .map(
    r => `  <url>
    <loc>${r.loc}</loc>
    <lastmod>${r.lastmod || nowIso}</lastmod>
    <changefreq>${r.changefreq || 'weekly'}</changefreq>
    <priority>${r.priority || '0.7'}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return res.status(200).send(xmlContent);
}
