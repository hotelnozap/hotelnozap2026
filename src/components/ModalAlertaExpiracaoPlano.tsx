import React, { useState, useEffect } from 'react';
import { planosService } from '../services/supabaseService';
import { InfoCreditoHotel } from '../services/creditosService';
import { CheckoutPlanoStep } from './CheckoutPlanoStep';

export interface ModalAlertaExpiracaoPlanoProps {
  isOpen: boolean;
  onClose: () => void;
  hotel: any;
  infoCredito: InfoCreditoHotel;
  onPlanRenewed?: () => void;
}

export const ModalAlertaExpiracaoPlano: React.FC<ModalAlertaExpiracaoPlanoProps> = ({
  isOpen,
  onClose,
  hotel,
  infoCredito,
  onPlanRenewed
}) => {
  const [viewState, setViewState] = useState<'aviso' | 'planos' | 'checkout'>('aviso');
  const [planos, setPlanos] = useState<any[]>([]);
  const [loadingPlanos, setLoadingPlanos] = useState(false);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      setViewState('aviso');
      // Pré-carrega os planos disponíveis para renovação
      setLoadingPlanos(true);
      planosService.getPlanos().then(data => {
        const active = (data || []).filter((p: any) =>
          p.status !== 'Inativo' &&
          !p.name?.toLowerCase().includes('maps') &&
          !p.name?.toLowerCase().includes('legado') &&
          Number(p.basePrice) > 0
        ).sort((a: any, b: any) => {
          const ordA = Number(String(a.order || a.ordem || '').replace(/\D/g, '')) || 0;
          const ordB = Number(String(b.order || b.ordem || '').replace(/\D/g, '')) || 0;
          return ordA - ordB;
        });
        setPlanos(active);
        setLoadingPlanos(false);
      }).catch(() => setLoadingPlanos(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const diasRestantes = infoCredito?.diasRestantes ?? 0;
  const dataExpiracaoFormatada = infoCredito?.dataExpiracaoFormatada || 'em breve';
  const nomeHotel = hotel?.name || 'Hotel';
  const planoAtualNome = hotel?.plan || 'Abordagem Comercial (60 Dias Grátis)';

  const loginEmail = hotel?.loginEmail || hotel?.managerEmail || localStorage.getItem('hotelnozap_user_email') || '';
  const managerName = hotel?.managerName || localStorage.getItem('hotelnozap_user_name') || 'Gestor do Hotel';
  const cpfOuCnpj = hotel?.cnpj || hotel?.managerCpf || '';
  const whatsapp = hotel?.managerPhone || hotel?.whatsapp || '';

  const handleDismiss = () => {
    try {
      if (hotel?.id) {
        sessionStorage.setItem(`hotelnozap_alerta_expiracao_dismissed_${hotel.id}`, 'true');
      }
    } catch { /* ignore */ }
    onClose();
  };

  const handleSelectPlan = (plan: any) => {
    setSelectedPlanForCheckout(plan);
    setViewState('checkout');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superior de destaque com gradiente de urgência amigável */}
        <div className="h-2 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500" />

        {/* Cabeçalho */}
        <div className="p-6 sm:p-7 pb-4 flex items-start justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-2xl">hourglass_top</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Aviso de Vencimento
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {diasRestantes === 1 ? 'Resta 1 dia' : `Restam ${diasRestantes} dias`}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight mt-1">
                {viewState === 'checkout' ? 'Finalizar Renovação' : viewState === 'planos' ? 'Escolha seu Novo Plano' : 'Seu plano está prestes a expirar!'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Lembrar mais tarde"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Corpo do Modal com rolagem suave */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {/* TELA 1: AVISO E BENEFÍCIOS */}
          {viewState === 'aviso' && (
            <>
              <div className="bg-gradient-to-br from-amber-950/30 via-slate-800/60 to-slate-900 border border-amber-500/20 rounded-2xl p-5">
                <p className="text-sm sm:text-base leading-relaxed text-slate-200">
                  Olá, <strong className="text-white font-bold">{nomeHotel}</strong>! Seu período de cortesia no plano{' '}
                  <span className="text-amber-300 font-bold">{planoAtualNome}</span> encerra em{' '}
                  <strong className="text-white underline">{dataExpiracaoFormatada}</strong> ({diasRestantes} dia{diasRestantes > 1 ? 's' : ''} restante{diasRestantes > 1 ? 's' : ''}).
                </p>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                  Para garantir que o seu atendimento automatizado no WhatsApp não seja interrompido, renove antecipadamente com condições especiais de continuidade.
                </p>
              </div>

              {/* Card de Recursos que continuam ativos */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400 text-sm">verified</span>
                  Recursos que continuam ativos com a sua renovação:
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <span className="material-symbols-outlined text-base">smart_toy</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Super Agente IA 24/7</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Atendimento e orçamentos automáticos pelo WhatsApp sem pausas.</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <span className="material-symbols-outlined text-base">notifications_active</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Lembretes de Check-in</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Mensagens automáticas 6h e 2h antes com localização e dados de recepção.</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <span className="material-symbols-outlined text-base">calendar_month</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Gestão de Reservas & Quartos</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Tarifários dinâmicos, controle de ocupação e histórico de hóspedes.</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <span className="material-symbols-outlined text-base">support_agent</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Suporte Direto & Atualizações</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Evolução constante de recursos e suporte prioritário no Zap.</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TELA 2: ESCOLHA DE PLANO */}
          {viewState === 'planos' && (
            <div>
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setViewState('aviso')}
                  className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 mb-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Voltar ao aviso
                </button>
                <p className="text-xs text-slate-400">
                  Selecione o plano ideal para continuar utilizando o Hotel no Zap sem interrupções:
                </p>
              </div>

              {loadingPlanos ? (
                <div className="flex items-center justify-center py-10 gap-2 text-slate-400 text-sm">
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  Carregando planos disponíveis...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {planos.map((p) => {
                    const tag = p.tag || (p.isFeatured ? 'Mais Recomendado' : null);
                    return (
                      <div
                        key={p.id}
                        className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                          p.isFeatured
                            ? 'bg-slate-800/90 border-emerald-500/60 ring-2 ring-emerald-500/20 shadow-lg'
                            : 'bg-slate-800/50 border-slate-700/70 hover:border-slate-500'
                        }`}
                      >
                        <div>
                          {tag && (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-2">
                              ★ {tag}
                            </span>
                          )}
                          <h4 className="text-base font-bold text-white">{p.name}</h4>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{p.description || p.priceSubtitle}</p>

                          <div className="mt-3 pt-3 border-t border-slate-700/50">
                            <span className="text-2xl font-black text-white">
                              R$ {Number(p.basePrice).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs text-slate-400 ml-1.5">{p.pricePeriodText || '/mês'}</span>
                          </div>

                          <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
                            <li className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-xs text-emerald-400 font-bold">check</span>
                              <span>Até {p.roomLimit || 15} quartos inclusos</span>
                            </li>
                            <li className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-xs text-emerald-400 font-bold">check</span>
                              <span>{p.whatsappConnections || 1} Conexão WhatsApp oficial</span>
                            </li>
                          </ul>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectPlan(p)}
                          className={`mt-4 w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            p.isFeatured
                              ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-md'
                              : 'bg-slate-700 hover:bg-slate-600 text-white'
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">shopping_cart</span>
                          Escolher este plano
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TELA 3: CHECKOUT STEP */}
          {viewState === 'checkout' && selectedPlanForCheckout && (
            <div>
              <button
                type="button"
                onClick={() => setViewState('planos')}
                className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 mb-4 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Trocar plano selecionado ({selectedPlanForCheckout.name})
              </button>

              <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                <CheckoutPlanoStep
                  hotelId={hotel.id}
                  hotelNome={nomeHotel}
                  loginEmail={loginEmail}
                  nomeResponsavel={managerName}
                  cpfOuCnpj={cpfOuCnpj}
                  whatsapp={whatsapp}
                  plano={selectedPlanForCheckout}
                  onGoToDashboard={() => {
                    handleDismiss();
                    if (onPlanRenewed) onPlanRenewed();
                    else window.location.reload();
                  }}
                  onFalarWhatsApp={() => {
                    window.open(
                      'https://wa.me/5566981585014?text=Ola!%20Gostaria%20de%20ajuda%20para%20renovar%20o%20plano%20do%20hotel%20' +
                        encodeURIComponent(nomeHotel),
                      '_blank'
                    );
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Botões de Ação */}
        {viewState === 'aviso' && (
          <div className="p-5 sm:p-6 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer"
            >
              Lembrar mais tarde
            </button>

            <button
              type="button"
              onClick={() => setViewState('planos')}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 hover:opacity-95 text-slate-950 font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">rocket_launch</span>
              Renovar Meu Plano Agora
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default ModalAlertaExpiracaoPlano;
