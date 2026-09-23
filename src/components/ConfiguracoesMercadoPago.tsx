import React, { useState } from 'react';

export interface ConfiguracoesMercadoPagoProps {
  onBackToDashboard?: () => void;
}

export const ConfiguracoesMercadoPago: React.FC<ConfiguracoesMercadoPagoProps> = ({ onBackToDashboard }) => {
  // Estado do Ambiente
  const [environment, setEnvironment] = useState<'production' | 'sandbox'>('production');

  // Estado das Credenciais
  const [publicKey, setPublicKey] = useState('APP_USR-78291048-2910-4819-b291-891028401928');
  const [accessToken, setAccessToken] = useState('APP_USR-9812401928409182-091219-4829104819284019-918240');
  const [clientId, setClientId] = useState('4829104819284019');
  const [clientSecret, setClientSecret] = useState('SecretKey_MP_2026_Master_Hotel');
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);

  // Métodos de Pagamento Habilitados
  const [enablePix, setEnablePix] = useState(true);
  const [enableCreditCard, setEnableCreditCard] = useState(true);
  const [enableBoleto, setEnableBoleto] = useState(false);
  const [maxInstallments, setMaxInstallments] = useState('12');

  // Webhook
  const webhookUrl = 'https://api.hotelnozap.com.br/webhooks/mercadopago';
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const handleTestWebhook = () => {
    setIsTestingWebhook(true);
    setTimeout(() => {
      setIsTestingWebhook(false);
      showToast('Conexão Webhook com Mercado Pago testada com sucesso! Status 200 OK');
    }, 1500);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Configurações do Mercado Pago salvas com sucesso!');
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

      {/* CABEÇALHO & NAVEGAÇÃO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-2xl">payments</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                  Mercado Pago
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
                  Integração Oficial
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Configure as chaves da API, recebimento via Pix Instantâneo e Cartão de Crédito do Mercado Pago.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-[#003400] hover:bg-[#002500] shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-lg">check_circle</span>
          <span>Salvar Configurações</span>
        </button>
      </div>

      {/* KPIS BENTO CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 shadow-xs flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 truncate block">Status da Integração</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Conectado</span>
            </div>
            <span className="text-xs font-medium text-emerald-700 mt-0.5 block truncate">API V2 Resposta em 42ms</span>
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
            <span className="text-xs font-medium text-blue-700 mt-0.5 block truncate">Chave APP_USR Válida</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-200/60 flex items-center justify-center text-blue-900 shrink-0">
            <span className="material-symbols-outlined text-xl">lan</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-purple-50/80 border border-purple-200/80 shadow-xs flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-800 truncate block">Notificação Webhook</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">100% OK</div>
            <span className="text-xs font-medium text-purple-700 mt-0.5 block truncate">Baixa automática de reservas</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-200/60 flex items-center justify-center text-purple-900 shrink-0">
            <span className="material-symbols-outlined text-xl">sync</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 border border-amber-200/80 shadow-xs flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 truncate block">Taxa Pix Aplicada</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">0,99%</div>
            <span className="text-xs font-medium text-amber-700 mt-0.5 block truncate">Recebimento instantâneo em conta</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-200/60 flex items-center justify-center text-amber-900 shrink-0">
            <span className="material-symbols-outlined text-xl">qr_code_2</span>
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
                <p className="text-xs text-slate-500 mt-1">Transações reais processadas na conta do Mercado Pago do hotel.</p>
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
              <p className="text-xs text-slate-500">Insira a Public Key e o Access Token obtidos no painel de desenvolvedores do Mercado Pago.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Public Key (Chave Pública) *
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  required
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="APP_USR-xxxx-xxxx" 
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm font-mono focus:outline-none focus:border-[#003400] bg-slate-50/30"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(publicKey, 'Public Key')}
                  className="absolute right-2 top-2 p-1 text-slate-400 hover:text-[#003400] cursor-pointer"
                  title="Copiar Public Key"
                >
                  <span className="material-symbols-outlined text-base">content_copy</span>
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Access Token (Token de Acesso Privado) *
              </label>
              <div className="relative">
                <input 
                  type={showAccessToken ? 'text' : 'password'}
                  required
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
                  <button
                    type="button"
                    onClick={() => copyToClipboard(accessToken, 'Access Token')}
                    className="p-1 text-slate-400 hover:text-[#003400] cursor-pointer"
                    title="Copiar Access Token"
                  >
                    <span className="material-symbols-outlined text-base">content_copy</span>
                  </button>
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
              <h2 className="text-base md:text-lg font-bold text-slate-900">3. Formas de Pagamento no Checkout</h2>
              <p className="text-xs text-slate-500">Selecione as opções ativas de recebimento para as reservas diretas do WhatsApp e do site.</p>
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
                <p className="text-xs text-slate-500">Gera QR Code e código Copia e Cola com baixa em tempo real.</p>
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
              <p className="text-xs text-slate-500">URL para onde o Mercado Pago envia o aviso instantâneo de pagamento da reserva.</p>
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
            <span>Salvar Configurações</span>
          </button>
        </div>

      </form>
    </div>
  );
};
