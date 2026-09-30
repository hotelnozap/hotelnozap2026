import { supabase } from '../lib/supabase';
import { currentHotelService } from './supabaseService';

export interface CupomDesconto {
  id: string;
  hotel_id?: string;
  hotel_nome?: string;
  hotel_cidade?: string;
  codigo: string;
  tipo_desconto: 'porcentagem' | 'fixo'; // 'porcentagem' (%) ou 'fixo' (R$)
  valor_desconto: number;
  valor_minimo_reserva?: number;
  data_inicio: string; // YYYY-MM-DD
  data_expiracao?: string | null; // YYYY-MM-DD ou null para cupons permanentes (sem expiração)
  limite_usos?: number | null; // null ou indefinido = ilimitado
  usos_atuais: number;
  status: 'Ativo' | 'Inativo';
  visivel_hospedes: boolean;
  descricao?: string;
  created_at?: string;
}

export interface ValidacaoCupomResult {
  valido: boolean;
  mensagem: string;
  cupom?: CupomDesconto;
  valorDesconto?: number;
  novoTotal?: number;
}

const STORAGE_KEY = 'hotelnozap_cupons_desconto_v1';

// Cupons padrão para demonstração inicial e fallback offline
const CUPONS_PADRAO: CupomDesconto[] = [
  {
    id: 'cupom-verao-2026',
    hotel_id: 'hotel-demo-01',
    hotel_nome: 'Hotel Solar das Águas',
    hotel_cidade: 'Porto de Galinhas / PE',
    codigo: 'VERAO10',
    tipo_desconto: 'porcentagem',
    valor_desconto: 10,
    valor_minimo_reserva: 200,
    data_inicio: '2026-01-01',
    data_expiracao: '2026-12-31',
    limite_usos: 100,
    usos_atuais: 14,
    status: 'Ativo',
    visivel_hospedes: true,
    descricao: '10% de desconto especial em reservas acima de R$ 200,00 para a temporada de férias.',
    created_at: new Date().toISOString()
  },
  {
    id: 'cupom-bem-vindo',
    hotel_id: 'hotel-demo-01',
    hotel_nome: 'Hotel Solar das Águas',
    hotel_cidade: 'Porto de Galinhas / PE',
    codigo: 'BEMVINDO50',
    tipo_desconto: 'fixo',
    valor_desconto: 50,
    valor_minimo_reserva: 350,
    data_inicio: '2026-01-01',
    data_expiracao: '2026-12-31',
    limite_usos: 50,
    usos_atuais: 8,
    status: 'Ativo',
    visivel_hospedes: true,
    descricao: 'R$ 50,00 OFF na sua primeira hospedagem para reservas a partir de R$ 350,00.',
    created_at: new Date().toISOString()
  },
  {
    id: 'cupom-vip-resort',
    hotel_id: 'hotel-demo-02',
    hotel_nome: 'Resort & Spa Estrela do Mar',
    hotel_cidade: 'Maragogi / AL',
    codigo: 'VIPESTRELA',
    tipo_desconto: 'porcentagem',
    valor_desconto: 15,
    valor_minimo_reserva: 500,
    data_inicio: '2026-01-01',
    data_expiracao: '2026-11-30',
    limite_usos: null,
    usos_atuais: 23,
    status: 'Ativo',
    visivel_hospedes: true,
    descricao: '15% de desconto para todas as suítes e bangalôs em reservas a partir de R$ 500,00.',
    created_at: new Date().toISOString()
  },
  {
    id: 'cupom-fim-semana',
    hotel_id: 'hotel-demo-03',
    hotel_nome: 'Pousada Recanto da Serra',
    hotel_cidade: 'Campos do Jordão / SP',
    codigo: 'FIMDESEMANA',
    tipo_desconto: 'fixo',
    valor_desconto: 40,
    valor_minimo_reserva: 280,
    data_inicio: '2026-02-01',
    data_expiracao: '2026-12-15',
    limite_usos: 80,
    usos_atuais: 32,
    status: 'Ativo',
    visivel_hospedes: true,
    descricao: 'R$ 40,00 de desconto promocional para reservas de finais de semana acima de R$ 280,00.',
    created_at: new Date().toISOString()
  }
];

const loadFromStorage = (): CupomDesconto[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(CUPONS_PADRAO));
      return CUPONS_PADRAO;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((c: CupomDesconto) => ({
        ...c,
        hotel_cidade: c.hotel_cidade || (
          c.hotel_nome?.includes('Solar') ? 'Porto de Galinhas / PE' :
          c.hotel_nome?.includes('Estrela') ? 'Maragogi / AL' :
          c.hotel_nome?.includes('Serra') ? 'Campos do Jordão / SP' :
          'Porto de Galinhas / PE'
        )
      }));
    }
    return CUPONS_PADRAO;
  } catch (err) {
    console.warn('Erro ao carregar cupons do localStorage:', err);
    return CUPONS_PADRAO;
  }
};

const saveToStorage = (cupons: CupomDesconto[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cupons));
  } catch (err) {
    console.warn('Erro ao salvar cupons no localStorage:', err);
  }
};

export const cuponsService = {
  /**
   * Obtém a lista de cupons de um hotel específico (ou do hotel atualmente conectado)
   */
  async getCuponsHotel(hotelId?: string): Promise<CupomDesconto[]> {
    const targetHotelId = hotelId || currentHotelService.getCurrentHotel()?.id;

    try {
      let query = supabase.from('cupons_desconto').select('*').order('created_at', { ascending: false });
      if (targetHotelId) {
        query = query.or(`hotel_id.eq.${targetHotelId},hotel_id.is.null`);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        // Mapear campos caso venham em snake_case do Supabase
        const mapped: CupomDesconto[] = data.map((d: any) => ({
          id: d.id,
          hotel_id: d.hotel_id,
          hotel_nome: d.hotel_nome,
          hotel_cidade: d.hotel_cidade || (
            d.hotel_nome?.includes('Solar') ? 'Porto de Galinhas / PE' :
            d.hotel_nome?.includes('Estrela') ? 'Maragogi / AL' :
            d.hotel_nome?.includes('Serra') ? 'Campos do Jordão / SP' :
            'Porto de Galinhas / PE'
          ),
          codigo: d.codigo,
          tipo_desconto: d.tipo_desconto,
          valor_desconto: Number(d.valor_desconto) || 0,
          valor_minimo_reserva: d.valor_minimo_reserva !== null ? Number(d.valor_minimo_reserva) : 0,
          data_inicio: d.data_inicio,
          data_expiracao: d.data_expiracao,
          limite_usos: d.limite_usos !== null ? Number(d.limite_usos) : null,
          usos_atuais: Number(d.usos_atuais) || 0,
          status: d.status || 'Ativo',
          visivel_hospedes: d.visivel_hospedes !== false,
          descricao: d.descricao || '',
          created_at: d.created_at
        }));
        saveToStorage(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('Supabase offline para cupons_desconto. Usando localStorage:', err);
    }

    // Fallback LocalStorage
    const local = loadFromStorage();
    if (!targetHotelId) return local;
    return local.filter(c => !c.hotel_id || c.hotel_id === targetHotelId || c.hotel_id.includes('demo'));
  },

  /**
   * Obtém todos os cupons públicos e ativos de todos os hotéis para a área do hóspede
   */
  async getTodosCuponsPublicos(): Promise<CupomDesconto[]> {
    try {
      const { data, error } = await supabase
        .from('cupons_desconto')
        .select('*')
        .eq('status', 'Ativo')
        .eq('visivel_hospedes', true)
        .order('valor_desconto', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((d: any) => ({
          id: d.id,
          hotel_id: d.hotel_id,
          hotel_nome: d.hotel_nome,
          hotel_cidade: d.hotel_cidade || (
            d.hotel_nome?.includes('Solar') ? 'Porto de Galinhas / PE' :
            d.hotel_nome?.includes('Estrela') ? 'Maragogi / AL' :
            d.hotel_nome?.includes('Serra') ? 'Campos do Jordão / SP' :
            'Porto de Galinhas / PE'
          ),
          codigo: d.codigo,
          tipo_desconto: d.tipo_desconto,
          valor_desconto: Number(d.valor_desconto) || 0,
          valor_minimo_reserva: d.valor_minimo_reserva !== null ? Number(d.valor_minimo_reserva) : 0,
          data_inicio: d.data_inicio,
          data_expiracao: d.data_expiracao,
          limite_usos: d.limite_usos !== null ? Number(d.limite_usos) : null,
          usos_atuais: Number(d.usos_atuais) || 0,
          status: d.status || 'Ativo',
          visivel_hospedes: d.visivel_hospedes !== false,
          descricao: d.descricao || '',
          created_at: d.created_at
        }));
      }
    } catch (err) {
      console.warn('Supabase offline ao buscar cupons públicos. Usando fallback:', err);
    }

    const local = loadFromStorage();
    return local.filter(c => c.status === 'Ativo' && c.visivel_hospedes);
  },

  /**
   * Valida se um código de cupom é válido para um hotel e valor de reserva
   */
  async validarCupom(codigo: string, hotelId?: string, valorTotal: number = 0): Promise<ValidacaoCupomResult> {
    if (!codigo || !codigo.trim()) {
      return { valido: false, mensagem: 'Informe o código do cupom de desconto.' };
    }

    const cleanCode = codigo.trim().toUpperCase();
    const today = new Date().toISOString().split('T')[0];

    // Busca cupom no Supabase ou LocalStorage
    let cupom: CupomDesconto | null = null;
    try {
      const { data, error } = await supabase
        .from('cupons_desconto')
        .select('*')
        .ilike('codigo', cleanCode)
        .maybeSingle();

      if (!error && data) {
        cupom = {
          id: data.id,
          hotel_id: data.hotel_id,
          hotel_nome: data.hotel_nome,
          hotel_cidade: data.hotel_cidade || '',
          codigo: data.codigo,
          tipo_desconto: data.tipo_desconto,
          valor_desconto: Number(data.valor_desconto) || 0,
          valor_minimo_reserva: data.valor_minimo_reserva !== null ? Number(data.valor_minimo_reserva) : 0,
          data_inicio: data.data_inicio,
          data_expiracao: data.data_expiracao,
          limite_usos: data.limite_usos !== null ? Number(data.limite_usos) : null,
          usos_atuais: Number(data.usos_atuais) || 0,
          status: data.status || 'Ativo',
          visivel_hospedes: data.visivel_hospedes !== false,
          descricao: data.descricao || '',
          created_at: data.created_at
        };
      }
    } catch (err) {
      console.warn('Erro ao validar cupom via Supabase:', err);
    }

    if (!cupom) {
      const local = loadFromStorage();
      cupom = local.find(c => c.codigo.toUpperCase() === cleanCode) || null;
    }

    if (!cupom) {
      return { valido: false, mensagem: `Cupom "${cleanCode}" não encontrado ou inválido.` };
    }

    // 1. Validação de Status
    if (cupom.status !== 'Ativo') {
      return { valido: false, mensagem: `O cupom "${cleanCode}" está inativo no momento.` };
    }

    // 2. Validação de Hotel (se o cupom for exclusivo de outro hotel)
    if (cupom.hotel_id && hotelId && cupom.hotel_id !== hotelId && !cupom.hotel_id.includes('demo')) {
      return {
        valido: false,
        mensagem: `Este cupom é exclusivo do estabelecimento "${cupom.hotel_nome || 'outro hotel'}".`
      };
    }

    // 3. Validação de Data de Validade
    if (cupom.data_inicio && today < cupom.data_inicio) {
      return {
        valido: false,
        mensagem: `Este cupom só será válido a partir de ${new Date(cupom.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}.`
      };
    }
    if (cupom.data_expiracao && today > cupom.data_expiracao) {
      return {
        valido: false,
        mensagem: `O cupom "${cleanCode}" expirou em ${new Date(cupom.data_expiracao + 'T00:00:00').toLocaleDateString('pt-BR')}.`
      };
    }

    // 4. Validação de Limite de Utilizações
    if (cupom.limite_usos && cupom.limite_usos > 0 && cupom.usos_atuais >= cupom.limite_usos) {
      return {
        valido: false,
        mensagem: `O cupom "${cleanCode}" atingiu o limite máximo de utilizações (${cupom.limite_usos}).`
      };
    }

    // 5. Validação de Valor Mínimo de Reserva
    if (cupom.valor_minimo_reserva && cupom.valor_minimo_reserva > 0 && valorTotal < cupom.valor_minimo_reserva) {
      return {
        valido: false,
        mensagem: `Este cupom exige um valor mínimo de reserva de R$ ${cupom.valor_minimo_reserva.toFixed(2).replace('.', ',')}.`
      };
    }

    // 6. Cálculo do Desconto
    let valorDesconto = 0;
    if (cupom.tipo_desconto === 'porcentagem') {
      valorDesconto = (valorTotal * cupom.valor_desconto) / 100;
    } else {
      valorDesconto = Math.min(valorTotal, cupom.valor_desconto);
    }

    const novoTotal = Math.max(0, valorTotal - valorDesconto);

    return {
      valido: true,
      mensagem: `Cupom "${cleanCode}" aplicado com sucesso! Desconto de ${
        cupom.tipo_desconto === 'porcentagem'
          ? `${cupom.valor_desconto}% (-R$ ${valorDesconto.toFixed(2).replace('.', ',')})`
          : `R$ ${valorDesconto.toFixed(2).replace('.', ',')}`
      }.`,
      cupom,
      valorDesconto,
      novoTotal
    };
  },

  /**
   * Cria um novo cupom no Supabase e sincroniza no localStorage
   */
  async createCupom(novoCupom: Partial<CupomDesconto>): Promise<CupomDesconto> {
    const current = currentHotelService.getCurrentHotel();
    const payload: Partial<CupomDesconto> = {
      id: `cupom-${Date.now()}`,
      hotel_id: novoCupom.hotel_id || current?.id || 'hotel-local',
      hotel_nome: novoCupom.hotel_nome || current?.name || 'Hotel Parceiro',
      hotel_cidade: novoCupom.hotel_cidade || current?.cityUf || current?.city || 'Porto de Galinhas / PE',
      codigo: (novoCupom.codigo || 'DESC10').trim().toUpperCase(),
      tipo_desconto: novoCupom.tipo_desconto || 'porcentagem',
      valor_desconto: Number(novoCupom.valor_desconto) || 10,
      valor_minimo_reserva: novoCupom.valor_minimo_reserva ? Number(novoCupom.valor_minimo_reserva) : 0,
      data_inicio: novoCupom.data_inicio || new Date().toISOString().split('T')[0],
      data_expiracao: novoCupom.data_expiracao ? novoCupom.data_expiracao : null,
      limite_usos: novoCupom.limite_usos ? Number(novoCupom.limite_usos) : null,
      usos_atuais: 0,
      status: novoCupom.status || 'Ativo',
      visivel_hospedes: novoCupom.visivel_hospedes !== false,
      descricao: novoCupom.descricao || '',
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('cupons_desconto')
        .insert([payload])
        .select()
        .single();

      if (!error && data) {
        payload.id = data.id;
      }
    } catch (err) {
      console.warn('Erro ao inserir cupom no Supabase. Salvando localmente:', err);
    }

    const currentList = loadFromStorage();
    const updated = [payload as CupomDesconto, ...currentList.filter(c => c.id !== payload.id)];
    saveToStorage(updated);

    return payload as CupomDesconto;
  },

  /**
   * Atualiza um cupom existente
   */
  async updateCupom(id: string, updates: Partial<CupomDesconto>): Promise<boolean> {
    const cleanUpdates = { ...updates };
    if (cleanUpdates.codigo) {
      cleanUpdates.codigo = cleanUpdates.codigo.trim().toUpperCase();
    }

    try {
      await supabase
        .from('cupons_desconto')
        .update(cleanUpdates)
        .eq('id', id);
    } catch (err) {
      console.warn('Erro ao atualizar cupom no Supabase:', err);
    }

    const currentList = loadFromStorage();
    const updated = currentList.map(c => (c.id === id ? { ...c, ...cleanUpdates } : c));
    saveToStorage(updated);

    return true;
  },

  /**
   * Exclui um cupom
   */
  async deleteCupom(id: string): Promise<boolean> {
    try {
      await supabase.from('cupons_desconto').delete().eq('id', id);
    } catch (err) {
      console.warn('Erro ao excluir cupom no Supabase:', err);
    }

    const currentList = loadFromStorage();
    const updated = currentList.filter(c => c.id !== id);
    saveToStorage(updated);

    return true;
  },

  /**
   * Incrementa o contador de utilizações de um cupom
   */
  async registrarUsoCupom(id: string): Promise<void> {
    const currentList = loadFromStorage();
    const cupom = currentList.find(c => c.id === id);
    if (!cupom) return;

    const novosUsos = (cupom.usos_atuais || 0) + 1;

    try {
      await supabase
        .from('cupons_desconto')
        .update({ usos_atuais: novosUsos })
        .eq('id', id);
    } catch (err) {
      console.warn('Erro ao incrementar uso do cupom no Supabase:', err);
    }

    const updated = currentList.map(c => (c.id === id ? { ...c, usos_atuais: novosUsos } : c));
    saveToStorage(updated);
  }
};
