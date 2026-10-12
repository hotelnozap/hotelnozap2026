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
const EXCLUIDOS_KEY = 'hotelnozap_caixa_excluidos_ids';

function isValidUUID(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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

  getExcluidosIds(): Set<string> {
    const set = new Set<string>();
    if (typeof window === 'undefined') return set;
    try {
      const raw = localStorage.getItem(EXCLUIDOS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach(id => {
            if (id) set.add(String(id));
          });
        }
      }
    } catch {}
    return set;
  },

  adicionarExcluidoId(id: string): void {
    if (!id || typeof window === 'undefined') return;
    try {
      const set = this.getExcluidosIds();
      set.add(String(id));
      localStorage.setItem(EXCLUIDOS_KEY, JSON.stringify(Array.from(set)));
    } catch {}
  },

  getMovimentacoes(hotelId?: string): CaixaMovimentacao[] {
    try {
      if (typeof window === 'undefined') return [];
      const specificKey = this._getStorageKey(hotelId);
      const savedSpecific = localStorage.getItem(specificKey);
      const mapa = new Map<string, CaixaMovimentacao>();
      const excluidos = this.getExcluidosIds();

      if (savedSpecific) {
        try {
          const parsed = JSON.parse(savedSpecific);
          if (Array.isArray(parsed)) {
            parsed.forEach((m: CaixaMovimentacao) => {
              if (m.id && !excluidos.has(m.id) && (!m.reservaId || !excluidos.has(m.reservaId))) {
                if (!hotelId || !m.hotelId || m.hotelId === hotelId) {
                  mapa.set(m.id, m);
                }
              }
            });
          }
        } catch {}
      }

      // Procura com isolamento de tenant em chaves legadas se hotelId for compatível
      try {
        const allKeys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_KEY_PREFIX));
        for (const k of allKeys) {
          if (hotelId && hotelId !== 'default' && k !== specificKey && k !== `${STORAGE_KEY_PREFIX}default`) {
            continue;
          }
          const raw = localStorage.getItem(k);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              arr.forEach((m: CaixaMovimentacao) => {
                if (m.id && !mapa.has(m.id) && !excluidos.has(m.id) && (!m.reservaId || !excluidos.has(m.reservaId))) {
                  if (!hotelId || m.hotelId === hotelId) {
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

  async carregarMovimentacoesDoBanco(hotelId?: string): Promise<CaixaMovimentacao[]> {
    try {
      let query = supabase
        .from('caixa_movimentacoes')
        .select('*')
        .eq('excluido', false)
        .order('criado_em', { ascending: false });

      if (hotelId && hotelId !== 'default' && isValidUUID(hotelId)) {
        query = query.or(`hotel_id.eq.${hotelId},hotel_id.is.null`);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Erro ao carregar movimentações do Supabase:', error);
        return this.getMovimentacoes(hotelId);
      }

      if (data) {
        const excluidos = this.getExcluidosIds();
        const mapa = new Map<string, CaixaMovimentacao>();
        data.forEach((row: any) => {
          if (excluidos.has(row.id) || (row.reserva_id && excluidos.has(row.reserva_id))) {
            return;
          }
          const m: CaixaMovimentacao = {
            id: row.id,
            time: row.hora || (row.criado_em ? new Date(row.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '12:00'),
            date: row.data || (row.criado_em ? new Date(row.criado_em).toLocaleDateString('pt-BR') : 'Hoje'),
            description: row.descricao,
            details: row.detalhes || '',
            category: row.categoria || 'Hospedagem',
            categoryIcon: row.categoria_icone || (row.categoria === 'Hospedagem' ? 'hotel' : row.categoria === 'Frigobar' ? 'kitchen' : row.categoria === 'Sangria' ? 'outbox' : 'price_change'),
            method: row.forma_pagamento || 'Dinheiro',
            methodIcon: row.metodo_icone || (row.forma_pagamento === 'PIX' ? 'qr_code_2' : row.forma_pagamento === 'Dinheiro' ? 'payments' : row.forma_pagamento === 'Crédito' ? 'credit_score' : 'credit_card'),
            operator: row.operador || 'Recepção',
            type: row.tipo || 'entrada',
            amount: Number(row.valor) || 0,
            reservaId: row.reserva_id || undefined,
            hotelId: row.hotel_id || undefined
          };
          mapa.set(m.id, m);
        });

        // Mescla com locais que ainda não subiram para o banco
        const locais = this.getMovimentacoes(hotelId);
        locais.forEach(l => {
          if (!mapa.has(l.id) && !excluidos.has(l.id) && (!l.reservaId || !excluidos.has(l.reservaId))) {
            mapa.set(l.id, l);
            this._sincronizarComSupabase(l);
          }
        });

        const listaFinal = Array.from(mapa.values());
        this.saveMovimentacoes(listaFinal, hotelId);
        return listaFinal;
      }
    } catch (err) {
      console.warn('Erro ao carregar movimentações do banco:', err);
    }
    return this.getMovimentacoes(hotelId);
  },

  saveMovimentacoes(movs: CaixaMovimentacao[], hotelId?: string): void {
    try {
      if (typeof window === 'undefined') return;
      const key = this._getStorageKey(hotelId);
      localStorage.setItem(key, JSON.stringify(movs));

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

    const idFinal = (mov.id && isValidUUID(mov.id)) ? mov.id : generateUUID();

    const nova: CaixaMovimentacao = {
      id: idFinal,
      time: mov.time || `${hours}:${mins}`,
      date: mov.date || dataFormatada,
      description: mov.description,
      details: mov.details || '',
      category: mov.category,
      categoryIcon: mov.categoryIcon || (mov.category === 'Hospedagem' ? 'hotel' : mov.category === 'Frigobar' ? 'kitchen' : mov.category === 'Sangria' ? 'outbox' : 'price_change'),
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

    // Idempotência: se já existe movimentação de entrada para esta reserva, atualiza se necessário
    if (nova.reservaId) {
      const idxExistente = existentes.findIndex(
        m => m.reservaId === nova.reservaId && m.type === 'entrada'
      );
      if (idxExistente !== -1) {
        const jaLancada = existentes[idxExistente];
        if (jaLancada.amount !== nova.amount || jaLancada.description !== nova.description || jaLancada.method !== nova.method) {
          existentes[idxExistente] = {
            ...jaLancada,
            amount: nova.amount,
            description: nova.description,
            details: nova.details || jaLancada.details,
            method: nova.method || jaLancada.method,
            category: nova.category || jaLancada.category
          };
          this.saveMovimentacoes(existentes, hotelId);
          this._sincronizarComSupabase(existentes[idxExistente]);
          return existentes[idxExistente];
        }
        return jaLancada;
      }
    }

    const atualizadas = [nova, ...existentes.filter(m => m.id !== nova.id)];
    this.saveMovimentacoes(atualizadas, hotelId);
    this._sincronizarComSupabase(nova);

    return nova;
  },

  async atualizarMovimentacao(mov: CaixaMovimentacao, hotelId?: string): Promise<void> {
    try {
      const existentes = this.getMovimentacoes(hotelId);
      const atualizadas = existentes.map(m => (m.id === mov.id ? { ...m, ...mov } : m));
      this.saveMovimentacoes(atualizadas, hotelId);

      if (isValidUUID(mov.id)) {
        await supabase
          .from('caixa_movimentacoes')
          .update({
            descricao: mov.description,
            detalhes: mov.details || '',
            categoria: mov.category,
            categoria_icone: mov.categoryIcon,
            forma_pagamento: mov.method,
            metodo_icone: mov.methodIcon,
            tipo: mov.type,
            valor: Number(mov.amount) || 0,
            operador: mov.operator
          })
          .eq('id', mov.id);
      }
    } catch (err) {
      console.warn('Erro ao atualizar movimentação no banco:', err);
    }
  },

  async excluirMovimentacao(id: string, hotelId?: string, reservaId?: string): Promise<void> {
    if (!id) return;
    this.adicionarExcluidoId(id);
    if (reservaId) {
      this.adicionarExcluidoId(reservaId);
    }

    // 1. Remove de todas as chaves de localStorage
    try {
      if (typeof window !== 'undefined') {
        const allKeys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_KEY_PREFIX));
        for (const k of allKeys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const arr = JSON.parse(raw);
              if (Array.isArray(arr)) {
                const filtrados = arr.filter((m: any) => m.id !== id && (!reservaId || m.reservaId !== reservaId));
                localStorage.setItem(k, JSON.stringify(filtrados));
              }
            } catch {}
          }
        }
      }
    } catch {}

    // 2. Exclui do Supabase (marca como excluido: true E tenta deletar permanentemente)
    try {
      if (isValidUUID(id)) {
        await supabase.from('caixa_movimentacoes').update({ excluido: true }).eq('id', id);
        await supabase.from('caixa_movimentacoes').delete().eq('id', id);
      }
      if (reservaId && isValidUUID(reservaId)) {
        await supabase.from('caixa_movimentacoes').update({ excluido: true }).eq('reserva_id', reservaId);
        await supabase.from('caixa_movimentacoes').delete().eq('reserva_id', reservaId);
      }
    } catch (err) {
      console.warn('Aviso ao excluir movimentação no Supabase:', err);
    }

    // 3. Dispara eventos de atualização imediata na interface
    const restantes = this.getMovimentacoes(hotelId);
    this.saveMovimentacoes(restantes, hotelId);
  },

  _sincronizarComSupabase(nova: CaixaMovimentacao): void {
    try {
      const dbPayload: any = {
        id: nova.id,
        descricao: nova.description,
        detalhes: nova.details || '',
        categoria: nova.category,
        categoria_icone: nova.categoryIcon,
        forma_pagamento: nova.method,
        metodo_icone: nova.methodIcon,
        tipo: nova.type,
        valor: nova.amount,
        operador: nova.operator,
        data: nova.date,
        hora: nova.time,
        excluido: false
      };
      if (isValidUUID(nova.hotelId)) dbPayload.hotel_id = nova.hotelId;
      if (isValidUUID(nova.reservaId)) dbPayload.reserva_id = nova.reservaId;

      Promise.resolve(
        supabase
          .from('caixa_movimentacoes')
          .upsert([dbPayload], { onConflict: 'id' })
      )
        .then(() => {})
        .catch((err: any) => console.warn('Aviso ao sincronizar movimentação no Supabase:', err));
    } catch {}
  },

  // Registra automaticamente qualquer reserva concluída como ENTRADA no caixa do dia
  registrarReservaConcluida(reserva: any, hotelId?: string, formaPagamentoForcada?: string): CaixaMovimentacao | null {
    if (!reserva || !reserva.id) return null;

    // Se o usuário já excluiu essa reserva do caixa, JAMAIS reinserir
    const excluidos = this.getExcluidosIds();
    if (excluidos.has(reserva.id)) return null;

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

    // Identificação precisa da forma de pagamento oficial (Dinheiro, PIX, Débito, Crédito)
    const rawFp = (formaPagamentoForcada || reserva.forma_pagamento || reserva.formaPagamento || 'Dinheiro').toString().trim().toUpperCase();
    let metodo: CaixaMovimentacao['method'] = 'Dinheiro';
    if (rawFp.includes('DINH') || rawFp.includes('ESP') || rawFp.includes('CASH')) {
      metodo = 'Dinheiro';
    } else if (rawFp.includes('PIX')) {
      metodo = 'PIX';
    } else if (rawFp.includes('DÉB') || rawFp.includes('DEB')) {
      metodo = 'Débito';
    } else if (rawFp.includes('CRÉD') || rawFp.includes('CRED') || rawFp.includes('CART') || rawFp.includes('CARD')) {
      metodo = 'Crédito';
    } else {
      metodo = 'Dinheiro';
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
      const excluidos = this.getExcluidosIds();

      // Busca reservas que já possuem lançamento no caixa (no banco ou localmente)
      const existingReservaIds = new Set<string>();

      try {
        const { data: dbMovs } = await supabase
          .from('caixa_movimentacoes')
          .select('reserva_id')
          .not('reserva_id', 'is', null);

        if (dbMovs) {
          dbMovs.forEach(m => {
            if (m.reserva_id) existingReservaIds.add(m.reserva_id);
          });
        }
      } catch {}

      const locais = this.getMovimentacoes(hotelId);
      locais.forEach(m => {
        if (m.reservaId) existingReservaIds.add(m.reservaId);
      });

      // Busca apenas reservas concluídas (hospedagem completa)
      const { data, error } = await supabase
        .from('reservas')
        .select('*')
        .ilike('status', '%concl%');

      if (error || !data || data.length === 0) {
        await this.carregarMovimentacoesDoBanco(hotelId);
        return 0;
      }

      let sincronizadas = 0;
      for (const res of data) {
        if (!res.id) continue;
        // Se a reserva foi excluída pelo usuário do caixa, não reinserir
        if (excluidos.has(res.id)) continue;
        // Se já foi lançada no caixa, não reinserir
        if (existingReservaIds.has(res.id)) continue;
        if (hotelId && res.hotel_id && res.hotel_id !== hotelId) continue;

        const mov = this.registrarReservaConcluida(res, hotelId);
        if (mov) {
          sincronizadas++;
          existingReservaIds.add(res.id);
        }
      }

      await this.carregarMovimentacoesDoBanco(hotelId);
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
    detalhesArray.push(`Diárias: R$ ${dados.valorDiarias.toFixed(2)} (${dados.metodo})`);

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

  // Mantido para compatibilidade, mas regra oficial: apenas hospedagens concluídas vão para o caixa
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
