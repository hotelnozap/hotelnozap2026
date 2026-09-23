/**
 * templateMensagemService.ts
 * Serviço para gerenciamento, interpolação e disparo de templates de mensagens WhatsApp
 * Conecta os templates definidos em Parâmetros do Sistema à Evolution API v2.3.0
 */

import { evolutionApiService } from './evolutionApiService';
import { currentHotelService } from './supabaseService';
import { supabase } from '../lib/supabase';
import { formatPhoneEvolution } from '../utils/masks';

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
    'Olá {nome_hospede}! 😉\nSeja Bem-vindo(a) ao {nome_hotel}. 🫡\n\nPara consultar fotos das acomodações, valores de diárias atualizados e realizar a sua reserva com confirmação imediata, acesse o nosso link oficial:\n\n👉 {link_hotel}\n\n⚠️ É necessário entrar no link acima para verificar a disponibilidade de quartos, simular os preços para as suas datas e garantir sua reserva. Caso tenha qualquer dúvida, estamos à disposição por aqui!',
  confirmacao:
    '🎉 Parabéns {nome_hospede}! Sua reserva no {nome_hotel} foi confirmada com sucesso! 🏨\n\n📌 Quarto: {tipo_quarto} ({numero_quarto})\n📅 Check-in: {checkin}\n📅 Check-out: {checkout}\n💰 Valor Total: {valor_total}\n\nEstamos ansiosos para recebê-lo(a)!',
  lembrete_checkin:
    'Olá {nome_hospede}! Amanhã é o dia do seu check-in no {nome_hotel}! 🧳\n\nHorário de entrada: a partir das 14:00.\nLocalização: recepção central.\n\nSe precisar antecipar sua chegada ou tiver alguma dúvida, basta responder aqui!',
  checkout:
    'Olá {nome_hospede}! Esperamos que sua estadia no {nome_hotel} tenha sido maravilhosa! ✨\n\nAgradecemos muito pela preferência. Foi um prazer recebê-lo(a). Poderia nos avaliar com 5 estrelas no Google Maps? Até a próxima viagem!',
  pix:
    'Olá {nome_hospede}! Para garantir sua reserva no {nome_hotel}, segue a chave PIX para pagamento:\n\n🔑 Chave PIX: {chave_pix}\n💰 Valor: {valor_total}\n\nAssim que efetuar o pagamento, nos envie o comprovante por aqui para confirmação imediata!'
};

export interface AutomacoesConfig {
  auto_boas_vindas: boolean;
  auto_confirmacao: boolean;
  auto_lembrete_checkin: boolean;
  auto_checkout: boolean;
  fuso_horario: 'America/Cuiaba' | 'America/Sao_Paulo';
}

export const AUTOMACOES_PADRAO: AutomacoesConfig = {
  auto_boas_vindas: true,
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
      return { ...AUTOMACOES_PADRAO };
    }
    try {
      const saved = localStorage.getItem(`hotelnozap_automacoes_hotel_${activeHotelId}`);
      if (saved) {
        return { ...AUTOMACOES_PADRAO, ...JSON.parse(saved) };
      }
    } catch {}
    return { ...AUTOMACOES_PADRAO };
  },

  /**
   * Salva as configurações de automação de disparo do hotel
   */
  saveHotelAutomacoes(hotelId: string, config: Partial<AutomacoesConfig>): void {
    if (!hotelId || typeof window === 'undefined') return;
    try {
      const current = this.getHotelAutomacoes(hotelId);
      const updated = { ...current, ...config };
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

      const cleanSlug = (hotelLink && hotelLink.startsWith('/hoteis/'))
        ? hotelLink.replace('/hoteis/', '')
        : (hotelName
            ? hotelName
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)+/g, '')
            : 'hotel');

      let domain = 'https://app.hotelnozap.com.br';
      if (typeof window !== 'undefined' && window.location && window.location.origin) {
        domain = window.location.origin;
      }

      return `${domain}/hoteis/${cleanSlug}`;
    } catch {
      return typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/hoteis/hotel`
        : 'https://app.hotelnozap.com.br/hoteis/hotel';
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
    return this.interpolarTemplate(text, tags, hotelId);
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

      // 3. Fallback: Qualquer instância conectada no servidor (ex: meutim)
      const anyOpen = evoList.find((inst) => inst.connectionStatus === 'open');
      if (anyOpen) {
        return {
          instanceName: anyOpen.name,
          status: 'open',
          isOnline: true
        };
      }

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

      if (!instInfo.isOnline || !instInfo.instanceName) {
        console.warn('[templateMensagemService] Nenhuma instância conectada encontrada para o hotel:', activeHotelId);
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
          instanceName: instInfo.instanceName,
          error: 'Número de telefone inválido para o WhatsApp.'
        };
      }

      const res = await evolutionApiService.sendTextMessageDetailed(
        instInfo.instanceName,
        cleanPhone,
        mensagem
      );

      if (res.success) {
        console.info(`[templateMensagemService] ✅ Mensagem enviada com sucesso para ${cleanPhone} via instância ${instInfo.instanceName}`);
        return {
          success: true,
          via: 'evolution_api',
          instanceName: instInfo.instanceName
        };
      } else {
        console.error(`[templateMensagemService] ❌ Erro ao enviar mensagem para ${cleanPhone} via ${instInfo.instanceName}:`, res.error);
        return {
          success: false,
          via: 'evolution_api',
          instanceName: instInfo.instanceName,
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
    try {
      if (!dados) return { success: false, error: 'Dados não informados' };

      const activeHotelId = hotelId || dados.hotel_id || currentHotelService.getCurrentHotel()?.id;
      const automacoes = this.getHotelAutomacoes(activeHotelId);

      // 1. Verifica se a automação de boas-vindas está ativada para o hotel
      if (!automacoes.auto_boas_vindas) {
        console.info('[templateMensagemService] Automação de boas-vindas desativada para o hotel:', activeHotelId);
        return { success: false, error: 'Automação de boas-vindas desativada nas configurações do hotel.' };
      }

      // 2. Determinar telefone de destino
      const telefoneDestino =
        dados.telefone ||
        dados.telefone_hospede ||
        dados.hospedeTelefone ||
        dados.phone ||
        dados.contato?.telefone ||
        dados.cliente?.telefone ||
        '';

      if (!telefoneDestino) {
        console.warn('[templateMensagemService] Aviso: Telefone não informado para boas-vindas.');
        return { success: false, error: 'Telefone do hóspede não informado.' };
      }

      const cleanPhone = formatPhoneEvolution(telefoneDestino);
      if (!cleanPhone) {
        return { success: false, error: 'Número de telefone inválido para o WhatsApp.' };
      }

      // Proteção anti-duplicidade COMPARTILHADA (5 minutos) via localStorage.
      // Compartilhada com whatsappAutoResponderService para evitar duplo envio.
      if (this._checkRecentDispatch(cleanPhone, activeHotelId)) {
        console.info('[templateMensagemService] Boas-vindas já enviadas recentemente para este número (cache compartilhado):', cleanPhone);
        return { success: true, error: 'Já enviado recentemente' };
      }

      // Marca ANTES de enviar para evitar race condition com AutoResponder
      this._markRecentDispatch(cleanPhone, activeHotelId);

      // 3. Obter dados do Hotel
      let hotelData: any = null;
      if (activeHotelId) {
        try {
          const { data: hDb } = await supabase
            .from('hoteis')
            .select('*')
            .eq('id', activeHotelId)
            .maybeSingle();
          if (hDb) hotelData = hDb;
        } catch (e) {
          console.warn('[templateMensagemService] Erro ao buscar hotel:', e);
        }
      }
      if (!hotelData) {
        hotelData = currentHotelService.getCurrentHotel();
      }

      // 4. Montar Tags
      const tags: TemplateTags = {
        nome_hospede: dados.nome_hospede || dados.nome || dados.name || dados.contato?.nome || dados.cliente?.nome || '',
        nome_hotel: hotelData?.name || hotelData?.nome || hotelData?.razao_social || 'Hotel',
        link_hotel: this.getHotelPublicLink(activeHotelId)
      };

      // 5. Renderizar Template de Boas-Vindas
      const mensagem = this.renderTemplate('boas_vindas', tags, activeHotelId);

      // 6. Enviar diretamente via Evolution API pela instância conectada
      const resultado = await this.enviarMensagemWhatsApp(activeHotelId, cleanPhone, mensagem);

      if (!resultado.success) {
        // Se falhou, remove do cache para permitir nova tentativa
        const key = `${activeHotelId || 'default'}_${cleanPhone}`;
        const cache = this._readDispatchCache();
        delete cache[key];
        this._writeDispatchCache(cache);
      }

      return resultado;
    } catch (err: any) {
      console.error('[templateMensagemService] Erro ao disparar boas-vindas automáticas:', err);
      return { success: false, error: err?.message || 'Erro inesperado' };
    }
  },

  /**
   * Alias para dispararAtendimentoAutomatico (Início de Atendimento)
   */
  async dispararAtendimentoAutomatico(hotelId: string | undefined, dados: any) {
    return this.dispararBoasVindasAutomatica(hotelId, dados);
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

      // 3. Obter dados do Hotel
      let hotelData: any = null;
      if (activeHotelId) {
        try {
          const { data: hDb } = await supabase
            .from('hoteis')
            .select('*')
            .eq('id', activeHotelId)
            .maybeSingle();
          if (hDb) hotelData = hDb;
        } catch (e) {
          console.warn('[templateMensagemService] Erro ao buscar hotel:', e);
        }
      }
      if (!hotelData) {
        hotelData = currentHotelService.getCurrentHotel();
      }

      // 4. Obter dados do Hóspede (especialmente telefone)
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
          console.warn('[templateMensagemService] Erro ao buscar hóspede por ID:', e);
        }
      }

      if (!hospedeData && dados.nome_hospede && activeHotelId) {
        try {
          const { data: gDb } = await supabase
            .from('hospedes')
            .select('*')
            .eq('hotel_id', activeHotelId)
            .ilike('nome', dados.nome_hospede)
            .limit(1)
            .maybeSingle();
          if (gDb) hospedeData = gDb;
        } catch (e) {
          console.warn('[templateMensagemService] Erro ao buscar hóspede por nome:', e);
        }
      }

      // 5. Obter dados do Quarto
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
      if (!quartoData && dados.numero_quarto && activeHotelId) {
        try {
          const { data: qDb } = await supabase
            .from('quartos')
            .select('*')
            .eq('hotel_id', activeHotelId)
            .eq('numero', String(dados.numero_quarto))
            .maybeSingle();
          if (qDb) quartoData = qDb;
        } catch {}
      }

      // 6. Determinar telefone de destino
      const telefoneDestino =
        hospedeData?.telefone ||
        hospedeData?.whatsapp ||
        hospedeData?.celular ||
        dados.telefone_hospede ||
        dados.hospedeTelefone ||
        dados.telefone ||
        '';

      if (!telefoneDestino) {
        console.warn('[templateMensagemService] Aviso: Telefone do hóspede não encontrado para confirmação.');
        return { success: false, error: 'Telefone do hóspede não encontrado.' };
      }

      // Formatação amigável de datas e moeda
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

      const tags: TemplateTags = {
        nome_hospede: dados.nome_hospede || dados.hospedeNome || hospedeData?.nome || '',
        nome_hotel: hotelData?.name || hotelData?.razao_social || 'Hotel',
        link_hotel: this.getHotelPublicLink(activeHotelId),
        numero_quarto: String(dados.numero_quarto || quartoData?.numero || '101'),
        tipo_quarto: quartoData?.tipo || quartoData?.nome || dados.tipo_quarto || dados.quartoTipo || 'Acomodação',
        checkin: formatarDataBR(dados.data_checkin || dados.checkIn),
        checkout: formatarDataBR(dados.data_checkout || dados.checkOut),
        valor_total: formatarMoedaBR(dados.valor_total || dados.valorTotal)
      };

      // 7. Renderizar template de confirmação
      const mensagem = this.renderTemplate('confirmacao', tags, activeHotelId);

      // 8. Disparar via Evolution API pela instância conectada
      const resultado = await this.enviarMensagemWhatsApp(activeHotelId, telefoneDestino, mensagem);

      if (resultado.success) {
        this._recentDispatches.set(cacheKey, Date.now());
      }

      return resultado;
    } catch (err: any) {
      console.error('[templateMensagemService] Erro ao disparar confirmação automática:', err);
      return { success: false, error: err?.message || 'Erro inesperado' };
    }
  },

  /**
   * Dispara lembrete de check-in automático
   */
  async dispararLembreteCheckinAutomatico(
    hotelId: string | undefined,
    dados: any
  ): Promise<{ success: boolean; instanceName?: string; error?: string }> {
    try {
      if (!dados) return { success: false, error: 'Dados não informados' };
      const activeHotelId = hotelId || dados.hotel_id || currentHotelService.getCurrentHotel()?.id;
      const automacoes = this.getHotelAutomacoes(activeHotelId);

      if (!automacoes.auto_lembrete_checkin) {
        return { success: false, error: 'Automação de lembrete de check-in desativada' };
      }

      const telefoneDestino = dados.telefone_hospede || dados.hospedeTelefone || dados.telefone || '';
      if (!telefoneDestino) return { success: false, error: 'Telefone não informado' };

      const tags: TemplateTags = {
        nome_hospede: dados.nome_hospede || dados.hospedeNome || '',
        nome_hotel: dados.nome_hotel || currentHotelService.getCurrentHotel()?.name || 'Hotel',
        link_hotel: this.getHotelPublicLink(activeHotelId),
        numero_quarto: String(dados.numero_quarto || '101'),
        checkin: dados.data_checkin || dados.checkIn || ''
      };

      const mensagem = this.renderTemplate('lembrete_checkin', tags, activeHotelId);
      return await this.enviarMensagemWhatsApp(activeHotelId, telefoneDestino, mensagem);
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro inesperado' };
    }
  },

  /**
   * Dispara mensagem pós check-out automática
   */
  async dispararCheckoutAutomatico(
    hotelId: string | undefined,
    dados: any
  ): Promise<{ success: boolean; instanceName?: string; error?: string }> {
    try {
      if (!dados) return { success: false, error: 'Dados não informados' };
      const activeHotelId = hotelId || dados.hotel_id || currentHotelService.getCurrentHotel()?.id;
      const automacoes = this.getHotelAutomacoes(activeHotelId);

      if (!automacoes.auto_checkout) {
        return { success: false, error: 'Automação de pós checkout desativada' };
      }

      const telefoneDestino = dados.telefone_hospede || dados.hospedeTelefone || dados.telefone || '';
      if (!telefoneDestino) return { success: false, error: 'Telefone não informado' };

      const tags: TemplateTags = {
        nome_hospede: dados.nome_hospede || dados.hospedeNome || '',
        nome_hotel: dados.nome_hotel || currentHotelService.getCurrentHotel()?.name || 'Hotel',
        link_hotel: this.getHotelPublicLink(activeHotelId)
      };

      const mensagem = this.renderTemplate('checkout', tags, activeHotelId);
      return await this.enviarMensagemWhatsApp(activeHotelId, telefoneDestino, mensagem);
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro inesperado' };
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
