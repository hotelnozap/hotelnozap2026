import React, { useState, useEffect, useRef } from 'react';
import {
  superAgenteVendedorService,
  SuperAgenteConfig,
  LeadConversa,
  CONFIG_PADRAO_SUPER_AGENTE
} from '../services/superAgenteVendedorService';
import { evolutionApiService } from '../services/evolutionApiService';
import { disparadorGoogleService, HotelGoogleItem } from '../services/disparadorGoogleService';

export interface AdminSuperAgenteVendedorProps {
  onBackToDashboard: () => void;
  onGoToDisparador?: () => void;
}

export const AdminSuperAgenteVendedor: React.FC<AdminSuperAgenteVendedorProps> = ({
  onBackToDashboard,
  onGoToDisparador
}) => {
  // Configuração
  const [config, setConfig] = useState<SuperAgenteConfig>(superAgenteVendedorService.getConfig());
  const [instances, setInstances] = useState<any[]>([]);

  // Sub-aba ativa
  const [activeTab, setActiveTab] = useState<'conversas' | 'simulador' | 'roteiro' | 'n8n'>('n8n');

  // Estados da Integração n8n
  const [n8nTestando, setN8nTestando] = useState<boolean>(false);
  const [n8nTestResult, setN8nTestResult] = useState<any | null>(null);
  const [sincronizandoEvolution, setSincronizandoEvolution] = useState<boolean>(false);
  const [sincronizacaoResult, setSincronizacaoResult] = useState<string | null>(null);
  const [copiadoJson, setCopiadoJson] = useState<boolean>(false);

  // Conversas & Leads
  const [conversas, setConversas] = useState<Record<string, LeadConversa>>(superAgenteVendedorService.getConversas());
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [selectedLeadPhone, setSelectedLeadPhone] = useState<string | null>(null);

  // Mensagem manual do admin
  const [mensagemManual, setMensagemManual] = useState<string>('');
  const [enviandoManual, setEnviandoManual] = useState<boolean>(false);

  // Simulador de Teste
  const [simTextoLead, setSimTextoLead] = useState<string>('Quem fala?');
  const [simNomeHotel, setSimNomeHotel] = useState<string>('Hotel Recanto');
  const [simCidade, setSimCidade] = useState<string>('Cuiabá');
  const [simResultado, setSimResultado] = useState<any | null>(null);
  const [simulando, setSimulando] = useState<boolean>(false);

  // Temporizador de verificação de follow-up a cada 30 segundos
  useEffect(() => {
    // Carrega instâncias
    evolutionApiService.fetchInstances().then(list => {
      if (Array.isArray(list) && list.length > 0) {
        setInstances(list);
      }
    }).catch(() => {});

    const interval = setInterval(() => {
      superAgenteVendedorService.executarVerificacaoFollowups().then(qtd => {
        if (qtd > 0) {
          setConversas(superAgenteVendedorService.getConversas());
        }
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleSalvarConfig = (newConfig: SuperAgenteConfig) => {
    setConfig(newConfig);
    superAgenteVendedorService.saveConfig(newConfig);
    alert('Configurações do Super Agente Vendedor salvas com sucesso!');
  };

  const conversasList = Object.values(conversas).sort(
    (a, b) => new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime()
  );

  const conversasFiltradas = conversasList.filter(c => {
    if (filtroStatus === 'todos') return true;
    if (filtroStatus === 'link_enviado') return c.status === 'link_enviado' || c.status === 'aguardando_followup';
    if (filtroStatus === 'followup_enviado') return c.status === 'followup_enviado';
    if (filtroStatus === 'transbordo_vip') return Boolean(c.alertaVipEnviadoEm);
    if (filtroStatus === 'conversando') return c.status === 'conversando';
    return c.status === filtroStatus;
  });

  const selectedConversa = selectedLeadPhone ? conversas[selectedLeadPhone] : conversasFiltradas[0] || null;

  // Métricas
  const totalConversas = conversasList.length;
  const totalLinksEnviados = conversasList.filter(c => c.linkEnviadoEm).length;
  const totalFollowups = conversasList.filter(c => c.status === 'followup_enviado').length;
  const totalAlertasVip = conversasList.filter(c => c.alertaVipEnviadoEm).length;

  // Envio manual de resposta na conversa selecionada
  const handleEnviarMensagemManual = async () => {
    if (!mensagemManual.trim() || !selectedConversa) return;
    setEnviandoManual(true);

    try {
      await evolutionApiService.sendTextMessageDetailed(
        config.instanciaMonitorada,
        selectedConversa.telefone,
        mensagemManual
      );

      const updated = { ...selectedConversa };
      updated.mensagens.push({
        id: Math.random().toString(36).substring(2, 9),
        remetente: 'agente',
        texto: mensagemManual,
        timestamp: new Date().toISOString()
      });
      updated.atualizadoEm = new Date().toISOString();
      updated.status = 'pausado_manual'; // Admin assumiu o controle

      const map = { ...conversas, [updated.id]: updated };
      setConversas(map);
      superAgenteVendedorService.saveConversas(map);
      setMensagemManual('');
    } catch (err) {
      alert('Erro ao enviar mensagem manual.');
    } finally {
      setEnviandoManual(false);
    }
  };

  // Testar no Simulador
  const handleExecutarSimulacao = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!simTextoLead.trim()) return;

    setSimulando(true);
    const mockPhone = '5565999990001';
    const hotelMock = { nome: simNomeHotel, cidade: simCidade, uf: 'MT', cleanPhone: mockPhone };

    const res = await superAgenteVendedorService.processarMensagemRecebida(
      mockPhone,
      simTextoLead,
      hotelMock
    );

    setSimResultado(res);
    setConversas(superAgenteVendedorService.getConversas());
    setSimulando(false);
  };

  // Copiar JSON do Workflow n8n
  const handleCopiarJsonWorkflow = async () => {
    try {
      const res = await fetch('/n8n-workflow-super-agente-vendedor.json');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopiadoJson(true);
      setTimeout(() => setCopiadoJson(false), 3000);
    } catch (e) {
      alert('Não foi possível copiar automaticamente. Baixe o arquivo pelo botão ao lado.');
    }
  };

  // Baixar JSON do Workflow n8n
  const handleBaixarJsonWorkflow = () => {
    const a = document.createElement('a');
    a.href = '/n8n-workflow-super-agente-vendedor.json';
    a.download = 'n8n-workflow-super-agente-vendedor.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Testar Webhook no n8n
  const handleTestarN8n = async () => {
    setN8nTestando(true);
    setN8nTestResult(null);
    try {
      const res = await superAgenteVendedorService.testarWebhookN8n(config.n8nWebhookUrl);
      setN8nTestResult(res);
    } catch (err: any) {
      setN8nTestResult({ success: false, error: err?.message || 'Erro ao disparar webhook' });
    } finally {
      setN8nTestando(false);
    }
  };

  // Sincronizar na Evolution API
  const handleSincronizarEvolution = async () => {
    setSincronizandoEvolution(true);
    setSincronizacaoResult(null);
    try {
      const res = await superAgenteVendedorService.apontarWebhookEvolutionParaN8n(
        config.instanciaMonitorada || 'meutim',
        config.n8nWebhookUrl
      );
      if (res.success) {
        setSincronizacaoResult('✅ Webhook da Evolution API atualizado com sucesso para o n8n!');
      } else {
        setSincronizacaoResult(`❌ Erro: ${res.error}`);
      }
    } catch (err: any) {
      setSincronizacaoResult(`❌ Erro: ${err?.message}`);
    } finally {
      setSincronizandoEvolution(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* HEADER PRINCIPAL */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-2xl">smart_toy</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Fluxo Oficial
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  Fechador Comercial de Hotéis &amp; SDR Inteligente
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                Super Agente Vendedor
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Chave Liga/Desliga Geral do Robô */}
            <button
              type="button"
              onClick={() => {
                const novo = !config.ativo;
                const updated = { ...config, ativo: novo };
                setConfig(updated);
                superAgenteVendedorService.saveConfig(updated);
              }}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                config.ativo
                  ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20'
                  : 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {config.ativo ? 'power_settings_new' : 'power_off'}
              </span>
              <span>{config.ativo ? 'Agente Ativo (Piloto Automático)' : 'Agente Pausado'}</span>
            </button>

            {onGoToDisparador && (
              <button
                type="button"
                onClick={onGoToDisparador}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">send_to_mobile</span>
                Disparador Google
              </button>
            )}

            <button
              type="button"
              onClick={onBackToDashboard}
              className="px-4 py-2.5 rounded-2xl border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Voltar ao Painel
            </button>
          </div>
        </div>
      </div>

      {/* CARDS DE PERFORMANCE COMERCIAL */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-slate-400 text-xs font-medium block">Total em Atendimento</span>
          <span className="text-2xl font-black text-white mt-1 block">{totalConversas}</span>
          <span className="text-[11px] text-slate-500 mt-1 block">Hotéis interagindo com IA</span>
        </div>

        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-sm">
          <span className="text-emerald-400 text-xs font-medium block flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">link</span>
            Links da LP Enviados
          </span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">{totalLinksEnviados}</span>
          <span className="text-[11px] text-emerald-500/70 mt-1 block">Acesso de cortesia liberado</span>
        </div>

        <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-5 shadow-sm">
          <span className="text-blue-400 text-xs font-medium block flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">timer</span>
            Follow-ups 5 Minutos
          </span>
          <span className="text-2xl font-black text-blue-400 mt-1 block">{totalFollowups}</span>
          <span className="text-[11px] text-blue-500/70 mt-1 block">Cobrança amigável de cadastro</span>
        </div>

        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-sm">
          <span className="text-amber-400 text-xs font-medium block flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">notification_important</span>
            Transbordos VIP Notificados
          </span>
          <span className="text-2xl font-black text-amber-400 mt-1 block">{totalAlertasVip}</span>
          <span className="text-[11px] text-amber-500/70 mt-1 block">Alertas no seu WhatsApp</span>
        </div>
      </div>

      {/* SELETOR DE SUB-ABAS */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('n8n')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'n8n'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-orange-500/20'
              : 'bg-slate-900 border border-slate-800 text-amber-300 hover:text-white hover:border-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-base">hub</span>
          <span>⚡ Integração n8n &amp; Workflow</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'n8n' ? 'bg-slate-950 text-amber-300' : 'bg-amber-500/20 text-amber-300'
          }`}>
            OFICIAL
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('conversas')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'conversas'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-base">forum</span>
          <span>Mural de Conversas &amp; Leads</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'conversas' ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-slate-300'
          }`}>
            {totalConversas}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('simulador')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'simulador'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-base">psychology</span>
          <span>Simulador &amp; Teste em Tempo Real</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('roteiro')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'roteiro'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-base">tune</span>
          <span>Roteiro Comercial &amp; Configurações</span>
        </button>
      </div>

      {/* ABA 1: MURAL DE CONVERSAS & LEADS */}
      {activeTab === 'conversas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          {/* LISTA DE LEADS (ESQUERDA) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">group</span>
                Leads em Atendimento ({conversasFiltradas.length})
              </h3>
              {conversasList.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Deseja limpar o histórico de conversas locais do Agente?')) {
                      superAgenteVendedorService.limparConversas();
                      setConversas({});
                      setSelectedLeadPhone(null);
                    }
                  }}
                  className="text-[11px] text-slate-500 hover:text-red-400 cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Filtros de Status */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'link_enviado', label: 'Link Enviado' },
                { id: 'followup_enviado', label: 'Follow-up' },
                { id: 'transbordo_vip', label: 'VIP' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroStatus(f.id)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                    filtroStatus === f.id
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Lista com scroll */}
            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {conversasFiltradas.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Nenhuma conversa registrada ainda. Quando os hotéis responderem no WhatsApp ou você testar no Simulador, as conversas aparecerão aqui em tempo real.
                </div>
              ) : (
                conversasFiltradas.map(conv => {
                  const isSelected = selectedConversa?.id === conv.id;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedLeadPhone(conv.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800 border-emerald-500 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white truncate max-w-[170px]">
                          {conv.hotelNome}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(conv.atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 truncate mt-1">
                        📍 {conv.cidade} - {conv.uf}
                      </div>

                      {conv.ultimaMensagemLead && (
                        <div className="text-xs text-slate-300 italic truncate mt-1.5 font-medium">
                          "{conv.ultimaMensagemLead}"
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-800/80">
                        {conv.status === 'link_enviado' ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            🔗 Link Enviado
                          </span>
                        ) : conv.status === 'followup_enviado' ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            ⏳ Follow-up 5min
                          </span>
                        ) : conv.status === 'descartado' ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 text-slate-500">
                            Descartado
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 text-slate-300">
                            Conversando
                          </span>
                        )}

                        {conv.alertaVipEnviadoEm && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            🚨 Alerta VIP
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* CHAT / HISTÓRICO COMPLETO (DIREITA) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[580px]">
            {selectedConversa ? (
              <>
                {/* Cabeçalho da conversa */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <h3 className="text-base font-black text-white">{selectedConversa.hotelNome}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>{selectedConversa.cidade} - {selectedConversa.uf}</span>
                      <span>•</span>
                      <span className="font-mono text-emerald-400">{selectedConversa.telefone}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`https://wa.me/${selectedConversa.telefone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">chat</span>
                      Abrir no Zap
                    </a>
                  </div>
                </div>

                {/* Balões de conversa */}
                <div className="flex-1 space-y-3 py-4 overflow-y-auto max-h-[380px] pr-2">
                  {selectedConversa.mensagens.map(msg => {
                    const isLead = msg.remetente === 'lead';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isLead ? 'items-start' : 'items-end'}`}
                      >
                        <span className="text-[10px] text-slate-500 mb-1 px-1">
                          {isLead ? selectedConversa.hotelNome : 'Super Agente Vendedor (Everaldo)'} •{' '}
                          {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div
                          className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed whitespace-pre-line ${
                            isLead
                              ? 'bg-slate-800 text-white rounded-tl-xs border border-slate-700/60'
                              : 'bg-emerald-600/90 text-white rounded-tr-xs shadow-md shadow-emerald-950/40'
                          }`}
                        >
                          {msg.texto}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Campo para o Everaldo assumir ou mandar mensagem manual */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Assumir atendimento manual pelo painel:</span>
                    {selectedConversa.status === 'pausado_manual' && (
                      <span className="text-amber-400 font-bold">Modo Manual Ativo</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={mensagemManual}
                      onChange={(e) => setMensagemManual(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEnviarMensagemManual();
                      }}
                      placeholder="Digite sua resposta manual para este hotel..."
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleEnviarMensagemManual}
                      disabled={enviandoManual || !mensagemManual.trim()}
                      className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">send</span>
                      Enviar
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-24 text-center text-slate-500 text-xs">
                Selecione uma conversa à esquerda para ver o histórico e interagir.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 2: SIMULADOR DE TESTE EM TEMPO REAL */}
      {activeTab === 'simulador' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400">psychology</span>
              <h2 className="text-lg font-black text-white">Simulador do Super Agente Vendedor</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Fingir ser um recepcionista ou gerente de hotel para testar como o cérebro da IA reage e quais gatilhos são ativados.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* FORMULÁRIO DO SIMULADOR (ESQUERDA) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Nome do Hotel Teste:</label>
                  <input
                    type="text"
                    value={simNomeHotel}
                    onChange={(e) => setSimNomeHotel(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Cidade Teste:</label>
                  <input
                    type="text"
                    value={simCidade}
                    onChange={(e) => setSimCidade(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Mensagem que o Hotel mandou no WhatsApp:
                </label>
                <textarea
                  rows={3}
                  value={simTextoLead}
                  onChange={(e) => setSimTextoLead(e.target.value)}
                  placeholder="Ex: Quem fala? / Pode me ligar? / Quanto custa o plano anual? / Já temos sistema..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-3.5 text-xs text-white focus:outline-hidden focus:border-emerald-500 resize-none font-medium"
                />
              </div>

              {/* Botões de Frases Rápidas para Teste */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Ou clique em um teste rápido:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Quem fala?',
                    'Do que se trata?',
                    'Pode me ligar?',
                    'Quanto custa o plano anual?',
                    'Já temos sistema aqui na recepção',
                    'É robô falando?',
                    'Pode mandar o link para testar'
                  ].map(frase => (
                    <button
                      key={frase}
                      type="button"
                      onClick={() => setSimTextoLead(frase)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-all cursor-pointer"
                    >
                      {frase}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleExecutarSimulacao}
                disabled={simulando}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-950/30"
              >
                <span className={`material-symbols-outlined text-sm ${simulando ? 'animate-spin' : ''}`}>
                  {simulando ? 'sync' : 'play_arrow'}
                </span>
                <span>{simulando ? 'Processando IA...' : 'Testar Resposta do Agente'}</span>
              </button>
            </div>

            {/* RESULTADO DA SIMULAÇÃO (DIREITA) */}
            <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-3xl p-6 space-y-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 block">
                Diagnóstico &amp; Resposta do Super Agente Vendedor:
              </span>

              {simResultado ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Intenção Detectada</span>
                      <span className="text-xs font-black text-emerald-400 mt-1 block">
                        {simResultado.intencaoDetectada}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Transbordo VIP</span>
                      <span className={`text-xs font-black mt-1 block ${simResultado.acionouTransbordo ? 'text-amber-400' : 'text-slate-500'}`}>
                        {simResultado.acionouTransbordo ? '🚨 SIM (Avisou Everaldo)' : 'Não'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Follow-up 5 Min</span>
                      <span className={`text-xs font-black mt-1 block ${simResultado.agendouFollowup ? 'text-blue-400' : 'text-slate-500'}`}>
                        {simResultado.agendouFollowup ? '⏳ Agendado' : 'Não'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-slate-300 block mb-1.5">
                      Resposta Exata Enviada ao WhatsApp do Hotel:
                    </span>
                    <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 text-xs text-emerald-200 font-mono whitespace-pre-line leading-relaxed shadow-inner">
                      {simResultado.resposta || '(Sem resposta / Pausado)'}
                    </div>
                  </div>

                  {simResultado.acionouTransbordo && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-amber-400">
                        <span className="material-symbols-outlined text-sm">notification_important</span>
                        Mensagem enviada para o seu WhatsApp pessoal ({config.telefoneAdminNotificacao}):
                      </div>
                      <p className="text-[11px] font-mono leading-relaxed text-slate-300">
                        🚨 NOVO CLIENTE EM FECHAMENTO - HOTEL NO ZAP!<br />
                        Hotel: {simNomeHotel} ({simCidade} - MT)<br />
                        Ação: Link da LP enviado. Follow-up de 5 min agendado!
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-20 text-center text-slate-500 text-xs">
                  Digite uma mensagem e clique em "Testar Resposta do Agente" para ver a inteligência em ação.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: ROTEIRO COMERCIAL & CONFIGURAÇÕES */}
      {activeTab === 'roteiro' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400">tune</span>
              <h2 className="text-lg font-black text-white">Roteiro Comercial &amp; Parâmetros de Disparo</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Todos os textos foram formatados rigorosamente de acordo com as suas instruções. Você pode alterar qualquer fala quando desejar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Parâmetros Gerais */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Seu WhatsApp para Notificações VIP (com DDI e DDD):
                </label>
                <input
                  type="text"
                  value={config.telefoneAdminNotificacao}
                  onChange={(e) => setConfig({ ...config, telefoneAdminNotificacao: e.target.value })}
                  placeholder="Ex: 5565996173004"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-hidden focus:border-emerald-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Recebe o alerta sempre que um hotel pedir para ligar, perguntar de valores ou receber o link.
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Link Oficial da Landing Page para Ativação:
                </label>
                <input
                  type="text"
                  value={config.linkCadastro}
                  onChange={(e) => setConfig({ ...config, linkCadastro: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Tempo para Follow-up Automático (Minutos):
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.tempoFollowupMinutos}
                  onChange={(e) => setConfig({ ...config, tempoFollowupMinutos: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Padrão: 5 minutos após o envio do link da LP.
                </span>
              </div>
            </div>

            {/* Delays e Instância */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Instância Evolution API:</label>
                <select
                  value={config.instanciaMonitorada}
                  onChange={(e) => setConfig({ ...config, instanciaMonitorada: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden"
                >
                  {instances.map((i: any) => (
                    <option key={i.name} value={i.name}>
                      {i.name} ({i.connectionStatus === 'open' ? '🟢 Conectado' : '🔴 Desconectado'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Delay Mínimo (seg):</label>
                  <input
                    type="number"
                    value={config.delayMinSegundos}
                    onChange={(e) => setConfig({ ...config, delayMinSegundos: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Delay Máximo (seg):</label>
                  <input
                    type="number"
                    value={config.delayMaxSegundos}
                    onChange={(e) => setConfig({ ...config, delayMaxSegundos: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* EDITORES DE TEXTOS OFICIAIS */}
          <div className="space-y-5 pt-4 border-t border-slate-800">
            <h3 className="text-sm font-black text-white">Textos do Roteiro Oficial Aprovado</h3>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                1. Apresentação Oficial (Quando perguntam "Quem fala?" ou "Do que se trata?"):
              </label>
              <textarea
                rows={3}
                value={config.mensagemApresentacao}
                onChange={(e) => setConfig({ ...config, mensagemApresentacao: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-3 text-xs text-white font-mono leading-relaxed resize-none focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                2. Fechamento &amp; Envio do Link da LP (Quando aceitam ou pedem valores/ligação):
              </label>
              <textarea
                rows={3}
                value={config.mensagemFechamentoLink}
                onChange={(e) => setConfig({ ...config, mensagemFechamentoLink: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-3 text-xs text-white font-mono leading-relaxed resize-none focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                3. Follow-up de 5 Minutos (Cobrança Amigável do Cadastro):
              </label>
              <textarea
                rows={2}
                value={config.mensagemFollowup5Min}
                onChange={(e) => setConfig({ ...config, mensagemFollowup5Min: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-3 text-xs text-white font-mono leading-relaxed resize-none focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Objeção: Já tem Sistema</label>
                <textarea
                  rows={3}
                  value={config.mensagemObjecaoSistema}
                  onChange={(e) => setConfig({ ...config, mensagemObjecaoSistema: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-[11px] text-white font-mono resize-none focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Objeção: Preço</label>
                <textarea
                  rows={3}
                  value={config.mensagemObjecaoPreco}
                  onChange={(e) => setConfig({ ...config, mensagemObjecaoPreco: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-[11px] text-white font-mono resize-none focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Objeção: É Robô?</label>
                <textarea
                  rows={3}
                  value={config.mensagemObjecaoRobo}
                  onChange={(e) => setConfig({ ...config, mensagemObjecaoRobo: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-[11px] text-white font-mono resize-none focus:outline-hidden"
                />
              </div>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={() => handleSalvarConfig(config)}
                className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all cursor-pointer shadow-lg shadow-emerald-950/30 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">save</span>
                Salvar Roteiro &amp; Configurações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: INTEGRAÇÃO N8N & WORKFLOW */}
      {activeTab === 'n8n' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* BANNER DE DESTAQUE N8N */}
          <div className="bg-gradient-to-r from-slate-900 via-orange-950/20 to-slate-900 border-2 border-orange-500/40 rounded-3xl p-6 sm:p-7 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0 shadow-inner">
                  <span className="material-symbols-outlined text-3xl">hub</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/30">
                      Motor de Automação Oficial
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      Portal n8n Hotel no Zap
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                    Super Agente Vendedor no n8n
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                    O robô comercial é orquestrado diretamente dentro do seu servidor n8n. Ele recebe as mensagens da Evolution API, responde as dúvidas dos hotéis, envia o link da LP e agenda o follow-up de 5 minutos.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href="https://portaln8n.hotelnozap.com.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-orange-950/30 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  Abrir Painel n8n
                </a>
              </div>
            </div>
          </div>

          {/* 3 BOTÕES DE AÇÃO RÁPIDA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* CARD 1: COPIAR JSON */}
            <div className="bg-slate-900 border border-slate-800 hover:border-orange-500/40 rounded-3xl p-5 transition-all shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-xl">content_copy</span>
                </div>
                <h3 className="text-sm font-black text-white">Copiar Workflow (Ctrl+V)</h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Copia a estrutura completa de 6 nós para colar direto dentro de uma tela vazia no n8n.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopiarJsonWorkflow}
                className="mt-4 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-orange-500/20 text-orange-300 font-bold text-xs border border-orange-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">
                  {copiadoJson ? 'check' : 'content_copy'}
                </span>
                <span>{copiadoJson ? 'Copiado para a Memória!' : 'Copiar JSON do Workflow'}</span>
              </button>
            </div>

            {/* CARD 2: BAIXAR JSON */}
            <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 transition-all shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-xl">download</span>
                </div>
                <h3 className="text-sm font-black text-white">Baixar Arquivo .json</h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Baixe o arquivo oficial pronto para importar via menu "Import from File" no seu n8n.
                </p>
              </div>
              <button
                type="button"
                onClick={handleBaixarJsonWorkflow}
                className="mt-4 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Baixar Workflow .json</span>
              </button>
            </div>

            {/* CARD 3: TESTAR WEBHOOK */}
            <div className="bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-3xl p-5 transition-all shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-xl">science</span>
                </div>
                <h3 className="text-sm font-black text-white">Testar Disparo no n8n</h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Envia um payload simulado de mensagem recebida para você ver o fluxo executando no n8n.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTestarN8n}
                disabled={n8nTestando}
                className="mt-4 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-blue-500/20 text-blue-300 font-bold text-xs border border-blue-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">
                  {n8nTestando ? 'sync' : 'play_arrow'}
                </span>
                <span>{n8nTestando ? 'Enviando ao n8n...' : 'Disparar Teste Real'}</span>
              </button>
            </div>
          </div>

          {/* RETORNO DO TESTE N8N (SE HOUVER) */}
          {n8nTestResult && (
            <div className={`p-4 rounded-2xl border text-xs animate-in fade-in duration-200 ${
              n8nTestResult.success
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-red-950/40 border-red-500/40 text-red-300'
            }`}>
              <div className="flex items-center gap-2 font-bold mb-1">
                <span className="material-symbols-outlined text-base">
                  {n8nTestResult.success ? 'check_circle' : 'error'}
                </span>
                <span>
                  {n8nTestResult.success
                    ? `Disparo realizado com sucesso! Status HTTP ${n8nTestResult.status} (200 OK)`
                    : `Falha no teste: ${n8nTestResult.error}`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {n8nTestResult.success
                  ? 'Verifique a aba Executions (Execuções) no seu n8n para ver o fluxo processando o lead de teste!'
                  : 'Certifique-se de que o workflow está Ativo (Published) no n8n ou com o nó Webhook em modo "Listen for test event".'}
              </p>
            </div>
          )}

          {/* CONFIGURAÇÃO DA WEBHOOK URL & SINCRONIZAÇÃO COM A EVOLUTION API */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-400">settings_ethernet</span>
              URL do Webhook no n8n &amp; Sincronização na Evolution API
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-8">
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Endpoint do Webhook no n8n:
                </label>
                <input
                  type="text"
                  value={config.n8nWebhookUrl || ''}
                  onChange={(e) => setConfig({ ...config, n8nWebhookUrl: e.target.value })}
                  placeholder="https://portaln8n.hotelnozap.com.br/webhook/super-agente-vendedor"
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs text-white font-mono focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSalvarConfig(config)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  Salvar URL
                </button>

                <button
                  type="button"
                  onClick={handleSincronizarEvolution}
                  disabled={sincronizandoEvolution}
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-orange-950/20 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">
                    {sincronizandoEvolution ? 'sync' : 'link'}
                  </span>
                  <span>{sincronizandoEvolution ? 'Sincronizando...' : 'Vincular na Evolution API'}</span>
                </button>
              </div>
            </div>

            {sincronizacaoResult && (
              <p className="text-xs font-semibold text-slate-300 bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                {sincronizacaoResult}
              </p>
            )}
          </div>

          {/* ARQUITETURA VISUAL DO WORKFLOW */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400">schema</span>
              Arquitetura dos Nós Configurados no Workflow do n8n
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-[10px] font-black uppercase text-orange-400">Nó 1</span>
                <h4 className="text-xs font-bold text-white mt-0.5">Webhook Evolution API</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Recebe eventos <code className="text-emerald-300">MESSAGES_UPSERT</code> da instância <code className="text-white">meutim</code>.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-[10px] font-black uppercase text-blue-400">Nó 2</span>
                <h4 className="text-xs font-bold text-white mt-0.5">Filtro Anti-Loop &amp; Extração</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Ignora mensagens enviadas pelo chip (<code className="text-amber-300">fromMe: true</code>) e ignora grupos/status.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-[10px] font-black uppercase text-purple-400">Nó 3</span>
                <h4 className="text-xs font-bold text-white mt-0.5">Classificador de Roteiro</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Identifica "Quem fala?", "Preço / Demonstração", "Já temos sistema", "É robô?" e gera as respostas oficiais.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-[10px] font-black uppercase text-emerald-400">Nó 4</span>
                <h4 className="text-xs font-bold text-white mt-0.5">Enviar Resposta ao Hotel</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Dispara a mensagem pelo endpoint <code className="text-white">POST /message/sendText</code> da Evolution API.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-[10px] font-black uppercase text-amber-400">Nó 5</span>
                <h4 className="text-xs font-bold text-white mt-0.5">Alerta VIP WhatsApp Everaldo</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Quando o lead demonstrar interesse, envia alerta instantâneo para seu WhatsApp (<code className="text-white">5565996173004</code>).
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-[10px] font-black uppercase text-pink-400">Nó 6 &amp; 7</span>
                <h4 className="text-xs font-bold text-white mt-0.5">Wait 5 Min + Follow-up</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Aguarda 5 minutos e envia a mensagem de suporte perguntando se deu tudo certo com o cadastro da LP.
                </p>
              </div>
            </div>
          </div>

          {/* PASSO A PASSO PARA IMPORTAR NO N8N */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400">help</span>
              Como Ativar no n8n em 1 Minuto:
            </h3>

            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300 leading-relaxed">
              <li>
                Clique no botão laranja acima <strong className="text-white">"Copiar JSON do Workflow"</strong> (ou baixe o arquivo .json).
              </li>
              <li>
                Acesse o painel do seu n8n (<a href="https://portaln8n.hotelnozap.com.br" target="_blank" rel="noopener noreferrer" className="text-orange-400 underline">portaln8n.hotelnozap.com.br</a>).
              </li>
              <li>
                Crie um novo workflow e simplesmente pressione <strong className="text-white">Ctrl + V</strong> dentro da tela do n8n (todos os nós aparecerão automaticamente conectados).
              </li>
              <li>
                Clique no botão de ativação <strong className="text-emerald-400">"Publish / Ativar"</strong> no topo direito do n8n. Pronto!
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSuperAgenteVendedor;
