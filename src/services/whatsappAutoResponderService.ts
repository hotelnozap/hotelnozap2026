/**
 * whatsappAutoResponderService.ts
 * Monitora mensagens recebidas na instância Evolution API conectada
 * e responde automaticamente com o template de Início de Atendimento / Boas-Vindas
 * configurado pelo hotel.
 */

import { evolutionApiService } from './evolutionApiService';
import { templateMensagemService } from './templateMensagemService';
import { currentHotelService } from './supabaseService';
import { formatPhoneEvolution } from '../utils/masks';

class WhatsappAutoResponderService {
  private isRunning: boolean = false;
  private isChecking: boolean = false;
  private intervalTimer: any = null;
  private pollIntervalMs: number = 4000; // Consulta a cada 4 segundos
  private processedMessageIds: Set<string> = new Set();
  private isInitialized: boolean = false;

  constructor() {}

  /**
   * Inicia o monitoramento automático da instância conectada
   */
  public start(): void {
    if (this.isRunning || typeof window === 'undefined') return;
    this.isRunning = true;
    console.info('[AutoResponder] 🚀 Serviço de resposta automática de início de atendimento iniciado.');

    // Executa a primeira checagem após 1.5s
    setTimeout(() => {
      this.checkIncomingMessages();
    }, 1500);

    this.intervalTimer = setInterval(() => {
      this.checkIncomingMessages();
    }, this.pollIntervalMs);
  }

  /**
   * Para o monitoramento
   */
  public stop(): void {
    this.isRunning = false;
    this.isChecking = false;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    console.info('[AutoResponder] ⏹️ Serviço de resposta automática interrompido.');
  }

  /**
   * Verifica novas mensagens recebidas na Evolution API
   */
  public async checkIncomingMessages(): Promise<void> {
    if (!this.isRunning || this.isChecking) return;
    this.isChecking = true;

    try {
      const activeHotel = currentHotelService.getCurrentHotel();
      const hotelId = activeHotel?.id;
      const automacoes = templateMensagemService.getHotelAutomacoes(hotelId);

      // Se a automação de boas-vindas estiver desativada, não responde
      if (!automacoes.auto_boas_vindas) return;

      // Localiza a instância conectada
      const instInfo = await templateMensagemService.getInstanciaConectadaDoHotel(hotelId);
      if (!instInfo.isOnline || !instInfo.instanceName) return;

      const instanceName = instInfo.instanceName;

      // Busca as últimas 10 mensagens
      const records = await evolutionApiService.findLatestMessages(instanceName, 10);
      if (!Array.isArray(records) || records.length === 0) return;

      // Na primeira execução, armazena os IDs atuais para não responder mensagens antigas
      if (!this.isInitialized) {
        records.forEach((r: any) => {
          const msgId = r.id || r.key?.id;
          if (msgId) this.processedMessageIds.add(msgId);
        });
        this.isInitialized = true;
        return;
      }

      // Processa da mais antiga para a mais recente
      const reversed = [...records].reverse();

      for (const r of reversed) {
        const msgId = r.id || r.key?.id;
        if (!msgId || this.processedMessageIds.has(msgId)) {
          continue;
        }

        // Marca como processada
        this.processedMessageIds.add(msgId);
        if (this.processedMessageIds.size > 500) {
          // Limpa cache se crescer muito
          const arr = Array.from(this.processedMessageIds);
          this.processedMessageIds = new Set(arr.slice(arr.length - 200));
        }

        const key = r.key || {};
        const remoteJid = key.remoteJid || '';
        const fromMe = key.fromMe === true;

        // Ignora grupos, transmissões e mensagens enviadas por nós mesmos
        if (remoteJid.includes('@g.us') || remoteJid.includes('broadcast') || fromMe) {
          continue;
        }

        // Extrai o número do remetente
        let rawPhone = '';
        if (key.remoteJidAlt && key.remoteJidAlt.includes('@s.whatsapp.net')) {
          rawPhone = key.remoteJidAlt.replace(/\D/g, '');
        } else if (remoteJid.includes('@s.whatsapp.net')) {
          rawPhone = remoteJid.replace(/\D/g, '');
        } else {
          rawPhone = (key.remoteJidAlt || remoteJid).replace(/@.*$/, '').replace(/\D/g, '');
        }

        const cleanPhone = formatPhoneEvolution(rawPhone);
        if (!cleanPhone || cleanPhone.length < 10) {
          continue;
        }

        // ─────────────────────────────────────────────────────────────────
        // ANTI-LOOP COMPARTILHADO: usa o mesmo cache do templateMensagemService
        // (localStorage, TTL 5 min) para evitar duplo envio com outros módulos.
        // ─────────────────────────────────────────────────────────────────
        if (templateMensagemService._checkRecentDispatch(cleanPhone, hotelId)) {
          console.info(`[AutoResponder] Boas-vindas já enviadas recentemente para ${cleanPhone} (cache compartilhado). Ignorando.`);
          continue;
        }

        // Reserva o número no cache ANTES de enviar (evita race condition)
        templateMensagemService._markRecentDispatch(cleanPhone, hotelId);

        // Nome do contato
        const pushName = (r.pushName || '').trim();
        const nomeCliente = pushName && pushName !== 'Você' ? pushName : '';

        // Monta as tags dinâmicas
        const tags = {
          nome_hospede: nomeCliente,
          nome_hotel: activeHotel?.name || 'Hotel Morada da Lua',
          link_hotel: templateMensagemService.getHotelPublicLink(hotelId)
        };

        // Renderiza o template de boas-vindas do hotel
        const respostaTexto = templateMensagemService.renderTemplate('boas_vindas', tags, hotelId);

        console.info(`[AutoResponder] 💬 Disparando boas-vindas automáticas para ${cleanPhone} via ${instanceName}...`);

        const envioRes = await evolutionApiService.sendTextMessageDetailed(
          instanceName,
          cleanPhone,
          respostaTexto
        );

        if (envioRes.success) {
          console.info(`[AutoResponder] ✅ Resposta automática de início de atendimento enviada com sucesso para ${cleanPhone}!`);

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('hotelnozap_auto_reply_sent', {
                detail: {
                  instanceName,
                  recipient: cleanPhone,
                  nome: nomeCliente,
                  mensagem: respostaTexto,
                  timestamp: new Date().toISOString()
                }
              })
            );
          }
        } else {
          console.warn(`[AutoResponder] ⚠️ Falha ao enviar auto-resposta para ${cleanPhone}:`, envioRes.error);
          // Se falhou envio, libera número no cache compartilhado para nova tentativa
          templateMensagemService._markRecentDispatch(cleanPhone, hotelId); // sobrescreve — próxima vez tentará de novo se o registro for antigo
        }
      }
    } catch (err) {
      console.warn('[AutoResponder] Erro no ciclo de verificação de mensagens:', err);
    } finally {
      this.isChecking = false;
    }
  }
}

export const whatsappAutoResponderService = new WhatsappAutoResponderService();
export default whatsappAutoResponderService;
