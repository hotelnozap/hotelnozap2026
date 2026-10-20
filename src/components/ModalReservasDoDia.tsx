import React, { useState, useEffect } from 'react';
import { autoNoShowService, ResumoReservasDia, isReservaComAtrasoAvisado } from '../services/autoNoShowService';
import { reservasService, quartosService } from '../services/supabaseService';

export interface ModalReservasDoDiaProps {
  isOpen: boolean;
  onClose: () => void;
  hotelId?: string;
  onRealizarCheckin?: (reservaId: string) => void;
  onRealizarCheckout?: (reservaId: string) => void;
}

export const ModalReservasDoDia: React.FC<ModalReservasDoDiaProps> = ({
  isOpen,
  onClose,
  hotelId,
  onRealizarCheckin,
  onRealizarCheckout
}) => {
  const [resumo, setResumo] = useState<ResumoReservasDia | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'checkins' | 'noshow' | 'checkouts'>('checkins');
  const [loading, setLoading] = useState<boolean>(true);
  const [acaoLoading, setAcaoLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // 1. Executa a checagem de No-Show antes de carregar o resumo
      await autoNoShowService.verificarEExecutarNoShows();
      
      // 2. Carrega o resumo do dia
      const dados = await autoNoShowService.obterResumoReservasDoDia(hotelId);
      setResumo(dados);

      // Define aba inicial com base nas prioridades
      if (dados.checkinsHoje.length > 0) {
        setAbaAtiva('checkins');
      } else if (dados.noShowsCancelados.length > 0) {
        setAbaAtiva('noshow');
      } else if (dados.checkoutsHoje.length > 0) {
        setAbaAtiva('checkouts');
      }
    } catch (err) {
      console.warn('Erro ao carregar resumo de reservas do dia:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      carregarDados();
    }
  }, [isOpen, hotelId]);

  // Listener para reatualizar se houver novo No-Show ou alteração de reserva
  useEffect(() => {
    const handleUpdate = () => {
      if (isOpen) carregarDados();
    };

    window.addEventListener('hotel_reserva_noshow', handleUpdate);
    window.addEventListener('hotel_reserva_modificada', handleUpdate);
    return () => {
      window.removeEventListener('hotel_reserva_noshow', handleUpdate);
      window.removeEventListener('hotel_reserva_modificada', handleUpdate);
    };
  }, [isOpen]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Ação rápida: Fazer Check-in direto pelo modal
  const handleCheckinRapido = async (res: any) => {
    setAcaoLoading(res.id);
    try {
      if (onRealizarCheckin) {
        onRealizarCheckin(res.id);
        onClose();
        return;
      }

      const resUpdate = await reservasService.realizarCheckin(res.id, {
        observacoes: 'Check-in rápido realizado pelo Painel de Reservas do Dia'
      });
      if (resUpdate.success) {
        showToast(`✅ Check-in de ${res.nome_hospede} realizado com sucesso! Quarto ${res.numero_quarto} ocupado.`);
        await carregarDados();
      } else {
        showToast(`⚠️ Não foi possível realizar o check-in: ${resUpdate.error || 'Erro'}`);
      }
    } catch (err: any) {
      showToast(`❌ Erro: ${err?.message || 'Falha na conexão'}`);
    } finally {
      setAcaoLoading(null);
    }
  };

  // Ação rápida: Fazer Check-out direto pelo modal
  const handleCheckoutRapido = async (res: any) => {
    setAcaoLoading(res.id);
    try {
      if (onRealizarCheckout) {
        onRealizarCheckout(res.id);
        onClose();
        return;
      }

      const resUpdate = await reservasService.realizarCheckout(res.id);
      if (resUpdate.success) {
        showToast(`✅ Check-out de ${res.nome_hospede} finalizado! Quarto ${res.numero_quarto} liberado para limpeza.`);
        await carregarDados();
      } else {
        showToast(`⚠️ Não foi possível realizar o check-out`);
      }
    } catch (err: any) {
      showToast(`❌ Erro: ${err?.message || 'Falha na conexão'}`);
    } finally {
      setAcaoLoading(null);
    }
  };

  // Fechar modal e reconhecer no-shows para que sumam definitivamente
  const handleFecharModal = () => {
    if (resumo?.noShowsCancelados && resumo.noShowsCancelados.length > 0) {
      resumo.noShowsCancelados.forEach((r: any) => {
        try {
          localStorage.setItem(`noshow_reconhecido_${r.id}`, 'true');
        } catch {}
      });
    }
    onClose();
  };

  // Dispensar um alerta de No-Show individual
  const handleDispensarNoShow = (reservaId: string) => {
    try {
      localStorage.setItem(`noshow_reconhecido_${reservaId}`, 'true');
      showToast('Alerta de cancelamento dispensado.');
      carregarDados();
    } catch {}
  };

  // Abrir WhatsApp do hóspede
  const handleAbrirWhatsApp = (telefone?: string, nome?: string) => {
    if (!telefone) {
      alert('Telefone do hóspede não cadastrado.');
      return;
    }
    const clean = telefone.replace(/\D/g, '');
    const num = clean.startsWith('55') ? clean : `55${clean}`;
    const texto = encodeURIComponent(`Olá ${nome || 'hóspede'}, estamos em contato a respeito da sua reserva no hotel!`);
    window.open(`https://wa.me/${num}?text=${texto}`, '_blank');
  };

  if (!isOpen) return null;

  const dataAtualFormatada = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Cabeçalho */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-950 via-[#003400] to-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <span className="material-symbols-outlined text-amber-300 text-2xl animate-pulse">hotel_class</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight">Painel de Reservas do Dia</h2>
                <span className="text-[10px] bg-amber-400 text-emerald-950 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Abertura do Sistema
                </span>
              </div>
              <p className="text-xs text-emerald-200/90 capitalize mt-0.5">
                {dataAtualFormatada} • Check-in a partir das 12:00 (Tolerância até 20:00)
              </p>
            </div>
          </div>

          <button
            onClick={handleFecharModal}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            title="Fechar Janela"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Toast Notificação */}
        {toastMsg && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold text-center shadow-inner animate-fadeIn">
            {toastMsg}
          </div>
        )}

        {/* Abas Superiores */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 flex gap-2 overflow-x-auto">
          
          <button
            type="button"
            onClick={() => setAbaAtiva('checkins')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              abaAtiva === 'checkins'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-base">login</span>
            <span>Check-ins de Hoje</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              abaAtiva === 'checkins' ? 'bg-white text-emerald-900' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {resumo?.checkinsHoje.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('noshow')}
            className={`flex-1 min-w-[160px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              abaAtiva === 'noshow'
                ? 'bg-red-700 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-base">event_busy</span>
            <span>No-Show (1h Tolerância)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              abaAtiva === 'noshow' ? 'bg-white text-red-900' : 'bg-red-100 text-red-800'
            }`}>
              {resumo?.noShowsCancelados.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('checkouts')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              abaAtiva === 'checkouts'
                ? 'bg-blue-800 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-base">logout</span>
            <span>Check-outs de Hoje</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              abaAtiva === 'checkouts' ? 'bg-white text-blue-900' : 'bg-blue-100 text-blue-800'
            }`}>
              {resumo?.checkoutsHoje.length || 0}
            </span>
          </button>

        </div>

        {/* Conteúdo Central */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full border-4 border-emerald-300 border-t-emerald-800 animate-spin mb-3" />
              <p className="text-sm font-bold text-slate-700">Verificando reservas e tolerâncias no sistema...</p>
            </div>
          ) : (
            <>
              {/* ABA 1: CHECK-INS DE HOJE */}
              {abaAtiva === 'checkins' && (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-700">info</span>
                      <span>
                        <strong>Regra de Entrada:</strong> Check-in a partir das <strong>12:00</strong>. Hóspedes têm até <strong>20:00</strong> (tolerância de 8 horas). Caso o hóspede avise imprevisto na viagem (carro quebrou, trânsito), o quarto permanece protegido.
                      </span>
                    </div>
                  </div>

                  {resumo?.checkinsHoje.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <span className="material-symbols-outlined text-4xl mb-1 text-slate-300">done_all</span>
                      <p className="text-sm font-bold text-slate-600">Nenhum check-in pendente para hoje</p>
                      <p className="text-xs text-slate-400">Todos os hóspedes previstos já realizaram a entrada ou não há chegadas agendadas.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {resumo?.checkinsHoje.map((res: any) => {
                        const shortId = res.id ? res.id.substring(0, 6).toUpperCase() : 'RES';
                        const temAtrasoAvisado = isReservaComAtrasoAvisado(res);
                        return (
                          <div 
                            key={res.id} 
                            className={`bg-white p-4 rounded-xl border-2 shadow-xs transition-all flex flex-col justify-between ${
                              temAtrasoAvisado ? 'border-amber-400/80 bg-amber-50/20' : 'border-emerald-500/30 hover:border-emerald-600'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="font-mono text-xs font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                                  #{shortId}
                                </span>
                                <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  Quarto {res.numero_quarto}
                                </span>
                              </div>

                              <h4 className="text-sm font-bold text-slate-900 truncate">
                                {res.nome_hospede}
                              </h4>

                              {temAtrasoAvisado && (
                                <div className="mt-1">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                                    <span className="material-symbols-outlined text-[13px]">directions_car</span>
                                    Atraso Avisado (Chegada Tardia) • Quarto Protegido
                                  </span>
                                </div>
                              )}

                              <div className="text-xs text-slate-600 space-y-0.5 mt-2">
                                <p className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs text-slate-400">schedule</span>
                                  Check-in: <strong>12:00</strong> (Tolerância máx: <strong>20:00</strong>)
                                </p>
                                <p className="flex items-center gap-1 font-semibold text-emerald-800">
                                  <span className="material-symbols-outlined text-xs text-emerald-600">payments</span>
                                  Valor Total: R$ {Number(res.valor_total || 0).toFixed(2)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleCheckinRapido(res)}
                                disabled={acaoLoading === res.id}
                                className="flex-1 py-2 px-3 rounded-lg bg-[#003400] hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-sm">login</span>
                                {acaoLoading === res.id ? 'Entrando...' : 'Fazer Check-in'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleAbrirWhatsApp(res.telefone_hospede || res.telefone, res.nome_hospede)}
                                className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs flex items-center justify-center transition-all cursor-pointer"
                                title="Abrir conversa no WhatsApp"
                              >
                                <span className="material-symbols-outlined text-base">chat</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ABA 2: NO-SHOW E QUARTOS LIBERADOS */}
              {abaAtiva === 'noshow' && (
                <div className="space-y-3">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-950 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-red-600">warning</span>
                      <span>
                        <strong>Quartos Desocupados Automaticamente:</strong> Estas reservas ultrapassaram o limite de 8 horas de tolerância (após as 20:00) sem comparecimento nem aviso de atraso e foram canceladas. Os quartos voltaram ao status <strong>Disponível</strong> para você vender no balcão ou catálogo!
                      </span>
                    </div>
                  </div>

                  {resumo?.noShowsCancelados.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <span className="material-symbols-outlined text-4xl mb-1 text-slate-300">verified</span>
                      <p className="text-sm font-bold text-slate-600">Nenhum No-Show recente registrado</p>
                      <p className="text-xs text-slate-400">Nenhuma reserva foi cancelada por expiração de tolerância recentemente.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {resumo?.noShowsCancelados.map((res: any) => {
                        const shortId = res.id ? res.id.substring(0, 6).toUpperCase() : 'RES';
                        return (
                          <div 
                            key={res.id} 
                            className="bg-white p-4 rounded-xl border-2 border-red-300 shadow-xs flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="font-mono text-xs font-bold text-red-900 bg-red-100 px-2 py-0.5 rounded">
                                  #{shortId} - Cancelada
                                </span>
                                <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                  Quarto {res.numero_quarto} LIVRE
                                </span>
                              </div>

                              <h4 className="text-sm font-bold text-slate-800 truncate">
                                {res.nome_hospede}
                              </h4>

                              <p className="text-xs text-red-700 font-semibold mt-1">
                                ⚠️ Não compareceu até às 20:00 (8h de tolerância sem aviso prévio)
                              </p>

                              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                                {res.observacoes || 'Reserva cancelada automaticamente pelo robô de No-Show.'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                              <span className="text-xs text-slate-500 font-medium">
                                Quarto disponível para nova locação.
                              </span>
                              <div className="ml-auto flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDispensarNoShow(res.id)}
                                  className="py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                                  title="Dispensar este alerta"
                                >
                                  <span className="material-symbols-outlined text-sm">visibility_off</span>
                                  Dispensar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAbrirWhatsApp(res.telefone_hospede || res.telefone, res.nome_hospede)}
                                  className="py-1.5 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-sm">chat</span>
                                  WhatsApp
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ABA 3: CHECK-OUTS DE HOJE */}
              {abaAtiva === 'checkouts' && (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-950 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-700">info</span>
                      <span>
                        <strong>Check-outs do Dia:</strong> Hóspedes previstos para desocupar o quarto hoje. O sistema executa o checkout automático a partir das 07:00, ou você pode finalizar manualmente.
                      </span>
                    </div>
                  </div>

                  {resumo?.checkoutsHoje.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <span className="material-symbols-outlined text-4xl mb-1 text-slate-300">logout</span>
                      <p className="text-sm font-bold text-slate-600">Nenhum check-out pendente para hoje</p>
                      <p className="text-xs text-slate-400">Não há partidas programadas para esta data.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {resumo?.checkoutsHoje.map((res: any) => {
                        const shortId = res.id ? res.id.substring(0, 6).toUpperCase() : 'RES';
                        return (
                          <div 
                            key={res.id} 
                            className="bg-white p-4 rounded-xl border border-blue-200 shadow-xs flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="font-mono text-xs font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded">
                                  #{shortId}
                                </span>
                                <span className="text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  Quarto {res.numero_quarto}
                                </span>
                              </div>

                              <h4 className="text-sm font-bold text-slate-900 truncate">
                                {res.nome_hospede}
                              </h4>

                              <p className="text-xs text-slate-600 mt-1">
                                Status atual: <strong className="capitalize">{res.status}</strong>
                              </p>
                            </div>

                            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleCheckoutRapido(res)}
                                disabled={acaoLoading === res.id}
                                className="flex-1 py-2 px-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-sm">logout</span>
                                {acaoLoading === res.id ? 'Finalizando...' : 'Finalizar Check-out'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>

        {/* Rodapé */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="material-symbols-outlined text-emerald-700 text-sm">verified</span>
            <span>Verificação contínua ativa: tolerância de 1 hora aplicada a todas as reservas.</span>
          </div>

          <button
            type="button"
            onClick={handleFecharModal}
            className="w-full sm:w-auto py-2.5 px-6 rounded-xl bg-[#003400] hover:bg-black text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            Entendido, Acessar Sistema
          </button>
        </div>

      </div>
    </div>
  );
};

export default ModalReservasDoDia;
