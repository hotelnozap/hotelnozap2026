import React, { useState, useEffect, useMemo } from 'react';
import {
  maskCpfCnpj,
  maskPhone,
  isValidCpf,
  isValidCnpj,
  getCpfCnpjValidationStatus
} from '../utils/masks';
import { hospedesService, currentHotelService } from '../services/supabaseService';
import { ModalConfirmacaoExclusao } from './ModalConfirmacaoExclusao';

export interface GuestData {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  lastStay: string;
  cidadeOrigem?: string;
  placaVeiculo?: string;
  status: 'ativo' | 'inativo';
}

export interface ListagemHospedesProps {
  onNavigateToNovoHospede?: () => void;
  onNavigateToDashboard?: () => void;
}

const INITIAL_GUESTS: GuestData[] = [];

export const ListagemHospedes: React.FC<ListagemHospedesProps> = ({ onNavigateToNovoHospede, onNavigateToDashboard }) => {
  const [guests, setGuests] = useState<GuestData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [dateFilter, setDateFilter] = useState('');
  const [viewMode, setViewMode] = useState<'lista' | 'grade'>('lista');

  // Obtém o hotel ativo para filtrar apenas os hóspedes do hotel logado
  const currentHotelId = currentHotelService.getCurrentHotel().id;

  const fetchGuests = async () => {
    try {
      const data = await hospedesService.getHospedes(currentHotelId);
      setGuests(data || []);
    } catch (err) {
      console.error('Erro ao buscar hóspedes:', err);
    }
  };

  useEffect(() => {
    fetchGuests();

    const handleNovoHospede = () => {
      fetchGuests();
    };

    window.addEventListener('hotel_novo_hospede', handleNovoHospede);
    window.addEventListener('hotel_changed', handleNovoHospede);

    const unsubscribe = hospedesService.subscribeHospedes
      ? hospedesService.subscribeHospedes(fetchGuests)
      : () => {};

    return () => {
      window.removeEventListener('hotel_novo_hospede', handleNovoHospede);
      window.removeEventListener('hotel_changed', handleNovoHospede);
      unsubscribe();
    };
  }, []);

  // Modals state
  const [selectedGuestForView, setSelectedGuestForView] = useState<GuestData | null>(null);
  const [selectedGuestForEdit, setSelectedGuestForEdit] = useState<GuestData | null>(null);
  const [guestToDelete, setGuestToDelete] = useState<GuestData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNovoModalOpen, setIsNovoModalOpen] = useState(false);

  // New / Edit Form State
  const [formName, setFormName] = useState('');
  const [formCpf, setFormCpf] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formStatus, setFormStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const formCpfValidation = useMemo(() => getCpfCnpjValidationStatus(formCpf), [formCpf]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // KPIs
  const totalHospedes = guests.length;
  const hospedesAtivos = guests.filter(g => g.status === 'ativo').length;
  const checkinsDia = 0;
  const checkoutsPendentes = 0;

  // Filtered List
  const filteredGuests = guests.filter(g => {
    if (statusFilter !== 'todos' && g.status !== statusFilter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const nameMatch = g.name.toLowerCase().includes(q);
      const cpfMatch = g.cpfCnpj.toLowerCase().includes(q);
      const emailMatch = g.email.toLowerCase().includes(q);
      return nameMatch || cpfMatch || emailMatch;
    }
    return true;
  });

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredGuests.length / itemsPerPage) || 1;
  const paginatedGuests = filteredGuests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleConfirmDelete = async () => {
    if (!guestToDelete) return;
    setIsDeleting(true);
    try {
      const ok = await hospedesService.deleteHospede(guestToDelete.id);
      if (ok) {
        showToast('Hóspede removido com sucesso.');
        setGuests(prev => prev.filter(g => g.id !== guestToDelete.id));
        fetchGuests();
      } else {
        showToast('Erro ao remover hóspede.');
      }
    } catch (err) {
      console.error('Erro ao excluir hóspede:', err);
      showToast('Erro ao remover hóspede.');
    } finally {
      setIsDeleting(false);
      setGuestToDelete(null);
    }
  };

  const handleOpenEdit = (g: GuestData) => {
    setSelectedGuestForEdit(g);
    setFormName(g.name);
    setFormCpf(g.cpfCnpj);
    setFormEmail(g.email);
    setFormPhone(maskPhone(g.phone));
    setFormStatus(g.status);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGuestForEdit || !formName) return;

    if (formCpf.trim()) {
      const clean = formCpf.replace(/\D/g, '');
      if (clean.length <= 11) {
        if (!isValidCpf(formCpf)) {
          showToast('O CPF digitado é falso ou inválido! Digite um CPF autêntico.');
          return;
        }
      } else {
        if (!isValidCnpj(formCpf)) {
          showToast('O CNPJ digitado é inválido! Verifique os dígitos.');
          return;
        }
      }
    }

    const updatedChanges = {
      name: formName,
      cpfCnpj: formCpf,
      email: formEmail,
      phone: formPhone,
      status: formStatus,
    };

    setGuests(guests.map(g => {
      if (g.id === selectedGuestForEdit.id) {
        return {
          ...g,
          ...updatedChanges
        };
      }
      return g;
    }));

    await hospedesService.updateHospede(selectedGuestForEdit.id, updatedChanges);
    showToast('Hóspede atualizado com sucesso!');
    setSelectedGuestForEdit(null);
  };

  const handleSaveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;

    if (formCpf.trim()) {
      const clean = formCpf.replace(/\D/g, '');
      if (clean.length <= 11) {
        if (!isValidCpf(formCpf)) {
          showToast('O CPF digitado é falso ou inválido! Digite um CPF autêntico.');
          return;
        }
      } else {
        if (!isValidCnpj(formCpf)) {
          showToast('O CNPJ digitado é inválido! Verifique os dígitos.');
          return;
        }
      }
    }

    const result = await hospedesService.createHospedeFull({
      nome: formName,
      email: formEmail || `${formName.toLowerCase().replace(/[^a-z0-9]/g, '')}@hospede.com.br`,
      cpf_passaporte: formCpf,
      telefone: formPhone,
      status: formStatus
    });

    if (result.success) {
      showToast('Hóspede cadastrado com sucesso!');
      setIsNovoModalOpen(false);
      setFormName('');
      setFormCpf('');
      setFormEmail('');
      setFormPhone('');
      fetchGuests();
    } else {
      showToast('Erro ao salvar hóspede.');
    }
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
      
      {/* HEADER PRINCIPAL (DESKTOP E MOBILE) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Listagem de Hóspedes</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie e visualize as informações de todos os hóspedes do hotel.</p>
        </div>

        {/* BOTÕES DESKTOP */}
        <div className="hidden sm:flex items-center gap-3">
          <button 
            onClick={() => alert('Importando lista de hóspedes...')}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-sm transition-all text-white bg-[#2563EB] hover:bg-[#1d4ed8] cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">upload</span>
            <span>Importar</span>
          </button>

          <button 
            onClick={() => alert('Exportando cadastro de hóspedes...')}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-sm transition-all text-[#1F2937] bg-[#FDB116] hover:bg-[#eab308] cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">download</span>
            <span>Exportar</span>
          </button>

          <button 
            onClick={() => {
              if (onNavigateToNovoHospede) {
                onNavigateToNovoHospede();
              } else {
                setFormName('');
                setFormCpf('');
                setFormEmail('');
                setFormPhone('');
                setFormStatus('ativo');
                setIsNovoModalOpen(true);
              }
            }}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm shadow-sm transition-all text-white bg-[#000000] hover:bg-[#0b1c30] cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">person_add</span>
            <span>Cadastrar Novo Hóspede</span>
          </button>
        </div>

        {/* BOTÕES MOBILE GRID 2X2 */}
        <div className="grid grid-cols-2 gap-2 sm:hidden w-full">
          <button 
            onClick={() => {
              if (onNavigateToNovoHospede) {
                onNavigateToNovoHospede();
              } else {
                setIsNovoModalOpen(true);
              }
            }}
            className="w-full py-2.5 px-3 bg-[#000000] hover:bg-[#0b1c30] text-white rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span className="truncate">Novo Hóspede</span>
          </button>

          <button 
            onClick={() => alert('Novo Grupo de Hóspedes...')}
            className="w-full py-2.5 px-3 bg-[#10B981] hover:bg-[#059669] text-white rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-base">group_add</span>
            <span className="truncate">Novo Grupo</span>
          </button>

          <button 
            onClick={() => alert('Importando lista de hóspedes...')}
            className="w-full py-2 px-3 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-base">upload</span>
            <span>Importar</span>
          </button>

          <button 
            onClick={() => alert('Exportando cadastro de hóspedes...')}
            className="w-full py-2 px-3 bg-[#FDB116] hover:bg-[#eab308] text-[#1F2937] rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* CARDS DE INDICADORES KPIS (BENTO GRID - MOBILE & DESKTOP) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* KPI 1 - TOTAL DE HÓSPEDES */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-blue-700 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Total de Hóspedes</span>
            <span className="material-symbols-outlined text-base sm:text-xl">group</span>
          </div>
          <p className="text-xl sm:text-3xl font-black text-blue-950 mt-1">{totalHospedes}</p>
          <span className="text-[10px] sm:text-xs text-blue-600 font-medium">Cadastrados no hotel</span>
        </div>

        {/* KPI 2 - HÓSPEDES ATIVOS */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Hóspedes Ativos</span>
            <span className="material-symbols-outlined text-base sm:text-xl">check_circle</span>
          </div>
          <p className="text-xl sm:text-3xl font-black text-emerald-950 mt-1">{hospedesAtivos}</p>
          <span className="text-[10px] sm:text-xs text-emerald-600 font-medium">Disponíveis</span>
        </div>

        {/* KPI 3 - CHECK-INS DO DIA */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Check-ins do Dia</span>
            <span className="material-symbols-outlined text-base sm:text-xl">login</span>
          </div>
          <p className="text-xl sm:text-3xl font-black text-amber-950 mt-1">{checkinsDia}</p>
          <span className="text-[10px] sm:text-xs text-amber-600 font-medium">Entradas previstas</span>
        </div>

        {/* KPI 4 - CHECK-OUTS PENDENTES */}
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Check-outs Pendentes</span>
            <span className="material-symbols-outlined text-base sm:text-xl">logout</span>
          </div>
          <p className="text-xl sm:text-3xl font-black text-rose-950 mt-1">{checkoutsPendentes}</p>
          <span className="text-[10px] sm:text-xs text-rose-600 font-medium">Saídas hoje</span>
        </div>

      </div>

      {/* BARRA DE PESQUISA E FILTROS */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm flex flex-col lg:flex-row gap-4 items-stretch lg:items-end">
        <div className="flex-1 relative">
          <label className="sr-only" htmlFor="search-hospedes">Pesquisar Hóspedes</label>
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
          <input 
            id="search-hospedes"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por Nome, CPF ou E-mail..." 
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition-colors"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          {/* FILTER STATUS */}
          <div className="w-full sm:w-48 relative">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1" htmlFor="status-filter">Status</label>
            <select 
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full pl-3 pr-8 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer"
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>

          {/* FILTER DATE */}
          <div className="w-full sm:w-48 relative">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1" htmlFor="date-filter">Última Estadia</label>
            <div className="relative">
              <input 
                id="date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600"
              />
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">calendar_month</span>
            </div>
          </div>

          {/* CLEAR FILTERS */}
          {(searchQuery || statusFilter !== 'todos' || dateFilter) && (
            <button 
              onClick={() => { setSearchQuery(''); setStatusFilter('todos'); setDateFilter(''); }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors self-end h-[38px] cursor-pointer"
              title="Limpar Filtros"
            >
              <span className="material-symbols-outlined text-base">filter_alt_off</span>
              <span>Limpar</span>
            </button>
          )}

          {/* TOGGLE LISTA / GRADE */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-end h-[38px]">
            <button
              type="button"
              onClick={() => setViewMode('lista')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'lista'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Visualização em Lista"
            >
              <span className="material-symbols-outlined text-base">format_list_bulleted</span>
              <span className="hidden sm:inline">Lista</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grade')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grade'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Visualização em Grade"
            >
              <span className="material-symbols-outlined text-base">grid_view</span>
              <span className="hidden sm:inline">Grade</span>
            </button>
          </div>
        </div>
      </section>

      {/* CONTEÚDO PRINCIPAL: TABELA OU GRADE */}
      {viewMode === 'lista' ? (
        <>
          {/* VISUALIZAÇÃO DESKTOP: TABELA */}
          <section className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50">
                  <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="px-3 py-3.5 pl-4">Nome Completo</th>
                    <th className="px-2.5 py-3.5">CPF / CNPJ</th>
                    <th className="px-2.5 py-3.5">E-mail</th>
                    <th className="px-2.5 py-3.5">Telefone</th>
                    <th className="px-2.5 py-3.5">Última Estadia</th>
                    <th className="px-2.5 py-3.5">Status</th>
                    <th className="px-3 py-3.5 text-right pr-6 lg:pr-8">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                  {paginatedGuests.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-3.5 pl-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          {g.avatar ? (
                            <img src={g.avatar} alt={g.name} className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                              {g.initials}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">{g.name}</span>
                            <span className="px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                              Hóspede
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-2.5 py-3.5 whitespace-nowrap text-slate-600 font-medium text-xs sm:text-sm">{g.cpfCnpj}</td>
                      <td className="px-2.5 py-3.5 whitespace-nowrap text-slate-600 text-xs sm:text-sm max-w-[150px] lg:max-w-[190px] truncate">{g.email}</td>
                      <td className="px-2.5 py-3.5 whitespace-nowrap text-slate-600 text-xs sm:text-sm">{maskPhone(g.phone)}</td>
                      <td className="px-2.5 py-3.5 whitespace-nowrap text-slate-600 text-xs sm:text-sm">{g.lastStay}</td>

                      <td className="px-2.5 py-3.5 whitespace-nowrap">
                        <span className={
                          "px-2.5 py-0.5 inline-flex text-xs font-bold rounded-full " +
                          (g.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600')
                        }>
                          {g.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>

                      <td className="px-3 py-3.5 whitespace-nowrap text-right pr-6 lg:pr-8">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button 
                            onClick={() => setSelectedGuestForView(g)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-white bg-[#2563EB] hover:bg-blue-700 font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                            title="Ver Detalhes"
                          >
                            <span className="material-symbols-outlined text-sm">visibility</span>
                            <span>Ver</span>
                          </button>

                          <button 
                            onClick={() => handleOpenEdit(g)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-white bg-[#EA580C] hover:bg-orange-700 font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                            <span>Editar</span>
                          </button>

                          <button 
                            onClick={() => setGuestToDelete(g)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-white bg-[#DC2626] hover:bg-red-700 font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                            title="Excluir"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                            <span>Excluir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredGuests.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        Nenhum hóspede encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINAÇÃO DESKTOP */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between text-sm">
              <p className="text-slate-500 font-medium text-xs sm:text-sm">
                Exibindo <span className="font-semibold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-semibold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredGuests.length)}</span> de <span className="font-semibold text-slate-800">{filteredGuests.length}</span> resultados
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                      currentPage === page
                        ? 'bg-[#000000] text-white shadow-xs'
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
                  className="p-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            </div>
          </section>

          {/* VISUALIZAÇÃO MOBILE: CARDS */}
          <section className="flex flex-col gap-3.5 md:hidden">
            {paginatedGuests.map((g) => (
              <article key={g.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {g.avatar ? (
                      <img src={g.avatar} alt={g.name} className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                        {g.initials}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <h4 className="font-bold text-sm text-slate-900">{g.name}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                          Hóspede
                        </span>
                        <span className={
                          "inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full w-fit " +
                          (g.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600')
                        }>
                          {g.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setSelectedGuestForView(g)}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">more_vert</span>
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-y-2 text-xs">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-400 uppercase text-[10px]">Documento</span>
                    <span className="font-semibold text-slate-800">{g.cpfCnpj}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-400 uppercase text-[10px]">Telefone</span>
                    <span className="font-semibold text-slate-800">{g.phone ? maskPhone(g.phone) : 'Não informado'}</span>
                  </div>
                  <div className="flex flex-col col-span-2">
                    <span className="font-semibold text-slate-400 uppercase text-[10px]">E-mail</span>
                    <span className="font-semibold text-slate-800 truncate">{g.email}</span>
                  </div>
                </div>

                {/* AÇÕES RODAPÉ CARD MOBILE */}
                <div className="border-t border-slate-100 bg-slate-50/70 p-2 flex justify-end gap-1.5 -mx-4 -mb-4 mt-1 rounded-b-2xl">
                  <button 
                    onClick={() => setSelectedGuestForView(g)}
                    className="text-[#005cbb] hover:bg-[#e6f1ff] p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer" 
                    title="Ver Detalhes"
                  >
                    <span className="material-symbols-outlined text-xl">visibility</span>
                  </button>

                  <button 
                    onClick={() => handleOpenEdit(g)}
                    className="text-[#b87500] hover:bg-[#fff2df] p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer" 
                    title="Editar"
                  >
                    <span className="material-symbols-outlined text-xl">edit</span>
                  </button>

                  <button 
                    onClick={() => setGuestToDelete(g)}
                    className="text-red-600 hover:bg-red-50 p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer" 
                    title="Excluir"
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>
              </article>
            ))}
          </section>
        </>
      ) : (
        /* VISUALIZAÇÃO EM GRADE (DESKTOP E MOBILE) */
        <section className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedGuests.length === 0 ? (
              <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 font-medium">
                Nenhum hóspede encontrado com os filtros selecionados.
              </div>
            ) : (
              paginatedGuests.map((g) => (
                <div
                  key={g.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        {g.avatar ? (
                          <img src={g.avatar} alt={g.name} className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-xs shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs">
                            {g.initials}
                          </div>
                        )}
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-base leading-snug line-clamp-1">{g.name}</h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                              Hóspede
                            </span>
                            <span className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                              g.status === 'ativo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {g.status === 'ativo' ? '• Ativo' : '• Inativo'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">CPF/CNPJ:</span>
                        <span className="font-bold text-slate-800">{g.cpfCnpj || 'Não informado'}</span>
                      </div>
                      <div className="flex items-center justify-between truncate">
                        <span className="text-slate-400 font-medium">E-mail:</span>
                        <span className="font-semibold text-slate-800 truncate ml-2">{g.email || 'Não informado'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Telefone:</span>
                        <span className="font-semibold text-slate-800">{g.phone ? maskPhone(g.phone) : 'Não informado'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Última Estadia:</span>
                        <span className="font-medium text-slate-700">{g.lastStay || 'Nenhuma'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedGuestForView(g)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      <span>Ver</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(g)}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGuestToDelete(g)}
                      className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* PAGINAÇÃO GRADE */}
          <div className="bg-white px-6 py-4 rounded-2xl border border-slate-200 flex items-center justify-between text-sm shadow-xs">
            <p className="text-slate-500 font-medium text-xs sm:text-sm">
              Exibindo <span className="font-semibold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-semibold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredGuests.length)}</span> de <span className="font-semibold text-slate-800">{filteredGuests.length}</span> resultados
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    currentPage === page
                      ? 'bg-[#000000] text-white shadow-xs'
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
                className="p-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* MODAL VER DETALHES DO HÓSPEDE */}
      {selectedGuestForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80 my-auto">
            {/* Header Escuro Padrão #003400 */}
            <div className="px-5 py-4 flex items-center justify-between bg-[#003400] text-white shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-sm shadow-xs border border-white/20">
                  {selectedGuestForView.initials}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base sm:text-lg leading-tight">{selectedGuestForView.name}</h3>
                  <p className="text-xs text-emerald-300 font-mono">Perfil do Hóspede</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedGuestForView(null)}
                type="button"
                aria-label="Fechar Modal"
                className="bg-[#b91c1c] text-white hover:bg-red-800 transition-colors p-1.5 rounded-xl shrink-0 flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-6 space-y-3.5 text-sm text-slate-700">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs font-semibold text-slate-500">CPF / CNPJ:</span>
                  <span className="font-bold text-slate-900">{selectedGuestForView.cpfCnpj}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs font-semibold text-slate-500">Telefone:</span>
                  <span className="font-bold text-slate-900">{selectedGuestForView.phone ? maskPhone(selectedGuestForView.phone) : 'Não informado'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs font-semibold text-slate-500">E-mail:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[200px]">{selectedGuestForView.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs font-semibold text-slate-500">Última Estadia:</span>
                  <span className="font-bold text-slate-900">{selectedGuestForView.lastStay}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500">Perfil de Acesso:</span>
                  <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full text-[11px]">
                    Hóspede
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs font-semibold text-slate-500">Status:</span>
                  <span className={"font-bold uppercase text-xs " + (selectedGuestForView.status === 'ativo' ? 'text-emerald-700' : 'text-slate-500')}>
                    ● {selectedGuestForView.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedGuestForView(null)}
                className="px-5 py-2 bg-[#b91c1c] hover:bg-red-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer active:scale-95 inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">close</span>
                <span>Fechar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO OU EDITAR HÓSPEDE */}
      {(selectedGuestForEdit || isNovoModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#003400] flex items-center justify-center font-bold text-xl">
                  <span className="material-symbols-outlined">{isNovoModalOpen ? 'person_add' : 'edit'}</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    {isNovoModalOpen ? 'Cadastrar Novo Hóspede' : 'Editar Hóspede'}
                  </h3>
                  <p className="text-xs text-slate-500">Preencha os dados cadastrais do hóspede</p>
                </div>
              </div>
              <button 
                onClick={() => { setSelectedGuestForEdit(null); setIsNovoModalOpen(false); }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={isNovoModalOpen ? handleSaveNew : handleSaveEdit} className="p-6 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input 
                  type="text" 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="Ex: Roberto Almeida, Juliana Silva..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003400]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      CPF / CNPJ
                    </label>
                    {formCpfValidation.isComplete && (
                      <span className={`text-[10px] font-bold flex items-center gap-0.5 ${
                        formCpfValidation.isValid ? 'text-emerald-700' : 'text-rose-600'
                      }`}>
                        <span className="material-symbols-outlined text-[12px]">
                          {formCpfValidation.isValid ? 'verified' : 'cancel'}
                        </span>
                        {formCpfValidation.isValid ? 'Válido' : 'Inválido'}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={formCpf}
                      onChange={(e) => setFormCpf(maskCpfCnpj(e.target.value))}
                      placeholder="123.456.789-00"
                      maxLength={18}
                      className={`w-full px-3.5 py-2.5 border rounded-xl text-slate-900 focus:outline-none transition-all font-mono text-sm ${
                        formCpfValidation.isComplete
                          ? formCpfValidation.isValid
                            ? 'bg-emerald-50/20 border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                            : 'bg-rose-50/30 border-rose-400 focus:ring-2 focus:ring-rose-500/20 text-rose-950'
                          : 'bg-slate-50 border-slate-300 focus:bg-white focus:ring-2 focus:ring-[#003400]'
                      }`}
                    />
                    {formCpfValidation.isComplete && (
                      <span className={`absolute right-3 top-2.5 material-symbols-outlined text-lg pointer-events-none ${
                        formCpfValidation.isValid ? 'text-emerald-600' : 'text-rose-500'
                      }`}>
                        {formCpfValidation.isValid ? 'check_circle' : 'error'}
                      </span>
                    )}
                  </div>
                  {formCpfValidation.isComplete && !formCpfValidation.isValid && (
                    <p className="text-[10px] text-rose-600 font-medium flex items-center gap-1 mt-1 animate-fadeIn">
                      <span className="material-symbols-outlined text-xs">warning</span>
                      CPF/CNPJ inválido ou falso.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input 
                    type="text" 
                    value={formPhone}
                    onChange={(e) => setFormPhone(maskPhone(e.target.value))}
                    placeholder="(11) 98765-4321"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003400]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  E-mail
                </label>
                <input 
                  type="email" 
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="hospede@email.com"
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

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => { setSelectedGuestForEdit(null); setIsNovoModalOpen(false); }}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 rounded-xl bg-[#003400] text-white text-xs font-semibold hover:bg-[#002200]"
                >
                  Salvar Hóspede
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PADRÃO DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <ModalConfirmacaoExclusao
        isOpen={!!guestToDelete}
        onClose={() => setGuestToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Hóspede"
        subtitle="Confirmação de exclusão permanente"
        itemType="o hóspede"
        itemName={guestToDelete?.name}
        description="Esta ação removerá o cadastro do hóspede, histórico de estadias e usuário de acesso vinculado."
        isLoading={isDeleting}
      />

    </div>
  );
};

export default ListagemHospedes;
