import { systemLogsService } from './systemLogsService';

export interface PushNotificationPayload {
  title: string;
  message: string;
  url?: string;
  imageUrl?: string;
  segment?: 'all' | 'active';
}

export interface PushNotificationHistoryItem {
  id: string;
  title: string;
  message: string;
  url?: string;
  imageUrl?: string;
  segment: string;
  recipients: number;
  sentAt: string;
  senderEmail: string;
  status: 'sent' | 'failed';
  errorDetails?: string;
}

const STORAGE_KEY = 'hotelnozap_push_history';

class PushNotificationService {
  /**
   * Envia uma notificação push via OneSignal (endpoint serverless /api/send-push)
   */
  async sendNotification(payload: PushNotificationPayload): Promise<{
    success: boolean;
    id?: string;
    recipients?: number;
    error?: string;
  }> {
    const senderEmail = (() => {
      try {
        return localStorage.getItem('hotelnozap_user_email') || 'admin@hotelnozap.com.br';
      } catch {
        return 'admin@hotelnozap.com.br';
      }
    })();

    try {
      const response = await fetch('/api/send-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.error || (Array.isArray(data.errors) ? data.errors.join(', ') : 'Falha ao disparar notificação.');
        this.saveHistory({
          id: `err-${Date.now()}`,
          title: payload.title,
          message: payload.message,
          url: payload.url,
          imageUrl: payload.imageUrl,
          segment: payload.segment === 'active' ? 'Assinantes Ativos' : 'Todos os Inscritos',
          recipients: 0,
          sentAt: new Date().toISOString(),
          senderEmail,
          status: 'failed',
          errorDetails: errorMsg
        });

        await systemLogsService.addLog({
          module: 'sistema',
          level: 'error',
          action: 'Falha no Disparo de Notificação Push',
          details: `Tentativa de envio por ${senderEmail} falhou: ${errorMsg}`,
          metadata: { payload, error: data }
        });

        return { success: false, error: errorMsg };
      }

      const recipients = data.recipients ?? 0;
      const notifId = data.id || `notif-${Date.now()}`;

      this.saveHistory({
        id: notifId,
        title: payload.title,
        message: payload.message,
        url: payload.url,
        imageUrl: payload.imageUrl,
        segment: payload.segment === 'active' ? 'Assinantes Ativos' : 'Todos os Inscritos',
        recipients,
        sentAt: new Date().toISOString(),
        senderEmail,
        status: 'sent'
      });

      await systemLogsService.addLog({
        module: 'sistema',
        level: 'success',
        action: 'Notificação Push Disparada',
        details: `Push "${payload.title}" enviado para ${recipients} destinatário(s) via OneSignal.`,
        metadata: { id: notifId, recipients, payload }
      });

      return {
        success: true,
        id: notifId,
        recipients
      };
    } catch (err: any) {
      const errorMsg = err?.message || 'Erro de comunicação ao disparar notificação.';
      
      this.saveHistory({
        id: `err-${Date.now()}`,
        title: payload.title,
        message: payload.message,
        url: payload.url,
        imageUrl: payload.imageUrl,
        segment: payload.segment === 'active' ? 'Assinantes Ativos' : 'Todos os Inscritos',
        recipients: 0,
        sentAt: new Date().toISOString(),
        senderEmail,
        status: 'failed',
        errorDetails: errorMsg
      });

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Retorna o histórico de notificações enviadas
   */
  getHistory(): PushNotificationHistoryItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Salva um item no histórico local
   */
  private saveHistory(item: PushNotificationHistoryItem) {
    try {
      const current = this.getHistory();
      const updated = [item, ...current].slice(0, 50); // Mantém os últimos 50 disparos
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('hotel_push_history_updated'));
    } catch (e) {
      console.warn('Falha ao gravar histórico de push:', e);
    }
  }

  /**
   * Limpa o histórico de notificações
   */
  clearHistory() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('hotel_push_history_updated'));
    } catch (e) {
      console.warn('Falha ao limpar histórico:', e);
    }
  }
}

export const pushNotificationService = new PushNotificationService();
