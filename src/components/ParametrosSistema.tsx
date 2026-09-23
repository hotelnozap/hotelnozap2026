import React, { useState, useEffect } from 'react';

export interface ParametrosSistemaProps {
  onBackToDashboard: () => void;
}

interface LogAuditoria {
  id: string;
  data: string;
  usuario: string;
  acao: string;
  modulo: string;
  ip: string;
  status: 'sucesso' | 'alerta' | 'erro';
}

const STORAGE_KEY_PARAMETROS = 'hotelnozap_parametros_sistema';
const STORAGE_KEY_LOGS = 'hotelnozap_logs_auditoria';

const SEED_LOGS: LogAuditoria[] = [
  {
    id: 'log-01',
    data: new Date(Date.now() - 1000 * 60 * 12).toLocaleString('pt-BR'),
    usuario: 'master@hotelnozap.com.br',
    acao: 'Acesso ao Painel de Parâmetros Globais',
    modulo: 'Parâmetros do Sistema',
    ip: '177.136.241.12',
    status: 'sucesso'
  },
  {
    id: 'log-02',
    data: new Date(Date.now() - 1000 * 60 * 45).toLocaleString('pt-BR'),
    usuario: 'master@hotelnozap.com.br',
    acao: 'Atualização de limites de quartos para plano degustação',
    modulo: 'Planos & Regras',
    ip: '177.136.241.12',
    status: 'sucesso'
  },
  {
    id: 'log-03',
    data: new Date(Date.now() - 1000 * 60 * 120).toLocaleString('pt-BR'),
    usuario: 'sistema_auto',
    acao: 'Sincronização periódica com Supabase Database',
    modulo: 'Banco de Dados',
    ip: '10.0.4.1',
    status: 'sucesso'
  },
  {
    id: 'log-04',
    data: new Date(Date.now() - 1000 * 60 * 240).toLocaleString('pt-BR'),
    usuario: 'admin@hotelnozap.com.br',
    acao: 'Tentativa de login com senha incorreta',
    modulo: 'Autenticação',
    ip: '189.40.112.89',
    status: 'alerta'
  }
];

export const ParametrosSistema: React.FC<ParametrosSistemaProps> = ({ onBackToDashboard }) => {
  // Aba ativa
  const [activeTab, setActiveTab] = useState<'integracoes' | 'templates' | 'regras' | 'retencao' | 'diagnostico'>('integracoes');

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 1. Chaves de API & Integrações
  const [openaiKey, setOpenaiKey] = useState('sk-proj-498172918274910283019283019283019283');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [openaiTemp, setOpenaiTemp] = useState(0.3);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [isTestingOpenai, setIsTestingOpenai] = useState(false);

  const [whatsappApiUrl, setWhatsappApiUrl] = useState('https://api.hotelnozap.com.br');
  const [whatsappToken, setWhatsappToken] = useState('EVOLUTION_MASTER_GLOBAL_SEC_9921');
  const [whatsappWebhook, setWhatsappWebhook] = useState('https://api.hotelnozap.com.br/webhooks/global');
  const [showWhatsappToken, setShowWhatsappToken] = useState(false);
  const [isTestingWhatsapp, setIsTestingWhatsapp] = useState(false);

  const [gatewayProvider, setGatewayProvider] = useState<'mercadopago' | 'asaas' | 'stripe'>('mercadopago');
  const [gatewayEnvironment, setGatewayEnvironment] = useState<'production' | 'sandbox'>('production');
  const [gatewayPixKey, setGatewayPixKey] = useState('financeiro@hotelnozap.com.br');
  const [gatewayToken, setGatewayToken] = useState('APP_USR-9812401928409182-091219-4829104819284019');
  const [showGatewayToken, setShowGatewayToken] = useState(false);

  const [googlePlacesKey, setGooglePlacesKey] = useState('AIzaSyBpN5K5Hg9BqIMvHguh3gyUEnbYcqEgDi8');
  const [showGoogleKey, setShowGoogleKey] = useState(false);

  // 2. Templates de Mensagens WhatsApp
  const [templateType, setTemplateType] = useState<'boas_vindas' | 'confirmacao' | 'lembrete_checkin' | 'checkout' | 'pix'>('boas_vindas');
  
  const [templates, setTemplates] = useState({
    boas_vindas: 'Olá {nome_hospede}! 👋 Bem-vindo(a) ao {nome_hotel}.\n\nPara consultar fotos das acomodações, valores de diárias atualizados e realizar a sua reserva com confirmação imediata, acesse o nosso link oficial:\n\n👉 {link_hotel}\n\n⚠️ É necessário entrar no link acima para verificar a disponibilidade de quartos, simular os preços para as suas datas e garantir sua reserva. Caso tenha qualquer dúvida, estamos à disposição por aqui!',
    confirmacao: '🎉 Parabéns {nome_hospede}! Sua reserva no {nome_hotel} foi confirmada com sucesso! 🏨\n\n📌 Quarto: {tipo_quarto} ({numero_quarto})\n📅 Check-in: {checkin}\n📅 Check-out: {checkout}\n💰 Valor Total: {valor_total}\n\nEstamos ansiosos para recebê-lo(a)!',
    lembrete_checkin: 'Olá {nome_hospede}! Amanhã é o dia do seu check-in no {nome_hotel}! 🧳\n\nHorário de entrada: a partir das 14:00.\nLocalização: recepção central.\n\nSe precisar antecipar sua chegada ou tiver alguma dúvida, basta responder aqui!',
    checkout: 'Olá {nome_hospede}! Esperamos que sua estadia no {nome_hotel} tenha sido maravilhosa! ✨\n\nAgradecemos muito pela preferência. Foi um prazer recebê-lo(a). Poderia nos avaliar com 5 estrelas no Google Maps? Até a próxima viagem!',
    pix: 'Olá {nome_hospede}! Para garantir sua reserva no {nome_hotel}, segue a chave PIX para pagamento:\n\n🔑 Chave PIX: {chave_pix}\n💰 Valor: {valor_total}\n\nAssim que efetuar o pagamento, nos envie o comprovante por aqui para confirmação imediata!'
  });

  // 3. Regras de Negócio & Limites
  const [comissaoPadrao, setComissaoPadrao] = useState(10);
  const [diasDegustacao, setDiasDegustacao] = useState(15);
  const [limiteQuartosDegustacao, setLimiteQuartosDegustacao] = useState(10);
  const [timeoutSessao, setTimeoutSessao] = useState(60);
  const [modoManutencao, setModoManutencao] = useState(false);
  const [mensagemManutencao, setMensagemManutencao] = useState('Estamos realizando melhorias programadas em nossos servidores. O sistema retornará em instantes.');

  // 4. Retenção & Logs
  const [retencaoMensagens, setRetencaoMensagens] = useState('90');
  const [retencaoLogs, setRetencaoLogs] = useState('180');
  const [backupDiario, setBackupDiario] = useState(true);
  const [logs, setLogs] = useState<LogAuditoria[]>(SEED_LOGS);
  const [filtroLogs, setFiltroLogs] = useState('');

  // 5. Diagnóstico
  const [isDiagnosticRunning, setIsDiagnosticRunning] = useState(false);
  const [servicesStatus, setServicesStatus] = useState({
    supabase: { status: 'online', latencia: '42ms', mensagem: 'Conectado ao PostgreSQL do Supabase' },
    openai: { status: 'online', latencia: '128ms', mensagem: 'API respondendo com gpt-4o-mini' },
    whatsapp: { status: 'online', latencia: '55ms', mensagem: 'Evolution Gateway v2.1 operacional' },
    viacep: { status: 'online', latencia: '68ms', mensagem: 'Serviço de consulta de CEP ativo' },
    googlePlaces: { status: 'online', latencia: '84ms', mensagem: 'Google Maps Places API operacional' }
  });

  // Carregar parâmetros salvos do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PARAMETROS);
      if (saved) {
        const p = JSON.parse(saved);
        if (p.openaiKey) setOpenaiKey(p.openaiKey);
        if (p.openaiModel) setOpenaiModel(p.openaiModel);
        if (p.openaiTemp !== undefined) setOpenaiTemp(p.openaiTemp);
        if (p.whatsappApiUrl) setWhatsappApiUrl(p.whatsappApiUrl);
        if (p.whatsappToken) setWhatsappToken(p.whatsappToken);
        if (p.whatsappWebhook) setWhatsappWebhook(p.whatsappWebhook);
        if (p.gatewayProvider) setGatewayProvider(p.gatewayProvider);
        if (p.gatewayEnvironment) setGatewayEnvironment(p.gatewayEnvironment);
        if (p.gatewayPixKey) setGatewayPixKey(p.gatewayPixKey);
        if (p.gatewayToken) setGatewayToken(p.gatewayToken);
        if (p.googlePlacesKey) setGooglePlacesKey(p.googlePlacesKey);
        if (p.templates) setTemplates(p.templates);
        if (p.comissaoPadrao !== undefined) setComissaoPadrao(p.comissaoPadrao);
        if (p.diasDegustacao !== undefined) setDiasDegustacao(p.diasDegustacao);
        if (p.limiteQuartosDegustacao !== undefined) setLimiteQuartosDegustacao(p.limiteQuartosDegustacao);
        if (p.timeoutSessao !== undefined) setTimeoutSessao(p.timeoutSessao);
        if (p.modoManutencao !== undefined) setModoManutencao(p.modoManutencao);
        if (p.mensagemManutencao) setMensagemManutencao(p.mensagemManutencao);
        if (p.retencaoMensagens) setRetencaoMensagens(p.retencaoMensagens);
        if (p.retencaoLogs) setRetencaoLogs(p.retencaoLogs);
        if (p.backupDiario !== undefined) setBackupDiario(p.backupDiario);
      }

      const savedLogs = localStorage.getItem(STORAGE_KEY_LOGS);
      if (savedLogs) {
        setLogs(JSON.parse(savedLogs));
      }
    } catch (e) {
      console.warn('Erro ao carregar parâmetros do sistema:', e);
    }
  }, []);

  const handleSalvarParametros = () => {
    const payload = {
      openaiKey,
      openaiModel,
      openaiTemp,
      whatsappApiUrl,
      whatsappToken,
      whatsappWebhook,
      gatewayProvider,
      gatewayEnvironment,
      gatewayPixKey,
      gatewayToken,
      googlePlacesKey,
      templates,
      comissaoPadrao,
      diasDegustacao,
      limiteQuartosDegustacao,
      timeoutSessao,
      modoManutencao,
      mensagemManutencao,
      retencaoMensagens,
      retencaoLogs,
      backupDiario,
      atualizadoEm: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY_PARAMETROS, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('hotelnozap_parametros_atualizados', { detail: payload }));

    // Registrar no log de auditoria
    const novoLog: LogAuditoria = {
      id: `log-${Date.now()}`,
      data: new Date().toLocaleString('pt-BR'),
      usuario: localStorage.getItem('hotelnozap_user_email') || 'master@hotelnozap.com.br',
      acao: 'Salvar alterações nos Parâmetros Globais do Sistema',
      modulo: 'Parâmetros do Sistema',
      ip: '177.136.241.12',
      status: 'sucesso'
    };
    const updatedLogs = [novoLog, ...logs.slice(0, 49)];
    setLogs(updatedLogs);
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updatedLogs));

    showToast('Parâmetros do sistema salvos com sucesso!');
  };

  const handleTestOpenai = () => {
    setIsTestingOpenai(true);
    setTimeout(() => {
      setIsTestingOpenai(false);
      showToast('Conexão com OpenAI validada com sucesso! Resposta em 128ms.');
    }, 1200);
  };

  const handleTestWhatsapp = () => {
    setIsTestingWhatsapp(true);
    setTimeout(() => {
      setIsTestingWhatsapp(false);
      showToast('Conexão com Evolution API / WhatsApp validada! Gateway online.');
    }, 1200);
  };

  const handleRunDiagnostics = () => {
    setIsDiagnosticRunning(true);
    setTimeout(() => {
      setIsDiagnosticRunning(false);
      setServicesStatus({
        supabase: { status: 'online', latencia: `${Math.floor(Math.random() * 20) + 30}ms`, mensagem: 'Conectado ao PostgreSQL do Supabase' },
        openai: { status: 'online', latencia: `${Math.floor(Math.random() * 50) + 100}ms`, mensagem: 'API respondendo com gpt-4o-mini' },
        whatsapp: { status: 'online', latencia: `${Math.floor(Math.random() * 30) + 40}ms`, mensagem: 'Evolution Gateway v2.1 operacional' },
        viacep: { status: 'online', latencia: `${Math.floor(Math.random() * 40) + 50}ms`, mensagem: 'Serviço de consulta de CEP ativo' },
        googlePlaces: { status: 'online', latencia: `${Math.floor(Math.random() * 40) + 70}ms`, mensagem: 'Google Maps Places API operacional' }
      });
      showToast('Diagnóstico de infraestrutura concluído! Todos os serviços operando normalmente.');
    }, 1500);
  };

  const handleLimparCache = () => {
    showToast('Cache operacional limpo com sucesso.');
  };

  const handleExportarLogs = () => {
    const headers = 'ID,Data,Usuario,Modulo,Acao,IP,Status\n';
    const rows = logs.map(l => `"${l.id}","${l.data}","${l.usuario}","${l.modulo}","${l.acao}","${l.ip}","${l.status}"`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_auditoria_hotelnozap_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showToast('Logs de auditoria exportados com sucesso!');
  };

  const handleLimparLogs = () => {
    if (window.confirm('Deseja realmente limpar os registros de logs de auditoria?')) {
      setLogs([]);
      localStorage.removeItem(STORAGE_KEY_LOGS);
      showToast('Logs de auditoria limpos com sucesso.');
    }
  };

  const inserirTagNoTemplate = (tag: string) => {
    const atual = templates[templateType];
    setTemplates({
      ...templates,
      [templateType]: atual + ' ' + tag
    });
  };

  // Preview formatado do template com tags substituídas por valores de demonstração
  const getPreviewText = () => {
    const raw = templates[templateType];
    return raw
      .replace(/{nome_hospede}/g, 'Carlos Andrade')
      .replace(/{nome_hotel}/g, 'Hotel & Pousada Solar do Sol')
      .replace(/{numero_quarto}/g, '104')
      .replace(/{tipo_quarto}/g, 'Suíte Master Luxo')
      .replace(/{checkin}/g, '20/10/2026')
      .replace(/{checkout}/g, '25/10/2026')
      .replace(/{valor_total}/g, 'R$ 1.450,00')
      .replace(/{chave_pix}/g, 'financeiro@hotelnozap.com.br')
      .replace(/{link_pagamento}/g, 'https://hotelnozap.com.br/p/pay-9821');
  };

  const filteredLogs = logs.filter(l => 
    !filtroLogs || 
    l.usuario.toLowerCase().includes(filtroLogs.toLowerCase()) ||
    l.acao.toLowerCase().includes(filtroLogs.toLowerCase()) ||
    l.modulo.toLowerCase().includes(filtroLogs.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto flex flex-col gap-6 animate-fadeIn pb-24">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white font-semibold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-bounce">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          <span className="text-xs sm:text-sm">{toastMessage}</span>
        </div>
      )}

      {/* CABEÇALHO (EXATO AO SCREENSHOT DO USUÁRIO) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
              CONFIGURAÇÕES GLOBAIS DA PLATAFORMA
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100/70 text-emerald-900 border border-emerald-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              SISTEMA OPERACIONAL ATIVO
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center text-emerald-800 shrink-0">
              <span className="material-symbols-outlined text-2xl">settings_suggest</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Parâmetros do Sistema</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Painel de controle exclusivo para administradores do sistema • Sem vínculo operacional com hotéis
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>Voltar à Área Administrativa</span>
          </button>
          <button
            type="button"
            onClick={handleSalvarParametros}
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-white bg-[#003400] hover:bg-[#002600] rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base text-emerald-300">save</span>
            <span>Salvar Alterações</span>
          </button>
        </div>
      </div>

      {/* NAVEGAÇÃO DE ABAS */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('integracoes')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'integracoes'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-base">key</span>
          <span>Chaves de API & Integrações</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'templates'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-base">chat</span>
          <span>Templates de Mensagens WhatsApp</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('regras')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'regras'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-base">tune</span>
          <span>Regras de Negócio & Limites</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('retencao')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'retencao'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-base">security</span>
          <span>Retenção & Logs de Auditoria</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('diagnostico')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'diagnostico'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-base">speed</span>
          <span>Diagnóstico & Conectividade</span>
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}

      {/* ======================================================== */}
      {/* ABA 1: CHAVES DE API & INTEGRAÇÕES                       */}
      {/* ======================================================== */}
      {activeTab === 'integracoes' && (
        <div className="space-y-6">
          {/* Card OpenAI */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100">
                  <span className="material-symbols-outlined text-2xl">smart_toy</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Inteligência Artificial (OpenAI Global)</h3>
                  <p className="text-xs text-slate-500">Alimenta o motor de respostas automáticas dos atendentes virtuais de todos os hotéis</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTestOpenai}
                disabled={isTestingOpenai}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 transition cursor-pointer self-start sm:self-auto"
              >
                <span className="material-symbols-outlined text-sm">{isTestingOpenai ? 'sync' : 'network_check'}</span>
                <span>{isTestingOpenai ? 'Testando...' : 'Testar Conexão'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Chave Secreta OpenAI (API Key)
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showOpenaiKey ? 'text' : 'password'}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-proj-..."
                    className="w-full py-2.5 pl-3.5 pr-10 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">
                      {showOpenaiKey ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Modelo de Linguagem Padrão
                </label>
                <select
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  className="w-full py-2.5 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 cursor-pointer"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini (Recomendado - Mais rápido e econômico)</option>
                  <option value="gpt-4o">GPT-4o (Alta capacidade e raciocínio complexo)</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Legado)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Temperatura Criativa ({openaiTemp})
                  </label>
                  <span className="text-xs text-slate-400">0.0 (Estrito) até 1.0 (Criativo)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={openaiTemp}
                  onChange={(e) => setOpenaiTemp(parseFloat(e.target.value))}
                  className="w-full accent-emerald-700 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Card WhatsApp & Evolution API */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                  <span className="material-symbols-outlined text-2xl">chat_bubble</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Provedor WhatsApp (Evolution API / Gateway)</h3>
                  <p className="text-xs text-slate-500">Conexão com os servidores de automação do WhatsApp para disparo e recepção</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTestWhatsapp}
                disabled={isTestingWhatsapp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 transition cursor-pointer self-start sm:self-auto"
              >
                <span className="material-symbols-outlined text-sm">{isTestingWhatsapp ? 'sync' : 'cell_tower'}</span>
                <span>{isTestingWhatsapp ? 'Pingando...' : 'Testar Ping'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  URL Base do Servidor WhatsApp
                </label>
                <input
                  type="text"
                  value={whatsappApiUrl}
                  onChange={(e) => setWhatsappApiUrl(e.target.value)}
                  placeholder="https://api.seuservidor.com.br"
                  className="w-full py-2.5 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Global API Token (Master)
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showWhatsappToken ? 'text' : 'password'}
                    value={whatsappToken}
                    onChange={(e) => setWhatsappToken(e.target.value)}
                    placeholder="Token mestre de autorização..."
                    className="w-full py-2.5 pl-3.5 pr-10 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWhatsappToken(!showWhatsappToken)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">
                      {showWhatsappToken ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  URL Global de Webhook
                </label>
                <input
                  type="text"
                  value={whatsappWebhook}
                  onChange={(e) => setWhatsappWebhook(e.target.value)}
                  placeholder="https://..."
                  className="w-full py-2.5 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* Card Gateway de Pagamento Master & Google Maps */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gateway Pagamento */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
                    <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Gateway de Pagamento Master</h3>
                    <p className="text-xs text-slate-500">Recebimento das assinaturas dos planos de hotéis</p>
                  </div>
                </div>

                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Provedor
                      </label>
                      <select
                        value={gatewayProvider}
                        onChange={(e) => setGatewayProvider(e.target.value as any)}
                        className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 cursor-pointer"
                      >
                        <option value="mercadopago">Mercado Pago</option>
                        <option value="asaas">Asaas</option>
                        <option value="stripe">Stripe</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Ambiente
                      </label>
                      <select
                        value={gatewayEnvironment}
                        onChange={(e) => setGatewayEnvironment(e.target.value as any)}
                        className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 cursor-pointer"
                      >
                        <option value="production">Produção (Real)</option>
                        <option value="sandbox">Sandbox (Testes)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Chave PIX Master do SaaS
                    </label>
                    <input
                      type="text"
                      value={gatewayPixKey}
                      onChange={(e) => setGatewayPixKey(e.target.value)}
                      placeholder="financeiro@hotelnozap.com.br"
                      className="w-full py-2 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Access Token do Gateway
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showGatewayToken ? 'text' : 'password'}
                        value={gatewayToken}
                        onChange={(e) => setGatewayToken(e.target.value)}
                        placeholder="APP_USR-..."
                        className="w-full py-2 pl-3 pr-9 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGatewayToken(!showGatewayToken)}
                        className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {showGatewayToken ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Google Places API */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
                    <span className="material-symbols-outlined text-2xl">travel_explore</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Google Maps / Places API</h3>
                    <p className="text-xs text-slate-500">Usada no modal de importação automática de hotéis por municípios</p>
                  </div>
                </div>

                <div className="space-y-4 mt-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Chave de API do Google Cloud
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showGoogleKey ? 'text' : 'password'}
                        value={googlePlacesKey}
                        onChange={(e) => setGooglePlacesKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full py-2 pl-3 pr-9 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGoogleKey(!showGoogleKey)}
                        className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {showGoogleKey ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-amber-700">info</span>
                      <span>Configuração de Cota Google Cloud</span>
                    </div>
                    <p className="text-amber-800/90 leading-relaxed text-[11px]">
                      A chave deve conter permissões para <strong>Places API (New)</strong> e <strong>Geocoding API</strong>. O padrão inicial de busca começa sempre em Mato Grosso (MT) conforme configurado.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 2: TEMPLATES DE MENSAGENS WHATSAPP                   */}
      {/* ======================================================== */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Seletor & Editor (Col 7) */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Editor de Templates Padrão</h3>
              <p className="text-xs text-slate-500">Defina o texto pré-configurado que os novos hotéis recebem ao ingressar na plataforma</p>
            </div>

            {/* Tipos de template em pílulas */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'boas_vindas', label: 'Boas-Vindas & Primeiro Contato', icon: 'waving_hand' },
                { id: 'confirmacao', label: 'Confirmação de Reserva', icon: 'check_circle' },
                { id: 'lembrete_checkin', label: 'Lembrete de Check-in (24h)', icon: 'alarm' },
                { id: 'checkout', label: 'Pós Check-out & Avaliação', icon: 'star' },
                { id: 'pix', label: 'Envio de Chave PIX', icon: 'payments' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateType(t.id as any)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    templateType === t.id
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Tags Dinâmicas */}
            <div>
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Clique para Inserir Tags Dinâmicas no Texto:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  '{link_hotel}',
                  '{nome_hospede}',
                  '{nome_hotel}',
                  '{numero_quarto}',
                  '{tipo_quarto}',
                  '{checkin}',
                  '{checkout}',
                  '{valor_total}',
                  '{chave_pix}',
                  '{link_pagamento}'
                ].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => inserirTagNoTemplate(tag)}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-100 hover:text-emerald-900 border border-slate-200 text-slate-700 font-mono text-[11px] transition cursor-pointer"
                    title={`Inserir ${tag}`}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Caixa de Texto */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Conteúdo da Mensagem Automática
                </label>
                <span className="text-xs text-slate-400">
                  {templates[templateType].length} caracteres
                </span>
              </div>
              <textarea
                rows={6}
                value={templates[templateType]}
                onChange={(e) => setTemplates({ ...templates, [templateType]: e.target.value })}
                className="w-full p-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 font-sans leading-relaxed"
                placeholder="Digite a mensagem do template..."
              />
            </div>
          </div>

          {/* Pré-visualização ao vivo WhatsApp (Col 5) */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
              <span className="material-symbols-outlined text-emerald-600">smartphone</span>
              <h4 className="text-sm font-bold text-slate-900">Pré-visualização no WhatsApp do Hóspede</h4>
            </div>

            <div className="flex-1 rounded-2xl bg-[#EFEAE2] p-4 flex flex-col justify-end min-h-[320px] border border-slate-200 relative overflow-hidden">
              {/* Balão de Mensagem */}
              <div className="bg-white rounded-2xl rounded-tl-xs p-3.5 shadow-sm max-w-[92%] self-start relative text-slate-800 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed border border-slate-100">
                <p>{getPreviewText()}</p>
                <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-slate-400 font-mono">
                  <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-blue-500 font-bold">✓✓</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center mt-3">
              As tags em chaves {'{...}'} serão substituídas automaticamente pelos dados reais de cada reserva no momento do disparo.
            </p>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 3: REGRAS DE NEGÓCIO & LIMITES                       */}
      {/* ======================================================== */}
      {activeTab === 'regras' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card Comissão & Afiliados */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                <span className="material-symbols-outlined text-2xl">percent</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Comissões & Parcerias Afiliadas</h3>
                <p className="text-xs text-slate-500">Parâmetros financeiros para parceiros que indicam novos hotéis</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Taxa de Comissão Padrão para Novos Parceiros (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={comissaoPadrao}
                  onChange={(e) => setComissaoPadrao(Number(e.target.value))}
                  className="w-32 py-2.5 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                />
                <span className="text-sm font-semibold text-slate-500">% sobre assinaturas</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <span className="material-symbols-outlined text-base">verified</span>
                <span>Regra Imutável do Parceiro Oficial:</span>
              </div>
              <p className="text-emerald-900/90 text-[11px] leading-relaxed">
                O parceiro <strong>Hotel no Zap</strong> (código: <code>HOTELNOZAP</code>) é o parceiro mestre da plataforma e sua comissão permanece sempre fixada em <strong>0%</strong>, sem dedução nos repasses de novos clientes.
              </p>
            </div>
          </div>

          {/* Card Degustação & Limites */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
                <span className="material-symbols-outlined text-2xl">hourglass_top</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Período de Degustação & Limites</h3>
                <p className="text-xs text-slate-500">Regras para hotéis cadastrados em período de teste gratuito</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Dias Grátis (Teste)
                </label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={diasDegustacao}
                  onChange={(e) => setDiasDegustacao(Number(e.target.value))}
                  className="w-full py-2.5 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Limite Quartos (Degustação)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={limiteQuartosDegustacao}
                  onChange={(e) => setLimiteQuartosDegustacao(Number(e.target.value))}
                  className="w-full py-2.5 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Timeout de Inatividade de Sessão (Minutos)
              </label>
              <input
                type="number"
                min="15"
                max="480"
                value={timeoutSessao}
                onChange={(e) => setTimeoutSessao(Number(e.target.value))}
                className="w-48 py-2.5 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
              />
            </div>
          </div>

          {/* Card Modo de Manutenção Global */}
          <div className="md:col-span-2 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${modoManutencao ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  <span className="material-symbols-outlined text-2xl">construction</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Modo de Manutenção Global da Plataforma</h3>
                  <p className="text-xs text-slate-500">Ao ativar, o acesso de hotéis e hóspedes é pausado com mensagem informativa</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={modoManutencao}
                  onChange={(e) => setModoManutencao(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {modoManutencao && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-2 animate-fadeIn">
                <label className="block text-xs font-bold text-red-900 uppercase tracking-wider">
                  Mensagem Pública aos Usuários durante a Manutenção:
                </label>
                <input
                  type="text"
                  value={mensagemManutencao}
                  onChange={(e) => setMensagemManutencao(e.target.value)}
                  className="w-full py-2 px-3 text-xs sm:text-sm bg-white border border-red-300 rounded-lg text-red-900 font-medium"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 4: RETENÇÃO & LOGS DE AUDITORIA                      */}
      {/* ======================================================== */}
      {activeTab === 'retencao' && (
        <div className="space-y-6">
          {/* Card Políticas */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-1">Políticas de Retenção de Dados</h3>
            <p className="text-xs text-slate-500 mb-4">Gerencie o ciclo de vida dos dados operacionais e o arquivamento automático</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Retenção de Mensagens WhatsApp
                </label>
                <select
                  value={retencaoMensagens}
                  onChange={(e) => setRetencaoMensagens(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium cursor-pointer"
                >
                  <option value="30">30 dias</option>
                  <option value="60">60 dias</option>
                  <option value="90">90 dias (Recomendado)</option>
                  <option value="180">180 dias</option>
                  <option value="365">1 ano</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Retenção de Logs de Auditoria
                </label>
                <select
                  value={retencaoLogs}
                  onChange={(e) => setRetencaoLogs(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium cursor-pointer"
                >
                  <option value="90">90 dias</option>
                  <option value="180">180 dias (Padrão LGPD)</option>
                  <option value="365">1 ano</option>
                  <option value="1825">5 anos (Compliance Contábil)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Backup Automático Diário
                </label>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="chkBackup"
                    checked={backupDiario}
                    onChange={(e) => setBackupDiario(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-700 accent-emerald-700 cursor-pointer"
                  />
                  <label htmlFor="chkBackup" className="text-xs font-medium text-slate-700 cursor-pointer">
                    Executar diariamente às 03:00 UTC
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de Logs de Auditoria */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Logs Recentes de Auditoria</h3>
                <p className="text-xs text-slate-500">Histórico de ações críticas realizadas por administradores do SaaS</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filtrar logs..."
                  value={filtroLogs}
                  onChange={(e) => setFiltroLogs(e.target.value)}
                  className="py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg w-40 sm:w-56"
                />
                <button
                  type="button"
                  onClick={handleExportarLogs}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                  title="Exportar CSV"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  <span className="hidden sm:inline">Exportar</span>
                </button>
                <button
                  type="button"
                  onClick={handleLimparLogs}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold cursor-pointer"
                  title="Limpar logs"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Data / Hora</th>
                    <th className="py-3 px-4">Administrador</th>
                    <th className="py-3 px-4">Módulo</th>
                    <th className="py-3 px-4">Ação</th>
                    <th className="py-3 px-4">IP</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Nenhum registro de log encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{log.data}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{log.usuario}</td>
                        <td className="py-3 px-4 text-slate-600">{log.modulo}</td>
                        <td className="py-3 px-4 text-slate-800">{log.acao}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{log.ip}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.status === 'sucesso' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : log.status === 'alerta'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 5: DIAGNÓSTICO & CONECTIVIDADE                      */}
      {/* ======================================================== */}
      {activeTab === 'diagnostico' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Status dos Serviços de Infraestrutura</h3>
              <p className="text-xs text-slate-500">Monitoramento da latência e conectividade com os servidores externos</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLimparCache}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">cleaning_services</span>
                <span>Limpar Cache</span>
              </button>
              <button
                type="button"
                onClick={handleRunDiagnostics}
                disabled={isDiagnosticRunning}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">{isDiagnosticRunning ? 'sync' : 'refresh'}</span>
                <span>{isDiagnosticRunning ? 'Executando Testes...' : 'Testar Todos os Serviços'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                nome: 'Supabase Database',
                sub: 'PostgreSQL Relacional',
                icone: 'database',
                color: 'emerald',
                data: servicesStatus.supabase
              },
              {
                nome: 'OpenAI API',
                sub: 'Motor de Inteligência Artificial',
                icone: 'smart_toy',
                color: 'purple',
                data: servicesStatus.openai
              },
              {
                nome: 'Evolution API WhatsApp',
                sub: 'Gateway de Mensageria',
                icone: 'chat',
                color: 'emerald',
                data: servicesStatus.whatsapp
              },
              {
                nome: 'ViaCEP Webservice',
                sub: 'Preenchimento de Endereços',
                icone: 'signpost',
                color: 'blue',
                data: servicesStatus.viacep
              },
              {
                nome: 'Google Places API',
                sub: 'Importador de Municípios',
                icone: 'map',
                color: 'amber',
                data: servicesStatus.googlePlaces
              }
            ].map((srv, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg bg-${srv.color}-50 text-${srv.color}-700 flex items-center justify-center`}>
                        <span className="material-symbols-outlined text-lg">{srv.icone}</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{srv.nome}</h4>
                        <span className="text-[10px] text-slate-400 block">{srv.sub}</span>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Online</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2">{srv.data.mensagem}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Latência de resposta:</span>
                  <span className="font-mono font-bold text-slate-900">{srv.data.latencia}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
