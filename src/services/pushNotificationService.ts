import { systemLogsService } from './systemLogsService';
import { supabase } from '../lib/supabase';

export interface PushNotificationPayload {
  title: string;
  message: string;
  url?: string;
  imageUrl?: string;
  segment?: 'all' | 'active';
  publicoAlvo?: 'all' | 'app' | 'web';
  hotelId?: string;
  hotelName?: string;
}

export interface PushNotificationHistoryItem {
  id: string;
  title: string;
  message: string;
  url?: string;
  imageUrl?: string;
  segment: string;
  publicoAlvo?: 'all' | 'app' | 'web';
  recipients: number;
  sentAt: string;
  senderEmail: string;
  status: 'sent' | 'failed';
  errorDetails?: string;
  hotelId?: string;
  hotelName?: string;
}

const STORAGE_KEY = 'hotelnozap_push_history';

class PushNotificationService {
  /**
   * Envia uma notificação push via Infraestrutura Própria Nativa (Web Push / PWA / APK)
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

    const publicoAlvoNome = 
      payload.publicoAlvo === 'app' ? 'Apenas App (APK/PWA)' :
      payload.publicoAlvo === 'web' ? 'Apenas Navegador' : 'Todos (App + Navegador)';

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || '';

      const response = await fetch('/api/send-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
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
          segment: publicoAlvoNome,
          publicoAlvo: payload.publicoAlvo || 'all',
          recipients: 0,
          sentAt: new Date().toISOString(),
          senderEmail,
          status: 'failed',
          errorDetails: errorMsg,
          hotelId: payload.hotelId,
          hotelName: payload.hotelName
        });

        await systemLogsService.addLog({
          module: 'sistema',
          level: 'error',
          action: 'Falha no Disparo de Notificação Push Nativa',
          details: `Tentativa de envio por ${senderEmail} falhou: ${errorMsg}`,
          metadata: { payload, error: data }
        });

        return { success: false, error: errorMsg };
      }

      const recipients = data.recipients ?? 0;

      if (!data.success || recipients === 0) {
        const errDesc = data.error || data.message || 'Nenhum dispositivo encontrado para o público selecionado.';
        this.saveHistory({
          id: `empty-${Date.now()}`,
          title: payload.title,
          message: payload.message,
          url: payload.url,
          imageUrl: payload.imageUrl,
          segment: publicoAlvoNome,
          publicoAlvo: payload.publicoAlvo || 'all',
          recipients: 0,
          sentAt: new Date().toISOString(),
          senderEmail,
          status: 'failed',
          errorDetails: errDesc,
          hotelId: payload.hotelId,
          hotelName: payload.hotelName
        });
        return {
          success: false,
          recipients: 0,
          error: errDesc
        };
      }

      const notifId = data.id || `notif-${Date.now()}`;

      this.saveHistory({
        id: notifId,
        title: payload.title,
        message: payload.message,
        url: payload.url,
        imageUrl: payload.imageUrl,
        segment: publicoAlvoNome,
        publicoAlvo: payload.publicoAlvo || 'all',
        recipients,
        sentAt: new Date().toISOString(),
        senderEmail,
        status: 'sent',
        hotelId: payload.hotelId,
        hotelName: payload.hotelName
      });

      await systemLogsService.addLog({
        module: 'sistema',
        level: 'success',
        action: 'Notificação Push Nativa Disparada',
        details: `Push "${payload.title}" enviado para ${recipients} destinatário(s) (${publicoAlvoNome}) via motor nativo próprio.`,
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
        segment: publicoAlvoNome,
        publicoAlvo: payload.publicoAlvo || 'all',
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
