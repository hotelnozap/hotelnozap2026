/**
 * src/services/paymentGatewayService.ts
 * Gerenciador centralizado de seleção e alternância do Gateway de Checkout Padrão
 * (InfinitePay vs Mercado Pago).
 */

import { hotelConfigService, HotelConfigData } from './supabaseService';
import { systemLogsService } from './systemLogsService';
import { supabase } from '../lib/supabase';

export type GatewayPadrao = 'infinitepay' | 'mercadopago';

export interface GatewayOption {
  id: GatewayPadrao;
  nome: string;
  descricao: string;
  taxaPix: string;
  badge: string;
  icon: string;
  cor: string;
}

export const GATEWAY_OPTIONS: GatewayOption[] = [
  {
    id: 'infinitepay',
    nome: 'InfinitePay',
    descricao: 'Checkout Integrado com Pix Instantâneo sem taxa de intermediação (Taxa Zero 0%) e cartão de crédito até 12x.',
    taxaPix: '0% de Taxa no Pix',
    badge: '⚡ Recomendado (Taxa 0%)',
    icon: 'bolt',
    cor: 'emerald'
  },
  {
    id: 'mercadopago',
    nome: 'Mercado Pago',
    descricao: 'Gateway tradicional com Pix, Cartão de Crédito e Saldo na Conta Mercado Pago.',
    taxaPix: '0,99% a 1,99% por Pix',
    badge: 'Tradicional',
    icon: 'payments',
    cor: 'sky'
  }
];

export const paymentGatewayService = {
  getDefaultGateway(hotelId?: string): GatewayPadrao {
    try {
      const storageKey = hotelId 
        ? `hotelnozap_gateway_padrao_${hotelId}` 
        : 'hotelnozap_gateway_padrao_master';

      const stored = localStorage.getItem(storageKey);
      if (stored === 'infinitepay' || stored === 'mercadopago') {
        return stored;
      }

      // Verifica configuração salva do hotel
      if (hotelId) {
        const hotelCfg = localStorage.getItem(`hotelnozap_config_hotel_${hotelId}`);
        if (hotelCfg) {
          const parsed = JSON.parse(hotelCfg);
          if (parsed.checkoutPadrao === 'infinitepay' || parsed.checkoutPadrao === 'mercadopago') {
            return parsed.checkoutPadrao;
          }
        }
      }

      // Verifica parâmetros globais do sistema
      const params = localStorage.getItem('hotelnozap_parametros_sistema');
      if (params) {
        const parsed = JSON.parse(params);
        if (parsed.gatewayProvider === 'infinitepay' || parsed.gateway_padrao === 'infinitepay') {
          return 'infinitepay';
        }
        if (parsed.gatewayProvider === 'mercadopago' || parsed.gateway_padrao === 'mercadopago') {
          return 'mercadopago';
        }
      }
    } catch (e) {
      console.warn('Aviso ao consultar gateway padrão:', e);
    }

    // Padrão: InfinitePay (Taxa Zero 0%)
    return 'infinitepay';
  },

  async setDefaultGateway(
    gateway: GatewayPadrao, 
    hotelId?: string, 
    hotelNome?: string
  ): Promise<boolean> {
    try {
      const storageKey = hotelId 
        ? `hotelnozap_gateway_padrao_${hotelId}` 
        : 'hotelnozap_gateway_padrao_master';

      localStorage.setItem(storageKey, gateway);

      // Sincroniza configuração de hotel se houver
      if (hotelId) {
        try {
          const existingConfig = await hotelConfigService.getConfig(hotelId);
          await hotelConfigService.saveConfig({
            ...(existingConfig || {}),
            checkoutPadrao: gateway
          } as HotelConfigData, hotelId);
        } catch (e) {
          console.warn('Aviso ao salvar checkout padrão no Supabase hotel:', e);
        }
      }

      // Sincroniza em parametros_sistema se for escopo master ou global
      try {
        await supabase
          .from('parametros_sistema')
          .update({
            gateway_padrao: gateway,
            gateway_provider: gateway,
            updated_at: new Date().toISOString()
          })
          .eq('id', 1);
      } catch (e) {
        console.warn('Aviso ao atualizar parametros_sistema no Supabase:', e);
      }

      // Atualiza também o cache local dos parâmetros do sistema
      try {
        const rawParams = localStorage.getItem('hotelnozap_parametros_sistema');
        const parsed = rawParams ? JSON.parse(rawParams) : {};
        parsed.gatewayProvider = gateway;
        parsed.gateway_padrao = gateway;
        localStorage.setItem('hotelnozap_parametros_sistema', JSON.stringify(parsed));
      } catch {}

      // Registra evento de auditoria no log do sistema
      const gatewayNome = gateway === 'infinitepay' ? 'InfinitePay (Taxa Zero)' : 'Mercado Pago';
      await systemLogsService.addLog({
        level: 'success',
        module: 'financeiro',
        action: `Checkout Padrão Definido: ${gatewayNome}`,
        details: `O gateway principal de pagamentos foi alterado para ${gatewayNome}.`,
        hotelId,
        hotelName: hotelNome,
        metadata: {
          gatewayPadrao: gateway,
          escopo: hotelId ? 'hotel_individual' : 'master_saas'
        }
      });

      return true;
    } catch (err) {
      console.error('Erro ao definir gateway padrão:', err);
      return false;
    }
  }
};
