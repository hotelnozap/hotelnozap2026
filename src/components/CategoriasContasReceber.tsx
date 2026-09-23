import React, { useState, useMemo } from 'react';

export interface CategoriaContaReceberItem {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  colorBg: string;
  colorText: string;
  linkedCount: number;
  totalAmount: number;
  status: 'ativa' | 'inativa';
}

export interface CategoriasContasReceberProps {
  onBack: () => void;
  onNavigateToNovaCategoria?: () => void;
}

const INITIAL_CATEGORIAS_RECEBIVEIS: CategoriaContaReceberItem[] = [];

export const CategoriasContasReceber: React.FC<CategoriasContasReceberProps> = ({
  onBack,
  onNavigateToNovaCategoria,
}) => {
  const [categories, setCategories] = useState<CategoriaContaReceberItem[]>(INITIAL_CATEGORIAS_RECEBIVEIS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todas' | 'ativa' | 'inativa'>('todas');
  const [viewMode, setViewMode] = useState<'lista' | 'grade'>('lista');

  // Modals
  const [selectedCatForView, setSelectedCatForView] = useState<CategoriaContaReceberItem | null>(null);
  const [selectedCatForEdit, setSelectedCatForEdit] = useState<CategoriaContaReceberItem | null>(null);
  const [catToDelete, setCatToDelete] = useState<CategoriaContaReceberItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formIcon, setFormIcon] = useState('category');
  const [formStatus, setFormStatus] = useState<'ativa' | 'inativa'>('ativa');

  // Drag & Drop reordering state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const matchesSearch =
        cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.code.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'todas' ? true : cat.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [categories, searchTerm, statusFilter]);

  // Calculations KPIs
  const totalCategorias = categories.length;
  const ativasCount = categories.filter((c) => c.status === 'ativa').length;
  const totalRecebiveisGlobal = useMemo(() => {
    return categories.reduce((acc, curr) => acc + curr.totalAmount, 0);
  }, [categories]);
  const semLancamentosCount = categories.filter((c) => c.linkedCount === 0).length;

  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormIcon('category');
    setFormStatus('ativa');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const newId = String(Date.now());
    const nextCode = `CAT-${String(categories.length + 1).padStart(2, '0')}`;

    const newCat: CategoriaContaReceberItem = {
      id: newId,
      code: nextCode,
      name: formName.trim(),
      description: formDesc.trim() || 'Descrição da nova categoria de recebíveis.',
      icon: formIcon || 'category',
      colorBg: 'bg-emerald-100',
      colorText: 'text-[#003400]',
      linkedCount: 0,
      totalAmount: 0,
      status: formStatus,
    };

    setCategories([newCat, ...categories]);
    setIsCreateModalOpen(false);
    resetForm();
    showToast(`Categoria "${newCat.name}" criada com sucesso!`);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatForEdit || !formName.trim()) return;

    setCategories(
      categories.map((c) => {
        if (c.id === selectedCatForEdit.id) {
          return {
            ...c,
            name: formName.trim(),
            description: formDesc.trim(),
            icon: formIcon,
            status: formStatus,
          };
        }
        return c;
      })
    );

    setSelectedCatForEdit(null);
    resetForm();
    showToast(`Categoria "${formName}" atualizada com sucesso!`);
  };

  const handleDelete = () => {
    if (!catToDelete) return;
    setCategories(categories.filter((c) => c.id !== catToDelete.id));
    showToast(`Categoria "${catToDelete.name}" excluída com sucesso!`);
    setCatToDelete(null);
  };

  const openEdit = (cat: CategoriaContaReceberItem) => {
    setSelectedCatForEdit(cat);
    setFormName(cat.name);
    setFormDesc(cat.description);
    setFormIcon(cat.icon);
    setFormStatus(cat.status);
  };

  // Drag & drop logic
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newCategories = [...categories];
    const [movedItem] = newCategories.splice(draggedIndex, 1);
    newCategories.splice(targetIndex, 0, movedItem);

    setCategories(newCategories);
    setDraggedIndex(null);
    showToast('Ordem das categorias atualizada com sucesso!');
  };

  return (
    <div className="bg-[#f8f9fc] min-h-screen p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 pb-28 sm:pb-12 text-slate-800 font-sans antialiased">
      
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
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#003400] hover:text-emerald-950 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Voltar para Contas a Receber</span>
        </button>
      </div>

      {/* TÍTULO E SUBTÍTULO */}
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Categorias de Contas a Receber
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Gerencie as categorias de receitas, faturamento, consumo de hóspedes e serviços extras.
          </p>
        </div>

        {/* Botoeira de Ações Superior */}
        <div className="mt-3 sm:mt-0 flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto shrink-0">
          {/* Botões Importar e Exportar */}
          <div className="flex items-center gap-2 w-full sm:w-auto order-2 sm:order-1 shrink-0">
            <button
              type="button"
              onClick={() => showToast('Importando planilha de categorias...')}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-lg">upload</span>
              <span>Importar</span>
            </button>

            <button
              type="button"
              onClick={() => showToast('Exportando categorias em CSV/Excel...')}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#FDB116] hover:bg-amber-500 text-slate-900 text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              <span>Exportar</span>
            </button>
          </div>

          {/* Botão Nova Categoria */}
          <button
            type="button"
            onClick={onNavigateToNovaCategoria ? onNavigateToNovaCategoria : () => { resetForm(); setIsCreateModalOpen(true); }}
            className="w-full sm:w-auto order-1 sm:order-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#003400] hover:bg-emerald-950 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span>Nova Categoria</span>
          </button>
        </div>
      </div>

      {/* CARDS DE INDICADORES (KPIS 4 PASTÉIS SUAVES) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Categorias */}
        <div className="bg-blue-50/80 rounded-xl p-3.5 sm:p-5 border border-blue-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <div>
              <span className="text-[10px] sm:text-xs uppercase font-bold text-blue-700 tracking-wider">Total Categorias</span>
              <div className="mt-1 text-base sm:text-2xl font-extrabold text-blue-900 tracking-tight">
                {totalCategorias}
              </div>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
              <span className="material-symbols-outlined text-base sm:text-xl">category</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-blue-200/50 flex items-center justify-between text-[10px] sm:text-xs text-blue-600 font-medium">
            <span>Cadastradas</span>
            <span className="font-bold">100% ativas</span>
          </div>
        </div>

        {/* Categorias Ativas */}
        <div className="bg-emerald-50/80 rounded-xl p-3.5 sm:p-5 border border-emerald-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <div>
              <span className="text-[10px] sm:text-xs uppercase font-bold text-emerald-700 tracking-wider">Categorias Ativas</span>
              <div className="mt-1 text-base sm:text-2xl font-extrabold text-emerald-900 tracking-tight">
                {ativasCount}
              </div>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <span className="material-symbols-outlined text-base sm:text-xl">check_circle</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-emerald-200/50 flex items-center justify-between text-[10px] sm:text-xs text-emerald-600 font-medium">
            <span>Em uso</span>
            <span className="font-bold">{((ativasCount / (totalCategorias || 1)) * 100).toFixed(0)}% do total</span>
          </div>
        </div>

        {/* Total em Recebíveis */}
        <div className="bg-indigo-50/80 rounded-xl p-3.5 sm:p-5 border border-indigo-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <div>
              <span className="text-[10px] sm:text-xs uppercase font-bold text-indigo-700 tracking-wider">Total em Recebíveis</span>
              <div className="mt-1 text-sm sm:text-xl font-extrabold text-indigo-900 whitespace-nowrap tracking-tight">
                R$ {totalRecebiveisGlobal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
              <span className="material-symbols-outlined text-base sm:text-xl">price_check</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-indigo-200/50 flex items-center justify-between text-[10px] sm:text-xs text-indigo-600 font-medium">
            <span>Acumulado</span>
            <span className="font-bold">Contas a Receber</span>
          </div>
        </div>

        {/* Sem Lançamentos */}
        <div className="bg-amber-50/80 rounded-xl p-3.5 sm:p-5 border border-amber-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <div>
              <span className="text-[10px] sm:text-xs uppercase font-bold text-amber-700 tracking-wider">Sem Lançamentos</span>
              <div className="mt-1 text-base sm:text-2xl font-extrabold text-amber-900 tracking-tight">
                {semLancamentosCount}
              </div>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <span className="material-symbols-outlined text-base sm:text-xl">inbox</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-amber-200/50 flex items-center justify-between text-[10px] sm:text-xs text-amber-600 font-medium">
            <span>Sem contas</span>
            <span className="font-bold">Inativas/Vazias</span>
          </div>
        </div>
      </div>

      {/* CONTAINER DE TABELA E FILTROS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
        
        {/* BARRA DE FERRAMENTAS & FILTROS */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white">
          
          {/* Busca por Texto */}
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-lg">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar categorias por nome, código ou descrição..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-xs sm:text-sm bg-slate-50/50 focus:bg-white transition-all"
            />
          </div>

          {/* Filtro por Status & Toggle Lista/Grade */}
          <div className="flex items-center gap-2 justify-between sm:justify-end">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003400]"
            >
              <option value="todas">Todos os Status</option>
              <option value="ativa">Ativas</option>
              <option value="inativa">Inativas</option>
            </select>

            {/* Alternador Lista / Grade (Desktop) */}
            <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('lista')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'lista' ? 'bg-white shadow-2xs text-[#003400]' : 'text-slate-500 hover:text-slate-800'}`}
                title="Visualização em Lista (Tabela)"
              >
                <span className="material-symbols-outlined text-lg block">format_list_bulleted</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grade')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'grade' ? 'bg-white shadow-2xs text-[#003400]' : 'text-slate-500 hover:text-slate-800'}`}
                title="Visualização em Grade (Cards)"
              >
                <span className="material-symbols-outlined text-lg block">grid_view</span>
              </button>
            </div>
          </div>
        </div>

        {/* VISUALIZAÇÃO DESKTOP: MODO TABELA LISTA */}
        {viewMode === 'lista' ? (
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-3 text-center w-10"></th>
                  <th className="py-3 px-4">Código / Categoria</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4 text-center">Contas Vinculadas</th>
                  <th className="py-3 px-4 text-right">Total em Recebíveis</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm font-medium text-slate-700">
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      Nenhuma categoria encontrada para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((cat, idx) => (
                    <tr
                      key={cat.id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(idx)}
                      className={`hover:bg-slate-50/80 transition-colors ${draggedIndex === idx ? 'opacity-40 border-dashed border-2 border-emerald-500' : ''}`}
                    >
                      {/* Alça de Arraste (Drag Handle) */}
                      <td className="py-3 px-3 text-center text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing">
                        <span className="material-symbols-outlined text-base">drag_indicator</span>
                      </td>

                      {/* Nome & Ícone */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl ${cat.colorBg} ${cat.colorText} flex items-center justify-center shrink-0 shadow-2xs`}>
                            <span className="material-symbols-outlined text-lg">{cat.icon}</span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{cat.name}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">{cat.code}</span>
                          </div>
                        </div>
                      </td>

                      {/* Descrição */}
                      <td className="py-3 px-4 text-slate-500 text-xs max-w-xs truncate">
                        {cat.description}
                      </td>

                      {/* Contas Vinculadas */}
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {cat.linkedCount} conta(s)
                      </td>

                      {/* Total em Recebíveis */}
                      <td className="py-3 px-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                        R$ {cat.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4 text-center">
                        {cat.status === 'ativa' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Ativa
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                            Inativa
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCatForView(cat)}
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                            title="Ver Detalhes"
                          >
                            <span className="material-symbols-outlined text-base">visibility</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(cat)}
                            className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
                            title="Editar Categoria"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCatToDelete(cat)}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                            title="Excluir Categoria"
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
          /* VISUALIZAÇÃO DESKTOP: MODO GRADE (CARDS) */
          <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
            {filteredCategories.map((cat, idx) => (
              <div
                key={cat.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(idx)}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3 relative group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${cat.colorBg} ${cat.colorText} flex items-center justify-center shrink-0 shadow-2xs`}>
                      <span className="material-symbols-outlined text-xl">{cat.icon}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{cat.code}</span>
                      <h4 className="font-extrabold text-slate-900 text-sm">{cat.name}</h4>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${cat.status === 'ativa' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {cat.status === 'ativa' ? 'Ativa' : 'Inativa'}
                  </span>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px]">
                  {cat.description}
                </p>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Contas</span>
                    <span className="font-extrabold text-slate-800">{cat.linkedCount} registradas</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Total Recebíveis</span>
                    <span className="font-extrabold text-slate-900">R$ {cat.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-1.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedCatForView(cat)}
                    className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer text-xs font-bold inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    <span>Ver</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(cat)}
                    className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer text-xs font-bold inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatToDelete(cat)}
                    className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer text-xs font-bold inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VISUALIZAÇÃO MOBILE: CARDS VERTICALIZADOS */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredCategories.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">
              Nenhuma categoria encontrada para os filtros selecionados.
            </div>
          ) : (
            filteredCategories.map((cat) => (
              <div key={cat.id} className="p-4 space-y-3 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${cat.colorBg} ${cat.colorText} flex items-center justify-center shrink-0 shadow-2xs`}>
                      <span className="material-symbols-outlined text-xl">{cat.icon}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{cat.code}</span>
                      <h4 className="font-extrabold text-slate-900 text-sm">{cat.name}</h4>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${cat.status === 'ativa' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {cat.status === 'ativa' ? 'Ativa' : 'Inativa'}
                  </span>
                </div>

                <p className="text-xs text-slate-500">
                  {cat.description}
                </p>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 text-xs font-medium border border-slate-100">
                  <span className="text-slate-600">{cat.linkedCount} conta(s) vinculada(s)</span>
                  <span className="font-extrabold text-slate-900">R$ {cat.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCatForView(cat)}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    <span>Ver</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(cat)}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 font-bold text-xs hover:bg-amber-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatToDelete(cat)}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 font-bold text-xs hover:bg-rose-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* MODAL 1: VER DETALHES DA CATEGORIA (HEADER VERDE ESCURO #003400 + BOTAO FECHAR VERMELHO) */}
      {selectedCatForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Header Verde Escuro Corporativo */}
            <div className="px-6 py-4 bg-[#003400] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">{selectedCatForView.icon}</span>
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{selectedCatForView.name}</h3>
                  <span className="text-xs text-emerald-200 font-mono">{selectedCatForView.code}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCatForView(null)}
                className="bg-[#b91c1c] hover:bg-red-800 text-white p-1.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Descrição Completa</span>
                <p className="text-xs text-slate-700 mt-1 font-medium leading-relaxed">
                  {selectedCatForView.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-100">
                  <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider block">Contas Vinculadas</span>
                  <span className="text-lg font-extrabold text-blue-950 mt-0.5 block">{selectedCatForView.linkedCount} conta(s)</span>
                </div>

                <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-100">
                  <span className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider block">Total Acumulado</span>
                  <span className="text-base font-extrabold text-indigo-950 mt-0.5 block">R$ {selectedCatForView.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 text-xs">
                <span className="text-slate-500 font-semibold">Situação no Sistema:</span>
                {selectedCatForView.status === 'ativa' ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs border border-emerald-200">
                    Ativa para Novos Lançamentos
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-extrabold text-xs border border-slate-200">
                    Inativa
                  </span>
                )}
              </div>
            </div>

            {/* Footer com Botão Fechar em Vermelho */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCatForView(null)}
                className="px-5 py-2.5 rounded-xl bg-[#b91c1c] hover:bg-red-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">close</span>
                <span>Fechar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CRIAR / EDITAR CATEGORIA */}
      {(isCreateModalOpen || selectedCatForEdit) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-[#003400] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">category</span>
                </div>
                <h3 className="font-bold text-white text-base">
                  {selectedCatForEdit ? 'Editar Categoria' : 'Nova Categoria de Recebível'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setIsCreateModalOpen(false); setSelectedCatForEdit(null); resetForm(); }}
                className="bg-[#b91c1c] hover:bg-red-800 text-white p-1.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={selectedCatForEdit ? handleEditSubmit : handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Nome da Categoria <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Passeios, Transfer..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-sm bg-slate-50/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Descrição / Finalidade
                </label>
                <textarea
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Descreva o tipo de recebíveis associados..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-xs bg-slate-50/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Ícone Representativo
                  </label>
                  <select
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                  >
                    <option value="category">Category (Padrão)</option>
                    <option value="bed">Bed (Hospedagem)</option>
                    <option value="local_bar">Local Bar (Frigobar)</option>
                    <option value="event_seat">Event Seat (Eventos)</option>
                    <option value="corporate_fare">Corporate (Empresas)</option>
                    <option value="directions_car">Car (Transfer/Serviços)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                  >
                    <option value="ativa">Ativa</option>
                    <option value="inativa">Inativa</option>
                  </select>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsCreateModalOpen(false); setSelectedCatForEdit(null); resetForm(); }}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#003400] hover:bg-emerald-950 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>{selectedCatForEdit ? 'Salvar Alterações' : 'Criar Categoria'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EXCLUIR CATEGORIA */}
      {catToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">Excluir Categoria?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Deseja realmente remover a categoria <strong className="text-slate-900">"{catToDelete.name}"</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCatToDelete(null)}
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

    </div>
  );
};

export default CategoriasContasReceber;
