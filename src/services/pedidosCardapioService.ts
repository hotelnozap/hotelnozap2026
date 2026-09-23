import { supabase } from '../lib/supabase';
import { currentHotelService } from './supabaseService';

export interface PedidoCardapioItem {
  id: string;
  produtoId: string;
  nome: string;
  categoria: string;
  precoUnitario: number;
  quantidade: number;
  subtotal: number;
  foto?: string;
  observacoes?: string;
}

export interface PedidoCardapio {
  id: string;
  codigo: string; // Ex: #PED-4891
  hotelId: string;
  hotelNome: string;
  hospedeId: string;
  hospedeNome: string;
  hospedeEmail: string;
  hospedeCpf?: string;
  hospedeTelefone?: string;
  quartoNumero: string;
  quartoTipo?: string;
  reservaId?: string;
  itens: PedidoCardapioItem[];
  valorTotal: number;
  observacoesGerais?: string;
  status: 'pendente' | 'em_preparo' | 'em_rota' | 'entregue' | 'concluido' | 'cancelado';
  criadoEm: string;
  entregueEm?: string;
  cobradoNoCheckout: boolean;
}

export interface ExtratoConsumoQuarto {
  quartoNumero: string;
  hospedeNome: string;
  totalConsumo: number;
  quantidadePedidos: number;
  pedidos: PedidoCardapio[];
}

const getPedidosKey = (hotelId?: string) => {
  const hId = hotelId || currentHotelService.getCurrentHotel().id || 'global';
  return `hotelnozap_pedidos_cardapio_${hId}`;
};

export const pedidosCardapioService = {
  // 1. Obter todos os pedidos do hotel
  async getPedidos(hotelId?: string): Promise<PedidoCardapio[]> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const storageKey = getPedidosKey(hId);

    let localPedidos: PedidoCardapio[] = [];
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        localPedidos = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Erro ao ler pedidos locais:', e);
    }

    // Tenta carregar do Supabase se a tabela existir
    try {
      let query = supabase.from('pedidos_cardapio').select('*').order('criado_em', { ascending: false });
      if (hId && !hId.startsWith('hotel-master')) {
        query = query.eq('hotel_id', hId);
      }
      const { data, error } = await query;
      if (!error && data && Array.isArray(data)) {
        const mapped: PedidoCardapio[] = data.map((p: any) => ({
          id: String(p.id),
          codigo: p.codigo || `#PED-${String(p.id).substring(0, 4).toUpperCase()}`,
          hotelId: p.hotel_id,
          hotelNome: p.hotel_nome || 'Hotel',
          hospedeId: p.hospede_id || '',
          hospedeNome: p.hospede_nome || 'Hóspede',
          hospedeEmail: p.hospede_email || '',
          hospedeCpf: p.hospede_cpf || '',
          hospedeTelefone: p.hospede_telefone || '',
          quartoNumero: p.quarto_numero || '100',
          quartoTipo: p.quarto_tipo || 'Apartamento',
          reservaId: p.reserva_id || '',
          itens: Array.isArray(p.itens) ? p.itens : [],
          valorTotal: Number(p.valor_total) || 0,
          observacoesGerais: p.observacoes_gerais || '',
          status: p.status || 'pendente',
          criadoEm: p.criado_em || new Date().toISOString(),
          entregueEm: p.entregue_em,
          cobradoNoCheckout: Boolean(p.cobrado_no_checkout)
        }));

        // Mesclar com locais
        const merged = [...localPedidos];
        mapped.forEach(m => {
          const idx = merged.findIndex(l => l.id === m.id || l.codigo === m.codigo);
          if (idx >= 0) merged[idx] = m;
          else merged.push(m);
        });
        localStorage.setItem(storageKey, JSON.stringify(merged));
        return merged;
      }
    } catch {
      // Fallback gracioso para dados locais
    }

    return localPedidos;
  },

  // 2. Obter pedidos do hóspede logado
  async getPedidosHospede(hospedeEmailOuId: string, hotelId?: string): Promise<PedidoCardapio[]> {
    const todos = await this.getPedidos(hotelId);
    const clean = hospedeEmailOuId.trim().toLowerCase();
    return todos.filter(p => 
      (p.hospedeEmail && p.hospedeEmail.toLowerCase() === clean) ||
      (p.hospedeId && p.hospedeId.toLowerCase() === clean)
    );
  },

  // 3. Extrato consolidado por quarto para o check-out
  async getExtratoQuarto(quartoNumero: string, hotelId?: string): Promise<ExtratoConsumoQuarto> {
    const todos = await this.getPedidos(hotelId);
    const pedidosDoQuarto = todos.filter(p => 
      String(p.quartoNumero).trim() === String(quartoNumero).trim() &&
      p.status !== 'cancelado'
    );

    const totalConsumo = pedidosDoQuarto.reduce((acc, p) => acc + (Number(p.valorTotal) || 0), 0);
    const hospedeNome = pedidosDoQuarto[0]?.hospedeNome || 'Hóspede';

    return {
      quartoNumero,
      hospedeNome,
      totalConsumo,
      quantidadePedidos: pedidosDoQuarto.length,
      pedidos: pedidosDoQuarto
    };
  },

  // 4. Criar novo pedido (Lançamento do Hóspede)
  async criarPedido(payload: Omit<PedidoCardapio, 'id' | 'codigo' | 'criadoEm' | 'status' | 'cobradoNoCheckout'> & {
    status?: PedidoCardapio['status'];
    cobradoNoCheckout?: boolean;
  }): Promise<PedidoCardapio> {
    const randomCode = `#PED-${Math.floor(1000 + Math.random() * 9000)}`;
    const novoPedido: PedidoCardapio = {
      status: 'pendente',
      cobradoNoCheckout: false,
      ...payload,
      id: `ped-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      codigo: randomCode,
      criadoEm: new Date().toISOString(),
    };

    const hId = payload.hotelId || currentHotelService.getCurrentHotel().id;
    const storageKey = getPedidosKey(hId);

    // Salva localmente de imediato
    try {
      const saved = localStorage.getItem(storageKey);
      const list = saved ? JSON.parse(saved) : [];
      const updated = [novoPedido, ...list];
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {
      console.warn('Erro ao salvar pedido no storage:', e);
    }

    // Tenta persistir no Supabase
    try {
      await supabase.from('pedidos_cardapio').insert([{
        id: novoPedido.id,
        codigo: novoPedido.codigo,
        hotel_id: novoPedido.hotelId,
        hotel_nome: novoPedido.hotelNome,
        hospede_id: novoPedido.hospedeId,
        hospede_nome: novoPedido.hospedeNome,
        hospede_email: novoPedido.hospedeEmail,
        hospede_cpf: novoPedido.hospedeCpf,
        hospede_telefone: novoPedido.hospedeTelefone,
        quarto_numero: novoPedido.quartoNumero,
        quarto_tipo: novoPedido.quartoTipo,
        reserva_id: novoPedido.reservaId,
        itens: novoPedido.itens,
        valor_total: novoPedido.valorTotal,
        observacoes_gerais: novoPedido.observacoesGerais,
        status: novoPedido.status,
        cobrado_no_checkout: novoPedido.cobradoNoCheckout,
        criado_em: novoPedido.criadoEm
      }]);
    } catch {
      // continua com sucesso local
    }

    // DISPARO DE NOTIFICAÇÕES EM TEMPO REAL PARA O HOTEL
    this.notificarHotelEmTempoReal(novoPedido);

    return novoPedido;
  },

  // 5. Notificações multicanais em tempo real
  notificarHotelEmTempoReal(pedido: PedidoCardapio) {
    // A. CustomEvent no window
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_novo_pedido_cardapio', { detail: pedido }));
      window.dispatchEvent(new CustomEvent('hotel_nova_solicitacao', { 
        detail: {
          id: pedido.id,
          hotelId: pedido.hotelId,
          hospedeNome: pedido.hospedeNome,
          quartoNumero: pedido.quartoNumero,
          itemNome: `Pedido ${pedido.codigo} (${pedido.itens.length} itens - R$ ${pedido.valorTotal.toFixed(2)})`,
          observacoes: pedido.observacoesGerais || 'Lançado no extrato do quarto via cardápio digital',
          horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          tipo: 'cardapio',
          valor: pedido.valorTotal
        }
      }));
    }

    // B. BroadcastChannel entre abas
    try {
      const bc = new BroadcastChannel('hotel_notifications_channel');
      bc.postMessage({ type: 'NOVO_PEDIDO_CARDAPIO', data: pedido });
      bc.close();
    } catch { /* ignore */ }

    // C. Trigger de storage para sincronia entre abas/janelas
    try {
      localStorage.setItem('hotel_novo_pedido_trigger', JSON.stringify({
        ...pedido,
        _triggerUid: `${Date.now()}_${Math.random()}`
      }));
    } catch { /* ignore */ }

    // D. Supabase Realtime broadcast
    try {
      const ch = supabase.channel('realtime_hotel_notifications');
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ch.send({
            type: 'broadcast',
            event: 'novo_pedido_cardapio',
            payload: pedido
          });
        }
      });
    } catch { /* ignore */ }
  },

  // 6. Atualizar status do pedido (Recepção / Copa)
  async atualizarStatusPedido(pedidoId: string, status: PedidoCardapio['status'], hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const storageKey = getPedidosKey(hId);

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const list: PedidoCardapio[] = JSON.parse(saved);
        const idx = list.findIndex(p => p.id === pedidoId);
        if (idx >= 0) {
          list[idx].status = status;
          if (status === 'entregue' || status === 'concluido') {
            list[idx].entregueEm = new Date().toISOString();
          }
          localStorage.setItem(storageKey, JSON.stringify(list));
        }
      }
    } catch (e) {
      console.warn('Erro ao atualizar status local:', e);
    }

    try {
      await supabase.from('pedidos_cardapio').update({ 
        status, 
        entregue_em: status === 'entregue' ? new Date().toISOString() : null 
      }).eq('id', pedidoId);
    } catch { /* ignore */ }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_pedido_status_atualizado', { detail: { pedidoId, status } }));
    }
    return true;
  },

  // 7. Exclusão de pedido: REGRA ESTRITA - apenas Hotel, Recepcionista, Gerente ou Admin
  async excluirPedido(
    pedidoId: string, 
    userRole: string = '', 
    hotelId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const role = (userRole || '').toLowerCase().trim();
    const isAutorizado = 
      role.includes('hotel') || 
      role.includes('recepc') || 
      role.includes('gerente') || 
      role.includes('admin') || 
      role.includes('master');

    if (!isAutorizado) {
      return {
        success: false,
        error: 'Acesso negado: Hóspedes não podem excluir pedidos confirmados. Apenas a recepção ou gerência do hotel pode cancelar ou excluir lançamentos.'
      };
    }

    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const storageKey = getPedidosKey(hId);

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const list: PedidoCardapio[] = JSON.parse(saved);
        const filtered = list.filter(p => p.id !== pedidoId);
        localStorage.setItem(storageKey, JSON.stringify(filtered));
      }
    } catch (e) {
      console.warn('Erro ao excluir pedido local:', e);
    }

    try {
      await supabase.from('pedidos_cardapio').delete().eq('id', pedidoId);
    } catch { /* ignore */ }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_pedido_excluido', { detail: { pedidoId } }));
    }

    return { success: true };
  }
};
