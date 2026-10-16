/**
 * disparadorGoogleService.ts
 * Motor de prospecção e envio inteligente de WhatsApp com tecnologia Antibloqueio
 * para hotéis importados do Google Maps.
 */

import { supabase } from '../lib/supabase';
import { evolutionApiService } from './evolutionApiService';

export interface HotelGoogleItem {
  id: string;
  nome: string;
  cidade: string;
  uf: string;
  bairro?: string;
  rawPhone: string;
  cleanPhone: string;
  isMobile: boolean;
  phoneStatus: 'valido_whatsapp' | 'fixo' | 'invalido';
  alreadySent: boolean;
  lastSentAt?: string;
  lastStatus?: 'sucesso' | 'erro';
  observacoes?: string;
}

export interface DisparoLog {
  hotelId: string;
  hotelNome: string;
  cidade: string;
  telefone: string;
  mensagem: string;
  enviadoEm: string;
  status: 'sucesso' | 'erro';
  erro?: string;
}

export interface CampanhaConfig {
  instanceName: string;
  limiteDiario: number;
  intervaloMinSegundos: number;
  intervaloMaxSegundos: number;
  simularDigitando: boolean;
  tempoDigitandoSegundos: number;
  apenasCelulares: boolean;
  ignorarJaContatados: boolean;
  cidadeFiltro?: string;
  pausaAposLoteQtd: number;
  pausaLoteMinutos: number;
}

export const TEMPLATES_DISPARO_PADRAO = [
  {
    id: 'recepcao-amiga',
    nome: '1. Recepção Amiga (Máxima Segurança & Resposta Rápida)',
    descricao: 'Pergunta curta sobre a recepção. Praticamente zero risco de denúncia. A resposta do hotel abre o canal limpo para apresentação.',
    texto: '{Olá|Oi|Bom dia}, {tudo bem|como vai}? É da recepção do {nome_hotel} em {cidade}?'
  },
  {
    id: 'vagas-abertas',
    nome: '2. Disponibilidade de Quartos (Curiosidade Natural)',
    descricao: 'Simula interesse legítimo de estadia. O recepcionista sempre responde educadamente.',
    texto: '{Olá|Oi|Bom dia}, pessoal do {nome_hotel}! {Vi o contato de vocês no Google|Encontrei o hotel de vocês no Google em {cidade}}. Vocês estão com quartos disponíveis para este mês?'
  },
  {
    id: 'cortesia-60dias',
    nome: '3. Cortesia 60 Dias do Super Agente (Apresentação Direta)',
    descricao: 'Abordagem profissional oferecendo os 60 dias de degustação gratuita do Super Agente IA.',
    texto: '{Olá|Oi|Bom dia}, equipe do {nome_hotel}! Me chamo Everaldo, sou fundador do Hotel no Zap aqui no MT. Vimos o hotel de vocês em {cidade} e separamos uma cortesia de 60 dias do Super Agente IA para atender hóspedes no WhatsApp. Posso te enviar o acesso de teste sem custo?'
  }
];

const STORAGE_KEY_LOGS = 'hotelnozap_disparos_google_logs_v1';
const STORAGE_KEY_DAILY = 'hotelnozap_disparos_google_daily_v1';

export const disparadorGoogleService = {
  /**
   * Resolve e formata telefone brasileiro (com detecção de fixo vs celular WhatsApp)
   */
  resolvePhone(raw: string): {
    isValid: boolean;
    isMobile: boolean;
    formatted: string;
    cleanPhone: string;
    phoneStatus: 'valido_whatsapp' | 'fixo' | 'invalido';
  } {
    if (!raw) {
      return { isValid: false, isMobile: false, formatted: '', cleanPhone: '', phoneStatus: 'invalido' };
    }

    let digits = raw.replace(/\D/g, '');
    // Remove 55 inicial se já tiver
    if (digits.startsWith('55') && digits.length >= 12) {
      digits = digits.slice(2);
    }

    // Celular BR com 11 dígitos: DDD (2) + 9 + 8 dígitos
    if (digits.length === 11 && digits[2] === '9') {
      const ddd = digits.slice(0, 2);
      const parte1 = digits.slice(2, 7);
      const parte2 = digits.slice(7);
      return {
        isValid: true,
        isMobile: true,
        formatted: `(${ddd}) ${parte1}-${parte2}`,
        cleanPhone: `55${digits}`,
        phoneStatus: 'valido_whatsapp'
      };
    }

    // Telefone Fixo BR com 10 dígitos: DDD (2) + 8 dígitos (começando com 2, 3, 4, 5)
    if (digits.length === 10) {
      const ddd = digits.slice(0, 2);
      const parte1 = digits.slice(2, 6);
      const parte2 = digits.slice(6);
      return {
        isValid: true,
        isMobile: false,
        formatted: `(${ddd}) ${parte1}-${parte2}`,
        cleanPhone: `55${digits}`,
        phoneStatus: 'fixo'
      };
    }

    return {
      isValid: digits.length >= 10,
      isMobile: false,
      formatted: raw,
      cleanPhone: digits.length >= 10 ? `55${digits}` : '',
      phoneStatus: 'invalido'
    };
  },

  /**
   * Resolução de Spintax dinâmico: {Olá|Oi|Bom dia} -> sorteia uma opção
   * e substitui variáveis como {nome_hotel}, {cidade}, {uf}
   */
  parseSpintax(template: string, hotel: HotelGoogleItem): string {
    let result = template;

    // Resolve blocos Spintax {a|b|c}
    const spintaxRegex = /\{([^{}]+)\}/g;
    let match;
    while ((match = spintaxRegex.exec(result)) !== null) {
      const fullMatch = match[0];
      const optionsStr = match[1];
      if (optionsStr.includes('|')) {
        const options = optionsStr.split('|');
        const chosen = options[Math.floor(Math.random() * options.length)].trim();
        result = result.replace(fullMatch, chosen);
        spintaxRegex.lastIndex = 0; // reinicia busca para suportar múltiplos
      }
    }

    // Substitui variáveis do hotel
    const primeiroNome = (hotel.nome || '').split(' ')[0] || hotel.nome;
    result = result
      .replace(/\{nome_hotel\}/gi, hotel.nome.trim())
      .replace(/\{primeiro_nome_hotel\}/gi, primeiroNome.trim())
      .replace(/\{cidade\}/gi, hotel.cidade.trim())
      .replace(/\{uf\}/gi, (hotel.uf || 'MT').toUpperCase())
      .replace(/\{bairro\}/gi, (hotel.bairro || '').trim());

    return result.trim();
  },

  /**
   * Busca hotéis do Google Maps no Supabase
   */
  async getHoteisGoogle(): Promise<HotelGoogleItem[]> {
    try {
      const { data, error } = await supabase
        .from('hoteis')
        .select('id, nome, telefone_gerente, whatsapp, cidade, uf, bairro, plano, observacoes, criado_em')
        .or('plano.ilike.%maps%,plano.ilike.%google%,observacoes.ilike.%google%,observacoes.ilike.%places%')
        .order('nome', { ascending: true });

      if (error) {
        console.warn('[Disparador] Erro ao buscar hotéis do Google:', error);
        return [];
      }

      const historyMap = this.getSendHistoryMap();

      return (data || []).map((h: any) => {
        const rawPhone = h.telefone_gerente || h.whatsapp || '';
        const phoneInfo = this.resolvePhone(rawPhone);
        const history = historyMap[h.id];

        return {
          id: h.id,
          nome: h.nome || 'Hotel sem nome',
          cidade: h.cidade || 'Não informada',
          uf: h.uf || 'MT',
          bairro: h.bairro || '',
          rawPhone,
          cleanPhone: phoneInfo.cleanPhone,
          isMobile: phoneInfo.isMobile,
          phoneStatus: phoneInfo.phoneStatus,
          alreadySent: Boolean(history && history.status === 'sucesso'),
          lastSentAt: history?.enviadoEm,
          lastStatus: history?.status,
          observacoes: h.observacoes || ''
        };
      });
    } catch (err) {
      console.error('[Disparador] Erro na consulta:', err);
      return [];
    }
  },

  /**
   * Mapa de histórico de envios locais
   */
  getSendHistoryMap(): Record<string, DisparoLog> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LOGS);
      if (!raw) return {};
      const list: DisparoLog[] = JSON.parse(raw);
      const map: Record<string, DisparoLog> = {};
      list.forEach(l => {
        map[l.hotelId] = l;
      });
      return map;
    } catch {
      return {};
    }
  },

  /**
   * Salva envio no histórico
   */
  recordSendLog(log: DisparoLog): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LOGS);
      const list: DisparoLog[] = raw ? JSON.parse(raw) : [];
      list.unshift(log); // mais recente primeiro
      // Limita a 1000 registros para não estourar storage
      if (list.length > 1000) list.length = 1000;
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(list));
      this.incrementDailySent();

      // Também registra na observação do hotel no Supabase (não bloqueante)
      try {
        const notaDisparo = `\n[DISPARO_GOOGLE: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')} - ${log.status === 'sucesso' ? 'ENVIADO' : 'ERRO'}]`;
        supabase.from('hoteis').select('observacoes').eq('id', log.hotelId).single().then(({ data }) => {
          const obsAtual = data?.observacoes || '';
          if (!obsAtual.includes('[DISPARO_GOOGLE:')) {
            supabase.from('hoteis').update({ observacoes: obsAtual + notaDisparo }).eq('id', log.hotelId).then(() => {});
          }
        });
      } catch { /* ignore */ }
    } catch (err) {
      console.warn('[Disparador] Erro ao gravar log:', err);
    }
  },

  /**
   * Controle da Cota Diária (ex: 30 disparos/dia)
   */
  getDailySentCount(): number {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DAILY);
      if (!raw) return 0;
      const data = JSON.parse(raw);
      const today = new Date().toISOString().split('T')[0];
      if (data.date === today) {
        return Number(data.count) || 0;
      }
      return 0;
    } catch {
      return 0;
    }
  },

  incrementDailySent(): number {
    try {
      const today = new Date().toISOString().split('T')[0];
      const count = this.getDailySentCount() + 1;
      localStorage.setItem(STORAGE_KEY_DAILY, JSON.stringify({ date: today, count }));
      return count;
    } catch {
      return 1;
    }
  },

  /**
   * Envia uma mensagem individual para o hotel via Evolution API
   */
  async sendSingleMessage(
    instanceName: string,
    hotel: HotelGoogleItem,
    message: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!hotel.cleanPhone) {
      return { success: false, error: 'Telefone inválido para envio via WhatsApp.' };
    }

    try {
      const res = await evolutionApiService.sendTextMessageDetailed(
        instanceName,
        hotel.cleanPhone,
        message
      );

      const log: DisparoLog = {
        hotelId: hotel.id,
        hotelNome: hotel.nome,
        cidade: hotel.cidade,
        telefone: hotel.cleanPhone,
        mensagem: message,
        enviadoEm: new Date().toISOString(),
        status: res.success ? 'sucesso' : 'erro',
        erro: res.error
      };

      this.recordSendLog(log);

      return {
        success: res.success,
        error: res.error
      };
    } catch (err: any) {
      const log: DisparoLog = {
        hotelId: hotel.id,
        hotelNome: hotel.nome,
        cidade: hotel.cidade,
        telefone: hotel.cleanPhone,
        mensagem: message,
        enviadoEm: new Date().toISOString(),
        status: 'erro',
        erro: err?.message || 'Falha de conexão com Evolution API'
      };
      this.recordSendLog(log);

      return {
        success: false,
        error: err?.message || 'Erro inesperado ao enviar mensagem.'
      };
    }
  },

  /**
   * Retorna os últimos logs de envio
   */
  getRecentLogs(limit: number = 50): DisparoLog[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LOGS);
      if (!raw) return [];
      const list: DisparoLog[] = JSON.parse(raw);
      return list.slice(0, limit);
    } catch {
      return [];
    }
  },

  /**
   * Limpa o histórico de envios locais
   */
  clearLogs(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_LOGS);
    } catch { /* ignore */ }
  }
};
export default disparadorGoogleService;
