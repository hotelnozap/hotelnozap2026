/**
 * autoNoShowService.ts
 * Motor Centralizado de Verificação de No-Show, Cancelamento Automático e Liberação de Quartos.
 * 
 * Regra de Negócio Oficial:
 * - Horário padrão de check-in: 12:00 (ou o configurado no hotel)
 * - Tolerância máxima de comparecimento: 1 hora (limite: 13:00 do dia de check-in)
 * - Se a data de check-in for anterior a hoje, OU for hoje e já passou das 13:00:
 *   1. O status da reserva 'Confirmada' passa para 'cancelada' com justificativa de No-Show.
 *   2. O quarto vinculado volta imediatamente para 'disponivel'.
 *   3. Dispara alerta via WhatsApp para o hóspede informando o cancelamento e a liberação do quarto.
 *   4. Registra alerta para a recepção/hotel para ser exibido no Modal de Abertura.
 *   5. Dispara eventos de atualização em tempo real para toda a interface.
 */

import { supabase } from '../lib/supabase';
import { currentHotelService, reservasService, quartosService } from './supabaseService';
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

export const autoNoShowService = {
  /**
   * Avalia todas as reservas confirmadas e executa o cancelamento automático
   * caso tenha ultrapassado o horário de check-in + 1 hora de tolerância.
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

        const rawCheckin = res.checkIn || res.data_checkin || res.checkin;
        const checkinIso = normalizarDataParaIsoDate(rawCheckin);
        if (!checkinIso) continue;

        const hotelId = res.hotel_id || (typeof window !== 'undefined' ? currentHotelService.getCurrentHotel()?.id : null);
        const fuso = getFusoHorarioDoHotel(hotelId);
        const { dataStr: hojeNoFuso, hora: horaNoFuso, minuto: minutoNoFuso } = getHoraEDataNoFuso(fuso);

        // Regra de Horário: Padrão check-in 12:00 + 1h de tolerância = 13:00
        // (horaNoFuso > 13 || (horaNoFuso === 13 && minutoNoFuso >= 0))
        const isDataPassada = checkinIso < hojeNoFuso;
        const isHojePassouTolerancia = checkinIso === hojeNoFuso && (horaNoFuso > 13 || (horaNoFuso === 13 && minutoNoFuso >= 1));

        if (isDataPassada || isHojePassouTolerancia) {
          reservasEmProcessamentoNoShow.add(resId);
          console.info(
            `[AutoNoShow 1h Tolerância] Cancelando reserva #${resId} (${res.nome_hospede}). Check-in: ${checkinIso}. Hoje no fuso (${fuso}): ${hojeNoFuso} às ${horaNoFuso}:${minutoNoFuso}h.`
          );

          try {
            const executou = await this.cancelarPorNoShowELiberarQuarto(res);
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
  async cancelarPorNoShowELiberarQuarto(res: any): Promise<boolean> {
    const resId = res.id;
    if (!resId) return false;

    const motivo = `[NO-SHOW AUTOMÁTICO] Cancelada em ${new Date().toLocaleString('pt-BR')}: tolerância de 1h após o check-in (12:00 -> 13:00) expirada sem comparecimento do hóspede. Quarto liberado para nova locação.`;
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
    this.enviarWhatsAppCancelamentoNoShow(res).catch(wErr => {
      console.warn('[AutoNoShow] Erro ao disparar WhatsApp de cancelamento para o hóspede:', wErr);
    });

    // 4. Disparar Webhook para o n8n
    try {
      webhookN8nService.dispararWebhookConfirmacaoReserva(res, {
        tipo: 'reserva_cancelada_noshow',
        evento: 'Reserva Cancelada por No-Show (1h Tolerância Expirada)'
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
  async enviarWhatsAppCancelamentoNoShow(res: any): Promise<void> {
    try {
      const hotelId = res.hotel_id || currentHotelService.getCurrentHotel()?.id;

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

      const textoMensagem = `⚠️ *AVISO DE CANCELAMENTO POR NÃO COMPARECIMENTO* ⚠️\n\nOlá *${nomeHospede}*,\n\nInformamos que sua reserva *#${shortId}* no *${hotelNome}* (Quarto ${numQuarto}) ultrapassou o horário padrão de check-in (12:00) e o período de tolerância máxima de 1 hora (13:00).\n\nComo não registramos sua entrada nem aviso prévio à nossa recepção, sua reserva foi automaticamente cancelada e a acomodação foi liberada para nova locação no sistema.\n\nCaso esteja a caminho ou precise de suporte, entre em contato imediatamente com nossa recepção!`;

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
