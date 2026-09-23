import React from 'react';

interface PaginaEmConstrucaoProps {
  titulo: string;
  subtitulo?: string;
  descricao?: string;
  icone?: string;
  modulo?: string;
  previsao?: string;
  itensPlanejados?: string[];
  onVoltar?: () => void;
  onBackToDashboard?: () => void;
}

export const PaginaEmConstrucao: React.FC<PaginaEmConstrucaoProps> = ({
  titulo,
  subtitulo,
  descricao,
  icone = 'construction',
  modulo = 'Módulo Administrativo SaaS',
  previsao = 'Em desenvolvimento ativo',
  itensPlanejados,
  onVoltar,
  onBackToDashboard
}) => {
  const handleBack = onVoltar || onBackToDashboard;
  const textoDescricao = descricao || subtitulo || 'Esta funcionalidade da Área Administrativa Master está sendo desenvolvida e estará disponível em breve.';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {modulo}
            </span>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              Em Construção
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#006c49] text-2xl sm:text-3xl">{icone}</span>
            <span>{titulo}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Painel de controle exclusivo para administradores do sistema • Sem vínculo operacional com hotéis
          </p>
        </div>

        {handleBack && (
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>Voltar à Área Administrativa</span>
          </button>
        )}
      </div>

      {/* Main Empty State / Under Construction Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 sm:p-12 text-center relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-gradient-to-b from-emerald-100/60 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#003400] to-[#006c49] text-white flex items-center justify-center shadow-lg shadow-emerald-900/10 mb-6">
            <span className="material-symbols-outlined text-4xl text-[#6cf8bb]">
              {icone}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
            Página em Construção
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
            {textoDescricao}
          </p>

          {/* Card informativo com itens previstos */}
          <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-left mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-[#006c49]">engineering</span>
                Recursos em Desenvolvimento
              </p>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {previsao}
              </span>
            </div>
            
            <ul className="text-xs text-slate-600 space-y-2">
              {itensPlanejados && itensPlanejados.length > 0 ? (
                itensPlanejados.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                    <span>{item}</span>
                  </li>
                ))
              ) : (
                <>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Arquitetura de dados e permissões de administrador preparadas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>Telas e relatórios analíticos em fase de implementação</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    <span>Liberação prevista nas próximas atualizações da plataforma</span>
                  </li>
                </>
              )}
            </ul>
          </div>

          {handleBack && (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 bg-[#003400] hover:bg-[#002000] text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base text-[#6cf8bb]">dashboard</span>
              <span>Ir para o Dashboard da Área Administrativa</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

