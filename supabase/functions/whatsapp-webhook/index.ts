/**
 * Supabase Edge Function: whatsapp-webhook
 * Receptor de mensagens recebidas (MESSAGES_UPSERT) da Evolution API v2.3.0
 * Responde automaticamente com o template de boas-vindas e o link do hotel
 *
 * Deploy no Supabase:
 * npx supabase functions deploy whatsapp-webhook --no-verify-jwt
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "https://painelevolution.hotelnozap.com.br";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://obkvgluunbnktzulzjfg.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Cache em memória para evitar loop de respostas (responde no máximo 1x a cada 12h por número)
const antiLoopCache = new Map<string, number>();
const INTERVALO_RESPOSTA_MS = 12 * 60 * 60 * 1000; // 12 horas

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json().catch(() => null);
    if (!payload) {
      return new Response(JSON.stringify({ error: "Payload vazio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = (payload.event || "").toLowerCase();
    const instanceName = payload.instance || payload.instanceName || "";

    // Processa apenas eventos de mensagens recebidas
    if (!event.includes("messages.upsert") && !event.includes("messages_upsert")) {
      return new Response(JSON.stringify({ status: "ignored_event", event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messageData = payload.data || payload;
    const key = messageData.key || {};
    const remoteJid = key.remoteJid || "";
    const fromMe = key.fromMe === true;

    // 1. Ignora mensagens enviadas pelo próprio hotel ou grupos/broadcast
    if (fromMe || !remoteJid || remoteJid.includes("@g.us") || remoteJid.includes("broadcast")) {
      return new Response(JSON.stringify({ status: "ignored_sender" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Extrai número limpo do remetente (tratando privacidade de LID do WhatsApp)
    let targetPhone = "";
    if (key.remoteJidAlt && key.remoteJidAlt.includes("@s.whatsapp.net")) {
      targetPhone = key.remoteJidAlt.replace(/\D/g, "");
    } else if (key.remoteJid && key.remoteJid.includes("@s.whatsapp.net")) {
      targetPhone = key.remoteJid.replace(/\D/g, "");
    } else {
      targetPhone = (key.remoteJidAlt || key.remoteJid || "").replace(/@.*$/, "").replace(/\D/g, "");
    }

    if (!targetPhone || targetPhone.length < 10) {
      return new Response(JSON.stringify({ status: "invalid_number" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanNumber = targetPhone;

    // 3. Controle Anti-Loop (responde apenas 1x a cada 12 horas para o mesmo número)
    const cacheKey = `${instanceName}_${cleanNumber}`;
    const ultimoEnvio = antiLoopCache.get(cacheKey) || 0;
    const agora = Date.now();
    if (agora - ultimoEnvio < INTERVALO_RESPOSTA_MS) {
      return new Response(JSON.stringify({ status: "already_replied_recently" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Identifica o hotel correspondente através da instância
    const pushName = (messageData.pushName || "").trim();
    let hotelNome = "Nosso Hotel";
    let hotelSlug = "hotel";

    // Consulta dados do hotel no Supabase caso as chaves estejam configuradas
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: hotelData } = await supabase
        .from("hoteis")
        .select("id, nome, link, nome_instancia")
        .or(`nome_instancia.eq.${instanceName},id.ilike.%${instanceName}%`)
        .maybeSingle();

      if (hotelData) {
        hotelNome = hotelData.nome || hotelNome;
        if (hotelData.link && hotelData.link.startsWith("/hoteis/")) {
          hotelSlug = hotelData.link.replace("/hoteis/", "");
        } else {
          hotelSlug = (hotelData.nome || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-");
        }
      }
    }

    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://app.hotelnozap.com.br";
    const hotelLink = `${appBaseUrl}/hoteis/${hotelSlug}`;

    // 5. Monta o texto de Boas-Vindas inteligente
    const saudacao = pushName ? `Olá ${pushName}! 👋` : `Olá! 👋`;
    const mensagemTexto = `${saudacao} Bem-vindo(a) ao ${hotelNome}.\n\nPara consultar fotos das acomodações, valores de diárias atualizados e realizar a sua reserva com confirmação imediata, acesse o nosso link oficial:\n\n👉 ${hotelLink}\n\n⚠️ É necessário entrar no link acima para verificar a disponibilidade de quartos, simular os preços para as suas datas e garantir sua reserva. Caso tenha qualquer dúvida, estamos à disposição por aqui!`;

    // 6. Dispara a resposta através da Evolution API
    const sendRes = await fetch(`${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      headers: {
        "apikey": EVOLUTION_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number: cleanNumber,
        text: mensagemTexto,
      }),
    });

    const sendJson = await sendRes.json().catch(() => null);

    // Registra envio no cache anti-loop
    antiLoopCache.set(cacheKey, agora);

    // Disparo assíncrono para o webhook do n8n (tipo: atendimento)
      const propObj = {
        nome: "Endrius Eduardo",
        cargo: "SEO",
        telefone: "(66) 98158-5014",
        email: "everaldozshotel@gmail.com",
        cpf: "empty",
        email_login: "everaldozshotel@gmail.com",
        nome_instancia: instanceName
      };

      fetch("https://portaln8n.hotelnozap.com.br/webhook/notificacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "atendimento",
          identificador: "ATENDIMENTO",
          tipo_evento: "conversa_iniciada",
          evento: "iniciar_conversa",
          data_evento: new Date().toISOString(),
          status_reserva: "",
          mensagem_whatsapp: mensagemTexto,
          texto_whatsapp: mensagemTexto,
          link_hotel: hotelLink,
          nome_hospede: pushName || cleanNumber,
          nome_hotel: hotelNome,
          tags: {
            tipo: "atendimento",
            nome_hospede: pushName || cleanNumber,
            nome_hotel: hotelNome,
            link_hotel: hotelLink
          },
          RESERVA: {
            id: "",
            numero_reserva: "",
            hotel_id: "",
            hospede_id: "",
            quarto_id: "",
            numero_quarto: "",
            data_checkin: "",
            data_checkout: "",
            valor_total: 0,
            status: "",
            status_pagamento: "",
            observacoes: "",
            criado_em: ""
          },
          reserva: {
            id: "",
            numero_reserva: "",
            hotel_id: "",
            hospede_id: "",
            quarto_id: "",
            numero_quarto: "",
            data_checkin: "",
            data_checkout: "",
            valor_total: 0,
            status: "",
            status_pagamento: "",
            observacoes: "",
            criado_em: ""
          },
          hotel: {
            id: null,
            nome: hotelNome,
            razao_social: hotelNome,
            categoria: "Hotel Urbano / Executivo",
            cnpj: "47.498.281/0001-18",
            cidade: "Vila Rica",
            uf: "MT",
            bairro: "Setor Sul",
            logradouro: "Rua 18",
            numero: "96",
            cep: "78645-000",
            plano: "2 Créditos (Bimestral)",
            capacidade: 25,
            unidade_capacidade: "suítes",
            instancias_whatsapp: 2,
            telefone: "(66) 98158-5014",
            whatsapp: "(66) 98158-5014",
            email: "everaldozshotel@gmail.com",
            link: "",
            link_publico: hotelLink,
            url_imagem: "",
            nome_instancia: instanceName,
            status: "ativo",
            criado_em: ""
          },
          proprietario: propObj,
          dados_do_proprietario: propObj,
          hospede: {
            id: "",
            nome: pushName || cleanNumber,
            email: "",
            telefone: cleanNumber,
            cpf: "",
            cpf_passaporte: "",
            cidade_uf: "",
            logradouro: "",
            bairro: "",
            numero: "",
            cep: "",
            status: "ativo",
            observacoes: null,
            criado_em: ""
          },
          quarto: {
            id: "",
            numero: "",
            tipo: "",
            andar: "",
            capacidade: 0,
            valor_diaria: 0,
            observacoes: "",
            foto_capa: "",
            fotos: []
          },
          status_atendimento: "iniciado",
          canal: "whatsapp",
          origem: "whatsapp_inbound",
          mensagem: mensagemTexto,
          cliente: {
            nome: pushName || cleanNumber,
            telefone: cleanNumber,
            email: ""
          },
          contato: {
            nome: pushName || cleanNumber,
            telefone: cleanNumber,
            email: ""
          }
        })
      }).catch(() => {});
    } catch (_nErr) {}

    return new Response(
      JSON.stringify({
        success: sendRes.ok,
        instance: instanceName,
        recipient: cleanNumber,
        evolutionResponse: sendJson,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
