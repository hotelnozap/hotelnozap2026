import React, { useState, useEffect, useMemo } from 'react';
import { destaquesQuartoService, DestaqueQuarto, cleanIconClass } from '../services/supabaseService';

export interface CadastroDestaquesQuartoProps {
  onBack: () => void;
}

export const CadastroDestaquesQuarto: React.FC<CadastroDestaquesQuartoProps> = ({ onBack }) => {
  const [destaquesList, setDestaquesList] = useState<DestaqueQuarto[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [viewMode, setViewMode] = useState<'lista' | 'grade'>('lista');

  // Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDestaqueForView, setSelectedDestaqueForView] = useState<DestaqueQuarto | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [destaqueToDelete, setDestaqueToDelete] = useState<DestaqueQuarto | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [formIcon, setFormIcon] = useState('bed');
  const [formIconColor, setFormIconColor] = useState('#6d28d9');
  const [formIconClass, setFormIconClass] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formOrder, setFormOrder] = useState<number>(1);
  const [formStatus, setFormStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);

  const MATERIAL_ICON_OPTIONS: { icon: string; label: string }[] = [
    { icon: 'bed', label: 'Cama' },
    { icon: 'king_bed', label: 'Cama King' },
    { icon: 'single_bed', label: 'Cama Solteiro' },
    { icon: 'group', label: 'Pessoas' },
    { icon: 'bathtub', label: 'Banheira' },
    { icon: 'shower', label: 'Chuveiro' },
    { icon: 'spa', label: 'Hidro' },
    { icon: 'waves', label: 'Vista / Mar' },
    { icon: 'ac_unit', label: 'Ar Condicionado' },
    { icon: 'wifi', label: 'Wi-Fi' },
    { icon: 'tv', label: 'Televisão' },
    { icon: 'kitchen', label: 'Cozinha' },
    { icon: 'local_bar', label: 'Frigobar' },
    { icon: 'pool', label: 'Piscina' },
    { icon: 'balcony', label: 'Varanda' },
    { icon: 'park', label: 'Natureza' },
    { icon: 'fireplace', label: 'Lareira' },
    { icon: 'pets', label: 'Pet Friendly' },
    { icon: 'free_breakfast', label: 'Café da Manhã' },
    { icon: 'local_parking', label: 'Estacionamento' },
    { icon: 'elevator', label: 'Elevador' },
    { icon: 'lock', label: 'Cofre' },
    { icon: 'iron', label: 'Passar Roupa' },
    { icon: 'room_service', label: 'Serviço de Quarto' },
  ];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const carregarDestaques = async () => {
    try {
      const data = await destaquesQuartoService.getDestaques();
      setDestaquesList(data || []);
    } catch (err) {
      console.error('Erro ao carregar destaques:', err);
    }
  };

  useEffect(() => {
    carregarDestaques();
    window.addEventListener('hotel_novo_destaque_quarto', carregarDestaques);
    window.addEventListener('hotel_quarto_destaques_atualizado', carregarDestaques);
    return () => {
      window.removeEventListener('hotel_novo_destaque_quarto', carregarDestaques);
      window.removeEventListener('hotel_quarto_destaques_atualizado', carregarDestaques);
    };
  }, []);

  // KPIs
  const totalCount = destaquesList.length;
  const ativosCount = destaquesList.filter((d) => d.status === 'ativo').length;
  const inativosCount = destaquesList.filter((d) => d.status === 'inativo').length;
  const maxOrder = destaquesList.reduce((max, d) => Math.max(max, d.order || 0), 0);

  // Filtros
  const filteredList = useMemo(() => {
    return [...destaquesList]
      .filter((d) => {
        if (statusFilter !== 'todos' && d.status !== statusFilter) return false;
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          const matchTitle = d.title.toLowerCase().includes(q);
          const matchSubtitle = (d.subtitle || '').toLowerCase().includes(q);
          const matchIcon = (d.icon || '').toLowerCase().includes(q);
          return matchTitle || matchSubtitle || matchIcon;
        }
        return true;
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [destaquesList, searchQuery, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const paginatedList = useMemo(() => {
    return filteredList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredList, currentPage, itemsPerPage]);

  const resetForm = () => {
    setIsEditMode(false);
    setEditingId(null);
    setFormIcon('bed');
    setFormIconColor('#6d28d9');
    setFormIconClass('');
    setFormTitle('');
    setFormSubtitle('');
    setFormOrder(destaquesList.length + 1);
    setFormStatus('ativo');
    setIsIconPickerOpen(false);
  };

  const handleOpenNovo = () => {
    resetForm();
    setIsFormModalOpen(true);
  };

  const handleOpenEditar = (d: DestaqueQuarto) => {
    setIsEditMode(true);
    setEditingId(d.id);
    setFormIcon(d.icon || 'bed');
    setFormIconColor(d.iconColor || '#6d28d9');
    setFormIconClass(d.iconClass || '');
    setFormTitle(d.title || '');
    setFormSubtitle(d.subtitle || '');
    setFormOrder(d.order || 1);
    setFormStatus(d.status || 'ativo');
    setIsIconPickerOpen(false);
    setIsFormModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('Por favor, informe o título do destaque.');
      return;
    }

    try {
      const cleanClass = cleanIconClass(formIconClass);
      if (isEditMode && editingId) {
        await destaquesQuartoService.updateDestaque(editingId, {
          icon: formIcon,
          iconColor: formIconColor,
          iconClass: cleanClass,
          title: formTitle.trim(),
          subtitle: formSubtitle.trim(),
          order: Number(formOrder) || 1,
          status: formStatus,
        });
        showToast('Destaque atualizado com sucesso!');
      } else {
        await destaquesQuartoService.createDestaque({
          icon: formIcon,
          iconColor: formIconColor,
          iconClass: cleanClass,
          title: formTitle.trim(),
          subtitle: formSubtitle.trim(),
          order: Number(formOrder) || destaquesList.length + 1,
          status: formStatus,
        });
        showToast('Novo destaque cadastrado com sucesso!');
      }
      await carregarDestaques();
      setIsFormModalOpen(false);
      resetForm();
    } catch (err) {
      console.error('Erro ao salvar destaque:', err);
      alert('Ocorreu um erro ao salvar o destaque.');
    }
  };

  const handleAskDelete = (d: DestaqueQuarto) => {
    setDestaqueToDelete(d);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!destaqueToDelete) return;
    try {
      await destaquesQuartoService.deleteDestaque(destaqueToDelete.id);
      showToast(`Destaque "${destaqueToDelete.title}" excluído com sucesso!`);
      await carregarDestaques();
    } catch (err) {
      console.error('Erro ao excluir destaque:', err);
      alert('Erro ao excluir destaque.');
    } finally {
      setIsDeleteModalOpen(false);
      setDestaqueToDelete(null);
    }
  };

  const handleToggleStatus = async (item: DestaqueQuarto) => {
    const newStatus = item.status === 'ativo' ? 'inativo' : 'ativo';
    try {
      await destaquesQuartoService.updateDestaque(item.id, { status: newStatus });
      showToast(`Destaque "${item.title}" ${newStatus === 'ativo' ? 'ativado' : 'pausado'} com sucesso!`);
      await carregarDestaques();
    } catch (err) {
      console.error('Erro ao alternar status do destaque:', err);
    }
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

      {/* NAVEGAÇÃO E HEADER SUPERIOR */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#003400] hover:underline mb-2.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          <span>Voltar para o Mapa dos Quartos</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#003400] text-[#B9CC01] flex items-center justify-center shadow-sm shrink-0">
              <span className="material-symbols-outlined text-2xl">grade</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Destaques da Acomodação
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Gerencie os cards com ícones e comodidades exibidos na página pública dos quartos.
              </p>
            </div>
          </div>

          {/* BOTÃO DE AÇÃO NO TOPO */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleOpenNovo}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#003400] hover:bg-[#002500] shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              <span>Novo Destaque</span>
            </button>
          </div>
        </div>
      </div>

      {/* CARDS DE INDICADORES (KPIS) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* KPI 1: Total */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] sm:text-xs font-bold tracking-wider text-blue-700 uppercase">
              Total Cadastrado
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-blue-950 mt-1">{totalCount}</h3>
            <p className="text-[11px] sm:text-xs text-blue-600 mt-1 flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-sm">grade</span>
              <span>Destaques no sistema</span>
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl sm:text-2xl">auto_awesome</span>
          </div>
        </div>

        {/* KPI 2: Ativos */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] sm:text-xs font-bold tracking-wider text-emerald-700 uppercase">
              Destaques Ativos
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-emerald-950 mt-1">{ativosCount}</h3>
            <p className="text-[11px] sm:text-xs text-emerald-600 mt-1 flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-sm">visibility</span>
              <span>Visíveis nas acomodações</span>
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl sm:text-2xl">check_circle</span>
          </div>
        </div>

        {/* KPI 3: Inativos */}
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] sm:text-xs font-bold tracking-wider text-rose-700 uppercase">
              Inativos / Ocultos
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-rose-950 mt-1">{inativosCount}</h3>
            <p className="text-[11px] sm:text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-sm">pause_circle</span>
              <span>Temporariamente pausados</span>
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl sm:text-2xl">block</span>
          </div>
        </div>

        {/* KPI 4: Ordem Máxima */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] sm:text-xs font-bold tracking-wider text-amber-800 uppercase">
              Prioridade / Ordem
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-amber-950 mt-1">#{maxOrder}</h3>
            <p className="text-[11px] sm:text-xs text-amber-700 mt-1 flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-sm">format_list_numbered</span>
              <span>Sequência de exibição</span>
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl sm:text-2xl">low_priority</span>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS E BUSCA */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex-1 w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Campo Busca */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, subtítulo ou ícone..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
            />
            {searchQuery && (
              <button
                type="button"
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
              type="button"
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
            type="button"
            onClick={() => setViewMode('lista')}
            className={
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ' +
              (viewMode === 'lista'
                ? 'bg-white text-[#003400] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900')
            }
          >
            <span className="material-symbols-outlined text-base">view_list</span>
            <span>Lista</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('grade')}
            className={
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ' +
              (viewMode === 'grade'
                ? 'bg-white text-[#003400] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900')
            }
          >
            <span className="material-symbols-outlined text-base">grid_view</span>
            <span>Grade</span>
          </button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL DE LISTAGEM */}
      {filteredList.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-3xl">grade</span>
          </div>
          <h3 className="text-base font-bold text-slate-800">Nenhum destaque encontrado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'todos'
              ? 'Nenhum resultado corresponde aos filtros selecionados. Tente limpar os filtros.'
              : 'Comece criando o primeiro destaque clicando no botão acima.'}
          </p>
          <button
            type="button"
            onClick={handleOpenNovo}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#003400] text-white rounded-xl text-xs font-semibold hover:bg-[#002500] cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>Cadastrar Destaque</span>
          </button>
        </div>
      ) : viewMode === 'lista' ? (
        /* VISUALIZAÇÃO 1: MODO LISTA (TABELA) */
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Ícone & Destaque</th>
                  <th className="py-3.5 px-5 hidden sm:table-cell">Subtítulo / Descrição</th>
                  <th className="py-3.5 px-5 text-center">Ordem</th>
                  <th className="py-3.5 px-5 text-center">Status</th>
                  <th className="py-3.5 px-5 text-right pr-6">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3.5">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs border border-slate-100"
                          style={{ backgroundColor: `${item.iconColor || '#6d28d9'}15` }}
                        >
                          {cleanIconClass(item.iconClass) ? (
                            <i
                              className={cleanIconClass(item.iconClass)}
                              style={{ color: item.iconColor || '#6d28d9', fontSize: '1.25rem' }}
                            />
                          ) : (
                            <span
                              className="material-symbols-outlined text-2xl"
                              style={{ color: item.iconColor || '#6d28d9' }}
                            >
                              {item.icon || 'bed'}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block leading-tight">{item.title}</span>
                          <span className="text-[11px] text-slate-400 font-mono sm:hidden block mt-0.5">
                            {item.subtitle || 'Sem subtítulo'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 hidden sm:table-cell text-slate-600 text-xs max-w-xs truncate">
                      {item.subtitle || '—'}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <span className="inline-block bg-slate-100 text-slate-700 font-mono text-xs font-bold px-2 py-0.5 rounded-md">
                        #{item.order || 1}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item)}
                        title={`Clique para ${item.status === 'ativo' ? 'pausar' : 'ativar'}`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                          item.status === 'ativo'
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.status === 'ativo' ? 'bg-emerald-600' : 'bg-slate-400'
                          }`}
                        />
                        {item.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="py-3.5 px-5 text-right pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedDestaqueForView(item)}
                          className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
                          title="Visualizar Detalhes"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditar(item)}
                          className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
                          title="Editar Destaque"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskDelete(item)}
                          className="w-8 h-8 rounded-lg bg-red-50 text-red-700 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
                          title="Excluir Destaque"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
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
        /* VISUALIZAÇÃO 2: MODO GRADE (CARDS) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedList.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-2xs border border-slate-100"
                    style={{ backgroundColor: `${item.iconColor || '#6d28d9'}15` }}
                  >
                    {cleanIconClass(item.iconClass) ? (
                      <i
                        className={cleanIconClass(item.iconClass)}
                        style={{ color: item.iconColor || '#6d28d9', fontSize: '1.5rem' }}
                      />
                    ) : (
                      <span
                        className="material-symbols-outlined text-3xl"
                        style={{ color: item.iconColor || '#6d28d9' }}
                      >
                        {item.icon || 'bed'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="bg-slate-100 text-slate-700 text-xs font-mono font-bold px-2 py-0.5 rounded">
                      #{item.order || 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(item)}
                      title="Clique para alternar o status"
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                        item.status === 'ativo'
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.status === 'ativo' ? 'bg-emerald-600' : 'bg-slate-400'
                        }`}
                      />
                      {item.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>
                </div>

                <h3 className="font-extrabold text-slate-900 text-base leading-tight mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2">
                  {item.subtitle || 'Destaque exclusivo da acomodação.'}
                </p>
              </div>

              <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400">
                  {item.iconClass ? item.iconClass : `Ícone: ${item.icon}`}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedDestaqueForView(item)}
                    className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
                    title="Visualizar"
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEditar(item)}
                    className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
                    title="Editar"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAskDelete(item)}
                    className="w-8 h-8 rounded-lg bg-red-50 text-red-700 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
                    title="Excluir"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PAGINAÇÃO */}
      {filteredList.length > 10 && (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 pt-4 mt-2 gap-3">
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">
              Exibindo página <span className="font-bold text-slate-800">{currentPage}</span> de{' '}
              <span className="font-bold text-slate-800">{totalPages}</span> ({filteredList.length} itens no total)
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Por página:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700 font-bold focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: CADASTRO / EDIÇÃO DE DESTAQUE */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
            {/* Header Modal */}
            <div className="bg-[#003400] text-white px-5 sm:px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#B9CC01]">
                  <span className="material-symbols-outlined text-xl">
                    {isEditMode ? 'edit' : 'add_circle'}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg leading-tight">
                    {isEditMode ? 'Editar Destaque da Acomodação' : 'Cadastrar Novo Destaque'}
                  </h3>
                  <p className="text-xs text-emerald-200/80">
                    Defina o ícone, título e ordem de exibição do card.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSave} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {/* Linha 1: Ícone, Cor e Ordem */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                {/* Seletor de Ícone Material */}
                <div className="sm:col-span-5 relative">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ícone Material *</label>
                  <button
                    type="button"
                    onClick={() => setIsIconPickerOpen(!isIconPickerOpen)}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5 hover:border-[#003400] transition-colors cursor-pointer"
                  >
                    <span
                      className="material-symbols-outlined text-xl shrink-0"
                      style={{ color: formIconColor || '#6d28d9' }}
                    >
                      {formIcon}
                    </span>
                    <span className="text-xs font-mono text-slate-800 flex-1 text-left truncate">
                      {formIcon}
                    </span>
                    <span className="material-symbols-outlined text-base text-slate-400">
                      {isIconPickerOpen ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>

                  {isIconPickerOpen && (
                    <div className="absolute z-30 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-2xl p-2.5 grid grid-cols-6 gap-1 max-h-56 overflow-y-auto animate-in fade-in">
                      {MATERIAL_ICON_OPTIONS.map((ic) => (
                        <button
                          key={ic.icon}
                          type="button"
                          onClick={() => {
                            setFormIcon(ic.icon);
                            setIsIconPickerOpen(false);
                          }}
                          className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                            formIcon === ic.icon
                              ? 'bg-emerald-100 ring-2 ring-[#003400] scale-105'
                              : 'hover:bg-slate-100 text-slate-600'
                          }`}
                          title={ic.label}
                        >
                          <span
                            className="material-symbols-outlined text-lg"
                            style={{ color: formIconColor || '#6d28d9' }}
                          >
                            {ic.icon}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cor do Ícone */}
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cor do Ícone</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formIconColor || '#6d28d9'}
                      onChange={(e) => setFormIconColor(e.target.value)}
                      className="w-11 h-11 rounded-xl border border-slate-200 bg-white cursor-pointer p-1 shrink-0"
                    />
                    <input
                      type="text"
                      value={formIconColor || '#6d28d9'}
                      onChange={(e) => setFormIconColor(e.target.value)}
                      placeholder="#6d28d9"
                      className="flex-1 h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-[#003400]/20"
                    />
                  </div>
                </div>

                {/* Ordem */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ordem</label>
                  <input
                    type="number"
                    min="1"
                    value={formOrder}
                    onChange={(e) => setFormOrder(Number(e.target.value) || 1)}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 text-center font-bold focus:outline-none focus:ring-2 focus:ring-[#003400]/20"
                  />
                </div>
              </div>

              {/* Classe CSS Opcional */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Classe CSS do Ícone <span className="text-slate-400 font-normal">(Opcional: FontAwesome, RemixIcon, etc.)</span>
                  </label>
                  {formIconClass && (
                    <button
                      type="button"
                      onClick={() => setFormIconClass('')}
                      className="text-[10px] text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      Limpar classe
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={formIconClass}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.includes('<') || val.includes('class=')) {
                      setFormIconClass(cleanIconClass(val));
                    } else {
                      setFormIconClass(val);
                    }
                  }}
                  onBlur={() => setFormIconClass(cleanIconClass(formIconClass))}
                  placeholder="Ex: fa-regular fa-chess-rook ou ri-hotel-bed-line"
                  className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  💡 <strong>Dica:</strong> Você pode colar a tag HTML inteira (ex: <code className="text-slate-600 bg-slate-100 px-1 py-0.5 rounded font-mono">&lt;i class="fa-regular fa-chess-rook"&gt;&lt;/i&gt;</code>) ou apenas os nomes das classes.
                </p>
              </div>

              {/* Título e Subtítulo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Título do Destaque *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ex: Cama King Size, Ar Split"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subtítulo / Detalhe</label>
                  <input
                    type="text"
                    value={formSubtitle}
                    onChange={(e) => setFormSubtitle(e.target.value)}
                    placeholder="Ex: Lençóis 400 fios, Inverter silencioso"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status de Exibição</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20"
                >
                  <option value="ativo">Ativo (Exibido nas páginas dos quartos)</option>
                  <option value="inativo">Inativo (Oculto no catálogo)</option>
                </select>
              </div>

              {/* PRÉVIA DO CARD AO VIVO */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Prévia em Tempo Real (como o hóspede verá)
                </label>
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-slate-200/60 shadow-2xs"
                    style={{ backgroundColor: `${formIconColor || '#6d28d9'}15` }}
                  >
                    {cleanIconClass(formIconClass) ? (
                      <i
                        className={cleanIconClass(formIconClass)}
                        style={{ color: formIconColor || '#6d28d9', fontSize: '1.5rem' }}
                      />
                    ) : (
                      <span
                        className="material-symbols-outlined text-3xl"
                        style={{ color: formIconColor || '#6d28d9' }}
                      >
                        {formIcon || 'bed'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {formTitle || 'Título do Destaque'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {formSubtitle || 'Subtítulo explicativo'}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600 font-bold">
                    #{formOrder}
                  </span>
                </div>
              </div>

              {/* Botões do Modal */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#003400] hover:bg-[#002500] shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  {isEditMode ? 'Atualizar Destaque' : 'Cadastrar Destaque'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VISUALIZAÇÃO RÁPIDA */}
      {selectedDestaqueForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Detalhes do Destaque
              </span>
              <button
                type="button"
                onClick={() => setSelectedDestaqueForView(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-slate-200"
                  style={{ backgroundColor: `${selectedDestaqueForView.iconColor || '#6d28d9'}20` }}
                >
                  {cleanIconClass(selectedDestaqueForView.iconClass) ? (
                    <i
                      className={cleanIconClass(selectedDestaqueForView.iconClass)}
                      style={{ color: selectedDestaqueForView.iconColor || '#6d28d9', fontSize: '1.75rem' }}
                    />
                  ) : (
                    <span
                      className="material-symbols-outlined text-4xl"
                      style={{ color: selectedDestaqueForView.iconColor || '#6d28d9' }}
                    >
                      {selectedDestaqueForView.icon || 'bed'}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">{selectedDestaqueForView.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedDestaqueForView.subtitle || 'Sem subtítulo cadastrado'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Ordem de Exibição</span>
                  <span className="font-mono font-bold text-slate-800 text-sm mt-0.5 block">
                    #{selectedDestaqueForView.order || 1}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Status Atual</span>
                  <span
                    className={`font-bold text-xs mt-0.5 inline-block ${
                      selectedDestaqueForView.status === 'ativo' ? 'text-emerald-700' : 'text-slate-600'
                    }`}
                  >
                    {selectedDestaqueForView.status === 'ativo' ? 'Ativo (Visível)' : 'Inativo (Oculto)'}
                  </span>
                </div>
              </div>

              {selectedDestaqueForView.iconClass && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs font-mono">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">
                    Classe CSS Customizada
                  </span>
                  <span className="text-slate-700 select-all">{cleanIconClass(selectedDestaqueForView.iconClass)}</span>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const d = selectedDestaqueForView;
                  setSelectedDestaqueForView(null);
                  handleOpenEditar(d);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#003400] hover:underline cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                <span>Editar este Destaque</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDestaqueForView(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRMAÇÃO DE EXCLUSÃO */}
      {isDeleteModalOpen && destaqueToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 flex items-center gap-3 border-b border-red-100 bg-red-50">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">delete_forever</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-red-900">Excluir Destaque</h3>
                <p className="text-xs text-red-700/80">Esta ação é irreversível</p>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tem certeza que deseja excluir permanentemente o destaque abaixo?
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-slate-200"
                  style={{ backgroundColor: `${destaqueToDelete.iconColor || '#6d28d9'}20` }}
                >
                  <span
                    className="material-symbols-outlined text-2xl"
                    style={{ color: destaqueToDelete.iconColor || '#6d28d9' }}
                  >
                    {destaqueToDelete.icon || 'bed'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 text-sm truncate">{destaqueToDelete.title}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {destaqueToDelete.subtitle || 'Sem subtítulo'}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-100">
                O destaque deixará de ser exibido em todas as acomodações vinculadas.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2.5 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDestaqueToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer border border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span>Excluir Destaque</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CadastroDestaquesQuarto;
