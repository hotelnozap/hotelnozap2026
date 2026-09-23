import React, { useState, useMemo } from 'react';

export interface ContaReceber {
  id: string;
  code: string;
  description: string;
  customer: string;
  category: 'Hospedagem' | 'Frigobar' | 'Eventos' | 'Faturamento Empresa' | 'Serviços' | 'Outros';
  dueDate: string;
  amount: number;
  status: 'pendente' | 'vencida' | 'recebida';
  receivedDate?: string;
  receivedMethod?: string;
  reservationId?: string;
  notes?: string;
}

export interface ListagemContasReceberProps {
  onBack: () => void;
  onNavigateToCreate?: () => void;
  onNavigateToCategorias?: () => void;
}

const INITIAL_CONTAS_RECEBER: ContaReceber[] = [];

export const ListagemContasReceber: React.FC<ListagemContasReceberProps> = ({ onBack, onNavigateToCreate, onNavigateToCategorias }) => {
  const [contas, setContas] = useState<ContaReceber[]>(INITIAL_CONTAS_RECEBER);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todas' | 'pendente' | 'vencida' | 'recebida'>('todas');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [viewMode, setViewMode] = useState<'lista' | 'grade'>('lista');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Modals
  const [selectedContaForView, setSelectedContaForView] = useState<ContaReceber | null>(null);
  const [selectedContaForEdit, setSelectedContaForEdit] = useState<ContaReceber | null>(null);
  const [selectedContaForReceive, setSelectedContaForReceive] = useState<ContaReceber | null>(null);
  const [contaToDelete, setContaToDelete] = useState<ContaReceber | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCategoriasModalOpen, setIsCategoriasModalOpen] = useState(false);
  const [categoriesList, setCategoriesList] = useState<string[]>(['Hospedagem', 'Frigobar', 'Eventos', 'Faturamento Empresa', 'Serviços', 'Outros']);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Form entries
  const [formDescription, setFormDescription] = useState('');
  const [formCustomer, setFormCustomer] = useState('');
  const [formCategory, setFormCategory] = useState<ContaReceber['category']>('Hospedagem');
  const [formDueDate, setFormDueDate] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formReservationId, setFormReservationId] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Receive form entries
  const [receiveMethod, setReceiveMethod] = useState('PIX');
  const [receiveNotes, setReceiveNotes] = useState('');

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filtered List
  const filteredContas = useMemo(() => {
    return contas.filter((c) => {
      const matchSearch =
        c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.reservationId && c.reservationId.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchStatus = statusFilter === 'todas' || c.status === statusFilter;
      const matchCategory = categoryFilter === 'todas' || c.category === categoryFilter;

      return matchSearch && matchStatus && matchCategory;
    });
  }, [contas, searchTerm, statusFilter, categoryFilter]);

  // KPI Calculations
  const totalVencidas = useMemo(() => {
    return contas
      .filter((c) => c.status === 'vencida')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [contas]);

  const totalPendentes = useMemo(() => {
    return contas
      .filter((c) => c.status === 'pendente')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [contas]);

  const totalRecebidas = useMemo(() => {
    return contas
      .filter((c) => c.status === 'recebida')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [contas]);

  const totalGeral = useMemo(() => {
    return contas.reduce((acc, curr) => acc + curr.amount, 0);
  }, [contas]);

  const resetForm = () => {
    setFormDescription('');
    setFormCustomer('');
    setFormCategory('Hospedagem');
    setFormDueDate('');
    setFormAmount('');
    setFormReservationId('');
    setFormNotes('');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescription || !formCustomer || !formAmount || !formDueDate) return;

    const val = parseFloat(formAmount);
    if (isNaN(val) || val <= 0) return;

    const newConta: ContaReceber = {
      id: Date.now().toString(),
      code: `CR-2024-${String(contas.length + 1).padStart(3, '0')}`,
      description: formDescription,
      customer: formCustomer,
      category: formCategory,
      dueDate: formDueDate,
      amount: val,
      status: 'pendente',
      reservationId: formReservationId,
      notes: formNotes,
    };

    setContas([newConta, ...contas]);
    setIsCreateModalOpen(false);
    showToast('Conta a Receber cadastrada com sucesso!');
    resetForm();
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContaForEdit) return;

    const val = parseFloat(formAmount);
    if (isNaN(val) || val <= 0) return;

    setContas(contas.map((c) => {
      if (c.id === selectedContaForEdit.id) {
        return {
          ...c,
          description: formDescription,
          customer: formCustomer,
          category: formCategory,
          dueDate: formDueDate,
          amount: val,
          reservationId: formReservationId,
          notes: formNotes,
        };
      }
      return c;
    }));

    setSelectedContaForEdit(null);
    showToast('Conta a Receber atualizada com sucesso!');
    resetForm();
  };

  const handleReceiveConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContaForReceive) return;

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    setContas(contas.map((c) => {
      if (c.id === selectedContaForReceive.id) {
        return {
          ...c,
          status: 'recebida',
          receivedDate: formattedDate,
          receivedMethod: receiveMethod,
          notes: receiveNotes ? `${c.notes ? c.notes + ' | ' : ''}Recebimento: ${receiveNotes}` : c.notes,
        };
      }
      return c;
    }));

    setSelectedContaForReceive(null);
    showToast(`Recebimento do título ${selectedContaForReceive.code} registrado com sucesso!`);
    setReceiveMethod('PIX');
    setReceiveNotes('');
  };

  const handleDelete = () => {
    if (!contaToDelete) return;
    setContas(contas.filter((c) => c.id !== contaToDelete.id));
    showToast(`Título ${contaToDelete.code} excluído com sucesso!`);
    setContaToDelete(null);
  };

  const openEdit = (c: ContaReceber) => {
    setSelectedContaForEdit(c);
    setFormDescription(c.description);
    setFormCustomer(c.customer);
    setFormCategory(c.category);
    setFormDueDate(c.dueDate);
    setFormAmount(String(c.amount));
    setFormReservationId(c.reservationId || '');
    setFormNotes(c.notes || '');
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
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          type="button"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#003400] hover:text-emerald-950 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Voltar para Controle de Caixa</span>
        </button>
      </div>

      {/* TÍTULO E SUBTÍTULO */}
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Contas a Receber
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Acompanhe títulos a receber de hóspedes, consumo faturado, eventos e empresas parceiras.
          </p>
        </div>

        {/* Botoeira de Ações Mobile/Desktop */}
        <div className="mt-3 sm:mt-0 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onNavigateToCategorias ? onNavigateToCategorias : () => setIsCategoriasModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">category</span>
            <span>Categorias</span>
          </button>

          <button
            type="button"
            onClick={onNavigateToCreate ? onNavigateToCreate : () => { resetForm(); setIsCreateModalOpen(true); }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#003400] hover:bg-emerald-950 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span>Nova Conta a Receber</span>
          </button>
        </div>
      </div>

      {/* CARDS DE INDICADORES (KPIS 4 PASTÉIS SUAVES) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Vencidas / Em Atraso */}
        <div className="bg-rose-50/80 rounded-xl p-3.5 sm:p-5 border border-rose-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <div>
              <span className="text-[10px] sm:text-xs uppercase font-bold text-rose-700 tracking-wider">Em Atraso</span>
              <div className="mt-1 text-sm sm:text-xl lg:text-2xl font-extrabold text-rose-700 whitespace-nowrap tracking-tight">
                R$ {totalVencidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
              <span className="material-symbols-outlined text-base sm:text-xl">priority_high</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-rose-200/50 flex flex-wrap items-center justify-between text-[10px] sm:text-xs text-rose-600 font-medium gap-1">
            <span>{contas.filter(c => c.status === 'vencida').length} título(s)</span>
            <span className="font-bold">Cobrar hóspede</span>
          </div>
        </div>

        {/* A Receber / Pendentes */}
        <div className="bg-amber-50/80 rounded-xl p-3.5 sm:p-5 border border-amber-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <div>
              <span className="text-[10px] sm:text-xs uppercase font-bold text-amber-800 tracking-wider">A Receber</span>
              <div className="mt-1 text-sm sm:text-xl lg:text-2xl font-extrabold text-amber-900 whitespace-nowrap tracking-tight">
                R$ {totalPendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
              <span className="material-symbols-outlined text-base sm:text-xl">hourglass_empty</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-amber-200/50 flex flex-wrap items-center justify-between text-[10px] sm:text-xs text-amber-700 font-medium gap-1">
            <span>{contas.filter(c => c.status === 'pendente').length} título(s)</span>
            <span>Previsão</span>
          </div>
        </div>

        {/* Recebidas no Mês */}
        <div className="bg-emerald-50/80 rounded-xl p-3.5 sm:p-5 border border-emerald-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <div>
              <span className="text-[10px] sm:text-xs uppercase font-bold text-emerald-800 tracking-wider">Recebidas (Mês)</span>
              <div className="mt-1 text-sm sm:text-xl lg:text-2xl font-extrabold text-emerald-800 whitespace-nowrap tracking-tight">
                R$ {totalRecebidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <span className="material-symbols-outlined text-base sm:text-xl font-bold">price_check</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-emerald-200/50 flex flex-wrap items-center justify-between text-[10px] sm:text-xs text-emerald-700 font-medium gap-1">
            <span>{contas.filter(c => c.status === 'recebida').length} quitadas</span>
            <span className="font-bold">Em caixa</span>
          </div>
        </div>

        {/* Total Recebíveis */}
        <div className="bg-indigo-50/80 rounded-xl p-3.5 sm:p-5 border border-indigo-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <div>
              <span className="text-[10px] sm:text-xs uppercase font-bold text-indigo-800 tracking-wider">Total Recebíveis</span>
              <div className="mt-1 text-sm sm:text-xl lg:text-2xl font-extrabold text-indigo-950 whitespace-nowrap tracking-tight">
                R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
              <span className="material-symbols-outlined text-base sm:text-xl">savings</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-indigo-200/50 flex flex-wrap items-center justify-between text-[10px] sm:text-xs text-indigo-700 font-medium gap-1">
            <span>{contas.length} títulos</span>
            <span>Consolidado</span>
          </div>
        </div>
      </div>

      {/* CONTAINER PRINCIPAL E FERRAMENTAS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
        
        {/* BARRA DE FILTROS E PESQUISA */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white">
          
          {/* Busca por Texto */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por hóspede, empresa, descrição ou reserva..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] transition-all bg-slate-50/50"
            />
          </div>

          {/* Filtros Desktop */}
          <div className="hidden md:flex items-center gap-2.5">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-700 font-medium bg-slate-50/50 focus:outline-none focus:border-[#003400] cursor-pointer"
            >
              <option value="todas">Todos os Status</option>
              <option value="pendente">Pendentes (A Receber)</option>
              <option value="vencida">Vencidas (Em Atraso)</option>
              <option value="recebida">Recebidas</option>
            </select>

            {/* Categoria Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-700 font-medium bg-slate-50/50 focus:outline-none focus:border-[#003400] cursor-pointer"
            >
              <option value="todas">Todas as Origens</option>
              <option value="Hospedagem">Hospedagem</option>
              <option value="Frigobar">Frigobar</option>
              <option value="Eventos">Eventos</option>
              <option value="Faturamento Empresa">Faturamento Empresa</option>
              <option value="Serviços">Serviços</option>
            </select>

            {/* Toggle View Mode */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('lista')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'lista' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Modo Tabela"
              >
                <span className="material-symbols-outlined text-lg">format_list_bulleted</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grade')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grade' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Modo Cards"
              >
                <span className="material-symbols-outlined text-lg">grid_view</span>
              </button>
            </div>
          </div>

          {/* Botão Filtros Mobile */}
          <button
            type="button"
            onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
            className="md:hidden flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-bold cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">filter_list</span>
            <span>Filtros {statusFilter !== 'todas' || categoryFilter !== 'todas' ? '(Ativos)' : ''}</span>
          </button>
        </div>

        {/* GAVETA DE FILTROS EXPANSÍVEL MOBILE */}
        {isMobileFiltersOpen && (
          <div className="md:hidden p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-3 animate-in fade-in">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Status do Recebível</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white"
              >
                <option value="todas">Todos os Status</option>
                <option value="pendente">Pendentes (A Receber)</option>
                <option value="vencida">Vencidas (Em Atraso)</option>
                <option value="recebida">Recebidas</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Origem / Categoria</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white"
              >
                <option value="todas">Todas as Origens</option>
                <option value="Hospedagem">Hospedagem</option>
                <option value="Frigobar">Frigobar</option>
                <option value="Eventos">Eventos</option>
                <option value="Faturamento Empresa">Faturamento Empresa</option>
                <option value="Serviços">Serviços</option>
              </select>
            </div>
          </div>
        )}

        {/* VISUALIZAÇÃO DESKTOP: TABELA */}
        {viewMode === 'lista' ? (
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200 tracking-wider">
                  <th className="py-3.5 px-4">Código</th>
                  <th className="py-3.5 px-4">Hóspede / Descrição</th>
                  <th className="py-3.5 px-4">Origem</th>
                  <th className="py-3.5 px-4">Vencimento</th>
                  <th className="py-3.5 px-4">Valor</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredContas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Nenhuma conta a receber encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredContas.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {c.code}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{c.customer}</div>
                        <div className="text-xs text-slate-500">{c.description}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {c.category}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {new Date(c.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-900">
                        R$ {c.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4">
                        {c.status === 'vencida' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span> Em Atraso
                          </span>
                        )}
                        {c.status === 'pendente' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span> Pendente
                          </span>
                        )}
                        {c.status === 'recebida' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Recebida
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {c.status !== 'recebida' && (
                            <button
                              type="button"
                              onClick={() => setSelectedContaForReceive(c)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                              title="Dar Baixa / Receber"
                            >
                              <span className="material-symbols-outlined text-sm">price_check</span>
                              <span>Receber</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedContaForView(c)}
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
                            title="Ver Detalhes"
                          >
                            <span className="material-symbols-outlined text-base">visibility</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(c)}
                            className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setContaToDelete(c)}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* VISUALIZAÇÃO DESKTOP: CARDS / GRADE */
          <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filteredContas.map((c) => (
              <div key={c.id} className="bg-slate-50/50 rounded-xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-500">{c.code}</span>
                    <h3 className="font-bold text-slate-900 text-sm mt-0.5">{c.customer}</h3>
                    <p className="text-xs text-slate-500">{c.description}</p>
                  </div>
                  {c.status === 'vencida' && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">Em Atraso</span>}
                  {c.status === 'pendente' && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">Pendente</span>}
                  {c.status === 'recebida' && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">Recebida</span>}
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Vencimento</span>
                    <span className="font-semibold text-slate-700">{new Date(c.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Valor</span>
                    <span className="font-extrabold text-slate-900 text-sm">R$ {c.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                  {c.status !== 'recebida' && (
                    <button
                      type="button"
                      onClick={() => setSelectedContaForReceive(c)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">price_check</span>
                      <span>Receber</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedContaForView(c)}
                    className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">visibility</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setContaToDelete(c)}
                    className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VISUALIZAÇÃO MOBILE: CARDS VERTICAIS */}
        <div className="sm:hidden divide-y divide-slate-100">
          {filteredContas.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Nenhuma conta a receber encontrada.
            </div>
          ) : (
            filteredContas.map((c) => (
              <div key={c.id} className="p-4 flex flex-col gap-3 bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-slate-400">{c.code}</span>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{c.category}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm mt-1 leading-snug">{c.customer}</h3>
                    <p className="text-xs text-slate-500">{c.description}</p>
                  </div>
                  <div>
                    {c.status === 'vencida' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">Em Atraso</span>}
                    {c.status === 'pendente' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">Pendente</span>}
                    {c.status === 'recebida' && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Recebida</span>}
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Vencimento</span>
                    <span className="font-bold text-slate-800">{new Date(c.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Valor</span>
                    <span className="font-extrabold text-slate-900 text-base">R$ {c.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  {c.status !== 'recebida' && (
                    <button
                      type="button"
                      onClick={() => setSelectedContaForReceive(c)}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs active:scale-[0.98] cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">price_check</span>
                      <span>Dar Baixa</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedContaForView(c)}
                    className="p-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-xs cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-base">visibility</span>
                    <span>Ver</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="p-2 rounded-xl bg-amber-50 text-amber-600 font-bold text-xs cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setContaToDelete(c)}
                    className="p-2 rounded-xl bg-rose-50 text-rose-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* RODAPÉ DA TABELA */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Mostrando <strong>{filteredContas.length}</strong> de <strong>{contas.length}</strong> títulos</span>
          <span>Contas a Receber</span>
        </div>
      </div>

      {/* MODAL VER DETALHES (PADRÃO 1:1 DESIGN.MD - HEADER #003400 + BOTÃO FECHAR #B91C1C) */}
      {selectedContaForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
            
            {/* Header Padronizado (#003400) */}
            <div className="bg-[#003400] text-[#25D366] text-white px-5 py-4 flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#25D366] text-2xl">savings</span>
                <div>
                  <h3 className="font-bold text-base text-white leading-tight">Detalhes do Recebível</h3>
                  <span className="font-mono text-xs text-emerald-300">{selectedContaForView.code}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedContaForView(null)}
                className="bg-[#b91c1c] text-white hover:bg-red-800 p-1.5 rounded-xl shrink-0 flex items-center justify-center cursor-pointer shadow-xs active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700">
              {/* Card Hero */}
              <div className="bg-gradient-to-r from-emerald-50/80 via-slate-50 to-indigo-50/50 border border-emerald-100 rounded-xl p-4 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white text-emerald-700 border border-emerald-200 shadow-2xs flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">price_check</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{selectedContaForView.category}</span>
                  <h4 className="font-extrabold text-slate-900 text-base sm:text-lg leading-snug">{selectedContaForView.customer}</h4>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5">{selectedContaForView.description}</p>
                </div>
              </div>

              {/* Grid Metricas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Valor a Receber</span>
                  <span className="text-lg font-extrabold text-slate-900">R$ {selectedContaForView.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Vencimento</span>
                  <span className="text-sm font-extrabold text-slate-800">{new Date(selectedContaForView.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              {/* Status & Pagamento */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Status Atual:</span>
                  {selectedContaForView.status === 'vencida' && <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">Em Atraso</span>}
                  {selectedContaForView.status === 'pendente' && <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Pendente</span>}
                  {selectedContaForView.status === 'recebida' && <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Recebida</span>}
                </div>

                {selectedContaForView.receivedDate && (
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Data de Recebimento:</span>
                    <span className="font-bold text-slate-900">{new Date(selectedContaForView.receivedDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                  </div>
                )}

                {selectedContaForView.receivedMethod && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Forma de Recebimento:</span>
                    <span className="font-bold text-slate-900">{selectedContaForView.receivedMethod}</span>
                  </div>
                )}

                {selectedContaForView.reservationId && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Reserva Vinculada:</span>
                    <span className="font-bold text-[#003400] font-mono">{selectedContaForView.reservationId}</span>
                  </div>
                )}
              </div>

              {/* Observações */}
              {selectedContaForView.notes && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Observações</span>
                  <p className="text-xs text-slate-700 font-medium">{selectedContaForView.notes}</p>
                </div>
              )}
            </div>

            {/* Footer com Fechar Vermelho (#b91c1c) */}
            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const c = selectedContaForView;
                  setSelectedContaForView(null);
                  openEdit(c);
                }}
                className="bg-[#EA580C] hover:bg-orange-700 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                <span>Editar</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedContaForView(null)}
                className="bg-[#b91c1c] hover:bg-red-800 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
                <span>Fechar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVA CONTA / EDITAR CONTA A RECEBER */}
      {(isCreateModalOpen || selectedContaForEdit) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
            
            {/* Header */}
            <div className="bg-[#003400] text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#25D366] text-2xl">
                  {selectedContaForEdit ? 'edit_note' : 'add_card'}
                </span>
                <h3 className="font-bold text-base text-white">
                  {selectedContaForEdit ? 'Editar Conta a Receber' : 'Cadastrar Nova Conta a Receber'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setIsCreateModalOpen(false); setSelectedContaForEdit(null); resetForm(); }}
                className="bg-[#b91c1c] text-white hover:bg-red-800 p-1.5 rounded-xl flex items-center justify-center cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={selectedContaForEdit ? handleEditSubmit : handleCreateSubmit} className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hóspede / Cliente / Empresa *</label>
                <input
                  type="text"
                  required
                  value={formCustomer}
                  onChange={(e) => setFormCustomer(e.target.value)}
                  placeholder="Ex: Roberto Silveira ou TechCorp LTDA"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-[#003400] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descrição do Recebível *</label>
                <input
                  type="text"
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ex: Hospedagem Suíte Deluxe (Reserva #HK-8891)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-[#003400] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Origem / Categoria *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-[#003400] focus:outline-none bg-white cursor-pointer"
                  >
                    <option value="Hospedagem">Hospedagem</option>
                    <option value="Frigobar">Frigobar</option>
                    <option value="Eventos">Eventos</option>
                    <option value="Faturamento Empresa">Faturamento Empresa</option>
                    <option value="Serviços">Serviços</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Código da Reserva (Opcional)</label>
                  <input
                    type="text"
                    value={formReservationId}
                    onChange={(e) => setFormReservationId(e.target.value)}
                    placeholder="Ex: HK-8891"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-[#003400] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Data de Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-[#003400] focus:outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Valor a Receber (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-[#003400] focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Observações / Detalhes</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Informações sobre prazo, parcelamento ou termo de acerto..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-[#003400] focus:outline-none"
                />
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setIsCreateModalOpen(false); setSelectedContaForEdit(null); resetForm(); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#003400] hover:bg-emerald-950 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>Salvar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DAR BAIXA / CONFIRMAR RECEBIMENTO */}
      {selectedContaForReceive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
            
            <div className="bg-emerald-700 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-emerald-300 text-2xl">price_check</span>
                <div>
                  <h3 className="font-bold text-base text-white">Confirmar Recebimento</h3>
                  <span className="font-mono text-xs text-emerald-200">{selectedContaForReceive.code}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedContaForReceive(null)}
                className="bg-[#b91c1c] text-white hover:bg-red-800 p-1.5 rounded-xl flex items-center justify-center cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleReceiveConfirm} className="p-5 space-y-4 text-xs sm:text-sm">
              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-800 block">Total Recebido</span>
                  <span className="text-lg font-extrabold text-emerald-900">
                    R$ {selectedContaForReceive.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <span className="font-semibold text-slate-700 text-xs text-right max-w-[150px] truncate">
                  {selectedContaForReceive.customer}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Forma de Recebimento *</label>
                <select
                  value={receiveMethod}
                  onChange={(e) => setReceiveMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-emerald-600 focus:outline-none bg-white cursor-pointer"
                >
                  <option value="PIX">PIX</option>
                  <option value="Dinheiro">Dinheiro (Caixa)</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Transferência Bancária">Transferência Bancária</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Comprovante / Observações do Recebimento</label>
                <textarea
                  rows={2}
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="NSU maquininha, comprovante PIX ou observação..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedContaForReceive(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">check</span>
                  <span>Confirmar Recebimento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR CONTA */}
      {contaToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <h3 className="font-extrabold text-lg text-slate-900">Excluir Conta a Receber</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              Tem certeza que deseja excluir o título <strong className="text-slate-900">{contaToDelete.code}</strong> ({contaToDelete.customer})? Esta ação não pode ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setContaToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-base">delete</span>
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GESTÃO DE CATEGORIAS DE CONTAS A RECEBER */}
      {isCategoriasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-[#003400] text-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-800 text-emerald-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">category</span>
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Categorias de Recebíveis</h3>
                  <p className="text-xs text-emerald-200">Gerencie as categorias de contas a receber</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCategoriasModalOpen(false)}
                className="text-emerald-200 hover:text-white p-1.5 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Adicionar Nova Categoria
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    placeholder="Ex: Passeios, Transfer..."
                    className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      if (newCategoryInput.trim()) {
                        const val = newCategoryInput.trim();
                        if (!categoriesList.includes(val)) {
                          setCategoriesList([...categoriesList, val]);
                        }
                        setNewCategoryInput('');
                      }
                    }}
                    className="px-4 py-2 bg-[#003400] hover:bg-emerald-950 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    <span>Adicionar</span>
                  </button>
                </div>
              </div>

              {/* Lista de Categorias Atuais */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Categorias Cadastradas ({categoriesList.length})
                </label>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                  {categoriesList.map((cat) => (
                    <div key={cat} className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-900">
                      <span>{cat}</span>
                      {categoriesList.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => setCategoriesList(categoriesList.filter(c => c !== cat))}
                          className="text-emerald-500 hover:text-emerald-800 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setIsCategoriasModalOpen(false)}
                className="px-4 py-2 bg-[#b91c1c] hover:bg-red-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-base">close</span>
                <span>Fechar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListagemContasReceber;
