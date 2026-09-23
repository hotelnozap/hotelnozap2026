import React, { useState, useMemo, useEffect } from 'react';
import { caixaService, CaixaMovimentacao } from '../services/caixaService';
export type { CaixaMovimentacao };

export interface ControleCaixaProps {
  onNavigateToDashboard?: () => void;
  onNavigateToContasPagar?: () => void;
  onNavigateToContasReceber?: () => void;
}

export const ControleCaixa: React.FC<ControleCaixaProps> = ({ onNavigateToDashboard, onNavigateToContasPagar, onNavigateToContasReceber }) => {
  const [movimentacoes, setMovimentacoes] = useState<CaixaMovimentacao[]>(() => caixaService.getMovimentacoes());
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'entrada' | 'saida'>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('turn_now');

  // Modals
  const [selectedMovForView, setSelectedMovForView] = useState<CaixaMovimentacao | null>(null);
  const [selectedMovForEdit, setSelectedMovForEdit] = useState<CaixaMovimentacao | null>(null);
  const [movToDelete, setMovToDelete] = useState<CaixaMovimentacao | null>(null);
  
  const [isEntradaModalOpen, setIsEntradaModalOpen] = useState(false);
  const [isSangriaModalOpen, setIsSangriaModalOpen] = useState(false);
  const [isFecharCaixaModalOpen, setIsFecharCaixaModalOpen] = useState(false);

  // Form entries
  const [formDesc, setFormDesc] = useState('');
  const [formDetails, setFormDetails] = useState('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formCategory, setFormCategory] = useState<CaixaMovimentacao['category']>('Hospedagem');
  const [formMethod, setFormMethod] = useState<CaixaMovimentacao['method']>('PIX');

  // Fechamento de Caixa state
  const [saldoConferidoGaveta, setSaldoConferidoGaveta] = useState<string>('1150.00');
  const [obsFechamento, setObsFechamento] = useState('');

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Calculations
  const saldoInicial = 350.00;
  
  const totalEntradas = useMemo(() => {
    return movimentacoes
      .filter(m => m.type === 'entrada')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [movimentacoes]);

  const totalSaidas = useMemo(() => {
    return movimentacoes
      .filter(m => m.type === 'saida')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [movimentacoes]);

  const saldoAtual = useMemo(() => {
    return totalEntradas - totalSaidas;
  }, [totalEntradas, totalSaidas]);

  const subtotalDinheiro = useMemo(() => {
    return movimentacoes
      .filter(m => m.method === 'Dinheiro')
      .reduce((acc, curr) => acc + (curr.type === 'entrada' ? curr.amount : -curr.amount), 0);
  }, [movimentacoes]);

  const subtotalPix = useMemo(() => {
    return movimentacoes
      .filter(m => m.method === 'PIX')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [movimentacoes]);

  const subtotalCartoes = useMemo(() => {
    return movimentacoes
      .filter(m => m.method === 'Crédito' || m.method === 'Débito')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [movimentacoes]);

  // Filtered List
  const filteredMovimentacoes = useMemo(() => {
    return movimentacoes.filter(m => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.description.toLowerCase().includes(q) ||
        (m.details && m.details.toLowerCase().includes(q)) ||
        m.category.toLowerCase().includes(q) ||
        m.method.toLowerCase().includes(q) ||
        m.operator.toLowerCase().includes(q);

      const matchesType = typeFilter === 'all' || m.type === typeFilter;
      const matchesMethod = methodFilter === 'all' || m.method.toLowerCase() === methodFilter.toLowerCase();

      return matchesSearch && matchesType && matchesMethod;
    });
  }, [movimentacoes, searchQuery, typeFilter, methodFilter]);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const loggedUserName = useMemo(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('hotelnozap_user_name') : '') || 'Recepção';
  }, []);

  useEffect(() => {
    const handleAtualizacao = () => {
      setMovimentacoes(caixaService.getMovimentacoes());
    };

    // Sincroniza reservas concluídas do banco com o caixa automaticamente ao abrir
    caixaService.sincronizarReservasConcluidasComCaixa().then(() => {
      handleAtualizacao();
    });

    const handleReservaModificada = (e: any) => {
      const reserva = e?.detail;
      if (reserva && reserva.status && reserva.status.toLowerCase().includes('concl')) {
        caixaService.registrarReservaConcluida(reserva);
      }
      handleAtualizacao();
    };

    window.addEventListener('hotel_caixa_atualizado', handleAtualizacao);
    window.addEventListener('hotel_reserva_modificada', handleReservaModificada);
    window.addEventListener('focus', handleAtualizacao);

    const handleStorage = (e: StorageEvent) => {
      if (e.key && (e.key.includes('caixa') || e.key.includes('reserva'))) {
        handleAtualizacao();
      }
    };
    window.addEventListener('storage', handleStorage);

    let bc: BroadcastChannel | null = null;
    let notifBc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('hotel_caixa_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'CAIXA_ATUALIZADO') {
          handleAtualizacao();
        }
      };
    } catch {}

    try {
      notifBc = new BroadcastChannel('hotel_notifications_channel');
      notifBc.onmessage = (event) => {
        if (event.data?.type === 'CHECKOUT_REALIZADO' || event.data?.type === 'NOVA_RESERVA_HOSPEDE') {
          caixaService.sincronizarReservasConcluidasComCaixa().then(() => {
            handleAtualizacao();
          });
        }
      };
    } catch {}

    return () => {
      window.removeEventListener('hotel_caixa_atualizado', handleAtualizacao);
      window.removeEventListener('hotel_reserva_modificada', handleReservaModificada);
      window.removeEventListener('focus', handleAtualizacao);
      window.removeEventListener('storage', handleStorage);
      if (bc) {
        try { bc.close(); } catch {}
      }
      if (notifBc) {
        try { notifBc.close(); } catch {}
      }
    };
  }, []);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, methodFilter]);

  const totalPages = Math.ceil(filteredMovimentacoes.length / itemsPerPage) || 1;
  const paginatedMovimentacoes = useMemo(() => {
    return filteredMovimentacoes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredMovimentacoes, currentPage, itemsPerPage]);

  const handleCreateEntrada = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDesc || !formAmount) return;

    const val = parseFloat(formAmount);
    if (isNaN(val) || val <= 0) return;

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');

    const newMov: CaixaMovimentacao = {
      id: String(Date.now()),
      time: `${hours}:${mins}`,
      date: 'Hoje',
      description: formDesc,
      details: formDetails || 'Lançamento manual de entrada',
      category: formCategory,
      categoryIcon: formCategory === 'Hospedagem' ? 'hotel' : formCategory === 'Frigobar' ? 'kitchen' : 'price_change',
      method: formMethod,
      methodIcon: formMethod === 'PIX' ? 'qr_code_2' : formMethod === 'Dinheiro' ? 'payments' : formMethod === 'Crédito' ? 'credit_score' : 'credit_card',
      operator: loggedUserName,
      type: 'entrada',
      amount: val,
    };

    const atualizadas = [newMov, ...movimentacoes];
    setMovimentacoes(atualizadas);
    caixaService.saveMovimentacoes(atualizadas);
    setIsEntradaModalOpen(false);
    showToast('Lançamento de Entrada registrado com sucesso!');
    resetForm();
  };

  const handleCreateSangria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDesc || !formAmount) return;

    const val = parseFloat(formAmount);
    if (isNaN(val) || val <= 0) return;

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');

    const newMov: CaixaMovimentacao = {
      id: String(Date.now()),
      time: `${hours}:${mins}`,
      date: 'Hoje',
      description: formDesc,
      details: formDetails || 'Sangria / Retirada de caixa autorizada',
      category: 'Sangria',
      categoryIcon: 'outbox',
      method: formMethod,
      methodIcon: formMethod === 'Dinheiro' ? 'payments' : 'credit_card',
      operator: loggedUserName,
      type: 'saida',
      amount: val,
    };

    const atualizadas = [newMov, ...movimentacoes];
    setMovimentacoes(atualizadas);
    caixaService.saveMovimentacoes(atualizadas);
    setIsSangriaModalOpen(false);
    showToast('Sangria registrada com sucesso!');
    resetForm();
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovForEdit) return;

    const val = parseFloat(formAmount);
    if (isNaN(val) || val <= 0) return;

    const atualizadas = movimentacoes.map(m => {
      if (m.id === selectedMovForEdit.id) {
        return {
          ...m,
          description: formDesc,
          details: formDetails,
          amount: val,
          category: formCategory,
          method: formMethod,
        };
      }
      return m;
    });

    setMovimentacoes(atualizadas);
    caixaService.saveMovimentacoes(atualizadas);
    setSelectedMovForEdit(null);
    showToast('Movimentação atualizada com sucesso!');
    resetForm();
  };

  const handleDelete = () => {
    if (!movToDelete) return;
    const atualizadas = movimentacoes.filter(m => m.id !== movToDelete.id);
    setMovimentacoes(atualizadas);
    caixaService.saveMovimentacoes(atualizadas);
    setMovToDelete(null);
    showToast('Lançamento excluído com sucesso!');
  };

  const handleCloseCaixaConfirm = () => {
    setIsFecharCaixaModalOpen(false);
    showToast('Caixa do turno encerrado e conciliação enviada!');
  };

  const openEdit = (m: CaixaMovimentacao) => {
    setSelectedMovForEdit(m);
    setFormDesc(m.description);
    setFormDetails(m.details || '');
    setFormAmount(String(m.amount));
    setFormCategory(m.category);
    setFormMethod(m.method);
  };

  const resetForm = () => {
    setFormDesc('');
    setFormDetails('');
    setFormAmount('');
    setFormCategory('Hospedagem');
    setFormMethod('PIX');
  };

  return (
    <div className="bg-[#f8f9ff] min-h-screen p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 pb-28 sm:pb-12">
      
      {/* TOAST SYSTEM STANDARD (VERDE CLARO COM FONTE PRETA E NEGRITO) */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#d1fae5] border border-emerald-300 text-black font-bold px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-[#003400] text-xl">check_circle</span>
          <span className="text-sm text-black font-bold">{toastMessage}</span>
        </div>
      )}

      {/* TOP BAR / NAVIGATION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* User Name in place of Voltar para Dashboard (Mobile) */}
        <div className="flex sm:hidden items-center gap-2 text-sm font-extrabold text-slate-800 bg-white/60 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200/60 self-start">
          <div className="w-6 h-6 rounded-full bg-[#003400]/10 flex items-center justify-center text-[#003400]">
            <span className="material-symbols-outlined text-sm">person</span>
          </div>
          <span>{loggedUserName}</span>
        </div>

        {/* Status do Caixa Badge */}
        <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 bg-white px-3.5 sm:px-4 py-2 rounded-xl border border-slate-200 shadow-xs w-full sm:w-auto">
          <div className="flex items-center gap-2 shrink-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
            </span>
            <span className="text-xs uppercase font-bold text-emerald-700 tracking-wider whitespace-nowrap">Caixa Aberto</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex flex-col text-xs text-slate-600 font-medium leading-tight">
            <span className="font-semibold text-slate-800">Turno Manhã</span>
            <span className="text-[11px] text-slate-500 font-normal">(07:00 - 15:00)</span>
          </div>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="text-xs font-semibold text-slate-800 hidden sm:inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
            <span className="material-symbols-outlined text-sm text-slate-400">person</span> {loggedUserName}
          </span>
        </div>
      </div>

      {/* TÍTULO E SUBTÍTULO */}
      <div className="flex flex-col gap-0.5">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Controle de Caixa
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Acompanhe a movimentação financeira em tempo real, suprimentos, sangrias e conciliação por turno.
        </p>
      </div>

      {/* CARDS DE INDICADORES (KPIS DESKTOP: GRID 4 COLUNAS / MOBILE: BENTO GRID 2X2) */}
      
      {/* DESKTOP KPIS (sm:flex ou sm:grid) */}
      <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo Inicial */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Saldo Inicial</span>
              <div className="mt-2 text-2xl font-bold text-slate-900">R$ {saldoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-xs">lock_clock</span> Fundo de Troco
            </span>
            <span className="font-semibold text-emerald-700">Conferido</span>
          </div>
        </div>

        {/* Total Entradas */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-emerald-700 tracking-wider">Total Entradas</span>
              <div className="mt-2 text-2xl font-bold text-emerald-700">R$ {totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
              <span className="material-symbols-outlined text-xl font-bold">trending_up</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{movimentacoes.filter(m => m.type === 'entrada').length} transações</span>
            <span className="font-medium text-emerald-700">+12.4% vs ontem</span>
          </div>
        </div>

        {/* Total Saídas / Sangrias */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-red-600 tracking-wider">Total Saídas / Sangrias</span>
              <div className="mt-2 text-2xl font-bold text-red-600">R$ {totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
              <span className="material-symbols-outlined text-xl font-bold">trending_down</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{movimentacoes.filter(m => m.type === 'saida').length} retiradas registradas</span>
            <span className="font-medium text-red-600">Sangria e Despesas</span>
          </div>
        </div>

        {/* Saldo em Caixa */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-[#003400] tracking-wider">Saldo em Caixa</span>
              <div className="mt-2 text-2xl font-bold text-slate-900">R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100/70 flex items-center justify-center text-[#003400]">
              <span className="material-symbols-outlined text-xl">payments</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Gaveta: <strong className="text-slate-900 font-bold">R$ {subtotalDinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</strong></span>
            <span>Digital: <strong className="text-slate-900 font-bold">R$ {(subtotalPix + subtotalCartoes).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</strong></span>
          </div>
        </div>
      </div>

      {/* MOBILE KPIS (BENTO GRID 2X2 1:1 COM O PROTÓTIPO MOBILE) */}
      <div className="grid grid-cols-2 gap-2.5 sm:hidden">
        {/* Saldo Inicial */}
        <div className="flex flex-col p-3 rounded-xl bg-[#EFF6FF] text-[#1E3A8A] shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold opacity-80">Saldo Inicial</span>
            <span className="material-symbols-outlined text-[18px]">account_balance</span>
          </div>
          <span className="text-sm font-extrabold tracking-tight whitespace-nowrap">R$ {saldoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Entradas */}
        <div className="flex flex-col p-3 rounded-xl bg-[#ECFDF5] text-[#065F46] shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold opacity-80">Entradas</span>
            <span className="material-symbols-outlined text-[18px]">trending_up</span>
          </div>
          <span className="text-sm font-extrabold tracking-tight whitespace-nowrap">R$ {totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Saídas */}
        <div className="flex flex-col p-3 rounded-xl bg-[#FEF2F2] text-[#991B1B] shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold opacity-80">Saídas</span>
            <span className="material-symbols-outlined text-[18px]">trending_down</span>
          </div>
          <span className="text-sm font-extrabold tracking-tight whitespace-nowrap">R$ {totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Saldo Atual */}
        <div className="flex flex-col p-3 rounded-xl bg-[#F3E8FF] text-[#581C87] shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold opacity-80">Saldo Atual</span>
            <span className="material-symbols-outlined text-[18px]">savings</span>
          </div>
          <span className="text-sm font-extrabold tracking-tight whitespace-nowrap">R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* GRID DE BOTÕES DE AÇÃO MOBILE (2X2 1:1 COM O PROTÓTIPO MOBILE) */}
      <div className="grid grid-cols-2 gap-2 sm:hidden w-full">
        {/* Entrada */}
        <button 
          type="button"
          onClick={() => { resetForm(); setIsEntradaModalOpen(true); }}
          className="flex items-center justify-center gap-1.5 h-12 px-2.5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white shadow-xs active:scale-[0.98] transition-all text-xs font-bold cursor-pointer whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[19px] shrink-0">add_circle</span>
          <span className="whitespace-nowrap">Entrada</span>
        </button>

        {/* Sangria */}
        <button 
          type="button"
          onClick={() => { resetForm(); setIsSangriaModalOpen(true); }}
          className="flex items-center justify-center gap-1.5 h-12 px-2.5 rounded-xl bg-[#FDB116] hover:bg-amber-500 text-[#2a1700] shadow-xs active:scale-[0.98] transition-all text-xs font-bold cursor-pointer whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[19px] shrink-0">remove_circle</span>
          <span className="whitespace-nowrap">Sangria</span>
        </button>

        {/* Fechar Caixa */}
        <button 
          type="button"
          onClick={() => setIsFecharCaixaModalOpen(true)}
          className="flex items-center justify-center gap-1.5 h-12 px-2.5 rounded-xl bg-[#0f172a] hover:bg-slate-800 text-white shadow-xs active:scale-[0.98] transition-all text-xs font-bold cursor-pointer whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[19px] shrink-0">lock</span>
          <span className="whitespace-nowrap">Fechar Caixa</span>
        </button>

        {/* Exportar / Relatório */}
        <button 
          type="button"
          onClick={() => showToast('Gerando relatório de fechamento do caixa...')}
          className="flex items-center justify-center gap-1.5 h-12 px-1.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white shadow-xs active:scale-[0.98] transition-all text-[11px] font-bold cursor-pointer whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[18px] shrink-0">ios_share</span>
          <span className="whitespace-nowrap tracking-tight">Exportar Relatório</span>
        </button>

        {/* Contas a Pagar */}
        <button 
          type="button"
          onClick={onNavigateToContasPagar ? onNavigateToContasPagar : () => showToast('Abrindo módulo de Contas a Pagar...')}
          className="flex items-center justify-center gap-1.5 h-12 px-2 rounded-xl bg-[#DC2626] hover:bg-red-700 text-white shadow-xs active:scale-[0.98] transition-all text-xs font-bold cursor-pointer whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[19px] shrink-0">receipt_long</span>
          <span className="whitespace-nowrap">Contas a Pagar</span>
        </button>

        {/* Contas a Receber */}
        <button 
          type="button"
          onClick={onNavigateToContasReceber ? onNavigateToContasReceber : () => showToast('Abrindo módulo de Contas a Receber...')}
          className="flex items-center justify-center gap-1.5 h-12 px-2 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white shadow-xs active:scale-[0.98] transition-all text-xs font-bold cursor-pointer whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[19px] shrink-0">price_check</span>
          <span className="whitespace-nowrap">Contas a Receber</span>
        </button>
      </div>

      {/* CONTAINER DESKTOP E ESTRUTURA DE TABELA/CARDS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
        
        {/* BARRA DE BOTÕES DE AÇÃO E FERRAMENTAS DESKTOP */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col gap-4 bg-white">
          
          {/* Linha 1: Botões Principais Desktop */}
          <div className="hidden sm:flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button 
                type="button"
                onClick={() => { resetForm(); setIsEntradaModalOpen(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                <span>Entrada</span>
              </button>

              <button 
                type="button"
                onClick={() => { resetForm(); setIsSangriaModalOpen(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#b87500] hover:bg-amber-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">remove_circle</span>
                <span>Sangria</span>
              </button>

              <button 
                type="button"
                onClick={() => setIsFecharCaixaModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0f172a] hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">lock</span>
                <span>Fechar Caixa</span>
              </button>

              <button 
                type="button"
                onClick={onNavigateToContasPagar ? onNavigateToContasPagar : () => showToast('Abrindo módulo de Contas a Pagar...')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#DC2626] hover:bg-red-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">receipt_long</span>
                <span>Contas a Pagar</span>
              </button>

              <button 
                type="button"
                onClick={onNavigateToContasReceber ? onNavigateToContasReceber : () => showToast('Abrindo módulo de Contas a Receber...')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">price_check</span>
                <span>Contas a Receber</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">print</span>
                <span>Imprimir</span>
              </button>

              <button 
                type="button"
                onClick={() => showToast('Exportando extrato de movimentações...')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">download</span>
                <span>Exportar</span>
              </button>
            </div>
          </div>

          {/* Linha 2: Busca e Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
            {/* Campo de Busca */}
            <div className="sm:col-span-6 relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-slate-400 text-lg pointer-events-none">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por descrição, hóspede, categoria ou comprovante..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400]"
              />
            </div>

            {/* Select Tipo */}
            <div className="sm:col-span-2 relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full appearance-none pl-3 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">Todos os Tipos</option>
                <option value="entrada">Apenas Entradas (+)</option>
                <option value="saida">Apenas Saídas (-)</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-slate-400 text-base pointer-events-none">expand_more</span>
            </div>

            {/* Select Método */}
            <div className="sm:col-span-2 relative">
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">Forma: Todas</option>
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="credito">Cartão Crédito</option>
                <option value="debito">Cartão Débito</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-slate-400 text-base pointer-events-none">expand_more</span>
            </div>

            {/* Select Período */}
            <div className="sm:col-span-2 relative">
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="turn_now">Turno Atual</option>
                <option value="day_full">Dia Completo</option>
                <option value="yesterday">Ontem</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-slate-400 text-base pointer-events-none">calendar_today</span>
            </div>
          </div>

        </div>

        {/* LISTA MOBILE DE CARDS VERTICAIS (sm:hidden) */}
        <div className="p-4 space-y-3 sm:hidden">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-xs font-bold text-slate-800">Movimentações do Turno</span>
            <span className="text-[11px] font-medium text-slate-400">{filteredMovimentacoes.length} registros</span>
          </div>

          {filteredMovimentacoes.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-400">
              Nenhuma movimentação encontrada para os filtros.
            </div>
          ) : (
            filteredMovimentacoes.map((m) => (
              <article key={m.id} className="flex flex-col gap-3 p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 flex items-center gap-0.5 font-medium">
                      <span className="material-symbols-outlined text-[15px]">schedule</span> {m.time}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                      {m.method}
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                    m.type === 'entrada' ? 'bg-[#ECFDF5] text-[#065F46] border border-emerald-200' : 'bg-[#FEF2F2] text-[#991B1B] border border-rose-200'
                  }`}>
                    <span className="material-symbols-outlined text-[14px]">
                      {m.type === 'entrada' ? 'arrow_downward' : 'arrow_upward'}
                    </span>
                    {m.type === 'entrada' ? 'Entrada' : 'Saída'}
                  </span>
                </div>

                <div className="flex flex-col">
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">{m.description}</h2>
                  {m.details && <span className="text-[11px] text-slate-400 mt-0.5">{m.details}</span>}
                  <span className={`text-lg font-black mt-1 ${m.type === 'entrada' ? 'text-[#10B981]' : 'text-red-600'}`}>
                    {m.type === 'entrada' ? '+' : '-'} R$ {m.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600 text-xs py-1.5 bg-slate-50 px-3 rounded-lg border border-slate-100">
                  <span className="flex items-center gap-1 font-medium truncate">
                    <span className="material-symbols-outlined text-[15px] text-slate-400">{m.categoryIcon}</span> {m.category}
                  </span>
                  <span className="flex items-center gap-1 font-medium truncate text-slate-400">
                    <span className="material-symbols-outlined text-[15px] text-slate-400">badge</span> Op: {m.operator}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => setSelectedMovForView(m)}
                    className="h-9 flex items-center justify-center gap-1 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span> Ver
                  </button>
                  <button
                    onClick={() => openEdit(m)}
                    className="h-9 flex items-center justify-center gap-1 rounded-xl bg-[#FDB116] hover:bg-amber-500 text-[#2a1700] text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span> Editar
                  </button>
                  <button
                    onClick={() => setMovToDelete(m)}
                    className="h-9 flex items-center justify-center gap-1 rounded-xl bg-[#DC2626] hover:bg-red-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span> Excluir
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        {/* TABELA DESKTOP (hidden em mobile) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Hora / Data</th>
                <th className="py-3.5 px-4">Descrição / Motivo</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Método</th>
                <th className="py-3.5 px-4">Operador</th>
                <th className="py-3.5 px-4 text-center">Tipo</th>
                <th className="py-3.5 px-4 text-right">Valor</th>
                <th className="py-3.5 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredMovimentacoes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-sm">
                    Nenhuma movimentação financeira encontrada.
                  </td>
                </tr>
              ) : (
                paginatedMovimentacoes.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-bold text-slate-900">{m.time}</span>
                      <span className="text-xs text-slate-400 block">{m.date}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{m.description}</span>
                        {m.details && <span className="text-xs text-slate-400">{m.details}</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        <span className="material-symbols-outlined text-xs text-slate-500">{m.categoryIcon}</span>
                        {m.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        <span className="material-symbols-outlined text-xs text-emerald-700 font-bold">{m.methodIcon}</span>
                        {m.method}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-xs font-medium">
                      {m.operator}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                        m.type === 'entrada' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {m.type === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className={`py-3.5 px-4 whitespace-nowrap text-right font-black ${
                      m.type === 'entrada' ? 'text-emerald-700' : 'text-red-600'
                    }`}>
                      {m.type === 'entrada' ? '+' : '-'} R$ {m.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-center">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedMovForView(m)}
                          className="px-2.5 py-1 rounded bg-[#2563EB] text-white hover:bg-blue-700 text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          className="px-2.5 py-1 rounded bg-[#FDB116] text-[#2a1700] hover:bg-amber-500 text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setMovToDelete(m)}
                          className="px-2.5 py-1 rounded bg-[#DC2626] text-white hover:bg-red-700 text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* RODAPÉ E SUMÁRIO DE CONCILIAÇÃO DA TABELA DESKTOP */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
            <span>Mostrando <strong className="text-slate-900 font-bold">1 a {filteredMovimentacoes.length}</strong> de {movimentacoes.length} lançamentos</span>
            <span className="text-slate-300">•</span>
            <span>Subtotal Dinheiro: <strong className="text-slate-900 font-bold">R$ {subtotalDinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
            <span className="text-slate-300">•</span>
            <span>PIX: <strong className="text-slate-900 font-bold">R$ {subtotalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
            <span className="text-slate-300">•</span>
            <span>Cartões: <strong className="text-slate-900 font-bold">R$ {subtotalCartoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
          </div>

          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              title="Página anterior"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                  currentPage === page
                    ? 'bg-[#003400] text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              title="Próxima página"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>

      </div>

      {/* MODAL 1: VER DETALHES DA MOVIMENTAÇÃO (PADRÃO SISTEMA: HEADER VERDE #003400 + FECHAR VERMELHO #b91c1c) */}
      {selectedMovForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header Verde Escuro #003400 */}
            <div className="bg-[#003400] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-xl">{selectedMovForView.categoryIcon}</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg">Detalhes da Movimentação</h3>
                  <span className="text-xs text-emerald-300 font-mono font-bold">ID #{selectedMovForView.id}</span>
                </div>
              </div>

              {/* Botão Fechar X no topo em Vermelho #b91c1c */}
              <button
                onClick={() => setSelectedMovForView(null)}
                className="bg-[#b91c1c] hover:bg-red-800 text-white p-1.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs sm:text-sm">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Descrição / Motivo</span>
                <p className="text-slate-900 font-bold text-base leading-snug">{selectedMovForView.description}</p>
                {selectedMovForView.details && <p className="text-xs text-slate-500 font-medium">{selectedMovForView.details}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Tipo de Registro</span>
                  <span className={`font-extrabold text-sm block mt-0.5 ${selectedMovForView.type === 'entrada' ? 'text-emerald-700' : 'text-red-600'}`}>
                    {selectedMovForView.type === 'entrada' ? 'Entrada (+)' : 'Saída (-)'}
                  </span>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Valor Total</span>
                  <span className={`font-extrabold text-base block mt-0.5 ${selectedMovForView.type === 'entrada' ? 'text-emerald-700' : 'text-red-600'}`}>
                    R$ {selectedMovForView.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Forma de Pagamento</span>
                  <span className="font-bold text-slate-800 text-xs block mt-0.5">{selectedMovForView.method}</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Operador Responsável</span>
                  <span className="font-bold text-slate-800 text-xs block mt-0.5">{selectedMovForView.operator}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-slate-500">
                <span>Horário do Registro:</span>
                <span className="font-bold text-slate-900">{selectedMovForView.time} (Hoje)</span>
              </div>
            </div>

            {/* Rodapé com Botão Fechar em Vermelho #b91c1c Alinhado à Direita */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedMovForView(null)}
                className="px-5 py-2 bg-[#b91c1c] hover:bg-red-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <span className="material-symbols-outlined text-base">close</span>
                <span>Fechar</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: LANÇAR ENTRADA / SANGRIA / EDITAR */}
      {(isEntradaModalOpen || isSangriaModalOpen || selectedMovForEdit) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white ${
                  isSangriaModalOpen ? 'bg-[#b87500]' : 'bg-[#10B981]'
                }`}>
                  <span className="material-symbols-outlined text-lg">
                    {isSangriaModalOpen ? 'remove_circle' : 'add_circle'}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  {selectedMovForEdit ? 'Editar Movimentação' : isSangriaModalOpen ? 'Registrar Sangria / Saída' : 'Registrar Entrada / Suprimento'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsEntradaModalOpen(false);
                  setIsSangriaModalOpen(false);
                  setSelectedMovForEdit(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={selectedMovForEdit ? handleEditSubmit : isSangriaModalOpen ? handleCreateSangria : handleCreateEntrada} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Descrição / Motivo *
                </label>
                <input
                  type="text"
                  required
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder={isSangriaModalOpen ? "Ex: Sangria para cofre, pagamento fornecedor..." : "Ex: Recebimento diária, suprimento de troco..."}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003400]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Detalhes / Observações
                </label>
                <input
                  type="text"
                  value={formDetails}
                  onChange={(e) => setFormDetails(e.target.value)}
                  placeholder="Ex: Nome do hóspede, número de recibo, protocolo..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003400]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003400]"
                  >
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="PIX">PIX</option>
                    <option value="Débito">Cartão Débito</option>
                    <option value="Crédito">Cartão Crédito</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Categoria
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003400]"
                >
                  <option value="Hospedagem">Hospedagem</option>
                  <option value="Frigobar">Frigobar</option>
                  <option value="Suprimento">Suprimento / Troco</option>
                  <option value="Sangria">Sangria</option>
                  <option value="Manutenção">Manutenção / Despesa</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEntradaModalOpen(false);
                    setIsSangriaModalOpen(false);
                    setSelectedMovForEdit(null);
                  }}
                  className="h-11 px-5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer inline-flex items-center justify-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`h-11 px-6 rounded-xl text-white text-xs font-bold shadow-xs transition-all cursor-pointer inline-flex items-center justify-center gap-2 border border-transparent ${
                    isSangriaModalOpen ? 'bg-[#b87500] hover:bg-amber-700' : 'bg-[#003400] hover:bg-emerald-950'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  <span>Salvar</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 3: FECHAR CAIXA */}
      {isFecharCaixaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-lg">lock</span>
                </div>
                <h3 className="font-bold text-base">Fechamento do Caixa do Turno</h3>
              </div>
              <button
                onClick={() => setIsFecharCaixaModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs sm:text-sm">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Resumo Esperado em Sistema</span>
                <div className="flex items-center justify-between font-medium">
                  <span>Dinheiro em Gaveta:</span>
                  <span className="font-bold text-slate-900">R$ {subtotalDinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between font-medium">
                  <span>Recebimentos Digitais (PIX + Cartões):</span>
                  <span className="font-bold text-slate-900">R$ {(subtotalPix + subtotalCartoes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-bold text-[#003400]">
                  <span>Total Esperado:</span>
                  <span>R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Valor Contado em Gaveta (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={saldoConferidoGaveta}
                  onChange={(e) => setSaldoConferidoGaveta(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Observações / Justificativas de Sobra ou Falta
                </label>
                <textarea
                  rows={3}
                  value={obsFechamento}
                  onChange={(e) => setObsFechamento(e.target.value)}
                  placeholder="Informe qualquer observação relevante do turno..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003400]"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFecharCaixaModalOpen(false)}
                  className="h-11 px-5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer inline-flex items-center justify-center"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCloseCaixaConfirm}
                  className="h-11 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">lock</span>
                  <span>Confirmar Fechamento</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 4: CONFIRMAR EXCLUSÃO */}
      {movToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Excluir Lançamento?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Deseja realmente excluir a movimentação <strong>{movToDelete.description}</strong>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setMovToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex-1"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ControleCaixa;
