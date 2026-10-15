import fs from 'fs';
import path from 'path';

// Helper para sanitizar strings e prevenir injeções de HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Detecta o portal a partir da query (?portal=parceiros|lp|app) ou do host
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  let portalKey = (req.query?.portal || '').toLowerCase();

  if (!PORTAL_CONFIGS[portalKey]) {
    if (host.includes('parceiros')) portalKey = 'parceiros';
    else if (host.includes('lp')) portalKey = 'lp';
    else portalKey = 'app';
  }

  const config = PORTAL_CONFIGS[portalKey] || PORTAL_CONFIGS.app;
  const ogTitle = config.title;
  const ogDescription = config.description;
  const canonicalUrl = config.canonicalUrl;
  const keywords = config.keywords;
  const ctaText = config.ctaText;
  const urlImagem = 'https://hotelnozap.com.br/og-image.png';

  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const isCrawler = /facebookexternalhit|whatsapp|telegrambot|twitterbot|linkedinbot|slackbot|discordbot|applebot|googlebot|bingbot|crawler|spider/i.test(userAgent);

  // Se for crawler de rede social (WhatsApp, Facebook, Twitter, Telegram, LinkedIn, etc.)
  if (isCrawler) {
    const crawlerHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(ogTitle)}</title>
  <meta name="description" content="${escapeHtml(ogDescription)}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <meta name="author" content="Hotel no Zap" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />

  <!-- Open Graph / WhatsApp / Facebook / LinkedIn / Telegram -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:site_name" content="Hotel no Zap" />
  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDescription)}" />
  <meta property="og:image" content="${escapeHtml(urlImagem)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(urlImagem)}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(ogTitle)}" />
  <meta property="og:locale" content="pt_BR" />

  <!-- Twitter / X Cards -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${escapeHtml(canonicalUrl)}" />
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
  <meta name="twitter:image" content="${escapeHtml(urlImagem)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(ogTitle)}" />

  <link rel="icon" type="image/svg+xml" href="https://hotelnozap.com.br/favicon.svg" />
  <link rel="apple-touch-icon" sizes="180x180" href="https://hotelnozap.com.br/apple-touch-icon.png" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalUrl)}" />
</head>
<body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8f9ff; color: #0b1c30; padding: 40px; text-align: center;">
  <h1 style="font-size: 24px; margin-bottom: 16px;">${escapeHtml(ogTitle)}</h1>
  <p style="font-size: 16px; color: #4b5563; max-width: 600px; margin: 0 auto 24px;">${escapeHtml(ogDescription)}</p>
  <p><a href="${escapeHtml(canonicalUrl)}" style="display: inline-block; background-color: #008000; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">${escapeHtml(ctaText)}</a></p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(crawlerHtml);
  }

  // Para navegadores humanos normais:
  // Lê o index.html compilado da aplicação e substitui dinamicamente as metatags
  try {
    let htmlPath = path.join(process.cwd(), 'dist', 'index.html');
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.join(process.cwd(), 'index.html');
    }

    if (fs.existsSync(htmlPath)) {
      let html = fs.readFileSync(htmlPath, 'utf8');

      // Substitui o título
      html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(ogTitle)}</title>`);

      // Substitui a meta description padrão
      html = html.replace(/<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${escapeHtml(ogDescription)}" />`);

      // Substitui o link canonical
      html = html.replace(/<link rel="canonical" href=".*?" \/>/i, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);

      // Substitui as meta tags Open Graph
      html = html.replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`);
      html = html.replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`);
      html = html.replace(/<meta property="og:image" content=".*?" \/>/i, `<meta property="og:image" content="${escapeHtml(urlImagem)}" />`);
      html = html.replace(/<meta property="og:image:secure_url" content=".*?" \/>/i, `<meta property="og:image:secure_url" content="${escapeHtml(urlImagem)}" />`);
      html = html.replace(/<meta property="og:image:alt" content=".*?" \/>/i, `<meta property="og:image:alt" content="${escapeHtml(ogTitle)}" />`);
      html = html.replace(/<meta property="og:url" content=".*?" \/>/i, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`);

      // Substitui as meta tags do Twitter
      html = html.replace(/<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />`);
      html = html.replace(/<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${escapeHtml(ogDescription)}" />`);
      html = html.replace(/<meta name="twitter:image" content=".*?" \/>/i, `<meta name="twitter:image" content="${escapeHtml(urlImagem)}" />`);
      html = html.replace(/<meta name="twitter:image:alt" content=".*?" \/>/i, `<meta name="twitter:image:alt" content="${escapeHtml(ogTitle)}" />`);
      html = html.replace(/<meta name="twitter:url" content=".*?" \/>/i, `<meta name="twitter:url" content="${escapeHtml(canonicalUrl)}" />`);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    }
  } catch (err) {
    console.warn('[subdomain-og] Falha ao ler index.html local:', err);
  }

  // Fallback seguro se index.html não puder ser lido diretamente
  return res.redirect(302, canonicalUrl);
}
