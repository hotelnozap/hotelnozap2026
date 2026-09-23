import React, { useState, useEffect } from 'react';
import { categoriasQuartosService, CategoriaQuartoData } from '../services/supabaseService';

export type { CategoriaQuartoData as RoomCategoryData };

export interface ListagemCategoriasProps {
  onBack: () => void;
  onNavigateToNovaCategoria?: () => void;
  onNavigateToEdit?: (cat: CategoriaQuartoData) => void;
}

export const ListagemCategorias: React.FC<ListagemCategoriasProps> = ({ 
  onBack, 
  onNavigateToNovaCategoria,
  onNavigateToEdit 
}) => {
  const [categories, setCategories] = useState<CategoriaQuartoData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [viewMode, setViewMode] = useState<'lista' | 'grade'>('lista');

  // Modals state
  const [selectedCategoryForView, setSelectedCategoryForView] = useState<CategoriaQuartoData | null>(null);
  const [selectedCategoryForEdit, setSelectedCategoryForEdit] = useState<CategoriaQuartoData | null>(null);
  const [isNovaModalOpen, setIsNovaModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Form states for New / Edit
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formOrdenacao, setFormOrdenacao] = useState('1');
  const [formStatus, setFormStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [formIcon, setFormIcon] = useState('king_bed');

  const loadData = () => {
    categoriasQuartosService.getCategorias().then(data => setCategories(data || []));
  };

  useEffect(() => {
    loadData();
    window.addEventListener('hotel_nova_categoria_quarto', loadData);
    window.addEventListener('hotel_changed', loadData);
    return () => {
      window.removeEventListener('hotel_nova_categoria_quarto', loadData);
      window.removeEventListener('hotel_changed', loadData);
    };
  }, []);

  // KPIs
  const totalCategorias = categories.length;
  const ativasCount = categories.filter(c => c.status === 'ativo').length;
  const totalQuartosVinculados = categories.reduce((sum, c) => sum + c.linkedRoomsCount, 0);
  const inativasCount = categories.filter(c => c.status === 'inativo').length;

  // Filtered List
  const filteredCategories = categories.filter(cat => {
    if (statusFilter !== 'todos' && cat.status !== statusFilter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return cat.name.toLowerCase().includes(q) || cat.description.toLowerCase().includes(q);
    }
    return true;
  });

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage) || 1;
  const paginatedCategories = filteredCategories.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleDeleteCategory = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta categoria?')) {
      setCategories(prev => prev.filter(c => c.id !== id));
      await categoriasQuartosService.deleteCategoria(id);
      showToast('Categoria excluída com sucesso!');
      loadData();
    }
  };

  const handleOpenEdit = (cat: CategoriaQuartoData) => {
    setSelectedCategoryForEdit(cat);
    setFormName(cat.name);
    setFormDescription(cat.description);
    setFormOrdenacao(String(cat.ordenacao));
    setFormStatus(cat.status);
    setFormIcon(cat.icon);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryForEdit || !formName.trim()) return;
    
    const updatedData = {
      name: formName.trim(),
      description: formDescription.trim(),
      ordenacao: parseInt(formOrdenacao) || 1,
      status: formStatus,
      icon: formIcon,
    };

    setCategories(prev => prev.map(c => c.id === selectedCategoryForEdit.id ? { ...c, ...updatedData } : c));
    await categoriasQuartosService.updateCategoria(selectedCategoryForEdit.id, updatedData);
    setSelectedCategoryForEdit(null);
    showToast('Categoria atualizada com sucesso!');
    loadData();
  };

  const handleSaveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;
    await categoriasQuartosService.createCategoria({
      name: formName,
      description: formDescription || '',
      icon: formIcon,
      ordenacao: parseInt(formOrdenacao) || categories.length + 1,
      status: formStatus,
    });
    setIsNovaModalOpen(false);
    setFormName('');
    setFormDescription('');
    setFormOrdenacao(String(categories.length + 2));
    showToast('Categoria cadastrada com sucesso!');
    loadData();
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#d1fae5] border border-emerald-300 text-black font-bold px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-[#003400] text-xl">check_circle</span>
          <span className="text-sm text-black font-bold">{toastMessage}</span>
        </div>
      )}
      
      {/* VOLTAR LINK */}
      <div>
        <button 
          onClick={onBack}
          type="button"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          <span>Voltar para o Mapa dos Quartos</span>
        </button>
      </div>

      {/* CABEÇALHO DA PÁGINA E BOTÕES DE AÇÃO */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Categorias dos Quartos</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie as categorias, precificação base e capacidade padrão das acomodações</p>
        </div>

        {/* BOTÕES DE AÇÃO (DESKTOP E MOBILE) */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => alert('Exportando lista de categorias em Excel...')}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all text-white bg-[#FDB116] hover:bg-[#e59e0b] cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            <span>Exportar</span>
          </button>

          <button 
            onClick={() => {
              if (onNavigateToNovaCategoria) {
                onNavigateToNovaCategoria();
              } else {
                setFormName('');
                setFormDescription('');
                setFormOrdenacao(String(categories.length + 1));
                setFormStatus('ativo');
                setIsNovaModalOpen(true);
              }
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all text-white bg-[#003400] hover:bg-[#002200] cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span>Nova Categoria</span>
          </button>
        </div>
      </div>

      {/* KPIS COM FUNDOS DISTINTOS PASTÉIS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        
        {/* KPI 1 - TOTAL CATEGORIAS */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] sm:text-xs font-bold tracking-wider text-blue-700 uppercase">Total Categorias</span>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{totalCategorias}</p>
            <span className="text-[11px] sm:text-xs text-blue-600 font-medium flex items-center gap-1 mt-1">
              <span className="material-symbols-outlined text-xs">category</span>
              <span>Cadastradas no hotel</span>
            </span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl sm:text-2xl">category</span>
          </div>
        </div>

        {/* KPI 2 - CATEGORIAS ATIVAS */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] sm:text-xs font-bold tracking-wider text-emerald-700 uppercase">Categorias Ativas</span>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{ativasCount}</p>
            <span className="text-[11px] sm:text-xs text-emerald-600 font-medium flex items-center gap-1 mt-1">
              <span className="material-symbols-outlined text-xs">check_circle</span>
              <span>Disponíveis para reservas</span>
            </span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl sm:text-2xl">check_circle</span>
          </div>
        </div>

        {/* KPI 3 - QUARTOS VINCULADOS */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] sm:text-xs font-bold tracking-wider text-indigo-700 uppercase">Quartos Vinculados</span>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{totalQuartosVinculados}</p>
            <span className="text-[11px] sm:text-xs text-indigo-600 font-medium flex items-center gap-1 mt-1">
              <span className="material-symbols-outlined text-xs">hotel</span>
              <span>Acomodações distribuídas</span>
            </span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl sm:text-2xl">bed</span>
          </div>
        </div>

        {/* KPI 4 - CATEGORIAS INATIVAS */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] sm:text-xs font-bold tracking-wider text-amber-700 uppercase">Categorias Inativas</span>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{inativasCount}</p>
            <span className="text-[11px] sm:text-xs text-amber-600 font-medium flex items-center gap-1 mt-1">
              <span className="material-symbols-outlined text-xs">block</span>
              <span>Fora de operação</span>
            </span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl sm:text-2xl">block</span>
          </div>
        </div>

      </div>

      {/* BARRA DE FERRAMENTAS / FILTROS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* BUSCA */}
        <div className="relative w-full md:w-96">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome da categoria ou descrição..." 
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-700 transition-colors"
          />
        </div>

        {/* FILTROS E VIEW MODE */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-700 focus:outline-none focus:border-emerald-700 cursor-pointer"
          >
            <option value="todos">Todos os Status</option>
            <option value="ativo">Ativas</option>
            <option value="inativo">Inativas</option>
          </select>

          {(searchQuery || statusFilter !== 'todos') && (
            <button 
              onClick={() => { setSearchQuery(''); setStatusFilter('todos'); }}
              className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors px-2 cursor-pointer"
            >
              Limpar Filtros
            </button>
          )}

          {/* TOGGLE MODO LISTA / GRADE (DESKTOP) */}
          <div className="hidden sm:flex items-center border border-slate-200 rounded-xl p-1 bg-slate-50">
            <button 
              onClick={() => setViewMode('lista')}
              className={
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer " +
                (viewMode === 'lista' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900')
              }
            >
              <span className="material-symbols-outlined text-base">format_list_bulleted</span>
              <span>Lista</span>
            </button>
            <button 
              onClick={() => setViewMode('grade')}
              className={
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer " +
                (viewMode === 'grade' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900')
              }
            >
              <span className="material-symbols-outlined text-base">grid_view</span>
              <span>Grade</span>
            </button>
          </div>
        </div>

      </div>

      {/* VISUALIZAÇÃO DESKTOP: TABELA (LISTA) */}
      {viewMode === 'lista' ? (
        <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-6">Categoria</th>
                  <th className="py-4 px-6">Ordenação</th>
                  <th className="py-4 px-6">Observação</th>
                  <th className="py-4 px-6">Quartos Vinculados</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedCategories.map((cat) => (
                  <tr key={cat.id} className={"hover:bg-slate-50/60 transition-colors " + (cat.status === 'inativo' ? 'opacity-80' : '')}>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3.5">
                        <div className={"w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 " + cat.iconBgColor}>
                          <span className="material-symbols-outlined">{cat.icon}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-900">{cat.name}</span>
                          <p className="text-xs text-slate-500 mt-0.5 max-w-xs">{cat.description || '—'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                        <span className="material-symbols-outlined text-base text-slate-400">format_list_numbered</span>
                        <span>#{cat.ordenacao}</span>
                      </span>
                    </td>

                    <td className="py-4 px-6 text-slate-600 max-w-[200px] truncate">
                      {cat.description || <span className="text-slate-400 italic">Sem observação</span>}
                    </td>

                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        <span className="material-symbols-outlined text-xs">meeting_room</span>
                        <span>{cat.linkedRoomsCount} quartos</span>
                      </span>
                    </td>

                    <td className="py-4 px-6">
                      <span className={
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold " +
                        (cat.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700')
                      }>
                        <span className={"w-2 h-2 rounded-full " + (cat.status === 'ativo' ? 'bg-emerald-600' : 'bg-slate-500')}></span>
                        {cat.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => setSelectedCategoryForView(cat)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all text-white bg-[#2563EB] hover:bg-[#1d4ed8] cursor-pointer"
                          title="Ver"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          <span>Ver</span>
                        </button>

                        <button 
                          onClick={() => {
                            if (onNavigateToEdit) {
                              onNavigateToEdit(cat);
                            } else {
                              handleOpenEdit(cat);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all text-white bg-[#EA580C] hover:bg-[#c2410c] cursor-pointer"
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                          <span>Editar</span>
                        </button>

                        <button 
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all text-white bg-[#DC2626] hover:bg-[#b91c1c] cursor-pointer"
                          title="Excluir"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          <span>Excluir</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredCategories.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      Nenhuma categoria encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* RODAPÉ / PAGINAÇÃO */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <span className="text-slate-500 font-medium text-xs sm:text-sm">
              Exibindo <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> a <strong>{Math.min(currentPage * itemsPerPage, filteredCategories.length)}</strong> de <strong>{filteredCategories.length}</strong> categorias cadastradas
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    currentPage === page
                      ? 'bg-[#003400] text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* VISUALIZAÇÃO EM GRADE (DESKTOP GRADE OU MOBILE CARDS) */}
      <div className={viewMode === 'grade' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'md:hidden space-y-3.5'}>
        {paginatedCategories.map((cat) => (
          <div key={cat.id} className={"bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 " + (cat.status === 'inativo' ? 'opacity-85' : '')}>
            
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className={"w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 " + cat.iconBgColor}>
                  <span className="material-symbols-outlined text-xl">{cat.icon}</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{cat.name}</h3>
                  <p className="text-[11px] text-slate-500">{cat.linkedRoomsCount} quartos vinculados</p>
                </div>
              </div>

              <span className={
                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 " +
                (cat.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700')
              }>
                <span className={"w-1.5 h-1.5 rounded-full " + (cat.status === 'ativo' ? 'bg-emerald-600' : 'bg-slate-500')}></span>
                {cat.status === 'ativo' ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            <p className="text-xs text-slate-600 line-clamp-2">{cat.description}</p>

            <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-600">
                <span>Ordenação:</span>
                <span className="font-semibold text-slate-800">#{cat.ordenacao}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Status:</span>
                <span className={`font-bold ${cat.status === 'ativo' ? 'text-emerald-700' : 'text-slate-500'}`}>{cat.status === 'ativo' ? 'Ativa' : 'Inativa'}</span>
              </div>
            </div>

            {/* BOTÕES DE AÇÃO CARD */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button 
                onClick={() => setSelectedCategoryForView(cat)}
                className="py-1.5 rounded-lg text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1d4ed8] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
              >
                <span className="material-symbols-outlined text-sm">visibility</span>
                <span>Ver</span>
              </button>

              <button 
                onClick={() => {
                  if (onNavigateToEdit) {
                    onNavigateToEdit(cat);
                  } else {
                    handleOpenEdit(cat);
                  }
                }}
                className="py-1.5 rounded-lg text-xs font-bold text-white bg-[#EA580C] hover:bg-[#c2410c] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                <span>Editar</span>
              </button>

              <button 
                onClick={() => handleDeleteCategory(cat.id)}
                className="py-1.5 rounded-lg text-xs font-bold text-white bg-[#DC2626] hover:bg-[#b91c1c] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span>Excluir</span>
              </button>
            </div>

          </div>
        ))}
      </div>

      {/* MODAL VER DETALHES */}
      {selectedCategoryForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200/80 my-auto">
            {/* Header Escuro Padrão #003400 */}
            <div className="px-5 py-4 flex items-center justify-between bg-[#003400] text-white shadow-md">
              <div className="flex items-center gap-3">
                <div className={"w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl shadow-xs " + selectedCategoryForView.iconBgColor}>
                  <span className="material-symbols-outlined">{selectedCategoryForView.icon}</span>
                </div>
                <div>
                  <h3 className="font-bold text-white text-base sm:text-lg leading-tight">{selectedCategoryForView.name}</h3>
                  <p className="text-xs text-emerald-300 font-mono">Detalhes completos da categoria</p>
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

            <div className="p-6 space-y-4 text-sm text-slate-700">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Observação</span>
                <p className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-800">
                  {selectedCategoryForView.description || <span className="text-slate-400 italic">Nenhuma observação cadastrada.</span>}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Ordenação</span>
                  <span className="font-semibold text-slate-900">#{selectedCategoryForView.ordenacao}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Quartos Vinculados</span>
                  <span className="font-semibold text-slate-900">{selectedCategoryForView.linkedRoomsCount} quartos</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Status</span>
                <span className={"font-bold uppercase text-xs " + (selectedCategoryForView.status === 'ativo' ? 'text-emerald-700' : 'text-slate-500')}>
                  ● {selectedCategoryForView.status === 'ativo' ? 'Ativa' : 'Inativa'}
                </span>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedCategoryForView(null)}
                className="px-5 py-2 bg-[#b91c1c] hover:bg-red-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer active:scale-95 inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">close</span>
                <span>Fechar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR OU NOVA CATEGORIA */}
      {(selectedCategoryForEdit || isNovaModalOpen) && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#003400] flex items-center justify-center font-bold text-xl">
                  <span className="material-symbols-outlined">{isNovaModalOpen ? 'add' : 'edit'}</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    {isNovaModalOpen ? 'Cadastrar Nova Categoria' : 'Editar Categoria'}
                  </h3>
                  <p className="text-xs text-slate-500">Preencha os dados e especificações da categoria</p>
                </div>
              </div>
              <button 
                onClick={() => { setSelectedCategoryForEdit(null); setIsNovaModalOpen(false); }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={isNovaModalOpen ? handleSaveNew : handleSaveEdit} className="p-6 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Nome da Categoria *
                </label>
                <input 
                  type="text" 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="Ex: Suíte Presidencial, Standard Casal..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003400]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Ordenação *
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    value={formOrdenacao}
                    onChange={(e) => setFormOrdenacao(e.target.value)}
                    required
                    placeholder="1"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003400]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Status
                  </label>
                  <select 
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003400]"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Observação
                </label>
                <textarea 
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Observações internas, particularidades ou anotações sobre esta categoria..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003400] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Ícone
                </label>
                <select 
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003400]"
                >
                  <option value="king_bed">King Bed</option>
                  <option value="bedroom_parent">Bed Parent</option>
                  <option value="cottage">Chalé / Cottage</option>
                  <option value="single_bed">Single Bed</option>
                  <option value="bed">Cama Standard</option>
                  <option value="construction">Em Reforma</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => { setSelectedCategoryForEdit(null); setIsNovaModalOpen(false); }}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 rounded-xl bg-[#003400] text-white text-xs font-semibold hover:bg-[#002200]"
                >
                  Salvar Categoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ListagemCategorias;
