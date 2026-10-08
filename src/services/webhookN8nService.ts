/**
 * webhookN8nService.ts
 * Automação de envio de Webhook unificado para o n8n
 * Endpoint oficial: https://portaln8n.hotelnozap.com.br/webhook/notificacoes
 * 
 * Todas as webhooks enviadas para o n8n seguem rigorosamente a estrutura padrão:
 * - tipo, evento, data_envio
 * - hotel: { id, nome, razao_social, cnpj, categoria, telefone, whatsapp, email, link_oficial, endereco, gerente }
 * - hospede: { id, nome, primeiro_nome, telefone, telefone_formatado, email, cpf_passaporte, cidade_uf }
 * - reserva: { id, numero_reserva, status, status_pagamento, data_checkin, data_checkout, dias_estadia, valor_total, valor_total_formatado, observacoes, quarto }
 * - instancia: { nome, status, whatsapp_conectado, servidor_evolution }
 */

import { supabase } from '../lib/supabase';
import { currentHotelService } from './supabaseService';

export const N8N_WEBHOOK_CONFIRMACAO_RESERVA_URL = 'https://portaln8n.hotelnozap.com.br/webhook/notificacoes';

export const TEXTO_PADRAO_CONFIRMACAO_N8N = `Olá {nome_hospede}! 😉
Seja Bem-vindo(a) ao {nome_hotel}. 🫡

Para consultar fotos das acomodações, valores de diárias atualizados e realizar a sua reserva com confirmação imediata, acesse o nosso link oficial:

👉 {link_hotel}

⚠️ É necessário entrar no link acima para verificar a disponibilidade de quartos, simular os preços para as suas datas e garantir sua reserva. Caso tenha qualquer dúvida, estamos à disposição por aqui!`;

// Cache em memória para prevenção de disparos duplicados em rajada (5 segundos)
const cacheUltimosEnvios = new Map<string, number>();

/**
 * Limpa o número de telefone e garante o prefixo DDI 55
 */
export function limparTelefoneComDDI(phone?: string): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

/**
 * Formata o telefone de forma legível: (DD) 9NNNN-NNNN ou (DD) NNNN-NNNN
 */
export function formatarTelefoneVisual(phone?: string): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return String(phone);

  // 13 dígitos: 55 + DDD (2) + 9 dígitos (ex: 5573988219748)
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.substring(2, 4);
    const p1 = digits.substring(4, 9);
    const p2 = digits.substring(9, 13);
    return `(${ddd}) ${p1}-${p2}`;
  }
  // 12 dígitos: 55 + DDD (2) + 8 dígitos (ex: 557388219748)
  if (digits.length === 12 && digits.startsWith('55')) {
    const ddd = digits.substring(2, 4);
    const p1 = digits.substring(4, 8);
    const p2 = digits.substring(8, 12);
    return `(${ddd}) ${p1}-${p2}`;
  }
  // 11 dígitos: DDD (2) + 9 dígitos (ex: 73988219748)
  if (digits.length === 11) {
    const ddd = digits.substring(0, 2);
    const p1 = digits.substring(2, 7);
    const p2 = digits.substring(7, 11);
    return `(${ddd}) ${p1}-${p2}`;
  }
  // 10 dígitos: DDD (2) + 8 dígitos (ex: 7388219748)
  if (digits.length === 10) {
    const ddd = digits.substring(0, 2);
    const p1 = digits.substring(2, 6);
    const p2 = digits.substring(6, 10);
    return `(${ddd}) ${p1}-${p2}`;
  }

  return phone;
}

/**
 * Calcula a quantidade de diárias entre check-in e check-out
 */
export function calcularDiasEstadia(checkinStr?: string, checkoutStr?: string): number {
  if (!checkinStr || !checkoutStr) return 1;
  try {
    const d1 = new Date(String(checkinStr).split('T')[0] + 'T12:00:00');
    const d2 = new Date(String(checkoutStr).split('T')[0] + 'T12:00:00');
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  } catch {
    return 1;
  }
}

/**
 * Monta o link oficial público do hotel
 */
export function montarLinkPublicoHotel(hotel: any): string {
  try {
    let domain = 'https://app.hotelnozap.com.br';
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
    return 'https://app.hotelnozap.com.br/hoteis/hotel';
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
  const linkHotel = tags.link_hotel || (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://app.hotelnozap.com.br');

  return TEXTO_PADRAO_CONFIRMACAO_N8N
    .replace(/{nome_hospede}/g, nomeHospede)
    .replace(/{nome_hotel}/g, nomeHotel)
    .replace(/{link_hotel}/g, linkHotel);
}

/**
 * Interface estrita unificada para TODAS as webhooks enviadas ao n8n
 */
export interface WebhookN8nPayload {
  tipo: string;
  evento: string;
  data_envio: string;

  hotel: {
    id: string;
    nome: string;
    razao_social: string;
    cnpj: string;
    categoria: string;
    telefone: string;
    whatsapp: string;
    email: string;
    link_oficial: string;
    endereco: {
      logradouro: string;
      numero: string;
      bairro: string;
      cidade: string;
      uf: string;
      cep: string;
    };
    gerente: {
      nome: string;
      cargo: string;
      telefone: string;
      email: string;
    };
  };

  hospede: {
    id: string;
    nome: string;
    primeiro_nome: string;
    telefone: string;
    telefone_formatado: string;
    email: string;
    cpf_passaporte: string;
    cidade_uf: string;
  };

  reserva: {
    id: string;
    numero_reserva: string;
    status: string;
    status_pagamento: string;
    data_checkin: string;
    data_checkout: string;
    dias_estadia: number;
    valor_total: number;
    valor_total_formatado: string;
    observacoes: string;
    quarto: {
      id: string;
      numero: string;
      tipo: string;
      andar: string;
      capacidade: number;
      valor_diaria: number;
      foto_capa: string;
    };
  };

  instancia: {
    nome: string;
    status: string;
    whatsapp_conectado: string;
    servidor_evolution: string;
  };

  // Campos retrocompatíveis para chamadas de rotas legadas
  identificador?: string;
  tipo_evento?: string;
  data_evento?: string;
  status_reserva?: string;
  mensagem_whatsapp?: string;
  texto_whatsapp?: string;
  link_hotel?: string;
  nome_hospede?: string;
  nome_hotel?: string;
  tags?: any;
  RESERVA?: any;
  proprietario?: any;
  dados_do_proprietario?: any;
  quarto?: any;
  status_atendimento?: string;
  canal?: string;
  origem?: string;
  mensagem?: string;
  cliente?: { nome: string; telefone: string; email: string };
  contato?: { nome: string; telefone: string; email: string };
}

export type WebhookN8nAtendimentoPayload = WebhookN8nPayload;

/**
 * Função construtora centralizada para garantir que TODA webhook
 * siga com 100% de fidelidade a estrutura aprovada no n8n.
 */
export function montarPayloadUnificadoN8n(params: {
  tipo?: string;
  evento?: string;
  data_envio?: string;
  hotelData?: any;
  proprietarioData?: any;
  reservaData?: any;
  hospedeData?: any;
  quartoData?: any;
  instanciaData?: {
    nome?: string;
    status?: string;
    whatsapp_conectado?: string;
    servidor_evolution?: string;
  };
  identificador?: string;
  tipo_evento?: string;
  mensagem_whatsapp?: string;
  texto_whatsapp?: string;
  link_hotel?: string;
  nome_hospede?: string;
  nome_hotel?: string;
  status_reserva?: string;
  status_atendimento?: string;
  canal?: string;
  origem?: string;
  mensagem?: string;
  cliente?: { nome?: string; telefone?: string; email?: string };
  contato?: { nome?: string; telefone?: string; email?: string };
}): WebhookN8nPayload {
  const reservaData = params.reservaData;
  const hotelData = params.hotelData || (typeof window !== 'undefined' ? currentHotelService.getCurrentHotel() : null);
  const hospedeData = params.hospedeData;
  const quartoData = params.quartoData;
  const cObj = params.cliente || params.contato;

  // 1. Determinação de tipo e evento
  const rawStatus = (reservaData?.status || params.status_reserva || '').toString().toLowerCase().trim();
  let tipoFinal = params.tipo || '';
  let eventoFinal = params.evento || '';

  if (!tipoFinal) {
    if (rawStatus.includes('pendent')) {
      tipoFinal = 'reserva_pendente';
      eventoFinal = 'Nova Reserva Pendente';
    } else if (rawStatus.includes('canc')) {
      tipoFinal = 'reserva_cancelada';
      eventoFinal = 'Cancelamento de Reserva';
    } else if (rawStatus.includes('hosped') || rawStatus.includes('checkin')) {
      tipoFinal = 'checkin_realizado';
      eventoFinal = 'Check-in Realizado';
    } else if (rawStatus.includes('concl') || rawStatus.includes('checkout')) {
      tipoFinal = 'checkout_realizado';
      eventoFinal = 'Check-out Realizado';
    } else {
      tipoFinal = 'reserva_confirmada';
      eventoFinal = 'Confirmação de Reserva';
    }
  }

  if (!eventoFinal) {
    if (tipoFinal === 'reserva_confirmada') eventoFinal = 'Confirmação de Reserva';
    else if (tipoFinal === 'reserva_pendente') eventoFinal = 'Nova Reserva Pendente';
    else if (tipoFinal === 'reserva_cancelada') eventoFinal = 'Cancelamento de Reserva';
    else if (tipoFinal === 'checkin_realizado') eventoFinal = 'Check-in Realizado';
    else if (tipoFinal === 'checkout_realizado') eventoFinal = 'Check-out Realizado';
    else eventoFinal = 'Notificação de Reserva';
  }

  // 2. Dados do Hotel
  const nomeHotel = params.nome_hotel || hotelData?.nome || hotelData?.name || 'Hotel Santiago';
  const linkHotel = params.link_hotel || montarLinkPublicoHotel(hotelData);
  const hotelTelefone = formatarTelefoneVisual(hotelData?.telefone || hotelData?.phone || '(66) 98158-5014');
  const hotelWhatsapp = formatarTelefoneVisual(hotelData?.whatsapp || hotelData?.whatsappPhone || hotelData?.telefone || '(66) 98158-5014');
  const hotelEmail = hotelData?.email || hotelData?.email_gerente || hotelData?.email_login || 'contato@hotelsantiago.com.br';

  const hotelObj = {
    id: hotelData?.id || 'f5ce4199-8cd4-4baf-aadb-ff253cf6659d',
    nome: nomeHotel,
    razao_social: hotelData?.razao_social || hotelData?.razaoSocial || hotelData?.nome || hotelData?.name || 'Hotel Santiago LTDA',
    cnpj: hotelData?.cnpj || '12.345.678/0001-90',
    categoria: hotelData?.categoria || hotelData?.category || 'Hotel Urbano / Executivo',
    telefone: hotelTelefone,
    whatsapp: hotelWhatsapp,
    email: hotelEmail,
    link_oficial: linkHotel,
    endereco: {
      logradouro: hotelData?.logradouro || hotelData?.street || hotelData?.endereco || 'Av. Brasil',
      numero: hotelData?.numero || hotelData?.streetNumber || '100',
      bairro: hotelData?.bairro || hotelData?.neighborhood || 'Centro',
      cidade: hotelData?.cidade || hotelData?.city || 'Vila Rica',
      uf: hotelData?.uf || hotelData?.state || 'MT',
      cep: hotelData?.cep || hotelData?.postalCode || '78645-000'
    },
    gerente: {
      nome: params.proprietarioData?.nome || hotelData?.nome_gerente || hotelData?.managerName || hotelData?.proprietario_nome || 'Everaldo Souza',
      cargo: params.proprietarioData?.cargo || hotelData?.cargo_gerente || hotelData?.managerRole || 'Gerente Geral',
      telefone: formatarTelefoneVisual(params.proprietarioData?.telefone || hotelData?.telefone_gerente || hotelData?.managerPhone || hotelData?.telefone || '(66) 98158-5014'),
      email: params.proprietarioData?.email || hotelData?.email_gerente || hotelData?.managerEmail || hotelData?.email_login || 'everaldo@hotelnozap.com.br'
    }
  };

  // 3. Dados do Hóspede
  const nomeHospede = params.nome_hospede || hospedeData?.nome || reservaData?.nome_hospede || cObj?.nome || 'Liz Flor';
  const primeiroNome = nomeHospede.trim().split(' ')[0] || 'Liz';
  const rawHospedeTel = hospedeData?.telefone || (reservaData as any)?.telefone_hospede || (reservaData as any)?.hospede_telefone || (reservaData as any)?.telefone || cObj?.telefone || '557388219748';
  const telDDI = limparTelefoneComDDI(rawHospedeTel) || '557388219748';
  const telFormatado = formatarTelefoneVisual(rawHospedeTel) || '(73) 98821-9748';
  const hospedeEmail = hospedeData?.email || (reservaData as any)?.email_hospede || (reservaData as any)?.hospede_email || cObj?.email || 'lizflor@email.com';
  const hospedeCpf = hospedeData?.cpf_passaporte || hospedeData?.cpf || '123.456.789-00';
  const hospedeCidadeUf = hospedeData?.cidade_uf || hospedeData?.cidadeOrigem || 'Ilhéus - BA';

  const hospedeObj = {
    id: hospedeData?.id || reservaData?.hospede_id || 'a1b2c3d4-e5f6-7890-abcd-1234567890ef',
    nome: nomeHospede,
    primeiro_nome: primeiroNome,
    telefone: telDDI,
    telefone_formatado: telFormatado,
    email: hospedeEmail,
    cpf_passaporte: hospedeCpf,
    cidade_uf: hospedeCidadeUf
  };

  // 4. Dados da Reserva
  const shortId = reservaData?.id ? String(reservaData.id).substring(0, 6).toUpperCase() : '1042';
  const reservaId = reservaData?.id || '99b00c22-33d4-44e5-55f6-66a7b8c9d0e1';
  const numeroReserva = reservaData?.numero_reserva || (reservaId ? `#RES-${shortId}` : '#RES-1042');
  const checkinData = reservaData?.data_checkin ? String(reservaData.data_checkin).split('T')[0] : '2026-10-15';
  const checkoutData = reservaData?.data_checkout ? String(reservaData.data_checkout).split('T')[0] : '2026-10-18';
  const diasEstadia = calcularDiasEstadia(checkinData, checkoutData);
  const valorTotalNum = Number(reservaData?.valor_total ?? 450);
  const valorTotalFmt = `R$ ${valorTotalNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fotoCapaQuarto = quartoData?.foto_capa || quartoData?.imageUrl || quartoData?.fotoCapa || (Array.isArray(quartoData?.fotos) && quartoData.fotos[0]) || (Array.isArray(quartoData?.photos) && quartoData.photos[0]) || 'https://app.hotelnozap.com.br/quartos/suite-102.jpg';

  const quartoObj = {
    id: quartoData?.id ? String(quartoData.id) : (reservaData?.quarto_id || 'q123-456-789'),
    numero: String(quartoData?.numero || quartoData?.number || reservaData?.numero_quarto || '102'),
    tipo: String(quartoData?.tipo || quartoData?.tipoQuarto || quartoData?.category || quartoData?.categoria || quartoData?.name || 'Suíte Luxo Casal'),
    andar: String(quartoData?.andar ?? quartoData?.floor ?? '1º Andar'),
    capacidade: Number(quartoData?.capacidade ?? quartoData?.capacity ?? 2),
    valor_diaria: Number(quartoData?.valor_diaria ?? quartoData?.dailyPrice ?? 150),
    foto_capa: fotoCapaQuarto
  };

  const reservaObj = {
    id: reservaId,
    numero_reserva: numeroReserva,
    status: reservaData?.status ? String(reservaData.status).toLowerCase() : 'confirmado',
    status_pagamento: reservaData?.status_pagamento ? String(reservaData.status_pagamento).toLowerCase() : 'aprovado',
    data_checkin: checkinData,
    data_checkout: checkoutData,
    dias_estadia: diasEstadia,
    valor_total: valorTotalNum,
    valor_total_formatado: valorTotalFmt,
    observacoes: reservaData?.observacoes || 'Check-in previsto para às 15h',
    quarto: quartoObj
  };

  // 5. Dados da Instância
  const instanciaNome = params.instanciaData?.nome || hotelData?.nome_instancia || hotelData?.instanceName || 'meutim';
  const instanciaStatus = params.instanciaData?.status || 'open';
  let instanciaWhatsapp = params.instanciaData?.whatsapp_conectado || '';
  if (!instanciaWhatsapp) {
    const rawInstTel = hotelData?.whatsapp || hotelData?.telefone || '556681585014';
    const cleanInst = limparTelefoneComDDI(rawInstTel) || '556681585014';
    instanciaWhatsapp = `${cleanInst}@s.whatsapp.net`;
  }
  const instanciaServidor = params.instanciaData?.servidor_evolution || 'https://painelevolution.hotelnozap.com.br';

  const instanciaObj = {
    nome: instanciaNome,
    status: instanciaStatus,
    whatsapp_conectado: instanciaWhatsapp,
    servidor_evolution: instanciaServidor
  };

  // 6. Mensagem descritiva de apoio
  const msgWhatsapp = params.mensagem_whatsapp || params.texto_whatsapp || params.mensagem || (
    formatarTextoConfirmacao({ nome_hospede: nomeHospede, nome_hotel: nomeHotel, link_hotel: linkHotel })
  );

  const payload: WebhookN8nPayload = {
    tipo: tipoFinal,
    evento: eventoFinal,
    data_envio: params.data_envio || new Date().toISOString(),
    hotel: hotelObj,
    hospede: hospedeObj,
    reserva: reservaObj,
    instancia: instanciaObj,

    // Retrocompatibilidade
    identificador: tipoFinal.toUpperCase(),
    tipo_evento: tipoFinal.toUpperCase(),
    data_evento: params.data_envio || new Date().toISOString(),
    status_reserva: reservaObj.status,
    mensagem_whatsapp: msgWhatsapp,
    texto_whatsapp: msgWhatsapp,
    link_hotel: linkHotel,
    nome_hospede: nomeHospede,
    nome_hotel: nomeHotel,
    tags: {
      tipo: tipoFinal,
      nome_hospede: nomeHospede,
      nome_hotel: nomeHotel,
      link_hotel: linkHotel
    },
    RESERVA: {
      ...reservaObj,
      hotel_id: hotelObj.id,
      hospede_id: hospedeObj.id,
      quarto_id: quartoObj.id,
      numero_quarto: quartoObj.numero,
      criado_em: params.data_envio || new Date().toISOString()
    },
    proprietario: {
      nome: hotelObj.gerente.nome,
      cargo: hotelObj.gerente.cargo,
      telefone: hotelObj.gerente.telefone,
      email: hotelObj.gerente.email,
      cpf: 'empty',
      email_login: hotelObj.gerente.email,
      nome_instancia: instanciaObj.nome
    },
    dados_do_proprietario: {
      nome: hotelObj.gerente.nome,
      cargo: hotelObj.gerente.cargo,
      telefone: hotelObj.gerente.telefone,
      email: hotelObj.gerente.email,
      cpf: 'empty',
      email_login: hotelObj.gerente.email,
      nome_instancia: instanciaObj.nome
    },
    quarto: {
      ...quartoObj,
      fotos: [quartoObj.foto_capa]
    },
    status_atendimento: 'ativo',
    canal: params.canal || 'whatsapp',
    origem: params.origem || 'sistema_reservas',
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
   * Dispara o webhook padronizado para o n8n toda vez que uma reserva for realizada
   * ou atualizada no sistema.
   */
  async dispararWebhookConfirmacaoReserva(
    reservaOuId: any,
    dadosAdicionais?: { hotel?: any; hospede?: any; quarto?: any; tipo?: string; evento?: string }
  ): Promise<{ success: boolean; error?: string; payload?: WebhookN8nPayload }> {
    try {
      if (!N8N_WEBHOOK_CONFIRMACAO_RESERVA_URL) {
        return { success: false, error: 'Endpoint do webhook n8n não configurado.' };
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

      // 2. Determinar status e tipo do evento
      const rawStatus = (reservaData.status || '').toString().toLowerCase().trim();
      let tipo = dadosAdicionais?.tipo || '';
      let evento = dadosAdicionais?.evento || '';

      if (!tipo) {
        if (rawStatus.includes('pendent')) {
          tipo = 'reserva_pendente';
          evento = 'Nova Reserva Pendente';
        } else if (rawStatus.includes('canc')) {
          tipo = 'reserva_cancelada';
          evento = 'Cancelamento de Reserva';
        } else if (rawStatus.includes('hosped') || rawStatus.includes('checkin')) {
          tipo = 'checkin_realizado';
          evento = 'Check-in Realizado';
        } else if (rawStatus.includes('concl') || rawStatus.includes('checkout')) {
          tipo = 'checkout_realizado';
          evento = 'Check-out Realizado';
        } else {
          tipo = 'reserva_confirmada';
          evento = 'Confirmação de Reserva';
        }
      }

      // 3. Prevenção de duplicidade por ID em rajadas (intervalo de 5s)
      const reservaId = reservaData.id || '';
      const cacheKey = `${reservaId}_${tipo}`;
      const agora = Date.now();
      if (reservaId && cacheUltimosEnvios.has(cacheKey)) {
        const ultimoTimestamp = cacheUltimosEnvios.get(cacheKey)!;
        if (agora - ultimoTimestamp < 5000) {
          console.info(`[Webhook n8n] Webhook ignorado por disparo recente duplicado para reserva ${reservaId} (${tipo}).`);
          return { success: true, error: 'Disparo recente duplicado evitado' };
        }
      }
      if (reservaId) {
        cacheUltimosEnvios.set(cacheKey, agora);
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

      // 6. Obter dados do Quarto
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

      // 7. Obter dados da Instância Evolution API
      const instanciaInfo = {
        nome: hotelData?.nome_instancia || hotelData?.instanceName || 'meutim',
        status: 'open',
        whatsapp_conectado: '',
        servidor_evolution: 'https://painelevolution.hotelnozap.com.br'
      };

      try {
        const { evolutionApiService } = await import('./evolutionApiService');
        instanciaInfo.servidor_evolution = evolutionApiService.getApiUrl() || 'https://painelevolution.hotelnozap.com.br';
        const instances = await evolutionApiService.fetchInstances();
        const matched = instances.find(
          (i) => i.name.toLowerCase() === instanciaInfo.nome.toLowerCase()
        );
        if (matched) {
          instanciaInfo.status = matched.connectionStatus || 'open';
          const jid = matched.ownerJid || (matched.number ? `${matched.number}@s.whatsapp.net` : '');
          if (jid) {
            instanciaInfo.whatsapp_conectado = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
          }
        }
      } catch (eInst) {
        console.warn('[Webhook n8n] Aviso ao obter dados da Evolution API:', eInst);
      }

      if (!instanciaInfo.whatsapp_conectado) {
        const rawHotelPhone = hotelData?.whatsapp || hotelData?.telefone || '556681585014';
        const cleanHotelPhone = limparTelefoneComDDI(rawHotelPhone) || '556681585014';
        instanciaInfo.whatsapp_conectado = `${cleanHotelPhone}@s.whatsapp.net`;
      }

      // 8. Montar Payload no modelo unificado estrito aprovado
      const payload: WebhookN8nPayload = montarPayloadUnificadoN8n({
        tipo,
        evento,
        data_envio: new Date().toISOString(),
        hotelData,
        hospedeData,
        quartoData,
        reservaData,
        instanciaData: instanciaInfo
      });

      console.info('[Webhook n8n] Disparando webhook oficial de reserva para:', N8N_WEBHOOK_CONFIRMACAO_RESERVA_URL, payload);

      // 9. Envio HTTP POST para a webhook do n8n
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
   * Dispara um teste de webhook com exatamente os dados de modelo solicitados
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

    const testPayload: WebhookN8nPayload = {
      tipo: 'reserva_confirmada',
      evento: 'Confirmação de Reserva',
      data_envio: new Date().toISOString(),
      hotel: {
        id: hotel?.id || 'f5ce4199-8cd4-4baf-aadb-ff253cf6659d',
        nome: hotel?.nome || hotel?.name || 'Hotel Santiago',
        razao_social: hotel?.razao_social || hotel?.razaoSocial || hotel?.nome || 'Hotel Santiago LTDA',
        cnpj: hotel?.cnpj || '12.345.678/0001-90',
        categoria: hotel?.categoria || hotel?.category || 'Hotel Urbano / Executivo',
        telefone: formatarTelefoneVisual(hotel?.telefone || hotel?.phone || '(66) 98158-5014'),
        whatsapp: formatarTelefoneVisual(hotel?.whatsapp || hotel?.whatsappPhone || hotel?.telefone || '(66) 98158-5014'),
        email: hotel?.email || hotel?.email_gerente || hotel?.email_login || 'contato@hotelsantiago.com.br',
        link_oficial: montarLinkPublicoHotel(hotel),
        endereco: {
          logradouro: hotel?.logradouro || hotel?.street || 'Av. Brasil',
          numero: hotel?.numero || hotel?.streetNumber || '100',
          bairro: hotel?.bairro || hotel?.neighborhood || 'Centro',
          cidade: hotel?.cidade || hotel?.city || 'Vila Rica',
          uf: hotel?.uf || hotel?.state || 'MT',
          cep: hotel?.cep || hotel?.postalCode || '78645-000'
        },
        gerente: {
          nome: hotel?.nome_gerente || hotel?.managerName || hotel?.proprietario_nome || 'Everaldo Souza',
          cargo: hotel?.cargo_gerente || hotel?.managerRole || 'Gerente Geral',
          telefone: formatarTelefoneVisual(hotel?.telefone_gerente || hotel?.managerPhone || hotel?.telefone || '(66) 98158-5014'),
          email: hotel?.email_gerente || hotel?.managerEmail || hotel?.email_login || 'everaldo@hotelnozap.com.br'
        }
      },
      hospede: {
        id: 'a1b2c3d4-e5f6-7890-abcd-1234567890ef',
        nome: 'Liz Flor',
        primeiro_nome: 'Liz',
        telefone: '557388219748',
        telefone_formatado: '(73) 98821-9748',
        email: 'lizflor@email.com',
        cpf_passaporte: '123.456.789-00',
        cidade_uf: 'Ilhéus - BA'
      },
      reserva: {
        id: '99b00c22-33d4-44e5-55f6-66a7b8c9d0e1',
        numero_reserva: '#RES-1042',
        status: 'confirmado',
        status_pagamento: 'aprovado',
        data_checkin: '2026-10-15',
        data_checkout: '2026-10-18',
        dias_estadia: 3,
        valor_total: 450.00,
        valor_total_formatado: 'R$ 450,00',
        observacoes: 'Check-in previsto para às 15h',
        quarto: {
          id: 'q123-456-789',
          numero: '102',
          tipo: 'Suíte Luxo Casal',
          andar: '1º Andar',
          capacidade: 2,
          valor_diaria: 150.00,
          foto_capa: 'https://app.hotelnozap.com.br/quartos/suite-102.jpg'
        }
      },
      instancia: {
        nome: hotel?.nome_instancia || hotel?.instanceName || 'meutim',
        status: 'open',
        whatsapp_conectado: `${limparTelefoneComDDI(hotel?.whatsapp || hotel?.telefone || '556681585014')}@s.whatsapp.net`,
        servidor_evolution: 'https://painelevolution.hotelnozap.com.br'
      }
    };

    try {
      const response = await fetch(N8N_WEBHOOK_CONFIRMACAO_RESERVA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(testPayload)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return { success: false, message: `HTTP ${response.status}: ${errorText}`, payload: testPayload };
      }

      return {
        success: true,
        message: 'Webhook n8n disparado com sucesso! (Status 200 OK)',
        payload: testPayload
      };
    } catch (err: any) {
      return { success: false, message: `Falha ao enviar webhook: ${err?.message || 'Erro inesperado'}` };
    }
  },

  /**
   * Dispara o webhook para o n8n quando iniciar uma conversa (tipo: "atendimento")
   */
  async dispararWebhookAtendimento(dados?: any): Promise<{ success: boolean; payload?: WebhookN8nPayload; error?: string }> {
    try {
      // Autoresponder de início de conversa mantido desativado permanentemente
      return { success: false, error: 'Atendimento automático via WhatsApp desativado permanentemente.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro inesperado' };
    }
  },

  /**
   * Dispara um teste com tipo: "atendimento" para o n8n
   */
  async testarWebhookAtendimento(hotelCustom?: any): Promise<{ success: boolean; message: string; payload?: any }> {
    return { success: false, message: 'Atendimento automático desativado.' };
  }
};
