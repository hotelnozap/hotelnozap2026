import React, { useState, useEffect, useMemo } from 'react';
import { tiposQuartosService } from '../services/supabaseService';

export interface RoomTypeData {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  capacity: number;
  bedConfig: string;
  dailyPrice?: number;
  linkedRoomsCount: number;
  status: 'ativo' | 'inativo';
}

export interface ListagemTiposQuartosProps {
  onBack: () => void;
  onNavigateToNovoTipo?: () => void;
}

const INITIAL_ROOM_TYPES: RoomTypeData[] = [];

export const ListagemTiposQuartos: React.FC<ListagemTiposQuartosProps> = ({
  onBack,
  onNavigateToNovoTipo,
}) => {
  const [types, setTypes] = useState<RoomTypeData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [viewMode, setViewMode] = useState<'lista' | 'grade'>('lista');

  const loadData = () => {
    tiposQuartosService.getTiposQuartos().then(data => {
      setTypes(data || []);
    });
  };

  useEffect(() => {
    loadData();
    window.addEventListener('hotel_novo_tipo_quarto', loadData);
    window.addEventListener('hotel_changed', loadData);

    const unsubscribe = tiposQuartosService.subscribeTiposQuartos
      ? tiposQuartosService.subscribeTiposQuartos(loadData)
      : () => {};

    return () => {
      window.removeEventListener('hotel_novo_tipo_quarto', loadData);
      window.removeEventListener('hotel_changed', loadData);
      unsubscribe();
    };
  }, []);

  // Modals state
  const [selectedTypeForView, setSelectedTypeForView] = useState<RoomTypeData | null>(null);
  const [selectedTypeForEdit, setSelectedTypeForEdit] = useState<RoomTypeData | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<RoomTypeData | null>(null);
  const [isNovaModalOpen, setIsNovaModalOpen] = useState(false);

  // Form states for New / Edit
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'bed',
    capacity: 2,
    bedConfig: '',
    status: 'ativo' as 'ativo' | 'inativo',
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filtered Types
  const filteredTypes = useMemo(() => {
    return types.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'todos' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [types, searchQuery, statusFilter]);

  // KPIs Calculations
  const totalTypes = types.length;
  const activeTypes = types.filter((t) => t.status === 'ativo').length;
  const totalLinkedRooms = types.reduce((acc, curr) => acc + curr.linkedRoomsCount, 0);

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    await tiposQuartosService.createTipoQuarto({
      name: formData.name,
      description: formData.description || 'Sem descrição cadastrada.',
      icon: formData.icon,
      capacity: formData.capacity,
      bedConfig: formData.bedConfig || `${formData.capacity} pessoas`,
      dailyPrice: 0,
      status: formData.status,
    });

    setIsNovaModalOpen(false);
    showToast('Novo Tipo de Quarto cadastrado com sucesso!');
    resetForm();
    loadData();
  };

  const handleUpdateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTypeForEdit || !formData.name.trim()) return;

    const changes = {
      name: formData.name.trim(),
      description: formData.description,
      icon: formData.icon,
      capacity: formData.capacity,
      bedConfig: formData.bedConfig,
      dailyPrice: 0,
      status: formData.status,
    };

    setTypes(prev => prev.map(t => t.id === selectedTypeForEdit.id ? { ...t, ...changes } : t));
    await tiposQuartosService.updateTipoQuarto(selectedTypeForEdit.id, changes);

    setSelectedTypeForEdit(null);
    showToast('Tipo de Quarto atualizado com sucesso!');
    resetForm();
    loadData();
  };

  const handleDeleteType = async () => {
    if (!typeToDelete) return;
    setTypes(prev => prev.filter(t => t.id !== typeToDelete.id));
    await tiposQuartosService.deleteTipoQuarto(typeToDelete.id);
    setTypeToDelete(null);
    showToast('Tipo de Quarto removido com sucesso!');
    loadData();
  };

  const openEditModal = (t: RoomTypeData) => {
    setSelectedTypeForEdit(t);
    setFormData({
      name: t.name,
      description: t.description,
      icon: t.icon,
      capacity: t.capacity,
      bedConfig: t.bedConfig,
      status: t.status,
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      icon: 'bed',
      capacity: 2,
      bedConfig: '',
      status: 'ativo',
    });
  };

  return (
    <div className="bg-[#f8f9ff] min-h-screen p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 pb-24 sm:pb-12">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#d1fae5] border border-emerald-300 text-black font-bold px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-[#003400] text-xl">check_circle</span>
          <span className="text-sm text-black font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Voltar Link & Header */}
      <div>
        <button
          onClick={onBack}
          type="button"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#003400] hover:text-emerald-950 transition-colors cursor-pointer mb-2"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Voltar para o Mapa dos Quartos
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Tipos de Quartos
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Gerencie as modalidades, capacidades, camas e tarifas de acomodação do hotel.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                resetForm();
                if (onNavigateToNovoTipo) {
                  onNavigateToNovoTipo();
                } else {
                  setIsNovaModalOpen(true);
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Novo Tipo de Quarto
            </button>
          </div>
        </div>
      </div>

      {/* 3 Cards KPIs Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Total de Tipos */}
        <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-800">
              Total de Tipos
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <span className="material-symbols-outlined text-[18px] sm:text-[20px]">meeting_room</span>
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{totalTypes}</div>
            <p className="text-[10px] sm:text-xs text-blue-700 font-medium mt-0.5">Modalidades ativas no sistema</p>
          </div>
        </div>

        {/* Tipos Ativos */}
        <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-800">
              Tipos Ativos
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <span className="material-symbols-outlined text-[18px] sm:text-[20px]">check_circle</span>
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{activeTypes}</div>
            <p className="text-[10px] sm:text-xs text-emerald-700 font-medium mt-0.5">Disponíveis para reservas</p>
          </div>
        </div>

        {/* Quartos Vinculados */}
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-800">
              Quartos Vinculados
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
              <span className="material-symbols-outlined text-[18px] sm:text-[20px]">door_front</span>
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{totalLinkedRooms}</div>
            <p className="text-[10px] sm:text-xs text-indigo-700 font-medium mt-0.5">Acomodações no mapa</p>
          </div>
        </div>
      </div>

      {/* Busca e Filtros Mobile */}
      <div className="flex items-center gap-2 sm:hidden">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou código..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#003400] text-slate-800 placeholder-slate-400 shadow-xs"
          />
        </div>
        <div className="relative shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'todos' | 'ativo' | 'inativo')}
            className="appearance-none bg-white border border-slate-200 text-slate-700 py-2 pl-3 pr-8 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#003400] cursor-pointer shadow-xs"
          >
            <option value="todos">Todos Status</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
          <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[16px]">expand_more</span>
        </div>
      </div>

      {/* LISTA DE CARDS MOBILE (Exibida em sm:hidden) */}
      <div className="space-y-3 sm:hidden">
        {filteredTypes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-400">
            Nenhum tipo de quarto encontrado.
          </div>
        ) : (
          filteredTypes.map((t) => (
            <div key={t.id} className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs space-y-2.5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center font-bold text-sm shrink-0 border border-violet-100">
                    <span className="material-symbols-outlined text-[20px]">{t.icon}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 block tracking-wider">{t.code}</span>
                    <h3 className="font-bold text-sm text-slate-900">{t.name}</h3>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  t.status === 'ativo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${t.status === 'ativo' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                  {t.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              
              <p className="text-xs text-slate-500 line-clamp-2">{t.description}</p>

              <div className="pt-2 border-t border-slate-100 text-xs">
                <span className="text-[10px] text-slate-400 block">Capacidade / Camas</span>
                <span className="font-medium text-slate-700">{t.capacity} {t.capacity === 1 ? 'pessoa' : 'pessoas'} • {t.bedConfig}</span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                <button
                  onClick={() => setSelectedTypeForView(t)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">visibility</span> Ver
                </button>
                <button
                  onClick={() => openEditModal(t)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FDB116] hover:bg-amber-500 text-white rounded text-xs font-medium transition-colors shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span> Editar
                </button>
                <button
                  onClick={() => setTypeToDelete(t)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span> Excluir
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CONTAINER DESKTOP (TOOLBAR, TABELA E GRADE DESKTOP) */}
      <div className="hidden sm:block bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        
        {/* Barra de Filtros e Alternador Lista/Grade Desktop */}
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Campo de Busca */}
            <div className="relative w-full sm:max-w-xs flex-1">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[20px]">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, descrição ou código..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003400] text-slate-800 placeholder-slate-400"
              />
            </div>

            {/* Filtro de Status */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'todos' | 'ativo' | 'inativo')}
                className="appearance-none bg-white border border-slate-200 text-slate-700 py-2 pl-3.5 pr-9 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003400] cursor-pointer"
              >
                <option value="todos">Todos os Status</option>
                <option value="ativo">Ativos</option>
                <option value="inativo">Inativos</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
            </div>

            {(searchQuery || statusFilter !== 'todos') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('todos');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
                Limpar Filtros
              </button>
            )}
          </div>

          {/* Alternador Lista/Grade Desktop */}
          <div className="flex items-center gap-2.5 justify-end">
            <div className="inline-flex border border-slate-200 rounded-xl p-1 bg-slate-100">
              <button
                onClick={() => setViewMode('lista')}
                title="Visualização em Lista"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'lista'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">format_list_bulleted</span>
              </button>
              <button
                onClick={() => setViewMode('grade')}
                title="Visualização em Grade"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grade'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">grid_view</span>
              </button>
            </div>
          </div>
        </div>

        {/* VISUALIZAÇÃO 1: MODO LISTA (TABELA DESKTOP) */}
        {viewMode === 'lista' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Código</th>
                  <th scope="col" className="px-4 py-3.5">Tipo de Quarto</th>
                  <th scope="col" className="px-4 py-3.5">Capacidade & Camas</th>
                  <th scope="col" className="px-4 py-3.5">Quartos Vinculados</th>
                  <th scope="col" className="px-4 py-3.5">Status</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTypes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-sm">
                      Nenhum tipo de quarto encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredTypes.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-xs text-slate-400 whitespace-nowrap">
                        {t.code}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center font-bold shrink-0 border border-violet-100">
                            <span className="material-symbols-outlined text-[20px]">{t.icon}</span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{t.name}</span>
                            <span className="text-xs text-slate-400 line-clamp-1 max-w-xs">{t.description}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 text-xs flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-slate-400">group</span>
                            {t.capacity} {t.capacity === 1 ? 'pessoa' : 'pessoas'}
                          </span>
                          <span className="text-[11px] text-slate-500">{t.bedConfig}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <span className="material-symbols-outlined text-[14px] text-slate-500">meeting_room</span>
                          {t.linkedRoomsCount} {t.linkedRoomsCount === 1 ? 'quarto' : 'quartos'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                          t.status === 'ativo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${t.status === 'ativo' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          {t.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => setSelectedTypeForView(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span> Ver
                          </button>
                          <button
                            onClick={() => openEditModal(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#FDB116] hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span> Editar
                          </button>
                          <button
                            onClick={() => setTypeToDelete(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span> Excluir
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
          /* VISUALIZAÇÃO 2: MODO GRADE (CARDS DESKTOP 3 COLUNAS) */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTypes.map((t) => (
              <div key={t.id} className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-3 flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center font-bold shrink-0 border border-violet-100">
                        <span className="material-symbols-outlined text-xl">{t.icon}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono font-bold text-slate-400 block">{t.code}</span>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">{t.name}</h3>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      t.status === 'ativo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {t.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-2.5 line-clamp-2">{t.description}</p>

                  <div className="mt-3 pt-3 border-t border-slate-100 text-xs">
                    <span className="text-[10px] text-slate-400 block uppercase">Capacidade</span>
                    <span className="font-semibold text-slate-700">{t.capacity} pessoas</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => setSelectedTypeForView(t)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span> Ver
                  </button>
                  <button
                    onClick={() => openEditModal(t)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#FDB116] hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span> Editar
                  </button>
                  <button
                    onClick={() => setTypeToDelete(t)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span> Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1: VER DETALHES (PADRÃO 100% SISTEMA COM HEADER #003400 E BOTÃO FECHAR VERMELHO) */}
      {selectedTypeForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header Verde Escuro #003400 */}
            <div className="bg-[#003400] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-xl">{selectedTypeForView.icon}</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg">{selectedTypeForView.name}</h3>
                  <span className="text-xs text-emerald-300 font-mono font-bold">{selectedTypeForView.code}</span>
                </div>
              </div>

              {/* Botão Fechar X no topo em Vermelho #b91c1c */}
              <button
                onClick={() => setSelectedTypeForView(null)}
                className="bg-[#b91c1c] hover:bg-red-800 text-white p-1.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs sm:text-sm">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Descrição Completa</span>
                <p className="text-slate-700 font-medium leading-relaxed">{selectedTypeForView.description}</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Capacidade Máxima</span>
                <span className="font-extrabold text-slate-900 text-base">{selectedTypeForView.capacity} Hóspedes</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Configuração de Camas</span>
                <span className="font-semibold text-slate-800">{selectedTypeForView.bedConfig}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">Quartos Vinculados no Mapa:</span>
                <span className="font-bold text-slate-900">{selectedTypeForView.linkedRoomsCount} quartos</span>
              </div>
            </div>

            {/* Rodapé com Botão Fechar em Vermelho #b91c1c Alinhado à Direita */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedTypeForView(null)}
                className="px-5 py-2 bg-[#b91c1c] hover:bg-red-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-base">close</span>
                <span>Fechar</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: NOVO / EDITAR TIPO DE QUARTO */}
      {(isNovaModalOpen || selectedTypeForEdit) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-lg">meeting_room</span>
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  {selectedTypeForEdit ? 'Editar Tipo de Quarto' : 'Novo Tipo de Quarto'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsNovaModalOpen(false);
                  setSelectedTypeForEdit(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={selectedTypeForEdit ? handleUpdateType : handleCreateType} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome do Tipo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Suíte Presidencial, Chalé..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003400]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Descrição / Diferenciais
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalhes sobre a vista, enxoval, sacada ou comodidades..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003400]"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Capacidade *
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003400]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Configuração de Camas
                </label>
                <input
                  type="text"
                  value={formData.bedConfig}
                  onChange={(e) => setFormData({ ...formData, bedConfig: e.target.value })}
                  placeholder="Ex: 1 Cama King + 1 Solteiro"
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003400]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ativo' | 'inativo' })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003400]"
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsNovaModalOpen(false);
                    setSelectedTypeForEdit(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#003400] hover:bg-emerald-950 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>Salvar</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 3: EXCLUIR TIPO DE QUARTO */}
      {typeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Excluir Tipo de Quarto?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Deseja realmente excluir <strong>{typeToDelete.name}</strong>? Esta ação não poderá ser desfeita.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setTypeToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteType}
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

export default ListagemTiposQuartos;
