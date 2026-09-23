import React, { useState, useEffect, useMemo } from 'react';
import { parceirosService, hoteisService, planosService } from '../services/supabaseService';
import { Partner } from './ListagemParceiros';
import { Hotel } from './CadastroHoteis';

export interface RepasseItem {
  id: string;
  parceiroId: string;
  parceiroNome: string;
  parceiroCategoria: string;
  parceiroNivel: string;
  avatarColor: string;
  iniciais: string;
  pixTipo: string;
  pixChave: string;
  banco?: string;
  titular?: string;
  documento?: string;
  email?: string;
  telefone?: string;
  competencia: string; // Ex: '09/2026'
  competenciaNome: string; // Ex: 'Setembro / 2026'
  hoteisIndicadosCount: number;
  faturamentoGerado: number;
  taxaComissao: number; // Ex: 15 (para 15%)
  valorRepasse: number;
  status: 'pendente' | 'pago' | 'processando' | 'cancelado';
  dataVencimento: string;
  dataPagamento?: string;
  comprovanteId?: string;
  observacoes?: string;
}

export interface ReceitaRepassesProps {
  onNavigateToDashboard?: () => void;
  adminEmail?: string;
  adminName?: string;
}

const STORAGE_KEY = 'hotelnozap_repasses_saas';

// Lista inicial vazia (sem dados fictícios)
const INITIAL_REPASSES: RepasseItem[] = [];

export const ReceitaRepasses: React.FC<ReceitaRepassesProps> = ({
  onNavigateToDashboard
}) => {
  // Estados de dados reais
  const [repasses, setRepasses] = useState<RepasseItem[]>([]);
  const [parceiros, setParceiros] = useState<Partner[]>([]);
  const [hoteis, setHoteis] = useState<Hotel[]>([]);
  const [planos, setPlanos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados de visualização e filtros
  const [viewMode, setViewMode] = useState<'lista' | 'grade'>('lista');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendente' | 'pago' | 'processando'>('todos');
  const [competenciaFilter, setCompetenciaFilter] = useState<string>('todos');
  const [nivelFilter, setNivelFilter] = useState<string>('todos');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Estados dos Modais
  const [modalPagarRepasse, setModalPagarRepasse] = useState<RepasseItem | null>(null);
  const [codigoTransacaoPix, setCodigoTransacaoPix] = useState('');
  const [observacaoPagamento, setObservacaoPagamento] = useState('');

  const [modalNovoRepasseOpen, setModalNovoRepasseOpen] = useState(false);
  const [novoParceiroId, setNovoParceiroId] = useState('');
  const [novoValorRepasse, setNovoValorRepasse] = useState('');
  const [novaCompetencia, setNovaCompetencia] = useState('09/2026');
  const [novoMotivo, setNovoMotivo] = useState('Comissão Recorrente de Assinaturas');

  const [modalDetalheRepasse, setModalDetalheRepasse] = useState<RepasseItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Carrega dados 100% reais do Supabase (Parceiros, Hotéis e Planos)
  const carregarDadosReais = async () => {
    setIsLoading(true);
    try {
      const [dbParceiros, dbHoteis, dbPlanos] = await Promise.all([
        parceirosService.getParceiros(),
        hoteisService.getHoteis(),
        planosService.getPlanos()
      ]);

      const listaParceiros = dbParceiros || [];
      const listaHoteis = dbHoteis || [];
      const listaPlanos = dbPlanos || [];

      setParceiros(listaParceiros);
      setHoteis(listaHoteis);
      setPlanos(listaPlanos);

      // Mapa de preços dos planos para cálculo preciso de faturamento
      const planPriceMap = new Map<string, number>();
      listaPlanos.forEach((p: any) => {
        const k = (p.nome || '').toLowerCase().trim();
        planPriceMap.set(k, Number(p.valor_base) || 0);
      });

      // Limpeza de repasses legados (removendo qualquer registro com nomes/IDs fictícios antigos)
      let repassesSalvosValidos: RepasseItem[] = [];
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            repassesSalvosValidos = parsed.filter((r: any) =>
              listaParceiros.some(p => p.id === r.parceiroId) &&
              !r.parceiroId?.startsWith('PAR-') &&
              r.parceiroNome !== 'Carlos Eduardo Silva' &&
              r.parceiroNome !== 'Agência Ponta Verde Marketing' &&
              r.parceiroNome !== 'Renata Vasconcelos Hub'
            );
          }
        }
      } catch {}

      const competenciaAtual = '09/2026';
      const competenciaNomeAtual = 'Setembro / 2026';

      const repassesSincronizados: RepasseItem[] = [...repassesSalvosValidos];

      // Sincroniza cada parceiro real no banco com seus hotéis e comissão
      listaParceiros.forEach(p => {
        const jaExiste = repassesSincronizados.find(
          r => r.parceiroId === p.id && r.competencia === competenciaAtual
        );

        if (!jaExiste) {
          // Identifica hotéis indicados pelo parceiro (por nome, id ou cupom)
          const hoteisDoParceiro = listaHoteis.filter((h: any) => {
            const ref = (h.parceiro_referencia || '').trim().toLowerCase();
            const pName = (p.name || '').trim().toLowerCase();
            const pId = (p.id || '').trim().toLowerCase();
            const cupom = (p.coupon || '').trim().toLowerCase();
            return ref && (ref === pName || ref === pId || (cupom && ref === cupom));
          });

          // Calcula o faturamento real dos hotéis indicados
          const faturamentoGerado = hoteisDoParceiro.reduce((acc: number, h: any) => {
            const pl = (h.plano || (h as any).plan || '').toLowerCase().trim();
            if (pl.includes('grátis') || pl.includes('gratis') || pl.includes('free') || pl.includes('google maps')) {
              return acc;
            }
            const pr = planPriceMap.get(pl) ?? (pl.includes('bimestral') ? 349 : pl.includes('trimestral') ? 497 : pl.includes('semestral') ? 890 : pl.includes('anual') ? 1690 : 197);
            return acc + pr;
          }, 0);

          const isHotelNoZap = (p.name || '').toLowerCase().includes('hotel no zap') || 
                               (p.name || '').toLowerCase().includes('hotelnozap') || 
                               (p.coupon || '').toUpperCase() === 'HOTELNOZAP';
          const taxa = isHotelNoZap ? 0 : (p.taxa_comissao !== undefined && p.taxa_comissao !== null ? Number(p.taxa_comissao) : (parseFloat(p.commission?.replace(/\D/g, '') || '0') || 0));
          const valorRepasse = faturamentoGerado > 0 ? (faturamentoGerado * taxa) / 100 : 0;
          const nivel = isHotelNoZap ? 'Institucional' : (p.level || (taxa >= 15 ? 'Ouro Master' : taxa >= 12 ? 'Ouro' : taxa >= 10 ? 'Prata' : 'Bronze'));

          repassesSincronizados.push({
            id: `REP-${p.id.substring(0, 8).toUpperCase()}`,
            parceiroId: p.id,
            parceiroNome: p.name,
            parceiroCategoria: p.category || 'Consultor Hoteleiro',
            parceiroNivel: nivel,
            avatarColor: p.avatarColor || 'emerald',
            iniciais: p.initials || p.name.substring(0, 2).toUpperCase(),
            pixTipo: p.pixType || 'PIX',
            pixChave: p.pixKey || p.phone || 'Chave a cadastrar',
            banco: p.bankName || 'A definir',
            titular: p.holderName || p.name,
            documento: p.document || '',
            email: p.email,
            telefone: p.phone,
            competencia: competenciaAtual,
            competenciaNome: competenciaNomeAtual,
            hoteisIndicadosCount: hoteisDoParceiro.length,
            faturamentoGerado,
            taxaComissao: taxa,
            valorRepasse,
            status: valorRepasse > 0 ? 'pendente' : 'pendente',
            dataVencimento: '10/10/2026',
            observacoes: hoteisDoParceiro.length > 0
              ? `Comissão calculada sobre ${hoteisDoParceiro.length} hotel(is) indicado(s)`
              : 'Parceiro credenciado na rede • Sem hotéis com mensalidades pagas no período'
          });
        }
      });

      setRepasses(repassesSincronizados);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(repassesSincronizados));
    } catch (err) {
      console.warn('Erro ao carregar dados reais no painel de repasses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarDadosReais();

    const handleUpdate = () => carregarDadosReais();
    window.addEventListener('hotel_novo_parceiro', handleUpdate);
    window.addEventListener('hotel_parceiro_modificado', handleUpdate);
    window.addEventListener('hotel_parceiro_deletado', handleUpdate);
    window.addEventListener('hotel_changed', handleUpdate);

    return () => {
      window.removeEventListener('hotel_novo_parceiro', handleUpdate);
      window.removeEventListener('hotel_parceiro_modificado', handleUpdate);
      window.removeEventListener('hotel_parceiro_deletado', handleUpdate);
      window.removeEventListener('hotel_changed', handleUpdate);
    };
  }, []);

  // Salva no localStorage sempre que repasses mudar
  useEffect(() => {
    if (!isLoading && repasses.length >= 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(repasses));
      } catch {}
    }
  }, [repasses, isLoading]);

  // Copiar chave Pix com feedback
  const handleCopiarPix = (chave: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      navigator.clipboard.writeText(chave);
      showToast(`Chave Pix copiada: ${chave}`);
    } catch {
      showToast('Chave copiada para a área de transferência!');
    }
  };

  // Confirmar pagamento de repasse
  const handleConfirmarPagamento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalPagarRepasse) return;

    const now = new Date();
    const dataHoraStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const codPixFinal = codigoTransacaoPix.trim() || `E2E-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    setRepasses(prev => prev.map(item => {
      if (item.id === modalPagarRepasse.id) {
        return {
          ...item,
          status: 'pago',
          dataPagamento: dataHoraStr,
          comprovanteId: codPixFinal,
          observacoes: observacaoPagamento.trim() || item.observacoes
        };
      }
      return item;
    }));

    showToast(`Repasse de R$ ${modalPagarRepasse.valorRepasse.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} liquidado com sucesso!`);
    setModalPagarRepasse(null);
    setCodigoTransacaoPix('');
    setObservacaoPagamento('');
  };

  // Criar novo repasse avulso
  const handleSalvarNovoRepasse = (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseFloat(novoValorRepasse.replace(',', '.'));
    if (!novoParceiroId || isNaN(valorNum) || valorNum <= 0) {
      showToast('Preencha um parceiro válido e o valor do repasse.');
      return;
    }

    const partnerFound: any = parceiros.find(p => p.id === novoParceiroId);
    if (!partnerFound) {
      showToast('Parceiro não encontrado.');
      return;
    }

    const taxaNum = Number(partnerFound.taxa_comissao) || parseFloat(partnerFound.commission?.replace(/\D/g, '') || '0') || 1;

    const novoItem: RepasseItem = {
      id: `REP-${Date.now().toString().slice(-6)}`,
      parceiroId: partnerFound.id,
      parceiroNome: partnerFound.name,
      parceiroCategoria: partnerFound.category || 'Consultor Hoteleiro',
      parceiroNivel: partnerFound.level || 'Bronze',
      avatarColor: partnerFound.avatarColor || 'emerald',
      iniciais: partnerFound.initials || partnerFound.name.substring(0, 2).toUpperCase(),
      pixTipo: partnerFound.pixType || 'PIX',
      pixChave: partnerFound.pixKey || partnerFound.phone || 'Chave a cadastrar',
      banco: partnerFound.bankName || 'Banco Principal',
      titular: partnerFound.holderName || partnerFound.name,
      documento: (partnerFound as any).document || '',
      email: partnerFound.email,
      telefone: partnerFound.phone,
      competencia: novaCompetencia,
      competenciaNome: novaCompetencia === '09/2026' ? 'Setembro / 2026' : novaCompetencia === '10/2026' ? 'Outubro / 2026' : novaCompetencia,
      hoteisIndicadosCount: partnerFound.indicatedHotels || 0,
      faturamentoGerado: valorNum / (taxaNum > 0 ? taxaNum / 100 : 1),
      taxaComissao: taxaNum,
      valorRepasse: valorNum,
      status: 'pendente',
      dataVencimento: '10/10/2026',
      observacoes: novoMotivo
    };

    setRepasses(prev => [novoItem, ...prev]);
    showToast(`Novo repasse no valor de R$ ${valorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} lançado!`);
    setModalNovoRepasseOpen(false);
    setNovoParceiroId('');
    setNovoValorRepasse('');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CÁLCULOS DOS KPIS CONSOLIDADOS (DADOS REAIS)
  // ─────────────────────────────────────────────────────────────────────────────
  const planPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    planos.forEach(p => {
      const k = (p.nome || '').toLowerCase().trim();
      map.set(k, Number(p.valor_base) || 0);
    });
    return map;
  }, [planos]);

  // Faturamento SaaS Real calculado a partir dos planos contratados pelos hotéis
  const totalReceitaSaaS = useMemo(() => {
    return hoteis.reduce((acc, h) => {
      const p = (h.plan || (h as any).plano || '').toLowerCase().trim();
      if (p.includes('grátis') || p.includes('gratis') || p.includes('free') || p.includes('google maps')) {
        return acc;
      }
      const pr = planPriceMap.get(p) ?? (p.includes('bimestral') ? 349 : p.includes('trimestral') ? 497 : p.includes('semestral') ? 890 : p.includes('anual') ? 1690 : 197);
      return acc + pr;
    }, 0);
  }, [hoteis, planPriceMap]);

  const totalRepassesPendentes = useMemo(() => {
    return repasses
      .filter(r => (r.status === 'pendente' || r.status === 'processando') && r.valorRepasse > 0)
      .reduce((acc, r) => acc + r.valorRepasse, 0);
  }, [repasses]);

  const totalRepassesLiquidados = useMemo(() => {
    return repasses
      .filter(r => r.status === 'pago')
      .reduce((acc, r) => acc + r.valorRepasse, 0);
  }, [repasses]);

  const repassesLiquidadosCount = useMemo(() => {
    return repasses.filter(r => r.status === 'pago').length;
  }, [repasses]);

  const parceirosComRepassePendenteCount = useMemo(() => {
    const pendentes = repasses.filter(r => (r.status === 'pendente' || r.status === 'processando') && r.valorRepasse > 0);
    return new Set(pendentes.map(r => r.parceiroId)).size;
  }, [repasses]);

  const taxaMediaComissao = useMemo(() => {
    if (parceiros.length === 0) return '0.0';
    const soma = parceiros.reduce((acc, p) => {
      const isHotelNoZap = (p.name || '').toLowerCase().includes('hotel no zap') || (p.coupon || '').toUpperCase() === 'HOTELNOZAP';
      const t = isHotelNoZap ? 0 : (p.taxa_comissao !== undefined && p.taxa_comissao !== null ? Number(p.taxa_comissao) : (parseFloat(p.commission?.replace(/\D/g, '') || '0') || 0));
      return acc + t;
    }, 0);
    return (soma / parceiros.length).toFixed(1);
  }, [parceiros]);

  const hoteisAtivosCount = useMemo(() => {
    return hoteis.filter(h => h.status === 'ativo').length || hoteis.length;
  }, [hoteis]);

  // ─────────────────────────────────────────────────────────────────────────────
  // FILTRAGEM DOS REPASSES
  // ─────────────────────────────────────────────────────────────────────────────
  const repassesFiltrados = useMemo(() => {
    return repasses.filter(r => {
      // 1. Busca textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNome = r.parceiroNome.toLowerCase().includes(q);
        const matchPix = r.pixChave.toLowerCase().includes(q);
        const matchBanco = r.banco?.toLowerCase().includes(q) || false;
        const matchTitular = r.titular?.toLowerCase().includes(q) || false;
        const matchDoc = r.documento?.toLowerCase().includes(q) || false;
        const matchComp = r.competencia.includes(q) || r.competenciaNome.toLowerCase().includes(q);
        if (!matchNome && !matchPix && !matchBanco && !matchTitular && !matchDoc && !matchComp) {
          return false;
        }
      }

      // 2. Filtro de Status
      if (statusFilter !== 'todos') {
        if (r.status !== statusFilter) return false;
      }

      // 3. Filtro de Competência
      if (competenciaFilter !== 'todos') {
        if (r.competencia !== competenciaFilter) return false;
      }

      // 4. Filtro de Nível
      if (nivelFilter !== 'todos') {
        if (r.parceiroNivel.toLowerCase() !== nivelFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [repasses, searchQuery, statusFilter, competenciaFilter, nivelFilter]);

  const getAvatarBg = (color?: string) => {
    switch (color) {
      case 'blue': return 'bg-blue-600 text-white';
      case 'emerald': return 'bg-emerald-600 text-white';
      case 'amber': return 'bg-amber-600 text-white';
      case 'cyan': return 'bg-cyan-600 text-white';
      case 'purple': return 'bg-purple-600 text-white';
      case 'rose': return 'bg-rose-600 text-white';
      default: return 'bg-slate-800 text-white';
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans pb-16">
      
      {/* TOAST DE NOTIFICAÇÃO */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs sm:text-sm font-semibold border border-slate-700 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TOP HEADER EXECUTIVO COM IDENTIDADE SAAS MASTER                        */}
      {/* ========================================================================= */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-md bg-emerald-100 text-[#003400] uppercase tracking-wider border border-emerald-300 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">admin_panel_settings</span>
                <span>Financeiro Global Master • SaaS</span>
              </span>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                Acesso Restrito ao Administrador
              </span>
            </div>
            
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#003400] text-emerald-300 flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-xl">payments</span>
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                  Receita & Repasses aos Parceiros
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Gestão de comissões, conciliação e repasses bancários via Pix aos afiliados da rede
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            {onNavigateToDashboard && (
              <button
                type="button"
                onClick={onNavigateToDashboard}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                <span className="hidden sm:inline">Voltar ao Dashboard</span>
                <span className="sm:hidden">Voltar</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setModalNovoRepasseOpen(true)}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#003400] hover:bg-[#004d00] text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              <span>Lançar Repasse</span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. CONTAINER PRINCIPAL                                                    */}
      {/* ========================================================================= */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 w-full space-y-4 sm:space-y-6">

        {/* 2.1 4 CARDS DE KPIS EXECUTIVOS */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Card 1: Faturamento SaaS / MRR */}
          <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                Faturamento SaaS
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">trending_up</span>
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-2xl lg:text-[26px] font-black text-slate-900 tracking-tight leading-none">
                R$ {totalReceitaSaaS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1.5 flex items-center gap-1">
                <span>↗</span>
                <span>{hoteisAtivosCount} hotéis ativos na rede</span>
              </p>
            </div>
            <div className="w-full h-1 bg-emerald-100 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full" style={{ width: '85%' }}></div>
            </div>
          </div>

          {/* Card 2: Total a Repassar (Pendente / A Pagar) */}
          <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-amber-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] sm:text-xs font-bold text-amber-800 uppercase tracking-wider">
                Repasses a Pagar
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">pending_actions</span>
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-2xl lg:text-[26px] font-black text-amber-600 tracking-tight leading-none">
                R$ {totalRepassesPendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-amber-700 font-semibold mt-1.5 flex items-center gap-1">
                <span>⏳</span>
                <span>{parceirosComRepassePendenteCount === 0 ? 'Nenhum parceiro aguardando Pix' : `${parceirosComRepassePendenteCount} ${parceirosComRepassePendenteCount === 1 ? 'parceiro aguardando Pix' : 'parceiros aguardando Pix'}`}</span>
              </p>
            </div>
            <div className="w-full h-1 bg-amber-100 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(parceirosComRepassePendenteCount * 20, 100)}%` }}></div>
            </div>
          </div>

          {/* Card 3: Total Já Repassado (Liquidado) */}
          <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-blue-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] sm:text-xs font-bold text-blue-800 uppercase tracking-wider">
                Total Liquidado
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">task_alt</span>
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-2xl lg:text-[26px] font-black text-blue-700 tracking-tight leading-none">
                R$ {totalRepassesLiquidados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-blue-600 font-semibold mt-1.5 flex items-center gap-1">
                <span>✓</span>
                <span>{repassesLiquidadosCount > 0 ? `${repassesLiquidadosCount} repasse(s) quitado(s) com comprovante` : 'Nenhum repasse quitado ainda'}</span>
              </p>
            </div>
            <div className="w-full h-1 bg-blue-100 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>

          {/* Card 4: Taxa Média e Lucro Líquido */}
          <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-purple-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] sm:text-xs font-bold text-purple-800 uppercase tracking-wider">
                Comissão Média
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">pie_chart</span>
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-2xl lg:text-[26px] font-black text-purple-900 tracking-tight leading-none">
                {taxaMediaComissao}%
              </div>
              <p className="text-[11px] text-purple-700 font-semibold mt-1.5 flex items-center gap-1">
                <span>💰</span>
                <span>{(100 - Number(taxaMediaComissao)).toFixed(1)}% margem retida SaaS</span>
              </p>
            </div>
            <div className="w-full h-1 bg-purple-100 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-purple-600 rounded-full" style={{ width: `${taxaMediaComissao}%` }}></div>
            </div>
          </div>

        </section>

        {/* 2.2 BARRA DE FILTROS, BUSCA E ALTERNADOR DE MODO LISTA / GRADE */}
        <section className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            
            {/* Input de Busca */}
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-lg">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por parceiro, chave Pix, banco ou mês..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>

            {/* Filtros em Dropdown no Desktop */}
            <div className="hidden lg:flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 cursor-pointer"
              >
                <option value="todos">Todos os Status</option>
                <option value="pendente">Pendentes (A Pagar)</option>
                <option value="pago">Pagos (Liquidados)</option>
                <option value="processando">Em Processamento</option>
              </select>

              <select
                value={competenciaFilter}
                onChange={(e) => setCompetenciaFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 cursor-pointer"
              >
                <option value="todos">Todas as Competências</option>
                <option value="09/2026">Setembro / 2026</option>
                <option value="08/2026">Agosto / 2026</option>
              </select>

              <select
                value={nivelFilter}
                onChange={(e) => setNivelFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 cursor-pointer"
              >
                <option value="todos">Todos os Níveis</option>
                <option value="Ouro Master">Ouro Master</option>
                <option value="Ouro">Ouro</option>
                <option value="Prata">Prata</option>
              </select>
            </div>

            {/* Alternador de Modo: LISTA vs GRADE (Desktop e Mobile) */}
            <div className="flex items-center justify-between sm:justify-end gap-2 border-t md:border-0 pt-2 md:pt-0">
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                className="lg:hidden px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base text-slate-500">filter_list</span>
                <span>Filtros ({statusFilter !== 'todos' ? '1' : '0'})</span>
              </button>

              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setViewMode('lista')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'lista'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Visualizar em Tabela / Lista Detalhada"
                >
                  <span className="material-symbols-outlined text-base">format_list_bulleted</span>
                  <span className="hidden sm:inline">Lista</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('grade')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'grade'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Visualizar em Grade de Cards"
                >
                  <span className="material-symbols-outlined text-base">grid_view</span>
                  <span className="hidden sm:inline">Grade</span>
                </button>
              </div>
            </div>

          </div>

          {/* Drawer / Barra de Filtros Mobile */}
          {isMobileFilterOpen && (
            <div className="lg:hidden grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 animate-in fade-in">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                >
                  <option value="todos">Todos Status</option>
                  <option value="pendente">Pendentes</option>
                  <option value="pago">Pagos</option>
                  <option value="processando">Processando</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Competência</label>
                <select
                  value={competenciaFilter}
                  onChange={(e) => setCompetenciaFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                >
                  <option value="todos">Todas Datas</option>
                  <option value="09/2026">Set / 2026</option>
                  <option value="08/2026">Ago / 2026</option>
                </select>
              </div>
            </div>
          )}
        </section>

        {/* 2.3 CONTEÚDO: MODO LISTA (TABELA) OU MODO GRADE (CARDS) */}
        {repassesFiltrados.length === 0 ? (
          <div className="py-16 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-sm p-8 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl">payments</span>
            </div>
            <h3 className="font-bold text-base text-slate-800">Nenhum repasse encontrado</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Não foram encontrados lançamentos de repasse para os filtros selecionados. Tente limpar a busca ou os filtros de status.
            </p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setStatusFilter('todos'); setCompetenciaFilter('todos'); }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
            >
              Limpar Filtros
            </button>
          </div>
        ) : viewMode === 'lista' ? (
          /* ========================================================= */
          /* MODO LISTA: TABELA MODERNA RESPONSIVA                      */
          /* ========================================================= */
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Parceiro / Favorecido</th>
                    <th className="py-3 px-4">Chave Pix & Banco</th>
                    <th className="py-3 px-3 text-center">Competência</th>
                    <th className="py-3 px-3 text-center">Taxa %</th>
                    <th className="py-3 px-4 text-right">Valor Repasse</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {repassesFiltrados.map((rep) => (
                    <tr 
                      key={rep.id} 
                      onClick={() => setModalDetalheRepasse(rep)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Parceiro */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${getAvatarBg(rep.avatarColor)}`}>
                            {rep.iniciais}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 group-hover:text-[#003400] transition-colors truncate max-w-[180px] sm:max-w-xs">
                              {rep.parceiroNome}
                            </div>
                            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 truncate">
                              <span>{rep.parceiroCategoria}</span>
                              <span>•</span>
                              <span className="text-amber-700 font-bold">{rep.parceiroNivel}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Chave Pix & Banco */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-800 text-xs truncate max-w-[170px]" title={rep.pixChave}>
                              {rep.pixChave}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopiarPix(rep.pixChave, e)}
                              className="p-1 rounded text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer shrink-0"
                              title="Copiar Chave Pix"
                            >
                              <span className="material-symbols-outlined text-sm">content_copy</span>
                            </button>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[190px]" title={`${rep.pixTipo} • ${rep.banco || 'Banco'}`}>
                            {rep.pixTipo} • {rep.banco || 'Banco Principal'}
                          </div>
                        </div>
                      </td>

                      {/* Competência */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-xs text-slate-700 whitespace-nowrap">
                          {rep.competencia}
                        </span>
                      </td>

                      {/* Taxa % */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="text-xs font-extrabold text-slate-700">
                          {rep.taxaComissao}%
                        </span>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          {rep.hoteisIndicadosCount} hotéis
                        </span>
                      </td>

                      {/* Valor do Repasse */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-black text-sm sm:text-base text-[#003400] whitespace-nowrap">
                          R$ {rep.valorRepasse.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block">
                          Base: R$ {rep.faturamentoGerado.toLocaleString('pt-BR')}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        {rep.status === 'pago' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="material-symbols-outlined text-xs">verified</span>
                            <span>Pago</span>
                          </span>
                        ) : rep.status === 'processando' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                            <span>Processando</span>
                          </span>
                        ) : rep.valorRepasse > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <span className="material-symbols-outlined text-xs">schedule</span>
                            <span>A Pagar</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="material-symbols-outlined text-xs">hourglass_empty</span>
                            <span>Sem Vendas</span>
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {rep.status === 'pago' ? (
                            <button
                              type="button"
                              onClick={() => setModalDetalheRepasse(rep)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                              title="Ver detalhes da transação"
                            >
                              Ver Recibo
                            </button>
                          ) : rep.valorRepasse > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setModalPagarRepasse(rep);
                                setCodigoTransacaoPix('');
                                setObservacaoPagamento('');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                              title="Confirmar pagamento via Pix"
                            >
                              <span className="material-symbols-outlined text-sm">payments</span>
                              <span>Pagar Pix</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setNovoParceiroId(rep.parceiroId);
                                setModalNovoRepasseOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                              title="Lançar repasse avulso para este parceiro"
                            >
                              <span className="material-symbols-outlined text-sm text-slate-500">add</span>
                              <span>Lançar</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Rodapé da Tabela */}
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Mostrando {repassesFiltrados.length} repasses calculados</span>
              <span className="font-bold text-slate-700">
                Total Filtrado: R$ {repassesFiltrados.reduce((acc, r) => acc + r.valorRepasse, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* MODO GRADE: CARDS MODERNOS RESPONSIVOS                    */
          /* ========================================================= */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {repassesFiltrados.map((rep) => (
              <div
                key={rep.id}
                onClick={() => setModalDetalheRepasse(rep)}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-600/60 transition-all p-4 sm:p-5 flex flex-col justify-between space-y-3 cursor-pointer group"
              >
                {/* Topo do Card */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${getAvatarBg(rep.avatarColor)}`}>
                        {rep.iniciais}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black text-sm sm:text-base text-slate-900 group-hover:text-[#003400] transition-colors truncate">
                          {rep.parceiroNome}
                        </h3>
                        <p className="text-[11px] text-slate-500 truncate font-medium">
                          {rep.parceiroCategoria} • <span className="text-amber-700 font-bold">{rep.parceiroNivel}</span>
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {rep.status === 'pago' ? (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                        <span className="material-symbols-outlined text-xs">verified</span>
                        <span>Pago</span>
                      </span>
                    ) : rep.status === 'processando' ? (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                        <span>Processando</span>
                      </span>
                    ) : rep.valorRepasse > 0 ? (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                        <span className="material-symbols-outlined text-xs">schedule</span>
                        <span>A Pagar</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                        <span className="material-symbols-outlined text-xs">hourglass_empty</span>
                        <span>Sem Vendas</span>
                      </span>
                    )}
                  </div>

                  {/* Bloco de Chave Pix & Banco */}
                  <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span className="font-semibold uppercase">{rep.pixTipo}</span>
                      <span className="truncate ml-1 text-right font-medium text-slate-600">{rep.banco || 'Banco Principal'}</span>
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-0.5">
                      <span className="font-mono font-bold text-slate-900 text-xs truncate" title={rep.pixChave}>
                        {rep.pixChave}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleCopiarPix(rep.pixChave, e)}
                        className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0"
                        title="Copiar Pix"
                      >
                        <span className="material-symbols-outlined text-xs">content_copy</span>
                        <span>Copiar</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Métricas e Faturamento */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Competência</span>
                    <span className="font-bold text-slate-800">{rep.competencia}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Comissão ({rep.taxaComissao}%)</span>
                    <span className="text-[11px] text-slate-600 font-semibold">{rep.hoteisIndicadosCount} hotéis</span>
                  </div>
                </div>

                {/* Rodapé do Card com Valor e Ação */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Valor a Repassar</span>
                    <span className="text-base sm:text-lg font-black text-[#003400] leading-none">
                      R$ {rep.valorRepasse.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {rep.status === 'pago' ? (
                    <button
                      type="button"
                      onClick={() => setModalDetalheRepasse(rep)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer shrink-0"
                    >
                      Recibo
                    </button>
                  ) : rep.valorRepasse > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setModalPagarRepasse(rep);
                        setCodigoTransacaoPix('');
                        setObservacaoPagamento('');
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <span className="material-symbols-outlined text-sm">payments</span>
                      <span>Pagar Pix</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setNovoParceiroId(rep.parceiroId);
                        setModalNovoRepasseOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm text-slate-500">add</span>
                      <span>Lançar</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* 3. MODAL: EFETUAR / CONFIRMAR REPASSE PIX                                 */}
      {/* ========================================================================= */}
      {modalPagarRepasse && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            
            {/* Topo do Modal */}
            <div className="bg-[#003400] text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-800 text-emerald-200 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">payments</span>
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg leading-tight">Confirmar Repasse Pix</h3>
                  <p className="text-xs text-emerald-200 font-medium">Liquidação de comissão de afiliado/parceiro</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalPagarRepasse(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Corpo do Modal */}
            <form onSubmit={handleConfirmarPagamento} className="p-4 sm:p-6 space-y-4">
              
              {/* Box de Valor e Favorecido */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Valor do Repasse</span>
                  <span className="text-xl sm:text-2xl font-black text-[#003400]">
                    R$ {modalPagarRepasse.valorRepasse.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="pt-2 border-t border-emerald-200/60 text-xs text-emerald-950 space-y-1">
                  <div><strong>Favorecido:</strong> {modalPagarRepasse.titular || modalPagarRepasse.parceiroNome}</div>
                  <div><strong>Instituição:</strong> {modalPagarRepasse.banco || 'Banco Principal'}</div>
                  <div><strong>Competência:</strong> {modalPagarRepasse.competenciaNome} ({modalPagarRepasse.taxaComissao}% de comissão)</div>
                </div>
              </div>

              {/* Chave Pix para Transferência com Botão de Copiar */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Chave Pix Cadastrada ({modalPagarRepasse.pixTipo})
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={modalPagarRepasse.pixChave}
                    className="flex-1 px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopiarPix(modalPagarRepasse.pixChave)}
                    className="px-3.5 py-2.5 bg-[#003400] hover:bg-[#004d00] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                    <span>Copiar Pix</span>
                  </button>
                </div>
              </div>

              {/* Código ou Comprovante da Transação Pix */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Código da Transação Pix / ID de Autenticação (Opcional)
                </label>
                <input
                  type="text"
                  value={codigoTransacaoPix}
                  onChange={(e) => setCodigoTransacaoPix(e.target.value)}
                  placeholder="Ex: E2E1234567890 ou Código do Comprovante"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <p className="text-[11px] text-slate-400">
                  Caso deixe em branco, um código de autenticação único do sistema será gerado automaticamente.
                </p>
              </div>

              {/* Observação / Mensagem interna */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Observações do Pagamento
                </label>
                <input
                  type="text"
                  value={observacaoPagamento}
                  onChange={(e) => setObservacaoPagamento(e.target.value)}
                  placeholder="Ex: Repassado via conta PJ Santander"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Botões do Rodapé */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalPagarRepasse(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">check</span>
                  <span>Confirmar Repasse Realizado</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL: NOVO LANÇAMENTO DE REPASSE AVULSO                                */}
      {/* ========================================================================= */}
      {modalNovoRepasseOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">add_card</span>
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg leading-tight">Novo Lançamento de Repasse</h3>
                  <p className="text-xs text-slate-400 font-medium">Lançar comissão manual ou bônus a parceiro</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalNovoRepasseOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSalvarNovoRepasse} className="p-4 sm:p-6 space-y-4">
              {/* Seleção do Parceiro */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Selecione o Parceiro *</label>
                <select
                  required
                  value={novoParceiroId}
                  onChange={(e) => setNovoParceiroId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 cursor-pointer"
                >
                  <option value="">-- Escolha o parceiro cadastrado --</option>
                  {parceiros.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.level || 'Parceiro'}) - {p.category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Valor e Competência */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Valor do Repasse (R$) *</label>
                  <input
                    type="text"
                    required
                    value={novoValorRepasse}
                    onChange={(e) => setNovoValorRepasse(e.target.value)}
                    placeholder="Ex: 1250.00"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Competência *</label>
                  <select
                    value={novaCompetencia}
                    onChange={(e) => setNovaCompetencia(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 cursor-pointer"
                  >
                    <option value="09/2026">09/2026 (Setembro)</option>
                    <option value="10/2026">10/2026 (Outubro)</option>
                    <option value="08/2026">08/2026 (Agosto)</option>
                  </select>
                </div>
              </div>

              {/* Motivo / Descrição */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Motivo / Descrição</label>
                <input
                  type="text"
                  value={novoMotivo}
                  onChange={(e) => setNovoMotivo(e.target.value)}
                  placeholder="Ex: Comissão por atingimento de meta de hotéis"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovoRepasseOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs sm:text-sm font-bold bg-[#003400] hover:bg-[#004d00] text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>Salvar Lançamento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: DETALHES COMPLETOS / COMPROVANTE DO REPASSE                     */}
      {/* ========================================================================= */}
      {modalDetalheRepasse && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">receipt_long</span>
                <h3 className="font-bold text-base">Recibo de Repasse</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalDetalheRepasse(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs sm:text-sm">
              <div className="text-center py-2 border-b border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase block">Valor Liquidado</span>
                <span className="text-2xl sm:text-3xl font-black text-[#003400]">
                  R$ {modalDetalheRepasse.valorRepasse.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  modalDetalheRepasse.status === 'pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {modalDetalheRepasse.status === 'pago' ? 'Pago com Sucesso' : 'Pendente de Pagamento'}
                </span>
              </div>

              <div className="space-y-2 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">Parceiro:</span>
                  <span className="font-bold text-slate-900">{modalDetalheRepasse.parceiroNome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Nível / Categoria:</span>
                  <span className="font-semibold">{modalDetalheRepasse.parceiroNivel} ({modalDetalheRepasse.taxaComissao}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Competência:</span>
                  <span className="font-semibold">{modalDetalheRepasse.competenciaNome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Chave Pix:</span>
                  <span className="font-mono font-bold">{modalDetalheRepasse.pixChave}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Instituição Bancária:</span>
                  <span>{modalDetalheRepasse.banco || 'Nu Pagamentos'}</span>
                </div>
                {modalDetalheRepasse.dataPagamento && (
                  <div className="flex justify-between text-emerald-800 font-semibold">
                    <span>Data da Liquidação:</span>
                    <span>{modalDetalheRepasse.dataPagamento}</span>
                  </div>
                )}
                {modalDetalheRepasse.comprovanteId && (
                  <div className="flex justify-between text-slate-600 font-mono text-[11px] pt-1 border-t border-slate-100">
                    <span>Código Pix E2E:</span>
                    <span className="truncate max-w-[190px]">{modalDetalheRepasse.comprovanteId}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleCopiarPix(modalDetalheRepasse.pixChave)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Copiar Pix
                </button>
                <button
                  type="button"
                  onClick={() => setModalDetalheRepasse(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ReceitaRepasses;
