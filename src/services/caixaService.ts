import { supabase } from '../lib/supabase';

export interface CaixaMovimentacao {
  id: string;
  time: string;
  date: string;
  description: string;
  details?: string;
  category: 'Hospedagem' | 'Frigobar' | 'Sangria' | 'Manutenção' | 'Suprimento' | 'Outros';
  categoryIcon: string;
  method: 'PIX' | 'Dinheiro' | 'Débito' | 'Crédito';
  methodIcon: string;
  operator: string;
  type: 'entrada' | 'saida';
  amount: number;
  reservaId?: string;
  quartoNumero?: string;
  hotelId?: string;
}

const STORAGE_KEY_PREFIX = 'hotelnozap_caixa_movimentacoes_';

export const caixaService = {
  _getStorageKey(hotelId?: string): string {
    let hId = hotelId;
    if (typeof window !== 'undefined') {
      try {
        const savedV1 = localStorage.getItem('hotelnozap_current_hotel_v1');
        if (savedV1) {
          const parsed = JSON.parse(savedV1);
          if (parsed?.id) hId = hId || parsed.id;
        }
        const saved = localStorage.getItem('hotelnozap_active_hotel');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.id) hId = hId || parsed.id;
        }
      } catch {}
      if (!hId) {
        hId = localStorage.getItem('hotelnozap_current_hotel_id') || 'default';
      }
    }
    return `${STORAGE_KEY_PREFIX}${hId || 'default'}`;
  },

  getMovimentacoes(hotelId?: string): CaixaMovimentacao[] {
    try {
      if (typeof window === 'undefined') return [];
      const specificKey = this._getStorageKey(hotelId);
      const savedSpecific = localStorage.getItem(specificKey);
      const mapa = new Map<string, CaixaMovimentacao>();

      if (savedSpecific) {
        try {
          const parsed = JSON.parse(savedSpecific);
          if (Array.isArray(parsed)) {
            parsed.forEach((m: CaixaMovimentacao) => {
              if (m.id) mapa.set(m.id, m);
            });
          }
        } catch {}
      }

      // Procura também em todas as outras chaves de movimentações de caixa do localStorage para não perder nada
      try {
        const allKeys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_KEY_PREFIX));
        for (const k of allKeys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              arr.forEach((m: CaixaMovimentacao) => {
                if (m.id && !mapa.has(m.id)) {
                  if (!hotelId || !m.hotelId || m.hotelId === hotelId || m.hotelId === 'default') {
                    mapa.set(m.id, m);
                  }
                }
              });
            }
          }
        }
      } catch {}

      const merged = Array.from(mapa.values());
      // Ordena decrescente por ID timestamp ou data
      merged.sort((a, b) => {
        const timeA = a.id?.startsWith('mov-') ? Number(a.id.split('-')[1]) || 0 : 0;
        const timeB = b.id?.startsWith('mov-') ? Number(b.id.split('-')[1]) || 0 : 0;
        if (timeA && timeB) return timeB - timeA;
        return (b.date || '').localeCompare(a.date || '');
      });

      return merged;
    } catch (err) {
      console.warn('Erro ao ler movimentações do caixa:', err);
    }
    return [];
  },

  saveMovimentacoes(movs: CaixaMovimentacao[], hotelId?: string): void {
    try {
      if (typeof window === 'undefined') return;
      const key = this._getStorageKey(hotelId);
      localStorage.setItem(key, JSON.stringify(movs));

      // Garante espelhamento na chave default para acesso global da recepção
      if (key !== `${STORAGE_KEY_PREFIX}default`) {
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}default`, JSON.stringify(movs));
        } catch {}
      }

      // Dispara eventos para atualização instantânea em todas as telas
      window.dispatchEvent(new CustomEvent('hotel_caixa_atualizado', { detail: movs }));

      try {
        localStorage.setItem('hotel_caixa_trigger', JSON.stringify({
          timestamp: Date.now(),
          hotelId: hotelId || 'default'
        }));
      } catch {}

      if ('BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('hotel_caixa_channel');
          bc.postMessage({ type: 'CAIXA_ATUALIZADO', data: movs });
          bc.close();
        } catch {}
      }
    } catch (err) {
      console.warn('Erro ao salvar movimentações do caixa:', err);
    }
  },

  adicionarMovimentacao(
    mov: Omit<CaixaMovimentacao, 'id' | 'time' | 'date'> & { id?: string; time?: string; date?: string },
    hotelId?: string
  ): CaixaMovimentacao {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const dataFormatada = now.toLocaleDateString('pt-BR');

    const nova: CaixaMovimentacao = {
      id: mov.id || `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      time: mov.time || `${hours}:${mins}`,
      date: mov.date || dataFormatada,
      description: mov.description,
      details: mov.details || '',
      category: mov.category,
      categoryIcon: mov.categoryIcon || (mov.category === 'Hospedagem' ? 'hotel' : mov.category === 'Frigobar' ? 'kitchen' : 'price_change'),
      method: mov.method,
      methodIcon: mov.methodIcon || (mov.method === 'PIX' ? 'qr_code_2' : mov.method === 'Dinheiro' ? 'payments' : mov.method === 'Crédito' ? 'credit_score' : 'credit_card'),
      operator: mov.operator || (typeof window !== 'undefined' ? localStorage.getItem('hotelnozap_user_name') : '') || 'Recepção',
      type: mov.type,
      amount: Number(mov.amount) || 0,
      reservaId: mov.reservaId,
      quartoNumero: mov.quartoNumero,
      hotelId: mov.hotelId || hotelId
    };

    const existentes = this.getMovimentacoes(hotelId);

    // Idempotência: se já existe movimentação de entrada para esta reserva, não duplica
    if (nova.reservaId) {
      const idxExistente = existentes.findIndex(
        m => m.reservaId === nova.reservaId && m.type === 'entrada'
      );
      if (idxExistente !== -1) {
        const jaLancada = existentes[idxExistente];
        if (jaLancada.amount !== nova.amount || jaLancada.description !== nova.description) {
          existentes[idxExistente] = {
            ...jaLancada,
            amount: nova.amount,
            description: nova.description,
            details: nova.details || jaLancada.details,
            method: nova.method || jaLancada.method,
            category: nova.category || jaLancada.category
          };
          this.saveMovimentacoes(existentes, hotelId);
          return existentes[idxExistente];
        }
        return jaLancada;
      }
    }

    const atualizadas = [nova, ...existentes];
    this.saveMovimentacoes(atualizadas, hotelId);

    // Tentar persistir no Supabase caso exista tabela caixa/fluxo_caixa
    try {
      Promise.resolve(
        supabase.from('caixa_movimentacoes').insert([{
          descricao: nova.description,
          detalhes: nova.details,
          categoria: nova.category,
          forma_pagamento: nova.method,
          tipo: nova.type,
          valor: nova.amount,
          operador: nova.operator,
          reserva_id: nova.reservaId || null,
          hotel_id: nova.hotelId || null
        }])
      ).catch(() => {});
    } catch {}

    return nova;
  },

  // Registra automaticamente qualquer reserva concluída como ENTRADA no caixa do dia
  registrarReservaConcluida(reserva: any, hotelId?: string): CaixaMovimentacao | null {
    if (!reserva || !reserva.id) return null;

    const targetHotelId = reserva.hotel_id || hotelId;
    const shortId = reserva.id ? reserva.id.substring(0, 6).toUpperCase() : 'RES';
    const hospede = reserva.hospedeNome || reserva.nome_hospede || 'Hóspede';

    let quartoNum = '';
    if (reserva.numero_quarto) {
      quartoNum = String(reserva.numero_quarto);
    } else if (reserva.quartoNome) {
      quartoNum = reserva.quartoNome.replace(/\D/g, '') || reserva.quartoNome;
    } else {
      quartoNum = '101';
    }

    let valorNum = 0;
    if (typeof reserva.valor_total === 'number') {
      valorNum = reserva.valor_total;
    } else if (typeof reserva.valorTotal === 'number') {
      valorNum = reserva.valorTotal;
    } else if (typeof reserva.valorTotal === 'string') {
      const clean = reserva.valorTotal.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
      valorNum = parseFloat(clean) || 0;
    } else if (typeof reserva.valor_total === 'string') {
      const clean = reserva.valor_total.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
      valorNum = parseFloat(clean) || 0;
    }

    if (valorNum <= 0) return null;

    const fp = (reserva.formaPagamento || reserva.forma_pagamento || 'PIX').toString().toUpperCase();
    let metodo: CaixaMovimentacao['method'] = 'PIX';
    if (fp.includes('DINH') || fp.includes('ESPÉCIE') || fp.includes('ESPECIE') || fp.includes('CASH')) {
      metodo = 'Dinheiro';
    } else if (fp.includes('DÉB') || fp.includes('DEB')) {
      metodo = 'Débito';
    } else if (fp.includes('CRÉD') || fp.includes('CRED') || fp.includes('CART') || fp.includes('CARD')) {
      metodo = 'Crédito';
    } else {
      metodo = 'PIX';
    }

    const noites = reserva.noites || 1;
    const detalhesArray: string[] = [];
    detalhesArray.push(`Check-out #RES-${shortId}`);
    detalhesArray.push(`Quarto ${quartoNum}`);
    detalhesArray.push(`${noites} ${noites === 1 ? 'diária' : 'diárias'} (${metodo})`);
    if (reserva.observacoes || reserva.observacao) {
      detalhesArray.push(`Obs: ${reserva.observacoes || reserva.observacao}`);
    }

    const descricao = `Hospedagem Quarto ${quartoNum} - ${hospede}`;

    return this.adicionarMovimentacao({
      description: descricao,
      details: detalhesArray.join(' | '),
      category: 'Hospedagem',
      categoryIcon: 'hotel',
      method: metodo,
      methodIcon: metodo === 'PIX' ? 'qr_code_2' : metodo === 'Dinheiro' ? 'payments' : metodo === 'Crédito' ? 'credit_score' : 'credit_card',
      operator: (typeof window !== 'undefined' ? localStorage.getItem('hotelnozap_user_name') : '') || 'Recepção',
      type: 'entrada',
      amount: valorNum,
      reservaId: reserva.id,
      quartoNumero: quartoNum,
      hotelId: targetHotelId
    }, targetHotelId);
  },

  // Sincroniza todas as reservas concluídas do banco com o Caixa do Dia
  async sincronizarReservasConcluidasComCaixa(hotelId?: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('reservas')
        .select('*')
        .ilike('status', '%concl%');

      if (error || !data || data.length === 0) return 0;

      let sincronizadas = 0;
      for (const res of data) {
        if (hotelId && res.hotel_id && res.hotel_id !== hotelId) continue;
        const mov = this.registrarReservaConcluida(res, hotelId);
        if (mov) sincronizadas++;
      }
      return sincronizadas;
    } catch (err) {
      console.warn('Erro ao sincronizar reservas concluídas com o caixa:', err);
      return 0;
    }
  },

  // Registra a entrada no caixa sincronizada com o check-out de estadias
  registrarRecebimentoCheckout(dados: {
    reservaId: string;
    reservaNumber: string;
    hospedeNome: string;
    quartoNumero: string;
    valorDiarias: number;
    valorConsumo?: number;
    valorDesconto?: number;
    valorTotal: number;
    metodo: 'PIX' | 'Dinheiro' | 'Débito' | 'Crédito';
    operador?: string;
    observacoes?: string;
    hotelId?: string;
  }): CaixaMovimentacao {
    const detalhesArray: string[] = [];
    detalhesArray.push(`Check-out ${dados.reservaNumber}`);
    detalhesArray.push(`Quarto ${dados.quartoNumero}`);
    detalhesArray.push(`Diárias: R$ ${dados.valorDiarias.toFixed(2)}`);

    if (dados.valorConsumo && dados.valorConsumo > 0) {
      detalhesArray.push(`Consumo Frigobar/Extras: R$ ${dados.valorConsumo.toFixed(2)}`);
    }
    if (dados.valorDesconto && dados.valorDesconto > 0) {
      detalhesArray.push(`Desconto concedido: -R$ ${dados.valorDesconto.toFixed(2)}`);
    }
    if (dados.observacoes) {
      detalhesArray.push(`Obs: ${dados.observacoes}`);
    }

    const descricao = `Hospedagem Quarto ${dados.quartoNumero} - ${dados.hospedeNome}`;

    return this.adicionarMovimentacao({
      description: descricao,
      details: detalhesArray.join(' | '),
      category: 'Hospedagem',
      categoryIcon: 'hotel',
      method: dados.metodo,
      methodIcon: dados.metodo === 'PIX' ? 'qr_code_2' : dados.metodo === 'Dinheiro' ? 'payments' : dados.metodo === 'Crédito' ? 'credit_score' : 'credit_card',
      operator: dados.operador || 'Recepção',
      type: 'entrada',
      amount: dados.valorTotal,
      reservaId: dados.reservaId,
      quartoNumero: dados.quartoNumero,
      hotelId: dados.hotelId
    }, dados.hotelId);
  },

  // Registra a entrada no caixa sincronizada com o check-in na entrada do hóspede
  registrarRecebimentoCheckin(dados: {
    reservaId: string;
    reservaNumber: string;
    hospedeNome: string;
    quartoNumero: string;
    valorTotal: number;
    metodo: 'PIX' | 'Dinheiro' | 'Débito' | 'Crédito';
    operador?: string;
    observacoes?: string;
    hotelId?: string;
  }): CaixaMovimentacao {
    const detalhesArray: string[] = [];
    detalhesArray.push(`Check-in ${dados.reservaNumber}`);
    detalhesArray.push(`Quarto ${dados.quartoNumero}`);
    detalhesArray.push(`Diária paga na entrada via ${dados.metodo}`);
    if (dados.observacoes) {
      detalhesArray.push(`Obs: ${dados.observacoes}`);
    }

    const descricao = `Check-in Quarto ${dados.quartoNumero} - ${dados.hospedeNome}`;

    return this.adicionarMovimentacao({
      description: descricao,
      details: detalhesArray.join(' | '),
      category: 'Hospedagem',
      categoryIcon: 'hotel',
      method: dados.metodo,
      methodIcon: dados.metodo === 'PIX' ? 'qr_code_2' : dados.metodo === 'Dinheiro' ? 'payments' : dados.metodo === 'Crédito' ? 'credit_score' : 'credit_card',
      operator: dados.operador || 'Recepção',
      type: 'entrada',
      amount: dados.valorTotal,
      reservaId: dados.reservaId,
      quartoNumero: dados.quartoNumero,
      hotelId: dados.hotelId
    }, dados.hotelId);
  }
};
