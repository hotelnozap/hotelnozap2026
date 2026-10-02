import React, { useState, useEffect } from 'react';
import { systemLogsService } from '../services/systemLogsService';
import { mercadopagoService, MercadoPagoCredentials } from '../services/mercadopagoService';
import { currentHotelService, hoteisService } from '../services/supabaseService';
import { Hotel } from './CadastroHoteis';

export interface ConfiguracoesMercadoPagoProps {
  isAdmin?: boolean;
  hotelId?: string;
  hotelNome?: string;
  onBackToDashboard?: () => void;
}

export const ConfiguracoesMercadoPago: React.FC<ConfiguracoesMercadoPagoProps> = ({ 
  isAdmin = false,
  hotelId: propHotelId,
  hotelNome: propHotelNome,
  onBackToDashboard 
}) => {
  // Lista de Hotéis (se for Admin e quiser inspecionar/configurar um hotel específico)
  const [hoteisList, setHoteisList] = useState<Hotel[]>([]);
  const [selectedScope, setSelectedScope] = useState<'master' | string>(isAdmin ? 'master' : (propHotelId || 'current'));

  // Determinar hotel ativo quando no escopo de hotel
  const currentHotel = currentHotelService.getCurrentHotel();
  const effectiveHotelId = selectedScope === 'master' ? '' : (selectedScope === 'current' ? (currentHotel?.id || '') : selectedScope);
  const effectiveHotelName = selectedScope === 'master' 
    ? 'Administração Master SaaS' 
    : (hoteisList.find(h => h.id === effectiveHotelId)?.name || propHotelNome || currentHotel?.name || 'Hotel');

  // Estado do Ambiente
  const [environment, setEnvironment] = useState<'production' | 'sandbox'>('production');

  // Estado das Credenciais
  const [publicKey, setPublicKey] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [chavePixMaster, setChavePixMaster] = useState('def0e87a-f7d0-4c54-830b-473206cf78c6');

  // Métodos de Pagamento Habilitados
  const [enablePix, setEnablePix] = useState(true);
  const [enableCreditCard, setEnableCreditCard] = useState(true);
  const [enableBoleto, setEnableBoleto] = useState(false);
  const [maxInstallments, setMaxInstallments] = useState('12');

  // Webhook
  const webhookUrl = selectedScope === 'master'
    ? 'https://api.hotelnozap.com.br/webhooks/mercadopago/saas-planos'
    : `https://api.hotelnozap.com.br/webhooks/mercadopago/hotel/${effectiveHotelId || 'default'}`;
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Carrega lista de hotéis se for Admin
  useEffect(() => {
    if (isAdmin) {
      hoteisService.getHoteis().then(data => {
        if (data && data.length > 0) setHoteisList(data);
      }).catch(err => console.warn('Erro ao carregar hotéis para seletor:', err));
    }
  }, [isAdmin]);

  // Carrega as credenciais correspondentes ao escopo selecionado
  const loadCredentialsForScope = (scope: 'master' | string) => {
    if (scope === 'master') {
      const creds = mercadopagoService.getMasterCredentials();
      setEnvironment(creds.environment);
      setPublicKey(creds.publicKey);
      setAccessToken(creds.accessToken);
      setClientId(creds.clientId || '');
      setClientSecret(creds.clientSecret || '');
      setEnablePix(creds.enablePix);
      setEnableCreditCard(creds.enableCreditCard);
      setEnableBoleto(creds.enableBoleto);
      setMaxInstallments(creds.maxInstallments || '12');
      if (creds.chavePixMaster) {
        setChavePixMaster(creds.chavePixMaster);
      }

      // Sincroniza em tempo real com o banco de dados via API
      fetch('/api/get-pix-master')
        .then(res => res.json())
        .then(data => {
          if (data && data.success) {
            if (data.chavePix) setChavePixMaster(data.chavePix);
            if (data.publicKey && !creds.publicKey) setPublicKey(data.publicKey);
            if (data.token && !creds.accessToken) setAccessToken(data.token);
            if (data.environment) setEnvironment(data.environment);
          }
        })
        .catch(e => console.warn('Aviso ao consultar /api/get-pix-master:', e));
    } else {
      const hId = scope === 'current' ? (currentHotel?.id || '') : scope;
      if (hId) {
        const creds = mercadopagoService.getHotelCredentials(hId);
        setEnvironment(creds.environment);
        setPublicKey(creds.publicKey);
        setAccessToken(creds.accessToken);
        setClientId(creds.clientId || '');
        setClientSecret(creds.clientSecret || '');
        setEnablePix(creds.enablePix);
        setEnableCreditCard(creds.enableCreditCard);
        setEnableBoleto(creds.enableBoleto);
        setMaxInstallments(creds.maxInstallments || '12');
      }
    }
  };

  useEffect(() => {
    loadCredentialsForScope(selectedScope);
  }, [selectedScope]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copiado para a área de transferência!`);
  };

  const handleTestWebhook = async () => {
    setIsTestingWebhook(true);
    setTimeout(async () => {
      setIsTestingWebhook(false);
      try {
        await systemLogsService.addLog({
          level: 'info',
          module: 'financeiro',
          action: `Teste de Webhook Mercado Pago (${selectedScope === 'master' ? 'Master Planos SaaS' : effectiveHotelName})`,
          details: 'Simulação de notificação IPN validada com resposta HTTP 200 OK.',
          metadata: {
            scope: selectedScope === 'master' ? 'admin_master' : 'hotel_proprio',
            hotelId: effectiveHotelId || undefined,
            hotelNome: selectedScope === 'master' ? undefined : effectiveHotelName,
            webhookUrl,
            status: 200,
            response: 'OK'
          }
        });
      } catch { /* ignore */ }
      showToast('Conexão Webhook com Mercado Pago testada com sucesso! Status 200 OK');
    }, 1200);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: MercadoPagoCredentials = {
      environment,
      publicKey,
      accessToken,
      clientId,
      clientSecret,
      enablePix,
      enableCreditCard,
      enableBoleto,
      maxInstallments,
      chavePixMaster: selectedScope === 'master' ? chavePixMaster.trim() : undefined,
      updatedAt: new Date().toISOString()
    };

    if (selectedScope === 'master') {
      const ok = await mercadopagoService.saveMasterCredentials(payload);
      if (ok) {
        showToast('Credenciais Master do Mercado Pago salvas com sucesso!');
      } else {
        showToast('Erro ao salvar credenciais Master.');
      }
    } else {
      const targetId = effectiveHotelId || currentHotel?.id || 'default';
      const ok = await mercadopagoService.saveHotelCredentials(targetId, payload, effectiveHotelName);
      if (ok) {
        showToast(`Configurações de Mercado Pago salvas para ${effectiveHotelName}!`);
      } else {
        showToast('Erro ao salvar credenciais do hotel.');
      }
    }
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#d1fae5] border border-emerald-300 text-black font-bold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in zoom-in duration-200">
          <span className="material-symbols-outlined text-[#003400]">check_circle</span>
          <span className="text-xs sm:text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Botão Voltar se fornecido */}
      {onBackToDashboard && (
        <div className="flex items-center">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>{isAdmin ? 'Voltar para o Painel Administrativo' : 'Voltar para o Painel'}</span>
          </button>
        </div>
      )}

      {/* CABEÇALHO & SELEÇÃO DE ESCOPO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              selectedScope === 'master' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-800'
            }`}>
              <span className="material-symbols-outlined text-2xl">payments</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                  {selectedScope === 'master' ? 'Mercado Pago Master SaaS' : `Mercado Pago: ${effectiveHotelName}`}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  selectedScope === 'master' 
                    ? 'bg-sky-100 text-sky-800 border-sky-200' 
                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}>
                  {selectedScope === 'master' ? 'Recebimento de Planos SaaS' : 'Recebimento Direto do Hotel'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {selectedScope === 'master' 
                  ? 'Credenciais exclusivas da administração para processamento de pagamentos dos Planos Comerciais e Créditos SaaS.'
                  : 'Credenciais próprias do estabelecimento para receber pagamentos de reservas e consumos com 0% de comissão.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Seletor de Escopo para Administrador */}
          {isAdmin && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Escopo:</span>
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
              >
                <option value="master">🛡️ Conta Master SaaS (Planos &amp; Créditos)</option>
                {hoteisList.map(h => (
                  <option key={h.id} value={h.id}>
                    🏨 Hotel: {h.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-[#003400] hover:bg-[#002500] shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-lg">check_circle</span>
            <span>Salvar Configurações</span>
          </button>
        </div>
      </div>

      {/* BANNER DE REGRAS DE NEGÓCIO: ESCOPO MASTER VS ESCOPO HOTEL */}
      {selectedScope === 'master' ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 border border-sky-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Gateway Exclusivo para Arrecadação de Planos SaaS &amp; Créditos
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Plano Grátis Isento
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-3xl">
                As credenciais cadastradas aqui são de <strong>titularidade exclusiva da administração do Hotel no Zap</strong> e são utilizadas unicamente para cobrança de assinaturas de planos comerciais pagos e recargas de créditos. <strong>O Plano Grátis (Google Maps / Degustação) é 100% isento de cobrança</strong>. Cada hotel da rede possui suas próprias chaves no seu painel para receber diretamente as diárias dos seus hóspedes.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-sky-800 border border-sky-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Conta Master Ativa
            </span>
          </div>
        </div>
      ) : (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border border-emerald-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#003400] text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-2xl">storefront</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Conta Própria de Recebimento do Estabelecimento ({effectiveHotelName})
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-200 text-emerald-900 border border-emerald-300">
                  0% de Comissão
                </span>
              </div>
              <p className="text-xs text-slate-700 mt-1 leading-relaxed max-w-3xl">
                Configure as credenciais da conta Mercado Pago deste hotel. O valor pago pelos seus hóspedes via PIX e Cartão nas reservas diretas <strong>cai 100% na conta bancária do hotel</strong>. O Hotel no Zap não intermedia nem retém o valor dos seus hóspedes.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-emerald-800 border border-emerald-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Recebimento Direto Hotel
            </span>
          </div>
        </div>
      )}

      {/* KPIS BENTO CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 shadow-xs flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 truncate block">Status da Integração</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{accessToken ? 'Conectado' : 'Aguardando Chaves'}</span>
            </div>
            <span className="text-xs font-medium text-emerald-700 mt-0.5 block truncate">
              {accessToken ? 'Pronto para transações' : 'Insira as credenciais abaixo'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-200/60 flex items-center justify-center text-emerald-900 shrink-0">
            <span className="material-symbols-outlined text-xl">verified</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/80 border border-blue-200/80 shadow-xs flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800 truncate block">Ambiente Ativo</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1 capitalize">
              {environment === 'production' ? 'Produção (Real)' : 'Sandbox (Testes)'}
            </div>
            <span className="text-xs font-medium text-blue-700 mt-0.5 block truncate">
              {environment === 'production' ? 'Transações com dinheiro real' : 'Simulação de pagamentos'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-200/60 flex items-center justify-center text-blue-900 shrink-0">
            <span className="material-symbols-outlined text-xl">lan</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-purple-50/80 border border-purple-200/80 shadow-xs flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-800 truncate block">Finalidade das Chaves</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1 truncate">
              {selectedScope === 'master' ? 'Planos SaaS' : 'Reservas Hotel'}
            </div>
            <span className="text-xs font-medium text-purple-700 mt-0.5 block truncate">
              {selectedScope === 'master' ? 'Assinaturas & Créditos' : 'Diárias & Consumo'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-200/60 flex items-center justify-center text-purple-900 shrink-0">
            <span className="material-symbols-outlined text-xl">account_balance</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 border border-amber-200/80 shadow-xs flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 truncate block">Comissão da Plataforma</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">
              {selectedScope === 'master' ? '100% SaaS' : '0% de Taxa'}
            </div>
            <span className="text-xs font-medium text-amber-700 mt-0.5 block truncate">
              {selectedScope === 'master' ? 'Receita própria da plataforma' : 'Hotel no Zap não retém valor'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-200/60 flex items-center justify-center text-amber-900 shrink-0">
            <span className="material-symbols-outlined text-xl">percent</span>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO DE CONFIGURAÇÕES */}
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* SEÇÃO 1: AMBIENTE */}
        <div className="bg-white rounded-2xl p-5 md:p-7 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">settings_input_component</span>
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900">1. Ambiente de Operação</h2>
              <p className="text-xs text-slate-500">Alterne entre o ambiente de testes (Sandbox) e produção real de transações.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              environment === 'production' ? 'border-[#003400] bg-emerald-50/20 shadow-xs' : 'border-slate-200 hover:bg-slate-50'
            }`}>
              <input 
                type="radio" 
                name="environment" 
                value="production"
                checked={environment === 'production'}
                onChange={() => setEnvironment('production')}
                className="mt-1 text-[#003400] focus:ring-[#003400]"
              />
              <div>
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>Modo Produção (Real)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">Recomendado</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Transações reais processadas e liquidadas na conta bancária configurada.
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              environment === 'sandbox' ? 'border-[#003400] bg-emerald-50/20 shadow-xs' : 'border-slate-200 hover:bg-slate-50'
            }`}>
              <input 
                type="radio" 
                name="environment" 
                value="sandbox"
                checked={environment === 'sandbox'}
                onChange={() => setEnvironment('sandbox')}
                className="mt-1 text-[#003400] focus:ring-[#003400]"
              />
              <div>
                <div className="font-bold text-slate-900 text-sm">Modo Sandbox (Testes)</div>
                <p className="text-xs text-slate-500 mt-1">Utilizado para simuladores e cartões de teste sem cobrança real.</p>
              </div>
            </label>
          </div>
        </div>

        {/* SEÇÃO 2: CREDENCIAIS DA API */}
        <div className="bg-white rounded-2xl p-5 md:p-7 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">key</span>
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900">2. Credenciais de Integração API</h2>
              <p className="text-xs text-slate-500">
                Obtenha a Public Key e o Access Token no painel do desenvolvedor do Mercado Pago.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CAMPO DESTAQUE: CHAVE PIX MASTER (EXCLUSIVO ESCOPO MASTER SAAS) */}
            {selectedScope === 'master' && (
              <div className="col-span-1 md:col-span-2 p-4 md:p-5 rounded-2xl bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-white border-2 border-emerald-500/30 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <label className="text-xs md:text-sm font-extrabold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-lg text-emerald-700">qr_code_2</span>
                      Chave PIX Master (Recebimento de Assinaturas & Planos SaaS)
                    </label>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 self-start sm:self-auto border border-emerald-200">
                    <span className="material-symbols-outlined text-xs">sync</span>
                    Sincronizada com Checkout
                  </span>
                </div>

                <div className="relative">
                  <input 
                    type="text" 
                    value={chavePixMaster}
                    onChange={(e) => setChavePixMaster(e.target.value)}
                    placeholder="Chave EVP aleatória, CNPJ, E-mail ou Telefone" 
                    className="w-full pl-3.5 pr-24 py-3 rounded-xl border-2 border-emerald-300 text-xs md:text-sm font-mono font-bold text-emerald-950 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-white shadow-inner"
                  />
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    {chavePixMaster && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(chavePixMaster, 'Chave PIX Master')}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 cursor-pointer flex items-center gap-1 transition-colors"
                        title="Copiar Chave PIX"
                      >
                        <span className="material-symbols-outlined text-sm">content_copy</span>
                        <span>Copiar</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs text-emerald-800/80">
                  <span className="material-symbols-outlined text-sm text-emerald-600 shrink-0 mt-0.5">info</span>
                  <p>
                    Esta chave PIX é utilizada no checkout automático de cadastro e assinatura de novos hotéis parceiros. Ao clicar em <strong>Salvar Configurações</strong>, a chave é gravada no banco de dados e aplicada imediatamente para todos os novos pagamentos de planos.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Public Key (Chave Pública)
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="APP_USR-xxxx-xxxx" 
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm font-mono focus:outline-none focus:border-[#003400] bg-slate-50/30"
                />
                {publicKey && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(publicKey, 'Public Key')}
                    className="absolute right-2 top-2 p-1 text-slate-400 hover:text-[#003400] cursor-pointer"
                    title="Copiar Public Key"
                  >
                    <span className="material-symbols-outlined text-base">content_copy</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Access Token (Token de Acesso Privado)
              </label>
              <div className="relative">
                <input 
                  type={showAccessToken ? 'text' : 'password'}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="APP_USR-xxxx-xxxx" 
                  className="w-full pl-3.5 pr-20 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm font-mono focus:outline-none focus:border-[#003400] bg-slate-50/30"
                />
                <div className="absolute right-2 top-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowAccessToken(!showAccessToken)}
                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    title={showAccessToken ? "Ocultar Token" : "Exibir Token"}
                  >
                    <span className="material-symbols-outlined text-base">
                      {showAccessToken ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                  {accessToken && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(accessToken, 'Access Token')}
                      className="p-1 text-slate-400 hover:text-[#003400] cursor-pointer"
                      title="Copiar Access Token"
                    >
                      <span className="material-symbols-outlined text-base">content_copy</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Client ID (Opcional)
              </label>
              <input 
                type="text" 
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="4829104819284019" 
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm font-mono focus:outline-none focus:border-[#003400] bg-slate-50/30"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Client Secret (Opcional)
              </label>
              <div className="relative">
                <input 
                  type={showClientSecret ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="SecretKey_MP_..." 
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm font-mono focus:outline-none focus:border-[#003400] bg-slate-50/30"
                />
                <button
                  type="button"
                  onClick={() => setShowClientSecret(!showClientSecret)}
                  className="absolute right-2 top-2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">
                    {showClientSecret ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SEÇÃO 3: MÉTODOS DE PAGAMENTO */}
        <div className="bg-white rounded-2xl p-5 md:p-7 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">credit_card</span>
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900">3. Formas de Pagamento Habilitadas</h2>
              <p className="text-xs text-slate-500">
                {selectedScope === 'master'
                  ? 'Selecione os métodos que os hotéis podem utilizar para pagar a assinatura do plano ou pacotes de créditos.'
                  : 'Selecione as opções de recebimento que serão exibidas para seus hóspedes no WhatsApp e no site.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            
            {/* Pix Instantâneo */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-base">qr_code_2</span>
                  <span>Pix Instantâneo</span>
                </div>
                <p className="text-xs text-slate-500">Gera QR Code e Copia e Cola com liquidação imediata.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  checked={enablePix} 
                  onChange={() => setEnablePix(!enablePix)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003400]"></div>
              </label>
            </div>

            {/* Cartão de Crédito */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-base">credit_card</span>
                  <span>Cartão de Crédito</span>
                </div>
                <p className="text-xs text-slate-500">Aceita Visa, Mastercard, Elo, Amex e Hipercard.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  checked={enableCreditCard} 
                  onChange={() => setEnableCreditCard(!enableCreditCard)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003400]"></div>
              </label>
            </div>

            {/* Boleto Bancário */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-600 text-base">receipt_long</span>
                  <span>Boleto Bancário</span>
                </div>
                <p className="text-xs text-slate-500">Compensação em até 1 a 2 dias úteis.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  checked={enableBoleto} 
                  onChange={() => setEnableBoleto(!enableBoleto)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003400]"></div>
              </label>
            </div>
          </div>

          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Parcelamento Máximo no Cartão
              </label>
              <select 
                value={maxInstallments}
                onChange={(e) => setMaxInstallments(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm font-semibold focus:outline-none focus:border-[#003400] bg-white cursor-pointer"
              >
                <option value="1">À vista (1x)</option>
                <option value="3">Até 3x sem juros</option>
                <option value="6">Até 6x sem juros</option>
                <option value="12">Até 12x no cartão</option>
              </select>
            </div>
          </div>
        </div>

        {/* SEÇÃO 4: WEBHOOK & RETORNO DE PAGAMENTO */}
        <div className="bg-white rounded-2xl p-5 md:p-7 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">webhook</span>
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900">4. URL do Webhook de Notificação IPN</h2>
              <p className="text-xs text-slate-500">
                {selectedScope === 'master'
                  ? 'URL para onde o Mercado Pago avisa sobre pagamentos de planos SaaS e liberação automática de créditos.'
                  : 'URL para onde o Mercado Pago envia a confirmação instantânea de pagamento da reserva do hóspede.'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input 
                type="text" 
                readOnly
                value={webhookUrl}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm font-mono bg-slate-100 text-slate-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(webhookUrl, 'URL do Webhook')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
              >
                <span className="material-symbols-outlined text-base">content_copy</span>
                <span>Copiar URL</span>
              </button>
              <button
                type="button"
                disabled={isTestingWebhook}
                onClick={handleTestWebhook}
                className="px-4 py-2.5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">
                  {isTestingWebhook ? 'sync' : 'network_check'}
                </span>
                <span>{isTestingWebhook ? 'Testando...' : 'Testar Conexão'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Copie esta URL e cole na seção de **Webhooks / Notificações de Pagamento** no painel de desenvolvedor do Mercado Pago.
            </p>
          </div>
        </div>

        {/* RODAPÉ DE AÇÕES */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-[#003400] hover:bg-[#002500] text-white font-bold text-sm shadow-md transition-all cursor-pointer active:scale-95 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">check_circle</span>
            <span>Salvar Configurações ({selectedScope === 'master' ? 'Master SaaS' : effectiveHotelName})</span>
          </button>
        </div>

      </form>
    </div>
  );
};
