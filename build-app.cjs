const fs = require('fs');

const appCode = `import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9ff] text-[#0b1c30] font-sans antialiased">
      
      {/* Sidebar 1:1 anexo */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-[280px] p-4 gap-2 z-40 bg-gradient-to-b from-[#003400] to-[#000000] text-white">
        
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6 px-4 py-2 mt-2">
          <div className="w-10 h-10 rounded-full bg-[#131b2e] flex items-center justify-center text-white shadow-md">
            <span className="material-symbols-outlined text-2xl">hotel</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Hotel no Zap</h1>
          </div>
        </div>

        {/* Menu Navigation */}
        <nav className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1">
          
          <button
            onClick={() => setActiveTab('dashboard')}
            className={"flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all text-left cursor-pointer " + (activeTab === 'dashboard' ? 'bg-[#6cf8bb]/20 text-[#6cf8bb]' : 'text-white hover:bg-white/10')}
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span className="text-sm font-medium">Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('mapa')}
            className={"flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left cursor-pointer " + (activeTab === 'mapa' ? 'bg-[#6cf8bb]/20 text-[#6cf8bb]' : 'text-white hover:bg-white/10')}
          >
            <span className="material-symbols-outlined">calendar_view_month</span>
            <span className="text-sm font-medium">Mapa dos Quartos</span>
          </button>

          <button
            onClick={() => setActiveTab('hospedes')}
            className={"flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left cursor-pointer " + (activeTab === 'hospedes' ? 'bg-[#6cf8bb]/20 text-[#6cf8bb]' : 'text-white hover:bg-white/10')}
          >
            <span className="material-symbols-outlined">group</span>
            <span className="text-sm font-medium">Hóspedes</span>
          </button>

          <button
            onClick={() => setActiveTab('produto')}
            className={"flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left cursor-pointer " + (activeTab === 'produto' ? 'bg-[#6cf8bb]/20 text-[#6cf8bb]' : 'text-white hover:bg-white/10')}
          >
            <span className="material-symbols-outlined">inventory_2</span>
            <span className="text-sm font-medium">Cadastro de Produtos</span>
          </button>

          <button
            onClick={() => setActiveTab('reservas')}
            className={"flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left cursor-pointer " + (activeTab === 'reservas' ? 'bg-[#6cf8bb]/20 text-[#6cf8bb]' : 'text-white hover:bg-white/10')}
          >
            <span className="material-symbols-outlined">book_online</span>
            <span className="text-sm font-medium">Reservas</span>
          </button>

          <button
            onClick={() => setActiveTab('caixa')}
            className={"flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left cursor-pointer " + (activeTab === 'caixa' ? 'bg-[#6cf8bb]/20 text-[#6cf8bb]' : 'text-white hover:bg-white/10')}
          >
            <span className="material-symbols-outlined">payments</span>
            <span className="text-sm font-medium">Controle de Caixa</span>
          </button>

          <button
            onClick={() => setActiveTab('conexao')}
            className={"flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left cursor-pointer " + (activeTab === 'conexao' ? 'bg-[#6cf8bb]/20 text-[#6cf8bb]' : 'text-white hover:bg-white/10')}
          >
            <span className="material-symbols-outlined">sync</span>
            <span className="text-sm font-medium">Conexão</span>
          </button>

          <button
            onClick={() => setActiveTab('parceiros')}
            className={"flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left cursor-pointer " + (activeTab === 'parceiros' ? 'bg-[#6cf8bb]/20 text-[#6cf8bb]' : 'text-white hover:bg-white/10')}
          >
            <span className="material-symbols-outlined">handshake</span>
            <span className="text-sm font-medium">Parceiros</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={"flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left cursor-pointer " + (activeTab === 'config' ? 'bg-[#6cf8bb]/20 text-[#6cf8bb]' : 'text-white hover:bg-white/10')}
          >
            <span className="material-symbols-outlined">settings</span>
            <span className="text-sm font-medium">Configurações</span>
          </button>

          <button
            onClick={() => setActiveTab('usuarios')}
            className={"flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left cursor-pointer " + (activeTab === 'usuarios' ? 'bg-[#6cf8bb]/20 text-[#6cf8bb]' : 'text-white hover:bg-white/10')}
          >
            <span className="material-symbols-outlined">manage_accounts</span>
            <span className="text-sm font-medium">Usuários</span>
          </button>

        </nav>

        {/* User Account & Logout */}
        <div className="px-4 py-2 mt-auto">
          <div className="flex items-center gap-3 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/60">
            <span className="material-symbols-outlined text-lg">account_circle</span>
            <span>Hotel Master</span>
          </div>
          <button className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-lg transition-all text-white w-full cursor-pointer text-sm font-medium">
            <span className="material-symbols-outlined">logout</span>
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col lg:ml-[280px] h-full overflow-hidden bg-[#f8f9ff]">
        
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between w-full px-8 bg-[#f8f9ff] h-16 border-b border-[#c6c6cd]/40 shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#45464d]">Olá,</span>
            <span className="font-semibold text-[#0b1c30]">Administrador</span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-[#45464d] hidden sm:inline mr-4">15 de Mai, 14:30</span>
            <div className="flex items-center gap-2">
              <button className="w-10 h-10 rounded-full flex items-center justify-center text-[#0b1c30] hover:bg-[#eff4ff] transition-colors cursor-pointer relative">
                <span className="material-symbols-outlined">notifications</span>
                <span className="w-2.5 h-2.5 bg-[#006c49] rounded-full absolute top-2 right-2 border border-white"></span>
              </button>
              <div className="w-px h-6 bg-[#c6c6cd]/50 mx-1"></div>
              <button className="flex items-center gap-2 hover:bg-[#eff4ff] p-1 rounded-full transition-colors">
                <div className="w-8 h-8 rounded-full bg-[#131b2e] flex items-center justify-center text-white font-bold text-xs">
                  A
                </div>
              </button>
            </div>
          </div>
        </header>

        {/* View Router */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab !== 'dashboard' && (
            <div className="p-8 text-center text-[#45464d]">
              <h2 className="text-xl font-bold text-[#0b1c30] mb-2">Tela em construção</h2>
              <p className="text-sm">Envie a imagem/especificação desta tela para darmos início ao desenvolvimento.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
`;

fs.writeFileSync('src/App.tsx', appCode, 'utf8');
console.log('App.tsx construído com sucesso!');
