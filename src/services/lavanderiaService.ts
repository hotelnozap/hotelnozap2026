import { currentHotelService } from './supabaseService';

export type StatusLavanderia = 
  | 'recebido'      // 📥 Recebido no Balcão
  | 'lavando'       // 🫧 Em Lavagem / Passadoria
  | 'pronto'        // 👕 Pronto para Retirada (Roupas Limpas)
  | 'entregue'      // ✅ Entregue ao Hóspede
  | 'cancelado';    // ❌ Cancelado

export type TipoCobrancaLavanderia = 
  | 'quarto'        // Lançar na conta do Quarto (pagar no Checkout)
  | 'pago_balcao'   // Pago na hora no balcão
  | 'cortesia';     // Cortesia / Sem cobrança

export interface ItemLavanderia {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  subtotal: number;
}

export interface PedidoLavanderia {
  id: string;
  codigo: string;          // Ex: #LAV-1042
  hotelId: string;
  quartoNumero: string;
  hospedeNome: string;
  hospedeTelefone?: string;
  reservaId?: string;
  itens: ItemLavanderia[];
  totalPecas: number;
  valorTotal: number;
  formaCobranca: TipoCobrancaLavanderia;
  status: StatusLavanderia;
  observacoes?: string;
  recebidoPor?: string;
  criadoEm: string;        // ISO Date
  previsaoEntrega?: string;
  prontoEm?: string;
  entregueEm?: string;
}

const getLavanderiaKey = (hotelId?: string) => {
  const hId = hotelId || currentHotelService.getCurrentHotel()?.id || 'global';
  return `hotelnozap_pedidos_lavanderia_${hId}`;
};

export const lavanderiaService = {
  // 1. Obter todos os pedidos de lavanderia do hotel
  async getPedidos(hotelId?: string): Promise<PedidoLavanderia[]> {
    const hId = hotelId || currentHotelService.getCurrentHotel()?.id;
    const storageKey = getLavanderiaKey(hId);

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Erro ao ler pedidos de lavanderia do storage:', err);
    }
    return [];
  },

  // 2. Criar novo pedido de lavanderia recebido no balcão
  async createPedido(
    pedidoData: Omit<PedidoLavanderia, 'id' | 'codigo' | 'criadoEm'>,
    hotelId?: string
  ): Promise<PedidoLavanderia> {
    const hId = hotelId || pedidoData.hotelId || currentHotelService.getCurrentHotel()?.id || '';
    const storageKey = getLavanderiaKey(hId);

    const now = new Date();
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const codigo = `#LAV-${randNum}`;

    const novoPedido: PedidoLavanderia = {
      ...pedidoData,
      id: `lav_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      codigo,
      hotelId: hId,
      criadoEm: now.toISOString()
    };

    const existentes = await this.getPedidos(hId);
    const atualizados = [novoPedido, ...existentes];

    try {
      localStorage.setItem(storageKey, JSON.stringify(atualizados));
    } catch (err) {
      console.warn('Erro ao salvar pedido de lavanderia no storage:', err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_lavanderia_atualizado', { detail: novoPedido }));
    }

    return novoPedido;
  },

  // 3. Atualizar status do pedido (recebido -> lavando -> pronto -> entregue -> cancelado)
  async updateStatus(
    id: string,
    status: StatusLavanderia,
    hotelId?: string
  ): Promise<PedidoLavanderia | null> {
    const hId = hotelId || currentHotelService.getCurrentHotel()?.id;
    const storageKey = getLavanderiaKey(hId);
    const pedidos = await this.getPedidos(hId);

    let pedidoAtualizado: PedidoLavanderia | null = null;
    const nowIso = new Date().toISOString();

    const atualizados = pedidos.map(p => {
      if (p.id === id) {
        pedidoAtualizado = {
          ...p,
          status,
          prontoEm: status === 'pronto' ? (p.prontoEm || nowIso) : p.prontoEm,
          entregueEm: status === 'entregue' ? nowIso : p.entregueEm
        };
        return pedidoAtualizado;
      }
      return p;
    });

    if (pedidoAtualizado) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(atualizados));
      } catch (err) {
        console.warn('Erro ao atualizar status de lavanderia:', err);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hotel_lavanderia_atualizado', { detail: pedidoAtualizado }));
      }
    }

    return pedidoAtualizado;
  },

  // 4. Obter consumo pendente de lavanderia por quarto (para o checkout)
  async getConsumoLavanderiaPorQuarto(
    quartoNumero: string,
    hotelId?: string
  ): Promise<{ totalPendente: number; pedidos: PedidoLavanderia[] }> {
    const pedidos = await this.getPedidos(hotelId);
    const qClean = String(quartoNumero).trim().toLowerCase();

    const pedidosQuarto = pedidos.filter(p => {
      const matchQuarto = String(p.quartoNumero).trim().toLowerCase() === qClean;
      const isCobrancaQuarto = p.formaCobranca === 'quarto';
      const naoCancelado = p.status !== 'cancelado';
      return matchQuarto && isCobrancaQuarto && naoCancelado;
    });

    const totalPendente = pedidosQuarto.reduce((acc, p) => acc + (p.valorTotal || 0), 0);

    return {
      totalPendente,
      pedidos: pedidosQuarto
    };
  },

  // 5. Excluir pedido
  async deletePedido(id: string, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel()?.id;
    const storageKey = getLavanderiaKey(hId);
    const pedidos = await this.getPedidos(hId);

    const filtrados = pedidos.filter(p => p.id !== id);
    try {
      localStorage.setItem(storageKey, JSON.stringify(filtrados));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hotel_lavanderia_atualizado', { detail: { id, deleted: true } }));
      }
      return true;
    } catch (err) {
      console.warn('Erro ao excluir pedido de lavanderia:', err);
      return false;
    }
  },

  // 6. Gerar texto e link para WhatsApp quando as roupas ficarem prontas
  gerarMensagemWhatsApp(pedido: PedidoLavanderia, hotelNome?: string): { texto: string; linkZap?: string } {
    const hNome = hotelNome || currentHotelService.getCurrentHotel()?.name || 'Hotel';
    const primeiroNome = pedido.hospedeNome.split(' ')[0] || 'Hóspede';

    const texto = 
      `👕 *Lavanderia ${hNome}*\n\n` +
      `Olá, *${primeiroNome}*! Suas roupas do *Quarto ${pedido.quartoNumero}* (Pedido ${pedido.codigo}) já foram higienizadas, passadas e estão *prontas para retirada* na recepção do hotel.\n\n` +
      `📦 *Total de Peças:* ${pedido.totalPecas}\n` +
      (pedido.formaCobranca === 'quarto' 
        ? `💳 *Valor:* R$ ${pedido.valorTotal.toFixed(2).replace('.', ',')} (lançado na conta do seu quarto)\n\n` 
        : pedido.formaCobranca === 'pago_balcao'
        ? `✅ *Pagamento:* Já quitado no balcão\n\n`
        : `🎁 *Serviço:* Cortesia do hotel\n\n`) +
      `Qualquer dúvida estamos à disposição na recepção! Tenha uma excelente estadia.`;

    let linkZap: string | undefined = undefined;
    if (pedido.hospedeTelefone) {
      const cleanPhone = pedido.hospedeTelefone.replace(/\D/g, '');
      const phoneComDdi = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      linkZap = `https://wa.me/${phoneComDdi}?text=${encodeURIComponent(texto)}`;
    }

    return { texto, linkZap };
  }
};
