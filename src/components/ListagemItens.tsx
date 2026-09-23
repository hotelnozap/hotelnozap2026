import React, { useState, useEffect } from 'react';
import { itensQuartosService, RoomItemData } from '../services/supabaseService';

export type { RoomItemData };

export interface ListagemItensProps {
  onBack: () => void;
  onNavigateToCadastroItem?: () => void;
  onNavigateToEdit?: (item: RoomItemData) => void;
}

export const ListagemItens: React.FC<ListagemItensProps> = ({ 
  onBack, 
  onNavigateToCadastroItem,
  onNavigateToEdit 
}) => {
  const [items, setItems] = useState<RoomItemData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [viewMode, setViewMode] = useState<'lista' | 'grade'>('lista');

  // Modals / Item Operations State
  const [isNovoItemOpen, setIsNovoItemOpen] = useState(false);
  const [selectedItemForView, setSelectedItemForView] = useState<RoomItemData | null>(null);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<RoomItemData | null>(null);

  // New / Edit Form State
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('inventory_2');
  const [formStatus, setFormStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadData = () => {
    itensQuartosService.getItens().then(data => setItems(data || []));
  };

  useEffect(() => {
    loadData();
    window.addEventListener('hotel_novo_item_quarto', loadData);
    window.addEventListener('hotel_changed', loadData);

    const unsubscribe = itensQuartosService.subscribeItensQuartos
      ? itensQuartosService.subscribeItensQuartos(loadData)
      : () => {};

    return () => {
      window.removeEventListener('hotel_novo_item_quarto', loadData);
      window.removeEventListener('hotel_changed', loadData);
      unsubscribe();
    };
  }, []);

  // KPI Calculations
  const totalCount = items.length;
  const ativosCount = items.filter(i => i.status === 'ativo').length;
  const maisUsadosCount = items.filter(i => i.linkedRoomsCount >= 18).length;
  const inativosCount = items.filter(i => i.status === 'inativo').length;

  // Filtered List
  const filteredItems = items.filter(item => {
    if (statusFilter !== 'todos' && item.status !== statusFilter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q);
    }
    return true;
  });

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSaveNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;
    await itensQuartosService.createItem({
      name: formName,
      description: formDescription || 'Item de comodidade cadastrado no sistema.',
      icon: formIcon || 'inventory_2',
      status: formStatus,
    });
    setFormName('');
    setFormDescription('');
    setIsNovoItemOpen(false);
    showToast('Item cadastrado com sucesso!');
    loadData();
  };

  const handleSaveEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForEdit || !formName.trim()) return;

    const changes = {
      name: formName.trim(),
      description: formDescription.trim(),
      icon: formIcon,
      status: formStatus,
    };

    setItems(prev => prev.map(i => i.id === selectedItemForEdit.id ? { ...i, ...changes } : i));
    await itensQuartosService.updateItem(selectedItemForEdit.id, changes);
    setSelectedItemForEdit(null);
    showToast('Item atualizado com sucesso!');
    loadData();
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este item do catálogo?')) {
      setItems(prev => prev.filter(i => i.id !== id));
      await itensQuartosService.deleteItem(id);
      showToast('Item removido com sucesso!');
      loadData();
    }
  };

  const openEditModal = (item: RoomItemData) => {
    setSelectedItemForEdit(item);
    setFormName(item.name);
    setFormDescription(item.description);
    setFormIcon(item.icon);
    setFormStatus(item.status);
  };


  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12 font-['Inter']">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#d1fae5] border border-emerald-300 text-black font-bold px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-[#003400] text-xl">check_circle</span>
          <span className="text-sm text-black font-bold">{toastMessage}</span>
        </div>
      )}
      
      {/* NAVEGAÇÃO SUPERIOR */}
      <div>
        <button 
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#003400] hover:underline mb-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          <span>Voltar para o Mapa dos Quartos</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Itens dos Quartos</h1>
            <p className="text-sm text-slate-500 mt-1">Gerencie comodidades, móveis e acessórios inclusos nas acomodações.</p>
          </div>

          {/* BOTÕES DE AÇÃO TOPO */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => alert('Exportando catálogo de itens dos quartos em Excel...')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#FDB116] hover:bg-[#e59e0f] shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">file_download</span>
              <span>Exportar</span>
            </button>

            <button 
              onClick={() => {
                if (onNavigateToCadastroItem) {
                  onNavigateToCadastroItem();
                } else {
                  setFormName('');
                  setFormDescription('');
                  setFormIcon('inventory_2');
                  setFormStatus('ativo');
                  setIsNovoItemOpen(true);
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#003400] hover:bg-[#002800] shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              <span>Novo Item</span>
            </button>
          </div>
        </div>
      </div>

      {/* CARDS DE INDICADORES KPIS (CORES PASTEL DISTINTAS) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        
        {/* KPI 1 - TOTAL DE ITENS */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] sm:text-xs font-bold tracking-wider text-blue-700 uppercase">Total de Itens</span>
            <h3 className="text-2xl sm:text-3xl font-black text-blue-950 mt-1">{totalCount}</h3>
            <p className="text-[11px] sm:text-xs text-blue-600 mt-1 flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-sm">inventory_2</span>
              <span>Cadastrados no catálogo</span>
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl sm:text-2xl">check_box</span>
          </div>
        </div>

        {/* KPI 2 - ITENS ATIVOS */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] sm:text-xs font-bold tracking-wider text-emerald-700 uppercase">Itens Ativos</span>
            <h3 className="text-2xl sm:text-3xl font-black text-emerald-950 mt-1">{ativosCount}</h3>
            <p className="text-[11px] sm:text-xs text-emerald-600 mt-1 flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>Disponíveis para quartos</span>
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl sm:text-2xl">toggle_on</span>
          </div>
        </div>

        {/* KPI 3 - MAIS UTILIZADOS */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] sm:text-xs font-bold tracking-wider text-indigo-700 uppercase">Mais Utilizados</span>
            <h3 className="text-2xl sm:text-3xl font-black text-indigo-950 mt-1">{maisUsadosCount}</h3>
            <p className="text-[11px] sm:text-xs text-indigo-600 mt-1 flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-sm">hotel</span>
              <span>Em quase todos quartos</span>
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl sm:text-2xl">star</span>
          </div>
        </div>

        {/* KPI 4 - INATIVOS */}
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] sm:text-xs font-bold tracking-wider text-rose-700 uppercase">Inativos</span>
            <h3 className="text-2xl sm:text-3xl font-black text-rose-950 mt-1">{inativosCount}</h3>
            <p className="text-[11px] sm:text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-sm">pause_circle</span>
              <span>Ocultos no formulário</span>
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl sm:text-2xl">block</span>
          </div>
        </div>

      </div>

      {/* BARRA DE FILTROS E BUSCA */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        <div className="flex-1 w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Campo Busca */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome ou descrição do item..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>

          {/* Filtro Status */}
          <div className="w-full sm:w-48">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">Apenas Ativos</option>
              <option value="inativo">Apenas Inativos</option>
            </select>
          </div>

          {/* Botão Limpar Filtros */}
          {(statusFilter !== 'todos' || searchQuery) && (
            <button 
              onClick={() => {
                setStatusFilter('todos');
                setSearchQuery('');
              }}
              className="text-sm text-red-600 hover:text-red-800 font-semibold px-2 py-1 transition-colors cursor-pointer self-start sm:self-auto"
            >
              Limpar Filtros
            </button>
          )}
        </div>

        {/* ALTERNADOR LISTA E GRADE (DESKTOP) */}
        <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-end md:self-auto">
          <button 
            onClick={() => setViewMode('lista')}
            className={
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer " +
              (viewMode === 'lista' ? 'bg-white text-[#003400] shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900')
            }
          >
            <span className="material-symbols-outlined text-base">view_list</span>
            <span>Lista</span>
          </button>
          
          <button 
            onClick={() => setViewMode('grade')}
            className={
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer " +
              (viewMode === 'grade' ? 'bg-white text-[#003400] shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900')
            }
          >
            <span className="material-symbols-outlined text-base">grid_view</span>
            <span>Grade</span>
          </button>
        </div>

      </div>

      {/* DESKTOP TABLE VIEW (Visible on md:block in List View) */}
      {viewMode === 'lista' ? (
        <div className="hidden md:block bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Item / Nome</th>
                  <th className="py-3.5 px-5">Descrição</th>
                  <th className="py-3.5 px-5 text-center">Status</th>
                  <th className="py-3.5 px-5 text-center">Quartos Vinculados</th>
                  <th className="py-3.5 px-5 text-right pr-6">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 text-[#003400] flex items-center justify-center font-bold shrink-0">
                          <span className="material-symbols-outlined">{item.icon}</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-400">ID: {item.code}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-5 text-slate-600 max-w-xs truncate">
                      {item.description}
                    </td>

                    <td className="py-4 px-5 text-center">
                      <span className={
                        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold " +
                        (item.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600')
                      }>
                        ● {item.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>

                    <td className="py-4 px-5 text-center text-slate-700 font-medium">
                      {item.linkedRoomsCount} quartos
                    </td>

                    <td className="py-4 px-5 text-right pr-6">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setSelectedItemForView(item)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#2563EB] text-white hover:bg-blue-700 transition-colors shadow-xs cursor-pointer" 
                          title="Ver"
                        >
                          <span className="material-symbols-outlined text-base">visibility</span>
                        </button>

                        <button 
                          onClick={() => openEditModal(item)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#EA580C] text-white hover:bg-orange-700 transition-colors shadow-xs cursor-pointer" 
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>

                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#DC2626] text-white hover:bg-red-700 transition-colors shadow-xs cursor-pointer" 
                          title="Excluir"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      Nenhum item encontrado no catálogo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* RODAPÉ DA TABELA E PAGINAÇÃO */}
          <div className="px-6 py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              Exibindo <span className="font-semibold text-slate-700">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-semibold text-slate-700">{Math.min(currentPage * itemsPerPage, filteredItems.length)}</span> de <span className="font-semibold text-slate-700">{filteredItems.length}</span> itens cadastrados
            </p>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-medium cursor-pointer"
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    currentPage === page
                      ? 'bg-[#003400] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-medium cursor-pointer"
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* DESKTOP GRID VIEW */
        <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedItems.map(item => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-[#003400] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined">{item.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{item.name}</h3>
                    <span className="text-xs text-slate-400">ID: {item.code} • {item.linkedRoomsCount} quartos</span>
                  </div>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${item.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  ● {item.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
                {item.description}
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button 
                  onClick={() => setSelectedItemForView(item)}
                  className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
                >
                  Ver
                </button>
                <button 
                  onClick={() => openEditModal(item)}
                  className="px-3 py-1.5 rounded-lg bg-[#EA580C] text-white text-xs font-semibold hover:bg-orange-700 cursor-pointer"
                >
                  Editar
                </button>
                <button 
                  onClick={() => handleDeleteItem(item.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#DC2626] text-white text-xs font-semibold hover:bg-red-700 cursor-pointer"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MOBILE LIST VIEW (Visible on mobile md:hidden) */}
      <div className="space-y-3 md:hidden">
        {filteredItems.map((item) => (
          <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${item.status === 'ativo' ? 'bg-emerald-100 text-[#003400]' : 'bg-slate-200 text-slate-500'}`}>
                  <span className="material-symbols-outlined text-lg">{item.icon}</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 leading-tight">{item.name}</h3>
                  <span className="text-[10px] text-slate-400">ID: {item.code} • {item.linkedRoomsCount} quartos</span>
                </div>
              </div>

              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${item.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                ● {item.status === 'ativo' ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">
              {item.description}
            </p>

            {/* BOTÕES DE AÇÃO PADRONIZADOS MOBILE */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
              <button 
                onClick={() => setSelectedItemForView(item)}
                className="flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 shadow-xs cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">visibility</span>
                <span>Ver</span>
              </button>

              <button 
                onClick={() => openEditModal(item)}
                className="flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-semibold text-white bg-[#EA580C] hover:bg-orange-700 shadow-xs cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                <span>Editar</span>
              </button>

              <button 
                onClick={() => handleDeleteItem(item.id)}
                className="flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-semibold text-white bg-[#DC2626] hover:bg-red-700 shadow-xs cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span>Excluir</span>
              </button>
            </div>
          </div>
        ))}

        {/* Paginação Mobile */}
        <div className="flex items-center justify-between pt-3 text-xs text-slate-500">
          <span>1 a {filteredItems.length} de {items.length} itens</span>
          <div className="flex items-center gap-1">
            <button className="w-7 h-7 rounded-lg bg-[#003400] text-white font-bold flex items-center justify-center">1</button>
            <button className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center">2</button>
            <button className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: NOVO ITEM */}
      {isNovoItemOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Novo Item de Quarto</h3>
                <p className="text-xs text-slate-500">Adicione um novo item ao catálogo de comodidades.</p>
              </div>
              <button 
                onClick={() => setIsNovoItemOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveNewItem} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Item *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Cafeteira Nespresso"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#003400]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição</label>
                <textarea 
                  rows={3}
                  placeholder="Ex: Máquina de café expresso de cápsulas com 2 xícaras inclusas."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#003400]"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ícone Material</label>
                  <input 
                    type="text"
                    placeholder="Ex: coffee_maker"
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#003400]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select 
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#003400]"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 mt-2">
                <button 
                  type="button"
                  onClick={() => setIsNovoItemOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-[#003400] text-white hover:bg-[#002800] cursor-pointer shadow-sm"
                >
                  Salvar Item
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL: EDITAR ITEM */}
      {selectedItemForEdit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Editar Item</h3>
                <p className="text-xs text-slate-500">Altere informações do item {selectedItemForEdit.code}.</p>
              </div>
              <button 
                onClick={() => setSelectedItemForEdit(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEditItem} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Item *</label>
                <input 
                  type="text" 
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#003400]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição</label>
                <textarea 
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#003400]"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ícone</label>
                  <input 
                    type="text"
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#003400]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select 
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#003400]"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 mt-2">
                <button 
                  type="button"
                  onClick={() => setSelectedItemForEdit(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-[#EA580C] text-white hover:bg-orange-700 cursor-pointer shadow-sm"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL: VISUALIZAR DETALHES DO ITEM */}
      {selectedItemForView && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-2xl overflow-hidden flex flex-col my-auto">
            {/* Header Escuro Padrão #003400 */}
            <div className="px-5 py-4 flex items-center justify-between bg-[#003400] text-white shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center font-bold shadow-xs border border-white/20">
                  <span className="material-symbols-outlined text-xl">{selectedItemForView.icon}</span>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight">{selectedItemForView.name}</h3>
                  <span className="text-xs text-emerald-300 font-mono">ID: {selectedItemForView.code}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedItemForView(null)}
                type="button"
                aria-label="Fechar Modal"
                className="bg-[#b91c1c] text-white hover:bg-red-800 transition-colors p-1.5 rounded-xl shrink-0 flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4 text-sm">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Descrição Completa</span>
                <p className="text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {selectedItemForView.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Status</span>
                  <span className={`font-bold ${selectedItemForView.status === 'ativo' ? 'text-emerald-700' : 'text-slate-600'}`}>
                    ● {selectedItemForView.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Quartos Vinculados</span>
                  <span className="font-bold text-slate-900">{selectedItemForView.linkedRoomsCount} quartos</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedItemForView(null)}
                className="px-5 py-2 bg-[#b91c1c] hover:bg-red-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer active:scale-95 inline-flex items-center gap-1.5"
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

export default ListagemItens;
