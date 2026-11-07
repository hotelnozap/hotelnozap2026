import React, { useState, useEffect } from 'react';
import { infinitepayService, InfinitePayCredentials } from '../services/infinitepayService';
import { paymentGatewayService, GatewayPadrao } from '../services/paymentGatewayService';
import { currentHotelService, hoteisService } from '../services/supabaseService';
import { Hotel } from './CadastroHoteis';

export interface ConfiguracoesInfinitePayProps {
  isAdmin?: boolean;
  hotelId?: string;
  hotelNome?: string;
  onBackToDashboard?: () => void;
}

export const ConfiguracoesInfinitePay: React.FC<ConfiguracoesInfinitePayProps> = ({
  isAdmin = false,
  hotelId: propHotelId,
  hotelNome: propHotelNome,
  onBackToDashboard
}) => {
  const [hoteisList, setHoteisList] = useState<Hotel[]>([]);
  const currentHotel = currentHotelService.getCurrentHotel();
  const effectiveHotelId = propHotelId || currentHotel?.id || '';
  const effectiveHotelName = propHotelNome || currentHotel?.name || 'Hotel';

  // Checkout Padrão Selecionado
  const [defaultGateway, setDefaultGatewayState] = useState<GatewayPadrao>('infinitepay');

  // Estados do Formulário
  const [enabled, setEnabled] = useState(true);
  const [apiKey, setApiKey] = useState('inchk_dGT5_7LqxwjNQifWRpIF9aO8r5PFfgiyZCI9JvVbFj0');
  const [showApiKey, setShowApiKey] = useState(false);
  const [handle, setHandle] = useState('everaldo-souza-6yb');
  const [environment, setEnvironment] = useState<'production' | 'sandbox'>('production');
  const [enablePix, setEnablePix] = useState(true);
  const [enableCreditCard, setEnableCreditCard] = useState(true);
  const [maxInstallments, setMaxInstallments] = useState('12');

  // Estados de Operação / Teste
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; sampleUrl?: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const webhookUrl = 'https://hotelnozap.com.br/api/infinitepay-webhook';

  useEffect(() => {
    if (isAdmin) {
      hoteisService.getHoteis().then(data => {
        if (data && data.length > 0) setHoteisList(data);
      }).catch(err => console.warn('Erro ao carregar lista de hotéis:', err));
    }

    // Carrega o gateway padrão atual
    const currentDef = paymentGatewayService.getDefaultGateway(effectiveHotelId);
    setDefaultGatewayState(currentDef);

    if (effectiveHotelId) {
      const creds = infinitepayService.getHotelCredentials(effectiveHotelId);
      setEnabled(creds.enabled);
      if (creds.apiKey) setApiKey(creds.apiKey);
      if (creds.handle) setHandle(creds.handle);
      setEnvironment(creds.environment);
      setEnablePix(creds.enablePix);
      setEnableCreditCard(creds.enableCreditCard);
      setMaxInstallments(creds.maxInstallments);
    }
  }, [isAdmin, effectiveHotelId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copiado para a área de transferência!`);
  };

  const handleSetDefaultGateway = async (gw: GatewayPadrao) => {
    setDefaultGatewayState(gw);
    const ok = await paymentGatewayService.setDefaultGateway(gw, effectiveHotelId, effectiveHotelName);
    if (ok) {
      showToast(gw === 'infinitepay' 
        ? '⚡ InfinitePay definido como Checkout Padrão com Taxa Zero!' 
        : 'Mercado Pago definido como Checkout Padrão!');
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await infinitepayService.testConnection(apiKey);
      setTestResult(res);
      if (res.success) {
        showToast('Conexão com a InfinitePay bem-sucedida! Gateway ativo.');
        if (res.detectedHandle && (!handle || handle === 'everaldo-souza-6yb')) {
          setHandle(res.detectedHandle);
        }
      } else {
        showToast(res.message);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Erro ao validar conexão com a InfinitePay: ' + (err?.message || String(err))
      });
      showToast('Falha no teste de conexão.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: InfinitePayCredentials = {
      enabled,
      apiKey,
      handle,
      environment,
      enablePix,
      enableCreditCard,
      maxInstallments
    };

    const success = await infinitepayService.saveHotelCredentials(effectiveHotelId, payload, effectiveHotelName);
    await paymentGatewayService.setDefaultGateway(defaultGateway, effectiveHotelId, effectiveHotelName);

    if (success) {
      showToast('Configurações da InfinitePay salvas com sucesso!');
    } else {
      showToast('Erro ao salvar configurações.');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* TOAST DE FEEDBACK */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 text-white shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold bg-[#6cf8bb]/20 text-[#003400] border border-[#6cf8bb]/40">
              <span className="material-symbols-outlined text-2xl text-emerald-600">bolt</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                  InfinitePay: {effectiveHotelName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-emerald-100 text-emerald-800 border-emerald-200">
                  ⚡ PIX Taxa Zero
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-sky-100 text-sky-800 border-sky-200">
                  Recebimento Direto
                </span>
                {defaultGateway === 'infinitepay' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-emerald-600 text-white border-emerald-700 shadow-2xs flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">verified</span>
                    Checkout Padrão
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Integração oficial via Checkout Integrado para cobrança instantânea via Pix e Cartão com repasse 100% direto na conta do hotel.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-base ${isTesting ? 'animate-spin' : 'text-emerald-600'}`}>
              {isTesting ? 'sync' : 'network_check'}
            </span>
            <span>{isTesting ? 'Testando Conexão...' : 'Testar Conexão'}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#003400] hover:bg-[#002500] shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>Salvar Configurações</span>
          </button>
        </div>
      </div>

      {/* SELETOR DE CHECKOUT PADRÃO (INFINITEPAY VS MERCADO PAGO) */}
      <div className="bg-white rounded-2xl border-2 border-emerald-500/50 shadow-xs p-5 sm:p-6 space-y-4 bg-gradient-to-br from-emerald-50/40 via-white to-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="material-symbols-outlined text-emerald-600 text-xl">tune</span>
              <h2 className="text-base font-bold text-slate-900">Checkout Principal do Hotel (Gateway Padrão)</h2>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                defaultGateway === 'infinitepay'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-sky-100 text-sky-800 border-sky-300'
              }`}>
                {defaultGateway === 'infinitepay' ? '⚡ InfinitePay Selecionado como Padrão' : 'Mercado Pago Selecionado como Padrão'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Escolha qual checkout integrado será utilizado como padrão para gerar pagamentos via Pix e reservas online no seu hotel.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Card InfinitePay */}
          <div
            onClick={() => handleSetDefaultGateway('infinitepay')}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
              defaultGateway === 'infinitepay'
                ? 'border-emerald-600 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">bolt</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                      <span>InfinitePay</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Taxa 0% PIX
                      </span>
                    </h3>
                    <span className="text-[11px] font-semibold text-emerald-700">Taxa Zero no PIX</span>
                  </div>
                </div>
                {defaultGateway === 'infinitepay' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                    <span className="material-symbols-outlined text-xs">check</span>
                    Padrão Ativo
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">Clique p/ Ativar</span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pagamentos por Pix caem na hora na sua conta InfinitePay com <strong>0% de taxa de intermediação</strong>. Suporta parcelamento no cartão até 12x.
              </p>
            </div>
            <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-emerald-700 font-bold">Repasse: Imediato</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleSetDefaultGateway('infinitepay'); }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                  defaultGateway === 'infinitepay'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-slate-200 hover:bg-emerald-50 text-slate-700'
                }`}
              >
                {defaultGateway === 'infinitepay' ? '✓ Padrão Selecionado' : 'Definir como Padrão'}
              </button>
            </div>
          </div>

          {/* Card Mercado Pago */}
          <div
            onClick={() => handleSetDefaultGateway('mercadopago')}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
              defaultGateway === 'mercadopago'
                ? 'border-sky-600 bg-sky-50/50 shadow-sm ring-2 ring-sky-500/20'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">payments</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Mercado Pago</h3>
                    <span className="text-[11px] font-semibold text-sky-700">Gateway Tradicional</span>
                  </div>
                </div>
                {defaultGateway === 'mercadopago' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-sky-600 text-white shadow-2xs">
                    <span className="material-symbols-outlined text-xs">check</span>
                    Padrão Ativo
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">Clique p/ Ativar</span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Cobrança tradicional do Mercado Pago com Pix, Cartão de Crédito e saldo em conta Mercado Pago com as tarifas contratuais da instituição.
              </p>
            </div>
            <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-sky-700 font-bold">Repasse: Conforme plano MP</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleSetDefaultGateway('mercadopago'); }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                  defaultGateway === 'mercadopago'
                    ? 'bg-sky-600 text-white'
                    : 'bg-white border border-slate-200 hover:bg-sky-50 text-slate-700'
                }`}
              >
                {defaultGateway === 'mercadopago' ? '✓ Padrão Selecionado' : 'Definir como Padrão'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* BANNER INFORMATIVO TAXA ZERO INFINITEPAY */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border border-emerald-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#003400] text-white flex items-center justify-center shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-xl text-[#6cf8bb]">payments</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Checkout Integrado da InfinitePay (Pix Sem Taxas)
            </h3>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Com o Checkout Integrado da InfinitePay, os pagamentos por <strong>PIX caem na hora e possuem 0% de taxa</strong>. 
              O dinheiro é depositado integralmente na conta bancária InfinitePay do seu hotel. O Hotel no Zap <strong>não cobra nenhuma comissão</strong> nem retém valores das suas diárias.
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <a
            href="https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-integrado-da-infinitepay"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50 transition-colors shadow-2xs"
          >
            <span>Ver Guia Oficial</span>
            <span className="material-symbols-outlined text-sm">open_in_new</span>
          </a>
        </div>
      </div>

      {/* KPIS BENTO CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 shadow-xs flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 truncate block">Status da Integração</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{enabled ? 'Ativo & Operacional' : 'Pausado'}</span>
            </div>
            <span className="text-xs font-medium text-emerald-700 mt-0.5 block truncate">
              Chave API configurada
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-200/60 flex items-center justify-center text-emerald-900 shrink-0">
            <span className="material-symbols-outlined text-xl">verified</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-teal-50/80 border border-teal-200/80 shadow-xs flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-800 truncate block">Taxa do PIX</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">
              0% (Gratuito)
            </div>
            <span className="text-xs font-medium text-teal-700 mt-0.5 block truncate">
              Sem taxas sobre recebimentos Pix
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-200/60 flex items-center justify-center text-teal-900 shrink-0">
            <span className="material-symbols-outlined text-xl">percent</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/80 border border-blue-200/80 shadow-xs flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800 truncate block">Ambiente Ativo</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1 capitalize">
              {environment === 'production' ? 'Produção (Real)' : 'Testes'}
            </div>
            <span className="text-xs font-medium text-blue-700 mt-0.5 block truncate">
              Transações reais em dinheiro
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-200/60 flex items-center justify-center text-blue-900 shrink-0">
            <span className="material-symbols-outlined text-xl">lan</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 border border-amber-200/80 shadow-xs flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 truncate block">Comissão HotelNoZap</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">
              0% de Comissão
            </div>
            <span className="text-xs font-medium text-amber-700 mt-0.5 block truncate">
              100% da receita direto para o hotel
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-200/60 flex items-center justify-center text-amber-900 shrink-0">
            <span className="material-symbols-outlined text-xl">savings</span>
          </div>
        </div>
      </div>

      {/* RESULTADO DO TESTE DE CONEXÃO (SE ACIONADO) */}
      {testResult && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in duration-200 ${
          testResult.success 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <span className="material-symbols-outlined text-xl shrink-0 mt-0.5">
            {testResult.success ? 'check_circle' : 'error'}
          </span>
          <div className="flex-1 text-xs sm:text-sm">
            <p className="font-bold">{testResult.message}</p>
            {testResult.sampleUrl && (
              <p className="mt-1 font-mono text-xs text-slate-600 break-all">
                Link de teste gerado: <a href={testResult.sampleUrl} target="_blank" rel="noreferrer" className="underline font-bold text-emerald-700">{testResult.sampleUrl}</a>
              </p>
            )}
          </div>
        </div>
      )}

      {/* FORMULÁRIO DE CONFIGURAÇÃO */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">key</span>
              <span>Credenciais da API do Checkout Integrado</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              As credenciais são protegidas com criptografia e processadas apenas do lado do servidor (Serverless), sem exposição pública para visitantes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* API KEY */}
            <div className="md:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>API Key da InfinitePay (Prefixo inchk_...)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  🔒 Protegida no Servidor
                </span>
              </div>

              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="inchk_..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showApiKey ? 'Ocultar Chave' : 'Exibir Chave'}
                >
                  <span className="material-symbols-outlined text-lg">
                    {showApiKey ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                Gere no App InfinitePay: <strong>Vendas &gt; Checkout &gt; Configurações &gt; Habilitar Checkout Integrado &gt; Criar API Key</strong>.
              </p>
            </div>

            {/* INFINITE TAG / HANDLE */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                InfiniteTag / Handle do Estabelecimento
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">$</span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.replace(/^[$@]/, ''))}
                  placeholder="ex: seuhotel ou everaldo-souza-6yb"
                  className="w-full pl-7 pr-3.5 py-2.5 text-xs sm:text-sm font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Identificador da sua loja ou hotel na InfinitePay.
              </p>
            </div>

            {/* AMBIENTE */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Ambiente de Execução
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white font-medium"
              >
                <option value="production">🚀 Produção (Transações Reais com PIX)</option>
                <option value="sandbox">🧪 Sandbox / Ambiente de Testes</option>
              </select>
              <p className="text-[11px] text-slate-500">
                Mantenha em produção para receber pagamentos reais dos hóspedes.
              </p>
            </div>
          </div>
        </div>

        {/* FORMAS DE PAGAMENTO ACEITAS */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">credit_card</span>
              <span>Métodos de Pagamento no Checkout</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Escolha quais opções de pagamento estarão disponíveis no checkout gerado para o hóspede.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-lg">bolt</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">PIX Instantâneo (0% Taxa)</span>
                  <span className="text-[11px] text-slate-500">Compensação instantânea na conta InfinitePay</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enablePix}
                onChange={(e) => setEnablePix(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-lg">credit_card</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Cartão de Crédito (até 12x)</span>
                  <span className="text-[11px] text-slate-500">Parcelamento flexível para os hóspedes</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableCreditCard}
                onChange={(e) => setEnableCreditCard(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* WEBHOOK E BAIXA AUTOMÁTICA */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">sync_alt</span>
              <span>Webhook para Confirmação Automática de Pagamento</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              URL que a InfinitePay aciona no mesmo segundo em que o cliente paga via Pix, marcando a reserva como confirmada e registrando a entrada no caixa.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">URL do Webhook do HotelNoZap</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="flex-1 px-3.5 py-2.5 text-xs font-mono rounded-xl bg-slate-50 border border-slate-200 text-slate-700 select-all"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-base">content_copy</span>
                <span>Copiar</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              💡 A URL do webhook já é enviada automaticamente em cada requisição de criação de cobrança para a InfinitePay.
            </p>
          </div>
        </div>

        {/* BOTÃO SALVAR RODAPÉ */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              Voltar ao Início
            </button>
          )}

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#003400] hover:bg-[#002500] shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>Salvar Configurações da InfinitePay</span>
          </button>
        </div>
      </form>
    </div>
  );
};
export default ConfiguracoesInfinitePay;
