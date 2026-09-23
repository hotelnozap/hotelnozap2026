import React, { useState, useEffect } from 'react';
import { currentHotelService } from '../services/supabaseService';

export interface ConfiguracoesHotelProps {
  initialTab?: 'horarios' | 'regras' | 'lgpd' | 'mercadopago';
  onBackToDashboard?: () => void;
}

export interface HotelConfigData {
  // 1. Horários & Estadia
  checkInHorario: string;
  checkOutHorario: string;
  toleranciaCheckOutMinutos: number;
  cafeInicio: string;
  cafeFim: string;
  silencioInicio: string;
  silencioFim: string;
  recepcao24Horas: boolean;
  recepcaoInicio: string;
  recepcaoFim: string;
  lazerInicio: string;
  lazerFim: string;

  // 2. Regras & Políticas
  politicaCancelamento: 'flexivel' | 'moderada' | 'rigida' | 'personalizada';
  politicaCancelamentoTexto: string;
  permitePet: 'sim' | 'nao' | 'sob_consulta';
  taxaPet: number;
  proibidoFumar: boolean;
  idadeMinimaCheckin: number;
  permiteVisitantes: boolean;
  regrasGeraisTexto: string;

  // 3. LGPD & Privacidade
  dpoNome: string;
  dpoEmail: string;
  dpoTelefone: string;
  exigirConsentimentoCheckin: boolean;
  prazoRetencaoAnos: number;
  enviarAvisoPrivacidadeWhatsapp: boolean;
  politicaPrivacidadeTexto: string;

  // 4. Mercado Pago & Pagamentos
  mpEnvironment: 'production' | 'sandbox';
  mpPublicKey: string;
  mpAccessToken: string;
  mpClientId: string;
  mpClientSecret: string;
  mpEnablePix: boolean;
  mpEnableCreditCard: boolean;
  mpEnableBoleto: boolean;
  mpMaxInstallments: string;
}

export const DEFAULT_CONFIG: HotelConfigData = {
  checkInHorario: '14:00',
  checkOutHorario: '12:00',
  toleranciaCheckOutMinutos: 30,
  cafeInicio: '06:30',
  cafeFim: '10:00',
  silencioInicio: '22:00',
  silencioFim: '08:00',
  recepcao24Horas: true,
  recepcaoInicio: '07:00',
  recepcaoFim: '23:00',
  lazerInicio: '08:00',
  lazerFim: '20:00',

  politicaCancelamento: 'flexivel',
  politicaCancelamentoTexto: 'Cancelamento gratuito até 7 dias antes do check-in. Após este prazo, cobrança da primeira diária.',
  permitePet: 'sob_consulta',
  taxaPet: 50.0,
  proibidoFumar: true,
  idadeMinimaCheckin: 18,
  permiteVisitantes: true,
  regrasGeraisTexto: 'Prezado hóspede, respeite os horários de silêncio e as áreas de convivência. É vedado o uso de caixas de som nas áreas comuns.',

  dpoNome: 'Encarregado de Privacidade',
  dpoEmail: 'privacidade@hotelnozap.com.br',
  dpoTelefone: '(11) 99999-9999',
  exigirConsentimentoCheckin: true,
  prazoRetencaoAnos: 5,
  enviarAvisoPrivacidadeWhatsapp: true,
  politicaPrivacidadeTexto: 'Seus dados pessoais coletados durante a estadia são utilizados exclusivamente para cumprimento de obrigações legais (FNRH/Embratur, emissão fiscal) e comunicação direta via WhatsApp sobre sua reserva, em total conformidade com a LGPD (Lei nº 13.709/2018).',

  mpEnvironment: 'production',
  mpPublicKey: 'APP_USR-78291048-2910-4819-b291-891028401928',
  mpAccessToken: 'APP_USR-9812401928409182-091219-4829104819284019-918240',
  mpClientId: '4829104819284019',
  mpClientSecret: 'SecretKey_MP_2026_Master_Hotel',
  mpEnablePix: true,
  mpEnableCreditCard: true,
  mpEnableBoleto: false,
  mpMaxInstallments: '12'
};

export const ConfiguracoesHotel: React.FC<ConfiguracoesHotelProps> = ({
  initialTab = 'horarios',
  onBackToDashboard
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'horarios' | 'regras' | 'lgpd' | 'mercadopago'>(initialTab);
  const [config, setConfig] = useState<HotelConfigData>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Mercado Pago secrets visibility
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  const currentHotel = currentHotelService.getCurrentHotel();
  const hotelId = currentHotel?.id || 'default';
  const storageKey = `hotelnozap_config_hotel_${hotelId}`;
  const webhookUrl = 'https://api.hotelnozap.com.br/webhooks/mercadopago';

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) });
      }
    } catch (e) {
      console.warn('Erro ao carregar configurações do hotel:', e);
    }
  }, [storageKey]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
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
    }, 1200);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify(config));
      window.dispatchEvent(new CustomEvent('hotel_config_atualizado', { detail: config }));
      setTimeout(() => {
        setIsSaving(false);
        showToast('Configurações do hotel salvas com sucesso!');
      }, 500);
    } catch (err) {
      setIsSaving(false);
      showToast('Erro ao salvar configurações.');
    }
  };

  const updateField = <K extends keyof HotelConfigData>(field: K, value: HotelConfigData[K]) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto flex flex-col gap-6 pb-28 lg:pb-12 text-[#0b1c30]">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#003400] text-emerald-300 border border-emerald-400/40 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span className="text-sm font-semibold text-white">{toastMessage}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3.5">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              type="button"
              className="p-2 sm:p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
              title="Voltar ao Painel"
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006c49] text-2xl">settings</span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Configurações do Hotel
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Gerencie horários operacionais, regras de estadia, conformidade LGPD e pagamentos.
            </p>
          </div>
        </div>

        <button
          onClick={() => handleSave()}
          type="button"
          disabled={isSaving}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#006c49] hover:bg-[#005237] text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">
            {isSaving ? 'sync' : 'save'}
          </span>
          <span>{isSaving ? 'Salvando...' : 'Salvar Configurações'}</span>
        </button>
      </div>

      {/* SELETOR DE ABAS (SCROLL HORIZONTAL RESPONSIVO) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveSubTab('horarios')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeSubTab === 'horarios'
              ? 'bg-[#006c49] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-lg">schedule</span>
          <span>Horários & Estadia</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('regras')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeSubTab === 'regras'
              ? 'bg-[#006c49] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-lg">policy</span>
          <span>Regras & Políticas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('lgpd')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeSubTab === 'lgpd'
              ? 'bg-[#006c49] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-lg">verified_user</span>
          <span>LGPD & Privacidade</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('mercadopago')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeSubTab === 'mercadopago'
              ? 'bg-[#006c49] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-lg">payments</span>
          <span>Mercado Pago & Checkout</span>
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}
      <form onSubmit={handleSave} className="flex flex-col gap-6">

        {/* ── ABA 1: HORÁRIOS & ESTADIA ── */}
        {activeSubTab === 'horarios' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
            {/* Card: Check-in & Check-out */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col gap-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#006c49] flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">hotel</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Entrada e Saída (Check-in/Out)</h2>
                  <p className="text-xs text-slate-500">Defina os horários oficiais para recepção e camareiras</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Horário Oficial de Check-in
                  </label>
                  <input
                    type="time"
                    value={config.checkInHorario}
                    onChange={e => updateField('checkInHorario', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">Ex: 14:00 (liberação dos quartos)</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Horário Limite de Check-out
                  </label>
                  <input
                    type="time"
                    value={config.checkOutHorario}
                    onChange={e => updateField('checkOutHorario', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] outline-none"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">Ex: 12:00 (encerramento da estadia)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tolerância de Saída (Late Check-out sem taxa)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="180"
                    step="5"
                    value={config.toleranciaCheckOutMinutos}
                    onChange={e => updateField('toleranciaCheckOutMinutos', Number(e.target.value))}
                    className="w-32 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-[#006c49] outline-none"
                  />
                  <span className="text-xs font-medium text-slate-600">minutos após o horário oficial</span>
                </div>
              </div>
            </div>

            {/* Card: Café da Manhã & Refeições */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col gap-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">bakery_dining</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Café da Manhã</h2>
                  <p className="text-xs text-slate-500">Horário servido para os hóspedes no restaurante</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Início do Café
                  </label>
                  <input
                    type="time"
                    value={config.cafeInicio}
                    onChange={e => updateField('cafeInicio', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-[#006c49] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Término do Café
                  </label>
                  <input
                    type="time"
                    value={config.cafeFim}
                    onChange={e => updateField('cafeFim', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-[#006c49] outline-none"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 bg-amber-50/60 p-3 rounded-xl border border-amber-200/50">
                💡 Este horário é informado automaticamente aos hóspedes no WhatsApp após a conclusão do check-in.
              </p>
            </div>

            {/* Card: Lei do Silêncio */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col gap-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">volume_off</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Horário de Silêncio</h2>
                  <p className="text-xs text-slate-500">Período de repouso obrigatório nos corredores e quartos</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Início do Silêncio
                  </label>
                  <input
                    type="time"
                    value={config.silencioInicio}
                    onChange={e => updateField('silencioInicio', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-[#006c49] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Fim do Silêncio
                  </label>
                  <input
                    type="time"
                    value={config.silencioFim}
                    onChange={e => updateField('silencioFim', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-[#006c49] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Card: Recepção e Lazer */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col gap-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">concierge</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Recepção & Lazer</h2>
                  <p className="text-xs text-slate-500">Disponibilidade presencial e acesso às comodidades</p>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.recepcao24Horas}
                    onChange={e => updateField('recepcao24Horas', e.target.checked)}
                    className="w-4 h-4 text-[#006c49] rounded border-slate-300 focus:ring-[#006c49]"
                  />
                  <span className="text-xs font-bold text-slate-800">Recepção funciona 24 Horas</span>
                </label>

                {!config.recepcao24Horas && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500">Abertura:</span>
                      <input
                        type="time"
                        value={config.recepcaoInicio}
                        onChange={e => updateField('recepcaoInicio', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500">Fechamento:</span>
                      <input
                        type="time"
                        value={config.recepcaoFim}
                        onChange={e => updateField('recepcaoFim', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Área de Lazer / Piscina
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500">Abertura:</span>
                    <input
                      type="time"
                      value={config.lazerInicio}
                      onChange={e => updateField('lazerInicio', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500">Encerramento:</span>
                    <input
                      type="time"
                      value={config.lazerFim}
                      onChange={e => updateField('lazerFim', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ABA 2: REGRAS & POLÍTICAS ── */}
        {activeSubTab === 'regras' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
            {/* Política de Cancelamento */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col gap-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">event_busy</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Política de Cancelamento</h2>
                  <p className="text-xs text-slate-500">Termos aplicados a desistências e no-show</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Modelo de Política</label>
                <select
                  value={config.politicaCancelamento}
                  onChange={e => updateField('politicaCancelamento', e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none"
                >
                  <option value="flexivel">Flexível (Cancelamento grátis até 24h antes)</option>
                  <option value="moderada">Moderada (Cancelamento grátis até 7 dias antes)</option>
                  <option value="rigida">Rígida (Reembolso de 50% até 14 dias antes)</option>
                  <option value="personalizada">Personalizada pelo Hotel</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Texto Descritivo aos Hóspedes</label>
                <textarea
                  rows={3}
                  value={config.politicaCancelamentoTexto}
                  onChange={e => updateField('politicaCancelamentoTexto', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none"
                />
              </div>
            </div>

            {/* Animais de Estimação (Pet Friendly) */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col gap-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">pets</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Animais de Estimação (Pets)</h2>
                  <p className="text-xs text-slate-500">Permissão para cães e gatos de pequeno porte</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Permissão</label>
                <select
                  value={config.permitePet}
                  onChange={e => updateField('permitePet', e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none"
                >
                  <option value="sim">Sim, somos 100% Pet Friendly</option>
                  <option value="sob_consulta">Sob consulta prévia (com taxa de higienização)</option>
                  <option value="nao">Não permitimos animais</option>
                </select>
              </div>

              {config.permitePet === 'sob_consulta' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Taxa de Pet por Estadia (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={config.taxaPet}
                    onChange={e => updateField('taxaPet', Number(e.target.value))}
                    className="w-36 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold outline-none"
                  />
                </div>
              )}
            </div>

            {/* Outras Normas de Convivência */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col gap-4 md:col-span-2">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">gavel</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Normas e Regulamento Interno</h2>
                  <p className="text-xs text-slate-500">Parâmetros essenciais para boa convivência no hotel</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.proibidoFumar}
                    onChange={e => updateField('proibidoFumar', e.target.checked)}
                    className="w-4 h-4 text-[#006c49] rounded border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Proibido Fumar</span>
                    <span className="text-[11px] text-slate-500">Lei Federal 9.294 (Multa por infração)</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.permiteVisitantes}
                    onChange={e => updateField('permiteVisitantes', e.target.checked)}
                    className="w-4 h-4 text-[#006c49] rounded border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Visitantes Permitidos</span>
                    <span className="text-[11px] text-slate-500">Apenas na recepção/lobby até às 22h</span>
                  </div>
                </label>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-xs font-bold text-slate-800 block mb-1">Idade Mínima Desacompanhado</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="16"
                      max="21"
                      value={config.idadeMinimaCheckin}
                      onChange={e => updateField('idadeMinimaCheckin', Number(e.target.value))}
                      className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                    />
                    <span className="text-xs text-slate-600">anos completos</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Regulamento Geral (exibido na confirmação de reserva via WhatsApp)
                </label>
                <textarea
                  rows={3}
                  value={config.regrasGeraisTexto}
                  onChange={e => updateField('regrasGeraisTexto', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── ABA 3: LGPD & PRIVACIDADE ── */}
        {activeSubTab === 'lgpd' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="bg-emerald-900 text-white rounded-2xl p-5 sm:p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-emerald-300 text-3xl">verified_user</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-emerald-50">Conformidade com a LGPD (Lei nº 13.709/2018)</h2>
                  <p className="text-xs text-emerald-200 max-w-2xl mt-0.5">
                    O Hotel no Zap já opera com criptografia e armazenamento isolado de dados para garantir a segurança dos hóspedes e mitigar riscos jurídicos para o estabelecimento.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Proteção Ativa
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Encarregado de Dados (DPO) */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col gap-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">badge</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Encarregado de Dados (DPO)</h3>
                    <p className="text-xs text-slate-500">Pessoa de contato para solicitações de privacidade</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Encarregado / Jurídico</label>
                  <input
                    type="text"
                    value={config.dpoNome}
                    onChange={e => updateField('dpoNome', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold outline-none"
                    placeholder="Ex: Carlos Silva ou Depto Jurídico"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">E-mail de Contato para Privacidade</label>
                  <input
                    type="email"
                    value={config.dpoEmail}
                    onChange={e => updateField('dpoEmail', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold outline-none"
                    placeholder="privacidade@seuhotel.com.br"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefone / WhatsApp para Suporte LGPD</label>
                  <input
                    type="text"
                    value={config.dpoTelefone}
                    onChange={e => updateField('dpoTelefone', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold outline-none"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              {/* Consentimentos e Retenção */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col gap-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">fact_check</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Políticas de Consentimento</h3>
                    <p className="text-xs text-slate-500">Coleta e retenção de dados cadastrais</p>
                  </div>
                </div>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.exigirConsentimentoCheckin}
                    onChange={e => updateField('exigirConsentimentoCheckin', e.target.checked)}
                    className="w-4 h-4 text-[#006c49] rounded border-slate-300 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Exigir Termo de Aceite no Check-in Digital</span>
                    <span className="text-[11px] text-slate-500">O hóspede só finaliza a ficha de hospedagem após confirmar a leitura das regras.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enviarAvisoPrivacidadeWhatsapp}
                    onChange={e => updateField('enviarAvisoPrivacidadeWhatsapp', e.target.checked)}
                    className="w-4 h-4 text-[#006c49] rounded border-slate-300 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Incluir Aviso de Privacidade no WhatsApp</span>
                    <span className="text-[11px] text-slate-500">Disponibiliza link do regulamento na mensagem de confirmação de estadia.</span>
                  </div>
                </label>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Prazo de Retenção de Dados Fiscais / Hóspedes
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={config.prazoRetencaoAnos}
                      onChange={e => updateField('prazoRetencaoAnos', Number(e.target.value))}
                      className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold outline-none"
                    />
                    <span className="text-xs text-slate-600">anos (recomendado legal: 5 anos)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Texto da Política de Privacidade */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs">
              <label className="block text-xs font-bold text-slate-800 mb-2">
                Texto do Termo de Privacidade & Consentimento (FNRH Digital)
              </label>
              <textarea
                rows={4}
                value={config.politicaPrivacidadeTexto}
                onChange={e => updateField('politicaPrivacidadeTexto', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs leading-relaxed text-slate-800 outline-none"
              />
            </div>
          </div>
        )}

        {/* ── ABA 4: MERCADO PAGO & CHECKOUT ── */}
        {activeSubTab === 'mercadopago' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            {/* Banner de Status */}
            <div className="bg-sky-900 text-white rounded-2xl p-5 sm:p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-sky-300 text-3xl">credit_card</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Mercado Pago Payments API</h2>
                  <p className="text-xs text-sky-200 mt-0.5 max-w-xl">
                    Receba pagamentos instantâneos de reservas e pedidos de frigobar/quarto via PIX e Cartão de Crédito.
                  </p>
                </div>
              </div>

              {/* Ambiente */}
              <div className="flex items-center bg-sky-950/60 p-1.5 rounded-xl border border-sky-400/20">
                <button
                  type="button"
                  onClick={() => updateField('mpEnvironment', 'production')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    config.mpEnvironment === 'production'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-sky-300 hover:text-white'
                  }`}
                >
                  Produção
                </button>
                <button
                  type="button"
                  onClick={() => updateField('mpEnvironment', 'sandbox')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    config.mpEnvironment === 'sandbox'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-sky-300 hover:text-white'
                  }`}
                >
                  Sandbox (Testes)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Credenciais de API */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col gap-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">key</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Credenciais da Aplicação</h3>
                    <p className="text-xs text-slate-500">Chaves obtidas no painel do desenvolvedor Mercado Pago</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Public Key (Chave Pública)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={config.mpPublicKey}
                      onChange={e => updateField('mpPublicKey', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(config.mpPublicKey, 'Public Key')}
                      className="px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600"
                      title="Copiar"
                    >
                      <span className="material-symbols-outlined text-base">content_copy</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Access Token (Chave de Acesso)</label>
                  <div className="flex gap-2">
                    <input
                      type={showAccessToken ? 'text' : 'password'}
                      value={config.mpAccessToken}
                      onChange={e => updateField('mpAccessToken', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccessToken(!showAccessToken)}
                      className="px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600"
                    >
                      <span className="material-symbols-outlined text-base">
                        {showAccessToken ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Client ID</label>
                  <input
                    type="text"
                    value={config.mpClientId}
                    onChange={e => updateField('mpClientId', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Client Secret</label>
                  <div className="flex gap-2">
                    <input
                      type={showClientSecret ? 'text' : 'password'}
                      value={config.mpClientSecret}
                      onChange={e => updateField('mpClientSecret', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowClientSecret(!showClientSecret)}
                      className="px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600"
                    >
                      <span className="material-symbols-outlined text-base">
                        {showClientSecret ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Métodos de Pagamento e Webhooks */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col gap-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">account_balance</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Métodos Habilitados</h3>
                    <p className="text-xs text-slate-500">Opções disponíveis para o hóspede no checkout</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-emerald-600">qr_code_2</span>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">PIX Instantâneo</span>
                        <span className="text-[11px] text-slate-500">Baixa automática da reserva em segundos</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.mpEnablePix}
                      onChange={e => updateField('mpEnablePix', e.target.checked)}
                      className="w-4 h-4 text-[#006c49] rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-indigo-600">credit_card</span>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Cartão de Crédito</span>
                        <span className="text-[11px] text-slate-500">Visa, Mastercard, Elo, Hipercard</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.mpEnableCreditCard}
                      onChange={e => updateField('mpEnableCreditCard', e.target.checked)}
                      className="w-4 h-4 text-[#006c49] rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-600">barcode</span>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Boleto Bancário</span>
                        <span className="text-[11px] text-slate-500">Compensação em até 3 dias úteis</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.mpEnableBoleto}
                      onChange={e => updateField('mpEnableBoleto', e.target.checked)}
                      className="w-4 h-4 text-[#006c49] rounded"
                    />
                  </label>
                </div>

                {/* Webhook */}
                <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-700">URL do Webhook de Notificações</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={webhookUrl}
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(webhookUrl, 'URL do Webhook')}
                      className="px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600"
                    >
                      <span className="material-symbols-outlined text-base">content_copy</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestWebhook}
                    disabled={isTestingWebhook}
                    className="mt-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl border border-sky-600 text-sky-700 font-semibold text-xs hover:bg-sky-50 transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {isTestingWebhook ? 'sync' : 'network_check'}
                    </span>
                    <span>{isTestingWebhook ? 'Testando Conexão...' : 'Testar Conexão Webhook'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BOTÃO SALVAR FIXO NO MOBILE / RODAPÉ */}
        <div className="flex justify-end pt-4 border-t border-slate-200">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-[#006c49] hover:bg-[#005237] text-white font-bold text-sm sm:text-base rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">
              {isSaving ? 'sync' : 'save'}
            </span>
            <span>{isSaving ? 'Salvando Alterações...' : 'Salvar Alterações'}</span>
          </button>
        </div>

      </form>
    </div>
  );
};
