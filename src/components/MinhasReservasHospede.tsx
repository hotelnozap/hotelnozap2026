import React, { useState, useEffect } from 'react';
import { hospedesService } from '../services/supabaseService';

export interface MinhasReservasHospedeProps {
  userRole?: string;
  userName?: string;
  userEmail?: string;
  onNavigateBack?: () => void;
}

export interface ReservaItemFull {
  id: string;
  codigo: string;
  quartoNumero: string;
  quartoNome: string;
  hotelNome: string;
  hotelCidade: string;
  checkIn: string;
  checkOut: string;
  diarias: number;
  detalheDiaria?: string;
  hospedes: string;
  valorTotal: number;
  formaPagamento: string;
  status: 'Hospedado' | 'Confirmada' | 'Garantida' | 'Concluída' | 'Cancelada';
  isAtiva?: boolean;
}

export const MinhasReservasHospede: React.FC<MinhasReservasHospedeProps> = ({
  userRole = 'hospede',
  userName = 'Hóspede',
  userEmail = '',
  onNavigateBack,
}) => {
  // Estado do Filtro por Status
  const [selectedStatus, setSelectedStatus] = useState<string>('todas');
  // Estado do Campo de Busca Textual
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Toast System
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modais
  const [selectedVoucher, setSelectedVoucher] = useState<ReservaItemFull | null>(null);
  const [cancelModalReserva, setCancelModalReserva] = useState<ReservaItemFull | null>(null);

  // Lista de Reservas Real
  const [reservas, setReservas] = useState<ReservaItemFull[]>([]);

  useEffect(() => {
    const carregarReservasReais = async () => {
      try {
        const perfil = await hospedesService.getPerfilHospedeLogado(userEmail || userName);
        if (perfil?.historicoReservas && perfil.historicoReservas.length > 0) {
          const mapped: ReservaItemFull[] = perfil.historicoReservas.map((r: any, idx: number) => {
            const isAtiva = (r.status || '').toLowerCase() === 'hospedado' || (r.status || '').toLowerCase() === 'em andamento';
            return {
              id: r.id || String(idx + 1),
              codigo: r.codigo || `#RES-${idx + 100}`,
              quartoNumero: r.quartoNumero || perfil.quartoNumero || '—',
              quartoNome: r.quarto || perfil.quartoNome || 'Quarto',
              hotelNome: r.hotel || perfil.hotelNome || 'Hotel',
              hotelCidade: r.hotelCidade || perfil.hotelCidadeUf || '',
              checkIn: r.checkIn || '',
              checkOut: r.checkOut || '',
              diarias: r.diarias || 1,
              detalheDiaria: isAtiva ? `Dia 1 de ${r.diarias || 1}` : `${r.diarias || 1} diárias`,
              hospedes: '1 Hóspede',
              valorTotal: r.valorTotal || 0,
              formaPagamento: 'Confirmado no Hotel',
              status: (r.status as any) || 'Confirmada',
              isAtiva,
            };
          });
          setReservas(mapped);
        } else {
          setReservas([]);
        }
      } catch (err) {
        console.error('Erro ao buscar reservas em MinhasReservasHospede:', err);
      }
    };
    carregarReservasReais();
  }, [userEmail, userName]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filtragem Dinâmica por Status e Busca
  const filteredReservas = reservas.filter((res) => {
    const matchesSearch =
      res.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.hotelNome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.quartoNome.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedStatus === 'todas') return true;
    if (selectedStatus === 'ativa') return res.status === 'Hospedado';
    if (selectedStatus === 'confirmadas') return res.status === 'Confirmada' || res.status === 'Garantida';
    if (selectedStatus === 'concluidas') return res.status === 'Concluída';
    if (selectedStatus === 'canceladas') return res.status === 'Cancelada';

    return true;
  });

  const handleConfirmCancel = () => {
    if (!cancelModalReserva) return;
    setReservas(
      reservas.map((r) => (r.id === cancelModalReserva.id ? { ...r, status: 'Cancelada', formaPagamento: 'Cancelado a pedido' } : r))
    );
    showToast(`Reserva ${cancelModalReserva.codigo} cancelada com sucesso.`);
    setCancelModalReserva(null);
  };

  const handleRepeatBooking = (reserva: ReservaItemFull) => {
    showToast(`Solicitação de nova reserva para "${reserva.quartoNome}" enviada!`);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased">
      {/* TOAST SYSTEM NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#003400] text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400/30 flex items-center gap-3 animate-in fade-in slide-in-from-top duration-200">
          <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HEADER MOBILE (Dispositivos móveis / < lg)                                */}
      {/* ========================================================================= */}
      <header className="lg:hidden sticky top-0 z-40 bg-gradient-to-r from-[#003400] to-[#000000] text-white px-4 py-3.5 shadow-md flex items-center justify-between border-b border-emerald-950/40">
        <div className="flex items-center gap-2.5">
          <button onClick={onNavigateBack} className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/15 active:scale-95 flex items-center justify-center transition-transform">
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <div>
            <span className="text-[10px] tracking-widest text-emerald-400 font-semibold block leading-none">PORTAL DO HÓSPEDE</span>
            <h1 className="text-base font-extrabold tracking-wider leading-tight text-white uppercase">HOTEL NO ZAP</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => showToast('Sem novas notificações')} className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/15 active:scale-95 flex items-center justify-center relative transition-transform">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400"></span>
          </button>
          <div className="w-9 h-9 rounded-lg bg-white/20 text-white font-bold text-xs flex items-center justify-center border border-white/20">
            {(userName || 'HO').substring(0, 2).toUpperCase()}
          </div>
        </div>
      </header>

      {/* CONTAINER PRINCIPAL */}
      <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6 pb-28 lg:pb-12">
        
        {/* NAVEGAÇÃO SUPERIOR / VOLTAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1">
            <button
              onClick={onNavigateBack}
              className="inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold text-emerald-800 hover:text-emerald-950 transition-colors group cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px] transition-transform group-hover:-translate-x-1">arrow_back</span>
              Voltar para Minha Conta
            </button>
            <div className="flex items-center gap-3 pt-1">
              <h1 className="text-xl md:text-3xl font-bold text-slate-900 tracking-tight">Minhas Reservas</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Hóspede VIP
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500">Histórico completo, estadias ativas e vouchers confirmados para {userName}.</p>
          </div>

          {/* Ações Rápidas do Topo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => showToast('Histórico completo exportado em PDF!')}
              className="inline-flex items-center gap-2 px-3.5 md:px-4 py-2 md:py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs md:text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-slate-500">file_download</span>
              <span className="hidden sm:inline">Exportar Histórico</span>
              <span className="sm:hidden">Exportar</span>
            </button>
            <button
              onClick={() => showToast('Redirecionando para novo catálogo de hotéis...')}
              className="inline-flex items-center gap-2 px-4 py-2 md:py-2.5 rounded-xl bg-[#003400] text-white text-xs md:text-sm font-semibold hover:bg-emerald-900 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Nova Reserva
            </button>
          </div>
        </div>

        {/* CARDS DE INDICADORES (KPIS DO HÓSPEDE) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* Total de Reservas */}
          <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium uppercase tracking-wider text-slate-500">Total de Reservas</p>
              <h3 className="text-xl md:text-2xl font-bold text-slate-900 mt-1">{reservas.length}</h3>
              <p className="text-[10px] md:text-xs text-emerald-600 font-medium mt-1">4 estadias este ano</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl md:text-2xl">hotel</span>
            </div>
          </div>

          {/* Em Andamento / Ativa */}
          <div className="bg-white rounded-2xl p-4 md:p-5 border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/40 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium uppercase tracking-wider text-emerald-700">Estadia Ativa</p>
              <h3 className="text-xl md:text-2xl font-bold text-emerald-900 mt-1">1 Ativa</h3>
              <p className="text-[10px] md:text-xs text-emerald-700 font-medium mt-1 truncate">Suíte Master King • 204</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <span className="material-symbols-outlined text-xl md:text-2xl">key</span>
            </div>
          </div>

          {/* Futuras / Confirmadas */}
          <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium uppercase tracking-wider text-slate-500">Próximas Viagens</p>
              <h3 className="text-xl md:text-2xl font-bold text-slate-900 mt-1">2 Confirmadas</h3>
              <p className="text-[10px] md:text-xs text-slate-500 mt-1">Próxima em 18 de Abril</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl md:text-2xl">calendar_month</span>
            </div>
          </div>

          {/* Pontos de Fidelidade */}
          <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium uppercase tracking-wider text-slate-500">Programa Fidelidade</p>
              <h3 className="text-xl md:text-2xl font-bold text-purple-700 mt-1">2.450 pts</h3>
              <p className="text-[10px] md:text-xs text-purple-600 font-medium mt-1">Nível Ouro VIP</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl md:text-2xl">military_tech</span>
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS, BUSCA E ALTERNÂNCIA DE ABAS */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Abas Rápidas por Status */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
            <button
              onClick={() => setSelectedStatus('todas')}
              className={`px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedStatus === 'todas' ? 'bg-[#003400] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Todas ({reservas.length})
            </button>
            <button
              onClick={() => setSelectedStatus('ativa')}
              className={`px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedStatus === 'ativa' ? 'bg-[#003400] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Em Andamento ({reservas.filter(r => r.status === 'Hospedado' || r.isAtiva).length})
            </button>
            <button
              onClick={() => setSelectedStatus('confirmadas')}
              className={`px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedStatus === 'confirmadas' ? 'bg-[#003400] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Confirmadas ({reservas.filter(r => r.status === 'Confirmada' || r.status === 'Garantida').length})
            </button>
            <button
              onClick={() => setSelectedStatus('concluidas')}
              className={`px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedStatus === 'concluidas' ? 'bg-[#003400] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Concluídas ({reservas.filter(r => (r.status || '').toLowerCase().includes('conclu')).length})
            </button>
            <button
              onClick={() => setSelectedStatus('canceladas')}
              className={`px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedStatus === 'canceladas' ? 'bg-[#003400] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Canceladas ({reservas.filter(r => r.status === 'Cancelada').length})
            </button>
          </div>

          {/* Busca e Filtros */}
          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-64">
              <span className="material-symbols-outlined text-slate-400 absolute left-3 top-2.5 text-[18px]">search</span>
              <input
                type="text"
                placeholder="Buscar por código ou hotel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs md:text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
              />
            </div>
            <button
              onClick={() => showToast('Filtros avançados de data aplicados')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-xs md:text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-slate-500">tune</span>
              Filtros
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VISUALIZAÇÃO DESKTOP: TABELA COMPLETA (>= lg)                             */}
        {/* ========================================================================= */}
        <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th scope="col" className="py-3.5 px-5">Código & Acomodação</th>
                  <th scope="col" className="py-3.5 px-5">Hotel / Unidade</th>
                  <th scope="col" className="py-3.5 px-5">Período / Diárias</th>
                  <th scope="col" className="py-3.5 px-5">Hóspedes</th>
                  <th scope="col" className="py-3.5 px-5">Valor Total</th>
                  <th scope="col" className="py-3.5 px-5">Status</th>
                  <th scope="col" className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {filteredReservas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-4xl text-slate-300">calendar_month</span>
                        <p className="text-sm font-bold text-slate-700">Nenhuma reserva encontrada</p>
                        <p className="text-xs text-slate-400">Você ainda não possui reservas ou estadias registradas com este status.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredReservas.map((reserva) => (
                  <tr
                    key={reserva.id}
                    className={`hover:bg-slate-50/80 transition-colors ${reserva.isAtiva ? 'bg-emerald-50/20' : ''}`}
                  >
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs border ${
                            reserva.status === 'Hospedado'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : reserva.status === 'Confirmada'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : reserva.status === 'Garantida'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          #{reserva.quartoNumero}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{reserva.codigo}</span>
                            {reserva.isAtiva && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                Ativa Agora
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-medium">{reserva.quartoNome}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <div className="font-semibold text-slate-800">{reserva.hotelNome}</div>
                      <div className="text-xs text-slate-400">{reserva.hotelCidade}</div>
                    </td>
                    <td className="py-4 px-5">
                      <div className="font-medium text-slate-800">{reserva.checkIn} a {reserva.checkOut}</div>
                      <div className="text-xs text-slate-500 font-medium">
                        {reserva.diarias} diárias {reserva.detalheDiaria ? `(${reserva.detalheDiaria})` : ''}
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <span className="material-symbols-outlined text-[16px] text-slate-400">group</span>
                        <span>{reserva.hospedes}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-900">R$ {reserva.valorTotal.toFixed(2).replace('.', ',')}</div>
                      <div className="text-xs text-emerald-600 font-medium">{reserva.formaPagamento}</div>
                    </td>
                    <td className="py-4 px-5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          reserva.status === 'Hospedado'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : reserva.status === 'Confirmada'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : reserva.status === 'Garantida'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : reserva.status === 'Cancelada'
                            ? 'bg-red-100 text-red-800 border-red-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            reserva.status === 'Hospedado'
                              ? 'bg-emerald-600'
                              : reserva.status === 'Confirmada'
                              ? 'bg-blue-600'
                              : reserva.status === 'Garantida'
                              ? 'bg-amber-600'
                              : reserva.status === 'Cancelada'
                              ? 'bg-red-600'
                              : 'bg-slate-400'
                          }`}
                        ></span>
                        {reserva.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedVoucher(reserva)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                          title="Ver Detalhes do Voucher"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                          Ver
                        </button>

                        {reserva.status === 'Hospedado' && (
                          <a
                            href="https://wa.me/5581999998888?text=Ola%20Recepcao%20Hotel%20Master"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#003400] text-white text-xs font-semibold hover:bg-emerald-900 transition-colors shadow-sm"
                          >
                            <span className="material-symbols-outlined text-[16px]">chat</span>
                            Recepção
                          </a>
                        )}

                        {(reserva.status === 'Confirmada' || reserva.status === 'Garantida' || reserva.status === 'Hospedado') && (
                          <button
                            onClick={() => showToast(`Solicitação de alteração para reserva ${reserva.codigo} aberta!`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EA580C] text-white text-xs font-semibold hover:bg-orange-700 transition-colors shadow-sm cursor-pointer"
                            title="Editar Serviços & Solicitações"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            Editar
                          </button>
                        )}

                        {(reserva.status === 'Confirmada' || reserva.status === 'Garantida') && (
                          <button
                            onClick={() => setCancelModalReserva(reserva)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#DC2626] text-white text-xs font-semibold hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
                            title="Cancelar Reserva"
                          >
                            <span className="material-symbols-outlined text-[16px]">cancel</span>
                            Cancelar
                          </button>
                        )}

                        {reserva.status === 'Concluída' && (
                          <button
                            onClick={() => handleRepeatBooking(reserva)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#003400] text-white text-xs font-semibold hover:bg-emerald-900 transition-colors shadow-sm cursor-pointer"
                            title="Reservar Novamente"
                          >
                            <span className="material-symbols-outlined text-[16px]">replay</span>
                            Repetir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>

          {/* Rodapé da Listagem com Paginação */}
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              Mostrando <span className="font-semibold text-slate-700">1 a {filteredReservas.length}</span> de <span className="font-semibold text-slate-700">{reservas.length}</span> reservas cadastradas
            </div>
            <div className="flex items-center gap-1">
              <button className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-100 disabled:opacity-50" disabled>
                Anterior
              </button>
              <button className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#003400] text-white shadow-sm">
                1
              </button>
              <button className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                Próxima
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VISUALIZAÇÃO MOBILE: CARDS INDIVIDUAIS (< lg)                              */}
        {/* ========================================================================= */}
        <div className="lg:hidden space-y-3">
          {filteredReservas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">hotel</span>
              <p className="text-sm font-bold text-slate-700">Nenhuma reserva encontrada</p>
              <p className="text-xs text-slate-400 mt-1">Você ainda não possui reservas ou estadias registradas com este status.</p>
            </div>
          ) : (
            filteredReservas.map((res) => (
            <div
              key={res.id}
              className={`bg-white rounded-2xl border p-4 shadow-sm relative overflow-hidden ${
                res.isAtiva ? 'border-2 border-emerald-500/80' : 'border-slate-200'
              }`}
            >
              {res.isAtiva && (
                <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                  Hospedado Agora
                </div>
              )}

              <div className="flex items-start gap-3 pt-1">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm border ${
                    res.isAtiva
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : res.status === 'Confirmada'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : res.status === 'Garantida'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {res.quartoNumero}
                </div>
                <div className="flex-1 pr-16">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900">{res.codigo}</span>
                    {!res.isAtiva && (
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          res.status === 'Confirmada'
                            ? 'bg-blue-500'
                            : res.status === 'Garantida'
                            ? 'bg-amber-500'
                            : res.status === 'Cancelada'
                            ? 'bg-red-500'
                            : 'bg-slate-400'
                        }`}
                      ></span>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-700 mt-0.5">{res.quartoNome}</div>
                  <div className="text-[11px] text-slate-400">{res.hotelNome} • {res.hotelCidade}</div>
                </div>
              </div>

              {/* Detalhes de Período e Hóspedes */}
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-medium block">Período</span>
                  <span className="font-semibold text-slate-700">{res.checkIn} a {res.checkOut}</span>
                  <span className="text-[10px] text-slate-400 block">{res.diarias} diárias</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-medium block">Valor Total</span>
                  <span className="font-bold text-slate-900 text-sm">R$ {res.valorTotal.toFixed(2).replace('.', ',')}</span>
                  <span className="text-[10px] text-emerald-600 font-medium block">{res.formaPagamento}</span>
                </div>
              </div>

              {/* Ações Mobile */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => setSelectedVoucher(res)}
                  className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-semibold shadow-sm active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  Voucher
                </button>

                {res.isAtiva && (
                  <a
                    href="https://wa.me/5581999998888?text=Ola%20Recepcao%20Hotel%20Master"
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-xl bg-[#003400] text-white text-xs font-semibold shadow-sm active:scale-95 transition-transform"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat</span>
                    Recepção
                  </a>
                )}

                {(res.status === 'Confirmada' || res.status === 'Garantida' || res.isAtiva) && (
                  <button
                    onClick={() => showToast(`Solicitação de alteração para reserva ${res.codigo} aberta!`)}
                    className="p-2 rounded-xl bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors"
                    title="Editar Solicitação"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                )}

                {(res.status === 'Confirmada' || res.status === 'Garantida') && (
                  <button
                    onClick={() => setCancelModalReserva(res)}
                    className="p-2 rounded-xl bg-red-100 text-red-800 hover:bg-red-200 transition-colors"
                    title="Cancelar Reserva"
                  >
                    <span className="material-symbols-outlined text-[18px]">cancel</span>
                  </button>
                )}

                {res.status === 'Concluída' && (
                  <button
                    onClick={() => handleRepeatBooking(res)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-xl bg-[#003400] text-white text-xs font-semibold shadow-sm active:scale-95 transition-transform"
                  >
                    <span className="material-symbols-outlined text-[16px]">replay</span>
                    Repetir
                  </button>
                )}
              </div>
            </div>
          )))}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* BARRA DE NAVEGAÇÃO INFERIOR FIXA (MOBILE 390px)                           */}
      {/* ========================================================================= */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-3 py-2 flex items-center justify-around z-50 shadow-lg">
        <button onClick={onNavigateBack} className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-emerald-800 transition-colors">
          <span className="material-symbols-outlined text-[22px]">hotel</span>
          <span className="text-[10px] font-medium">Estadia</span>
        </button>

        <button className="flex flex-col items-center gap-0.5 text-[#003400] font-bold">
          <div className="w-10 h-7 rounded-full bg-emerald-100 text-[#003400] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">calendar_month</span>
          </div>
          <span className="text-[10px]">Reservas</span>
        </button>

        <button onClick={onNavigateBack} className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-emerald-800 transition-colors">
          <span className="material-symbols-outlined text-[22px]">room_service</span>
          <span className="text-[10px] font-medium">Pedidos</span>
        </button>

        <button onClick={onNavigateBack} className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-emerald-800 transition-colors">
          <span className="material-symbols-outlined text-[22px]">receipt_long</span>
          <span className="text-[10px] font-medium">Consumo</span>
        </button>

        <button onClick={onNavigateBack} className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-emerald-800 transition-colors">
          <span className="material-symbols-outlined text-[22px]">person</span>
          <span className="text-[10px] font-medium">Perfil</span>
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* MODAL DE VOUCHER DE RESERVA                                               */}
      {/* ========================================================================= */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
            <button onClick={() => setSelectedVoucher(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-lg">
                #{selectedVoucher.quartoNumero}
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">{selectedVoucher.status}</span>
                <h3 className="text-lg font-extrabold text-slate-900">{selectedVoucher.codigo}</h3>
                <p className="text-xs text-slate-500">{selectedVoucher.hotelNome}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Acomodação:</span>
                <span className="font-bold text-slate-800">{selectedVoucher.quartoNome}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Período:</span>
                <span className="font-bold text-slate-800">{selectedVoucher.checkIn} até {selectedVoucher.checkOut}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Hóspedes:</span>
                <span className="font-bold text-slate-800">{selectedVoucher.hospedes}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Pagamento:</span>
                <span className="font-bold text-emerald-700">{selectedVoucher.formaPagamento}</span>
              </div>
              <div className="flex justify-between pt-1 text-sm font-extrabold">
                <span className="text-slate-900">Valor Total:</span>
                <span className="text-emerald-900">R$ {selectedVoucher.valorTotal.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  showToast('Voucher impresso em PDF!');
                  setSelectedVoucher(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 text-xs"
              >
                Imprimir Voucher
              </button>
              <button
                onClick={() => setSelectedVoucher(null)}
                className="px-5 py-2.5 rounded-xl bg-[#003400] text-white font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CONFIRMAÇÃO DE CANCELAMENTO                                     */}
      {/* ========================================================================= */}
      {cancelModalReserva && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">Cancelar Reserva {cancelModalReserva.codigo}?</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Você está prestes a cancelar a reserva da <strong>{cancelModalReserva.quartoNome}</strong> em {cancelModalReserva.hotelNome}. O reembolso será processado conforme a política do hotel.
            </p>
            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={() => setCancelModalReserva(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 text-xs"
              >
                Manter Reserva
              </button>
              <button
                onClick={handleConfirmCancel}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MinhasReservasHospede;
