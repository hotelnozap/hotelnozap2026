import React, { useState, useEffect } from 'react';
import { planosService } from '../services/supabaseService';
import { InfoCreditoHotel } from '../services/creditosService';
import { CheckoutPlanoStep } from './CheckoutPlanoStep';

export interface TelaPlanoExpiradoProps {
  hotel: any;
  infoCredito: InfoCreditoHotel;
  onPlanSubscribed?: () => void;
  onLogout?: () => void;
}

export const TelaPlanoExpirado: React.FC<TelaPlanoExpiradoProps> = ({
  hotel,
  infoCredito,
  onPlanSubscribed,
  onLogout
}) => {
  const [planos, setPlanos] = useState<any[]>([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<any | null>(null);

  useEffect(() => {
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
  }, []);

  const loginEmail = hotel?.loginEmail || hotel?.managerEmail || localStorage.getItem('hotelnozap_user_email') || '';
  const managerName = hotel?.managerName || localStorage.getItem('hotelnozap_user_name') || 'Gestor do Hotel';
  const cpfOuCnpj = hotel?.cnpj || hotel?.managerCpf || '';
  const whatsapp = hotel?.managerPhone || hotel?.whatsapp || '';

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto w-full">
        {/* Topo / Logo */}
        <div className="flex items-center justify-between pb-8 border-b border-slate-800 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#003400] border border-emerald-500/40 flex items-center justify-center text-white font-black text-xl shadow-md">
              H
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white block">HOTEL NO ZAP</span>
              <span className="text-xs text-slate-400">Painel do Hotel • Controle de Acesso</span>
            </div>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="px-3.5 py-1.5 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              Sair da Conta
            </button>
          )}
        </div>

        {/* Modal de Checkout Inline quando um plano for selecionado */}
        {selectedPlanForCheckout ? (
          <div className="bg-white rounded-3xl p-4 sm:p-8 shadow-2xl text-slate-900 animate-in fade-in zoom-in-95 duration-200 border border-slate-100 mb-10">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedPlanForCheckout(null)}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Voltar aos Planos
              </button>
              <span className="text-xs font-black text-emerald-800 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-full">
                Renovação de Acesso
              </span>
            </div>

            <CheckoutPlanoStep
              hotelId={hotel.id}
              hotelNome={hotel.name}
              loginEmail={loginEmail}
              nomeResponsavel={managerName}
              cpfOuCnpj={cpfOuCnpj}
              whatsapp={whatsapp}
              plano={selectedPlanForCheckout}
              onGoToDashboard={() => {
                if (onPlanSubscribed) onPlanSubscribed();
                else window.location.reload();
              }}
              onFalarWhatsApp={() => {
                window.open(
                  'https://wa.me/5566981585014?text=Ola!%20Meu%20hotel%20' +
                    encodeURIComponent(hotel.name) +
                    '%20teve%20o%20plano%20expirado%20e%20gostaria%20de%20ajuda%20para%20renovacao.',
                  '_blank'
                );
              }}
            />
          </div>
        ) : (
          <>
            {/* Bloco de Alerta de Bloqueio */}
            <div className="bg-gradient-to-b from-red-950/60 to-slate-900 border-2 border-red-500/40 rounded-3xl p-6 sm:p-10 text-center mb-10 shadow-2xl relative overflow-hidden">
              <div className="w-20 h-20 rounded-3xl bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center mx-auto mb-5 text-red-400 shadow-lg">
                <span className="material-symbols-outlined text-4xl">timer_off</span>
              </div>

              <span className="inline-block px-3.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-extrabold uppercase tracking-wider mb-3">
                Acesso Temporariamente Suspenso
              </span>

              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-3">
                Seus créditos e dias de bônus expiraram!
              </h1>

              <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed mb-6">
                Olá, <strong>{hotel.name}</strong>! Seu período de acesso ativo encerrou em{' '}
                <strong className="text-white underline">{infoCredito.dataExpiracaoFormatada}</strong>. O motor de reservas via WhatsApp, mapa de quartos e o painel operacional foram pausados até a renovação.
              </p>

              <div className="inline-flex flex-wrap items-center justify-center gap-3 bg-slate-800/80 border border-slate-700/80 px-5 py-3 rounded-2xl text-xs sm:text-sm">
                <span className="text-slate-400">Plano anterior:</span>
                <span className="font-bold text-white">{hotel.plan || 'Plano Degustação'}</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">Saldo atual:</span>
                <strong className="text-red-400 font-extrabold">0 créditos (0 dias)</strong>
              </div>
            </div>

            {/* Vitrine de Planos para Renovação */}
            <div className="mb-10">
              <div className="text-center mb-8">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Escolha um Pacote de Créditos para Continuar Usando
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Ativação automática imediata via PIX ou Cartão de Crédito. Sem burocracia.
                </p>
              </div>

              {loadingPlanos ? (
                <div className="py-12 flex justify-center items-center">
                  <span className="material-symbols-outlined animate-spin text-4xl text-emerald-400">progress_activity</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {planos.map((p) => {
                    const priceNum = Number(p.basePrice) || 0;
                    const cicloDays = Number(p.cicloDays || 30);
                    const bonusDays = Number(p.bonusDays || 15);
                    const totalDias = cicloDays + bonusDays;
                    const conexoes = Number(p.whatsappConnections || 1);
                    const isDestaque = Boolean(p.isFeatured);

                    return (
                      <div
                        key={p.id}
                        className={`rounded-3xl p-6 bg-slate-800 border-2 transition-all flex flex-col justify-between relative ${
                          isDestaque
                            ? 'border-emerald-500 shadow-xl shadow-emerald-950/50 bg-gradient-to-b from-slate-800 to-emerald-950/20'
                            : 'border-slate-700/80 hover:border-slate-600'
                        }`}
                      >
                        {p.tag && (
                          <div className="absolute -top-3.5 right-6 px-3 py-1 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-md">
                            ★ {p.tag}
                          </div>
                        )}

                        <div>
                          <div className="mb-4">
                            <h3 className="text-lg font-black text-white">{p.name}</h3>
                            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                              {p.description || `${totalDias} dias de acesso com IA 24/7`}
                            </p>
                          </div>

                          <div className="mb-6">
                            <span className="text-3xl font-black text-emerald-400">
                              R$ {priceNum.toFixed(2).replace('.', ',')}
                            </span>
                            <span className="text-xs text-slate-400 ml-1">
                              {p.pricePeriodText || `/${totalDias} dias`}
                            </span>
                          </div>

                          <ul className="space-y-2.5 text-xs text-slate-300 mb-6">
                            <li className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
                              <span><strong>{totalDias} dias ativos</strong> ({cicloDays}d + {bonusDays}d bônus)</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
                              <span><strong>{conexoes} conexão(ões)</strong> no WhatsApp</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
                              <span>Atendente Virtual IA 24h por dia</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
                              <span>Sem cobranças extras por mensagens</span>
                            </li>
                          </ul>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedPlanForCheckout(p)}
                          className={`w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
                            isDestaque
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                              : 'bg-[#003400] hover:bg-[#004d00] text-white'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">bolt</span>
                          Reativar com este Plano
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Suporte e Solicitação de Prorrogação */}
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">support_agent</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Precisa de alguns dias para se programar para a próxima compra?
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Fale com nosso time comercial no WhatsApp. Podemos conceder dias de cortesia para sua avaliação.
                  </p>
                </div>
              </div>

              <a
                href={
                  'https://wa.me/5566981585014?text=Ola!%20Gostaria%20de%20solicitar%20alguns%20dias%20de%20prazo%20para%20programacao%20de%20compra%20do%20hotel%20' +
                  encodeURIComponent(hotel.name)
                }
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 rounded-xl bg-[#25D366] hover:bg-[#1fba58] text-white font-bold text-xs flex items-center gap-2 shrink-0 transition-colors shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">chat</span>
                Solicitar Dias no WhatsApp
              </a>
            </div>
          </>
        )}
      </div>

      <div className="text-center text-xs text-slate-500 pt-10">
        © 2026 Hotel no Zap CNPJ: 53.422.578/0001-00 • Sistema SaaS Hoteleiro Inteligente • Todos os direitos reservados.
      </div>
    </div>
  );
};
