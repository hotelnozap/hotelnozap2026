/**
 * evolutionApiService.ts
 * Serviço de integração com a Evolution API v2.3.0
 * Hospedado em: https://painelevolution.hotelnozap.com.br
 */

import { formatPhoneEvolution } from '../utils/masks';

export interface EvolutionApiInstance {
  id: string;
  name: string;
  connectionStatus: 'open' | 'close' | 'connecting' | string;
  ownerJid?: string | null;
  profileName?: string | null;
  profilePicUrl?: string | null;
  integration?: string;
  number?: string | null;
  token?: string;
  clientName?: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    Message?: number;
    Contact?: number;
    Chat?: number;
  };
  Setting?: {
    rejectCall?: boolean;
    alwaysOnline?: boolean;
    readMessages?: boolean;
    readStatus?: boolean;
    syncFullHistory?: boolean;
  };
}

export interface InstanceMetadata {
  instanceName: string;
  displayName: string;
  department: string;
  hotelId: string;
  phone?: string;
  createdAt: string;
}

export interface QrCodeResponse {
  pairingCode?: string | null;
  code?: string | null;
  base64?: string | null;
  count?: number;
}

export interface ConnectionStateResponse {
  instance: {
    instanceName: string;
    state: 'open' | 'close' | 'connecting' | string;
  };
}

// Configuração Centralizada da Evolution API
const DEFAULT_API_URL = 'https://painelevolution.hotelnozap.com.br';
const DEFAULT_GLOBAL_API_KEY = 'wtwHLYfFxI9n1zDR8zFFqNq8kVaWqdD2oLpcjVmXBm';

export class EvolutionApiService {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = (typeof window !== 'undefined' && localStorage.getItem('hotelnozap_evolution_url')) || DEFAULT_API_URL;
    this.apiKey = (typeof window !== 'undefined' && localStorage.getItem('hotelnozap_evolution_key')) || DEFAULT_GLOBAL_API_KEY;
  }

  public getApiUrl(): string {
    return this.apiUrl;
  }

  public setApiUrl(url: string) {
    this.apiUrl = url.replace(/\/+$/, '');
    if (typeof window !== 'undefined') {
      localStorage.setItem('hotelnozap_evolution_url', this.apiUrl);
    }
  }

  public setApiKey(key: string) {
    this.apiKey = key.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem('hotelnozap_evolution_key', this.apiKey);
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'apikey': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Armazenamento de metadados das instâncias do hotel (departamento, nome de exibição)
   */
  public getLocalMetadata(hotelId: string): Record<string, InstanceMetadata> {
    try {
      const key = `hotelnozap_instances_meta_${hotelId || 'global'}`;
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  }

  public saveLocalMetadata(hotelId: string, meta: InstanceMetadata) {
    try {
      const key = `hotelnozap_instances_meta_${hotelId || 'global'}`;
      const current = this.getLocalMetadata(hotelId);
      current[meta.instanceName] = meta;
      localStorage.setItem(key, JSON.stringify(current));
    } catch {}
  }

  public removeLocalMetadata(hotelId: string, instanceName: string) {
    try {
      const key = `hotelnozap_instances_meta_${hotelId || 'global'}`;
      const current = this.getLocalMetadata(hotelId);
      delete current[instanceName];
      localStorage.setItem(key, JSON.stringify(current));
    } catch {}
  }

  /**
   * Buscar todos os metadados de instâncias de todos os hotéis (Visão Multi-tenant Admin)
   */
  public getAllLocalMetadata(): Record<string, InstanceMetadata> {
    const all: Record<string, InstanceMetadata> = {};
    try {
      if (typeof window === 'undefined') return all;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('hotelnozap_instances_meta_')) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              Object.assign(all, parsed);
            }
          } catch {}
        }
      }
    } catch {}
    return all;
  }

  /**
   * Testar a conectividade e latência com o servidor Evolution API
   */
  public async pingServer(): Promise<{ online: boolean; latencyMs: number; error?: string }> {
    const start = performance.now();
    try {
      const res = await fetch(`${this.apiUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      const end = performance.now();
      return {
        online: res.ok,
        latencyMs: Math.round(end - start),
        error: res.ok ? undefined : `HTTP ${res.status}`
      };
    } catch (e: any) {
      const end = performance.now();
      return {
        online: false,
        latencyMs: Math.round(end - start),
        error: e?.message || 'Falha de conexão'
      };
    }
  }

  /**
   * Listar todas as instâncias existentes na Evolution API
   */
  public async fetchInstances(): Promise<EvolutionApiInstance[]> {
    try {
      const res = await fetch(`${this.apiUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!res.ok) {
        console.warn('Erro ao consultar fetchInstances na Evolution API:', res.status, res.statusText);
        return [];
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    } catch (err) {
      console.error('Falha na requisição fetchInstances:', err);
      return [];
    }
  }

  /**
   * Criar uma nova instância no servidor Evolution API
   */
  public async createInstance(
    instanceName: string,
    options?: {
      number?: string;
      qrcode?: boolean;
    }
  ): Promise<{ success: boolean; data?: any; error?: string; qrcode?: QrCodeResponse }> {
    try {
      const cleanName = instanceName.trim();
      const payload: Record<string, any> = {
        instanceName: cleanName,
        qrcode: options?.qrcode !== false,
        integration: 'WHATSAPP-BAILEYS'
      };

      if (options?.number) {
        payload.number = options.number.replace(/\D/g, '');
      }

      const res = await fetch(`${this.apiUrl}/instance/create`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (!res.ok && res.status !== 201) {
        const errorMsg = json?.response?.message || json?.message || 'Falha ao criar instância.';
        return { success: false, error: Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg };
      }

      const qrcodeData: QrCodeResponse | undefined = json?.qrcode;
      return { success: true, data: json, qrcode: qrcodeData };
    } catch (err: any) {
      console.error('Falha no createInstance:', err);
      return { success: false, error: err?.message || 'Erro de conexão com o servidor Evolution API.' };
    }
  }

  /**
   * Conectar a instância e obter o QR Code ativo
   */
  public async connectInstance(instanceName: string): Promise<{
    success: boolean;
    qrcode?: QrCodeResponse;
    state?: string;
    error?: string;
  }> {
    try {
      const encodedName = encodeURIComponent(instanceName.trim());
      const res = await fetch(`${this.apiUrl}/instance/connect/${encodedName}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        return {
          success: false,
          error: errJson?.message || `Erro HTTP ${res.status} ao conectar instância.`
        };
      }

      const json = await res.json();

      // Formato 1: { pairingCode, code, base64, count }
      if (json?.base64 || json?.code) {
        return {
          success: true,
          qrcode: {
            pairingCode: json.pairingCode,
            code: json.code,
            base64: json.base64,
            count: json.count
          }
        };
      }

      // Formato 2: { instance: { instanceName, state: "open" } }
      if (json?.instance?.state) {
        return {
          success: true,
          state: json.instance.state,
          qrcode: json.qrcode
        };
      }

      // Formato 3: { qrcode: { base64, code } }
      if (json?.qrcode?.base64) {
        return {
          success: true,
          qrcode: json.qrcode
        };
      }

      return { success: true, state: 'connecting' };
    } catch (err: any) {
      console.error('Falha no connectInstance:', err);
      return { success: false, error: err?.message || 'Erro ao conectar à instância.' };
    }
  }

  /**
   * Consultar estado atual da conexão (open, close, connecting)
   */
  public async getConnectionState(instanceName: string): Promise<'open' | 'close' | 'connecting' | 'unknown'> {
    try {
      const encodedName = encodeURIComponent(instanceName.trim());
      const res = await fetch(`${this.apiUrl}/instance/connectionState/${encodedName}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!res.ok) return 'unknown';

      const json = await res.json();
      const state = json?.instance?.state || json?.state;
      if (state === 'open' || state === 'close' || state === 'connecting') {
        return state;
      }
      return 'unknown';
    } catch (err) {
      return 'unknown';
    }
  }

  /**
   * Reiniciar instância
   */
  public async restartInstance(instanceName: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const encodedName = encodeURIComponent(instanceName.trim());
      const res = await fetch(`${this.apiUrl}/instance/restart/${encodedName}`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      const json = await res.json().catch(() => null);
      if (res.ok) {
        return { success: true, message: json?.response?.message || 'Instância reiniciada.' };
      }
      return { success: false, message: json?.message || 'Falha ao reiniciar instância.', error: json?.message };
    } catch (err: any) {
      return { success: false, message: err?.message, error: err?.message };
    }
  }

  /**
   * Desconectar WhatsApp (Logout)
   */
  public async logoutInstance(instanceName: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const encodedName = encodeURIComponent(instanceName.trim());
      const res = await fetch(`${this.apiUrl}/instance/logout/${encodedName}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      const json = await res.json().catch(() => null);
      if (res.ok) {
        return { success: true, message: json?.response?.message || 'Instância desconectada com sucesso.' };
      }
      return { success: false, message: json?.message || 'Falha ao desconectar instância.', error: json?.message };
    } catch (err: any) {
      return { success: false, message: err?.message, error: err?.message };
    }
  }

  /**
   * Excluir a instância permanentemente
   */
  public async deleteInstance(instanceName: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const encodedName = encodeURIComponent(instanceName.trim());
      const res = await fetch(`${this.apiUrl}/instance/delete/${encodedName}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      const json = await res.json().catch(() => null);
      if (res.ok) {
        return { success: true, message: json?.response?.message || 'Instância removida com sucesso.' };
      }
      return { success: false, message: json?.message || 'Falha ao excluir instância.', error: json?.message };
    } catch (err: any) {
      return { success: false, message: err?.message, error: err?.message };
    }
  }

  /**
   * Enviar mensagem de texto pela Evolution API
   */
  public async sendTextMessage(instanceName: string, number: string, text: string): Promise<boolean> {
    const result = await this.sendTextMessageDetailed(instanceName, number, text);
    return result.success;
  }

  /**
   * Enviar mensagem de texto detalhada pela Evolution API (retorna status e erros detalhados)
   */
  public async sendTextMessageDetailed(
    instanceName: string,
    number: string,
    text: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const encodedName = encodeURIComponent(instanceName.trim());
      const cleanNumber = formatPhoneEvolution(number);
      if (!cleanNumber) {
        return { success: false, error: 'Número de telefone inválido para envio via WhatsApp.' };
      }

      const res = await fetch(`${this.apiUrl}/message/sendText/${encodedName}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          number: cleanNumber,
          text: text
        })
      });

      const json = await res.json().catch(() => null);
      if (res.ok) {
        return { success: true, data: json };
      }

      const errMsg = json?.message || json?.response?.message || `Erro HTTP ${res.status}`;
      console.error(`[Evolution API] Erro ao enviar mensagem para ${cleanNumber} via ${instanceName}:`, errMsg);
      return { success: false, error: errMsg };
    } catch (err: any) {
      console.error('[Evolution API] Falha de conexão ao enviar mensagem:', err);
      return { success: false, error: err?.message || 'Falha de comunicação com a Evolution API.' };
    }
  }

  /**
   * Configurar / Ativar / Desativar Webhook da Instância na Evolution API (POST /webhook/set/:instance)
   */
  public async setInstanceWebhook(
    instanceName: string,
    webhookUrl: string,
    events: string[] = ['MESSAGES_UPSERT'],
    enabled: boolean = true
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const encodedName = encodeURIComponent(instanceName.trim());
      const res = await fetch(`${this.apiUrl}/webhook/set/${encodedName}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          webhook: {
            enabled: enabled,
            url: webhookUrl.trim(),
            byEvents: false,
            base64: false,
            events: enabled ? events : []
          }
        })
      });

      const json = await res.json().catch(() => null);
      if (res.ok) {
        return {
          success: true,
          message: enabled
            ? 'Resposta automática ativada com sucesso!'
            : 'Resposta automática desativada com sucesso!'
        };
      }
      return { success: false, message: json?.message || 'Falha ao atualizar resposta automática.', error: json?.message };
    } catch (err: any) {
      return { success: false, message: err?.message, error: err?.message };
    }
  }

  /**
   * Buscar configuração atual de Webhook da Instância (GET /webhook/find/:instance)
   */
  public async findInstanceWebhook(instanceName: string): Promise<any> {
    try {
      const encodedName = encodeURIComponent(instanceName.trim());
      const res = await fetch(`${this.apiUrl}/webhook/find/${encodedName}`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      if (res.ok) {
        return await res.json().catch(() => null);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Buscar mensagens recentes da instância (POST /chat/findMessages/:instance)
   */
  public async findLatestMessages(instanceName: string, limit: number = 20): Promise<any[]> {
    try {
      const encodedName = encodeURIComponent(instanceName.trim());
      const res = await fetch(`${this.apiUrl}/chat/findMessages/${encodedName}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          where: {},
          limit: limit
        })
      });
      if (!res.ok) return [];
      const data = await res.json().catch(() => null);
      if (data?.messages?.records && Array.isArray(data.messages.records)) {
        return data.messages.records;
      }
      if (Array.isArray(data)) return data;
      return [];
    } catch {
      return [];
    }
  }
}

export const evolutionApiService = new EvolutionApiService();
export default evolutionApiService;
