import { currentHotelService } from './supabaseService';
import { supabase } from '../lib/supabase';

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

export interface ItemCatalogoLavanderia {
  id: string;
  hotelId: string;
  nome: string;
  valor: number;
  ativo: boolean;
  ordem?: number;
  criadoEm?: string;
}

// Peças e serviços padrão para inicialização do hotel
export const ITENS_LAVANDERIA_PADRAO: Array<{ nome: string; valor: number }> = [
  { nome: 'Camisa / Camiseta', valor: 8.00 },
  { nome: 'Calça / Bermuda', valor: 10.00 },
  { nome: 'Vestido / Peça Delicada', valor: 15.00 },
  { nome: 'Peça Íntima / Meias', valor: 4.00 },
  { nome: 'Lavagem por Quilo (kg)', valor: 22.00 },
  { nome: 'Casaco / Jaqueta', valor: 20.00 },
];

const getLavanderiaKey = (hotelId?: string) => {
  const hId = hotelId || currentHotelService.getCurrentHotel()?.id || 'global';
  return `hotelnozap_pedidos_lavanderia_${hId}`;
};

const getItensCatalogoKey = (hotelId?: string) => {
  const hId = hotelId || currentHotelService.getCurrentHotel()?.id || 'global';
  return `hotelnozap_itens_lavanderia_${hId}`;
};

export const lavanderiaService = {
  // ==========================================
  // 1. CATÁLOGO DE ITENS E PREÇOS DA LAVANDERIA
  // ==========================================

  // Obter itens da tabela de preços (Supabase + cache local)
  async getItensCatalogo(hotelId?: string): Promise<ItemCatalogoLavanderia[]> {
    const hId = hotelId || currentHotelService.getCurrentHotel()?.id || 'global';
    const storageKey = getItensCatalogoKey(hId);

    // 1.1 Tentar ler do Supabase
    try {
      if (supabase && hId) {
        let query = supabase
          .from('lavanderia_itens')
          .select('*')
          .order('ordem', { ascending: true })
          .order('nome', { ascending: true });

        if (!hId.startsWith('hotel-master')) {
          query = query.or(`hotel_id.eq.${hId},hotel_id.is.null`);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const itensDb: ItemCatalogoLavanderia[] = data.map((d: any, idx: number) => ({
            id: String(d.id),
            hotelId: d.hotel_id || hId,
            nome: d.nome || '',
            valor: Number(d.valor) || 0,
            ativo: d.ativo !== false,
            ordem: d.ordem || idx + 1,
            criadoEm: d.created_at || d.criado_em || ''
          }));

          try {
            localStorage.setItem(storageKey, JSON.stringify(itensDb));
          } catch { /* ignore */ }

          return itensDb;
        }
      }
    } catch {
      // Fallback gracioso para localStorage
    }

    // 1.2 Fallback: LocalStorage
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch { /* ignore */ }

    // 1.3 Se vazio pela primeira vez, inicializa os itens padrões
    const itensIniciais: ItemCatalogoLavanderia[] = ITENS_LAVANDERIA_PADRAO.map((item, idx) => ({
      id: `item_padrao_${idx + 1}`,
      hotelId: hId,
      nome: item.nome,
      valor: item.valor,
      ativo: true,
      ordem: idx + 1,
      criadoEm: new Date().toISOString()
    }));

    try {
      localStorage.setItem(storageKey, JSON.stringify(itensIniciais));
    } catch { /* ignore */ }

    return itensIniciais;
  },

  // Cadastrar novo item no catálogo
  async createItemCatalogo(
    itemData: { nome: string; valor: number; hotelId?: string; ordem?: number },
    hotelId?: string
  ): Promise<ItemCatalogoLavanderia> {
    const hId = hotelId || itemData.hotelId || currentHotelService.getCurrentHotel()?.id || 'global';
    const storageKey = getItensCatalogoKey(hId);

    const novoItem: ItemCatalogoLavanderia = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      hotelId: hId,
      nome: itemData.nome.trim(),
      valor: Number(itemData.valor) || 0,
      ativo: true,
      ordem: itemData.ordem || Date.now(),
      criadoEm: new Date().toISOString()
    };

    // Tentar persistir no Supabase
    try {
      if (supabase && hId) {
        const { data, error } = await supabase
          .from('lavanderia_itens')
          .insert([{
            hotel_id: hId,
            nome: novoItem.nome,
            valor: novoItem.valor,
            ativo: true,
            ordem: novoItem.ordem
          }])
          .select()
          .single();

        if (!error && data?.id) {
          novoItem.id = String(data.id);
        }
      }
    } catch (err) {
      console.warn('Erro ao inserir item no Supabase, mantendo no storage local:', err);
    }

    // Atualiza armazenamento local
    const itensAtuais = await this.getItensCatalogo(hId);
    const atualizados = [...itensAtuais, novoItem];
    try {
      localStorage.setItem(storageKey, JSON.stringify(atualizados));
    } catch { /* ignore */ }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_lavanderia_itens_atualizados', { detail: novoItem }));
    }

    return novoItem;
  },

  // Atualizar item do catálogo
  async updateItemCatalogo(
    id: string,
    updates: Partial<Omit<ItemCatalogoLavanderia, 'id' | 'hotelId'>>,
    hotelId?: string
  ): Promise<ItemCatalogoLavanderia | null> {
    const hId = hotelId || currentHotelService.getCurrentHotel()?.id || 'global';
    const storageKey = getItensCatalogoKey(hId);
    const itens = await this.getItensCatalogo(hId);

    const index = itens.findIndex(i => i.id === id);
    if (index === -1) return null;

    const itemAtual = itens[index];
    const itemAtualizado: ItemCatalogoLavanderia = {
      ...itemAtual,
      ...updates,
      valor: updates.valor !== undefined ? Number(updates.valor) : itemAtual.valor
    };

    const atualizados = [...itens];
    atualizados[index] = itemAtualizado;

    try {
      if (supabase) {
        await supabase
          .from('lavanderia_itens')
          .update({
            nome: itemAtualizado.nome,
            valor: itemAtualizado.valor,
            ativo: itemAtualizado.ativo,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
      }
    } catch (err) {
      console.warn('Erro ao atualizar item no Supabase:', err);
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(atualizados));
    } catch { /* ignore */ }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_lavanderia_itens_atualizados', { detail: itemAtualizado }));
    }

    return itemAtualizado;
  },

  // Excluir item do catálogo
  async deleteItemCatalogo(id: string, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel()?.id || 'global';
    const storageKey = getItensCatalogoKey(hId);
    const itens = await this.getItensCatalogo(hId);
    const filtrados = itens.filter(i => i.id !== id);

    try {
      if (supabase) {
        await supabase
          .from('lavanderia_itens')
          .delete()
          .eq('id', id);
      }
    } catch (err) {
      console.warn('Erro ao excluir item no Supabase:', err);
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(filtrados));
    } catch { /* ignore */ }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_lavanderia_itens_atualizados', { detail: { id, deleted: true } }));
    }

    return true;
  },

  // ==========================================
  // 2. PEDIDOS DE LAVANDERIA (ORDENS DE SERVIÇO)
  // ==========================================

  // Obter todos os pedidos de lavanderia do hotel
  async getPedidos(hotelId?: string): Promise<PedidoLavanderia[]> {
    const hId = hotelId || currentHotelService.getCurrentHotel()?.id;
    const storageKey = getLavanderiaKey(hId);

    // 2.1 Tentar ler do Supabase
    try {
      if (supabase && hId) {
        let query = supabase
          .from('lavanderia_pedidos')
          .select('*')
          .order('created_at', { ascending: false });

        if (!hId.startsWith('hotel-master')) {
          query = query.or(`hotel_id.eq.${hId},hotel_id.is.null`);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const pedidosDb: PedidoLavanderia[] = data.map((d: any) => ({
            id: String(d.id),
            codigo: d.codigo,
            hotelId: d.hotel_id || hId,
            quartoNumero: String(d.quarto_numero),
            hospedeNome: d.hospede_nome,
            hospedeTelefone: d.hospede_telefone || undefined,
            reservaId: d.reserva_id || undefined,
            itens: Array.isArray(d.itens) ? d.itens : [],
            totalPecas: Number(d.total_pecas) || 0,
            valorTotal: Number(d.valor_total) || 0,
            formaCobranca: d.forma_cobranca as TipoCobrancaLavanderia,
            status: d.status as StatusLavanderia,
            observacoes: d.observacoes || undefined,
            recebidoPor: d.recebido_por || undefined,
            criadoEm: d.created_at || d.criado_em || new Date().toISOString(),
            previsaoEntrega: d.previsao_entrega || undefined,
            prontoEm: d.pronto_em || undefined,
            entregueEm: d.entregue_em || undefined,
          }));

          try {
            localStorage.setItem(storageKey, JSON.stringify(pedidosDb));
          } catch { /* ignore */ }

          return pedidosDb;
        }
      }
    } catch {
      // Fallback gracioso para localStorage
    }

    // 2.2 Fallback: LocalStorage
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

  // Criar novo pedido de lavanderia recebido no balcão
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

    // Tentar persistir no Supabase
    try {
      if (supabase && hId) {
        await supabase
          .from('lavanderia_pedidos')
          .insert([{
            id: novoPedido.id,
            codigo: novoPedido.codigo,
            hotel_id: hId,
            quarto_numero: novoPedido.quartoNumero,
            hospede_nome: novoPedido.hospedeNome,
            hospede_telefone: novoPedido.hospedeTelefone,
            reserva_id: novoPedido.reservaId,
            itens: novoPedido.itens,
            total_pecas: novoPedido.totalPecas,
            valor_total: novoPedido.valorTotal,
            forma_cobranca: novoPedido.formaCobranca,
            status: novoPedido.status,
            observacoes: novoPedido.observacoes,
            recebido_por: novoPedido.recebidoPor,
            previsao_entrega: novoPedido.previsaoEntrega,
            created_at: novoPedido.criadoEm
          }]);
      }
    } catch (err) {
      console.warn('Erro ao salvar pedido no Supabase, salvo localmente:', err);
    }

    // Salvar no storage local
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

  // Atualizar status do pedido (recebido -> lavando -> pronto -> entregue -> cancelado)
  async updateStatus(
    id: string,
    status: StatusLavanderia,
    hotelId?: string
  ): Promise<PedidoLavanderia | null> {
    const hId = hotelId || currentHotelService.getCurrentHotel()?.id;
    const storageKey = getLavanderiaKey(hId);
    const pedidos = await this.getPedidos(hId);

    const index = pedidos.findIndex(p => p.id === id);
    if (index === -1) return null;

    const p = pedidos[index];
    const nowIso = new Date().toISOString();
    const pedidoAtualizado: PedidoLavanderia = {
      ...p,
      status,
      prontoEm: status === 'pronto' ? (p.prontoEm || nowIso) : p.prontoEm,
      entregueEm: status === 'entregue' ? nowIso : p.entregueEm
    };

    const atualizados = [...pedidos];
    atualizados[index] = pedidoAtualizado;

    // Tenta atualizar no Supabase
    try {
      if (supabase && hId) {
        await supabase
          .from('lavanderia_pedidos')
          .update({
            status,
            pronto_em: pedidoAtualizado.prontoEm,
            entregue_em: pedidoAtualizado.entregueEm,
            updated_at: nowIso
          })
          .eq('id', id);
      }
    } catch (err) {
      console.warn('Erro ao atualizar status no Supabase:', err);
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(atualizados));
    } catch (err) {
      console.warn('Erro ao atualizar status de lavanderia no storage:', err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_lavanderia_atualizado', { detail: pedidoAtualizado }));
    }

    return pedidoAtualizado;
  },

  // Obter consumo pendente de lavanderia por quarto (para o checkout)
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

  // Excluir pedido
  async deletePedido(id: string, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel()?.id;
    const storageKey = getLavanderiaKey(hId);
    const pedidos = await this.getPedidos(hId);

    // Deletar no Supabase
    try {
      if (supabase && hId) {
        await supabase
          .from('lavanderia_pedidos')
          .delete()
          .eq('id', id);
      }
    } catch (err) {
      console.warn('Erro ao excluir pedido no Supabase:', err);
    }

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

  // Gerar texto e link para WhatsApp quando as roupas ficarem prontas
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
