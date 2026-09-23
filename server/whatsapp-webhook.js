/**
 * Standalone Node.js Webhook Server para HotelNoZap & Evolution API v2.3.0
 * 
 * Executar localmente ou no servidor:
 * node server/whatsapp-webhook.js
 */

const http = require('http');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3333;
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://painelevolution.hotelnozap.com.br';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'wtwHLYfFxI9n1zDR8zFFqNq8kVaWqdD2oLpcjVmXBm';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ia3ZnbHV1bmJua3R6dWx6amZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzg0OTMyOCwiZXhwIjoyMTAzNDI1MzI4fQ.VlbPt6MgzjMJHbUt9nuCWhBNEv_6dmkeZnaVH9zJe3E';

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

        const cleanNumber = remoteJid.replace(/\D/g, '');
        if (!cleanNumber) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'invalid_number' }));
          return;
        }

        // Anti-loop de 12 horas
        const cacheKey = `${instanceName}_${cleanNumber}`;
        const agora = Date.now();
        const ultimo = antiLoopCache.get(cacheKey) || 0;
        if (agora - ultimo < INTERVALO_MS) {
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
            // Padrão de nomenclatura alternativo: h_{hotelId}_{slug}_{suffix}
            const parts = instanceName.split('_');
            if (parts.length >= 3) {
              hotelSlug = parts[2];
              hotelNome = parts[2].charAt(0).toUpperCase() + parts[2].slice(1);
            }
          }
        } catch (e) {
          console.warn('Erro ao consultar hotel no Supabase:', e.message);
        }

        const hotelLink = `https://hotelnozap.com.br/hoteis/${hotelSlug}`;
        const mensagem = `${saudacao} Bem-vindo(a) ao ${hotelNome}.\n\nPara consultar fotos das acomodações, valores de diárias atualizados e realizar a sua reserva com confirmação imediata, acesse o nosso link oficial:\n\n👉 ${hotelLink}\n\n⚠️ É necessário entrar no link acima para verificar a disponibilidade de quartos, simular os preços para as suas datas e garantir sua reserva. Caso tenha qualquer dúvida, estamos à disposição por aqui!`;

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

        antiLoopCache.set(cacheKey, agora);

        // Disparo assíncrono para o webhook do n8n (estrutura unificada oficial)
        try {
          const msgTexto = (data.message?.conversation || data.message?.extendedTextMessage?.text || 'Nova conversa iniciada pelo cliente no WhatsApp');
          const clienteNome = pushName || cleanNumber;
          const propNome = hotelData?.nome_gerente || hotelData?.managerName || 'Endrius Eduardo';
          const propTel = hotelData?.telefone_gerente || hotelData?.managerPhone || hotelData?.whatsapp || '(66) 98158-5014';
          const propEmail = hotelData?.email_gerente || hotelData?.managerEmail || hotelData?.email_login || 'everaldozshotel@gmail.com';
          const propObj = {
            nome: propNome,
            cargo: hotelData?.cargo_gerente || hotelData?.managerRole || 'SEO',
            telefone: propTel,
            email: propEmail,
            cpf: hotelData?.cpf_gerente || hotelData?.managerCpf || 'empty',
            email_login: hotelData?.email_login || propEmail,
            nome_instancia: hotelData?.nome_instancia || instanceName
          };

          fetch('https://portaln8n.hotelnozap.com.br/webhook/notificacoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'atendimento',
              identificador: 'ATENDIMENTO',
              tipo_evento: 'conversa_iniciada',
              evento: 'iniciar_conversa',
              data_evento: new Date().toISOString(),
              status_reserva: '',
              mensagem_whatsapp: msgTexto,
              texto_whatsapp: msgTexto,
              link_hotel: hotelLink,
              nome_hospede: clienteNome,
              nome_hotel: hotelNome,
              tags: {
                tipo: 'atendimento',
                nome_hospede: clienteNome,
                nome_hotel: hotelNome,
                link_hotel: hotelLink
              },
              RESERVA: {
                id: '',
                numero_reserva: '',
                hotel_id: hotelData?.id || '',
                hospede_id: '',
                quarto_id: '',
                numero_quarto: '',
                data_checkin: '',
                data_checkout: '',
                valor_total: 0,
                status: '',
                status_pagamento: '',
                observacoes: '',
                criado_em: ''
              },
              reserva: {
                id: '',
                numero_reserva: '',
                hotel_id: hotelData?.id || '',
                hospede_id: '',
                quarto_id: '',
                numero_quarto: '',
                data_checkin: '',
                data_checkout: '',
                valor_total: 0,
                status: '',
                status_pagamento: '',
                observacoes: '',
                criado_em: ''
              },
              hotel: {
                id: hotelData?.id || null,
                nome: hotelNome,
                razao_social: hotelData?.razao_social || hotelData?.razaoSocial || hotelNome,
                categoria: hotelData?.categoria || hotelData?.category || 'Hotel Urbano / Executivo',
                cnpj: hotelData?.cnpj || '47.498.281/0001-18',
                cidade: hotelData?.cidade || hotelData?.city || 'Vila Rica',
                uf: hotelData?.uf || 'MT',
                bairro: hotelData?.bairro || hotelData?.neighborhood || 'Setor Sul',
                logradouro: hotelData?.logradouro || hotelData?.street || 'Rua 18',
                numero: hotelData?.numero || hotelData?.streetNumber || '96',
                cep: hotelData?.cep || '78645-000',
                plano: hotelData?.plano || hotelData?.plan || '2 Créditos (Bimestral)',
                capacidade: Number(hotelData?.capacidade || 25),
                unidade_capacidade: hotelData?.unidade_capacidade || 'suítes',
                instancias_whatsapp: Number(hotelData?.instancias_whatsapp || 2),
                telefone: hotelData?.telefone || propTel,
                whatsapp: hotelData?.whatsapp || propTel,
                email: hotelData?.email || propEmail,
                link: hotelData?.link || '',
                link_publico: hotelLink,
                url_imagem: hotelData?.url_imagem || hotelData?.imageUrl || '',
                nome_instancia: instanceName,
                status: hotelData?.status || 'ativo',
                criado_em: hotelData?.criado_em || ''
              },
              proprietario: propObj,
              dados_do_proprietario: propObj,
              hospede: {
                id: '',
                nome: clienteNome,
                email: '',
                telefone: cleanNumber,
                cpf: '',
                cpf_passaporte: '',
                cidade_uf: '',
                logradouro: '',
                bairro: '',
                numero: '',
                cep: '',
                status: 'ativo',
                observacoes: null,
                criado_em: ''
              },
              quarto: {
                id: '',
                numero: '',
                tipo: '',
                andar: '',
                capacidade: 0,
                valor_diaria: 0,
                observacoes: '',
                foto_capa: '',
                fotos: []
              },
              status_atendimento: 'iniciado',
              canal: 'whatsapp',
              origem: 'whatsapp_inbound',
              mensagem: msgTexto,
              cliente: {
                nome: clienteNome,
                telefone: cleanNumber,
                email: ''
              },
              contato: {
                nome: clienteNome,
                telefone: cleanNumber,
                email: ''
              }
            })
          }).catch(nErr => console.warn('[n8n Webhook Atendimento] Erro assíncrono:', nErr.message));
        } catch (nErr) {}

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: fetchRes.ok,
          instance: instanceName,
          recipient: cleanNumber
        }));
      } catch (err) {
        console.error('Erro no processamento do webhook:', err);
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
