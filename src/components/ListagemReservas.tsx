import React, { useState, useEffect, useMemo, useRef } from 'react';
import { reservasService } from '../services/supabaseService';
import { supabase } from '../lib/supabase';
import { ModalCheckoutRecebimento } from './ModalCheckoutRecebimento';
import { ModalCheckinEntrada } from './ModalCheckinEntrada';
import { ModalEnviarTemplateWhatsApp } from './ModalEnviarTemplateWhatsApp';
import { caixaService } from '../services/caixaService';
import { templateMensagemService } from '../services/templateMensagemService';

export interface Reserva {
  id: string;
  reservaNumber: string;
  hospedeNome: string;
  hospedeEmail: string;
  hospedeTelefone: string;
  hospedeIniciais: string;
  quartoNome: string;
  quartoTipo: string;
  quarto_id?: string;
  numero_quarto?: string;
  hospede_id?: string;
  checkIn: string;
  checkOut: string;
  noites: number;
  adultos?: number;
  criancas?: number;
  dataCriacao: string;
  dataCriacaoIso?: string;
  criado_em?: string;
  hotel_id?: string;
  valorTotal: string;
  valor_total?: number;
  status: 'Confirmada' | 'Hospedado' | 'Concluída' | 'Cancelada';
  observacao?: string;
  formaPagamento?: string;
}

interface ListagemReservasProps {
  onNavigateToDashboard?: () => void;
  onNavigateToNovaReserva?: () => void;
}

export const ListagemReservas: React.FC<ListagemReservasProps> = ({
  onNavigateToDashboard,
  onNavigateToNovaReserva,
}) => {
  const [viewMode, setViewMode] = useState<'lista' | 'grade'>('lista');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos os Status');
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Modais State
  const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null);
  const [isVerModalOpen, setIsVerModalOpen] = useState(false);
  const [checkoutModalReserva, setCheckoutModalReserva] = useState<Reserva | null>(null);
  const [checkinModalReserva, setCheckinModalReserva] = useState<Reserva | null>(null);
  const [whatsappModalReserva, setWhatsappModalReserva] = useState<Reserva | null>(null);
  const [whatsappDefaultTemplate, setWhatsappDefaultTemplate] = useState<any>('confirmacao');
  const [reservaToDelete, setReservaToDelete] = useState<Reserva | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const reservasRef = useRef<Reserva[]>([]);
  reservasRef.current = reservas;

  // Realiza o Check-out inteligente (manual pela recepção ou automático às 12:00)
  const handleExecutarCheckout = async (reserva: Reserva, isAutomatico: boolean = false) => {
    try {
      const result = await reservasService.realizarCheckout(reserva.id, { isAutomatico });
      if (result.success) {
        // Assegura o registro no caixa do dia
        try {
          caixaService.registrarReservaConcluida(result.reserva || reserva, reserva.hotel_id);
        } catch {}

        setReservas((prev) => prev.map((r) => r.id === reserva.id ? { ...r, status: 'Concluída' } : r));
        if (selectedReserva && selectedReserva.id === reserva.id) {
          setSelectedReserva((prev) => prev ? { ...prev, status: 'Concluída' } : null);
        }
        const msg = isAutomatico
          ? `⏰ Check-out automático das 12:00 concluído! Quarto ${reserva.quartoNome} agora está em LIMPEZA.`
          : `✅ Check-out manual concluído com sucesso! Quarto ${reserva.quartoNome} agora está em LIMPEZA.`;
        showToast(msg);
      } else {
        showToast('Erro ao processar check-out.');
      }
    } catch (err) {
      console.error('Erro no checkout:', err);
      showToast('Erro ao processar check-out.');
    }
  };

  // Motor Inteligente: Executa Check-out Automático às 12:00 para hóspedes com saída hoje ou data anterior
  const verificarCheckoutsAutomaticos = async (lista: Reserva[]) => {
    if (!lista || lista.length === 0) return;
    const agora = new Date();
    const hojeStr = agora.toISOString().split('T')[0]; // "YYYY-MM-DD"
    const horaAtual = agora.getHours();

    const pendentes = lista.filter((r) => {
      if (r.status !== 'Hospedado') return false;
      if (!r.checkOut) return false;

      const dOut = r.checkOut.trim();
      if (dOut < hojeStr) {
        // Data de saída expirou em dias anteriores
        return true;
      }
      if (dOut === hojeStr) {
        // Data de saída é hoje: ativa automaticamente a partir das 12:00
        return horaAtual >= 12;
      }
      return false;
    });

    if (pendentes.length > 0) {
      console.log(`[Check-out Inteligente] Disparando check-out automático para ${pendentes.length} reserva(s) às 12:00.`);
      for (const res of pendentes) {
        await handleExecutarCheckout(res, true);
      }
    }
  };

  const fetchReservas = async () => {
    setLoading(true);
    try {
      const data = await reservasService.getReservas();
      setReservas(data);
      // Checa automaticamente se há check-outs a executar às 12:00
      verificarCheckoutsAutomaticos(data);
      // Sincroniza reservas concluídas com o caixa do dia
      caixaService.sincronizarReservasConcluidasComCaixa();
    } catch (err) {
      console.error('Erro ao carregar reservas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservas();

    const handleRefresh = () => {
      fetchReservas();
    };

    window.addEventListener('hotel_changed', handleRefresh);
    window.addEventListener('hotel_nova_reserva', handleRefresh);
    window.addEventListener('hotel_reserva_modificada', handleRefresh);
    window.addEventListener('focus', handleRefresh);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'hotel_nova_reserva_trigger') {
        fetchReservas();
      }
    };
    window.addEventListener('storage', handleStorage);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('hotel_notifications_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'NOVA_RESERVA_HOSPEDE' || event.data?.type === 'CHECKOUT_REALIZADO') {
          fetchReservas();
        }
      };
    } catch {}

    const unsubscribeRealtime = reservasService.subscribeReservas(() => {
      fetchReservas();
    });

    // Timer Inteligente: a cada 30 segundos valida se o relógio atingiu 12:00
    const timerCheckouts = setInterval(() => {
      verificarCheckoutsAutomaticos(reservasRef.current);
    }, 30000);

    return () => {
      clearInterval(timerCheckouts);
      window.removeEventListener('hotel_changed', handleRefresh);
      window.removeEventListener('hotel_nova_reserva', handleRefresh);
      window.removeEventListener('hotel_reserva_modificada', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('storage', handleStorage);
      if (bc) {
        try { bc.close(); } catch {}
      }
      unsubscribeRealtime();
    };
  }, []);

  const handleStatusChange = async (reservaId: string, newStatus: Reserva['status']) => {
    const target = reservas.find(r => r.id === reservaId);

    // Se for Check-out (Concluída), usa o método inteligente para alterar quarto para 'limpeza'
    if (newStatus === 'Concluída' && target) {
      await handleExecutarCheckout(target, false);
      return;
    }

    const success = await reservasService.updateReservaStatus(reservaId, newStatus);
    if (success) {
      setReservas((prev) => prev.map((r) => r.id === reservaId ? { ...r, status: newStatus } : r));
      if (selectedReserva && selectedReserva.id === reservaId) {
        setSelectedReserva((prev) => prev ? { ...prev, status: newStatus } : null);
      }

      // Se virou Hospedado (Check-in), marca o quarto como 'ocupado'
      if (newStatus === 'Hospedado' && target) {
        try {
          if (target.quarto_id) {
            await supabase.from('quartos').update({ status: 'ocupado' }).eq('id', target.quarto_id);
          } else if (target.numero_quarto) {
            await supabase.from('quartos').update({ status: 'ocupado' }).eq('numero', String(target.numero_quarto));
          }
        } catch {}
      }

      // Se virou Cancelada, desocupa o quarto
      if (newStatus === 'Cancelada' && target) {
        try {
          if (target.quarto_id) {
            await supabase.from('quartos').update({ status: 'livre' }).eq('id', target.quarto_id);
          } else if (target.numero_quarto) {
            await supabase.from('quartos').update({ status: 'livre' }).eq('numero', String(target.numero_quarto));
          }
        } catch {}
      }

      showToast(`Status da reserva atualizado para "${newStatus}".`);
    } else {
      showToast('Erro ao atualizar status da reserva.');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filtered Reservas
  const filteredReservas = useMemo(() => {
    return reservas.filter((res) => {
      const matchSearch =
        res.hospedeNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.hospedeEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.quartoNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.reservaNumber.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        statusFilter === 'Todos os Status'
          ? res.status !== 'Concluída'
          : statusFilter === 'Todas'
          ? true
          : res.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [reservas, searchTerm, statusFilter]);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredReservas.length / itemsPerPage) || 1;
  const paginatedReservas = useMemo(() => {
    return filteredReservas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredReservas, currentPage, itemsPerPage]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('Todos os Status');
  };

  const handleDeleteReserva = async () => {
    if (!reservaToDelete) return;
    const success = await reservasService.deleteReserva(reservaToDelete.id);
    if (success) {
      setReservas((prev) => prev.filter((r) => r.id !== reservaToDelete.id));
      showToast(`Reserva ${reservaToDelete.reservaNumber} excluída com sucesso.`);
    } else {
      showToast('Erro ao excluir reserva no banco de dados.');
    }
    setReservaToDelete(null);
  };

  const getStatusBadge = (status: Reserva['status']) => {
    switch (status) {
      case 'Confirmada':
        return (
          <span className="inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
            Confirmada
          </span>
        );
      case 'Hospedado':
        return (
          <span className="inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse mr-1.5"></span>
            Hospedado
          </span>
        );
      case 'Concluída':
        return (
          <span className="inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>
            Concluída
          </span>
        );
      case 'Cancelada':
        return (
          <span className="inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
            Cancelada
          </span>
        );
      default:
        return null;
    }
  };

  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return '-';
    const clean = dateStr.trim();
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return clean;
  };

  return (
    <div className="bg-[#f8f9ff] min-h-screen p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-5 pb-24 sm:pb-12">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#d1fae5] border border-emerald-300 text-black font-bold px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-[#003400] text-xl">check_circle</span>
          <span className="text-sm text-black font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Cabeçalho da Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Listagem de Reservas</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Tempo Real
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Gerencie as reservas e estadias com atualização instantânea.</p>
        </div>
      </div>

      {/* Grid 2x2 de Botões de Ação Principais no Mobile */}
      <div className="grid grid-cols-2 gap-2 sm:hidden">
        <button
          onClick={onNavigateToNovaReserva}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#0f172a] hover:bg-slate-800 active:scale-[0.98] text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nova Reserva
        </button>
        <button
          onClick={() => showToast('Disponibilidade de quartos')}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#10B981] hover:bg-emerald-600 active:scale-[0.98] text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">calendar_month</span>
          Disponibilidade
        </button>
        <button
          onClick={() => showToast('Importando reservas...')}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#2563EB] hover:bg-blue-700 active:scale-[0.98] text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">upload</span>
          Importar
        </button>
        <button
          onClick={() => showToast('Exportando relatório de reservas...')}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#FDB116] hover:bg-amber-500 active:scale-[0.98] text-slate-900 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Exportar
        </button>
      </div>

      {/* Busca e Filtro no Mobile */}
      <div className="flex items-center gap-2 sm:hidden">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar reservas ou hóspedes..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-700 text-slate-800 placeholder-slate-400 shadow-sm"
          />
        </div>
        <div className="relative shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none bg-white border border-slate-200 text-slate-700 py-2 pl-3 pr-8 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-700 cursor-pointer shadow-sm"
          >
            <option value="Todos os Status">Status Ativos (Confirmadas & Hospedados)</option>
            <option value="Todas">Todas as Reservas (Geral)</option>
            <option value="Confirmada">Reservas Confirmadas</option>
            <option value="Hospedado">Hospedados Agora</option>
            <option value="Concluída">Hospedagens Concluídas (Histórico)</option>
            <option value="Cancelada">Reservas Canceladas</option>
          </select>
          <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[16px]">expand_more</span>
        </div>
      </div>

      {/* Cards de Indicadores (KPIs - Grid 6 Cards: 2x3 no Mobile / 3x2 no Tablet / 6 no Desktop) */}
      {(() => {
        const totalReservasCount = reservas.length;
        const confirmadasCount = reservas.filter(r => r.status === 'Confirmada').length;
        const hospedadosCount = reservas.filter(r => r.status === 'Hospedado').length;
        const concluidasCount = reservas.filter(r => r.status === 'Concluída').length;
        const canceladasCount = reservas.filter(r => r.status === 'Cancelada').length;

        const percentConfirmadas = totalReservasCount > 0 ? Math.round((confirmadasCount / totalReservasCount) * 100) : 0;
        const percentCanceladas = totalReservasCount > 0 ? ((canceladasCount / totalReservasCount) * 100).toFixed(1) : '0';
        const taxaOcupacao = totalReservasCount > 0 ? Math.round(((confirmadasCount + hospedadosCount) / Math.max(totalReservasCount, 1)) * 100) : 0;

        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
            {/* Card 1: Total de Reservas */}
            <div 
              onClick={() => setStatusFilter('Todas')}
              className={`border rounded-xl p-3 sm:p-4 flex flex-col justify-between shadow-sm cursor-pointer transition-all hover:shadow-md active:scale-98 ${
                statusFilter === 'Todas' ? 'bg-blue-100/80 border-blue-300 ring-2 ring-blue-400/50' : 'bg-blue-50/70 border-blue-100 hover:border-blue-200'
              }`}
              title="Clique para ver todas as reservas (incluindo concluídas)"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-blue-700">Total de Reservas</span>
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">calendar_month</span>
                </div>
              </div>
              <div className="mt-2 sm:mt-3">
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{totalReservasCount}</div>
                <p className="text-[10px] sm:text-xs text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span> Em tempo real
                </p>
              </div>
            </div>

            {/* Card 2: Reservas Confirmadas */}
            <div 
              onClick={() => setStatusFilter('Confirmada')}
              className={`border rounded-xl p-3 sm:p-4 flex flex-col justify-between shadow-sm cursor-pointer transition-all hover:shadow-md active:scale-98 ${
                statusFilter === 'Confirmada' ? 'bg-teal-100/80 border-teal-300 ring-2 ring-teal-400/50' : 'bg-teal-50/70 border-teal-100 hover:border-teal-200'
              }`}
              title="Clique para filtrar apenas reservas confirmadas"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-teal-800">Reservas Confirmadas</span>
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700">
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">event_available</span>
                </div>
              </div>
              <div className="mt-2 sm:mt-3">
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{confirmadasCount}</div>
                <p className="text-[10px] sm:text-xs text-teal-700 font-medium mt-0.5">{percentConfirmadas}% do total</p>
              </div>
            </div>

            {/* Card 3: Check-in Hoje / Hospedados */}
            <div 
              onClick={() => setStatusFilter('Hospedado')}
              className={`border rounded-xl p-3 sm:p-4 flex flex-col justify-between shadow-sm cursor-pointer transition-all hover:shadow-md active:scale-98 ${
                statusFilter === 'Hospedado' ? 'bg-emerald-100/80 border-emerald-300 ring-2 ring-emerald-400/50' : 'bg-emerald-50/70 border-emerald-100 hover:border-emerald-200'
              }`}
              title="Clique para filtrar apenas hóspedes atualmente hospedados"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-800">Hospedados</span>
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">login</span>
                </div>
              </div>
              <div className="mt-2 sm:mt-3">
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{hospedadosCount}</div>
                <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5">Em permanência</p>
              </div>
            </div>

            {/* Card 4: Concluídas / Check-out */}
            <div 
              onClick={() => setStatusFilter('Concluída')}
              className={`border rounded-xl p-3 sm:p-4 flex flex-col justify-between shadow-sm cursor-pointer transition-all hover:shadow-md active:scale-98 ${
                statusFilter === 'Concluída' ? 'bg-amber-100/80 border-amber-300 ring-2 ring-amber-400/50' : 'bg-amber-50/70 border-amber-100 hover:border-amber-200'
              }`}
              title="Clique para filtrar todas as hospedagens concluídas (histórico)"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-amber-800">Concluídas</span>
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">logout</span>
                </div>
              </div>
              <div className="mt-2 sm:mt-3">
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{concluidasCount}</div>
                <p className="text-[10px] sm:text-xs text-amber-700 font-bold mt-0.5 flex items-center gap-1">
                  <span>Ver Histórico</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </p>
              </div>
            </div>

            {/* Card 5: Reservas Canceladas */}
            <div 
              onClick={() => setStatusFilter('Cancelada')}
              className={`border rounded-xl p-3 sm:p-4 flex flex-col justify-between shadow-sm cursor-pointer transition-all hover:shadow-md active:scale-98 ${
                statusFilter === 'Cancelada' ? 'bg-rose-100/80 border-rose-300 ring-2 ring-rose-400/50' : 'bg-rose-50/70 border-rose-100 hover:border-rose-200'
              }`}
              title="Clique para filtrar reservas canceladas"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-rose-800">Reservas Canceladas</span>
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700">
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">event_busy</span>
                </div>
              </div>
              <div className="mt-2 sm:mt-3">
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{canceladasCount}</div>
                <p className="text-[10px] sm:text-xs text-rose-700 font-medium mt-0.5">{percentCanceladas}% do total</p>
              </div>
            </div>

            {/* Card 6: Taxa de Ocupação */}
            <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-3 sm:p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-purple-700">Taxa de Ocupação</span>
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">bed</span>
                </div>
              </div>
              <div className="mt-2 sm:mt-3">
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{taxaOcupacao}%</div>
                <p className="text-[10px] sm:text-xs text-purple-600 font-medium mt-0.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">hotel</span> Ocupação Real
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* LISTA DE CARDS MOBILE (Exibida em sm:hidden) */}
      <div className="space-y-3 sm:hidden">
        {filteredReservas.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-400">
            Nenhuma reserva encontrada.
          </div>
        ) : (
          filteredReservas.map((reserva) => (
            <div key={reserva.id} className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-sm space-y-2.5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block tracking-wider">{reserva.reservaNumber}</span>
                  <h3 className="font-bold text-sm text-slate-900">{reserva.hospedeNome}</h3>
                  <p className="text-xs text-slate-500">{reserva.quartoNome} • {reserva.quartoTipo}</p>
                </div>
                <div>{getStatusBadge(reserva.status)}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Período</span>
                  <span className="font-medium text-slate-700">{reserva.checkIn} a {reserva.checkOut}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Valor Total</span>
                  <span className="font-bold text-slate-900">{reserva.valorTotal}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5 flex-wrap">
                {reserva.status === 'Confirmada' && (
                  <button
                    onClick={() => setCheckinModalReserva(reserva)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                    title="Realizar Check-in (Entrada do Hóspede)"
                  >
                    <span className="material-symbols-outlined text-[14px]">login</span> Check-in
                  </button>
                )}
                {reserva.status === 'Hospedado' && (
                  <button
                    onClick={() => setCheckoutModalReserva(reserva)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                    title="Realizar Check-out e Receber"
                  >
                    <span className="material-symbols-outlined text-[14px]">point_of_sale</span> Check-out
                  </button>
                )}
                <button
                  onClick={() => { setSelectedReserva(reserva); setIsVerModalOpen(true); }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">visibility</span> Ver
                </button>
                <button
                  onClick={() => showToast(`Editar reserva ${reserva.reservaNumber}`)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FDB116] hover:bg-amber-500 text-white rounded text-xs font-medium transition-colors shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span> Editar
                </button>
                <button
                  onClick={() => setReservaToDelete(reserva)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span> Excluir
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CONTAINER DESKTOP (TOOLBAR, TABELA E GRADE DESKTOP) */}
      <div className="hidden sm:block bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Barra de Filtros e Ações Desktop */}
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Campo de Busca */}
            <div className="relative w-full sm:max-w-xs flex-1">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[20px]">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por hóspede, quarto, ID..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-slate-800 placeholder-slate-400"
              />
            </div>

            {/* Filtro de Status */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-white border border-slate-200 text-slate-700 py-2 pl-3.5 pr-9 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
              >
                <option value="Todos os Status">Todos os Status (Ativas)</option>
                <option value="Confirmada">Confirmada</option>
                <option value="Hospedado">Hospedado</option>
                <option value="Concluída">Concluídas (Histórico)</option>
                <option value="Cancelada">Cancelada</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
            </div>

            {/* Botão Limpar Filtros */}
            {(searchTerm || statusFilter !== 'Todos os Status') && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
                Limpar Filtros
              </button>
            )}
          </div>

          {/* Lado Direito: Alternador Lista/Grade e Botões de Ação Desktop */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-end">
            {/* Alternador Lista/Grade */}
            <div className="inline-flex border border-slate-200 rounded-xl p-1 bg-slate-100">
              <button
                onClick={() => setViewMode('lista')}
                title="Visualização em Lista"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'lista'
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
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
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">grid_view</span>
              </button>
            </div>

            {/* Botão Importar */}
            <button className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors whitespace-nowrap cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">upload</span>
              Importar
            </button>

            {/* Botão Exportar */}
            <button className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#FDB116] hover:bg-amber-500 text-slate-900 text-sm font-semibold rounded-xl shadow-sm transition-colors whitespace-nowrap cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">download</span>
              Exportar
            </button>

            {/* Botão Nova Reserva */}
            <button
              onClick={onNavigateToNovaReserva}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl shadow-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Nova Reserva
            </button>
          </div>
        </div>

        {/* VISUALIZAÇÃO 1: MODO LISTA (TABELA DESKTOP) */}
        {viewMode === 'lista' ? (
          <div className="w-full overflow-x-auto lg:overflow-x-visible">
            <table className="w-full text-left text-xs sm:text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] sm:text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-2.5 sm:px-3 py-3 whitespace-nowrap">ID</th>
                  <th scope="col" className="px-2.5 sm:px-3 py-3">Hóspede</th>
                  <th scope="col" className="px-2 sm:px-2.5 py-3">Quarto</th>
                  <th scope="col" className="px-2 py-3 whitespace-nowrap">Check-in</th>
                  <th scope="col" className="px-2 py-3 whitespace-nowrap">Check-out</th>
                  <th scope="col" className="px-2 py-3 whitespace-nowrap">Valor Total</th>
                  <th scope="col" className="px-2 py-3 whitespace-nowrap text-center">Status</th>
                  <th scope="col" className="px-2 sm:px-3 py-3 text-center whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReservas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                      Nenhuma reserva encontrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  paginatedReservas.map((reserva) => (
                    <tr key={reserva.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="px-2.5 sm:px-3 py-3 font-semibold text-slate-900 whitespace-nowrap text-xs">
                        {reserva.reservaNumber}
                      </td>
                      <td className="px-2.5 sm:px-3 py-3">
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                            {reserva.hospedeIniciais}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-slate-900 text-xs sm:text-sm truncate" title={reserva.hospedeNome}>
                              {reserva.hospedeNome}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[130px] lg:max-w-[160px]" title={reserva.hospedeEmail}>
                              {reserva.hospedeEmail}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 sm:px-2.5 py-3 font-medium text-slate-800">
                        <div className="truncate text-xs sm:text-sm font-semibold text-slate-800" title={reserva.quartoNome}>
                          {reserva.quartoNome}
                        </div>
                        <span className="text-[11px] text-slate-400 block font-normal truncate">
                          {reserva.quartoTipo}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-slate-700 whitespace-nowrap text-xs sm:text-sm">
                        {formatDateBR(reserva.checkIn)}
                      </td>
                      <td className="px-2 py-3 text-slate-700 whitespace-nowrap text-xs sm:text-sm">
                        {formatDateBR(reserva.checkOut)}
                      </td>
                      <td className="px-2 py-3 font-bold text-slate-900 whitespace-nowrap text-xs sm:text-sm">
                        {reserva.valorTotal}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-center">
                        {getStatusBadge(reserva.status)}
                      </td>
                      <td className="px-2 sm:px-3 py-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1">
                          {reserva.status === 'Confirmada' && (
                            <button
                              onClick={() => setCheckinModalReserva(reserva)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
                              title="Realizar Check-in (Entrada do Hóspede & FNRH)"
                            >
                              <span className="material-symbols-outlined text-[15px]">login</span>
                              <span className="hidden xl:inline">Check-in</span>
                            </button>
                          )}
                          {reserva.status === 'Hospedado' && (
                            <button
                              onClick={() => setCheckoutModalReserva(reserva)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
                              title="Check-out & Receber (Sincronizado com Caixa)"
                            >
                              <span className="material-symbols-outlined text-[15px]">point_of_sale</span>
                              <span className="hidden xl:inline">Check-out</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setWhatsappModalReserva(reserva);
                              setWhatsappDefaultTemplate(
                                reserva.status === 'Confirmada'
                                  ? 'confirmacao'
                                  : reserva.status === 'Concluída'
                                  ? 'checkout'
                                  : 'boas_vindas'
                              );
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1.5 bg-[#25D366] hover:bg-[#1fba58] active:scale-95 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
                            title="Enviar WhatsApp ao Hóspede (Templates Oficiais)"
                          >
                            <span className="material-symbols-outlined text-[15px]">chat</span>
                            <span className="hidden xl:inline">WhatsApp</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReserva(reserva);
                              setIsVerModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-xs font-medium transition-all shadow-xs cursor-pointer"
                            title="Ver Detalhes"
                          >
                            <span className="material-symbols-outlined text-[15px]">visibility</span>
                            <span className="hidden xl:inline">Ver</span>
                          </button>
                          <button
                            onClick={() => showToast(`Editar reserva ${reserva.reservaNumber}`)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 bg-[#FDB116] hover:bg-amber-500 active:scale-95 text-slate-900 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
                            title="Editar Reserva"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                            <span className="hidden xl:inline">Editar</span>
                          </button>
                          <button
                            onClick={() => setReservaToDelete(reserva)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-lg text-xs font-medium transition-all shadow-xs cursor-pointer"
                            title="Excluir Reserva"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                            <span className="hidden xl:inline">Excluir</span>
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
          /* VISUALIZAÇÃO 2: MODO GRADE (CARDS DESKTOP) */
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredReservas.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400">
                  Nenhuma reserva encontrada com os filtros selecionados.
                </div>
              ) : (
                paginatedReservas.map((reserva) => (
                  <div
                    key={reserva.id}
                    className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between relative group"
                  >
                    <div>
                      {/* Header do Card: ID + Data + Badge Status */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {reserva.reservaNumber}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">{reserva.dataCriacao}</span>
                        </div>
                        {getStatusBadge(reserva.status)}
                      </div>

                      {/* Informações do Hóspede */}
                      <div className="flex items-start gap-3.5 mt-4">
                        <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center shrink-0">
                          {reserva.hospedeIniciais}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-slate-900 text-base leading-tight truncate">
                            {reserva.hospedeNome}
                          </h3>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{reserva.hospedeEmail}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{reserva.hospedeTelefone}</p>
                        </div>
                      </div>

                      {/* Detalhes da Acomodação e Estadia */}
                      <div className="bg-slate-50 rounded-xl p-3.5 mt-4 space-y-2.5 border border-slate-100">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-slate-400">meeting_room</span>
                            Acomodação
                          </span>
                          <span className="font-bold text-slate-800">
                            {reserva.quartoNome} • {reserva.quartoTipo}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-slate-400">date_range</span>
                            Período
                          </span>
                          <span className="font-semibold text-slate-700">
                            {reserva.checkIn} a {reserva.checkOut}{' '}
                            <span className="text-slate-400 font-normal">({reserva.noites} noites)</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                          <span className="text-slate-500 font-medium flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-slate-400">payments</span>
                            Valor Total
                          </span>
                          <span className="font-extrabold text-sm text-slate-900">{reserva.valorTotal}</span>
                        </div>
                      </div>
                    </div>

                    {/* Botões de Ação Padronizados nos Cards */}
                    <div className="flex items-center gap-2 mt-5 pt-3 border-t border-slate-100 flex-wrap">
                      {reserva.status === 'Hospedado' && (
                        <button
                          onClick={() => setCheckoutModalReserva(reserva)}
                          className="flex-1 py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                          title="Check-out & Receber"
                        >
                          <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
                          Check-out
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setWhatsappModalReserva(reserva);
                          setWhatsappDefaultTemplate(
                            reserva.status === 'Confirmada'
                              ? 'confirmacao'
                              : reserva.status === 'Concluída'
                              ? 'checkout'
                              : 'boas_vindas'
                          );
                        }}
                        className="py-2 px-2.5 bg-[#25D366] hover:bg-[#1fba58] text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1 shadow-sm transition-colors cursor-pointer"
                        title="Enviar WhatsApp ao Hóspede"
                      >
                        <span className="material-symbols-outlined text-[16px]">chat</span>
                        WhatsApp
                      </button>
                      <button
                        onClick={() => {
                          setSelectedReserva(reserva);
                          setIsVerModalOpen(true);
                        }}
                        className="flex-1 py-2 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        Ver
                      </button>
                      <button
                        onClick={() => showToast(`Editar reserva ${reserva.reservaNumber}`)}
                        className="flex-1 py-2 px-2.5 bg-[#FDB116] hover:bg-[#e59f13] text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        Editar
                      </button>
                      <button
                        onClick={() => setReservaToDelete(reserva)}
                        className="flex-1 py-2 px-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        Excluir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Paginação Padronizada Desktop */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
          <span className="text-sm text-slate-500">
            Exibindo <span className="font-semibold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> a{' '}
            <span className="font-semibold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredReservas.length)}</span> de{' '}
            <span className="font-semibold text-slate-800">{filteredReservas.length}</span> reservas
          </span>
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-1.5 border border-slate-200 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-sm font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                  currentPage === page
                    ? 'bg-[#003400] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 border border-slate-200 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>

      </div>

      {/* MODAL VER DETALHES DA RESERVA (Padrão Registrado no DESIGN.md) */}
      {isVerModalOpen && selectedReserva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header Escuro Padrão #003400 */}
            <div className="bg-[#003400] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-xl">calendar_month</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">Detalhes da Reserva</h2>
                  <p className="text-xs text-emerald-300 font-mono">{selectedReserva.reservaNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setIsVerModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#b91c1c] hover:bg-red-700 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Fechar"
              >
                <span className="material-symbols-outlined text-sm font-bold">close</span>
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
              
              {/* Card Hero: Hóspede e Status */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-full bg-[#003400] text-white font-bold text-base flex items-center justify-center shrink-0">
                    {selectedReserva.hospedeIniciais}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg leading-snug">{selectedReserva.hospedeNome}</h3>
                    <p className="text-xs text-slate-500">{selectedReserva.hospedeEmail}</p>
                    <p className="text-xs text-slate-400">{selectedReserva.hospedeTelefone}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-2">
                  <div>{getStatusBadge(selectedReserva.status)}</div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-start sm:justify-end pt-1">
                    {selectedReserva.status !== 'Hospedado' && selectedReserva.status !== 'Concluída' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedReserva.id, 'Hospedado')}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                        title="Registrar Check-in agora"
                      >
                        <span className="material-symbols-outlined text-[14px]">login</span>
                        Check-in
                      </button>
                    )}
                    {selectedReserva.status !== 'Concluída' && selectedReserva.status !== 'Cancelada' && (
                      <button
                        type="button"
                        onClick={() => {
                          const res = selectedReserva;
                          setIsVerModalOpen(false);
                          setCheckoutModalReserva(res);
                        }}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-2xs flex items-center gap-1 active:scale-95"
                        title="Check-out & Recebimento de Estadia (Sincronizado com Caixa)"
                      >
                        <span className="material-symbols-outlined text-[14px]">point_of_sale</span>
                        Check-out & Receber
                      </button>
                    )}
                    {selectedReserva.status !== 'Cancelada' && selectedReserva.status !== 'Concluída' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedReserva.id, 'Cancelada')}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                        title="Cancelar Reserva"
                      >
                        <span className="material-symbols-outlined text-[14px]">cancel</span>
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* AVISO INTELIGENTE DE STATUS / LIMPEZA */}
              {selectedReserva.status === 'Concluída' ? (
                <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <span className="material-symbols-outlined text-xl">cleaning_services</span>
                  </div>
                  <div className="text-xs text-amber-900 leading-snug">
                    <strong className="block font-bold mb-0.5">Quarto Liberado e em Limpeza</strong>
                    <span>O check-out desta estadia foi finalizado. O status do quarto foi alterado para <strong>Limpeza</strong> para a equipe de governança.</span>
                  </div>
                </div>
              ) : selectedReserva.status === 'Hospedado' ? (
                <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-blue-900">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-lg">schedule</span>
                    </div>
                    <div>
                      <span className="font-bold block">Check-out previsto até as 12:00</span>
                      <span className="text-[11px] text-blue-700">Pode ser feito manualmente pela recepção ou o sistema finaliza automaticamente às 12:00.</span>
                    </div>
                  </div>
                  <span className="hidden sm:inline-block px-2.5 py-1 rounded-md bg-blue-100/80 text-blue-800 font-bold text-[10px] uppercase tracking-wider shrink-0">
                    Auto 12:00 Ativo
                  </span>
                </div>
              ) : null}

              {/* Grid 2 Colunas: Estadia e Quarto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">meeting_room</span>
                    Acomodação
                  </div>
                  <div className="text-base font-bold text-slate-900">{selectedReserva.quartoNome}</div>
                  <div className="text-xs text-slate-600">Tipo: {selectedReserva.quartoTipo}</div>
                </div>

                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">date_range</span>
                    Período da Estadia
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {selectedReserva.checkIn} ➔ {selectedReserva.checkOut}
                  </div>
                  <div className="text-xs text-emerald-700 font-semibold">{selectedReserva.noites} Noites reservadas</div>
                </div>
              </div>

              {/* Detalhes Financeiros */}
              <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">payments</span>
                    Forma de Pagamento
                  </div>
                  <div className="text-sm font-medium text-slate-800 mt-1">
                    {selectedReserva.formaPagamento || 'Não informada'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 font-medium">Valor Total da Reserva</div>
                  <div className="text-2xl font-black text-slate-900">{selectedReserva.valorTotal}</div>
                </div>
              </div>

              {/* Observações */}
              {selectedReserva.observacao && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">sticky_note_2</span>
                    Observações Internas
                  </div>
                  <p className="text-sm text-slate-700 italic">"{selectedReserva.observacao}"</p>
                </div>
              )}

            </div>

            {/* Rodapé Compacto com Ações alinhadas à direita */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsVerModalOpen(false)}
                className="px-5 py-2.5 bg-[#b91c1c] hover:bg-red-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition-colors cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">close</span>
                <span>Fechar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {reservaToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Excluir Reserva</h3>
            </div>
            <p className="text-sm text-slate-600">
              Tem certeza que deseja excluir permanentemente a reserva{' '}
              <strong className="text-slate-900">{reservaToDelete.reservaNumber}</strong> de{' '}
              <strong className="text-slate-900">{reservaToDelete.hospedeNome}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setReservaToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteReserva}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CHECKOUT & RECEBIMENTO DE ESTADIA (SINCRONIZADO COM CAIXA) */}
      <ModalCheckoutRecebimento
        isOpen={!!checkoutModalReserva}
        reserva={checkoutModalReserva}
        onClose={() => setCheckoutModalReserva(null)}
        onSuccess={() => {
          fetchReservas();
          setCheckoutModalReserva(null);
        }}
      />

      {/* MODAL DE CHECK-IN / ENTRADA DO HÓSPEDE (FNRH, CHAVE & DIÁRIA) */}
      <ModalCheckinEntrada
        isOpen={!!checkinModalReserva}
        reserva={checkinModalReserva}
        onClose={() => setCheckinModalReserva(null)}
        onSuccess={() => {
          fetchReservas();
          setCheckinModalReserva(null);
        }}
      />

      {/* MODAL DE DISPARO DE TEMPLATES DE WHATSAPP (EVOLUTION API) */}
      {whatsappModalReserva && (
        <ModalEnviarTemplateWhatsApp
          isOpen={Boolean(whatsappModalReserva)}
          onClose={() => setWhatsappModalReserva(null)}
          hotelId={whatsappModalReserva.hotel_id}
          hospedeNome={whatsappModalReserva.hospedeNome}
          hospedeTelefone={whatsappModalReserva.hospedeTelefone}
          quartoNome={whatsappModalReserva.quartoNome}
          quartoTipo={whatsappModalReserva.quartoTipo}
          checkIn={formatDateBR(whatsappModalReserva.checkIn)}
          checkOut={formatDateBR(whatsappModalReserva.checkOut)}
          valorTotal={whatsappModalReserva.valorTotal}
          defaultTemplate={whatsappDefaultTemplate}
          onSuccess={(msg) => showToast(msg)}
        />
      )}

    </div>
  );
};

export default ListagemReservas;
