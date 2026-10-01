import React, { useState, useEffect, useMemo } from 'react';
import { hoteisService, planosService } from '../services/supabaseService';
import { Hotel } from './CadastroHoteis';
import { creditosService, PACOTES_CREDITOS_MODELO_1, PacoteCredito, InfoCreditoHotel, converterPlanosParaPacotes } from '../services/creditosService';

export interface GestaoCreditosSaaSProps {
  onBackToDashboard?: () => void;
  onNavigateToHotel?: (hotel: Hotel) => void;
}

export const GestaoCreditosSaaS: React.FC<GestaoCreditosSaaSProps> = ({
  onBackToDashboard,
  onNavigateToHotel
}) => {
  const [hoteis, setHoteis] = useState<Hotel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'degustacao' | 'alerta' | 'expirado'>('todos');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pacotes de Créditos Oficiais (carregados dinamicamente do banco de dados)
  const [pacotesDisponiveis, setPacotesDisponiveis] = useState<PacoteCredito[]>(PACOTES_CREDITOS_MODELO_1);

  // Modal de Recarga
  const [selectedHotelForRecharge, setSelectedHotelForRecharge] = useState<Hotel | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PacoteCredito>(PACOTES_CREDITOS_MODELO_1[0]);

  // Modal de Inclusão de Dias / Prorrogação
  const [selectedHotelForAddDays, setSelectedHotelForAddDays] = useState<Hotel | null>(null);
  const [daysToAdd, setDaysToAdd] = useState<number>(15);
  const [reasonToAdd, setReasonToAdd] = useState<string>('Prorrogação para programação de compra');
  const [planFilter, setPlanFilter] = useState<string>('todos');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const carregarHoteis = async () => {
    setIsLoading(true);
    try {
      const data = await hoteisService.getHoteis();
      setHoteis(data || []);
    } catch (e) {
      console.error('Erro ao carregar hoteis para gestao de creditos:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const carregarPlanos = async () => {
    try {
      const data = await planosService.getPlanos();
      if (data && data.length > 0) {
        const convertidos = converterPlanosParaPacotes(data);
        setPacotesDisponiveis(convertidos);
        setSelectedPackage(prev => {
          const match = convertidos.find(p => p.id === prev.id || p.creditos === prev.creditos);
          return match || convertidos[0];
        });
      }
    } catch (e) {
      console.warn('Erro ao carregar planos reais do banco para recarga:', e);
    }
  };

  useEffect(() => {
    carregarHoteis();
    carregarPlanos();

    const unsubHoteis = hoteisService.subscribeHoteis
      ? hoteisService.subscribeHoteis(() => carregarHoteis())
      : null;

    const unsubPlanos = planosService.subscribePlanos
      ? planosService.subscribePlanos(() => carregarPlanos())
      : null;

    return () => {
      if (typeof unsubHoteis === 'function') (unsubHoteis as () => void)();
      if (typeof unsubPlanos === 'function') (unsubPlanos as () => void)();
    };
  }, []);

  // Paginação: 20 hotéis por página
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Mapa de status de crédito por hotel
  const creditosMap = useMemo(() => {
    const map = new Map<string, InfoCreditoHotel>();
    hoteis.forEach(h => {
      map.set(h.id, creditosService.calcularInfoCreditos(h));
    });
    return map;
  }, [hoteis]);

  // Identifica se o hotel possui plano cadastrado válido
  const hotelTemPlano = (h: Hotel): boolean => {
    if (!h.plan || typeof h.plan !== 'string') return false;
    const p = h.plan.trim().toLowerCase();
    if (!p || p === 'sem plano' || p === 'sem_plano' || p === 'nenhum') return false;
    return true;
  };

  // Apenas hotéis que possuem plano cadastrado
  const hoteisComPlano = useMemo(() => {
    return hoteis.filter(h => hotelTemPlano(h));
  }, [hoteis]);

  // Configuração dos 10 Planos Oficiais do Sistema com cores nos fundos dos cards
  const PLANOS_CARDS = [
    { 
      key: '1', 
      nome: '1 Crédito', 
      badge: 'Adesão', 
      icon: 'credit_card', 
      bg: 'bg-emerald-50 hover:bg-emerald-100/70', 
      border: 'border-emerald-300', 
      titleColor: 'text-emerald-950', 
      badgeColor: 'text-emerald-800 bg-emerald-200/70', 
      iconColor: 'text-emerald-600',
      countColor: 'text-emerald-950',
      subColor: 'text-emerald-700'
    },
    { 
      key: '2', 
      nome: '2 Créditos', 
      badge: 'Bimestral', 
      icon: 'credit_card', 
      bg: 'bg-teal-50 hover:bg-teal-100/70', 
      border: 'border-teal-300', 
      titleColor: 'text-teal-950', 
      badgeColor: 'text-teal-800 bg-teal-200/70', 
      iconColor: 'text-teal-600',
      countColor: 'text-teal-950',
      subColor: 'text-teal-700'
    },
    { 
      key: '3', 
      nome: '3 Créditos', 
      badge: 'Trimestral', 
      icon: 'credit_card', 
      bg: 'bg-cyan-50 hover:bg-cyan-100/70', 
      border: 'border-cyan-300', 
      titleColor: 'text-cyan-950', 
      badgeColor: 'text-cyan-800 bg-cyan-200/70', 
      iconColor: 'text-cyan-600',
      countColor: 'text-cyan-950',
      subColor: 'text-cyan-700'
    },
    { 
      key: '4', 
      nome: '4 Créditos', 
      badge: 'Quadrimestral', 
      icon: 'credit_card', 
      bg: 'bg-sky-50 hover:bg-sky-100/70', 
      border: 'border-sky-300', 
      titleColor: 'text-sky-950', 
      badgeColor: 'text-sky-800 bg-sky-200/70', 
      iconColor: 'text-sky-600',
      countColor: 'text-sky-950',
      subColor: 'text-sky-700'
    },
    { 
      key: '5', 
      nome: '5 Créditos', 
      badge: 'Quinquemestral', 
      icon: 'credit_card', 
      bg: 'bg-blue-50 hover:bg-blue-100/70', 
      border: 'border-blue-300', 
      titleColor: 'text-blue-950', 
      badgeColor: 'text-blue-800 bg-blue-200/70', 
      iconColor: 'text-blue-600',
      countColor: 'text-blue-950',
      subColor: 'text-blue-700'
    },
    { 
      key: '6', 
      nome: '6 Créditos', 
      badge: 'Semestral', 
      icon: 'credit_card', 
      bg: 'bg-indigo-50 hover:bg-indigo-100/70', 
      border: 'border-indigo-300', 
      titleColor: 'text-indigo-950', 
      badgeColor: 'text-indigo-800 bg-indigo-200/70', 
      iconColor: 'text-indigo-600',
      countColor: 'text-indigo-950',
      subColor: 'text-indigo-700'
    },
    { 
      key: '7', 
      nome: '7 Créditos', 
      badge: 'Septemestral', 
      icon: 'credit_card', 
      bg: 'bg-purple-50 hover:bg-purple-100/70', 
      border: 'border-purple-300', 
      titleColor: 'text-purple-950', 
      badgeColor: 'text-purple-800 bg-purple-200/70', 
      iconColor: 'text-purple-600',
      countColor: 'text-purple-950',
      subColor: 'text-purple-700'
    },
    { 
      key: '8', 
      nome: '8 Créditos', 
      badge: 'Octomestral', 
      icon: 'credit_card', 
      bg: 'bg-rose-50 hover:bg-rose-100/70', 
      border: 'border-rose-300', 
      titleColor: 'text-rose-950', 
      badgeColor: 'text-rose-800 bg-rose-200/70', 
      iconColor: 'text-rose-600',
      countColor: 'text-rose-950',
      subColor: 'text-rose-700'
    },
    { 
      key: '12', 
      nome: '12 Créditos', 
      badge: 'Anual', 
      icon: 'workspace_premium', 
      bg: 'bg-amber-50 hover:bg-amber-100/70', 
      border: 'border-amber-300', 
      titleColor: 'text-amber-950', 
      badgeColor: 'text-amber-800 bg-amber-200/70', 
      iconColor: 'text-amber-600',
      countColor: 'text-amber-950',
      subColor: 'text-amber-700'
    },
    { 
      key: 'gratis', 
      nome: 'Plano Grátis', 
      badge: 'Google Maps', 
      icon: 'map', 
      bg: 'bg-slate-100 hover:bg-slate-200/70', 
      border: 'border-slate-300', 
      titleColor: 'text-slate-900', 
      badgeColor: 'text-slate-700 bg-slate-200', 
      iconColor: 'text-slate-600',
      countColor: 'text-slate-900',
      subColor: 'text-slate-600'
    }
  ];

  // Helper para identificar a qual plano um hotel pertence
  const getHotelPlanKey = (h: Hotel): string => {
    const pLower = (h.plan || '').toLowerCase();
    const notesLower = ((h as any).notes || (h as any).observacoes || '').toLowerCase();
    const isGoogle = pLower.includes('grátis') || pLower.includes('gratis') || pLower.includes('maps') || pLower.includes('free') || notesLower.includes('google') || Boolean((h as any).isImportedFromGoogle);
    if (isGoogle) return 'gratis';

    if (pLower.includes('12')) return '12';
    if (pLower.includes('8')) return '8';
    if (pLower.includes('7')) return '7';
    if (pLower.includes('6')) return '6';
    if (pLower.includes('5')) return '5';
    if (pLower.includes('4')) return '4';
    if (pLower.includes('3')) return '3';
    if (pLower.includes('2')) return '2';
    if (pLower.includes('1') && !pLower.includes('10') && !pLower.includes('15')) return '1';

    const info = creditosMap.get(h.id);
    if (info) {
      if (info.saldoCreditos === 12) return '12';
      if (info.saldoCreditos >= 1 && info.saldoCreditos <= 8) return String(info.saldoCreditos);
    }
    return '1';
  };

  // Contagem de hotéis com plano cadastrado por categoria de plano
  const planCounts = useMemo(() => {
    const counts: Record<string, number> = {
      '1': 0, '2': 0, '3': 0, '4': 0, '5': 0,
      '6': 0, '7': 0, '8': 0, '12': 0, 'gratis': 0
    };
    hoteisComPlano.forEach(h => {
      const k = getHotelPlanKey(h);
      if (counts[k] !== undefined) {
        counts[k]++;
      } else {
        counts['1']++;
      }
    });
    return counts;
  }, [hoteisComPlano, creditosMap]);

  // Hotéis com planos pagos (não estão no plano grátis)
  const hoteisPagos = useMemo(() => {
    return hoteisComPlano.filter(h => getHotelPlanKey(h) !== 'gratis');
  }, [hoteisComPlano]);

  // Filtragem dos hotéis:
  // - Padrão: mostra somente os hotéis que NÃO estão no plano grátis
  // - Pesquisa/Filtro: os demais hotéis ficam totalmente disponíveis para pesquisa ou quando selecionado o filtro
  const filteredHoteis = useMemo(() => {
    const isSearching = Boolean(searchTerm && searchTerm.trim().length > 0);
    const q = searchTerm.toLowerCase().trim();

    return hoteisComPlano
      .filter(h => {
        const k = getHotelPlanKey(h);
        const isGratis = k === 'gratis';

        // 1. Quando NÃO está em modo pesquisa por texto:
        if (!isSearching) {
          if (planFilter === 'todos') {
            // Regra principal: mostrar somente os que NÃO estão no plano grátis
            if (isGratis) return false;
          } else if (planFilter === 'todos_com_gratis') {
            // Se o admin escolher ver todos
          } else {
            // Filtro por plano específico (ex: 'gratis' ou '1', '2', etc.)
            if (k !== planFilter) return false;
          }
        } else {
          // 2. Quando ESTÁ pesquisando por texto:
          // Se houver um filtro específico selecionado (diferente de 'todos' e 'todos_com_gratis'), respeita
          if (planFilter !== 'todos' && planFilter !== 'todos_com_gratis') {
            if (k !== planFilter) return false;
          }
          // Caso contrário (planFilter === 'todos'), todos os hotéis (incluindo plano grátis) ficam disponíveis para pesquisa!
        }

        // Filtro de texto da pesquisa (nome, CNPJ, gestor, cidade, UF, email, etc.)
        if (isSearching) {
          const matchSearch =
            h.name.toLowerCase().includes(q) ||
            (h.cnpj || '').includes(q) ||
            (h.managerName || '').toLowerCase().includes(q) ||
            (h.city || '').toLowerCase().includes(q) ||
            (h.uf || '').toLowerCase().includes(q) ||
            (h.managerEmail || '').toLowerCase().includes(q) ||
            (h.razaoSocial || '').toLowerCase().includes(q);
          if (!matchSearch) return false;
        }

        // Filtro por status de crédito
        const info = creditosMap.get(h.id);
        if (!info) return true;

        if (statusFilter === 'degustacao') return info.emDegustacao;
        if (statusFilter === 'alerta') return info.status === 'alerta';
        if (statusFilter === 'expirado') return info.status === 'expirado';

        return true;
      })
      .sort((a, b) => {
        // O primeiro sempre será o último hotel que se cadastrou (ordem cronológica decrescente)
        const timeA = new Date((a as any).createdAt || (a as any).criado_em || 0).getTime();
        const timeB = new Date((b as any).createdAt || (b as any).criado_em || 0).getTime();
        return timeB - timeA;
      });
  }, [hoteisComPlano, searchTerm, statusFilter, planFilter, creditosMap]);

  // Resetar página ao mudar filtros de busca/plano/status
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, planFilter, statusFilter]);

  // Cálculos de Paginação (20 hotéis por página)
  const totalItems = filteredHoteis.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const paginatedHoteis = useMemo(() => {
    return filteredHoteis.slice(startIndex, endIndex);
  }, [filteredHoteis, startIndex, endIndex]);

  // Ação: Adicionar 15 dias de bônus cortesia
  const handleDarBonus = (hotel: Hotel) => {
    const novaInfo = creditosService.adicionarDiasAoHotel(hotel.id, 15, 'Bônus rápido +15d', hotel.name);
    showToast(`+15 dias de bônus adicionados com sucesso ao "${hotel.name}"! Nova validade: ${novaInfo.dataExpiracaoFormatada}`);
    carregarHoteis();
  };

  // Ação: Confirmar Inclusão Personalizada de Dias
  const handleConfirmarInclusaoDias = () => {
    if (!selectedHotelForAddDays || daysToAdd <= 0) return;
    const novaInfo = creditosService.adicionarDiasAoHotel(
      selectedHotelForAddDays.id,
      daysToAdd,
      reasonToAdd,
      selectedHotelForAddDays.name
    );
    showToast(`+${daysToAdd} dias adicionados com sucesso ao "${selectedHotelForAddDays.name}"! Nova validade: ${novaInfo.dataExpiracaoFormatada}`);
    setSelectedHotelForAddDays(null);
    carregarHoteis();
  };

  // Ação: Confirmar Recarga do Pacote
  const handleConfirmarRecarga = () => {
    if (!selectedHotelForRecharge) return;
    const novaInfo = creditosService.recarregarPacote(selectedHotelForRecharge.id, selectedPackage);
    showToast(`Recarga de ${selectedPackage.nome} aplicada ao "${selectedHotelForRecharge.name}"! Saldo: ${novaInfo.saldoCreditos} créditos (${novaInfo.diasRestantes} dias restantes).`);
    setSelectedHotelForRecharge(null);
    carregarHoteis();
  };

  // Base para os totalizadores (hotéis em planos pagos por padrão, ou todos se selecionado ou pesquisando)
  const baseParaTotalizadores = useMemo(() => {
    if (planFilter === 'todos_com_gratis' || planFilter === 'gratis' || (searchTerm && searchTerm.trim().length > 0)) {
      return hoteisComPlano;
    }
    return hoteisPagos;
  }, [hoteisComPlano, hoteisPagos, planFilter, searchTerm]);

  // Totalizadores
  const totalHoteisEmDegustacao = useMemo(() => {
    return baseParaTotalizadores.filter(h => creditosMap.get(h.id)?.emDegustacao).length;
  }, [baseParaTotalizadores, creditosMap]);

  const totalEmAlerta = useMemo(() => {
    return baseParaTotalizadores.filter(h => creditosMap.get(h.id)?.status === 'alerta').length;
  }, [baseParaTotalizadores, creditosMap]);

  const totalExpirados = useMemo(() => {
    return baseParaTotalizadores.filter(h => creditosMap.get(h.id)?.status === 'expirado').length;
  }, [baseParaTotalizadores, creditosMap]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#f8f9ff] overflow-y-auto">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200 border border-slate-800">
          <span className="material-symbols-outlined text-emerald-400 text-xl">verified</span>
          <span className="text-xs sm:text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-5 sticky top-0 z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Voltar ao Dashboard Master"
              >
                <span className="material-symbols-outlined text-2xl">arrow_back</span>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Créditos
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#003400] text-white uppercase tracking-wider">
                  Modelo 1 (Oficial)
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Gestão exclusiva de administradores para recargas de tempo de uso, controle de degustação e bonificações.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => carregarHoteis()}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <span className={`material-symbols-outlined text-base ${isLoading ? 'animate-spin' : ''}`}>sync</span>
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
        
        {/* CARDS RESUMO DOS PLANOS (2 LINHAS NO DESKTOP COM 5 CARDS / 2 CARDS POR LINHA NO MOBILE) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-700 text-lg">view_cozy</span>
              <span>Distribuição de Hotéis por Plano</span>
            </h2>
            {planFilter !== 'todos' && (
              <button
                type="button"
                onClick={() => setPlanFilter('todos')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">clear_all</span>
                <span>Limpar filtro de plano ({planFilter === 'gratis' ? 'Plano Grátis' : `${planFilter} Créditos`})</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-3.5">
            {PLANOS_CARDS.map((p) => {
              const count = planCounts[p.key] || 0;
              const isSelected = planFilter === p.key;

              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPlanFilter(prev => prev === p.key ? 'todos' : p.key)}
                  className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between shadow-2xs hover:shadow-md active:scale-98 ${
                    isSelected
                      ? 'bg-[#003400] text-white border-emerald-500 ring-2 ring-emerald-500 shadow-md'
                      : `${p.bg} ${p.border}`
                  }`}
                  title={`Clique para filtrar os hotéis cadastrados no plano ${p.nome}`}
                >
                  {/* Topo do Card: Nome do Plano */}
                  <div className="flex items-start justify-between gap-1.5 w-full">
                    <div className="min-w-0">
                      <span className={`block font-black text-xs sm:text-sm tracking-tight truncate ${isSelected ? 'text-white' : p.titleColor}`}>
                        {p.nome}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md inline-block mt-0.5 ${isSelected ? 'text-emerald-200 bg-emerald-900/60' : p.badgeColor}`}>
                        {p.badge}
                      </span>
                    </div>
                    <span className={`material-symbols-outlined text-lg shrink-0 ${isSelected ? 'text-emerald-300' : p.iconColor}`}>
                      {p.icon}
                    </span>
                  </div>

                  {/* Base do Card: Quantidade de Hotéis */}
                  <div 
                    className="pt-2 sm:pt-3 mt-2.5 border-t flex items-baseline justify-between w-full"
                    style={{ borderColor: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)' }}
                  >
                    <span className={`text-2xl sm:text-3xl font-black ${isSelected ? 'text-white' : p.countColor}`}>
                      {count}
                    </span>
                    <span className={`text-[11px] font-bold ${isSelected ? 'text-emerald-200' : p.subColor}`}>
                      {count === 1 ? 'hotel' : 'hotéis'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>



        {/* MONITORAMENTO DE HOTÉIS & DIAS RESTANTES */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Header da Tabela com Filtros */}
          <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003400]">hotel</span>
                <span>Status de Validade &amp; Créditos dos Hotéis</span>
              </h3>
              <p className="text-xs text-slate-500">
                Monitore em tempo real o saldo de créditos e validade de cada hotel. Adicione bônus ou recargas com 1 clique.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Barra de Pesquisa */}
              <div className="relative min-w-[240px] sm:min-w-[280px]">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar em todos os hotéis (nome, CNPJ)..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#003400] bg-slate-50 focus:bg-white transition-all shadow-2xs"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 rounded-full hover:bg-slate-200 transition-colors"
                    title="Limpar pesquisa e voltar aos planos pagos"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                )}
              </div>

              {/* Filtro por Plano */}
              <div className="relative">
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className="py-2 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#003400] cursor-pointer shadow-2xs"
                >
                  <option value="todos">Hotéis com Planos Pagos ({hoteisPagos.length})</option>
                  <option value="todos_com_gratis">Todos os Hotéis ({hoteisComPlano.length})</option>
                  {PLANOS_CARDS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.nome} ({planCounts[p.key] || 0})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtros Rápidos */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('todos')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    statusFilter === 'todos' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos ({baseParaTotalizadores.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('degustacao')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'degustacao' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Degustação ({totalHoteisEmDegustacao})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('alerta')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'alerta' ? 'bg-amber-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Acabando ({totalEmAlerta})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('expirado')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'expirado' ? 'bg-red-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Expirados ({totalExpirados})
                </button>
              </div>
            </div>
          </div>

          {/* Banner Informativo quando pesquisando */}
          {searchTerm.trim().length > 0 && (
            <div className="px-4 sm:px-6 py-2 bg-emerald-50/80 border-b border-emerald-100 flex items-center justify-between text-xs text-emerald-950">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-700 text-base">manage_search</span>
                <span>
                  Pesquisando em todos os hotéis do sistema (incluindo Plano Grátis): <strong>{filteredHoteis.length}</strong> resultado(s) para &quot;<strong>{searchTerm}</strong>&quot;
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Voltar aos planos pagos</span>
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          {/* Listagem em Tabela */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-extrabold tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Hotel / Pousada</th>
                  <th className="px-4 py-3.5">Plano Contratado</th>
                  <th className="px-4 py-3.5 text-center">Saldo Créditos</th>
                  <th className="px-4 py-3.5 text-center">Dias Restantes</th>
                  <th className="px-4 py-3.5 text-center">Expiração</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-right">Ações de Crédito (Admin)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-xl text-emerald-600">sync</span>
                        <span className="text-xs font-medium">Carregando situação dos hotéis...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredHoteis.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      Nenhum hotel encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  paginatedHoteis.map((hotel) => {
                    const info = creditosMap.get(hotel.id) || creditosService.calcularInfoCreditos(hotel);

                    return (
                      <tr key={hotel.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Identidade */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {hotel.imageUrl ? (
                                <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="material-symbols-outlined text-slate-400 text-base">hotel</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate max-w-[200px]" title={hotel.name}>
                                {hotel.name}
                              </span>
                              <span className="text-[11px] text-slate-500 truncate block">
                                {hotel.cityUf || 'Brasil'} • CNPJ: {hotel.cnpj || 'Não informado'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Plano */}
                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-slate-800 block text-xs">
                            {hotel.plan || 'Professional'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {hotel.capacity || 10} quartos
                          </span>
                        </td>

                        {/* Saldo de Créditos */}
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-black text-xs border border-emerald-200/60">
                            <span className="material-symbols-outlined text-sm text-emerald-600">toll</span>
                            {info.saldoCreditos} {info.saldoCreditos === 1 ? 'crédito' : 'créditos'}
                          </span>
                        </td>

                        {/* Dias Restantes */}
                        <td className="px-4 py-3.5 text-center">
                          <span 
                            className={`inline-block px-3 py-1 rounded-full text-xs font-black ${
                              info.status === 'expirado'
                                ? 'bg-red-100 text-red-700'
                                : info.status === 'alerta'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {info.diasRestantes > 0 ? `${info.diasRestantes} dias` : 'Expirado'}
                          </span>
                        </td>

                        {/* Data de Expiração */}
                        <td className="px-4 py-3.5 text-center">
                          <span className="font-mono text-xs text-slate-700 font-semibold block">
                            {info.dataExpiracaoFormatada}
                          </span>
                        </td>

                        {/* Status / Degustação */}
                        <td className="px-4 py-3.5 text-center">
                          {info.emDegustacao ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                              <span className="material-symbols-outlined text-xs">card_giftcard</span>
                              Degustação
                            </span>
                          ) : info.status === 'ativo' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              Ativo
                            </span>
                          ) : info.status === 'alerta' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                              Reta Final
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                              Expirado
                            </span>
                          )}
                        </td>

                        {/* Botões de Ação */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Incluir Dias (Prorrogação de Prazo) */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedHotelForAddDays(hotel);
                                setDaysToAdd(15);
                                setReasonToAdd('Prorrogação para programação de compra');
                              }}
                              title="Incluir dias adicionais para programação de compra do cliente"
                              className="px-2.5 py-1.5 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                            >
                              <span className="material-symbols-outlined text-sm text-blue-600">more_time</span>
                              <span>Incluir Dias</span>
                            </button>

                            {/* Dar +15 dias bônus imediato */}
                            <button
                              type="button"
                              onClick={() => handleDarBonus(hotel)}
                              title="Conceder +15 dias de bônus imediato a este hotel"
                              className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                            >
                              <span className="material-symbols-outlined text-sm">add_circle</span>
                              <span>+15d Bônus</span>
                            </button>

                            {/* Recarregar com Pacote */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedHotelForRecharge(hotel);
                                const k = getHotelPlanKey(hotel);
                                const matched = pacotesDisponiveis.find(p => String(p.creditos) === k) || pacotesDisponiveis[0];
                                setSelectedPackage(matched);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#003400] hover:bg-[#002500] text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1 active:scale-95"
                            >
                              <span className="material-symbols-outlined text-sm">replay</span>
                              <span>Recarregar</span>
                            </button>

                            {/* Acessar Hotel */}
                            {onNavigateToHotel && (
                              <button
                                type="button"
                                onClick={() => onNavigateToHotel(hotel)}
                                title="Acessar painel deste hotel"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-base">login</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé com Paginação de 20 linhas */}
          {filteredHoteis.length > 0 && (
            <div className="p-4 sm:px-6 py-4 bg-slate-50/90 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-600 font-medium">
                Mostrando <span className="font-bold text-slate-900">{totalItems > 0 ? startIndex + 1 : 0}</span> a{' '}
                <span className="font-bold text-slate-900">{endIndex}</span> de{' '}
                <span className="font-bold text-slate-900">{totalItems}</span> hotéis{' '}
                {searchTerm.trim().length > 0
                  ? 'encontrados na pesquisa'
                  : planFilter === 'todos'
                    ? 'com planos pagos (exceto grátis)'
                    : planFilter === 'gratis'
                      ? 'no Plano Grátis'
                      : 'cadastrados no plano selecionado'}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  {/* Primeira página */}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    title="Primeira página"
                  >
                    <span className="material-symbols-outlined text-base">first_page</span>
                  </button>

                  {/* Anterior */}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-0.5"
                    title="Página anterior"
                  >
                    <span className="material-symbols-outlined text-base">chevron_left</span>
                    <span className="hidden sm:inline font-semibold text-[11px]">Anterior</span>
                  </button>

                  {/* Indicadores de Páginas */}
                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        if (totalPages <= 7) return true;
                        if (page === 1 || page === totalPages) return true;
                        return Math.abs(page - currentPage) <= 2;
                      })
                      .map((page, idx, arr) => {
                        const prevPage = arr[idx - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;

                        return (
                          <React.Fragment key={page}>
                            {showEllipsis && (
                              <span className="px-1 text-slate-400 font-bold select-none">...</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setCurrentPage(page)}
                              className={`min-w-[32px] h-8 px-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                                currentPage === page
                                  ? 'bg-[#003400] text-white shadow-xs'
                                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {page}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  {/* Próxima */}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-0.5"
                    title="Próxima página"
                  >
                    <span className="hidden sm:inline font-semibold text-[11px]">Próxima</span>
                    <span className="material-symbols-outlined text-base">chevron_right</span>
                  </button>

                  {/* Última página */}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    title="Última página"
                  >
                    <span className="material-symbols-outlined text-base">last_page</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* MODAL DE RECARGA DE CRÉDITOS (ADMINISTRADOR) */}
      {selectedHotelForRecharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">toll</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Recarga de Créditos (Modelo 1)
                  </h3>
                  <p className="text-xs text-slate-500 truncate max-w-[280px]">
                    Hotel: <strong>{selectedHotelForRecharge.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHotelForRecharge(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Selecione o Pacote de Créditos Desejado:
              </label>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {pacotesDisponiveis.map((p) => {
                  const isSelected = selectedPackage.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPackage(p)}
                      className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected 
                          ? 'border-[#003400] bg-emerald-50/50 shadow-xs' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`material-symbols-outlined text-xl ${isSelected ? 'text-[#003400]' : 'text-slate-300'}`}>
                          {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900 text-sm block">{p.nome}</span>
                          <span className="text-xs text-slate-500">
                            {p.diasBase} dias base <strong className="text-emerald-700">+ {p.diasBonus} dias bônus</strong> = <strong>{p.totalDias} dias ativos</strong>
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-black text-slate-900 block">R$ {p.preco.toFixed(2).replace('.', ',')}</span>
                        <span className="text-[10px] text-slate-400">{p.creditos} {p.creditos === 1 ? 'crédito' : 'créditos'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resumo da Ação */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <span>Total a ser somado ao hotel:</span>
              <span className="font-extrabold text-emerald-900 text-sm">+ {selectedPackage.totalDias} dias ativos</span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedHotelForRecharge(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmarRecarga}
                className="px-5 py-2 rounded-xl bg-[#003400] hover:bg-[#002500] text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer active:scale-95 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">check</span>
                <span>Confirmar Recarga</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE INCLUSÃO DE DIAS / PRORROGAÇÃO PARA PROGRAMAÇÃO DE COMPRA */}
      {selectedHotelForAddDays && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">more_time</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Incluir Dias ao Hotel
                  </h3>
                  <p className="text-xs text-slate-500 truncate max-w-[240px]">
                    Hotel: <strong>{selectedHotelForAddDays.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHotelForAddDays(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Plano Atual:</span>
                  <strong className="text-slate-800">{selectedHotelForAddDays.plan || 'Plano Degustação'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Validade Atual:</span>
                  <strong className="text-slate-800">
                    {creditosMap.get(selectedHotelForAddDays.id)?.dataExpiracaoFormatada || 'Expirado'}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Selecione ou digite os dias a adicionar:
                </label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[7, 15, 30, 45].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDaysToAdd(d)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        daysToAdd === d
                          ? 'bg-[#003400] text-white border-[#003400] shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      +{d} Dias
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={daysToAdd}
                    onChange={(e) => setDaysToAdd(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#003400]"
                    placeholder="Outra quantidade de dias..."
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">dias de cortesia</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo da Concessão:
                </label>
                <input
                  type="text"
                  value={reasonToAdd}
                  onChange={(e) => setReasonToAdd(e.target.value)}
                  placeholder="Ex: Programação para próxima contratação"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#003400]"
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                <span>Nova data estimada:</span>
                <strong className="font-extrabold text-sm">
                  {new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}
                </strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedHotelForAddDays(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmarInclusaoDias}
                className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs cursor-pointer active:scale-95 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">check</span>
                <span>Adicionar Dias e Liberar</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
