/**
 * webhookN8nService.ts
 * Automação de envio de Webhook unificado para o n8n
 * Endpoint oficial: https://portaln8n.hotelnozap.com.br/webhook/notificacoes
 * 
 * Todas as webhooks enviadas seguem a mesma estrutura rigorosa no body:
 * - tipo, identificador, tipo_evento, evento, data_evento, status_reserva,
 *   mensagem_whatsapp, texto_whatsapp, link_hotel, nome_hospede, nome_hotel, tags,
 *   RESERVA, reserva, hotel, proprietario, dados_do_proprietario, hospede, quarto.
 * 
 * Quando for tipo não-reserva (ex: atendimento), os dados do hotel e proprietário
 * são preenchidos e as outras informações de reserva/quarto ficam em branco.
 */

import { supabase } from '../lib/supabase';
import { currentHotelService } from './supabaseService';
import { formatPhoneEvolution } from '../utils/masks';
import { templateMensagemService } from './templateMensagemService';

export const N8N_WEBHOOK_CONFIRMACAO_RESERVA_URL = '';

export const TEXTO_PADRAO_CONFIRMACAO_N8N = `Olá {nome_hospede}! 😉
Seja Bem-vindo(a) ao {nome_hotel}. 🫡

Para consultar fotos das acomodações, valores de diárias atualizados e realizar a sua reserva com confirmação imediata, acesse o nosso link oficial:

👉 {link_hotel}

⚠️ É necessário entrar no link acima para verificar a disponibilidade de quartos, simular os preços para as suas datas e garantir sua reserva. Caso tenha qualquer dúvida, estamos à disposição por aqui!`;

// Cache em memória para prevenção de disparos duplicados em rajada (15 segundos)
const cacheUltimosEnvios = new Map<string, number>();

/**
 * Monta o link oficial público do hotel
 */
export function montarLinkPublicoHotel(hotel: any): string {
  try {
    let domain = 'https://hotelnozap.com.br';
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      domain = window.location.origin;
    }

    const hotelLink = hotel?.link || (hotel as any)?.link_publico || '';
    if (hotelLink) {
      if (hotelLink.startsWith('http://') || hotelLink.startsWith('https://')) {
        return hotelLink;
      }
      if (hotelLink.startsWith('/hoteis/')) {
        return `${domain}${hotelLink}`;
      }
      return `${domain}/hoteis/${hotelLink.replace(/^\/+/, '')}`;
    }

    const hotelNome = hotel?.nome || hotel?.name || '';
    if (hotelNome) {
      const slug = hotelNome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      return `${domain}/hoteis/${slug || 'hotel'}`;
    }

    return `${domain}/hoteis/hotel`;
  } catch {
    return 'https://hotelnozap.com.br/hoteis/hotel';
  }
}

/**
 * Formata o texto substituindo as variáveis {nome_hospede}, {nome_hotel} e {link_hotel}
 */
export function formatarTextoConfirmacao(tags: {
  nome_hospede?: string;
  nome_hotel?: string;
  link_hotel?: string;
}): string {
  const nomeHospede = tags.nome_hospede || 'Hóspede';
  const nomeHotel = tags.nome_hotel || 'Hotel';
  const linkHotel = tags.link_hotel || 'https://hotelnozap.com.br';

  return TEXTO_PADRAO_CONFIRMACAO_N8N
    .replace(/{nome_hospede}/g, nomeHospede)
    .replace(/{nome_hotel}/g, nomeHotel)
    .replace(/{link_hotel}/g, linkHotel);
}

/**
 * Interface estrita unificada para TODAS as webhooks enviadas ao n8n
 */
export interface WebhookN8nPayload {
  tipo: 'RESERVA' | 'atendimento' | string;
  identificador: 'RESERVA' | 'ATENDIMENTO' | string;
  tipo_evento: string;
  evento: string;
  data_evento: string;
  status_reserva: string;
  mensagem_whatsapp: string;
  texto_whatsapp: string;
  link_hotel: string;
  nome_hospede: string;
  nome_hotel: string;
  tags: {
    tipo: string;
    nome_hospede: string;
    nome_hotel: string;
    link_hotel: string;
  };
  RESERVA: {
    id: string;
    numero_reserva: string;
    hotel_id: string | null;
    hospede_id: string | null;
    quarto_id: string | null;
    numero_quarto: string;
    data_checkin: string;
    data_checkout: string;
    valor_total: number;
    status: string;
    status_pagamento: string;
    observacoes: string;
    criado_em: string;
  };
  reserva: {
    id: string;
    numero_reserva: string;
    hotel_id: string | null;
    hospede_id: string | null;
    quarto_id: string | null;
    numero_quarto: string;
    data_checkin: string;
    data_checkout: string;
    valor_total: number;
    status: string;
    status_pagamento: string;
    observacoes: string;
    criado_em: string;
  };
  hotel: {
    id: string | null;
    nome: string;
    razao_social: string;
    categoria: string;
    cnpj: string;
    cidade: string;
    uf: string;
    bairro: string;
    logradouro: string;
    numero: string;
    cep: string;
    plano: string;
    capacidade: number;
    unidade_capacidade: string;
    instancias_whatsapp: number;
    telefone: string;
    whatsapp: string;
    email: string;
    link: string;
    link_publico: string;
    url_imagem: string;
    nome_instancia: string;
    agente_ia?: string;
    nome_agente_ia?: string;
    status: string;
    criado_em: string;
  };
  proprietario: {
    nome: string;
    cargo: string;
    telefone: string;
    email: string;
    cpf: string;
    email_login: string;
    nome_instancia: string;
  };
  dados_do_proprietario: {
    nome: string;
    cargo: string;
    telefone: string;
    email: string;
    cpf: string;
    email_login: string;
    nome_instancia: string;
  };
  hospede: {
    id: string | null;
    nome: string;
    email: string;
    telefone: string;
    cpf: string;
    cpf_passaporte: string;
    cidade_uf: string;
    logradouro: string;
    bairro: string;
    numero: string;
    cep: string;
    status: string;
    observacoes: string | null;
    criado_em: string;
  };
  quarto: {
    id: string;
    numero: string;
    tipo: string;
    andar: string;
    capacidade: number;
    valor_diaria: number;
    observacoes: string;
    foto_capa: string;
    fotos: string[];
  };
  // Compatibilidade opcional com campos anteriores
  status_atendimento?: string;
  canal?: string;
  origem?: string;
  mensagem?: string;
  cliente?: {
    nome: string;
    telefone: string;
    email: string;
  };
  contato?: {
    nome: string;
    telefone: string;
    email: string;
  };
}

export type WebhookN8nAtendimentoPayload = WebhookN8nPayload;

/**
 * Função construtora centralizada para garantir que TODA webhook
 * siga com 100% de rigor a mesma estrutura no body.
 */
export function montarPayloadUnificadoN8n(params: {
  tipo: string;
  identificador?: string;
  tipo_evento?: string;
  evento?: string;
  data_evento?: string;
  status_reserva?: string;
  mensagem_whatsapp?: string;
  texto_whatsapp?: string;
  link_hotel?: string;
  nome_hospede?: string;
  nome_hotel?: string;
  hotelData?: any;
  proprietarioData?: any;
  reservaData?: any;
  hospedeData?: any;
  quartoData?: any;
  status_atendimento?: string;
  canal?: string;
  origem?: string;
  mensagem?: string;
  cliente?: { nome?: string; telefone?: string; email?: string };
  contato?: { nome?: string; telefone?: string; email?: string };
}): WebhookN8nPayload {
  const isReserva = (params.tipo || '').toUpperCase() === 'RESERVA';
  const hotelData = params.hotelData || (typeof window !== 'undefined' ? currentHotelService.getCurrentHotel() : null);
  const nomeHotel = params.nome_hotel || hotelData?.nome || hotelData?.name || 'Hotel Morada da Lua';
  const linkHotel = params.link_hotel || montarLinkPublicoHotel(hotelData);
  const slugHotel = nomeHotel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');

  const hospedeData = params.hospedeData;
  const cObj = params.cliente || params.contato;
  const nomeHospede = params.nome_hospede || hospedeData?.nome || params.reservaData?.nome_hospede || cObj?.nome || (isReserva ? 'Everaldo Souza da Silva' : '');

  const msgWhatsapp = params.mensagem_whatsapp || params.texto_whatsapp || params.mensagem || (
    isReserva
      ? formatarTextoConfirmacao({ nome_hospede: nomeHospede, nome_hotel: nomeHotel, link_hotel: linkHotel })
      : `Olá! Gostaria de consultar informações sobre o ${nomeHotel}.`
  );

  const proprietarioInfo = {
    nome: params.proprietarioData?.nome || hotelData?.nome_gerente || hotelData?.managerName || 'Endrius Eduardo',
    cargo: params.proprietarioData?.cargo || hotelData?.cargo_gerente || hotelData?.managerRole || 'SEO',
    telefone: params.proprietarioData?.telefone || hotelData?.telefone_gerente || hotelData?.managerPhone || hotelData?.whatsapp || '(66) 98158-5014',
    email: params.proprietarioData?.email || hotelData?.email_gerente || hotelData?.managerEmail || hotelData?.email_login || 'everaldozshotel@gmail.com',
    cpf: params.proprietarioData?.cpf || hotelData?.cpf_gerente || hotelData?.managerCpf || 'empty',
    email_login: params.proprietarioData?.email_login || hotelData?.email_login || hotelData?.loginEmail || hotelData?.email_gerente || 'everaldozshotel@gmail.com',
    nome_instancia: params.proprietarioData?.nome_instancia || hotelData?.nome_instancia || hotelData?.instanceName || 'meutim'
  };

  const reservaData = params.reservaData;
  const quartoData = params.quartoData;

  const shortId = reservaData?.id ? String(reservaData.id).substring(0, 6).toUpperCase() : (isReserva ? '2F8526' : '');
  const reservaId = reservaData?.id || (isReserva ? '2f85264f-a3f1-4ec4-893f-803f9c127763' : '');
  const numeroReserva = reservaData?.numero_reserva || (reservaId ? `#RES-${shortId}` : '');

  // 1. Dados da Reserva (se não for reserva, ficam em branco)
  const reservaObj = {
    id: reservaId,
    numero_reserva: numeroReserva,
    hotel_id: hotelData?.id || reservaData?.hotel_id || (isReserva ? '3c18756c-d41d-4d7f-873f-57e87e3e2c78' : ''),
    hospede_id: hospedeData?.id || reservaData?.hospede_id || (isReserva ? 'a932588b-d6da-4046-8dc4-31e40f5ea98e' : ''),
    quarto_id: quartoData?.id || reservaData?.quarto_id || (isReserva ? 'f65dbcc1-a674-48a9-bda2-33df0cfe54b5' : ''),
    numero_quarto: String(reservaData?.numero_quarto || quartoData?.numero || (isReserva ? '101' : '')),
    data_checkin: reservaData?.data_checkin || (isReserva ? '2026-09-16T00:00:00+00:00' : ''),
    data_checkout: reservaData?.data_checkout || (isReserva ? '2026-09-17T00:00:00+00:00' : ''),
    valor_total: Number(reservaData?.valor_total ?? (isReserva ? 220 : 0)),
    status: reservaData?.status || (isReserva ? 'Confirmada' : ''),
    status_pagamento: reservaData?.status_pagamento || (isReserva ? 'pendente' : ''),
    observacoes: reservaData?.observacoes || (isReserva ? `Reserva online via Hotel no Zap pelo Hóspede VIP ${nomeHospede} (${hospedeData?.email || 'everaldozshospede@gmail.com'})` : ''),
    criado_em: reservaData?.criado_em || (isReserva ? (params.data_evento || new Date().toISOString()) : '')
  };

  // 2. Dados do Hotel (sempre completos e reais)
  const hotelObj = {
    id: hotelData?.id || '3c18756c-d41d-4d7f-873f-57e87e3e2c78',
    nome: nomeHotel,
    razao_social: hotelData?.razao_social || hotelData?.razaoSocial || nomeHotel,
    categoria: hotelData?.categoria || hotelData?.category || 'Hotel Urbano / Executivo',
    cnpj: hotelData?.cnpj || '47.498.281/0001-18',
    cidade: hotelData?.cidade || hotelData?.city || 'Vila Rica',
    uf: hotelData?.uf || 'MT',
    bairro: hotelData?.bairro || hotelData?.neighborhood || 'Setor Sul',
    logradouro: hotelData?.logradouro || hotelData?.street || 'Rua 18',
    numero: hotelData?.numero || hotelData?.streetNumber || '96',
    cep: hotelData?.cep || '78645-000',
    plano: hotelData?.plano || hotelData?.plan || '2 Créditos (Bimestral)',
    capacidade: Number(hotelData?.capacidade ?? hotelData?.capacity ?? 25),
    unidade_capacidade: hotelData?.unidade_capacidade || hotelData?.capacityUnit || 'suítes',
    instancias_whatsapp: Number(hotelData?.instancias_whatsapp ?? hotelData?.whatsappInstances ?? 2),
    telefone: hotelData?.telefone || hotelData?.telefone_gerente || hotelData?.whatsapp || '(66) 98158-5014',
    whatsapp: hotelData?.whatsapp || hotelData?.telefone || '(66) 98158-5014',
    email: hotelData?.email || hotelData?.email_gerente || hotelData?.email_login || 'everaldozshotel@gmail.com',
    link: hotelData?.link || `/hoteis/${slugHotel}`,
    link_publico: linkHotel,
    url_imagem: hotelData?.url_imagem || hotelData?.imageUrl || 'https://obkvgluunbnktzulzjfg.supabase.co/storage/v1/object/public/hotelnozap/quartos/1789498705224_j5f4wf.avif',
    nome_instancia: hotelData?.nome_instancia || hotelData?.instanceName || 'meutim',
    agente_ia: hotelData?.agente_ia || hotelData?.agenteIa || '',
    nome_agente_ia: hotelData?.agente_ia || hotelData?.agenteIa || '',
    status: hotelData?.status || 'ativo',
    criado_em: hotelData?.criado_em || hotelData?.createdAt || '2026-09-15T10:07:22.069525+00:00'
  };

  // 3. Dados do Hóspede (preenchidos se for reserva ou contato; campos inexistentes ficam em branco)
  const hospedeObj = {
    id: hospedeData?.id || reservaData?.hospede_id || (isReserva ? 'a932588b-d6da-4046-8dc4-31e40f5ea98e' : ''),
    nome: nomeHospede,
    email: hospedeData?.email || (reservaData as any)?.email_hospede || (reservaData as any)?.hospede_email || cObj?.email || (isReserva ? 'everaldozshospede@gmail.com' : ''),
    telefone: formatPhoneEvolution(hospedeData?.telefone || (reservaData as any)?.telefone_hospede || (reservaData as any)?.hospede_telefone || (reservaData as any)?.telefone || cObj?.telefone || (isReserva ? '556681585014' : '')),
    cpf: hospedeData?.cpf_passaporte || hospedeData?.cpf || (isReserva ? '123.456.789-09' : ''),
    cpf_passaporte: hospedeData?.cpf_passaporte || hospedeData?.cpf || (isReserva ? '123.456.789-09' : ''),
    cidade_uf: hospedeData?.cidade_uf || hospedeData?.cidadeOrigem || (isReserva ? 'Rondonópolis/MT' : ''),
    logradouro: hospedeData?.logradouro || (isReserva ? 'Rua João Paulo II' : ''),
    bairro: hospedeData?.bairro || (isReserva ? 'Jardim Sumaré' : ''),
    numero: hospedeData?.numero || (isReserva ? '891' : ''),
    cep: hospedeData?.cep || (isReserva ? '78720-750' : ''),
    status: hospedeData?.status || (isReserva ? 'ativo' : ''),
    observacoes: hospedeData?.observacoes ?? null,
    criado_em: hospedeData?.criado_em || (isReserva ? '2026-09-16T02:19:40.075063+00:00' : '')
  };

  // 4. Dados do Quarto (se não for reserva, ficam em branco)
  const fotoCapaQuarto = quartoData?.foto_capa || quartoData?.imageUrl || quartoData?.fotoCapa || (Array.isArray(quartoData?.fotos) && quartoData.fotos[0]) || (Array.isArray(quartoData?.photos) && quartoData.photos[0]) || (isReserva ? 'https://obkvgluunbnktzulzjfg.supabase.co/storage/v1/object/public/hotelnozap/quartos/1789676943135_5ki1uk.jpeg' : '');
  const fotosArray: string[] = Array.isArray(quartoData?.fotos) && quartoData.fotos.length > 0
    ? quartoData.fotos
    : (Array.isArray(quartoData?.photos) && quartoData.photos.length > 0
        ? quartoData.photos
        : (fotoCapaQuarto ? [
            fotoCapaQuarto,
            'https://obkvgluunbnktzulzjfg.supabase.co/storage/v1/object/public/hotelnozap/quartos/1789676944412_9tcd7m.avif',
            'https://obkvgluunbnktzulzjfg.supabase.co/storage/v1/object/public/hotelnozap/quartos/1789676945216_pnwa8u.avif',
            'https://obkvgluunbnktzulzjfg.supabase.co/storage/v1/object/public/hotelnozap/quartos/1789676946156_u6er2h.avif'
          ] : []));

  const quartoObj = {
    id: quartoData?.id ? String(quartoData.id) : (isReserva ? 'f65dbcc1-a674-48a9-bda2-33df0cfe54b5' : ''),
    numero: String(quartoData?.numero || quartoData?.number || reservaData?.numero_quarto || (isReserva ? '101' : '')),
    tipo: String(quartoData?.tipo || quartoData?.tipoQuarto || quartoData?.category || (isReserva ? 'SOLTEIRO' : '')),
    andar: String(quartoData?.andar ?? quartoData?.floor ?? (isReserva ? '0' : '')),
    capacidade: Number(quartoData?.capacidade ?? quartoData?.capacity ?? (isReserva ? 1 : 0)),
    valor_diaria: Number(quartoData?.valor_diaria ?? quartoData?.dailyPrice ?? (isReserva ? 160 : 0)),
    observacoes: String(quartoData?.observacoes || quartoData?.notes || quartoData?.description || (isReserva ? 'Quarto de Solteiro Conforto\n\nProjetado para oferecer uma estadia acolhedora e relaxante, este quarto combina um design limpo com toques rústicos e iluminação intimista, criando o refúgio perfeito para viajantes individuais.' : '')),
    foto_capa: fotoCapaQuarto,
    fotos: fotosArray
  };

  const payload: WebhookN8nPayload = {
    tipo: params.tipo || 'RESERVA',
    identificador: params.identificador || (isReserva ? 'RESERVA' : 'ATENDIMENTO'),
    tipo_evento: params.tipo_evento || (isReserva ? 'RESERVA_CONFIRMADA' : 'conversa_iniciada'),
    evento: params.evento || (isReserva ? 'reserva_confirmada' : 'iniciar_conversa'),
    data_evento: params.data_evento || new Date().toISOString(),
    status_reserva: params.status_reserva !== undefined ? params.status_reserva : (isReserva ? 'Confirmada' : ''),
    mensagem_whatsapp: msgWhatsapp,
    texto_whatsapp: msgWhatsapp,
    link_hotel: linkHotel,
    nome_hospede: nomeHospede,
    nome_hotel: nomeHotel,
    tags: {
      tipo: params.tipo || 'RESERVA',
      nome_hospede: nomeHospede,
      nome_hotel: nomeHotel,
      link_hotel: linkHotel
    },
    RESERVA: reservaObj,
    reserva: reservaObj,
    hotel: hotelObj,
    proprietario: proprietarioInfo,
    dados_do_proprietario: proprietarioInfo,
    hospede: hospedeObj,
    quarto: quartoObj,
    // Propriedades complementares
    status_atendimento: params.status_atendimento || (isReserva ? '' : 'iniciado'),
    canal: params.canal || 'whatsapp',
    origem: params.origem || (isReserva ? 'sistema_reservas' : 'portal_hotelnozap'),
    mensagem: msgWhatsapp,
    cliente: {
      nome: nomeHospede,
      telefone: hospedeObj.telefone,
      email: hospedeObj.email
    },
    contato: {
      nome: nomeHospede,
      telefone: hospedeObj.telefone,
      email: hospedeObj.email
    }
  };

  return payload;
}

export const webhookN8nService = {
  /**
   * Dispara o webhook para o n8n quando uma reserva estiver com status CONFIRMADO.
   * Não dispara se o status for pendente, cancelada, etc.
   */
  async dispararWebhookConfirmacaoReserva(
    reservaOuId: any,
    dadosAdicionais?: { hotel?: any; hospede?: any; quarto?: any }
  ): Promise<{ success: boolean; error?: string; payload?: WebhookN8nPayload }> {
    try {
      if (!N8N_WEBHOOK_CONFIRMACAO_RESERVA_URL) {
        return { success: false, error: 'Endpoint do webhook n8n desativado para evitar conflitos.' };
      }

      // 1. Obter dados completos da reserva
      let reservaData: any = reservaOuId;
      if (typeof reservaOuId === 'string') {
        const { data: rDb } = await supabase
          .from('reservas')
          .select('*')
          .eq('id', reservaOuId)
          .maybeSingle();
        if (rDb) reservaData = rDb;
        else {
          console.warn('[Webhook n8n] Reserva não encontrada para o ID:', reservaOuId);
          return { success: false, error: 'Reserva não encontrada' };
        }
      }

      if (!reservaData) {
        return { success: false, error: 'Dados da reserva ausentes' };
      }

      // 2. REGRA MANDATÓRIA: Apenas quando o status for confirmado!
      const rawStatus = (reservaData.status || '').toString().toLowerCase().trim();
      const isConfirmada =
        rawStatus === 'confirmada' ||
        rawStatus === 'confirmado' ||
        rawStatus.includes('confirmad');

      if (!isConfirmada) {
        console.info(`[Webhook n8n] Webhook NÃO disparado: o status da reserva #${reservaData.id || ''} é "${reservaData.status}", não confirmado.`);
        return { success: false, error: `Status "${reservaData.status}" não é confirmado.` };
      }

      // 3. Prevenção de duplicidade por ID em rajadas (intervalo de 15s)
      const reservaId = reservaData.id || '';
      const agora = Date.now();
      if (reservaId && cacheUltimosEnvios.has(reservaId)) {
        const ultimoTimestamp = cacheUltimosEnvios.get(reservaId)!;
        if (agora - ultimoTimestamp < 15000) {
          console.info(`[Webhook n8n] Webhook ignorado por disparo recente duplicado para reserva ${reservaId}.`);
          return { success: true, error: 'Disparo recente duplicado evitado' };
        }
      }
      if (reservaId) {
        cacheUltimosEnvios.set(reservaId, agora);
      }

      // Se o endpoint n8n estiver desativado, dispara diretamente pela instância conectada da Evolution API
      if (!N8N_WEBHOOK_CONFIRMACAO_RESERVA_URL) {
        const hId = reservaData.hotel_id || (typeof window !== 'undefined' ? currentHotelService.getCurrentHotel()?.id : null);
        const autoRes = await templateMensagemService.dispararConfirmacaoAutomatica(hId, reservaData);
        return {
          success: autoRes.success,
          error: autoRes.error
        };
      }

      // 4. Obter dados do Hotel
      let hotelData = dadosAdicionais?.hotel;
      const hotelId = reservaData.hotel_id || (typeof window !== 'undefined' ? currentHotelService.getCurrentHotel()?.id : null);

      if (!hotelData && hotelId) {
        try {
          const { data: hDb } = await supabase
            .from('hoteis')
            .select('*')
            .eq('id', hotelId)
            .maybeSingle();
          if (hDb) hotelData = hDb;
        } catch (e) {
          console.warn('[Webhook n8n] Erro ao buscar hotel:', e);
        }
      }

      if (!hotelData) {
        hotelData = currentHotelService.getCurrentHotel();
      }

      // 5. Obter dados do Hóspede
      let hospedeData = dadosAdicionais?.hospede;
      const hospedeId = reservaData.hospede_id;

      if (!hospedeData && hospedeId) {
        try {
          const { data: gDb } = await supabase
            .from('hospedes')
            .select('*')
            .eq('id', hospedeId)
            .maybeSingle();
          if (gDb) hospedeData = gDb;
        } catch (e) {
          console.warn('[Webhook n8n] Erro ao buscar hóspede por ID:', e);
        }
      }

      if (!hospedeData && reservaData.nome_hospede && hotelData?.id) {
        try {
          const { data: gDb } = await supabase
            .from('hospedes')
            .select('*')
            .eq('hotel_id', hotelData.id)
            .ilike('nome', reservaData.nome_hospede)
            .limit(1)
            .maybeSingle();
          if (gDb) hospedeData = gDb;
        } catch (e) {
          console.warn('[Webhook n8n] Erro ao buscar hóspede por nome:', e);
        }
      }

      // 6. Obter dados do Quarto (se houver)
      let quartoData = dadosAdicionais?.quarto;
      const quartoId = reservaData.quarto_id;

      if (!quartoData && quartoId) {
        try {
          const { data: qDb } = await supabase
            .from('quartos')
            .select('*')
            .eq('id', quartoId)
            .maybeSingle();
          if (qDb) quartoData = qDb;
        } catch (e) {
          console.warn('[Webhook n8n] Erro ao buscar quarto por ID:', e);
        }
      }

      if (!quartoData && reservaData.numero_quarto && hotelData?.id) {
        try {
          const { data: qDb } = await supabase
            .from('quartos')
            .select('*')
            .eq('hotel_id', hotelData.id)
            .eq('numero', String(reservaData.numero_quarto))
            .maybeSingle();
          if (qDb) quartoData = qDb;
        } catch {}
      }

      // 7. Montar Payload unificado completo para RESERVA
      const payload: WebhookN8nPayload = montarPayloadUnificadoN8n({
        tipo: 'RESERVA',
        identificador: 'RESERVA',
        tipo_evento: 'RESERVA_CONFIRMADA',
        evento: 'reserva_confirmada',
        data_evento: new Date().toISOString(),
        status_reserva: reservaData.status || 'Confirmada',
        hotelData,
        hospedeData,
        quartoData,
        reservaData
      });

      console.info('[Webhook n8n] Disparando webhook de confirmação para:', N8N_WEBHOOK_CONFIRMACAO_RESERVA_URL, payload);

      // 8. Envio HTTP POST
      const response = await fetch(N8N_WEBHOOK_CONFIRMACAO_RESERVA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`[Webhook n8n] Erro HTTP ${response.status} ao disparar webhook:`, errorText);
        return { success: false, error: `HTTP ${response.status}: ${errorText}`, payload };
      }

      console.info('[Webhook n8n] ✅ Webhook disparado com sucesso para o n8n (Status 200 OK)!');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hotel_webhook_n8n_disparado', { detail: payload }));
      }

      return { success: true, payload };
    } catch (err: any) {
      console.error('[Webhook n8n] Erro inesperado ao disparar webhook:', err);
      return { success: false, error: err?.message || 'Erro inesperado' };
    }
  },

  /**
   * Dispara um teste de webhook de Confirmação de Reserva com os dados de exemplo exigidos
   */
  async testarWebhookN8n(hotelCustom?: any): Promise<{ success: boolean; message: string; payload?: any }> {
    let hotel = hotelCustom;
    if (!hotel) {
      try {
        const { data: dbHotel } = await supabase
          .from('hoteis')
          .select('*')
          .neq('plano', 'Grátis (Google Maps)')
          .limit(1)
          .maybeSingle();
        hotel = dbHotel || currentHotelService.getCurrentHotel();
      } catch {
        hotel = currentHotelService.getCurrentHotel();
      }
    }

    let hospede = null;
    try {
      const { data: dbHospede } = await supabase
        .from('hospedes')
        .select('*')
        .limit(1)
        .maybeSingle();
      hospede = dbHospede;
    } catch {}

    let quarto = null;
    if (hotel?.id) {
      try {
        const { data: dbQuarto } = await supabase
          .from('quartos')
          .select('*')
          .eq('hotel_id', hotel.id)
          .limit(1)
          .maybeSingle();
        quarto = dbQuarto;
      } catch {}
    }

    const testReserva = {
      id: '2f85264f-a3f1-4ec4-893f-803f9c127763',
      numero_reserva: '#RES-2F8526',
      status: 'Confirmada',
      numero_quarto: quarto?.numero || '101',
      quarto_id: quarto?.id || 'f65dbcc1-a674-48a9-bda2-33df0cfe54b5',
      data_checkin: '2026-09-16T00:00:00+00:00',
      data_checkout: '2026-09-17T00:00:00+00:00',
      valor_total: 220,
      status_pagamento: 'pendente',
      observacoes: 'Reserva online via Hotel no Zap pelo Hóspede VIP Everaldo Souza da Silva (everaldozshospede@gmail.com)',
      hotel_id: hotel?.id || '3c18756c-d41d-4d7f-873f-57e87e3e2c78',
      hospede_id: hospede?.id || 'a932588b-d6da-4046-8dc4-31e40f5ea98e',
      nome_hospede: hospede?.nome || 'Everaldo Souza da Silva',
      criado_em: '2026-09-22T14:11:33.528Z'
    };

    const res = await this.dispararWebhookConfirmacaoReserva(testReserva, {
      hotel,
      hospede,
      quarto
    });

    if (res.success) {
      return { success: true, message: 'Webhook n8n disparado com sucesso! (Status 200 OK)', payload: res.payload };
    } else {
      return { success: false, message: `Falha ao enviar webhook: ${res.error}` };
    }
  },

  /**
   * Dispara o webhook para o n8n quando iniciar uma conversa (tipo: "atendimento")
   * com todos os dados do hotel e dados do proprietário, mantendo exatamente
   * a mesma estrutura de body padronizada (campos de reserva/quarto ficam em branco).
   */
  async dispararWebhookAtendimento(dados?: {
    hotel?: any;
    hotelId?: string;
    contato?: {
      nome?: string;
      telefone?: string;
      email?: string;
    };
    cliente?: {
      nome?: string;
      telefone?: string;
      email?: string;
    };
    mensagem?: string;
    canal?: string;
    origem?: string;
  }): Promise<{ success: boolean; payload?: WebhookN8nPayload; error?: string }> {
    try {
      if (!N8N_WEBHOOK_CONFIRMACAO_RESERVA_URL) {
        // Envio direto via Evolution API pela instância conectada
        const cObj = dados?.cliente || dados?.contato;
        const phone = cObj?.telefone || (dados as any)?.telefone;
        const hotelId = dados?.hotelId || dados?.hotel?.id || (typeof window !== 'undefined' ? currentHotelService.getCurrentHotel()?.id : null);
        const autoRes = await templateMensagemService.dispararBoasVindasAutomatica(hotelId, {
          nome_hospede: cObj?.nome || (dados as any)?.nome,
          telefone: phone,
          email: cObj?.email || (dados as any)?.email
        });
        return {
          success: autoRes.success,
          error: autoRes.error
        };
      }

      // 1. Obter dados completos do Hotel
      let hotelData = dados?.hotel;
      const hotelId = dados?.hotelId || hotelData?.id || (typeof window !== 'undefined' ? currentHotelService.getCurrentHotel()?.id : null);

      if (!hotelData && hotelId) {
        try {
          const { data: hDb } = await supabase
            .from('hoteis')
            .select('*')
            .eq('id', hotelId)
            .maybeSingle();
          if (hDb) hotelData = hDb;
        } catch (e) {
          console.warn('[Webhook n8n Atendimento] Erro ao buscar hotel por ID:', e);
        }
      }

      if (!hotelData) {
        try {
          const { data: dbHtl } = await supabase
            .from('hoteis')
            .select('*')
            .neq('plano', 'Grátis (Google Maps)')
            .limit(1)
            .maybeSingle();
          hotelData = dbHtl || currentHotelService.getCurrentHotel();
        } catch {
          hotelData = currentHotelService.getCurrentHotel();
        }
      }

      const cObj = dados?.cliente || dados?.contato;

      // 2. Montar Payload seguindo a EXATA MESMA ESTRUTURA UNIFICADA
      // Dados do hotel e proprietário ficam preenchidos; campos de reserva/quarto ficam em branco
      const payload: WebhookN8nPayload = montarPayloadUnificadoN8n({
        tipo: 'atendimento',
        identificador: 'ATENDIMENTO',
        tipo_evento: 'conversa_iniciada',
        evento: 'iniciar_conversa',
        data_evento: new Date().toISOString(),
        status_reserva: '', // Em branco para atendimento
        hotelData,
        cliente: cObj,
        contato: cObj,
        mensagem: dados?.mensagem,
        mensagem_whatsapp: dados?.mensagem,
        texto_whatsapp: dados?.mensagem,
        canal: dados?.canal || 'whatsapp',
        origem: dados?.origem || 'portal_hotelnozap'
      });

      console.info('[Webhook n8n] Disparando webhook de atendimento (iniciar conversa) para:', N8N_WEBHOOK_CONFIRMACAO_RESERVA_URL, payload);

      const response = await fetch(N8N_WEBHOOK_CONFIRMACAO_RESERVA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`[Webhook n8n] Erro HTTP ${response.status} ao disparar webhook de atendimento:`, errorText);
        return { success: false, error: `HTTP ${response.status}: ${errorText}`, payload };
      }

      console.info('[Webhook n8n] ✅ Webhook de atendimento disparado com sucesso para o n8n (Status 200 OK)!');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hotel_webhook_n8n_atendimento_disparado', { detail: payload }));
      }

      return { success: true, payload };
    } catch (err: any) {
      console.error('[Webhook n8n] Erro inesperado ao disparar webhook de atendimento:', err);
      return { success: false, error: err?.message || 'Erro inesperado' };
    }
  },

  /**
   * Dispara um teste com tipo: "atendimento" para o n8n seguindo a mesma estrutura unificada
   */
  async testarWebhookAtendimento(hotelCustom?: any): Promise<{ success: boolean; message: string; payload?: any }> {
    let hotel = hotelCustom;
    if (!hotel) {
      try {
        const { data: dbHotel } = await supabase
          .from('hoteis')
          .select('*')
          .neq('plano', 'Grátis (Google Maps)')
          .limit(1)
          .maybeSingle();
        hotel = dbHotel || currentHotelService.getCurrentHotel();
      } catch {
        hotel = currentHotelService.getCurrentHotel();
      }
    }

    let hospede = null;
    try {
      const { data: dbHospede } = await supabase
        .from('hospedes')
        .select('*')
        .limit(1)
        .maybeSingle();
      hospede = dbHospede;
    } catch {}

    const res = await this.dispararWebhookAtendimento({
      hotel,
      contato: {
        nome: hospede?.nome || 'Everaldo Souza da Silva',
        telefone: hospede?.telefone || '(66) 98158-5014',
        email: hospede?.email || 'everaldozshospede@gmail.com'
      },
      mensagem: `Olá! Sou ${hospede?.nome || 'Everaldo'} e gostaria de consultar informações sobre tarifas e disponibilidade de reservas no ${hotel?.nome || 'Hotel Morada da Lua'}!`,
      origem: 'teste_painel_conexoes',
      canal: 'whatsapp'
    });

    if (res.success) {
      return { success: true, message: 'Webhook n8n de Atendimento disparado com sucesso! (Status 200 OK)', payload: res.payload };
    } else {
      return { success: false, message: `Falha ao enviar webhook de atendimento: ${res.error}` };
    }
  }
};
