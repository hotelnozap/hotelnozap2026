import React, { useEffect } from 'react';
import { ZapHotelLogo } from './ZapHotelLogo';

interface Pagina404Props {
  onNavigateHome?: () => void;
  onNavigateCatalog?: () => void;
  onNavigateLogin?: () => void;
}

export const Pagina404: React.FC<Pagina404Props> = ({
  onNavigateHome,
  onNavigateCatalog,
  onNavigateLogin
}) => {
  useEffect(() => {
    document.title = '404 - Página Não Encontrada | Hotel no Zap';
  }, []);

  const handleGoHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
      return;
    }
    window.location.href = '/';
  };

  const handleGoCatalog = () => {
    if (onNavigateCatalog) {
      onNavigateCatalog();
      return;
    }
    window.location.href = '/hoteis';
  };

  const handleGoLogin = () => {
    if (onNavigateLogin) {
      onNavigateLogin();
      return;
    }
    window.location.href = '/paineladmin';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white relative overflow-hidden font-sans">
      {/* Background Decorativo com Luzes Suaves */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-emerald-600/15 via-[#006c49]/20 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER SIMPLES */}
      <header className="relative z-10 w-full border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group">
            <ZapHotelLogo size={38} className="group-hover:scale-105 transition-transform" />
            <div>
              <span className="font-extrabold text-lg text-white tracking-tight block leading-tight">
                Hotel no Zap
              </span>
              <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                Hospitalidade Digital
              </span>
            </div>
          </a>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <a
              href="/fale-conosco"
              className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Fale Conosco
            </a>
            <button
              onClick={handleGoHome}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">home</span>
              <span>Início</span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL 404 */}
      <main className="relative z-10 flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20 flex flex-col items-center justify-center text-center">
        
        {/* Badge 404 */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 mb-6 shadow-sm">
          <span className="material-symbols-outlined text-sm">explore_off</span>
          <span>Erro 404 • Página Não Encontrada</span>
        </div>

        {/* Número 404 Estilizado com Gradiente */}
        <h1 className="text-7xl sm:text-9xl font-black tracking-tight leading-none bg-gradient-to-b from-white via-slate-200 to-slate-500 bg-clip-text text-transparent drop-shadow-sm select-none">
          404
        </h1>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-4 sm:mt-6 tracking-tight">
          Oops! Essa acomodação ou link não existe.
        </h2>

        <p className="text-sm sm:text-base text-slate-400 max-w-lg mt-3 leading-relaxed">
          O endereço que você digitou pode ter mudado, o hotel foi desativado ou o link foi digitado incorretamente.
        </p>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 mt-8 w-full sm:w-auto">
          <button
            onClick={handleGoCatalog}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/40 hover:shadow-emerald-900/50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">travel_explore</span>
            <span>Explorar Hotéis & Pousadas</span>
          </button>

          <button
            onClick={handleGoHome}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700/80 text-slate-200 font-bold text-sm border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">home</span>
            <span>Voltar para o Início</span>
          </button>

          <button
            onClick={handleGoLogin}
            className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-transparent hover:bg-slate-800/50 text-slate-400 hover:text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">login</span>
            <span>Área Restrita</span>
          </button>
        </div>

        {/* Card Auxiliar de Ajuda */}
        <div className="mt-12 p-4 sm:p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 max-w-md w-full flex items-center gap-3.5 text-left">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">chat</span>
          </div>
          <div className="text-xs">
            <span className="font-bold text-white block">Precisa de assistência com uma reserva?</span>
            <a
              href="https://wa.me/5566981585014?text=Ol%C3%A1!%20Acessei%20um%20link%20que%20deu%20erro%20404%20e%20preciso%20de%20ajuda."
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline font-semibold"
            >
              Fale com nosso suporte no WhatsApp (66) 98158-5014 →
            </a>
          </div>
        </div>

      </main>

      {/* FOOTER INSTITUCIONAL DISCRETO */}
      <footer className="relative z-10 w-full border-t border-slate-800 bg-slate-900/80 py-6 text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            © 2026 Hotel no Zap CNPJ: 53.422.578/0001-00 • Hospitalidade Digital & Automação Hoteleira
          </div>
          <div className="flex items-center gap-3 font-semibold text-slate-400">
            <a href="/privacidade" className="hover:text-white transition-colors">Privacidade</a>
            <span>•</span>
            <a href="/termos" className="hover:text-white transition-colors">Termos</a>
            <span>•</span>
            <a href="/quem-somos" className="hover:text-white transition-colors">Quem Somos</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Pagina404;
