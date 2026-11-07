import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const PORTAL_CONFIGS = {
  parceiros: {
    title: 'Programa de Parceiros Hotel no Zap | Renda Recorrente Mensal',
    description: 'Construa sua carteira de faturamento recorrente com 50% de lucro líquido no mercado hoteleiro. Conheça o modelo de parceria e comece hoje!',
    canonicalUrl: 'https://parceiros.hotelnozap.com.br/',
    keywords: 'parceiro hotel no zap, franquia hotel, renda recorrente hotel, comissao hotelaria, programa de parceiros, afiliados hotelaria',
    ctaText: 'Conhecer Modelo de Parceria'
  },
  lp: {
    title: 'Hotel no Zap | Gestão Hoteleira 90% Autônoma',
    description: 'A plataforma de Gestão Hoteleira 90% autônoma mais completa do Brasil. Tenha o controle total do seu hotel na palma da sua mão!',
    canonicalUrl: 'https://lp.hotelnozap.com.br/',
    keywords: 'gestão hoteleira, hotel autônomo, pms hotel, automação hoteleira, whatsapp hotel, check-in digital, hotel no zap, software para hotel, sistema para pousada',
    ctaText: 'Acessar Hotel no Zap'
  },
  app: {
    title: 'Hotel no Zap - Painel Administrativo',
    description: 'Acesse agora mesmo o seu painel administrativo, e tenha o controle total do seu hotel.',
    canonicalUrl: 'https://app.hotelnozap.com.br/',
    keywords: 'painel hotel no zap, login hotel no zap, administracao hotelaria',
    ctaText: 'Acessar Painel Administrativo'
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Vary', 'User-Agent');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  let portalKey = (req.query?.portal || '').toLowerCase();
  let rawSlug = req.query?.slug || '';

  if (!portalKey && !rawSlug) {
    if (host.includes('parceiros')) portalKey = 'parceiros';
    else if (host.includes('lp.')) portalKey = 'lp';
    else if (host.includes('app.')) portalKey = 'app';
  }

  let ogTitle = 'Hotel no Zap | O Melhor do Turismo e Hotelaria no WhatsApp';
  let ogDescription = 'Encontre os melhores hotéis, pousadas e resorts com atendimento 100% humanizado e reservas diretas pelo WhatsApp.';
  let canonicalUrl = 'https://hotelnozap.com.br/';
  let urlImagem = 'https://hotelnozap.com.br/banner_hotelnozap.png';

  if (portalKey && PORTAL_CONFIGS[portalKey]) {
    const p = PORTAL_CONFIGS[portalKey];
    ogTitle = p.title;
    ogDescription = p.description;
    canonicalUrl = p.canonicalUrl;
  } else if (rawSlug) {
    if (Array.isArray(rawSlug)) rawSlug = rawSlug[0] || '';
    const cleanSlug = rawSlug
      .replace(/^https?:\/\/[^\/]+/i, '')
      .replace(/^\/?(hoteis|hotel)\/?/i, '')
      .split('?')[0]
      .trim();

    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    let hotel = null;
    if (cleanSlug) {
      try {
        const { data: byLink } = await supabase
          .from('hoteis')
          .select('*')
          .ilike('link', `%${cleanSlug}%`)
          .limit(1);

        if (byLink && byLink.length > 0) {
          hotel = byLink[0];
        } else {
          const { data: allHoteis } = await supabase
            .from('hoteis')
            .select('*')
            .limit(300);

          if (allHoteis) {
            hotel = allHoteis.find(h => {
              const hSlug = slugify(h.nome);
              return hSlug === cleanSlug || cleanSlug.includes(hSlug) || hSlug.includes(cleanSlug);
            });
          }
        }
      } catch (err) {
        console.warn('[og] Erro ao buscar hotel:', err);
      }
    }

    if (hotel) {
      ogTitle = `${hotel.nome || 'Hotel'} - Reserve pelo WhatsApp | Hotel no Zap`;
      ogDescription = hotel.descricao || `Reserve suas diárias no ${hotel.nome || 'hotel'} em ${hotel.cidade || ''} - ${hotel.estado || ''} diretamente pelo WhatsApp sem taxas extras.`;
      canonicalUrl = `https://hotelnozap.com.br/hoteis/${cleanSlug || slugify(hotel.nome)}`;
      urlImagem = hotel.imagem_url || hotel.logo_url || 'https://hotelnozap.com.br/banner_hotelnozap.png';
    }
  }

  // Detecta crawler / bot de redes sociais
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const isCrawler = /facebookexternalhit|whatsapp|twitterbot|telegrambot|linkedinbot|slackbot|googlebot|bingbot|applebot/i.test(ua);

  if (isCrawler) {
    const crawlerHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(ogTitle)}</title>
  <meta name="description" content="${escapeHtml(ogDescription)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDescription)}" />
  <meta property="og:image" content="${escapeHtml(urlImagem)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(urlImagem)}" />
  <meta property="og:image:alt" content="${escapeHtml(ogTitle)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${escapeHtml(canonicalUrl)}" />
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
  <meta name="twitter:image" content="${escapeHtml(urlImagem)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(ogTitle)}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalUrl)}" />
</head>
<body>
  <h1>${escapeHtml(ogTitle)}</h1>
  <p>${escapeHtml(ogDescription)}</p>
  <p><a href="${escapeHtml(canonicalUrl)}">Acessar página</a></p>
</body>
</html>`;

    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(crawlerHtml);
  }

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    let htmlPath = path.join(process.cwd(), 'dist', 'index.html');
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.join(process.cwd(), 'index.html');
    }

    if (fs.existsSync(htmlPath)) {
      let html = fs.readFileSync(htmlPath, 'utf8');
      html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(ogTitle)}</title>`);
      html = html.replace(/<link rel="canonical" href=".*?" \/>/i, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);
      html = html.replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`);
      html = html.replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`);
      html = html.replace(/<meta property="og:image" content=".*?" \/>/i, `<meta property="og:image" content="${escapeHtml(urlImagem)}" />`);
      html = html.replace(/<meta property="og:image:secure_url" content=".*?" \/>/i, `<meta property="og:image:secure_url" content="${escapeHtml(urlImagem)}" />`);
      html = html.replace(/<meta property="og:url" content=".*?" \/>/i, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`);
      html = html.replace(/<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />`);
      html = html.replace(/<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${escapeHtml(ogDescription)}" />`);
      html = html.replace(/<meta name="twitter:image" content=".*?" \/>/i, `<meta name="twitter:image" content="${escapeHtml(urlImagem)}" />`);
      html = html.replace(/<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${escapeHtml(ogDescription)}" />`);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    }
  } catch (err) {
    console.warn('[og] Falha ao ler index.html:', err);
  }

  return res.redirect(302, canonicalUrl);
}
