import React from 'react';

export interface TutoriaisProps {
  onBackToDashboard?: () => void;
}

export const Tutoriais: React.FC<TutoriaisProps> = () => {
  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12">
      {/* CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-2xl">school</span>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                Tutoriais
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Vídeos explicativos, guias passo a passo e documentação de apoio do sistema.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* PÁGINA EM BRANCO (ESTRUTURA PADRÃO PARA CONTEÚDO FUTURO) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-xs min-h-[450px] flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-3xl">play_circle</span>
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Página de Tutoriais em Branco</h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md">
          Esta página está pronta para receber a biblioteca de vídeos de treinamento, manuais em PDF e guias interativos.
        </p>
      </div>
    </div>
  );
};

export default Tutoriais;
