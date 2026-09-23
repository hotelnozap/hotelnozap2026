import React, { useState, useEffect, useMemo } from 'react';
import { categoriasHoteisService, CategoriaHotelData } from '../services/supabaseService';

export interface ListagemCategoriasHotelProps {
  onBackToHoteis: () => void;
  onNavigateToCreate: () => void;
  onNavigateToEdit: (categoria: CategoriaHotelData) => void;
}

export const ListagemCategoriasHotel: React.FC<ListagemCategoriasHotelProps> = ({
  onBackToHoteis,
  onNavigateToCreate,
  onNavigateToEdit
}) => {
  const [categories, setCategories] = useState<CategoriaHotelData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [categoryToDelete, setCategoryToDelete] = useState<CategoriaHotelData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await categoriasHoteisService.getCategorias();
      setCategories(data || []);
    } catch {
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('hotel_categoria_modificada', handleUpdate);
    window.addEventListener('hotel_novo_criado', handleUpdate);
    window.addEventListener('hotel_modificado', handleUpdate);
    return () => {
      window.removeEventListener('hotel_categoria_modificada', handleUpdate);
      window.removeEventListener('hotel_novo_criado', handleUpdate);
      window.removeEventListener('hotel_modificado', handleUpdate);
    };
  }, []);

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    try {
      const res = await categoriasHoteisService.deleteCategoria(categoryToDelete.id);
      if (res.success) {
        showToast(`Categoria "${categoryToDelete.name}" excluída com sucesso!`);
        setCategoryToDelete(null);
        loadData();
      } else {
        showToast(res.error || 'Erro ao excluir categoria.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Falha ao excluir categoria.');
    }
  };

  // KPIs
  const totalCategorias = categories.length;
  const ativasCount = categories.filter(c => c.status === 'ativo').length;
  const inativasCount = categories.filter(c => c.status === 'inativo').length;
  const totalHoteisVinculados = categories.reduce((sum, c) => sum + (c.hotelsCount || 0), 0);

  // Filtragem
  const filteredCategories = useMemo(() => {
    return categories.filter(cat => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        cat.name.toLowerCase().includes(q) ||
        (cat.description && cat.description.toLowerCase().includes(q));
      
      const matchStatus = statusFilter === 'todos' || cat.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [categories, searchQuery, statusFilter]);

  return (
    <div className="bg-[#f8f9ff] min-h-screen p-4 md:p-8 text-slate-800 space-y-6">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div className="bg-[#d1fae5] border border-emerald-300 text-black px-5 py-3.5 rounded-xl shadow-lg flex items-center gap-3 font-semibold text-sm">
            <span className="material-symbols-outlined text-emerald-600 text-xl">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* TOPBAR / NAVEGAÇÃO DE RETORNO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBackToHoteis}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#003400] transition-colors cursor-pointer mb-2"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>Voltar para Gestão de Hotéis</span>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100/70 border border-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">category</span>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Categorias de Hotéis & Pousadas
              </h1>
              <p className="text-xs text-slate-500">
                Gerencie as classificações e tipos de hospedagem vinculados aos hotéis parceiros.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onNavigateToCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002600] text-xs sm:text-sm font-bold text-white shadow-xs transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Nova Categoria</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* KPI SECTION (4 CARDS)                                     */}
      {/* ========================================================= */}
      <section aria-label="Indicadores de Categorias" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total de Categorias</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined text-xl">category</span>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl md:text-3xl font-black text-slate-900">{totalCategorias}</span>
            <span className="text-xs text-slate-500 block font-medium mt-0.5">Cadastradas no sistema</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Categorias Ativas</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined text-xl">check_circle</span>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl md:text-3xl font-black text-emerald-700">{ativasCount}</span>
            <span className="text-xs text-slate-500 block font-medium mt-0.5">Disponíveis para seleção</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Hotéis Vinculados</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined text-xl">domain</span>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl md:text-3xl font-black text-blue-700">{totalHoteisVinculados}</span>
            <span className="text-xs text-slate-500 block font-medium mt-0.5">Propriedades categorizadas</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Categorias Inativas</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
              <span className="material-symbols-outlined text-xl">visibility_off</span>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl md:text-3xl font-black text-slate-700">{inativasCount}</span>
            <span className="text-xs text-slate-500 block font-medium mt-0.5">Ocultas do cadastro</span>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* BARRA DE FILTROS & PESQUISA                               */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <span className="material-symbols-outlined text-lg">search</span>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar categoria por nome ou descrição..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#003400] focus:bg-white transition-all font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#003400] cursor-pointer"
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">Apenas Ativas</option>
              <option value="inativo">Apenas Inativas</option>
            </select>

            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  viewMode === 'list' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                <span className="material-symbols-outlined text-sm">view_list</span>
                <span>Lista</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                <span className="material-symbols-outlined text-sm">grid_view</span>
                <span>Grade</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================= */}
      {/* LISTA / TABELA                                            */}
      {/* ========================================================= */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 animate-pulse">
          <span className="material-symbols-outlined text-4xl mb-2">sync</span>
          <p className="text-sm font-semibold">Carregando categorias de hotéis...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <span className="material-symbols-outlined text-2xl">category</span>
          </div>
          <h3 className="text-base font-bold text-slate-800">Nenhuma categoria encontrada</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery ? 'Tente ajustar os termos de busca ou filtros.' : 'Cadastre sua primeira categoria de hotel para começar.'}
          </p>
          <button
            type="button"
            onClick={onNavigateToCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#003400] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#002600] transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Cadastrar Categoria</span>
          </button>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                  <th className="py-4 px-4 text-center w-16">Ordem</th>
                  <th className="py-4 px-4 min-w-[220px]">Categoria / Tipo</th>
                  <th className="py-4 px-4 min-w-[260px]">Descrição</th>
                  <th className="py-4 px-4 text-center w-36">Hotéis Vinculados</th>
                  <th className="py-4 px-4 text-center w-28">Status</th>
                  <th className="py-4 px-4 text-right w-28">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredCategories.map((cat, idx) => (
                  <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="py-4 px-4 text-center text-xs font-semibold text-slate-400">
                      #{cat.order || idx + 1}
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-xl">{cat.icon || 'domain'}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">{cat.name}</span>
                          <span className="text-[11px] text-slate-400">ID: {cat.id}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 text-xs text-slate-600 font-medium">
                      {cat.description ? (
                        <p className="line-clamp-2 max-w-md">{cat.description}</p>
                      ) : (
                        <span className="text-slate-400 italic">Sem descrição detalhada</span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        {cat.hotelsCount || 0} {cat.hotelsCount === 1 ? 'hotel' : 'hotéis'}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        cat.status === 'ativo'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cat.status === 'ativo' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        {cat.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onNavigateToEdit(cat)}
                          className="w-8 h-8 rounded-lg bg-[#EA580C] hover:bg-orange-700 text-white shrink-0 flex items-center justify-center transition-colors shadow-2xs cursor-pointer active:scale-95"
                          title="Editar Categoria"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCategoryToDelete(cat)}
                          className="w-8 h-8 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white shrink-0 flex items-center justify-center transition-colors shadow-2xs cursor-pointer active:scale-95"
                          title="Excluir Categoria"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat, idx) => (
            <div key={cat.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-2xl">{cat.icon || 'domain'}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{cat.name}</h3>
                      <span className="text-[10px] text-slate-400 font-mono">#{cat.order || idx + 1}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    cat.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {cat.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {cat.description && (
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {cat.description}
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-700">
                  {cat.hotelsCount || 0} hotéis vinculados
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onNavigateToEdit(cat)}
                    className="w-8 h-8 rounded-lg bg-[#EA580C] hover:bg-orange-700 text-white flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                    title="Editar"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryToDelete(cat)}
                    className="w-8 h-8 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                    title="Excluir"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO                          */}
      {/* ========================================================= */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">Excluir Categoria</h3>
              <p className="text-xs text-slate-500">
                Tem certeza que deseja excluir a categoria <strong className="text-slate-800">"{categoryToDelete.name}"</strong>?
              </p>
              {categoryToDelete.hotelsCount && categoryToDelete.hotelsCount > 0 ? (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 mt-2">
                  Atenção: Existem <strong>{categoryToDelete.hotelsCount} hotéis</strong> vinculados a esta categoria. Eles manterão o nome registrado, mas a categoria não estará mais listada.
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ListagemCategoriasHotel;
