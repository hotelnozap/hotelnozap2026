import React, { useState, useEffect, useMemo } from 'react';
import { systemLogsService, SystemLogEntry, LogLevel, LogModule } from '../services/systemLogsService';

interface LogsSistemaProps {
  onBackToDashboard: () => void;
  currentUserRole?: string;
  isHotelUser?: boolean;
}

const LEVEL_CONFIG: Record<LogLevel, { label: string; bg: string; text: string; border: string; icon: string }> = {
  info: { label: 'Informativo', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: 'info' },
  success: { label: 'Sucesso', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'check_circle' },
  warning: { label: 'Alerta', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', icon: 'warning' },
  error: { label: 'Erro Crítico', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: 'error' },
  security: { label: 'Segurança', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: 'shield' }
};

const MODULE_CONFIG: Record<LogModule, { label: string; icon: string }> = {
  auth: { label: 'Autenticação', icon: 'lock' },
  hoteis: { label: 'Hotéis & Pousadas', icon: 'domain' },
  reservas: { label: 'Reservas', icon: 'book_online' },
  quartos: { label: 'Quartos & Governança', icon: 'bed' },
  financeiro: { label: 'Financeiro & PIX', icon: 'payments' },
  whatsapp: { label: 'WhatsApp & Mensagens', icon: 'chat' },
  database: { label: 'Banco de Dados', icon: 'database' },
  config: { label: 'Parâmetros & Config', icon: 'settings' },
  sistema: { label: 'Sistema SaaS', icon: 'terminal' }
};

export const LogsSistema: React.FC<LogsSistemaProps> = ({
  onBackToDashboard,
  currentUserRole,
  isHotelUser = false
}) => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('todos');
  const [filterModule, setFilterModule] = useState<string>('todos');

  // Modal de Detalhes / Inspecionar Payload
  const [selectedLog, setSelectedLog] = useState<SystemLogEntry | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await systemLogsService.getLogs();
      setLogs(data || []);
    } catch {
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('hotel_novo_log_sistema', handleUpdate);
    window.addEventListener('hotel_logs_sistema_limpos', handleUpdate);
    return () => {
      window.removeEventListener('hotel_novo_log_sistema', handleUpdate);
      window.removeEventListener('hotel_logs_sistema_limpos', handleUpdate);
    };
  }, []);

  // Verificação de permissão: somente administradores do sistema têm acesso
  const roleLower = (currentUserRole || localStorage.getItem('hotelnozap_user_role') || '').toLowerCase();
  const isAdmin = !isHotelUser || roleLower.includes('admin') || roleLower.includes('super');

  // Filtragem dos logs em memória
  const filteredLogs = useMemo(() => {
    let result = [...logs];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(l =>
        (l.action || '').toLowerCase().includes(q) ||
        (l.details || '').toLowerCase().includes(q) ||
        (l.userEmail || '').toLowerCase().includes(q) ||
        (l.userName || '').toLowerCase().includes(q) ||
        (l.ip || '').toLowerCase().includes(q) ||
        (l.hotelName || '').toLowerCase().includes(q)
      );
    }
    if (filterLevel !== 'todos') {
      result = result.filter(l => l.level === filterLevel);
    }
    if (filterModule !== 'todos') {
      result = result.filter(l => l.module === filterModule);
    }
    return result;
  }, [logs, searchQuery, filterLevel, filterModule]);

  // Contadores para os KPIs
  const totalCount = logs.length;
  const successCount = logs.filter(l => l.level === 'success' || l.level === 'info').length;
  const warningCount = logs.filter(l => l.level === 'warning').length;
  const errorCount = logs.filter(l => l.level === 'error' || l.level === 'security').length;

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      showToast('Nenhum log disponível para exportação com os filtros atuais.');
      return;
    }
    systemLogsService.exportLogsCsv(filteredLogs);
    showToast(`✓ Exportados ${filteredLogs.length} logs em formato CSV!`);
  };

  const handleClearLogs = async () => {
    await systemLogsService.clearLogs();
    setIsConfirmingClear(false);
    showToast('Histórico de logs limpo com sucesso.');
    loadData();
  };

  const handleGenerateTestLog = async () => {
    const modules: LogModule[] = ['auth', 'reservas', 'quartos', 'whatsapp', 'financeiro', 'database'];
    const levels: LogLevel[] = ['info', 'success', 'warning', 'error', 'security'];
    const randomModule = modules[Math.floor(Math.random() * modules.length)];
    const randomLevel = levels[Math.floor(Math.random() * levels.length)];

    await systemLogsService.addLog({
      level: randomLevel,
      module: randomModule,
      action: `Teste de Auditoria - Disparo em Tempo Real`,
      details: `Registro gerado manualmente pelo operador administrativo para validação dos filtros e da esteira de logs.`,
      userEmail: 'admin@hotelnozap.com.br',
      userName: 'Administrador Master',
      ip: '177.136.241.10',
      metadata: { teste_id: Date.now(), ambiente: 'painel_admin', protocolo: 'TLS_v1.3' }
    });
    showToast('✓ Novo log de teste registrado e sincronizado!');
    loadData();
  };

  if (!isAdmin) {
    return (
      <div className="bg-[#f8f9ff] min-h-screen p-6 md:p-12 flex items-center justify-center">
        <div className="bg-white max-w-md w-full p-8 rounded-2xl border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
            <span className="material-symbols-outlined text-3xl">lock</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Acesso Restrito ao Administrador</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            A auditoria e visualização dos logs do sistema é uma função exclusiva do Administrador Master do sistema SaaS.
          </p>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="w-full py-2.5 px-4 bg-[#003400] hover:bg-[#002400] text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Voltar ao Painel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f9ff] min-h-screen p-4 sm:p-6 md:p-8 space-y-6">
      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-3">
          <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOPBAR / CABEÇALHO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#003400] transition-colors cursor-pointer mb-2"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>Voltar para a Área Administrativa</span>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-xl">manage_search</span>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Logs do Sistema & Auditoria</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                  Somente Admin
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Rastreabilidade completa de ações operacionais, segurança, conexões e requisições da plataforma SaaS.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateTestLog}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 active:scale-98 text-xs font-bold text-slate-700 border border-slate-300 shadow-2xs transition cursor-pointer"
            title="Registrar um log de teste para verificar atualização"
          >
            <span className="material-symbols-outlined text-base text-purple-700">science</span>
            <span>Gerar Teste</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FDB116] hover:bg-[#e5a013] active:scale-98 text-xs font-bold text-slate-950 shadow-xs transition cursor-pointer"
            title="Exportar registros filtrados para arquivo CSV"
          >
            <span className="material-symbols-outlined text-base text-slate-950">download</span>
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 active:scale-98 text-xs font-bold text-slate-700 border border-slate-300 shadow-2xs transition cursor-pointer disabled:opacity-50"
            title="Recarregar registros em tempo real"
          >
            <span className={`material-symbols-outlined text-base ${isLoading ? 'animate-spin' : ''}`}>sync</span>
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => setIsConfirmingClear(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 active:scale-98 text-xs font-bold text-red-700 border border-red-200 transition cursor-pointer"
            title="Limpar todos os logs"
          >
            <span className="material-symbols-outlined text-base text-red-700">delete</span>
            <span>Limpar Logs</span>
          </button>
        </div>
      </div>

      {/* KPI CARDS (4 INDICADORES) */}
      <section aria-label="Indicadores de Logs" className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total de Eventos</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <span className="material-symbols-outlined text-xl">receipt_long</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{totalCount}</span>
            <p className="text-xs text-slate-400 font-medium mt-0.5">registros em histórico</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Operações com Sucesso</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined text-xl">check_circle</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600">{successCount}</span>
            <p className="text-xs text-emerald-700 font-medium mt-0.5">ações executadas 100%</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Alertas & Atenção</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined text-xl">warning</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-amber-600">{warningCount}</span>
            <p className="text-xs text-amber-700 font-medium mt-0.5">desconexões ou avisos</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-red-700">Erros & Segurança</span>
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
              <span className="material-symbols-outlined text-xl">gpp_maybe</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-red-700">{errorCount}</span>
            <p className="text-xs text-red-700 font-medium mt-0.5">falhas ou acessos bloqueados</p>
          </div>
        </div>
      </section>

      {/* BARRA DE FILTROS E BUSCA */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por ação, usuário, IP ou detalhe..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Filtro por Nível */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase hidden sm:inline">Nível:</span>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
            >
              <option value="todos">Todos os Níveis</option>
              <option value="success">Sucesso</option>
              <option value="info">Informativo</option>
              <option value="warning">Alerta</option>
              <option value="error">Erro Crítico</option>
              <option value="security">Segurança</option>
            </select>
          </div>

          {/* Filtro por Módulo */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase hidden sm:inline">Módulo:</span>
            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
            >
              <option value="todos">Todos os Módulos</option>
              <option value="auth">Autenticação</option>
              <option value="hoteis">Hotéis & Pousadas</option>
              <option value="reservas">Reservas</option>
              <option value="quartos">Quartos & Governança</option>
              <option value="financeiro">Financeiro</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="database">Banco de Dados</option>
              <option value="config">Parâmetros & Config</option>
              <option value="sistema">Sistema SaaS</option>
            </select>
          </div>

          {(searchQuery || filterLevel !== 'todos' || filterModule !== 'todos') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterLevel('todos');
                setFilterModule('todos');
              }}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* TABELA DE LOGS (DESKTOP) E LISTA DE CARDS (MOBILE) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-200">
              <span className="material-symbols-outlined text-3xl">inbox</span>
            </div>
            <h3 className="text-base font-bold text-slate-800">Nenhum registro de log encontrado</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Nenhum evento corresponde aos filtros informados. Experimente limpar a busca ou gerar um evento de teste.
            </p>
          </div>
        ) : (
          <>
            {/* TABELA DESKTOP (Hidden on mobile) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider font-bold text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Nível</th>
                    <th className="py-3 px-4">Data / Hora</th>
                    <th className="py-3 px-4">Módulo</th>
                    <th className="py-3 px-4">Ação / Evento</th>
                    <th className="py-3 px-4">Usuário / Origem</th>
                    <th className="py-3 px-4">IP / Origem</th>
                    <th className="py-3 px-4 text-right">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredLogs.map((log) => {
                    const lvl = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info;
                    const mod = MODULE_CONFIG[log.module] || MODULE_CONFIG.sistema;

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border ${lvl.bg} ${lvl.text} ${lvl.border}`}>
                            <span className="material-symbols-outlined text-xs">{lvl.icon}</span>
                            <span>{lvl.label}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200">
                            <span className="material-symbols-outlined text-xs text-slate-500">{mod.icon}</span>
                            <span>{mod.label}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-bold text-slate-900 truncate" title={log.action}>{log.action}</div>
                          {log.details && (
                            <div className="text-[11px] text-slate-500 truncate" title={log.details}>{log.details}</div>
                          )}
                        </td>

                        <td className="py-3 px-4 max-w-[180px] truncate">
                          <div className="font-bold text-slate-800 text-[11px] truncate">{log.userName || 'Sistema'}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">{log.userEmail || '-'}</div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                          {log.ip || '127.0.0.1'}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-xs">visibility</span>
                            <span>Inspecionar</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* LISTA EM CARDS NO MOBILE (Hidden on desktop) */}
            <div className="block lg:hidden divide-y divide-slate-100 p-3 space-y-3">
              {filteredLogs.map((log) => {
                const lvl = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info;
                const mod = MODULE_CONFIG[log.module] || MODULE_CONFIG.sistema;

                return (
                  <div key={log.id} className="pt-3 first:pt-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${lvl.bg} ${lvl.text} ${lvl.border}`}>
                        <span className="material-symbols-outlined text-xs">{lvl.icon}</span>
                        <span>{lvl.label}</span>
                      </span>

                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{log.action}</h4>
                      {log.details && (
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{log.details}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                      <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                        <span className="material-symbols-outlined text-xs text-slate-400">person</span>
                        <span className="font-semibold truncate">{log.userName || log.userEmail || 'Sistema'}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px] active:scale-95"
                      >
                        <span className="material-symbols-outlined text-xs">visibility</span>
                        <span>Ver Payload</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* MODAL: INSPEÇÃO DETALHADA DO LOG */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-xl">terminal</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Inspeção Detalhada do Evento</h3>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {selectedLog.id}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Nível de Severidade</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 mt-0.5 rounded text-[11px] font-bold border ${LEVEL_CONFIG[selectedLog.level].bg} ${LEVEL_CONFIG[selectedLog.level].text} ${LEVEL_CONFIG[selectedLog.level].border}`}>
                    {LEVEL_CONFIG[selectedLog.level].label}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Módulo do Sistema</span>
                  <span className="font-bold text-slate-800 text-xs block mt-0.5">
                    {MODULE_CONFIG[selectedLog.module]?.label || selectedLog.module}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Data & Hora Exata</span>
                  <span className="font-mono text-slate-700 text-xs block mt-0.5">
                    {new Date(selectedLog.timestamp).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">IP de Origem</span>
                  <span className="font-mono text-slate-700 text-xs block mt-0.5">
                    {selectedLog.ip || '127.0.0.1'}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Usuário Responsável</span>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedLog.userName || 'Sistema'}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{selectedLog.userEmail || '-'}</div>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Ação / Evento Registrado
                </span>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900 text-xs">
                  {selectedLog.action}
                </div>
              </div>

              {selectedLog.details && (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Descrição Detalhada
                  </span>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs leading-relaxed">
                    {selectedLog.details}
                  </div>
                </div>
              )}

              {selectedLog.metadata && (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Metadados & Payload Técnico (JSON)
                  </span>
                  <pre className="p-3 rounded-xl bg-slate-900 text-emerald-300 font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-800 leading-snug">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Fechar Inspeção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAÇÃO DE LIMPEZA DE LOGS */}
      {isConfirmingClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl border border-red-200 shadow-2xl p-6 space-y-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-red-700 flex items-center justify-center border border-red-200">
              <span className="material-symbols-outlined text-3xl">delete_sweep</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">Limpar Registros de Auditoria?</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Esta ação excluirá o histórico de logs do sistema gravados até o momento. Essa operação não pode ser desfeita.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmingClear(false)}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearLogs}
                className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Sim, Limpar Tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogsSistema;
