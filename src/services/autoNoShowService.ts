/**
 * autoNoShowService.ts
 * Motor Centralizado de Verificação de No-Show, Cancelamento Automático e Liberação de Quartos.
 * 
 * Regra de Negócio Oficial:
 * - Horário padrão de check-in: 12:00 (ou o configurado no hotel)
 * - Tolerância padrão de comparecimento: 8 horas após o horário de check-in (ex: 12:00 -> até 20:00)
 * - Proteção de Atraso Comunicado: Se o hóspede avisou sobre imprevisto (carro quebrou, trânsito, etc.),
 *   a reserva é protegida contra cancelamento automático de No-Show no mesmo dia.
 * - Se a tolerância expirar sem comparecimento nem aviso:
 *   1. O status da reserva 'Confirmada' passa para 'Cancelada' com justificativa de No-Show.
 *   2. O quarto vinculado volta imediatamente para 'disponivel'.
 *   3. Dispara alerta via WhatsApp para o hóspede informando o cancelamento e a liberação do quarto.
 *   4. Registra alerta para a recepção/hotel para ser exibido no Modal de Abertura.
 *   5. Dispara eventos de atualização em tempo real para toda a interface.
 */

import { supabase } from '../lib/supabase';
import { currentHotelService, reservasService, quartosService, hotelConfigService } from './supabaseService';
import { templateMensagemService } from './templateMensagemService';
import { webhookN8nService } from './webhookN8nService';
import { getFusoHorarioDoHotel, getHoraEDataNoFuso, normalizarDataParaIsoDate } from './autoCheckoutService';

// Conjunto para evitar processamentos concorrentes na mesma sessão
const reservasEmProcessamentoNoShow = new Set<string>();

export interface ResumoReservasDia {
  hotelId: string;
  dataConsulta: string;
  checkinsHoje: any[];
  checkoutsHoje: any[];
  noShowsCancelados: any[];
  totalPendencias: number;
}

export interface RegrasCheckinHotel {
  checkInHorario: string;
  toleranciaHoras: number;
  horaLimiteFormatada: string;
}

// Cache local temporário das regras de check-in por hotel (TTL: 60s)
const hotelConfigCache = new Map<string, { checkInHorario: string; toleranciaHoras: number; ts: number }>();

export async function getRegrasCheckinDoHotel(hotelId?: string): Promise<RegrasCheckinHotel> {
  const hId = hotelId || 'default';
  const cached = hotelConfigCache.get(hId);
  const now = Date.now();

  let checkInHorario = '12:00';
  let toleranciaHoras = 8;

  if (cached && now - cached.ts < 60000) {
    checkInHorario = cached.checkInHorario;
    toleranciaHoras = cached.toleranciaHoras;
  } else {
    try {
      const cfg = await hotelConfigService.getConfig(hotelId);
      if (cfg?.checkInHorario) checkInHorario = cfg.checkInHorario;
      if (typeof cfg?.toleranciaCheckInHoras === 'number' && cfg.toleranciaCheckInHoras > 0) {
        toleranciaHoras = cfg.toleranciaCheckInHoras;
      }
      hotelConfigCache.set(hId, { checkInHorario, toleranciaHoras, ts: now });
    } catch {
      // Fallback seguro: 12:00 e 8 horas
    }
  }

  const [horaStr, minStr] = checkInHorario.split(':');
  const h = parseInt(horaStr, 10) || 12;
  const m = parseInt(minStr, 10) || 0;
  const minutosTotais = h * 60 + m + toleranciaHoras * 60;
  const horaLimiteFormatada = `${String(Math.floor(minutosTotais / 60) % 24).padStart(2, '0')}:${String(minutosTotais % 60).padStart(2, '0')}`;

  return { checkInHorario, toleranciaHoras, horaLimiteFormatada };
}

/**
 * Detecta se a reserva possui indicação de atraso avisado / check-in tardio (imprevistos de estrada, etc.)
 */
export function isReservaComAtrasoAvisado(res: any): boolean {
  if (!res) return false;
  const texto = `${res.observacoes || ''} ${res.status || ''} ${res.motivo_cancelamento || ''} ${res.notas || ''}`.toLowerCase();
  return (
    texto.includes('atraso avisado') ||
    texto.includes('check-in tardio') ||
    texto.includes('checkin tardio') ||
    texto.includes('chegada tardia') ||
    texto.includes('chega mais tarde') ||
    texto.includes('aviso de atraso') ||
    texto.includes('atraso comunicado') ||
    texto.includes('carro quebrou') ||
    texto.includes('vai atrasar') ||
    texto.includes('atrasado')
  );
}

export const autoNoShowService = {
  /**
   * Avalia todas as reservas confirmadas e executa o cancelamento automático
   * caso tenha ultrapassado o horário de check-in + tolerância (padrão: 8 horas).
   */
  async verificarEExecutarNoShows(reservasOpcional?: any[]): Promise<number> {
    try {
      let lista = reservasOpcional;

      if (!lista || lista.length === 0) {
        const activeHotelId = typeof window !== 'undefined' ? currentHotelService.getCurrentHotel()?.id : null;
        let query = supabase
          .from('reservas')
          .select('*')
          .ilike('status', '%confirmad%');

        if (activeHotelId && activeHotelId !== 'ALL' && activeHotelId !== 'all') {
          query = query.eq('hotel_id', activeHotelId);
        }

        const { data: dbReservas, error } = await query;
        if (error || !dbReservas) return 0;
        lista = dbReservas;
      }

      let canceladasCount = 0;

      for (const res of lista) {
        const resId = res.id;
        if (!resId || reservasEmProcessamentoNoShow.has(resId)) continue;

        const rawStatus = (res.status || '').toString().toLowerCase().trim();
        // Apenas reservas Confirmadas (que ainda não fizeram check-in)
        if (!rawStatus.includes('confirmad')) continue;

        // Se o hóspede avisou sobre imprevisto (ex: carro quebrou, trânsito), a reserva fica protegida no dia!
        if (isReservaComAtrasoAvisado(res)) {
          continue;
        }

        const rawCheckin = res.checkIn || res.data_checkin || res.checkin;
        const checkinIso = normalizarDataParaIsoDate(rawCheckin);
        if (!checkinIso) continue;

        const hotelId = res.hotel_id || (typeof window !== 'undefined' ? currentHotelService.getCurrentHotel()?.id : null);
        const fuso = getFusoHorarioDoHotel(hotelId);
        const { dataStr: hojeNoFuso, hora: horaNoFuso, minuto: minutoNoFuso } = getHoraEDataNoFuso(fuso);

        // Obter regras dinâmicas de tolerância do hotel (padrão 8 horas)
        const regras = await getRegrasCheckinDoHotel(hotelId);
        const [hCheckinStr, mCheckinStr] = regras.checkInHorario.split(':');
        const hCheckin = parseInt(hCheckinStr, 10) || 12;
        const mCheckin = parseInt(mCheckinStr, 10) || 0;

        // Limite total de tolerância em minutos a partir de 00:00 do dia do check-in
        const minutosLimiteTolerancia = (hCheckin * 60 + mCheckin) + (regras.toleranciaHoras * 60);
        const minutosAtuaisHoje = horaNoFuso * 60 + minutoNoFuso;

        let expirou = false;

        if (checkinIso < hojeNoFuso) {
          // Check-in era em data anterior.
          // Se a tolerância passou da meia-noite (>= 1440 min), verifica se já passou do excedente hoje.
          if (minutosLimiteTolerancia >= 1440) {
            const minutosExcedentesHoje = minutosLimiteTolerancia - 1440;
            // Se o check-in foi ontem e já passou dos minutos que viraram a noite:
            expirou = minutosAtuaisHoje >= minutosExcedentesHoje;
          } else {
            // A tolerância terminava no próprio dia de check-in, que já ficou no passado.
            expirou = true;
          }
        } else if (checkinIso === hojeNoFuso) {
          // Check-in é hoje.
          // Se a tolerância termina hoje (< 1440 min):
          if (minutosLimiteTolerancia < 1440) {
            expirou = minutosAtuaisHoje >= minutosLimiteTolerancia;
          } else {
            // A tolerância estende até a madrugada do dia seguinte, portanto hoje ainda não expirou!
            expirou = false;
          }
        }

        if (expirou) {
          reservasEmProcessamentoNoShow.add(resId);
          console.info(
            `[AutoNoShow ${regras.toleranciaHoras}h Tolerância] Cancelando reserva #${resId} (${res.nome_hospede}). Check-in: ${checkinIso} às ${regras.checkInHorario}. Limite tolerância: ${regras.horaLimiteFormatada}h. Hoje no fuso (${fuso}): ${hojeNoFuso} às ${horaNoFuso}:${minutoNoFuso}h.`
          );

          try {
            const executou = await this.cancelarPorNoShowELiberarQuarto(res, regras);
            if (executou) {
              canceladasCount++;
            }
          } catch (err) {
            console.error(`[AutoNoShow] Erro ao cancelar reserva #${resId}:`, err);
          } finally {
            // Mantém no set por 10 minutos para não reprocessar na mesma sessão
            setTimeout(() => {
              reservasEmProcessamentoNoShow.delete(resId);
            }, 10 * 60 * 1000);
          }
        }
      }

      return canceladasCount;
    } catch (err) {
      console.error('[AutoNoShow] Falha geral ao verificar No-Shows:', err);
      return 0;
    }
  },

  /**
   * Executa o cancelamento da reserva por No-Show, libera o quarto e dispara avisos
   */
  async cancelarPorNoShowELiberarQuarto(res: any, regrasParam?: RegrasCheckinHotel): Promise<boolean> {
    const resId = res.id;
    if (!resId) return false;

    const regras = regrasParam || await getRegrasCheckinDoHotel(res.hotel_id);
    const motivo = `[NO-SHOW AUTOMÁTICO] Cancelada em ${new Date().toLocaleString('pt-BR')}: tolerância de ${regras.toleranciaHoras}h após o horário de check-in (${regras.checkInHorario} -> limite ${regras.horaLimiteFormatada}) expirada sem comparecimento do hóspede nem aviso de atraso. Quarto liberado para nova locação.`;
    const novaObservacao = res.observacoes ? `${res.observacoes}\n${motivo}` : motivo;

    // 1. Atualizar o status da reserva para Cancelada no Supabase
    const { error: errRes } = await supabase
      .from('reservas')
      .update({
        status: 'Cancelada',
        observacoes: novaObservacao
      })
      .eq('id', resId);

    if (errRes) {
      console.error('[AutoNoShow] Erro ao atualizar status da reserva:', errRes);
      return false;
    }

    // 2. Liberar o Quarto para 'disponivel'
    let quartoId = res.quarto_id;
    const hotelId = res.hotel_id;

    if (!quartoId && res.numero_quarto && hotelId) {
      try {
        const { data: qrt } = await supabase
          .from('quartos')
          .select('id')
          .eq('hotel_id', hotelId)
          .eq('numero', String(res.numero_quarto))
          .maybeSingle();
        if (qrt?.id) quartoId = qrt.id;
      } catch {}
    }

    if (quartoId) {
      try {
        await supabase
          .from('quartos')
          .update({ status: 'disponivel' })
          .eq('id', quartoId);
        console.info(`[AutoNoShow] Quarto ${res.numero_quarto || quartoId} liberado com sucesso para venda.`);
      } catch (qErr) {
        console.warn('[AutoNoShow] Aviso ao liberar quarto:', qErr);
      }
    }

    // 3. Disparar WhatsApp para o Hóspede
    this.enviarWhatsAppCancelamentoNoShow(res, regras).catch(wErr => {
      console.warn('[AutoNoShow] Erro ao disparar WhatsApp de cancelamento para o hóspede:', wErr);
    });

    // 4. Disparar Webhook para o n8n
    try {
      webhookN8nService.dispararWebhookConfirmacaoReserva(res, {
        tipo: 'reserva_cancelada_noshow',
        evento: `Reserva Cancelada por No-Show (${regras.toleranciaHoras}h Tolerância Expirada)`
      }).catch(() => {});
    } catch {}

    // 5. Emitir eventos no window e BroadcastChannel para atualizar a UI em tempo real
    if (typeof window !== 'undefined') {
      const eventoDetalhe = {
        reservaId: res.id,
        nome_hospede: res.nome_hospede,
        numero_quarto: res.numero_quarto,
        motivo,
        data: new Date().toISOString()
      };

      window.dispatchEvent(new CustomEvent('hotel_reserva_noshow', { detail: eventoDetalhe }));
      window.dispatchEvent(new CustomEvent('hotel_reserva_modificada', { detail: { id: res.id, status: 'Cancelada' } }));
      window.dispatchEvent(new CustomEvent('quartos_updated', { detail: { quartoId, status: 'disponivel' } }));

      try {
        localStorage.setItem('hotel_noshow_recente', JSON.stringify(eventoDetalhe));
      } catch {}
    }

    return true;
  },

  /**
   * Envia mensagem no WhatsApp para o Hóspede informando o cancelamento
   */
  async enviarWhatsAppCancelamentoNoShow(res: any, regrasParam?: RegrasCheckinHotel): Promise<void> {
    try {
      const hotelId = res.hotel_id || currentHotelService.getCurrentHotel()?.id;
      const regras = regrasParam || await getRegrasCheckinDoHotel(hotelId);

      // 1. Obter dados do Hotel
      let hotelNome = 'Hotel';
      if (hotelId) {
        const { data: htl } = await supabase.from('hoteis').select('nome, razao_social, telefone, whatsapp').eq('id', hotelId).maybeSingle();
        if (htl) hotelNome = htl.nome || htl.razao_social || 'Hotel';
      }

      // 2. Obter telefone do Hóspede
      let telefoneDestino = res.telefone_hospede || res.telefone || '';
      if (!telefoneDestino && res.hospede_id) {
        const { data: hsp } = await supabase.from('hospedes').select('telefone, whatsapp, celular').eq('id', res.hospede_id).maybeSingle();
        telefoneDestino = hsp?.telefone || hsp?.whatsapp || hsp?.celular || '';
      }

      if (!telefoneDestino && res.observacoes) {
        const matchTel = res.observacoes.match(/(?:WhatsApp|Tel|Telefone)[:\s]*([0-9]{10,13})/i);
        if (matchTel) telefoneDestino = matchTel[1];
      }

      if (!telefoneDestino) {
        console.warn('[AutoNoShow] Não foi possível localizar o telefone do hóspede para enviar cancelamento.');
        return;
      }

      const nomeHospede = res.nome_hospede || 'Hóspede';
      const numQuarto = res.numero_quarto || '101';
      const shortId = res.id ? res.id.substring(0, 6).toUpperCase() : 'RESERVA';

      const textoMensagem = `⚠️ *AVISO DE CANCELAMENTO POR NÃO COMPARECIMENTO* ⚠️\n\nOlá *${nomeHospede}*,\n\nInformamos que sua reserva *#${shortId}* no *${hotelNome}* (Quarto ${numQuarto}) ultrapassou o horário de check-in (${regras.checkInHorario}) e o período de tolerância de ${regras.toleranciaHoras} horas (até às ${regras.horaLimiteFormatada}).\n\nComo não registramos sua entrada nem aviso prévio de atraso à nossa recepção, sua reserva foi automaticamente cancelada e a acomodação foi liberada no sistema.\n\nCaso esteja a caminho ou precise de suporte, entre em contato imediatamente com nossa recepção!`;

      await templateMensagemService.enviarMensagemWhatsApp(hotelId, telefoneDestino, textoMensagem);
    } catch (e) {
      console.warn('[AutoNoShow] Falha no disparo de mensagem WhatsApp de cancelamento:', e);
    }
  },

  /**
   * Carrega os dados para o Modal de Abertura "Reservas do Dia & Alertas"
   */
  async obterResumoReservasDoDia(hotelId?: string): Promise<ResumoReservasDia> {
    const targetHotelId = hotelId || currentHotelService.getCurrentHotel()?.id || '';
    const fuso = getFusoHorarioDoHotel(targetHotelId);
    const { dataStr: hojeNoFuso } = getHoraEDataNoFuso(fuso);

    let query = supabase.from('reservas').select('*');
    if (targetHotelId && targetHotelId !== 'ALL' && targetHotelId !== 'all') {
      query = query.eq('hotel_id', targetHotelId);
    }

    const { data: reservas, error } = await query;
    if (error || !reservas) {
      return {
        hotelId: targetHotelId,
        dataConsulta: hojeNoFuso,
        checkinsHoje: [],
        checkoutsHoje: [],
        noShowsCancelados: [],
        totalPendencias: 0
      };
    }

    const checkinsHoje: any[] = [];
    const checkoutsHoje: any[] = [];
    const noShowsCancelados: any[] = [];

    for (const r of reservas) {
      const rawCheckin = r.checkIn || r.data_checkin;
      const rawCheckout = r.checkOut || r.data_checkout;
      const checkinIso = normalizarDataParaIsoDate(rawCheckin);
      const checkoutIso = normalizarDataParaIsoDate(rawCheckout);
      const status = (r.status || '').toLowerCase();

      // Check-ins de hoje que ainda não entraram
      if (checkinIso === hojeNoFuso && (status.includes('confirmad') || status.includes('pendent'))) {
        checkinsHoje.push(r);
      }

      // Check-outs previstos para hoje
      if (checkoutIso === hojeNoFuso && (status.includes('hosped') || status.includes('confirmad'))) {
        checkoutsHoje.push(r);
      }

      // No-shows cancelados recentes (cancelados hoje ou ontem por no-show)
      if (status.includes('canc') && r.observacoes && r.observacoes.includes('NO-SHOW')) {
        noShowsCancelados.push(r);
      }
    }

    return {
      hotelId: targetHotelId,
      dataConsulta: hojeNoFuso,
      checkinsHoje,
      checkoutsHoje,
      noShowsCancelados,
      totalPendencias: checkinsHoje.length + checkoutsHoje.length + noShowsCancelados.length
    };
  },

  /**
   * Inicia o monitoramento contínuo global
   */
  iniciarMonitoramentoGlobal(): () => void {
    if (typeof window === 'undefined') return () => {};

    // 1. Executa imediatamente no início
    this.verificarEExecutarNoShows();

    // 2. Intervalo periódico a cada 30 segundos
    const timer = setInterval(() => {
      this.verificarEExecutarNoShows();
    }, 30000);

    const handleRecheck = () => {
      this.verificarEExecutarNoShows();
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

export default autoNoShowService;
