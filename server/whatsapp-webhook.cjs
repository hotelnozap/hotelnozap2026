/**
 * Standalone Node.js Webhook Server para HotelNoZap & Evolution API v2.3.0
 * 
 * Executar:
 * node server/whatsapp-webhook.cjs
 */

const http = require('http');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3333;
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://painelevolution.hotelnozap.com.br';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!EVOLUTION_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[Webhook] ❌ Variáveis de ambiente obrigatórias não definidas.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Cache anti-loop em memória (responde no máximo 1x a cada 12 horas por número)
const antiLoopCache = new Map();
const INTERVALO_MS = 12 * 60 * 60 * 1000;

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Healthcheck
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'online', service: 'HotelNoZap WhatsApp Webhook' }));
    return;
  }

  // Webhook Receiver: POST /webhook ou POST /
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const event = (payload.event || '').toLowerCase();
        const instanceName = payload.instance || payload.instanceName || '';

        console.log(`[Webhook] Evento recebido: "${event}" para instância "${instanceName}"`);

        // Aceita apenas eventos de mensagens recebidas
        if (!event.includes('messages.upsert') && !event.includes('messages_upsert')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ignored_event' }));
          return;
        }

        const data = payload.data || payload;
        const key = data.key || {};
        const remoteJid = key.remoteJid || '';
        const fromMe = key.fromMe === true;

        // Ignora mensagens enviadas pelo próprio número ou grupos
        if (fromMe || !remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('broadcast')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ignored_sender' }));
          return;
        }

        // Extrai telefone real considerando LIDs do WhatsApp
        let phone = '';
        if (key.remoteJidAlt && key.remoteJidAlt.includes('@s.whatsapp.net')) {
          phone = key.remoteJidAlt.replace(/\D/g, '');
        } else if (key.remoteJid && key.remoteJid.includes('@s.whatsapp.net')) {
          phone = key.remoteJid.replace(/\D/g, '');
        } else {
          phone = (key.remoteJidAlt || key.remoteJid || '').replace(/@.*$/, '').replace(/\D/g, '');
        }

        if (!phone || phone.length < 10) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'invalid_number' }));
          return;
        }

        const cleanNumber = phone;

        // Anti-loop de 12 horas
        const cacheKey = `${instanceName}_${cleanNumber}`;
        const agora = Date.now();
        const ultimo = antiLoopCache.get(cacheKey) || 0;
        if (agora - ultimo < INTERVALO_MS) {
          console.log(`[Webhook] Número ${cleanNumber} já respondido nas últimas 12h. Ignorando.`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'recently_replied' }));
          return;
        }

        // Nome do cliente e nome do hotel
        const pushName = (data.pushName || '').trim();
        const saudacao = pushName ? `Olá ${pushName}! 👋` : `Olá! 👋`;

        // Busca informações do hotel no Supabase através da instância
        let hotelNome = 'Hotel Morada da Lua';
        let hotelSlug = 'hotelmoradadalua';

        try {
          const { data: hotelData } = await supabase
            .from('hoteis')
            .select('id, nome, link, nome_instancia')
            .or(`nome_instancia.eq.${instanceName},id.ilike.%${instanceName}%`)
            .maybeSingle();

          if (hotelData) {
            hotelNome = hotelData.nome || hotelNome;
            if (hotelData.link && hotelData.link.startsWith('/hoteis/')) {
              hotelSlug = hotelData.link.replace('/hoteis/', '');
            } else if (hotelData.nome) {
              hotelSlug = hotelData.nome
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-');
            }
          } else {
            const parts = instanceName.split('_');
            if (parts.length >= 3) {
              hotelSlug = parts[2];
              hotelNome = parts[2].charAt(0).toUpperCase() + parts[2].slice(1);
            }
          }
        } catch (e) {
          console.warn('[Webhook] Erro ao consultar hotel no Supabase:', e.message);
        }

        const domain = process.env.APP_BASE_URL || 'http://localhost:5173';
        const hotelLink = `${domain}/hoteis/${hotelSlug}`;
        const mensagem = `${saudacao} Bem-vindo(a) ao ${hotelNome}.\n\nPara consultar fotos das acomodações, valores de diárias atualizados e realizar a sua reserva com confirmação imediata, acesse o nosso link oficial:\n\n👉 ${hotelLink}\n\n⚠️ É necessário entrar no link acima para verificar a disponibilidade de quartos, simular os preços para as suas datas e garantir sua reserva. Caso tenha qualquer dúvida, estamos à disposição por aqui!`;

        console.log(`[Webhook] Disparando auto-resposta para ${cleanNumber} (${hotelNome})...`);

        // Disparo para Evolution API
        const evoUrl = `${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(instanceName)}`;
        const fetchRes = await fetch(evoUrl, {
          method: 'POST',
          headers: {
            'apikey': EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            number: cleanNumber,
            text: mensagem
          })
        });

        const evoData = await fetchRes.json().catch(() => null);
        console.log(`[Webhook] Resposta Evolution API: status ${fetchRes.status}`, evoData?.key?.id ? 'Mensagem enviada!' : evoData);

        antiLoopCache.set(cacheKey, agora);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: fetchRes.ok,
          instance: instanceName,
          recipient: cleanNumber
        }));
      } catch (err) {
        console.error('[Webhook] Erro no processamento do webhook:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`[HotelNoZap] Webhook Server rodando na porta ${PORT}`);
  console.log(`[HotelNoZap] Endpoint de escuta: http://localhost:${PORT}/webhook`);
});
