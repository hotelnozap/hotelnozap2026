/**
 * autoCheckoutService.ts
 * Motor Centralizado de Check-out Automático às 07:00 no fuso horário do hotel.
 * 
 * Regra de Negócio:
 * - Às 07:00 da manhã (ou horário superior) na data prevista de check-out, ou se a data
 *   já estiver expirada (dias anteriores), de acordo com a timezone escolhida para o hotel
 *   (padrão: America/Cuiaba GMT-4, ou America/Sao_Paulo GMT-3):
 *   1. O status da reserva com hóspede 'Hospedado' é alterado para 'Concluída'.
 *   2. O status do quarto é alterado automaticamente de 'ocupado' para 'limpeza'.
 *   3. Lança alerta em tempo real para governança/recepção via BroadcastChannel e CustomEvents.
 *   4. Registra no caixa do dia como reserva concluída.
 *   5. Dispara mensagem de agradecimento pós-checkout no WhatsApp via Evolution API.
 *   6. Dispara o webhook para o n8n com tipo: "checkout_realizado".
 */

import { supabase } from '../lib/supabase';
import { currentHotelService, reservasService } from './supabaseService';
import { templateMensagemService } from './templateMensagemService';

// Conjunto para evitar processamentos concorrentes ou duplicados na mesma sessão
const reservasEmProcessamento = new Set<string>();

/**
 * Retorna o fuso horário oficial configurado para o hotel
 */
export function getFusoHorarioDoHotel(hotelId?: string): 'America/Cuiaba' | 'America/Sao_Paulo' {
  try {
    const automacoes = templateMensagemService.getHotelAutomacoes(hotelId);
    if (automacoes?.fuso_horario === 'America/Sao_Paulo' || automacoes?.fuso_horario === 'America/Cuiaba') {
      return automacoes.fuso_horario;
    }
  } catch {}
  return 'America/Cuiaba';
}

/**
 * Retorna a data (YYYY-MM-DD) e hora (0-23) atuais no fuso horário especificado
 */
export function getHoraEDataNoFuso(
  timeZone: 'America/Cuiaba' | 'America/Sao_Paulo' = 'America/Cuiaba',
  date: Date = new Date()
): { dataStr: string; hora: number; minuto: number } {
  try {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);

    return {
      dataStr: `${y}-${m}-${d}`,
      hora: hour,
      minuto: minute
    };
  } catch {
    return {
      dataStr: date.toISOString().split('T')[0],
      hora: date.getHours(),
      minuto: date.getMinutes()
    };
  }
}

/**
 * Normaliza qualquer formato de data para YYYY-MM-DD
 */
export function normalizarDataParaIsoDate(dataVal: any): string {
  if (!dataVal) return '';
  const s = String(dataVal).trim();
  if (s.includes('T')) {
    return s.split('T')[0];
  }
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 3) {
      // Formato DD/MM/YYYY -> YYYY-MM-DD
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  return s.split(' ')[0];
}

export const autoCheckoutService = {
  /**
   * Avalia uma lista de reservas (ou busca as do banco) e executa o check-out
   * automático para aquelas com saída vencida ou saída hoje a partir das 07:00 da manhã.
   */
  async verificarEExecutarCheckoutsAutomaticos(reservasOpcional?: any[]): Promise<number> {
    try {
      let lista = reservasOpcional;

      // Se não foi informada lista em memória, consulta reservas com status Hospedado
      if (!lista || lista.length === 0) {
        const activeHotelId = typeof window !== 'undefined' ? currentHotelService.getCurrentHotel()?.id : null;
        let query = supabase
          .from('reservas')
          .select('*')
          .ilike('status', '%hosped%');

        if (activeHotelId) {
          query = query.eq('hotel_id', activeHotelId);
        }

        const { data: dbReservas, error } = await query;
        if (error || !dbReservas) {
          return 0;
        }
        lista = dbReservas;
      }

      let checkoutsExecutados = 0;

      for (const res of lista) {
        const resId = res.id;
        if (!resId || reservasEmProcessamento.has(resId)) {
          continue;
        }

        const rawStatus = (res.status || '').toString().toLowerCase().trim();
        if (!rawStatus.includes('hosped')) {
          continue;
        }

        const rawCheckout = res.checkOut || res.data_checkout || res.checkout;
        const checkoutIso = normalizarDataParaIsoDate(rawCheckout);
        if (!checkoutIso) {
          continue;
        }

        const hotelId = res.hotel_id || (typeof window !== 'undefined' ? currentHotelService.getCurrentHotel()?.id : null);
        const fuso = getFusoHorarioDoHotel(hotelId);
        const { dataStr: hojeNoFuso, hora: horaNoFuso } = getHoraEDataNoFuso(fuso);

        // Regra Oficial de Negócio:
        // 1. Data de check-out é anterior a hoje no fuso do hotel (já expirada)
        // 2. Data de check-out é hoje e já são 07:00 da manhã ou mais no fuso do hotel
        const isExpiradaAnterior = checkoutIso < hojeNoFuso;
        const isHojeAposSete = checkoutIso === hojeNoFuso && horaNoFuso >= 7;

        if (isExpiradaAnterior || isHojeAposSete) {
          reservasEmProcessamento.add(resId);
          console.info(
            `[AutoCheckout 07:00] Disparando check-out automático para a reserva #${resId} (${res.nome_hospede || res.hospedeNome}). Data Checkout: ${checkoutIso}, Hoje no fuso (${fuso}): ${hojeNoFuso} às ${horaNoFuso}h.`
          );

          try {
            const result = await reservasService.realizarCheckout(resId, { isAutomatico: true });
            if (result.success) {
              checkoutsExecutados++;
            }
          } catch (execErr) {
            console.error(`[AutoCheckout 07:00] Erro ao executar check-out da reserva #${resId}:`, execErr);
          } finally {
            // Mantém no set por 10 minutos para não reprocessar na mesma sessão
            setTimeout(() => {
              reservasEmProcessamento.delete(resId);
            }, 10 * 60 * 1000);
          }
        }
      }

      return checkoutsExecutados;
    } catch (err) {
      console.error('[AutoCheckout 07:00] Falha ao processar check-outs automáticos:', err);
      return 0;
    }
  },

  /**
   * Inicia o monitoramento global com intervalo contínuo a cada 30 segundos
   */
  iniciarMonitoramentoGlobal(): () => void {
    if (typeof window === 'undefined') return () => {};

    // 1. Executa imediatamente no início
    this.verificarEExecutarCheckoutsAutomaticos();

    // 2. Intervalo periódico a cada 30 segundos
    const timer = setInterval(() => {
      this.verificarEExecutarCheckoutsAutomaticos();
    }, 30000);

    // 3. Listeners ao retornar à aba ou trocar de hotel
    const handleRecheck = () => {
      this.verificarEExecutarCheckoutsAutomaticos();
    };

    window.addEventListener('focus', handleRecheck);
    window.addEventListener('hotel_changed', handleRecheck);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleRecheck();
      }
    });

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', handleRecheck);
      window.removeEventListener('hotel_changed', handleRecheck);
    };
  }
};

export default autoCheckoutService;
