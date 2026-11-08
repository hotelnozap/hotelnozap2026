import React, { useState, useEffect } from 'react';
import { nativePushService, isAppInstalled, isPushSupported } from '../services/nativePushService';

interface NativePushBannerProps {
  hotelId?: string;
  hotelNome?: string;
}

export const NativePushBanner: React.FC<NativePushBannerProps> = ({ hotelId, hotelNome }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isApp = isAppInstalled();

  useEffect(() => {
    if (!isPushSupported()) return;

    // Se o usuário estiver autenticado na Área Administrativa ou Gestão de Hotel, nunca exibe o banner
    try {
      const userRole = localStorage.getItem('hotelnozap_user_role') || '';
      const userEmail = localStorage.getItem('hotelnozap_user_email') || '';
      if (userRole || userEmail) {
        return;
      }
    } catch {
      // ignore
    }

    // Se já foi concedida ou bloqueada a permissão
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted' || Notification.permission === 'denied') {
        return;
      }
    }

    // Se o usuário dispensou recentemente (por 7 dias)
    const dismissedUntil = localStorage.getItem('hotelnozap_push_dismissed_until');
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      return;
    }

    // Delay suave de 3 segundos para não interromper o carregamento inicial
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, isApp ? 1500 : 3500);

    return () => clearTimeout(timer);
  }, [isApp]);

  if (!isVisible) return null;

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const result = await nativePushService.subscribeUser(hotelId);
      if (result.success) {
        setIsVisible(false);
      } else {
        console.warn('[NativePushBanner] Falha ao ativar:', result.error);
        setIsVisible(false);
      }
    } catch (e) {
      setIsVisible(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Não incomodar nos próximos 5 dias
    const fiveDaysMs = Date.now() + (5 * 24 * 60 * 60 * 1000);
    localStorage.setItem('hotelnozap_push_dismissed_until', fiveDaysMs.toString());
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[9999] animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-emerald-500/30 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
            <span className="material-symbols-outlined text-white text-2xl">
              {isApp ? 'smartphone' : 'notifications_active'}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white leading-tight">
                {isApp ? 'Receba alertas direto no seu celular' : 'Ativar Notificações de Ofertas'}
              </h4>
              {isApp && (
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  App Ativo
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {hotelNome 
                ? `Fique sabendo de tarifas exclusivas e confirmações do ${hotelNome} mesmo com o app fechado.`
                : 'Receba promoções relâmpago, descontos e alertas de reservas direto na sua tela de bloqueio.'}
            </p>
          </div>

          <button
            onClick={handleDismiss}
            aria-label="Fechar"
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/10">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs text-slate-300 hover:text-white font-medium transition-colors"
          >
            Mais tarde
          </button>
          <button
            onClick={handleSubscribe}
            disabled={isLoading}
            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/30 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
                <span>Ativando...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-xs">check_circle</span>
                <span>{isApp ? 'Ativar no App' : 'Permitir Notificações'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
