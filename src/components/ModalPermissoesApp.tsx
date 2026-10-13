import React, { useState } from 'react';
import { locationService, UserLocation } from '../services/locationService';

interface ModalPermissoesAppProps {
  isOpen: boolean;
  onClose: (result?: { notifications: boolean; location: boolean; locationData?: UserLocation | null }) => void;
}

export const ModalPermissoesApp: React.FC<ModalPermissoesAppProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAllowPermissions = async () => {
    setLoading(true);
    try {
      const result = await locationService.requestAllAppPermissions();
      setLoading(false);
      onClose(result);
    } catch {
      setLoading(false);
      locationService.markPermissionsAsAsked();
      onClose();
    }
  };

  const handleDismiss = () => {
    locationService.markPermissionsAsAsked();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col p-6 sm:p-7 space-y-6 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO COM ÍCONE DE DESTAQUE */}
        <div className="text-center space-y-2.5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto shadow-inner border border-emerald-100">
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              near_me
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Aproveite ao máximo o Hotel no Zap
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
            Personalize sua experiência para encontrar acomodações perto de você com apenas um toque.
          </p>
        </div>

        {/* BENEFÍCIOS DAS PERMISSÕES */}
        <div className="space-y-3.5 bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
          {/* 1. Localização */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                my_location
              </span>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                Hotéis na sua cidade
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 leading-snug mt-0.5">
                Exibe automaticamente pousadas e acomodações mais próximas de onde você está.
              </p>
            </div>
          </div>

          {/* 2. Notificações */}
          <div className="flex items-start gap-3 pt-3 border-t border-slate-200/60">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                notifications_active
              </span>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                Avisos e Confirmações
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 leading-snug mt-0.5">
                Receba confirmações instantâneas de reservas, check-in e respostas de anfitriões.
              </p>
            </div>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={handleAllowPermissions}
            disabled={loading}
            className="w-full py-3.5 px-5 rounded-2xl bg-[#006c49] hover:bg-[#005438] active:scale-[0.99] text-white font-extrabold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Solicitando permissões...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">check_circle</span>
                <span>Permitir e Continuar</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer text-center"
          >
            Agora Não
          </button>
        </div>

        <p className="text-[10px] text-center text-slate-400 font-medium">
          Você pode alterar essas permissões a qualquer momento nas configurações do seu navegador ou celular.
        </p>
      </div>
    </div>
  );
};
