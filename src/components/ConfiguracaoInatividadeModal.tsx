import React, { useState, useEffect } from 'react';

interface ConfiguracaoInatividadeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEnabled: boolean;
  initialDuration: '8h' | '30m';
  onSave: (enabled: boolean, duration: '8h' | '30m') => void;
}

export const ConfiguracaoInatividadeModal: React.FC<ConfiguracaoInatividadeModalProps> = ({
  isOpen,
  onClose,
  initialEnabled,
  initialDuration,
  onSave
}) => {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [duration, setDuration] = useState<'8h' | '30m'>(initialDuration);

  // Sincroniza estados ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      setEnabled(initialEnabled);
      setDuration(initialDuration);
    }
  }, [isOpen, initialEnabled, initialDuration]);

  if (!isOpen) return null;

  const handleSalvar = () => {
    onSave(enabled, duration);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full border border-slate-200/80 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* CABEÇALHO */}
        <div className="bg-gradient-to-r from-[#003400] to-[#004d00] px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-xs">
              <span className="material-symbols-outlined text-2xl text-emerald-400">timer</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Sessão & Tempo de Inatividade</h2>
              <p className="text-xs text-emerald-200/80">Controle de desconexão automática do painel</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Fechar"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* CONTEÚDO */}
        <div className="p-6 space-y-5">
          {/* INTERRUPTOR PRINCIPAL (TOGGLE) */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-all flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">Desconexão Automática por Inatividade</span>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  enabled 
                    ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}>
                  {enabled ? 'Ativada' : 'Desativada (24h)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Quando ativado, o painel encerra a sessão se ninguém interagir no computador pelo período selecionado.
              </p>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                enabled ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  enabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* ESTADO 1: QUANDO DESATIVADO (RECEPÇÃO 24H) */}
          {!enabled ? (
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/90 flex items-start gap-3.5">
              <span className="material-symbols-outlined text-xl text-emerald-700 shrink-0 mt-0.5">verified_user</span>
              <div className="text-xs text-emerald-950 space-y-1">
                <p className="font-bold">Modo Recepção 24 Horas Habilitado</p>
                <p className="text-emerald-800/90 leading-relaxed">
                  O painel ficará conectado continuamente sem deslogar. Este modo é <strong>ideal para recepção de hotel</strong>, garantindo que o alerta sonoro e as notificações em tempo real de novas reservas nunca sejam interrompidos.
                </p>
              </div>
            </div>
          ) : (
            /* ESTADO 2: QUANDO ATIVADO (SELETOR DE DURAÇÃO: 8H TURNO VS 30M MÁXIMA SEGURANÇA) */
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Escolha o tempo limite de inatividade:
              </label>

              {/* OPÇÃO A: 8 HORAS (TURNO DE TRABALHO) */}
              <label
                onClick={() => setDuration('8h')}
                className={`p-4 rounded-2xl border-2 flex items-start gap-3.5 cursor-pointer transition-all ${
                  duration === '8h'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <input
                  type="radio"
                  name="inactivity_duration"
                  value="8h"
                  checked={duration === '8h'}
                  onChange={() => setDuration('8h')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg text-emerald-700">schedule</span>
                      <span className="text-sm font-bold text-slate-900">8 Horas (Turno de Trabalho)</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Mantém a recepção logada durante todo o expediente de trabalho, deslogando com segurança caso o computador permaneça abandonado após o fim do dia.
                  </p>
                </div>
              </label>

              {/* OPÇÃO B: 30 MINUTOS (SEGURANÇA REFORÇADA) */}
              <label
                onClick={() => setDuration('30m')}
                className={`p-4 rounded-2xl border-2 flex items-start gap-3.5 cursor-pointer transition-all ${
                  duration === '30m'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <input
                  type="radio"
                  name="inactivity_duration"
                  value="30m"
                  checked={duration === '30m'}
                  onChange={() => setDuration('30m')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg text-amber-600">lock_clock</span>
                      <span className="text-sm font-bold text-slate-900">30 Minutos (Segurança Reforçada)</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      Proteção Rápida
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Encerra a sessão rapidamente após 30 minutos sem nenhuma ação (cliques, teclado ou rolagem). Ideal para computadores de acesso compartilhado.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* DICA DE SINCRONIZAÇÃO */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="material-symbols-outlined text-sm">sync</span>
            <span>A preferência é salva e sincronizada automaticamente em todas as abas abertas neste navegador.</span>
          </div>
        </div>

        {/* RODAPÉ COM BOTÕES */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSalvar}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#003400] hover:bg-[#004d00] transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">check</span>
            <span>Salvar Configuração</span>
          </button>
        </div>
      </div>
    </div>
  );
};
