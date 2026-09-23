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
    nome: '1 Crédito (Adesão / Teste)',
    creditos: 1,
    diasBase: 30,
    diasBonus: 15,
    totalDias: 45,
    preco: 197.00,
    vantagem: 'Ideal para conhecer e começar com 15 dias de folga'
  },
  {
    id: '2-creditos',
    nome: '2 Créditos (Bimestral)',
    creditos: 2,
    diasBase: 60,
    diasBonus: 15,
    totalDias: 75,
    preco: 349.00,
    vantagem: 'Economia imediata com 2 meses e meio de acesso'
  },
  {
    id: '3-creditos',
    nome: '3 Créditos (Trimestre de Ouro)',
    creditos: 3,
    diasBase: 90,
    diasBonus: 30,
    totalDias: 120,
    preco: 497.00,
    vantagem: 'Perfeito para cobrir uma alta temporada inteira'
  },
  {
    id: '6-creditos',
    nome: '6 Créditos (Semestral)',
    creditos: 6,
    diasBase: 180,
    diasBonus: 45,
    totalDias: 225,
    preco: 890.00,
    vantagem: 'Maior tranquilidade para o gestor'
  },
  {
    id: '12-creditos',
    nome: '12 Créditos (Anual Fidelidade)',
    creditos: 12,
    diasBase: 365,
    diasBonus: 60,
    totalDias: 425,
    preco: 1690.00,
    vantagem: '2 meses inteiros de bônus e maior economia'
  }
];

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
