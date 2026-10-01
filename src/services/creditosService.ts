export interface PacoteCredito {
  id: string;
  nome: string;
  creditos: number;
  diasBase: number;
  diasBonus: number;
  totalDias: number;
  preco: number;
  vantagem: string;
}

export const PACOTES_CREDITOS_MODELO_1: PacoteCredito[] = [
  {
    id: '1-credito',
    nome: '1 Crédito',
    creditos: 1,
    diasBase: 30,
    diasBonus: 15,
    totalDias: 45,
    preco: 197.00,
    vantagem: 'Inicie sem medo • 15 dias de bônus'
  },
  {
    id: '2-creditos',
    nome: '2 Créditos (Bimestral)',
    creditos: 2,
    diasBase: 60,
    diasBonus: 15,
    totalDias: 75,
    preco: 349.00,
    vantagem: 'Econômico • 60 dias base + 15 dias bônus'
  },
  {
    id: '3-creditos',
    nome: '3 Créditos (Trimestre de Ouro)',
    creditos: 3,
    diasBase: 90,
    diasBonus: 30,
    totalDias: 120,
    preco: 591.00,
    vantagem: 'Mais Vendido • 90 dias base + 30 dias bônus'
  },
  {
    id: '4-creditos',
    nome: '4 Créditos',
    creditos: 4,
    diasBase: 120,
    diasBonus: 30,
    totalDias: 150,
    preco: 788.00,
    vantagem: 'Ganhe 1 Mês Grátis • 120 dias base + 30 dias bônus'
  },
  {
    id: '5-creditos',
    nome: '5 Créditos',
    creditos: 5,
    diasBase: 150,
    diasBonus: 30,
    totalDias: 180,
    preco: 985.00,
    vantagem: '5 Meses + 1 mês Grátis • 150 dias base + 30 dias bônus'
  },
  {
    id: '6-creditos',
    nome: '6 Créditos',
    creditos: 6,
    diasBase: 180,
    diasBonus: 45,
    totalDias: 225,
    preco: 1182.00,
    vantagem: 'Semestral • 180 dias base + 45 dias bônus'
  },
  {
    id: '7-creditos',
    nome: '7 Créditos',
    creditos: 7,
    diasBase: 210,
    diasBonus: 0,
    totalDias: 210,
    preco: 1379.00,
    vantagem: 'Septemestral • 210 dias de acesso'
  },
  {
    id: '8-creditos',
    nome: '8 Créditos',
    creditos: 8,
    diasBase: 240,
    diasBonus: 30,
    totalDias: 270,
    preco: 1576.00,
    vantagem: '8 Meses + 1 Mês Grátis • 240 dias base + 30 dias bônus'
  },
  {
    id: '12-creditos',
    nome: '12 Créditos (Anual)',
    creditos: 12,
    diasBase: 365,
    diasBonus: 60,
    totalDias: 425,
    preco: 2364.00,
    vantagem: '-35% OFF 14 Meses • 365 dias base + 60 dias bônus'
  }
];

export function parseCreditosFromName(name?: string, ordem?: any): number {
  const n = String(name || '').toLowerCase();
  if (n.includes('12')) return 12;
  if (n.includes('8')) return 8;
  if (n.includes('7')) return 7;
  if (n.includes('6')) return 6;
  if (n.includes('5')) return 5;
  if (n.includes('4')) return 4;
  if (n.includes('3')) return 3;
  if (n.includes('2')) return 2;
  if (n.includes('1') && !n.includes('10') && !n.includes('15')) return 1;
  const numOrdem = Number(String(ordem || '').replace(/\D/g, ''));
  if (!isNaN(numOrdem) && numOrdem >= 1 && numOrdem <= 12) return numOrdem;
  return 1;
}

export function getPeriodicityDays(p?: string): number {
  const low = String(p || '').toLowerCase();
  if (low.includes('anual') || low.includes('12')) return 365;
  if (low.includes('hendeca') || low.includes('11')) return 330;
  if (low.includes('deca') || low.includes('10')) return 300;
  if (low.includes('nona') || low.includes('9')) return 270;
  if (low.includes('octo') || low.includes('8')) return 240;
  if (low.includes('sept') || low.includes('7')) return 210;
  if (low.includes('semest') || low.includes('6')) return 180;
  if (low.includes('quinque') || low.includes('5')) return 150;
  if (low.includes('quadri') || low.includes('4')) return 120;
  if (low.includes('trimest') || low.includes('3')) return 90;
  if (low.includes('bimest') || low.includes('2')) return 60;
  return 30;
}

export function converterPlanoParaPacote(plano: any): PacoteCredito {
  const creditos = parseCreditosFromName(plano.name || plano.nome, plano.order || plano.ordem);
  const diasBase = getPeriodicityDays(plano.periodicity || plano.periodicidade);
  const diasBonus = Number(plano.bonusDays ?? plano.trialDays ?? plano.dias_bonus ?? plano.dias_trial ?? 0);
  const totalDias = diasBase + diasBonus;
  const preco = Number(plano.basePrice ?? plano.valor_base ?? 0);
  const vantagem = plano.tag || plano.description || plano.descricao || `${creditos} créditos com ${diasBonus} dias de bônus`;

  return {
    id: plano.id || `pacote-${creditos}`,
    nome: plano.name || plano.nome || `${creditos} Créditos`,
    creditos,
    diasBase,
    diasBonus,
    totalDias,
    preco,
    vantagem
  };
}

export function converterPlanosParaPacotes(planos: any[]): PacoteCredito[] {
  if (!Array.isArray(planos) || planos.length === 0) return PACOTES_CREDITOS_MODELO_1;

  const creditosValidos = planos
    .filter(p => {
      const nomeLow = (p.name || p.nome || '').toLowerCase();
      const statusLow = (p.status || '').toLowerCase();
      const preco = Number(p.basePrice ?? p.valor_base ?? 0);
      return statusLow !== 'inativo' && !nomeLow.includes('grátis') && !nomeLow.includes('gratis') && !nomeLow.includes('maps') && preco > 0;
    })
    .map(converterPlanoParaPacote)
    .sort((a, b) => a.creditos - b.creditos);

  return creditosValidos.length > 0 ? creditosValidos : PACOTES_CREDITOS_MODELO_1;
}

export interface InfoCreditoHotel {
  saldoCreditos: number;
  diasRestantes: number;
  dataCompra?: string;
  dataCompraFormatada?: string;
  dataExpiracao: string;
  dataExpiracaoFormatada: string;
  emDegustacao: boolean;
  status: 'ativo' | 'alerta' | 'expirado';
}

const STORAGE_CREDITOS_KEY = 'hotelnozap_creditos_hoteis_v1';

export const creditosService = {
  getPacotes(): PacoteCredito[] {
    return PACOTES_CREDITOS_MODELO_1;
  },

  getAllCreditosMap(): Record<string, { saldoCreditos: number; expiracao: string; emDegustacao: boolean; dataCompra?: string }> {
    try {
      const stored = localStorage.getItem(STORAGE_CREDITOS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Erro ao ler creditos do localStorage:', e);
    }
    return {};
  },

  saveCreditoHotel(hotelId: string, saldoCreditos: number, expiracaoIso: string, emDegustacao: boolean = false, dataCompra?: string) {
    try {
      const map = this.getAllCreditosMap();
      const existing = map[hotelId];
      map[hotelId] = {
        saldoCreditos,
        expiracao: expiracaoIso,
        emDegustacao,
        dataCompra: dataCompra || existing?.dataCompra || new Date().toISOString().split('T')[0]
      };
      localStorage.setItem(STORAGE_CREDITOS_KEY, JSON.stringify(map));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hotel_creditos_changed', { detail: { hotelId, saldoCreditos, expiracao: expiracaoIso, dataCompra } }));
      }
    } catch (e) {
      console.warn('Erro ao salvar credito do hotel:', e);
    }
  },

  calcularExpiracaoPorCompra(dataCompraStr: string, totalDias: number = 45): {
    dataExpiracao: string;
    dataExpiracaoFormatada: string;
    diasRestantes: number;
    status: 'ativo' | 'alerta' | 'expirado';
  } {
    if (!dataCompraStr) {
      dataCompraStr = new Date().toISOString().split('T')[0];
    }
    const [ano, mes, dia] = dataCompraStr.split('-').map(Number);
    const dataCompra = (!isNaN(ano) && !isNaN(mes) && !isNaN(dia))
      ? new Date(ano, mes - 1, dia)
      : new Date();

    const dataExp = new Date(dataCompra.getTime() + totalDias * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diffMs = dataExp.getTime() - now.getTime();
    const diasRestantes = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    let status: 'ativo' | 'alerta' | 'expirado' = 'ativo';
    if (diasRestantes <= 0) status = 'expirado';
    else if (diasRestantes <= 10) status = 'alerta';

    return {
      dataExpiracao: dataExp.toISOString(),
      dataExpiracaoFormatada: dataExp.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      diasRestantes,
      status
    };
  },

  calcularInfoCreditos(hotel: any): InfoCreditoHotel {
    const hotelId = hotel?.id || 'default';
    const planLower = (hotel?.plan || '').toLowerCase();
    const notesLower = (hotel?.notes || '').toLowerCase();
    const isGoogle = planLower.includes('google') || planLower.includes('maps') || notesLower.includes('google') || notesLower.includes('places') || Boolean(hotel?.isImportedFromGoogle);

    if (isGoogle) {
      return {
        saldoCreditos: 0,
        diasRestantes: 9999,
        dataCompra: new Date().toISOString().split('T')[0],
        dataCompraFormatada: 'Isento',
        dataExpiracao: '2099-12-31T23:59:59.000Z',
        dataExpiracaoFormatada: 'Vitalício (Google Maps)',
        emDegustacao: false,
        status: 'ativo'
      };
    }

    const map = this.getAllCreditosMap();
    const stored = map[hotelId];

    let expiracaoDate: Date;
    let saldoCreditos = 1;
    let emDegustacao = true;
    let dataCompraStr = new Date().toISOString().split('T')[0];

    if (stored && stored.expiracao) {
      expiracaoDate = new Date(stored.expiracao);
      saldoCreditos = stored.saldoCreditos || 1;
      emDegustacao = Boolean(stored.emDegustacao);
      if (stored.dataCompra) {
        dataCompraStr = stored.dataCompra;
      }
    } else {
      // Se não há registro prévio, o novo hotel ganha 45 dias (30 dias base + 15 bônus de degustação)
      const baseDate = hotel?.createdAt ? new Date(hotel.createdAt) : new Date();
      dataCompraStr = baseDate.toISOString().split('T')[0];
      expiracaoDate = new Date(baseDate.getTime() + 45 * 24 * 60 * 60 * 1000);
      saldoCreditos = 1;
      emDegustacao = true;

      // Salva para persistir
      this.saveCreditoHotel(hotelId, saldoCreditos, expiracaoDate.toISOString(), emDegustacao, dataCompraStr);
    }

    const now = new Date();
    const diffMs = expiracaoDate.getTime() - now.getTime();
    const diasRestantes = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    let status: 'ativo' | 'alerta' | 'expirado' = 'ativo';
    if (diasRestantes <= 0) {
      status = 'expirado';
    } else if (diasRestantes <= 10) {
      status = 'alerta';
    }

    const dataExpiracaoFormatada = expiracaoDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    const [a, m, d] = dataCompraStr.split('-');
    const dataCompraFormatada = (a && m && d) ? `${d}/${m}/${a}` : dataCompraStr;

    return {
      saldoCreditos,
      diasRestantes,
      dataCompra: dataCompraStr,
      dataCompraFormatada,
      dataExpiracao: expiracaoDate.toISOString(),
      dataExpiracaoFormatada,
      emDegustacao,
      status
    };
  },

  recarregarPacote(hotelId: string, pacote: PacoteCredito): InfoCreditoHotel {
    const map = this.getAllCreditosMap();
    const stored = map[hotelId];
    const now = new Date();

    let dataBase = now;
    let creditosAtuais = 0;

    if (stored && stored.expiracao) {
      const expAtual = new Date(stored.expiracao);
      if (expAtual.getTime() > now.getTime()) {
        dataBase = expAtual;
      }
      creditosAtuais = stored.saldoCreditos || 0;
    }

    const novaExpiracao = new Date(dataBase.getTime() + pacote.totalDias * 24 * 60 * 60 * 1000);
    const novoSaldoCreditos = creditosAtuais + pacote.creditos;

    this.saveCreditoHotel(hotelId, novoSaldoCreditos, novaExpiracao.toISOString(), false);

    // Atualiza status e plano no Supabase se existir
    try {
      import('../lib/supabase').then(({ supabase }) => {
        supabase.from('hoteis').update({
          status: 'ativo',
          plano: pacote.nome
        }).eq('id', hotelId);
      });
    } catch { /* ignore */ }

    return {
      saldoCreditos: novoSaldoCreditos,
      diasRestantes: Math.max(0, Math.ceil((novaExpiracao.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
      dataExpiracao: novaExpiracao.toISOString(),
      dataExpiracaoFormatada: novaExpiracao.toLocaleDateString('pt-BR'),
      emDegustacao: false,
      status: 'ativo'
    };
  },

  adicionarDiasBonus(hotelId: string, diasBonus: number = 15): InfoCreditoHotel {
    return this.adicionarDiasAoHotel(hotelId, diasBonus, 'Bônus de cortesia');
  },

  adicionarDiasAoHotel(hotelId: string, diasBonus: number, motivo?: string, hotelNome?: string): InfoCreditoHotel {
    const map = this.getAllCreditosMap();
    const stored = map[hotelId];
    const now = new Date();

    let dataBase = now;
    let creditosAtuais = 1;

    if (stored && stored.expiracao) {
      const expAtual = new Date(stored.expiracao);
      if (expAtual.getTime() > now.getTime()) {
        dataBase = expAtual;
      }
      creditosAtuais = stored.saldoCreditos || 1;
    }

    const novaExpiracao = new Date(dataBase.getTime() + diasBonus * 24 * 60 * 60 * 1000);
    this.saveCreditoHotel(hotelId, creditosAtuais, novaExpiracao.toISOString(), false);

    // Se estiver no banco Supabase com status inativo/expirado, reativa para 'ativo'
    try {
      import('../lib/supabase').then(({ supabase }) => {
        supabase.from('hoteis').update({
          status: 'ativo',
          observacoes: `Prorrogação de +${diasBonus} dias aplicada em ${new Date().toLocaleDateString('pt-BR')}. Motivo: ${motivo || 'Programação de compra'}.`
        }).eq('id', hotelId).then(() => {});
      }).catch(() => {});
    } catch { /* ignore */ }

    // Registra log de auditoria
    try {
      import('./systemLogsService').then(({ systemLogsService }) => {
        systemLogsService.addLog({
          level: 'success',
          module: 'financeiro',
          action: `Prorrogação de Prazo (+${diasBonus} dias)`,
          details: `Adicionados +${diasBonus} dias ao hotel "${hotelNome || hotelId}". Nova validade: ${novaExpiracao.toLocaleDateString('pt-BR')}. Motivo: ${motivo || 'Programação de compra'}.`,
          hotelId,
          hotelName: hotelNome
        }).catch(() => {});
      }).catch(() => {});
    } catch { /* ignore */ }

    return {
      saldoCreditos: creditosAtuais,
      diasRestantes: Math.max(0, Math.ceil((novaExpiracao.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
      dataExpiracao: novaExpiracao.toISOString(),
      dataExpiracaoFormatada: novaExpiracao.toLocaleDateString('pt-BR'),
      emDegustacao: false,
      status: 'ativo'
    };
  }
};
