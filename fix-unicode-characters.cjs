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
            <span className="text-sm font-medium">H\u00f3spedes</span>
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
            <span className="text-sm font-medium">Conex\u00e3o</span>
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
            <span className="text-sm font-medium">Configura\u00e7\u00f5es</span>
          </button>

          <button
            onClick={() => setActiveTab('usuarios')}
            className={"flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left cursor-pointer " + (activeTab === 'usuarios' ? 'bg-[#6cf8bb]/20 text-[#6cf8bb]' : 'text-white hover:bg-white/10')}
          >
            <span className="material-symbols-outlined">manage_accounts</span>
            <span className="text-sm font-medium">Usu\u00e1rios</span>
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
            <span className="text-[#45464d]">Ol\u00e1,</span>
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
              <h2 className="text-xl font-bold text-[#0b1c30] mb-2">Tela em constru\u00e7\u00e3o</h2>
              <p className="text-sm">Envie a imagem/especifica\u00e7\u00e3o desta tela para darmos in\u00edcio ao desenvolvimento.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
`;

const dashboardCode = `import React, { useState } from 'react';

export const Dashboard: React.FC = () => {
  const [filter, setFilter] = useState<'hoje' | '7dias' | '30dias'>('hoje');

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8f9ff]">
      
      {/* Page Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl md:text-[40px] font-bold text-[#0b1c30] tracking-tight">Vis\u00e3o Geral</h2>
          <p className="text-[#45464d] text-base mt-1">Acompanhe o desempenho di\u00e1rio do hotel.</p>
        </div>
        
        <div className="inline-flex bg-white border border-[#c6c6cd]/40 rounded-xl p-1 shadow-sm self-start md:self-auto">
          <button
            onClick={() => setFilter('hoje')}
            className={"px-4 py-1.5 rounded-lg text-sm font-semibold transition-all " + (filter === 'hoje' ? 'bg-[#131b2e] text-white shadow-sm' : 'text-[#45464d] hover:bg-[#eff4ff]')}
          >
            Hoje
          </button>
          <button
            onClick={() => setFilter('7dias')}
            className={"px-4 py-1.5 rounded-lg text-sm font-semibold transition-all " + (filter === '7dias' ? 'bg-[#131b2e] text-white shadow-sm' : 'text-[#45464d] hover:bg-[#eff4ff]')}
          >
            7 dias
          </button>
          <button
            onClick={() => setFilter('30dias')}
            className={"px-4 py-1.5 rounded-lg text-sm font-semibold transition-all " + (filter === '30dias' ? 'bg-[#131b2e] text-white shadow-sm' : 'text-[#45464d] hover:bg-[#eff4ff]')}
          >
            30 dias
          </button>
        </div>
      </div>

      {/* 6 KPIs Grid (Exact Stitch Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Card 1: Quartos Disponíveis */}
        <div className="bg-white border border-[#c6c6cd]/40 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="text-base font-semibold text-[#45464d]">Quartos Dispon\u00edveis</span>
            <div className="w-9 h-9 rounded-full bg-[#6cf8bb]/30 flex items-center justify-center text-[#00714d]">
              <span className="material-symbols-outlined text-[20px]">bed</span>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-[40px] leading-none font-bold text-[#0b1c30]">12</span>
            <span className="flex items-center text-[#006c49] text-xs font-semibold mb-1 bg-[#006c49]/10 px-2.5 py-1 rounded-full">
              \ud83d\udfe2 Livre
            </span>
          </div>
        </div>

        {/* Card 2: Quartos Ocupados */}
        <div className="bg-white border border-[#c6c6cd]/40 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="text-base font-semibold text-[#45464d]">Quartos Ocupados</span>
            <div className="w-9 h-9 rounded-full bg-[#ffdad6] flex items-center justify-center text-[#93000a]">
              <span className="material-symbols-outlined text-[20px]">no_meeting_room</span>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-[40px] leading-none font-bold text-[#0b1c30]">18</span>
            <span className="flex items-center text-[#ba1a1a] text-xs font-semibold mb-1 bg-[#ba1a1a]/10 px-2.5 py-1 rounded-full">
              \ud83d\udd34 Ocup.
            </span>
          </div>
        </div>

        {/* Card 3: Quartos Reservados */}
        <div className="bg-white border border-[#c6c6cd]/40 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="text-base font-semibold text-[#45464d]">Quartos Reservados</span>
            <div className="w-9 h-9 rounded-full bg-[#d3e4fe] flex items-center justify-center text-[#0b1c30]">
              <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-[40px] leading-none font-bold text-[#0b1c30]">5</span>
            <span className="flex items-center text-[#131b2e] text-xs font-semibold mb-1 bg-[#131b2e]/10 px-2.5 py-1 rounded-full">
              \ud83d\udd35 Previstos
            </span>
          </div>
        </div>

        {/* Card 4: Em Limpeza */}
        <div className="bg-white border border-[#c6c6cd]/40 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="text-base font-semibold text-[#45464d]">Em Limpeza</span>
            <div className="w-9 h-9 rounded-full bg-[#6cf8bb]/20 flex items-center justify-center text-[#006c49]">
              <span className="material-symbols-outlined text-[20px]">cleaning_services</span>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-[40px] leading-none font-bold text-[#0b1c30]">3</span>
          </div>
        </div>

        {/* Card 5: Em Check-Out */}
        <div className="bg-white border border-[#c6c6cd]/40 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="text-base font-semibold text-[#45464d]">Em Check-Out</span>
            <div className="w-9 h-9 rounded-full bg-[#c6c6cd]/30 flex items-center justify-center text-[#45464d]">
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-[40px] leading-none font-bold text-[#0b1c30]">2</span>
          </div>
        </div>

        {/* Card 6: Faturamento do Dia */}
        <div className="bg-white border border-[#c6c6cd]/40 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="text-base font-semibold text-[#45464d]">Faturamento do Dia</span>
            <div className="w-9 h-9 rounded-full bg-[#131b2e] flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-[20px]">payments</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-[#0b1c30]">R$ 1.250,00</span>
          </div>
        </div>
      </div>

      {/* Main Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Line Chart Area (Spans 2 cols) */}
        <div className="lg:col-span-2 bg-white border border-[#c6c6cd]/40 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[300px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-[#0b1c30]">Faturamento Semanal</h3>
            <button className="text-[#45464d] hover:text-[#0b1c30] p-1">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>

          {/* Simulated Chart Bars */}
          <div className="relative w-full flex items-end justify-between h-48 border-b border-l border-[#c6c6cd]/30 pl-8 pr-4 pb-2">
            
            {/* Y-Axis Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pl-2 pb-6">
              <div className="border-t border-[#c6c6cd]/20 border-dashed w-full relative"><span className="absolute -left-7 -top-2 text-xs text-[#76777d]">5k</span></div>
              <div className="border-t border-[#c6c6cd]/20 border-dashed w-full relative"><span className="absolute -left-7 -top-2 text-xs text-[#76777d]">4k</span></div>
              <div className="border-t border-[#c6c6cd]/20 border-dashed w-full relative"><span className="absolute -left-7 -top-2 text-xs text-[#76777d]">3k</span></div>
              <div className="border-t border-[#c6c6cd]/20 border-dashed w-full relative"><span className="absolute -left-7 -top-2 text-xs text-[#76777d]">2k</span></div>
              <div className="border-t border-[#c6c6cd]/20 border-dashed w-full relative"><span className="absolute -left-7 -top-2 text-xs text-[#76777d]">1k</span></div>
            </div>

            {/* Bars */}
            {[
              { day: 'Seg', h: '40%', active: false },
              { day: 'Ter', h: '65%', active: false },
              { day: 'Qua', h: '95%', active: true },
              { day: 'Qui', h: '50%', active: false },
              { day: 'Sex', h: '75%', active: false },
              { day: 'S\u00e1b', h: '85%', active: false },
              { day: 'Dom', h: '30%', active: false },
            ].map((bar, i) => (
              <div key={i} className="flex flex-col items-center gap-2 z-10 group cursor-pointer">
                <div 
                  className={"w-10 rounded-t-sm transition-all duration-200 " + (bar.active ? 'bg-[#131b2e] shadow-lg shadow-[#131b2e]/20' : 'bg-[#bec6e0] hover:bg-[#131b2e]')}
                  style={{ height: bar.h }}
                ></div>
                <span className={"text-xs " + (bar.active ? 'font-bold text-[#0b1c30]' : 'text-[#76777d]')}>{bar.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Donut Chart (Ocupação por Categoria) */}
        <div className="bg-white border border-[#c6c6cd]/40 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-between min-h-[300px]">
          <h3 className="text-xl font-bold text-[#0b1c30] w-full mb-4">Ocupa\u00e7\u00e3o por Categoria</h3>
          
          {/* Donut graphic */}
          <div className="relative flex items-center justify-center w-32 h-32 my-2">
            <div 
              className="w-32 h-32 rounded-full flex items-center justify-center"
              style={{
                background: 'conic-gradient(#006c49 0% 45%, #bec6e0 45% 75%, #d3e4fe 75% 100%)'
              }}
            >
              <div className="w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                <span className="font-extrabold text-[#0b1c30] text-xl">60%</span>
                <span className="text-[10px] text-[#76777d] uppercase font-semibold">Ocupa\u00e7\u00e3o</span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="w-full space-y-2 pt-4">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#006c49]"></div>
                <span className="text-[#0b1c30] font-medium">Luxo</span>
              </div>
              <span className="font-bold text-[#0b1c30]">45%</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#bec6e0]"></div>
                <span className="text-[#0b1c30] font-medium">Standard</span>
              </div>
              <span className="font-bold text-[#0b1c30]">30%</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#d3e4fe]"></div>
                <span className="text-[#0b1c30] font-medium">Econ\u00f4mico</span>
              </div>
              <span className="font-bold text-[#0b1c30]">25%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities Section (Full width) */}
      <div className="bg-white border border-[#c6c6cd]/40 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-[#0b1c30]">Atividades Recentes</h3>
          <button className="text-[#006c49] text-sm font-semibold hover:underline cursor-pointer">Ver tudo</button>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-4 p-3 hover:bg-[#eff4ff] rounded-xl transition-colors cursor-pointer border border-transparent hover:border-[#c6c6cd]/40">
            <div className="w-10 h-10 rounded-full bg-[#d3e4fe] flex items-center justify-center text-[#0b1c30] shrink-0">
              <span className="material-symbols-outlined">how_to_reg</span>
            </div>
            <div className="flex-1">
              <p className="text-base text-[#0b1c30]"><strong className="font-semibold">Check-in realizado:</strong> Jo\u00e3o Silva e fam\u00edlia chegaram.</p>
              <p className="text-sm text-[#45464d] mt-0.5">Quarto 204 (Luxo)</p>
            </div>
            <span className="text-xs text-[#76777d] whitespace-nowrap">H\u00e1 15 min</span>
          </div>

          <div className="flex items-start gap-4 p-3 hover:bg-[#eff4ff] rounded-xl transition-colors cursor-pointer border border-transparent hover:border-[#c6c6cd]/40">
            <div className="w-10 h-10 rounded-full bg-[#6cf8bb]/20 flex items-center justify-center text-[#006c49] shrink-0">
              <span className="material-symbols-outlined">cleaning_services</span>
            </div>
            <div className="flex-1">
              <p className="text-base text-[#0b1c30]"><strong className="font-semibold">Limpeza conclu\u00edda:</strong> Quarto 105 liberado para check-in.</p>
              <p className="text-sm text-[#45464d] mt-0.5">Equipe: Maria Santos</p>
            </div>
            <span className="text-xs text-[#76777d] whitespace-nowrap">H\u00e1 45 min</span>
          </div>

          <div className="flex items-start gap-4 p-3 hover:bg-[#eff4ff] rounded-xl transition-colors cursor-pointer border border-transparent hover:border-[#c6c6cd]/40">
            <div className="w-10 h-10 rounded-full bg-[#131b2e] flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined">local_atm</span>
            </div>
            <div className="flex-1">
              <p className="text-base text-[#0b1c30]"><strong className="font-semibold">Pagamento processado:</strong> Reserva #8902.</p>
              <p className="text-sm text-[#45464d] mt-0.5">Valor: R$ 850,00 via Cart\u00e3o de Cr\u00e9dito</p>
            </div>
            <span className="text-xs text-[#76777d] whitespace-nowrap">H\u00e1 2 horas</span>
          </div>
        </div>
      </div>

    </div>
  );
};
`;

fs.writeFileSync('src/App.tsx', appCode, 'utf8');
fs.writeFileSync('src/components/Dashboard.tsx', dashboardCode, 'utf8');
console.log('Arquivos gravados com Unicode Escapes 100% à prova de falhas de codificação!');
