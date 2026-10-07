import { createClient } from '@supabase/supabase-js';
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

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Vary', 'User-Agent');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extrai e sanitiza o slug do hotel
  let rawSlug = req.query.slug || '';
  if (Array.isArray(rawSlug)) rawSlug = rawSlug[0] || '';
  const cleanSlug = rawSlug
    .replace(/^https?:\/\/[^\/]+/i, '')
    .replace(/^\/?(hoteis|hotel)\/?/i, '')
    .split('?')[0]
    .trim();

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ia3ZnbHV1bmJua3R6dWx6amZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NDkzMjgsImV4cCI6MjEwMzQyNTMyOH0.ALbCN61Orm58EW7VhfXFnBxeyW3ILiOkuan8n5-cs5U';

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  let hotel = null;

  if (cleanSlug) {
    try {
      // 1. Tenta buscar pelo link contendo o slug
      const { data: byLink } = await supabase
        .from('hoteis')
        .select('*')
        .ilike('link', `%${cleanSlug}%`)
        .limit(1);

      if (byLink && byLink.length > 0) {
        hotel = byLink[0];
      }

      // 2. Se não achou, tenta pelo ID se parecer um UUID
      if (!hotel && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanSlug)) {
        const { data: byId } = await supabase
          .from('hoteis')
          .select('*')
          .eq('id', cleanSlug)
          .maybeSingle();
        if (byId) hotel = byId;
      }

      // 3. Se ainda não achou, busca todos os hotéis para bater com slugify(nome)
      if (!hotel) {
        const { data: allHoteis } = await supabase
          .from('hoteis')
          .select('*')
          .limit(100);

        if (allHoteis && allHoteis.length > 0) {
          const match = allHoteis.find(h => {
            const sName = slugify(h.nome || '');
            const sLink = slugify(h.link || '');
            const target = slugify(cleanSlug);
            return sName === target || sLink.includes(target) || target.includes(sName);
          });
          if (match) hotel = match;
        }
      }
    } catch (e) {
      console.warn('[hotel-og] Erro ao buscar hotel no Supabase:', e);
    }
  }

  // Se não encontrar o hotel, utiliza dados padrão de alta conversão da plataforma
  const nomeHotel = hotel?.nome || 'Hotel no Zap';
  const cidade = hotel?.cidade || '';
  const uf = hotel?.uf || '';
  const localizacao = (cidade && uf) ? ` (${cidade}/${uf})` : (cidade ? ` (${cidade})` : '');
  const urlImagem = hotel?.meta_imagem || hotel?.url_imagem || 'https://hotelnozap.com.br/og-image.png';

  // ── DEFINIÇÃO DAS CTAs DE ALTA CONVERSÃO ──
  // Título: Prioriza customizado pelo hoteleiro, senão usa fórmula comprovada de alta conversão
  const ogTitle = hotel?.meta_titulo 
    ? hotel.meta_titulo 
    : (hotel ? `🏨 ${nomeHotel} - Reserve Direto com Confirmação Imediata` : 'Hotel no Zap - Guia de Hotéis, Pousadas e Reservas');

  // Descrição / CTA: Persuasiva, clara e focada em clique
  const ogDescription = hotel?.meta_descricao 
    ? hotel.meta_descricao 
    : (hotel 
        ? `👉 Veja fotos das acomodações, consulte diárias e garanta sua reserva no ${nomeHotel}${localizacao} com confirmação instantânea pelo WhatsApp. Clique e reserve agora!` 
        : 'O jeito mais inteligente de se hospedar. Encontre os melhores hotéis, veja fotos, consulte diárias e reserve em instantes no WhatsApp.');

  const canonicalUrl = cleanSlug 
    ? `https://hotelnozap.com.br/hoteis/${cleanSlug}` 
    : 'https://hotelnozap.com.br/';

  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const isCrawler = /facebookexternalhit|whatsapp|telegrambot|twitterbot|linkedinbot|slackbot|discordbot|applebot|googlebot|bingbot|crawler|spider/i.test(userAgent);

  // Se for crawler de rede social (WhatsApp, Facebook, Twitter, Telegram, etc.)
  if (isCrawler) {
    const crawlerHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(ogTitle)}</title>
  <meta name="description" content="${escapeHtml(ogDescription)}" />
  <meta name="author" content="${escapeHtml(nomeHotel)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />

  <!-- Open Graph / WhatsApp / Facebook / Telegram -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:site_name" content="${escapeHtml(nomeHotel)} • Hotel no Zap" />
  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDescription)}" />
  <meta property="og:image" content="${escapeHtml(urlImagem)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(urlImagem)}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(ogTitle)}" />
  <meta property="og:locale" content="pt_BR" />

  <!-- Twitter Cards -->
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
  <p><a href="${escapeHtml(canonicalUrl)}">Acessar página do hotel</a></p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(crawlerHtml);
  }

  // Para navegadores humanos normais:
  // Tenta ler o index.html compilado da aplicação e substituir dinamicamente as metatags
  try {
    let htmlPath = path.join(process.cwd(), 'dist', 'index.html');
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.join(process.cwd(), 'index.html');
    }

    if (fs.existsSync(htmlPath)) {
      let html = fs.readFileSync(htmlPath, 'utf8');

      // Substitui o título
      html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(ogTitle)}</title>`);

      // Substitui canonical
      html = html.replace(/<link rel="canonical" href=".*?" \/>/i, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);

      // Substitui as meta tags Open Graph
      html = html.replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`);
      html = html.replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`);
      html = html.replace(/<meta property="og:image" content=".*?" \/>/i, `<meta property="og:image" content="${escapeHtml(urlImagem)}" />`);
      html = html.replace(/<meta property="og:image:secure_url" content=".*?" \/>/i, `<meta property="og:image:secure_url" content="${escapeHtml(urlImagem)}" />`);
      html = html.replace(/<meta property="og:url" content=".*?" \/>/i, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`);

      // Substitui as meta tags do Twitter
      html = html.replace(/<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />`);
      html = html.replace(/<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${escapeHtml(ogDescription)}" />`);
      html = html.replace(/<meta name="twitter:image" content=".*?" \/>/i, `<meta name="twitter:image" content="${escapeHtml(urlImagem)}" />`);

      // Substitui a meta description padrão
      html = html.replace(/<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${escapeHtml(ogDescription)}" />`);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    }
  } catch (err) {
    console.warn('[hotel-og] Falha ao ler index.html local:', err);
  }

  // Fallback se index.html não puder ser lido diretamente: redireciona para a rota limpa
  return res.redirect(302, canonicalUrl);
}
