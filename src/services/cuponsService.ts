import { supabase } from '../lib/supabase';
import { currentHotelService } from './supabaseService';

export type EscopoCupom = 'todos' | 'reserva' | 'plano_hotel' | 'parceiro';

export interface CupomDesconto {
  id: string;
  hotel_id?: string | null;
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
  aplicavel_em?: EscopoCupom; // 'todos' | 'reserva' | 'plano_hotel' | 'parceiro'
  created_at?: string;
}

export interface ValidacaoCupomResult {
  valido: boolean;
  mensagem: string;
  cupom?: CupomDesconto;
  valorDesconto?: number;
  novoTotal?: number;
}

const STORAGE_KEY = 'hotelnozap_cupons_desconto_v3';

// Cupons padrão para demonstração inicial e fallback offline (Hotéis, Parceiros e Reservas)
const CUPONS_PADRAO: CupomDesconto[] = [
  // Cupons da Plataforma para Cadastro de Hotéis (Planos SaaS)
  {
    id: 'cupom-hotel-100',
    hotel_id: null,
    hotel_nome: 'Plataforma Hotel no Zap',
    codigo: 'HOTEL100',
    tipo_desconto: 'porcentagem',
    valor_desconto: 100,
    valor_minimo_reserva: 0,
    data_inicio: '2026-01-01',
    data_expiracao: null,
    limite_usos: 100,
    usos_atuais: 0,
    status: 'Ativo',
    visivel_hospedes: false,
    aplicavel_em: 'plano_hotel',
    descricao: '100% de desconto (Gratuidade Total) no cadastro de novos hotéis e pousadas na contratação de planos.',
    created_at: new Date().toISOString()
  },
  {
    id: 'cupom-hotel-50',
    hotel_id: null,
    hotel_nome: 'Plataforma Hotel no Zap',
    codigo: 'HOTEL50',
    tipo_desconto: 'porcentagem',
    valor_desconto: 50,
    valor_minimo_reserva: 0,
    data_inicio: '2026-01-01',
    data_expiracao: null,
    limite_usos: 200,
    usos_atuais: 5,
    status: 'Ativo',
    visivel_hospedes: false,
    aplicavel_em: 'plano_hotel',
    descricao: '50% de desconto no cadastro de novos hotéis e pousadas na contratação de planos.',
    created_at: new Date().toISOString()
  },
  {
    id: 'cupom-hotel-100off',
    hotel_id: null,
    hotel_nome: 'Plataforma Hotel no Zap',
    codigo: 'HOTEL100OFF',
    tipo_desconto: 'fixo',
    valor_desconto: 100,
    valor_minimo_reserva: 150,
    data_inicio: '2026-01-01',
    data_expiracao: null,
    limite_usos: 100,
    usos_atuais: 2,
    status: 'Ativo',
    visivel_hospedes: false,
    aplicavel_em: 'plano_hotel',
    descricao: 'R$ 100,00 de desconto no primeiro pagamento da assinatura do plano hoteleiro.',
    created_at: new Date().toISOString()
  },

  // Cupons da Plataforma para Cadastro de Parceiros / Franqueados
  {
    id: 'cupom-parceiro-100',
    hotel_id: null,
    hotel_nome: 'Plataforma Hotel no Zap',
    codigo: 'PARCEIRO100',
    tipo_desconto: 'porcentagem',
    valor_desconto: 100,
    valor_minimo_reserva: 0,
    data_inicio: '2026-01-01',
    data_expiracao: null,
    limite_usos: 50,
    usos_atuais: 0,
    status: 'Ativo',
    visivel_hospedes: false,
    aplicavel_em: 'parceiro',
    descricao: '100% de desconto (Gratuidade Total) na taxa de ativação da licença de parceiro franqueado.',
    created_at: new Date().toISOString()
  },
  {
    id: 'cupom-parceiro-50',
    hotel_id: null,
    hotel_nome: 'Plataforma Hotel no Zap',
    codigo: 'PARCEIRO50',
    tipo_desconto: 'porcentagem',
    valor_desconto: 50,
    valor_minimo_reserva: 0,
    data_inicio: '2026-01-01',
    data_expiracao: null,
    limite_usos: 150,
    usos_atuais: 7,
    status: 'Ativo',
    visivel_hospedes: false,
    aplicavel_em: 'parceiro',
    descricao: '50% de desconto na taxa de ativação da licença de parceiro franqueado.',
    created_at: new Date().toISOString()
  },
  {
    id: 'cupom-parceiro-vip',
    hotel_id: null,
    hotel_nome: 'Plataforma Hotel no Zap',
    codigo: 'PARCEIROVIP',
    tipo_desconto: 'fixo',
    valor_desconto: 50,
    valor_minimo_reserva: 100,
    data_inicio: '2026-01-01',
    data_expiracao: null,
    limite_usos: 100,
    usos_atuais: 4,
    status: 'Ativo',
    visivel_hospedes: false,
    aplicavel_em: 'parceiro',
    descricao: 'R$ 50,00 OFF na taxa de franquia para novos parceiros credenciados.',
    created_at: new Date().toISOString()
  },

  // Cupom Geral Aplicável a Todos
  {
    id: 'cupom-bemvindo-20',
    hotel_id: null,
    hotel_nome: 'Plataforma Hotel no Zap',
    codigo: 'BEMVINDO20',
    tipo_desconto: 'porcentagem',
    valor_desconto: 20,
    valor_minimo_reserva: 0,
    data_inicio: '2026-01-01',
    data_expiracao: null,
    limite_usos: 500,
    usos_atuais: 18,
    status: 'Ativo',
    visivel_hospedes: true,
    aplicavel_em: 'todos',
    descricao: '20% de desconto de boas-vindas aplicável em planos de hotéis, parceiros e reservas.',
    created_at: new Date().toISOString()
  },

  // Cupons Operacionais de Hotéis (Reservas)
  {
    id: 'cupom-santiago-10',
    hotel_id: 'f5ce4199-8cd4-4baf-aadb-ff253cf6659d',
    hotel_nome: 'Hotel Santiago',
    hotel_cidade: 'Primavera do Leste / MT',
    codigo: 'SANTIAGO10',
    tipo_desconto: 'porcentagem',
    valor_desconto: 10,
    valor_minimo_reserva: 150,
    data_inicio: '2026-01-01',
    data_expiracao: '2026-12-31',
    limite_usos: 100,
    usos_atuais: 14,
    status: 'Ativo',
    visivel_hospedes: true,
    aplicavel_em: 'reserva',
    descricao: '10% de desconto especial no Hotel Santiago em Primavera do Leste para reservas diretas.',
    created_at: new Date().toISOString()
  },
  {
    id: 'cupom-morada-lua-50',
    hotel_id: '3c18756c-d41d-4d7f-873f-57e87e3e2c78',
    hotel_nome: 'Hotel Morada da Lua',
    hotel_cidade: 'Vila Rica / MT',
    codigo: 'MORADALUA50',
    tipo_desconto: 'fixo',
    valor_desconto: 50,
    valor_minimo_reserva: 250,
    data_inicio: '2026-01-01',
    data_expiracao: '2026-12-31',
    limite_usos: 50,
    usos_atuais: 8,
    status: 'Ativo',
    visivel_hospedes: true,
    aplicavel_em: 'reserva',
    descricao: 'R$ 50,00 OFF na sua hospedagem no Hotel Morada da Lua para reservas a partir de R$ 250,00.',
    created_at: new Date().toISOString()
  },
  {
    id: 'cupom-recanto-mutum',
    hotel_id: '2ae56a2b-2f15-4841-be85-c315ff4a0617',
    hotel_nome: 'Hotel Recanto',
    hotel_cidade: 'Nova Mutum / MT',
    codigo: 'RECANTO40',
    tipo_desconto: 'fixo',
    valor_desconto: 40,
    valor_minimo_reserva: 220,
    data_inicio: '2026-01-01',
    data_expiracao: '2026-12-31',
    limite_usos: 80,
    usos_atuais: 19,
    status: 'Ativo',
    visivel_hospedes: true,
    aplicavel_em: 'reserva',
    descricao: 'R$ 40,00 de desconto promocional para reservas acima de R$ 220,00 no Hotel Recanto em Nova Mutum.',
    created_at: new Date().toISOString()
  }
];

const loadFromStorage = (): CupomDesconto[] => {
  try {
    // Limpar versão legada com dados mockados antigos se existir
    if (localStorage.getItem('hotelnozap_cupons_desconto_v1')) {
      localStorage.removeItem('hotelnozap_cupons_desconto_v1');
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(CUPONS_PADRAO));
      return CUPONS_PADRAO;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Garantir que cupons padrão essenciais (como HOTEL100 e PARCEIRO100) existam caso o usuário tenha cache anterior
      const codigosExistentes = new Set(parsed.map((c: CupomDesconto) => (c.codigo || '').toUpperCase()));
      const novosPadroes = CUPONS_PADRAO.filter(p => !codigosExistentes.has(p.codigo.toUpperCase()));
      const merged = [...parsed, ...novosPadroes];
      if (novosPadroes.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }
      return merged.map((c: CupomDesconto) => ({
        ...c,
        hotel_cidade: c.hotel_cidade || ''
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
          hotel_cidade: d.hotel_cidade || '',
          codigo: d.codigo,
          tipo_desconto: d.tipo_desconto,
          valor_desconto: Number(d.valor_desconto) || 0,
          valor_minimo_reserva: d.valor_minimo_reserva !== null ? Number(d.valor_minimo_reserva) : 0,
          data_inicio: d.data_inicio,
          data_expiracao: (d.data_expiracao && d.data_expiracao.startsWith('2099')) ? null : d.data_expiracao,
          limite_usos: d.limite_usos !== null ? Number(d.limite_usos) : null,
          usos_atuais: Number(d.usos_atuais) || 0,
          status: d.status || 'Ativo',
          visivel_hospedes: d.visivel_hospedes !== false,
          descricao: d.descricao || '',
          aplicavel_em: d.aplicavel_em || 'reserva',
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
    return local.filter(c => !c.hotel_id || c.hotel_id === targetHotelId || c.hotel_id.includes('demo') || c.aplicavel_em === 'plano_hotel' || c.aplicavel_em === 'parceiro');
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
        return data
          .map((d: any) => ({
            id: d.id,
            hotel_id: d.hotel_id,
            hotel_nome: d.hotel_nome,
            hotel_cidade: d.hotel_cidade || '',
            codigo: d.codigo,
            tipo_desconto: d.tipo_desconto,
            valor_desconto: Number(d.valor_desconto) || 0,
            valor_minimo_reserva: d.valor_minimo_reserva !== null ? Number(d.valor_minimo_reserva) : 0,
            data_inicio: d.data_inicio,
            data_expiracao: (d.data_expiracao && d.data_expiracao.startsWith('2099')) ? null : d.data_expiracao,
            limite_usos: d.limite_usos !== null ? Number(d.limite_usos) : null,
            usos_atuais: Number(d.usos_atuais) || 0,
            status: d.status || 'Ativo',
            visivel_hospedes: d.visivel_hospedes !== false,
            descricao: d.descricao || '',
            aplicavel_em: d.aplicavel_em || 'reserva',
            created_at: d.created_at
          }))
          .filter((c: any) => !c.aplicavel_em || c.aplicavel_em === 'reserva' || c.aplicavel_em === 'todos');
      }
    } catch (err) {
      console.warn('Supabase offline ao buscar cupons públicos. Usando fallback:', err);
    }

    const local = loadFromStorage();
    return local.filter(
      c => c.status === 'Ativo' && c.visivel_hospedes && (!c.aplicavel_em || c.aplicavel_em === 'reserva' || c.aplicavel_em === 'todos')
    );
  },

  /**
   * Valida se um código de cupom é válido para um contexto (reserva, plano de hotel ou parceiro)
   */
  async validarCupom(
    codigo: string,
    hotelId?: string,
    valorTotal: number = 0,
    contexto: EscopoCupom = 'reserva'
  ): Promise<ValidacaoCupomResult> {
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
          aplicavel_em: data.aplicavel_em || 'reserva',
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

    // 2. Validação de Escopo / Contexto (se cupom é para planos de hotéis, parceiros ou reservas)
    const escopoCupom = cupom.aplicavel_em || 'reserva';
    if (contexto && escopoCupom !== 'todos' && escopoCupom !== contexto) {
      let contextoNome = 'este tipo de compra';
      if (escopoCupom === 'plano_hotel') contextoNome = 'Assinatura de Planos de Hotéis';
      else if (escopoCupom === 'parceiro') contextoNome = 'Cadastro de Franqueados / Parceiros';
      else if (escopoCupom === 'reserva') contextoNome = 'Reservas de Hóspedes';

      return {
        valido: false,
        mensagem: `O cupom "${cleanCode}" é exclusivo para ${contextoNome}.`
      };
    }

    // 3. Validação de Hotel (se for cupom de reserva exclusivo de um hotel específico)
    if (escopoCupom === 'reserva' && cupom.hotel_id && hotelId && cupom.hotel_id !== hotelId && !cupom.hotel_id.includes('demo')) {
      return {
        valido: false,
        mensagem: `Este cupom é exclusivo do estabelecimento "${cupom.hotel_nome || 'outro hotel'}".`
      };
    }

    // 4. Validação de Data de Validade
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

    // 5. Validação de Limite de Utilizações
    if (cupom.limite_usos && cupom.limite_usos > 0 && cupom.usos_atuais >= cupom.limite_usos) {
      return {
        valido: false,
        mensagem: `O cupom "${cleanCode}" atingiu o limite máximo de utilizações (${cupom.limite_usos}).`
      };
    }

    // 6. Validação de Valor Mínimo
    if (cupom.valor_minimo_reserva && cupom.valor_minimo_reserva > 0 && valorTotal < cupom.valor_minimo_reserva) {
      return {
        valido: false,
        mensagem: `Este cupom exige um valor mínimo de R$ ${cupom.valor_minimo_reserva.toFixed(2).replace('.', ',')}.`
      };
    }

    // 7. Cálculo do Desconto
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
    const codigoClean = (novoCupom.codigo || 'DESC10').trim().toUpperCase();

    // Compatibilidade com NOT NULL no banco de dados (2099-12-31 = sem expiração / perpétuo)
    const dataExpDb = (!novoCupom.data_expiracao || novoCupom.data_expiracao.startsWith('2099'))
      ? '2099-12-31'
      : novoCupom.data_expiracao;

    // Payload sanitizado estritamente com as colunas existentes na tabela cupons_desconto do Supabase
    const dbPayload: Record<string, any> = {
      hotel_id: novoCupom.hotel_id !== undefined ? novoCupom.hotel_id : (current?.id || null),
      hotel_nome: novoCupom.hotel_nome || (novoCupom.hotel_id ? current?.name : 'Plataforma Hotel no Zap'),
      codigo: codigoClean,
      tipo_desconto: novoCupom.tipo_desconto || 'porcentagem',
      valor_desconto: Number(novoCupom.valor_desconto) || 10,
      valor_minimo_reserva: novoCupom.valor_minimo_reserva ? Number(novoCupom.valor_minimo_reserva) : 0,
      data_inicio: novoCupom.data_inicio || new Date().toISOString().split('T')[0],
      data_expiracao: dataExpDb,
      limite_usos: (novoCupom.limite_usos !== undefined && novoCupom.limite_usos !== null) ? Number(novoCupom.limite_usos) : null,
      usos_atuais: Number(novoCupom.usos_atuais) || 0,
      status: novoCupom.status || 'Ativo',
      visivel_hospedes: novoCupom.visivel_hospedes !== false,
      descricao: (novoCupom.descricao || '').trim(),
      aplicavel_em: novoCupom.aplicavel_em || 'todos'
    };

    console.info('[cuponsService] Registrando cupom no Supabase:', dbPayload);

    let supabaseId = '';
    let supabaseCreatedAt = new Date().toISOString();

    try {
      const { data, error } = await supabase
        .from('cupons_desconto')
        .insert([dbPayload])
        .select()
        .single();

      if (error) {
        console.error('[cuponsService] Erro ao registrar cupom no Supabase:', error);
        throw new Error(error.message || 'Falha ao registrar cupom no banco de dados Supabase.');
      }

      if (data) {
        supabaseId = data.id;
        supabaseCreatedAt = data.created_at || supabaseCreatedAt;
        console.info('[cuponsService] Cupom gravado no Supabase com sucesso! ID:', data.id);
      }
    } catch (err: any) {
      console.error('[cuponsService] Exceção ao gravar cupom no Supabase:', err);
      throw err;
    }

    const finalCupom: CupomDesconto = {
      id: supabaseId || `cupom-${Date.now()}`,
      hotel_id: dbPayload.hotel_id,
      hotel_nome: dbPayload.hotel_nome,
      hotel_cidade: novoCupom.hotel_cidade || current?.cityUf || current?.city || '',
      codigo: dbPayload.codigo,
      tipo_desconto: dbPayload.tipo_desconto,
      valor_desconto: dbPayload.valor_desconto,
      valor_minimo_reserva: dbPayload.valor_minimo_reserva,
      data_inicio: dbPayload.data_inicio,
      data_expiracao: (!novoCupom.data_expiracao || novoCupom.data_expiracao === '2099-12-31') ? null : novoCupom.data_expiracao,
      limite_usos: dbPayload.limite_usos,
      usos_atuais: dbPayload.usos_atuais,
      status: dbPayload.status,
      visivel_hospedes: dbPayload.visivel_hospedes,
      descricao: dbPayload.descricao,
      aplicavel_em: dbPayload.aplicavel_em,
      created_at: supabaseCreatedAt
    };

    const currentList = loadFromStorage();
    const updated = [finalCupom, ...currentList.filter(c => c.id !== finalCupom.id && c.codigo !== finalCupom.codigo)];
    saveToStorage(updated);

    return finalCupom;
  },

  /**
   * Atualiza um cupom existente no Supabase e no localStorage
   */
  async updateCupom(id: string, updates: Partial<CupomDesconto>): Promise<boolean> {
    const cleanCodigo = updates.codigo ? updates.codigo.trim().toUpperCase() : undefined;

    // Sanitizar payload com colunas existentes na tabela cupons_desconto do Supabase
    const dbPayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (cleanCodigo) dbPayload.codigo = cleanCodigo;
    if (updates.tipo_desconto !== undefined) dbPayload.tipo_desconto = updates.tipo_desconto;
    if (updates.valor_desconto !== undefined) dbPayload.valor_desconto = Number(updates.valor_desconto);
    if (updates.valor_minimo_reserva !== undefined) dbPayload.valor_minimo_reserva = Number(updates.valor_minimo_reserva);
    if (updates.data_inicio !== undefined) dbPayload.data_inicio = updates.data_inicio;
    if (updates.data_expiracao !== undefined) {
      dbPayload.data_expiracao = (!updates.data_expiracao || updates.data_expiracao.startsWith('2099'))
        ? '2099-12-31'
        : updates.data_expiracao;
    }
    if (updates.limite_usos !== undefined) dbPayload.limite_usos = updates.limite_usos;
    if (updates.usos_atuais !== undefined) dbPayload.usos_atuais = updates.usos_atuais;
    if (updates.status !== undefined) dbPayload.status = updates.status;
    if (updates.visivel_hospedes !== undefined) dbPayload.visivel_hospedes = updates.visivel_hospedes;
    if (updates.descricao !== undefined) dbPayload.descricao = (updates.descricao || '').trim();
    if (updates.aplicavel_em !== undefined) dbPayload.aplicavel_em = updates.aplicavel_em;
    if (updates.hotel_id !== undefined) dbPayload.hotel_id = updates.hotel_id;
    if (updates.hotel_nome !== undefined) dbPayload.hotel_nome = updates.hotel_nome;

    try {
      const { error } = await supabase
        .from('cupons_desconto')
        .update(dbPayload)
        .eq('id', id);

      if (error) {
        console.error('[cuponsService] Erro ao atualizar cupom no Supabase:', error);
        throw new Error(error.message || 'Falha ao atualizar cupom no banco de dados.');
      }
      console.info('[cuponsService] Cupom atualizado no Supabase com sucesso. ID:', id);
    } catch (err: any) {
      console.error('[cuponsService] Exceção no updateCupom:', err);
      throw err;
    }

    const currentList = loadFromStorage();
    const updated = currentList.map(c => (c.id === id ? { ...c, ...updates, ...(cleanCodigo ? { codigo: cleanCodigo } : {}) } : c));
    saveToStorage(updated);

    return true;
  },

  /**
   * Exclui um cupom no Supabase e no localStorage
   */
  async deleteCupom(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('cupons_desconto').delete().eq('id', id);
      if (error) {
        console.error('[cuponsService] Erro ao excluir cupom no Supabase:', error);
        throw new Error(error.message || 'Falha ao excluir cupom do banco de dados.');
      }
      console.info('[cuponsService] Cupom excluído no Supabase com sucesso. ID:', id);
    } catch (err: any) {
      console.error('[cuponsService] Exceção no deleteCupom:', err);
      throw err;
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
