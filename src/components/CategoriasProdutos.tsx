import React, { useState } from 'react';

export interface CategoryData {
  id: string;
  code: string;
  name: string;
  description: string;
  productsCount: number;
  status: 'ativo' | 'inativo';
  icon: string;
  bgIconColor: string;
  textIconColor: string;
}

const INITIAL_CATEGORIES: CategoryData[] = [];

export interface CategoriasProdutosProps {
  onNavigateToNovaCategoria?: () => void;
  onNavigateToDashboard?: () => void;
  onNavigateToNovoProduto?: () => void;
}

export const CategoriasProdutos: React.FC<CategoriasProdutosProps> = ({
  onNavigateToNovaCategoria,
  onNavigateToDashboard,
  onNavigateToNovoProduto,
}) => {
  const [categories, setCategories] = useState<CategoryData[]>(INITIAL_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Modals state
  const [isNovoModalOpen, setIsNovoModalOpen] = useState(false);
  const [selectedCategoryForView, setSelectedCategoryForView] = useState<CategoryData | null>(null);
  const [selectedCategoryForEdit, setSelectedCategoryForEdit] = useState<CategoryData | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('category');
  const [formStatus, setFormStatus] = useState<'ativo' | 'inativo'>('ativo');

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const draggedCat = filteredCategories[draggedIndex];
    const dropCat = filteredCategories[dropIndex];

    if (!draggedCat || !dropCat) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const realDraggedIndex = categories.findIndex((c) => c.id === draggedCat.id);
    const realDropIndex = categories.findIndex((c) => c.id === dropCat.id);

    if (realDraggedIndex === -1 || realDropIndex === -1) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...categories];
    const [removed] = updated.splice(realDraggedIndex, 1);
    updated.splice(realDropIndex, 0, removed);

    setCategories(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Filtered categories
  const filteredCategories = categories.filter((cat) => {
    if (statusFilter !== 'todos' && cat.status !== statusFilter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return cat.name.toLowerCase().includes(q) || cat.description.toLowerCase().includes(q) || cat.code.toLowerCase().includes(q);
    }
    return true;
  });

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage) || 1;
  const paginatedCategories = filteredCategories.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja remover esta categoria?')) {
      setCategories(categories.filter((c) => c.id !== id));
    }
  };

  const handleOpenEdit = (c: CategoryData) => {
    setSelectedCategoryForEdit(c);
    setFormName(c.name);
    setFormDescription(c.description);
    setFormIcon(c.icon);
    setFormStatus(c.status);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryForEdit || !formName) return;
    setCategories(
      categories.map((c) => {
        if (c.id === selectedCategoryForEdit.id) {
          return {
            ...c,
            name: formName,
            description: formDescription,
            icon: formIcon,
            status: formStatus,
          };
        }
        return c;
      })
    );
    setSelectedCategoryForEdit(null);
  };

  const handleSaveNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;
    const newCode = `#0${categories.length + 1}`;
    const newCat: CategoryData = {
      id: Date.now().toString(),
      code: newCode,
      name: formName,
      description: formDescription || 'Descrição da categoria',
      productsCount: 0,
      status: formStatus,
      icon: formIcon || 'category',
      bgIconColor: 'bg-emerald-50',
      textIconColor: 'text-emerald-600',
    };
    setCategories([...categories, newCat]);
    setIsNovoModalOpen(false);
    setFormName('');
    setFormDescription('');
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12">
      
      {/* MOBILE CONTAINER (sm:hidden - 1:1 COM DESIGN MOBILE) */}
      <div className="flex flex-col gap-4 sm:hidden">
        
        {/* 1. CABEÇALHO CONTEXTUAL MOBILE */}
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Listagem de Categorias</h1>
          <p className="text-xs text-slate-500">Gerencie as categorias de produtos e serviços do hotel.</p>
        </div>

        {/* 2. BOTÕES DE AÇÃO EM GRADE 2X2 MOBILE */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => {
              if (onNavigateToNovaCategoria) {
                onNavigateToNovaCategoria();
              } else {
                setFormName('');
                setFormDescription('');
                setFormStatus('ativo');
                setIsNovoModalOpen(true);
              }
            }}
            className="flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-[#006c49] hover:bg-[#005236] text-white shadow-xs font-semibold text-xs cursor-pointer active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-base">create_new_folder</span>
            <span className="truncate">+ Nova Categoria</span>
          </button>

          <button
            onClick={() => {
              if (onNavigateToNovoProduto) {
                onNavigateToNovoProduto();
              } else {
                alert('Novo Produto...');
              }
            }}
            className="flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-[#000000] hover:bg-[#0b1c30] text-white shadow-xs font-semibold text-xs cursor-pointer active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-base">add_box</span>
            <span className="truncate">+ Novo Produto</span>
          </button>

          <button
            onClick={() => alert('Importando categorias...')}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[#d3e4fe] hover:bg-[#cbdbf5] text-[#0b1c30] font-semibold text-xs cursor-pointer active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-base">upload</span>
            <span>Importar</span>
          </button>

          <button
            onClick={() => alert('Exportando categorias...')}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[#ffddb8] hover:bg-[#ffb95f] text-[#2a1700] font-semibold text-xs cursor-pointer active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Exportar</span>
          </button>
        </div>

        {/* 3. BARRA DE PESQUISA E BOTÃO FILTROS */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar categorias por nome..."
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl text-xs font-medium shadow-xs focus:outline-none focus:ring-1 focus:ring-[#006c49]"
            />
          </div>
          <button
            onClick={() => setStatusFilter(statusFilter === 'todos' ? 'ativo' : 'todos')}
            className="flex items-center justify-center gap-1 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 shadow-xs font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">tune</span>
            <span>Filtros</span>
          </button>
        </div>

        {/* 4. CARTÕES DE INDICADORES (KPIS 3 COLUNAS MOBILE) */}
        <div className="grid grid-cols-3 gap-2">
          {/* ATIVAS */}
          <div className="flex flex-col p-3 rounded-xl bg-[#ffddb8]/40 border border-[#ffddb8]/60 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <span className="material-symbols-outlined text-base text-[#b87500]">verified</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#b87500]"></span>
            </div>
            <span className="text-xl font-black text-[#2a1700] leading-none">18</span>
            <span className="text-[10px] font-bold text-slate-600 mt-1 truncate">Categorias Ativas</span>
            <span className="text-[9px] leading-tight text-[#b87500] font-medium truncate">Em operação</span>
          </div>

          {/* TOTAL PRODUTOS */}
          <div className="flex flex-col p-3 rounded-xl bg-[#dce9ff] border border-blue-200/60 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <span className="material-symbols-outlined text-base text-slate-800">inventory</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#006c49]"></span>
            </div>
            <span className="text-xl font-black text-slate-900 leading-none">328</span>
            <span className="text-[10px] font-bold text-slate-600 mt-1 truncate">Total Produtos</span>
            <span className="text-[9px] leading-tight text-[#006c49] font-medium truncate">Vinculados</span>
          </div>

          {/* SEM ITENS */}
          <div className="flex flex-col p-3 rounded-xl bg-rose-100/70 border border-rose-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <span className="material-symbols-outlined text-base text-rose-700">warning</span>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
            </div>
            <span className="text-xl font-black text-rose-900 leading-none">2</span>
            <span className="text-[10px] font-bold text-rose-700 mt-1 truncate">Sem Itens</span>
            <span className="text-[9px] leading-tight text-rose-600 font-medium truncate">Requer atenção</span>
          </div>
        </div>

        {/* 5. LISTA DE CARDS DE CATEGORIAS MOBILE */}
        <div className="flex flex-col gap-3 pt-1">
          {filteredCategories.map((cat, index) => (
            <div
              key={cat.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={
                "flex flex-col p-4 rounded-xl bg-white border shadow-xs space-y-3 transition-all " +
                (draggedIndex === index ? 'opacity-40 border-dashed border-emerald-500 scale-[0.98]' : 'border-slate-200') +
                (dragOverIndex === index && draggedIndex !== index ? ' border-2 border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20' : '')
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-slate-400 cursor-grab active:cursor-grabbing text-xl select-none" title="Arrastar para reordenar">
                    drag_indicator
                  </span>
                  <div className={`w-9 h-9 rounded-xl ${cat.bgIconColor} ${cat.textIconColor} flex items-center justify-center shadow-2xs`}>
                    <span className="material-symbols-outlined text-lg">{cat.icon}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400">{cat.code}</span>
                    <h2 className="font-bold text-base text-slate-900 leading-tight">{cat.name}</h2>
                  </div>
                </div>
                <span
                  className={
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold " +
                    (cat.status === 'ativo'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600')
                  }
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cat.status === 'ativo' ? 'bg-emerald-600' : 'bg-slate-400'}`}></span>
                  {cat.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <p className="text-xs text-slate-500 leading-snug">{cat.description}</p>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-600 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#006c49]">check_circle</span>
                  <span>Produtos vinculados: <strong className="text-slate-900 font-bold">{cat.productsCount}</strong></span>
                </span>
              </div>

              {/* BOTÕES DE AÇÃO MOBILE */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() => setSelectedCategoryForView(cat)}
                  className="py-2 px-2 rounded-xl bg-[#dce9ff] text-[#0b1c30] font-semibold text-xs flex items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">visibility</span>
                  <span>Ver</span>
                </button>
                <button
                  onClick={() => handleOpenEdit(cat)}
                  className="py-2 px-2 rounded-xl bg-[#ffddb8] text-[#2a1700] font-semibold text-xs flex items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  <span>Editar</span>
                </button>
                <button
                  onClick={() => handleDelete(cat.id)}
                  className="py-2 px-2 rounded-xl bg-rose-100 text-rose-800 font-semibold text-xs flex items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          ))}

          {filteredCategories.length === 0 && (
            <div className="py-12 text-center text-slate-500 text-xs">
              Nenhuma categoria encontrada.
            </div>
          )}
        </div>

        {/* 6. PAGINAÇÃO MOBILE */}
        <div className="flex flex-col items-center justify-center gap-2.5 pt-2 pb-4">
          <span className="text-xs text-slate-500">
            Exibindo <strong className="text-slate-900 font-semibold">{(currentPage - 1) * itemsPerPage + 1}</strong> a <strong className="text-slate-900 font-semibold">{Math.min(currentPage * itemsPerPage, filteredCategories.length)}</strong> de <strong className="text-slate-900 font-semibold">{filteredCategories.length}</strong> resultados
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                  currentPage === page
                    ? 'bg-[#006c49] text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 font-medium'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>
        </div>

      </div>

      {/* DESKTOP CONTAINER (hidden sm:flex) */}
      <div className="hidden sm:flex flex-col gap-6">
        
        {/* CABEÇALHO DA PÁGINA (TÍTULO E SUBTÍTULO) */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Listagem de Categorias</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie as categorias de produtos e serviços do hotel.</p>
        </div>

        {/* SUMMARY METRIC CARDS (KPIS SEMPRE ABAIXO DO SUBTÍTULO) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full">
          {/* KPI 1 - CATEGORIAS ATIVAS */}
          <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Categorias Ativas</span>
              <div className="w-4 h-4 rounded-full border border-amber-500 flex items-center justify-center text-amber-600">
                <span className="material-symbols-outlined text-[10px]">check</span>
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-slate-900">18</span>
              <div className="flex items-center text-xs font-medium text-amber-700 mt-0.5 gap-1">
                <span className="material-symbols-outlined text-xs">check_circle</span>
                <span>Em operação</span>
              </div>
            </div>
          </div>

          {/* KPI 2 - TOTAL PRODUTOS */}
          <div className="bg-blue-50/60 border border-blue-200/70 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Total Produtos</span>
              <span className="material-symbols-outlined text-base text-blue-600">inventory_2</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-slate-900">328</span>
              <div className="flex items-center text-xs font-medium text-blue-700 mt-0.5 gap-1">
                <span>#</span>
                <span>Vinculados</span>
              </div>
            </div>
          </div>

          {/* KPI 3 - SEM ITENS */}
          <div className="bg-rose-50/60 border border-rose-200/70 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Sem Itens</span>
              <span className="material-symbols-outlined text-base text-rose-500">warning</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-slate-900">2</span>
              <div className="flex items-center text-xs font-medium text-rose-600 mt-0.5 gap-1">
                <span className="material-symbols-outlined text-xs">error</span>
                <span>Requer atenção</span>
              </div>
            </div>
          </div>
        </div>

        {/* CONTAINER PRINCIPAL: TOOLBAR E CARDS/TABELA DESKTOP */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          
          {/* TOOLBAR SUPERIOR */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 bg-slate-50/50">
            
            {/* FILTROS E BUSCA */}
            <div className="flex flex-wrap items-center gap-3">
              {/* INPUT DE BUSCA */}
              <div className="relative min-w-[240px] sm:w-64 flex-1 sm:flex-initial">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar categorias..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm placeholder-slate-400 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* SELECT STATUS */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="appearance-none bg-white border border-slate-200 rounded-lg text-sm text-slate-700 py-2 pl-3.5 pr-8 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
                  arrow_drop_down
                </span>
              </div>

              {/* LIMPAR FILTROS */}
              {(searchQuery || statusFilter !== 'todos') && (
                <button
                  onClick={() => { setSearchQuery(''); setStatusFilter('todos'); }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base text-slate-500">filter_alt_off</span>
                  <span>Limpar Filtros</span>
                </button>
              )}
            </div>

            {/* CONTROLES DIREITA (TOGGLE VISUALIZAÇÃO & BOTÕES DE AÇÃO) */}
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5">
              
              {/* TOGGLE LISTA / GRADE */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  title="Visualização em Lista"
                  className={
                    "p-1.5 rounded-md transition-colors cursor-pointer " +
                    (viewMode === 'list'
                      ? 'bg-white text-blue-600 shadow-xs border border-slate-200/50 font-bold'
                      : 'text-slate-500 hover:text-slate-800')
                  }
                >
                  <span className="material-symbols-outlined text-lg">list</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  title="Visualização em Grade"
                  className={
                    "p-1.5 rounded-md transition-colors cursor-pointer " +
                    (viewMode === 'grid'
                      ? 'bg-white text-blue-600 shadow-xs border border-slate-200/50 font-bold'
                      : 'text-slate-500 hover:text-slate-800')
                  }
                >
                  <span className="material-symbols-outlined text-lg">grid_view</span>
                </button>
              </div>

              {/* BOTÃO IMPORTAR */}
              <button
                onClick={() => alert('Importando categorias...')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-xs cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-base">upload</span>
                <span>Importar</span>
              </button>

              {/* BOTÃO EXPORTAR */}
              <button
                onClick={() => alert('Exportando categorias...')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors shadow-xs cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-base">download</span>
                <span>Exportar</span>
              </button>

              {/* BOTÃO NOVA CATEGORIA */}
              <button
                onClick={() => {
                  if (onNavigateToNovaCategoria) {
                    onNavigateToNovaCategoria();
                  } else {
                    setFormName('');
                    setFormDescription('');
                    setFormStatus('ativo');
                    setIsNovoModalOpen(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-xs cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-base">add</span>
                <span>Nova Categoria</span>
              </button>
            </div>

          </div>

          {/* MODOS DE VISUALIZAÇÃO DESKTOP */}

          {/* 1. MODO GRADE (CARDS 3 COLUNAS) */}
          {viewMode === 'grid' && (
            <div className="p-5 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {paginatedCategories.map((cat, index) => (
                  <div
                    key={cat.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={
                      "border rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:shadow-md transition-all bg-white " +
                      (draggedIndex === index ? 'opacity-40 border-dashed border-emerald-500 scale-[0.98]' : 'border-slate-200') +
                      (dragOverIndex === index && draggedIndex !== index ? ' border-2 border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20' : '')
                    }
                  >
                    <div>
                      {/* LINHA SUPERIOR: ÍCONE, DRAG HANDLE E BADGE DE STATUS */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-400 cursor-grab active:cursor-grabbing text-xl select-none" title="Arrastar para reordenar">
                            drag_indicator
                          </span>
                          <div className={`w-10 h-10 rounded-lg ${cat.bgIconColor} ${cat.textIconColor} flex items-center justify-center`}>
                            <span className="material-symbols-outlined text-xl">{cat.icon}</span>
                          </div>
                        </div>
                        <span
                          className={
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border " +
                            (cat.status === 'ativo'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-200')
                          }
                        >
                          {cat.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>

                      {/* CÓDIGO E NOME DA CATEGORIA */}
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-slate-400">{cat.code}</span>
                        <h3 className="text-base font-semibold text-slate-900 leading-snug">{cat.name}</h3>
                        <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px]">{cat.description}</p>
                      </div>

                      {/* CONTADOR DE PRODUTOS VINCULADOS */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-medium">
                        <span className="text-slate-400">Produtos vinculados</span>
                        <span className={"text-sm font-bold " + (cat.productsCount === 0 ? 'text-rose-600' : 'text-slate-900')}>
                          {cat.productsCount}
                        </span>
                      </div>
                    </div>

                    {/* AÇÕES (VER, EDITAR, EXCLUIR) */}
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => setSelectedCategoryForView(cat)}
                        className="inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        <span>Ver</span>
                      </button>
                      <button
                        onClick={() => handleOpenEdit(cat)}
                        className="inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredCategories.length === 0 && (
                <div className="py-16 text-center text-slate-500 text-sm">
                  Nenhuma categoria encontrada com os filtros aplicados.
                </div>
              )}
            </div>
          )}

          {/* 2. MODO LISTA (TABELA DESKTOP) */}
          {viewMode === 'list' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-3 text-center w-10"></th>
                    <th className="py-3.5 px-6">ID</th>
                    <th className="py-3.5 px-6">Nome / Descrição</th>
                    <th className="py-3.5 px-6 text-center">Produtos Vinculados</th>
                    <th className="py-3.5 px-6 text-center">Status</th>
                    <th className="py-3.5 px-6 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {paginatedCategories.map((cat, index) => (
                    <tr
                      key={cat.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className={
                        "transition-all cursor-default " +
                        (draggedIndex === index ? 'opacity-40 bg-emerald-50/50' : 'hover:bg-slate-50/80') +
                        (dragOverIndex === index && draggedIndex !== index ? ' bg-emerald-50 border-y-2 border-emerald-500' : '')
                      }
                    >
                      <td className="py-4 px-3 text-center">
                        <span className="material-symbols-outlined text-slate-400 cursor-grab active:cursor-grabbing text-xl select-none inline-block align-middle" title="Arrastar para reordenar">
                          drag_indicator
                        </span>
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-500 text-xs">{cat.code}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg ${cat.bgIconColor} ${cat.textIconColor} flex items-center justify-center shrink-0`}>
                            <span className="material-symbols-outlined text-lg">{cat.icon}</span>
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{cat.name}</p>
                            <p className="text-xs text-slate-500">{cat.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-slate-900">
                        <span className={cat.productsCount === 0 ? 'text-rose-600' : 'text-slate-900'}>
                          {cat.productsCount}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border " +
                            (cat.status === 'ativo'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-200')
                          }
                        >
                          {cat.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedCategoryForView(cat)}
                            className="inline-flex items-center gap-1 py-1.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">visibility</span>
                            <span>Ver</span>
                          </button>
                          <button
                            onClick={() => handleOpenEdit(cat)}
                            className="inline-flex items-center gap-1 py-1.5 px-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => handleDelete(cat.id)}
                            className="inline-flex items-center gap-1 py-1.5 px-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                            <span>Excluir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredCategories.length === 0 && (
                <div className="py-16 text-center text-slate-500 text-sm">
                  Nenhuma categoria encontrada com os filtros aplicados.
                </div>
              )}
            </div>
          )}

          {/* RODAPÉ DE PAGINAÇÃO DESKTOP */}
          <footer className="p-4 sm:px-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-slate-500">
            <div>
              Mostrando <span className="font-semibold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-semibold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredCategories.length)}</span> de <span className="font-semibold text-slate-800">{filteredCategories.length}</span> resultados
            </div>
            <nav aria-label="Navegação da listagem" className="inline-flex items-center -space-x-px rounded-md border border-slate-200 bg-white">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-50 rounded-l-md border-r border-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`px-3.5 py-1.5 text-xs font-semibold border-r border-slate-200 transition-colors cursor-pointer ${
                    currentPage === page
                      ? 'bg-[#003400] text-white hover:bg-[#002800]'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-50 rounded-r-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </nav>
          </footer>

        </section>
      </div>

      {/* MODAL: VER DETALHES DA CATEGORIA */}
      {selectedCategoryForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200/80 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col my-auto">
            {/* Header Escuro Padrão #003400 */}
            <div className="bg-[#003400] text-white px-5 py-4 flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${selectedCategoryForView.bgIconColor} ${selectedCategoryForView.textIconColor} flex items-center justify-center shadow-xs`}>
                  <span className="material-symbols-outlined text-xl">{selectedCategoryForView.icon}</span>
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white leading-tight">{selectedCategoryForView.name}</h3>
                  <span className="text-xs text-emerald-300 font-mono">{selectedCategoryForView.code}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedCategoryForView(null)}
                type="button"
                aria-label="Fechar Modal"
                className="bg-[#b91c1c] text-white hover:bg-red-800 transition-colors p-1.5 rounded-xl shrink-0 flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 text-slate-700 text-sm">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Descrição</p>
                <p className="text-slate-800">{selectedCategoryForView.description}</p>
              </div>
              <div className="flex justify-between pt-3 border-t border-slate-100">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Produtos Vinculados</p>
                  <p className="text-base font-bold text-slate-900">{selectedCategoryForView.productsCount} itens</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                  <span
                    className={
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border " +
                      (selectedCategoryForView.status === 'ativo'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-slate-100 text-slate-600 border-slate-200')
                    }
                  >
                    {selectedCategoryForView.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedCategoryForView(null)}
                className="px-5 py-2.5 bg-[#b91c1c] hover:bg-red-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer active:scale-95 inline-flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-base">close</span>
                <span>Fechar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA CATEGORIA */}
      {isNovoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <form onSubmit={handleSaveNew} className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-900">Cadastrar Nova Categoria</h3>
              <button
                type="button"
                onClick={() => setIsNovoModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Bebidas Especiais"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Descrição
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Descrição breve dos itens pertencentes a esta categoria..."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ícone
                  </label>
                  <select
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
                  >
                    <option value="category">Outros / Categoria</option>
                    <option value="local_bar">Bebidas</option>
                    <option value="cookie">Snacks</option>
                    <option value="soap">Higiene</option>
                    <option value="sports_bar">Bebidas Alcoólicas</option>
                    <option value="bed">Enxoval</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsNovoModalOpen(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#003400] hover:bg-[#002800] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Salvar Categoria
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDITAR CATEGORIA */}
      {selectedCategoryForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <form onSubmit={handleSaveEdit} className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-900">Editar Categoria</h3>
              <button
                type="button"
                onClick={() => setSelectedCategoryForEdit(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Descrição
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ícone
                  </label>
                  <select
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
                  >
                    <option value="category">Outros / Categoria</option>
                    <option value="local_bar">Bebidas</option>
                    <option value="cookie">Snacks</option>
                    <option value="soap">Higiene</option>
                    <option value="sports_bar">Bebidas Alcoólicas</option>
                    <option value="bed">Enxoval</option>
                    <option value="local_laundry_service">Lavanderia</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedCategoryForEdit(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#003400] hover:bg-[#002800] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default CategoriasProdutos;
