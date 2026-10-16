/**
 * templateMensagemService.ts
 * Serviço para gerenciamento, interpolação e disparo de templates de mensagens WhatsApp
 * Conecta os templates definidos em Parâmetros do Sistema à Evolution API v2.3.0
 */

import { evolutionApiService } from './evolutionApiService';
import { currentHotelService } from './supabaseService';
import { supabase } from '../lib/supabase';
import { formatPhoneEvolution } from '../utils/masks';

/**
 * Calcula com precisão as horas restantes até o check-in no fuso do hotel
 */
export function calcularHorasAteCheckin(
  dataCheckinStr: any,
  horarioCheckinStr: string = '12:00',
  timeZone: string = 'America/Cuiaba'
): number {
  try {
    if (!dataCheckinStr) return 999;
    const cleanDate = String(dataCheckinStr).split('T')[0].split(' ')[0];
    const parts = cleanDate.includes('/') ? cleanDate.split('/') : cleanDate.split('-');
    let year = 2026, month = 1, day = 1;
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        year = Number(parts[0]);
        month = Number(parts[1]);
        day = Number(parts[2]);
      } else {
        day = Number(parts[0]);
        month = Number(parts[1]);
        year = Number(parts[2]);
      }
    }
    const [h, m] = (horarioCheckinStr || '12:00').split(':').map(Number);
    // Offsets no Brasil: Cuiabá é UTC-4, Brasília/São Paulo é UTC-3
    const isCuiaba = String(timeZone || '').includes('Cuiaba');
    const offsetHours = isCuiaba ? 4 : 3;
    const checkinUtcMs = Date.UTC(year, month - 1, day, (h || 12) + offsetHours, m || 0, 0);
    return (checkinUtcMs - Date.now()) / (1000 * 60 * 60);
  } catch {
    return 999;
  }
}

export type TemplateType = 'boas_vindas' | 'confirmacao' | 'lembrete_checkin' | 'checkout' | 'pix';

export interface TemplateTags {
  nome_hospede?: string;
  nome_hotel?: string;
  link_hotel?: string;
  numero_quarto?: string;
  tipo_quarto?: string;
  checkin?: string;
  checkout?: string;
  valor_total?: string;
  link_pagamento?: string;
  horario_checkin?: string;
  horario_checkout?: string;
  aviso_checkin?: string;
  frase_tempo?: string;
  [key: string]: string | undefined;
}

export interface TemplatesConfig {
  boas_vindas: string;
  confirmacao: string;
  lembrete_checkin: string;
  checkout: string;
  pix: string;
}

export const TEMPLATES_PADRAO: TemplatesConfig = {
  boas_vindas:
    'Olá, {nome_hospede}! 👋 Seja bem-vindo(a) ao {nome_hotel}.\n\nPara consultar fotos das acomodações, valores de diárias atualizados e realizar a sua reserva com confirmação imediata, acesse o nosso link oficial:\n\n👉 {link_hotel}\n\n⚠️ É necessário entrar no link acima para verificar a disponibilidade de quartos, simular os preços para as suas datas e garantir sua reserva. Caso tenha qualquer dúvida, estamos à disposição!\n\n_Esta é uma mensagem automática do sistema, por favor não responder!_',
  confirmacao:
    '🎉 Parabéns, {nome_hospede}! Sua reserva no {nome_hotel} foi confirmada com sucesso! 🏨\n\n📌 Acomodação: {tipo_quarto} (Quarto {numero_quarto})\n📅 Check-in: {checkin} (a partir das {horario_checkin})\n📅 Check-out: {checkout}\n💰 Valor Total: {valor_total}\n\n⏰ Horário de entrada: a partir das {horario_checkin} (aguardamos sua chegada até às 20:00). Caso ocorra qualquer imprevisto ou atraso na viagem, avise nossa recepção com antecedência para mantermos seu quarto garantido!\n\nEstamos ansiosos para recebê-lo(a)!\n\n_Esta é uma mensagem automática do sistema, por favor não responder!_',
  lembrete_checkin:
    'Olá, {nome_hospede}! {aviso_checkin} 🧳\n\n⏰ Horário de entrada: a partir das {horario_checkin} (aguardamos sua chegada até às 20:00).\n📍 Localização: recepção central.\n\nSe precisar antecipar sua chegada ou tiver qualquer imprevisto na estrada, avise nossa recepção com antecedência para mantermos sua entrada garantida!\n\n_Esta é uma mensagem automática do sistema, por favor não responder!_',
  checkout:
    'Olá, {nome_hospede}! Esperamos que sua estadia no {nome_hotel} tenha sido maravilhosa! ✨\n\nAgradecemos muito pela preferência. Foi um prazer recebê-lo(a). Poderia nos avaliar no Google Maps? Até a próxima viagem!\n\n_Esta é uma mensagem automática do sistema, por favor não responder!_',
  pix:
    'Olá, {nome_hospede}! Para garantir sua reserva no {nome_hotel}, segue a chave PIX para pagamento:\n\n🔑 Chave PIX: {chave_pix}\n💰 Valor Total: {valor_total}\n\nAssim que efetuar o pagamento, envie o comprovante por aqui para confirmação imediata!\n\n_Esta é uma mensagem automática do sistema, por favor não responder!_'
};

export interface AutomacoesConfig {
  auto_boas_vindas: boolean;
  auto_confirmacao: boolean;
  auto_lembrete_checkin: boolean;
  auto_checkout: boolean;
  fuso_horario: 'America/Cuiaba' | 'America/Sao_Paulo';
}

export const AUTOMACOES_PADRAO: AutomacoesConfig = {
  auto_boas_vindas: false,
  auto_confirmacao: true,
  auto_lembrete_checkin: true,
  auto_checkout: true,
  fuso_horario: 'America/Cuiaba'
};

const STORAGE_KEY_PARAMETROS = 'hotelnozap_parametros_sistema';

export const templateMensagemService = {
  /**
   * Obtém as configurações de automações de disparo do hotel
   */
  getHotelAutomacoes(hotelId?: string): AutomacoesConfig {
    const activeHotelId = hotelId || currentHotelService.getCurrentHotel()?.id;
    if (!activeHotelId || typeof window === 'undefined') {
      return { ...AUTOMACOES_PADRAO, auto_boas_vindas: false };
    }
    try {
      const saved = localStorage.getItem(`hotelnozap_automacoes_hotel_${activeHotelId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...AUTOMACOES_PADRAO, ...parsed, auto_boas_vindas: false };
      }
    } catch {}
    return { ...AUTOMACOES_PADRAO, auto_boas_vindas: false };
  },

  /**
   * Salva as configurações de automação de disparo do hotel
   */
  saveHotelAutomacoes(hotelId: string, config: Partial<AutomacoesConfig>): void {
    if (!hotelId || typeof window === 'undefined') return;
    try {
      const current = this.getHotelAutomacoes(hotelId);
      const updated = { ...current, ...config, auto_boas_vindas: false };
      localStorage.setItem(`hotelnozap_automacoes_hotel_${hotelId}`, JSON.stringify(updated));
      window.dispatchEvent(
        new CustomEvent('hotelnozap_automacoes_atualizadas', { detail: { hotelId, automacoes: updated } })
      );
    } catch (e) {
      console.warn('Erro ao salvar automações do hotel:', e);
    }
  },

  /**
   * Retorna hora formatada no fuso horário do hotel
   */
  getHorarioFormatadoNoFuso(timeZone: 'America/Cuiaba' | 'America/Sao_Paulo' = 'America/Cuiaba', date: Date = new Date()): string {
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(date);
    } catch {
      return date.toLocaleTimeString('pt-BR');
    }
  },

  /**
   * Retorna a data no formato YYYY-MM-DD no fuso horário especificado
   */
  getDataStringNoFuso(timeZone: 'America/Cuiaba' | 'America/Sao_Paulo' = 'America/Cuiaba', date: Date = new Date()): string {
    try {
      const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(date);
      const y = parts.find(p => p.type === 'year')?.value;
      const m = parts.find(p => p.type === 'month')?.value;
      const d = parts.find(p => p.type === 'day')?.value;
      return `${y}-${m}-${d}`;
    } catch {
      return date.toISOString().split('T')[0];
    }
  },

  /**
   * Retorna a data de amanhã no formato YYYY-MM-DD no fuso horário especificado
   */
  getDataAmanhaNoFuso(timeZone: 'America/Cuiaba' | 'America/Sao_Paulo' = 'America/Cuiaba'): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return this.getDataStringNoFuso(timeZone, d);
  },
  /**
   * Obtém os templates salvos nos Parâmetros Globais do Sistema (ou retorna os padrões)
   */
  getGlobalTemplates(): TemplatesConfig {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY_PARAMETROS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.templates) {
            const LEGACY_BOAS_VINDAS =
              'Olá {nome_hospede}! 👋 Bem-vindo(a) ao {nome_hotel}. Sou a atendente virtual da recepção e estou aqui para tirar suas dúvidas, informar tarifas e ajudar na sua reserva. Como posso te ajudar hoje?';
            if (parsed.templates.boas_vindas === LEGACY_BOAS_VINDAS) {
              parsed.templates.boas_vindas = TEMPLATES_PADRAO.boas_vindas;
            }
            return {
              ...TEMPLATES_PADRAO,
              ...parsed.templates
            };
          }
        }
      }
    } catch {}
    return { ...TEMPLATES_PADRAO };
  },

  /**
   * Retorna a URL pública completa do hotel para consulta de acomodações e reservas
   */
  getHotelPublicLink(hotelId?: string): string {
    try {
      const activeHotel = hotelId ? { id: hotelId } : currentHotelService.getCurrentHotel();
      let hotelName = (activeHotel as any)?.name || '';
      let hotelLink = (activeHotel as any)?.link || '';

      if ((!hotelName || !hotelLink) && typeof window !== 'undefined') {
        const stored = localStorage.getItem('hotelnozap_current_hotel');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (!hotelName) hotelName = parsed.name || '';
          if (!hotelLink) hotelLink = parsed.link || '';
        }
      }

      let cleanSlug = '';
      if (hotelLink) {
        cleanSlug = hotelLink.replace(/^(https?:\/\/[^\/]+)?\/?(hotel|hoteis)\/?/i, '').replace(/[^a-z0-9]/g, '');
      }
      if (!cleanSlug && hotelName) {
        cleanSlug = hotelName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '');
      }
      if (!cleanSlug) cleanSlug = 'hotelmoradadalua';

      let domain = 'https://app.hotelnozap.com.br';
      if (typeof window !== 'undefined' && window.location && window.location.origin) {
        domain = window.location.origin;
      }

      return `${domain}/hoteis/${cleanSlug}`;
    } catch {
      return typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/hoteis/hotelmoradadalua`
        : 'https://app.hotelnozap.com.br/hoteis/hotelmoradadalua';
    }
  },

  /**
   * Obtém os templates específicos do hotel (com fallback para globais e padrões)
   */
  getHotelTemplates(hotelId?: string): TemplatesConfig {
    const activeHotelId = hotelId || currentHotelService.getCurrentHotel()?.id;
    const globalTemplates = this.getGlobalTemplates();

    if (!activeHotelId || typeof window === 'undefined') {
      return globalTemplates;
    }

    try {
      const saved = localStorage.getItem(`hotelnozap_templates_hotel_${activeHotelId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const LEGACY_BOAS_VINDAS =
          'Olá {nome_hospede}! 👋 Bem-vindo(a) ao {nome_hotel}. Sou a atendente virtual da recepção e estou aqui para tirar suas dúvidas, informar tarifas e ajudar na sua reserva. Como posso te ajudar hoje?';
        if (parsed.boas_vindas === LEGACY_BOAS_VINDAS) {
          parsed.boas_vindas = TEMPLATES_PADRAO.boas_vindas;
        }
        return {
          ...globalTemplates,
          ...parsed
        };
      }
    } catch (e) {
      console.warn('Erro ao carregar templates do hotel:', e);
    }

    return globalTemplates;
  },

  /**
   * Salva os templates personalizados do hotel no storage e emite evento
   */
  saveHotelTemplates(hotelId: string, templates: Partial<TemplatesConfig>): void {
    if (!hotelId || typeof window === 'undefined') return;
    try {
      localStorage.setItem(`hotelnozap_templates_hotel_${hotelId}`, JSON.stringify(templates));
      window.dispatchEvent(
        new CustomEvent('hotelnozap_templates_atualizados', { detail: { hotelId, templates } })
      );
    } catch (e) {
      console.warn('Erro ao salvar templates do hotel:', e);
    }
  },

  /**
   * Restaura os templates do hotel para o padrão da plataforma
   */
  resetHotelTemplates(hotelId: string): TemplatesConfig {
    if (hotelId && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`hotelnozap_templates_hotel_${hotelId}`);
        window.dispatchEvent(
          new CustomEvent('hotelnozap_templates_atualizados', { detail: { hotelId } })
        );
      } catch (e) {
        console.warn('Erro ao restaurar templates do hotel:', e);
      }
    }
    return this.getGlobalTemplates();
  },

  /**
   * Obtém os templates salvos (mantém compatibilidade, prioriza hotel)
   */
  getTemplates(hotelId?: string): TemplatesConfig {
    return this.getHotelTemplates(hotelId);
  },

  /**
   * Interpola tags diretamente em um texto de template
   */
  interpolarTemplate(templateText: string, tags: TemplateTags, hotelId?: string): string {
    let text = templateText || '';
    const allTags: TemplateTags = {
      link_hotel: this.getHotelPublicLink(hotelId),
      ...tags
    };

    // Tratamento elegante caso o hóspede não esteja cadastrado na base (sem nome)
    const nomeHospede = allTags.nome_hospede?.trim();
    if (!nomeHospede) {
      // "Olá {nome_hospede}!" se torna naturalmente "Olá!" sem espaços duplos
      text = text.replace(/Olá\s*\{nome_hospede\}!/gi, 'Olá!');
      text = text.replace(/Olá\s*\{nome_hospede\},/gi, 'Olá,');
      text = text.replace(/Olá\s*\{nome_hospede\}/gi, 'Olá');
      text = text.replace(/Parabéns\s*\{nome_hospede\}!/gi, 'Parabéns!');
      text = text.replace(/\{nome_hospede\}/gi, '');
    }

    Object.entries(allTags).forEach(([key, val]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      text = text.replace(regex, val !== undefined && val !== null ? String(val) : '');
    });

    return text;
  },

  /**
   * Renderiza o template substituindo as tags dinâmicas pelos valores reais
   */
  renderTemplate(type: TemplateType, tags: TemplateTags, hotelId?: string): string {
    const templates = this.getHotelTemplates(hotelId);
    const text = templates[type] || TEMPLATES_PADRAO[type] || '';
    let rendered = this.interpolarTemplate(text, tags, hotelId);

    const rodapeObrigatorio = '_Esta é uma mensagem automática do sistema, por favor não responder!_';
    if (!rendered.includes('Esta é uma mensagem automática do sistema, por favor não responder!')) {
      rendered = `${rendered.trim()}\n\n${rodapeObrigatorio}`;
    }

    return rendered;
  },

  /**
   * Localiza a instância conectada (status 'open') do hotel na Evolution API
   */
  async getInstanciaConectadaDoHotel(hotelId?: string): Promise<{
    instanceName: string | null;
    status: string;
    isOnline: boolean;
  }> {
    try {
      const activeHotel = hotelId ? { id: hotelId } : currentHotelService.getCurrentHotel();
      const cleanHotelPrefix = (activeHotel.id || 'hotel')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 8);

      const evoList = await evolutionApiService.fetchInstances();
      const metaMap = evolutionApiService.getLocalMetadata(activeHotel.id);

      // 1. Procura instância do hotel com status 'open'
      const hotelOpenInstance = evoList.find((inst) => {
        if (inst.connectionStatus !== 'open') return false;
        const meta = metaMap[inst.name];
        if (meta && meta.hotelId === activeHotel.id) return true;
        if (inst.name.toLowerCase().startsWith(cleanHotelPrefix + '_')) return true;
        return false;
      });

      if (hotelOpenInstance) {
        return {
          instanceName: hotelOpenInstance.name,
          status: 'open',
          isOnline: true
        };
      }

      // 2. Se não achou com prefixo/meta, verifica se o hotel tem instanceName cadastrado no banco
      if (activeHotel?.id) {
        try {
          const { data: hData } = await supabase
            .from('hoteis')
            .select('nome_instancia')
            .eq('id', activeHotel.id)
            .maybeSingle();

          if (hData?.nome_instancia) {
            const matched = evoList.find(
              (i) => i.name.toLowerCase() === hData.nome_instancia.toLowerCase()
            );
            if (matched && matched.connectionStatus === 'open') {
              return {
                instanceName: matched.name,
                status: 'open',
                isOnline: true
              };
            }
          }
        } catch (dbErr) {
          console.warn('[templateMensagemService] Aviso ao buscar nome_instancia do hotel:', dbErr);
        }
      }

      // Se não encontrou nenhuma instância vinculada ao hotel, retorna desconectado.
      // NUNCA fazer fallback para instâncias de outros hotéis ou instâncias pessoais abertas no servidor!
      return {
        instanceName: null,
        status: 'disconnected',
        isOnline: false
      };
    } catch (err) {
      console.warn('Erro ao consultar instância conectada:', err);
      return { instanceName: null, status: 'error', isOnline: false };
    }
  },

  /**
   * ──────────────────────────────────────────────────────────────────────────
   * Cache anti-duplicidade COMPARTILHADO via localStorage (TTL: 5 minutos).
   * Usado por whatsappAutoResponderService e templateMensagemService para
   * garantir que apenas UMA mensagem de boas-vindas seja enviada por número,
   * independente de qual serviço a disparou primeiro.
   * ──────────────────────────────────────────────────────────────────────────
   */
  _DISPATCH_LS_KEY: 'hotelnozap_boas_vindas_dispatches' as string,
  _DISPATCH_TTL_MS: 5 * 60 * 1000, // 5 minutos

  /** Lê o mapa de disparos recentes do localStorage */
  _readDispatchCache(): Record<string, number> {
    try {
      const raw = localStorage.getItem(this._DISPATCH_LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  /** Persiste o mapa no localStorage */
  _writeDispatchCache(cache: Record<string, number>): void {
    try {
      localStorage.setItem(this._DISPATCH_LS_KEY, JSON.stringify(cache));
    } catch {}
  },

  /**
   * Verifica se já foi enviada boas-vindas para este telefone recentemente.
   * Retorna true se deve ser BLOQUEADO (já enviado dentro do TTL).
   */
  _checkRecentDispatch(phone: string, hotelId?: string): boolean {
    const key = `${hotelId || 'default'}_${phone}`;
    const cache = this._readDispatchCache();
    const lastTs = cache[key];
    if (lastTs && Date.now() - lastTs < this._DISPATCH_TTL_MS) {
      return true; // bloqueado — já enviado recentemente
    }
    return false;
  },

  /**
   * Registra que boas-vindas foram enviadas para este telefone agora.
   * Remove entradas antigas (> TTL) para não crescer indefinidamente.
   */
  _markRecentDispatch(phone: string, hotelId?: string): void {
    const key = `${hotelId || 'default'}_${phone}`;
    const now = Date.now();
    const cache = this._readDispatchCache();
    // Limpa entradas expiradas
    for (const k of Object.keys(cache)) {
      if (now - cache[k] > this._DISPATCH_TTL_MS) {
        delete cache[k];
      }
    }
    cache[key] = now;
    this._writeDispatchCache(cache);
  },

  /** @deprecated mantido apenas para compatibilidade interna */
  _recentDispatches: new Map<string, number>(),

  /**
   * Dispara mensagem WhatsApp via Evolution API usando a instância conectada do hotel
   */
  async enviarMensagemWhatsApp(
    hotelId: string | undefined,
    telefoneDestino: string,
    mensagem: string
  ): Promise<{
    success: boolean;
    via: 'evolution_api' | 'wa_me';
    instanceName?: string;
    error?: string;
  }> {
    try {
      if (!telefoneDestino || !mensagem?.trim()) {
        return {
          success: false,
          via: 'evolution_api',
          error: 'Telefone ou mensagem vazia.'
        };
      }

      const activeHotelId = hotelId || currentHotelService.getCurrentHotel()?.id;
      const instInfo = await this.getInstanciaConectadaDoHotel(activeHotelId);

      let instanceToUse = instInfo.instanceName;

      if (!instInfo.isOnline || !instanceToUse) {
        console.warn('[templateMensagemService] Instância direta do hotel não online, buscando instâncias ativas no servidor...');
        try {
          const evoList = await evolutionApiService.fetchInstances();
          
          // 1. Tenta achar a instância cadastrada no banco para o hotel
          if (activeHotelId) {
            const { data: hData } = await supabase.from('hoteis').select('nome_instancia').eq('id', activeHotelId).maybeSingle();
            if (hData?.nome_instancia) {
              const matched = evoList.find(i => i.name.toLowerCase() === hData.nome_instancia.toLowerCase() && i.connectionStatus === 'open');
              if (matched) instanceToUse = matched.name;
            }
          }

          // 2. Se ainda não achou, usa a primeira instância 'open' do servidor (ex: meutim)
          if (!instanceToUse) {
            const fallbackOpen = evoList.find(i => i.connectionStatus === 'open');
            if (fallbackOpen) instanceToUse = fallbackOpen.name;
          }
        } catch (e) {
          console.warn('[templateMensagemService] Erro ao buscar instâncias fallback:', e);
        }
      }

      if (!instanceToUse) {
        console.warn('[templateMensagemService] Nenhuma instância de WhatsApp conectada no momento.');
        return {
          success: false,
          via: 'wa_me',
          error: 'Nenhuma instância de WhatsApp conectada para este hotel. Conecte sua instância na aba de Conexões WhatsApp.'
        };
      }

      const cleanPhone = formatPhoneEvolution(telefoneDestino);
      if (!cleanPhone) {
        return {
          success: false,
          via: 'evolution_api',
          instanceName: instanceToUse,
          error: 'Número de telefone inválido para o WhatsApp.'
        };
      }

      const res = await evolutionApiService.sendTextMessageDetailed(
        instanceToUse,
        cleanPhone,
        mensagem
      );

      if (res.success) {
        console.info(`[templateMensagemService] ✅ Mensagem enviada com sucesso para ${cleanPhone} via instância ${instanceToUse}`);
        return {
          success: true,
          via: 'evolution_api',
          instanceName: instanceToUse
        };
      } else {
        console.error(`[templateMensagemService] ❌ Erro ao enviar mensagem para ${cleanPhone} via ${instanceToUse}:`, res.error);
        return {
          success: false,
          via: 'evolution_api',
          instanceName: instanceToUse,
          error: res.error || 'Falha ao enviar mensagem pela Evolution API.'
        };
      }
    } catch (err: any) {
      console.error('[templateMensagemService] Erro inesperado ao enviar mensagem WhatsApp:', err);
      return {
        success: false,
        via: 'evolution_api',
        error: err?.message || 'Erro inesperado ao enviar mensagem via WhatsApp.'
      };
    }
  },

  /**
   * Dispara a mensagem automática de Boas-Vindas / Início de Atendimento
   * usando o template do hotel via Evolution API pela instância conectada
   */
  async dispararBoasVindasAutomatica(
    hotelId: string | undefined,
    dados: any
  ): Promise<{ success: boolean; via?: string; instanceName?: string; error?: string }> {
    // SERVIÇO DE RESPOSTA AUTOMÁTICA DESATIVADO PERMANENTEMENTE
    return { success: false, error: 'Autoresponder desativado permanentemente.' };
  },

  /**
   * Alias para dispararAtendimentoAutomatico (Início de Atendimento)
   */
  async dispararAtendimentoAutomatico(hotelId: string | undefined, dados: any) {
    return this.dispararBoasVindasAutomatica(hotelId, dados);
  },

  /**
   * Resolve todos os dados necessários (hóspede, quarto, hotel e tags) a partir de um objeto de reserva parcial ou completo
   */
  async resolverDadosCompletosReserva(dados: any, activeHotelId?: string): Promise<{
    hospedeData: any;
    quartoData: any;
    hotelData: any;
    telefoneDestino: string;
    hospedeNome: string;
    hospedeEmail: string;
    tags: TemplateTags;
  }> {
    const hotelIdToUse = activeHotelId || dados.hotel_id || currentHotelService.getCurrentHotel()?.id;

    // 1. Hotel
    let hotelData: any = null;
    if (hotelIdToUse) {
      try {
        const { data: hDb } = await supabase
          .from('hoteis')
          .select('*')
          .eq('id', hotelIdToUse)
          .maybeSingle();
        if (hDb) hotelData = hDb;
      } catch (e) {
        console.warn('[templateMensagemService] Aviso ao buscar hotel no Supabase:', e);
      }
    }
    if (!hotelData) {
      hotelData = currentHotelService.getCurrentHotel();
    }

    // 2. Hóspede
    let hospedeData: any = null;
    const hospedeId = dados.hospede_id;
    if (hospedeId) {
      try {
        const { data: gDb } = await supabase
          .from('hospedes')
          .select('*')
          .eq('id', hospedeId)
          .maybeSingle();
        if (gDb) hospedeData = gDb;
      } catch (e) {
        console.warn('[templateMensagemService] Aviso ao buscar hóspede por ID:', e);
      }
    }

    if (!hospedeData && dados.nome_hospede && hotelIdToUse) {
      try {
        const { data: gDb } = await supabase
          .from('hospedes')
          .select('*')
          .eq('hotel_id', hotelIdToUse)
          .ilike('nome', dados.nome_hospede)
          .limit(1)
          .maybeSingle();
        if (gDb) hospedeData = gDb;
      } catch (e) {
        console.warn('[templateMensagemService] Aviso ao buscar hóspede por nome:', e);
      }
    }

    // 3. Quarto
    let quartoData: any = null;
    const quartoId = dados.quarto_id;
    if (quartoId) {
      try {
        const { data: qDb } = await supabase
          .from('quartos')
          .select('*')
          .eq('id', quartoId)
          .maybeSingle();
        if (qDb) quartoData = qDb;
      } catch {}
    }
    if (!quartoData && (dados.numero_quarto || dados.quartoNumero) && hotelIdToUse) {
      try {
        const numQ = String(dados.numero_quarto || dados.quartoNumero);
        const { data: qDb } = await supabase
          .from('quartos')
          .select('*')
          .eq('hotel_id', hotelIdToUse)
          .eq('numero', numQ)
          .maybeSingle();
        if (qDb) quartoData = qDb;
      } catch {}
    }

    // 4. Determinar telefone de destino (com fallbacks amplos)
    let telefoneDestino =
      dados.telefone_hospede ||
      dados.hospedeTelefone ||
      dados.telefone ||
      dados.whatsapp ||
      dados.guestWhatsapp ||
      dados.celular ||
      dados.phone ||
      hospedeData?.telefone ||
      hospedeData?.whatsapp ||
      hospedeData?.celular ||
      '';

    // Se ainda não encontrou telefone, tenta extrair de observacoes (ex: "Telefone: 6699...")
    if (!telefoneDestino && dados.observacoes) {
      const matchPhone = dados.observacoes.match(/(?:telefone|whatsapp|contato|celular)[:\s]+([0-9\(\)\s\-+]{8,20})/i);
      if (matchPhone && matchPhone[1]) {
        telefoneDestino = matchPhone[1];
      }
    }

    // 5. Nome e Email
    const hospedeNome = dados.nome_hospede || dados.hospedeNome || hospedeData?.nome || 'Hóspede';
    const hospedeEmail = dados.email_hospede || dados.hospedeEmail || dados.email || hospedeData?.email || '';

    // 6. Formatações
    const formatarDataBR = (val: any) => {
      if (!val) return '';
      const s = String(val).split('T')[0];
      const parts = s.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return s;
    };

    const formatarMoedaBR = (val: any) => {
      if (val === undefined || val === null || val === '') return 'R$ 0,00';
      if (typeof val === 'string' && val.includes('R$')) return val;
      const num = Number(val) || 0;
      return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    let horarioCheckin = '12:00';
    let horarioCheckout = '12:00';
    try {
      if (hotelData?.observacoes) {
        const matchCfg = hotelData.observacoes.match(/<!-- HOTEL_CONFIG_JSON:(.*?):END_HOTEL_CONFIG -->/s);
        if (matchCfg && matchCfg[1]) {
          const cfg = JSON.parse(matchCfg[1]);
          if (cfg.checkInHorario) horarioCheckin = cfg.checkInHorario;
          if (cfg.checkOutHorario) horarioCheckout = cfg.checkOutHorario;
        }
      }
    } catch {}

    const tags: TemplateTags = {
      nome_hospede: hospedeNome,
      nome_hotel: hotelData?.nome || hotelData?.name || hotelData?.razao_social || 'Hotel',
      link_hotel: this.getHotelPublicLink(hotelIdToUse),
      numero_quarto: String(dados.numero_quarto || dados.quartoNumero || quartoData?.numero || '101'),
      tipo_quarto: quartoData?.tipo || quartoData?.nome || dados.tipo_quarto || dados.quartoTipo || 'Acomodação',
      checkin: formatarDataBR(dados.data_checkin || dados.checkIn),
      checkout: formatarDataBR(dados.data_checkout || dados.checkOut),
      valor_total: formatarMoedaBR(dados.valor_total || dados.valorTotal),
      horario_checkin: horarioCheckin,
      horario_checkout: horarioCheckout,
      aviso_checkin: `Hoje é o dia do seu check-in no ${hotelData?.nome || 'Hotel'}!`
    };

    return {
      hospedeData,
      quartoData,
      hotelData,
      telefoneDestino,
      hospedeNome,
      hospedeEmail,
      tags
    };
  },

  /**
   * Dispara a confirmação automática de reserva utilizando o template do hotel
   */
  async dispararConfirmacaoAutomatica(
    hotelId: string | undefined,
    dados: any
  ): Promise<{ success: boolean; via?: string; instanceName?: string; error?: string }> {
    try {
      if (!dados) return { success: false, error: 'Dados da reserva não informados' };

      const activeHotelId = hotelId || dados.hotel_id || currentHotelService.getCurrentHotel()?.id;
      const automacoes = this.getHotelAutomacoes(activeHotelId);

      // 1. Verifica se a automação de confirmação está ativada para o hotel
      if (!automacoes.auto_confirmacao) {
        console.info('[templateMensagemService] Automação de confirmação desativada para o hotel:', activeHotelId);
        // Notifica o proprietário mesmo se a confirmação do hóspede estiver desligada
        this.dispararNotificacaoNovaReservaProprietario(activeHotelId, dados).catch(() => {});
        return { success: false, error: 'Automação de confirmação desativada nas configurações do hotel.' };
      }

      // 2. Proteção anti-duplicidade (15 segundos)
      const reservaId = dados.id || `${dados.nome_hospede}_${dados.numero_quarto}_${dados.data_checkin}`;
      const cacheKey = `confirmacao_${reservaId}`;
      const lastSent = this._recentDispatches.get(cacheKey);
      if (lastSent && Date.now() - lastSent < 15000) {
        console.info('[templateMensagemService] Disparo de confirmação ignorado por anti-duplicidade (recente):', cacheKey);
        return { success: true, error: 'Já enviado recentemente' };
      }

      // 3. Resolver dados completos da reserva e do hóspede
      const info = await this.resolverDadosCompletosReserva(dados, activeHotelId);

      if (!info.telefoneDestino) {
        console.warn('[templateMensagemService] Aviso: Telefone do hóspede não encontrado para confirmação.');
        // Notifica o proprietário mesmo se o hóspede não tiver telefone
        this.dispararNotificacaoNovaReservaProprietario(activeHotelId, dados, info.hospedeData).catch(() => {});
        return { success: false, error: 'Telefone do hóspede não encontrado.' };
      }

      // 4. Renderizar template de confirmação
      const mensagem = this.renderTemplate('confirmacao', info.tags, activeHotelId);

      // 5. Disparar via Evolution API pela instância conectada
      console.info(`[templateMensagemService] 🚀 Disparando confirmação para o hóspede ${info.hospedeNome} (${info.telefoneDestino})...`);
      const resultado = await this.enviarMensagemWhatsApp(activeHotelId, info.telefoneDestino, mensagem);

      if (resultado.success) {
        this._recentDispatches.set(cacheKey, Date.now());
        console.info(`[templateMensagemService] ✅ Confirmação enviada com sucesso para ${info.telefoneDestino}`);
      } else {
        console.warn(`[templateMensagemService] ⚠️ Falha ao enviar confirmação para ${info.telefoneDestino}:`, resultado.error);
      }

      // 6. Disparar notificação no WhatsApp do proprietário do hotel
      this.dispararNotificacaoNovaReservaProprietario(activeHotelId, dados, info.hospedeData).catch(pErr => {
        console.warn('[templateMensagemService] Aviso ao notificar proprietário:', pErr);
      });

      return resultado;
    } catch (err: any) {
      console.error('[templateMensagemService] Erro ao disparar confirmação automática:', err);
      return { success: false, error: err?.message || 'Erro inesperado' };
    }
  },

  /**
   * Dispara notificação no WhatsApp do proprietário/administrador do hotel
   * Título: VOCÊ TEM UMA NOVA RESERVA + dados da reserva enviados ao hóspede + valor da reserva
   */
  async dispararNotificacaoNovaReservaProprietario(
    hotelId: string | undefined,
    dados: any,
    guestExtra?: any
  ): Promise<{ success: boolean; via?: string; instanceName?: string; error?: string }> {
    try {
      if (!dados) return { success: false, error: 'Dados da reserva não informados' };

      const activeHotelId = hotelId || dados.hotel_id || currentHotelService.getCurrentHotel()?.id;

      // 1. Proteção anti-duplicidade (15 segundos)
      const reservaId = dados.id || `${dados.nome_hospede}_${dados.numero_quarto}_${dados.data_checkin}`;
      const cacheKey = `notif_proprietario_${reservaId}`;
      const lastSent = this._recentDispatches.get(cacheKey);
      if (lastSent && Date.now() - lastSent < 15000) {
        console.info('[templateMensagemService] Notificação ao proprietário ignorada por anti-duplicidade recente:', cacheKey);
        return { success: true, error: 'Já enviado recentemente ao proprietário' };
      }

      // 2. Obter dados completos da reserva
      const info = await this.resolverDadosCompletosReserva(dados, activeHotelId);
      const hotelData = info.hotelData;

      // 3. Localizar o WhatsApp / Telefone do Proprietário
      let proprietarioPhone =
        hotelData?.telefone_gerente ||
        hotelData?.managerPhone ||
        hotelData?.whatsapp ||
        hotelData?.telefone ||
        '';

      // Se não encontrou no cadastro do hotel, busca nos usuários com perfil de gestão vinculados ao hotel
      if (!proprietarioPhone && activeHotelId) {
        try {
          const { data: users } = await supabase
            .from('usuarios')
            .select('telefone, perfil, nome')
            .eq('hotel_id', activeHotelId)
            .in('perfil', ['Hotel', 'Administrador', 'gerente'])
            .order('criado_em', { ascending: true });
          if (users && users.length > 0) {
            const uWithPhone = users.find((u: any) => u.telefone);
            if (uWithPhone) {
              proprietarioPhone = uWithPhone.telefone;
            }
          }
        } catch (uErr) {
          console.warn('[templateMensagemService] Erro ao buscar telefone de usuários do hotel:', uErr);
        }
      }

      if (!proprietarioPhone) {
        console.warn('[templateMensagemService] ⚠️ WhatsApp do proprietário/gerente não configurado no hotel:', activeHotelId);
        return { success: false, error: 'WhatsApp do proprietário não configurado no hotel.' };
      }

      // Obter horários configurados do hotel ou defaults 14:00 / 12:00
      let horarioCheckin = '14:00';
      let horarioCheckout = '12:00';
      try {
        if (hotelData?.observacoes) {
          const matchCfg = hotelData.observacoes.match(/<!-- HOTEL_CONFIG_JSON:(.*?):END_HOTEL_CONFIG -->/s);
          if (matchCfg && matchCfg[1]) {
            const cfg = JSON.parse(matchCfg[1]);
            if (cfg.checkInHorario) horarioCheckin = cfg.checkInHorario;
            if (cfg.checkOutHorario) horarioCheckout = cfg.checkOutHorario;
          }
        }
      } catch {}

      const nomeProprietario = hotelData?.nome_gerente || hotelData?.proprietario || 'Proprietário';
      const checkinStr = info.tags.checkin || '';
      const checkoutStr = info.tags.checkout || '';
      const valorStr = info.tags.valor_total || 'R$ 0,00';
      const tipoQuarto = info.tags.tipo_quarto || 'Acomodação';
      const numeroQuarto = info.tags.numero_quarto || '101';
      const hospedeNome = info.hospedeNome || 'Hóspede';

      // 4. Montar mensagem oficial conforme especificação
      const mensagemProprietario =
        `Olá ${nomeProprietario}, você tem uma nova reserva\n\n` +
        `📌 Quarto: ${tipoQuarto} (${numeroQuarto})\n` +
        `👤 ${hospedeNome}\n` +
        `📅 Check-in: ${checkinStr} às ${horarioCheckin}\n` +
        `📅 Check-out: ${checkoutStr} às ${horarioCheckout}\n` +
        `💰 Valor Total: ${valorStr}\n\n` +
        `_Esta é uma mensagem automática do sistema, por favor não responder!_`;

      // 5. Disparo via WhatsApp (Evolution API pela instância conectada do hotel)
      console.info(`[templateMensagemService] 🚀 Disparando notificação de nova reserva para o proprietário: ${proprietarioPhone}`);
      const resultado = await this.enviarMensagemWhatsApp(activeHotelId, proprietarioPhone, mensagemProprietario);

      if (resultado.success) {
        this._recentDispatches.set(cacheKey, Date.now());
        console.info(`[templateMensagemService] ✅ Notificação enviada com sucesso ao proprietário (${proprietarioPhone})`);
      } else {
        console.warn(`[templateMensagemService] ⚠️ Falha ao enviar notificação ao proprietário (${proprietarioPhone}):`, resultado.error);
      }

      return resultado;
    } catch (err: any) {
      console.error('[templateMensagemService] Erro ao disparar notificação de nova reserva ao proprietário:', err);
      return { success: false, error: err?.message || 'Erro inesperado' };
    }
  },

  /**
   * Dispara lembrete de check-in automático (exatamente 6h ou 2h antes do check-in)
   */
  async dispararLembreteCheckinAutomatico(
    hotelId: string | undefined,
    dados: any,
    tipoAntecedencia: '6h' | '2h' = '6h'
  ): Promise<{ success: boolean; via?: string; instanceName?: string; error?: string }> {
    try {
      if (!dados) return { success: false, error: 'Dados não informados' };
      const activeHotelId = hotelId || dados.hotel_id || currentHotelService.getCurrentHotel()?.id;
      const automacoes = this.getHotelAutomacoes(activeHotelId);

      if (!automacoes.auto_lembrete_checkin) {
        return { success: false, error: 'Automação de lembrete de check-in desativada' };
      }

      // Verificação de segurança no banco de dados para evitar qualquer duplicidade
      const tagBanco = tipoAntecedencia === '6h'
        ? '<!-- LEMBRETE_CHECKIN_6H_ENVIADO:true -->'
        : '<!-- LEMBRETE_CHECKIN_2H_ENVIADO:true -->';

      const observacoesAtuais = String(dados.observacoes || '');
      if (observacoesAtuais.includes(tagBanco)) {
        return { success: true, error: `Lembrete ${tipoAntecedencia} já registrado no banco` };
      }

      // Proteção anti-duplicidade em memória (2 horas)
      const reservaId = dados.id || `${dados.nome_hospede}_${dados.numero_quarto}_lembrete_${tipoAntecedencia}`;
      const cacheKey = `lembrete_checkin_${tipoAntecedencia}_${reservaId}`;
      const lastSent = this._recentDispatches.get(cacheKey);
      if (lastSent && Date.now() - lastSent < 2 * 60 * 60 * 1000) {
        return { success: true, error: `Lembrete ${tipoAntecedencia} já enviado recentemente` };
      }

      const info = await this.resolverDadosCompletosReserva(dados, activeHotelId);
      if (!info.telefoneDestino) {
        console.warn('[templateMensagemService] ⚠️ Telefone do hóspede não encontrado para lembrete de check-in.');
        return { success: false, error: 'Telefone do hóspede não encontrado.' };
      }

      // Frase contextualizada conforme a janela de antecedência (6h ou 2h antes)
      const avisoCheckin = tipoAntecedencia === '6h'
        ? `Hoje é o dia do seu check-in no ${info.tags.nome_hotel} (faltam cerca de 6 horas)!`
        : `Faltam apenas 2 horas para o início do seu check-in no ${info.tags.nome_hotel}!`;

      info.tags.aviso_checkin = avisoCheckin;
      info.tags.frase_tempo = avisoCheckin;

      let mensagem = this.renderTemplate('lembrete_checkin', info.tags, activeHotelId);

      // Substitui frases antigas como "Amanhã é o dia do seu check-in" pela frase correta do dia
      if (mensagem.includes('Amanhã é o dia do seu check-in')) {
        mensagem = mensagem.replace(/Amanhã é o dia do seu check-in no [^!]+!/gi, avisoCheckin);
      }

      // Garante sempre o rodapé obrigatório
      const rodapeObrigatorio = '_Esta é uma mensagem automática do sistema, por favor não responder!_';
      if (!mensagem.includes('Esta é uma mensagem automática do sistema, por favor não responder!')) {
        mensagem = `${mensagem.trim()}\n\n${rodapeObrigatorio}`;
      }

      console.info(`[templateMensagemService] 🚀 Disparando lembrete de check-in (${tipoAntecedencia}) para ${info.telefoneDestino}...`);
      const resultado = await this.enviarMensagemWhatsApp(activeHotelId, info.telefoneDestino, mensagem);

      if (resultado.success) {
        this._recentDispatches.set(cacheKey, Date.now());

        // Grava tag permanente no Supabase para nunca mais reenviar este lembrete para esta reserva
        if (dados.id) {
          try {
            const novasObservacoes = `${observacoesAtuais} ${tagBanco}`.trim();
            await supabase.from('reservas').update({ observacoes: novasObservacoes }).eq('id', dados.id);
            dados.observacoes = novasObservacoes;
          } catch (dbErr) {
            console.warn('[templateMensagemService] Erro ao gravar tag de lembrete no banco:', dbErr);
          }
        }

        console.info(`[templateMensagemService] ✅ Lembrete de check-in (${tipoAntecedencia}) enviado com sucesso para ${info.telefoneDestino}`);
      } else {
        console.warn(`[templateMensagemService] ⚠️ Falha ao enviar lembrete de check-in (${tipoAntecedencia}) para ${info.telefoneDestino}:`, resultado.error);
      }

      return resultado;
    } catch (err: any) {
      console.error('[templateMensagemService] Erro ao disparar lembrete de check-in:', err);
      return { success: false, error: err?.message || 'Erro inesperado' };
    }
  },

  /**
   * Dispara mensagem pós check-out automática
   */
  async dispararCheckoutAutomatico(
    hotelId: string | undefined,
    dados: any
  ): Promise<{ success: boolean; via?: string; instanceName?: string; error?: string }> {
    try {
      if (!dados) return { success: false, error: 'Dados não informados' };
      const activeHotelId = hotelId || dados.hotel_id || currentHotelService.getCurrentHotel()?.id;
      const automacoes = this.getHotelAutomacoes(activeHotelId);

      if (!automacoes.auto_checkout) {
        console.info('[templateMensagemService] Automação de pós checkout desativada');
        return { success: false, error: 'Automação de pós checkout desativada' };
      }

      // Proteção anti-duplicidade (30 segundos)
      const reservaId = dados.id || `${dados.nome_hospede}_${dados.numero_quarto}_checkout`;
      const cacheKey = `checkout_${reservaId}`;
      const lastSent = this._recentDispatches.get(cacheKey);
      if (lastSent && Date.now() - lastSent < 30000) {
        console.info('[templateMensagemService] Pós checkout ignorado por anti-duplicidade recente:', cacheKey);
        return { success: true, error: 'Já enviado recentemente' };
      }

      const info = await this.resolverDadosCompletosReserva(dados, activeHotelId);
      if (!info.telefoneDestino) {
        console.warn('[templateMensagemService] ⚠️ Telefone do hóspede não encontrado para pós checkout:', dados);
        return { success: false, error: 'Telefone do hóspede não encontrado.' };
      }

      const mensagem = this.renderTemplate('checkout', info.tags, activeHotelId);
      console.info(`[templateMensagemService] 🚀 Disparando pós-checkout para ${info.hospedeNome} (${info.telefoneDestino})...`);
      const resultado = await this.enviarMensagemWhatsApp(activeHotelId, info.telefoneDestino, mensagem);

      if (resultado.success) {
        this._recentDispatches.set(cacheKey, Date.now());
        console.info(`[templateMensagemService] ✅ Pós-checkout enviado com sucesso para ${info.telefoneDestino}`);
      } else {
        console.warn(`[templateMensagemService] ⚠️ Falha ao enviar pós-checkout para ${info.telefoneDestino}:`, resultado.error);
      }

      return resultado;
    } catch (err: any) {
      console.error('[templateMensagemService] Erro ao disparar pós checkout:', err);
      return { success: false, error: err?.message || 'Erro inesperado' };
    }
  },

  // Throttle para executar varredura no máximo uma vez a cada 5 minutos por sessão
  _ultimoScanCheckin: 0,

  /**
   * Varre as reservas e dispara exatamente 2 mensagens automáticas:
   * 1. Lembrete de 6 horas antes do check-in
   * 2. Lembrete de 2 horas antes do check-in
   * Nunca dispara repetido nem antes de 6h ou após o check-in.
   */
  async verificarEDispararLembretesCheckinDoDia(hotelId?: string): Promise<number> {
    try {
      const now = Date.now();
      if (now - this._ultimoScanCheckin < 5 * 60 * 1000) {
        return 0;
      }
      this._ultimoScanCheckin = now;

      const activeHotelId = hotelId || currentHotelService.getCurrentHotel()?.id;
      if (!activeHotelId) return 0;

      const automacoes = this.getHotelAutomacoes(activeHotelId);
      if (!automacoes.auto_lembrete_checkin) return 0;

      const fuso = automacoes.fuso_horario || 'America/Cuiaba';
      const hojeIso = this.getDataStringNoFuso(fuso);
      const amanhaIso = this.getDataAmanhaNoFuso(fuso);

      // Consulta reservas ativas/confirmadas para hoje ou amanhã
      const { data: reservas, error } = await supabase
        .from('reservas')
        .select('*')
        .eq('hotel_id', activeHotelId)
        .in('status', ['Confirmada', 'confirmada', 'Ativa', 'ativa', 'Pendente', 'pendente'])
        .or(`data_checkin.ilike.%${hojeIso}%,data_checkin.ilike.%${amanhaIso}%`);

      if (error || !reservas || reservas.length === 0) return 0;

      let disparados = 0;
      for (const res of reservas) {
        const obs = String(res.observacoes || '');
        const horarioCheckin = '12:00';
        const diffHours = calcularHorasAteCheckin(res.data_checkin, horarioCheckin, fuso);

        // 1ª MENSAGEM: Janela de 6 horas antes (entre 6h e 2h antes)
        if (diffHours <= 6 && diffHours > 2) {
          if (!obs.includes('LEMBRETE_CHECKIN_6H_ENVIADO')) {
            const resultado = await this.dispararLembreteCheckinAutomatico(activeHotelId, res, '6h');
            if (resultado.success) disparados++;
          }
        }
        // 2ª MENSAGEM: Janela de 2 horas antes (entre 2h e 0h antes)
        else if (diffHours <= 2 && diffHours >= 0) {
          if (!obs.includes('LEMBRETE_CHECKIN_2H_ENVIADO')) {
            const resultado = await this.dispararLembreteCheckinAutomatico(activeHotelId, res, '2h');
            if (resultado.success) disparados++;
          }
        }
      }
      return disparados;
    } catch (err) {
      console.warn('[templateMensagemService] Erro ao verificar lembretes de check-in:', err);
      return 0;
    }
  },

  /**
   * Gera o link direto para abertura no WhatsApp Web / App
   */
  gerarLinkWhatsAppWeb(telefoneDestino: string, mensagem: string): string {
    let clean = telefoneDestino.replace(/\D/g, '');
    if (clean.length === 10 || clean.length === 11) {
      clean = `55${clean}`;
    }
    return `https://wa.me/${clean}?text=${encodeURIComponent(mensagem)}`;
  }
};

export default templateMensagemService;
