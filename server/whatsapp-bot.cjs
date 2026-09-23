/**
 * whatsapp-bot.cjs
 * Robô autônomo de auto-resposta para HotelNoZap & Evolution API
 * Roda de forma contínua em segundo plano, monitora mensagens recebidas
 * e responde automaticamente com o link do hotel.
 */

const { createClient } = require('@supabase/supabase-js');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://painelevolution.hotelnozap.com.br';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';

if (!EVOLUTION_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[Bot] ❌ Variáveis de ambiente obrigatórias não definidas. Configure EVOLUTION_API_KEY, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Intervalo anti-loop: 30 segundos (permite testes rápidos sem spam na mesma conversa)
const COOLDOWN_MS = 30 * 1000;
const answeredCache = new Map(); // phone -> timestamp
const seenMessageIds = new Set();

function extractTargetPhone(key) {
  if (!key) return null;
  if (key.remoteJidAlt && key.remoteJidAlt.includes('@s.whatsapp.net')) {
    return key.remoteJidAlt.replace(/\D/g, '');
  }
  if (key.remoteJid && key.remoteJid.includes('@s.whatsapp.net')) {
    return key.remoteJid.replace(/\D/g, '');
  }
  const raw = (key.remoteJidAlt || key.remoteJid || '').replace(/@.*$/, '');
  const clean = raw.replace(/\D/g, '');
  return clean.length >= 10 ? clean : null;
}

async function getHotelData(instanceName) {
  try {
    const { data } = await supabase
      .from('hoteis')
      .select('id, nome, link, nome_instancia')
      .or(`nome_instancia.eq.${instanceName},id.ilike.%${instanceName}%`)
      .maybeSingle();

    if (data) {
      const slug = (data.link && data.link.startsWith('/hoteis/'))
        ? data.link.replace('/hoteis/', '')
        : (data.nome || 'hotel').toLowerCase().replace(/\s+/g, '-');
      return { nome: data.nome || 'Hotel Morada da Lua', slug };
    }
  } catch (err) {
    console.warn('[Bot] Erro ao consultar hotel:', err.message);
  }
  return { nome: 'Hotel Morada da Lua', slug: 'hotelmoradadalua' };
}

async function checkAndReply(instanceName = 'meutim') {
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        where: {},
        limit: 10
      })
    });

    if (!res.ok) return;
    const json = await res.json();
    const records = json?.messages?.records || [];

    for (const msg of records) {
      const key = msg?.key;
      if (!key || !key.id) continue;

      if (seenMessageIds.has(key.id)) continue;
      seenMessageIds.add(key.id);

      // Ignora mensagens enviadas pelo próprio hotel
      if (key.fromMe === true) continue;

      // Ignora grupos e broadcast
      const remoteJid = key.remoteJid || '';
      if (remoteJid.includes('@g.us') || remoteJid.includes('broadcast')) continue;

      const phone = extractTargetPhone(key);
      if (!phone) continue;

      // Cooldown de 30 segundos
      const agora = Date.now();
      const ultimo = answeredCache.get(phone) || 0;
      if (agora - ultimo < COOLDOWN_MS) {
        console.log(`[Bot] Cooldown ativo para ${phone}. Ignorando.`);
        continue;
      }

      const pushName = (msg.pushName || '').trim();
      const hotel = await getHotelData(instanceName);
      const hotelLink = `${APP_BASE_URL}/hoteis/${hotel.slug}`;
      const saudacao = pushName ? `Olá ${pushName}! 👋` : `Olá! 👋`;

      const mensagem = `${saudacao} Bem-vindo(a) ao ${hotel.nome}.\n\nPara consultar fotos das acomodações, valores de diárias atualizados e realizar a sua reserva com confirmação imediata, acesse o nosso link oficial:\n\n👉 ${hotelLink}\n\n⚠️ É necessário entrar no link acima para verificar a disponibilidade de quartos, simular os preços para as suas datas e garantir sua reserva. Caso tenha qualquer dúvida, estamos à disposição por aqui!`;

      console.log(`[Bot] 📨 Nova mensagem recebida de ${phone} (${pushName || 'Sem nome'}). Enviando resposta automática...`);

      const sendRes = await fetch(`${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: phone,
          text: mensagem
        })
      });

      const sendData = await sendRes.json().catch(() => null);
      if (sendRes.ok) {
        answeredCache.set(phone, agora);
        console.log(`[Bot] ✅ Resposta automática entregue para ${phone}! (ID: ${sendData?.key?.id})`);
      } else {
        console.error(`[Bot] ❌ Falha ao enviar para ${phone}:`, sendData);
      }
    }
  } catch (err) {
    // Silencioso em caso de oscilação momentânea
  }
}

// Lembrete de Check-in (24h de antecedência) no fuso oficial de Mato Grosso (Cuiabá / GMT-4)
const lembretesEnviados = new Set();
async function checkLembretesCheckin(instanceName = 'meutim') {
  try {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Cuiaba',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const parts = formatter.formatToParts(d);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const amanhaStr = `${y}-${m}-${day}`;

    const { data: reservas } = await supabase
      .from('reservas')
      .select('*, hospedes(phone, name)')
      .eq('status', 'Confirmada')
      .ilike('data_checkin', `${amanhaStr}%`);

    if (!reservas || reservas.length === 0) return;

    for (const r of reservas) {
      if (lembretesEnviados.has(r.id)) continue;

      let phone = r.hospedes?.phone;
      if (!phone && r.observacoes) {
        const mPhone = r.observacoes.match(/(?:55)?(?:\d{2})\s?9?\d{4}-?\d{4}/);
        if (mPhone) phone = mPhone[0].replace(/\D/g, '');
      }

      if (!phone || phone.length < 10) continue;

      const nomeHospede = r.nome_hospede || r.hospedes?.name || 'Hóspede';
      const hotel = await getHotelData(instanceName);

      const msg = `Olá ${nomeHospede}! Amanhã é o dia do seu check-in no ${hotel.nome}! 🧳\n\nAcomodação: Quarto ${r.numero_quarto || 'Principal'}\nHorário de entrada: a partir das 14:00.\nLocalização: recepção central.\n\nSe precisar antecipar sua chegada ou tiver alguma dúvida, basta responder aqui!`;

      console.log(`[Bot] 📅 Enviando lembrete 24h para ${nomeHospede} (${phone})...`);

      const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phone, text: msg })
      });

      if (res.ok) {
        lembretesEnviados.add(r.id);
        console.log(`[Bot] ✅ Lembrete de check-in 24h enviado com sucesso para ${phone}!`);
      }
    }
  } catch (err) {
    console.warn('[Bot] Erro ao verificar lembretes de check-in:', err.message);
  }
}

// Inicialização: marca mensagens anteriores a 30 segundos para não responder histórico antigo
async function init() {
  console.log('[Bot] Inicializando monitor de mensagens da Evolution API...');
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/meutim`, {
      method: 'POST',
      headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 50 })
    });
    const data = await res.json();
    const records = data?.messages?.records || [];
    const agoraSec = Math.floor(Date.now() / 1000);

    for (const r of records) {
      if (r?.key?.id) {
        // Marca como visto somente mensagens com mais de 30 segundos
        if (agoraSec - (r.messageTimestamp || 0) > 30) {
          seenMessageIds.add(r.key.id);
        }
      }
    }
    console.log(`[Bot] Histórico indexado. ${seenMessageIds.size} mensagens antigas ignoradas.`);
  } catch (e) {
    console.warn('[Bot] Aviso ao indexar mensagens:', e.message);
  }

  console.log('[Bot] 🚀 Robô ativo e monitorando a cada 2.5 segundos...');
  setInterval(() => checkAndReply('meutim'), 2500);

  // Varredura de lembretes de check-in (24h) a cada 60 segundos
  checkLembretesCheckin('meutim');
  setInterval(() => checkLembretesCheckin('meutim'), 60 * 1000);
}

init();
