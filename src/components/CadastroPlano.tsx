import React, { useState, useEffect, useMemo } from 'react';
import { Plano } from './ListagemPlanos';
import { planosService } from '../services/supabaseService';

interface CadastroPlanoProps {
  planToEdit?: Plano | null;
  onBack: () => void;
  onSaveSuccess: () => void;
}

export const CadastroPlano: React.FC<CadastroPlanoProps> = ({
  planToEdit,
  onBack,
  onSaveSuccess
}) => {
  // Form state
  const [name, setName] = useState(planToEdit?.name || '');
  const [tag, setTag] = useState(planToEdit?.tag || '');
  const [order, setOrder] = useState<number>(() => {
    if (planToEdit?.order) {
      const num = parseInt(planToEdit.order.replace(/\D/g, ''), 10);
      return isNaN(num) ? 1 : num;
    }
    return 1;
  });
  const [description, setDescription] = useState(planToEdit?.description || '');
  const [status, setStatus] = useState<'Ativo' | 'Inativo'>(planToEdit?.status || 'Ativo');
  const [isFeatured, setIsFeatured] = useState<boolean>(planToEdit?.isFeatured || false);

  // Precificação
  const [billingCycle, setBillingCycle] = useState<'mensal' | 'trimestral' | 'semestral' | 'anual'>(() => {
    const p = (planToEdit?.periodicity || '').toLowerCase();
    if (p.includes('anual')) return 'anual';
    if (p.includes('trimestral')) return 'trimestral';
    if (p.includes('semestral')) return 'semestral';
    return 'mensal';
  });
  const [basePrice, setBasePrice] = useState<string>(
    planToEdit?.basePrice ? planToEdit.basePrice.toFixed(2).replace('.', ',') : '389,00'
  );
  const [cycleDiscount, setCycleDiscount] = useState<string>('15% OFF');
  const [trialDays, setTrialDays] = useState<number>(7);

  // Quartos
  const [baseRooms, setBaseRooms] = useState<number>(planToEdit?.roomLimit || 45);
  const [allowExtraRooms, setAllowExtraRooms] = useState<boolean>(true);
  const [extraRoomPrice, setExtraRoomPrice] = useState<string>('3,50');

  // WhatsApp
  const [baseWhatsapp, setBaseWhatsapp] = useState<number>(planToEdit?.whatsappConnections || 2);
  const [allowExtraWa, setAllowExtraWa] = useState<boolean>(true);
  const [extraWaPrice, setExtraWaPrice] = useState<string>('49,90');

  // Observações internas
  const [internalNotes, setInternalNotes] = useState<string>(
    'Plano prioritário para prospecções de médio porte (hotéis independentes e resorts de até 80 acomodações). Apto a concessão de até 10% adicional com aval do Head Comercial.'
  );

  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (planToEdit) {
      setName(planToEdit.name || '');
      setTag(planToEdit.tag || '');
      setDescription(planToEdit.description || '');
      setStatus(planToEdit.status || 'Ativo');
      setIsFeatured(planToEdit.isFeatured || false);
      setBasePrice(planToEdit.basePrice ? planToEdit.basePrice.toFixed(2).replace('.', ',') : '389,00');
      setBaseRooms(planToEdit.roomLimit || 45);
      setBaseWhatsapp(planToEdit.whatsappConnections || 2);
    }
  }, [planToEdit]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Cálculo da simulação de repasse líquido (2.89% de taxa de cartão estimada)
  const numericPrice = useMemo(() => {
    const cleaned = basePrice.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
  }, [basePrice]);

  const netSimulatedPrice = useMemo(() => {
    const net = numericPrice * (1 - 0.0289);
    return net.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [numericPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor, informe o nome oficial do plano.');
      return;
    }

    setIsSaving(true);

    try {
      const savedRaw = localStorage.getItem('hotelnozap_planos_assinatura_v1');
      let currentList: Plano[] = savedRaw ? JSON.parse(savedRaw) : [];

      const periodicityFormatted: 'Mensal' | 'Trimestral' | 'Anual' =
        billingCycle === 'anual' ? 'Anual' : billingCycle === 'trimestral' ? 'Trimestral' : 'Mensal';

      const pricePeriodText =
        periodicityFormatted === 'Anual' ? '/ano' : periodicityFormatted === 'Trimestral' ? '/trimestre' : '/mês';

      const planData: Plano = {
        id: planToEdit?.id || `plano-${Date.now()}`,
        order: `#0${order}`,
        emoji: planToEdit?.emoji || (name.toLowerCase().includes('free') ? '🎁' : isFeatured ? '🥈' : order === 1 ? '🥇' : '💎'),
        name: name.trim(),
        tag: tag.trim() || undefined,
        description: description.trim() || 'Plano customizado',
        periodicity: periodicityFormatted,
        basePrice: typeof numericPrice === 'number' && !isNaN(numericPrice) ? numericPrice : 0,
        pricePeriodText,
        priceSubtitle:
          numericPrice === 0 || name.toLowerCase().includes('free')
            ? Number(trialDays) === 0
              ? 'Plano gratuito limitado contínuo até upgrade'
              : `Período gratuito de ${trialDays} dias de teste`
            : periodicityFormatted === 'Anual'
            ? `Equiv. R$ ${(numericPrice / 12).toFixed(2).replace('.', ',')}/mês • Em até 12x`
            : isFeatured
            ? 'Mais recomendado para alta taxa de ocupação'
            : 'Cobrança mensal recorrente via PIX ou Cartão',
        roomLimit: baseRooms,
        roomLimitText: `Capacidade para até ${baseRooms} quartos`,
        roomExtraPriceText: allowExtraRooms ? `R$ ${extraRoomPrice}/adicional` : 'Sem quartos adicionais',
        whatsappConnections: baseWhatsapp,
        whatsappConnectionsText: `${baseWhatsapp} Conexão${baseWhatsapp > 1 ? 'ões' : ''} WhatsApp simultâneas`,
        whatsappExtraPriceText: allowExtraWa ? `R$ ${extraWaPrice}/adicional` : 'Inclusas no pacote',
        hotelsSubscribersCount: planToEdit?.hotelsSubscribersCount || 0,
        status,
        isFeatured,
        features: [
          `Capacidade para até ${baseRooms} quartos`,
          `${baseWhatsapp} Conexão${baseWhatsapp > 1 ? 'ões' : ''} WhatsApp simultâneas`,
          allowExtraRooms ? `Quartos excedentes: + R$ ${extraRoomPrice} /quarto` : 'Sem quartos excedentes',
          allowExtraWa ? `Instância extra: + R$ ${extraWaPrice} /conexão` : 'Instâncias extras inclusas',
          'Módulo de atendimento & reservas em tempo real'
        ]
      };

      // 1. Salvar no Supabase
      if (planToEdit?.id) {
        await planosService.updatePlano(planToEdit.id, {
          ...planData,
          trialDays: Number(trialDays) || 0,
          cycleDiscount,
          allowExtraRooms,
          extraRoomPrice,
          allowExtraWa,
          extraWaPrice,
          internalNotes
        });
      } else {
        const created = await planosService.createPlano({
          ...planData,
          trialDays: Number(trialDays) || 0,
          cycleDiscount,
          allowExtraRooms,
          extraRoomPrice,
          allowExtraWa,
          extraWaPrice,
          internalNotes
        });
        if (created && created.id) {
          planData.id = created.id;
        }
      }

      // 2. Sincronizar no LocalStorage como cache imediato
      if (planToEdit) {
        currentList = currentList.map(p => (p.id === planToEdit.id ? planData : p));
      } else {
        currentList = [planData, ...currentList];
      }
      localStorage.setItem('hotelnozap_planos_assinatura_v1', JSON.stringify(currentList));

      showToast(`Plano "${name}" salvo com sucesso!`);
      setTimeout(() => {
        setIsSaving(false);
        onSaveSuccess();
      }, 500);
    } catch (err) {
      console.error('Erro ao salvar plano:', err);
      setIsSaving(false);
      showToast('Erro ao salvar plano no sistema.');
    }
  };

  return (
    <div className="bg-[#f8f9ff] min-h-screen text-[#0b1c30] font-sans antialiased">
      
      {/* TOAST FLUTUANTE */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[100] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom duration-200">
          <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FORMULÁRIO MOBILE (Telas menores que lg)
          1:1 fiel à imagem e layout do mobile 390px
      ───────────────────────────────────────────────────────────── */}
      <div className="block lg:hidden w-full max-w-[390px] mx-auto pb-28 text-slate-800">
        
        {/* Top Bar Mobile Oficial: Degradê Verde Escuro ao Preto */}
        <header className="w-full h-16 bg-gradient-to-b from-[#003400] to-black px-4 flex items-center justify-between shadow-md select-none text-white">
          <button 
            type="button"
            onClick={onBack}
            aria-label="Voltar" 
            className="w-10 h-10 flex items-center justify-center text-white active:scale-95 transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <div className="flex flex-col items-center justify-center">
            <span className="text-sm font-black tracking-wider uppercase">
              HOTEL NO ZAP
            </span>
            <span className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase scale-90">
              ADMIN CONSOLE
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-[#006c49] text-white flex items-center justify-center text-xs font-bold shadow-xs ring-1 ring-white/20">
              HZ
            </div>
          </div>
        </header>

        {/* Context Navigation */}
        <div className="px-4 pt-3 pb-1 flex flex-col">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[#006c49] hover:text-[#003400] text-xs font-semibold transition-colors py-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Voltar para Listagem de Planos</span>
          </button>
          
          <div className="mt-2 mb-1">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {planToEdit ? 'Editar Plano de Assinatura' : 'Novo Plano de Assinatura'}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                {status === 'Ativo' ? 'Ativo' : 'Rascunho'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure regras tarifárias, limites estruturais e provisionamento automatizado do WhatsApp.
            </p>
          </div>
        </div>

        {/* Formulário Vertical Fluid Stack Mobile */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 mt-2">
          
          {/* Bloco 1: Identificação & Status */}
          <section className="bg-white rounded-xl p-4 shadow-xs border border-slate-200/80 flex flex-col gap-3.5">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <span className="material-symbols-outlined text-[#006c49] text-[20px]">badge</span>
              <h2 className="text-sm font-bold text-slate-900">1. Identificação & Status</h2>
            </div>

            {/* Switches de Visibilidade e Destaque */}
            <div className="grid grid-cols-1 gap-2.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-bold text-slate-900">Plano Ativo</span>
                  <span className="text-[11px] text-slate-500">Visível para contratação no portal</span>
                </div>
                <div className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={status === 'Ativo'}
                    onChange={(e) => setStatus(e.target.checked ? 'Ativo' : 'Inativo')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003400]"></div>
                </div>
              </label>

              <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-200">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-bold text-slate-900">Destaque Comercial</span>
                  <span className="text-[11px] text-slate-500">Tag 'Mais Escolhido' e moldura verde</span>
                </div>
                <div className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006c49]"></div>
                </div>
              </label>
            </div>

            {/* Campos de Texto */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-800" htmlFor="mob-plan-name">
                Nome do Plano <span className="text-red-600">*</span>
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[20px]">hotel</span>
                <input
                  id="mob-plan-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Plano Professional"
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-slate-50 text-slate-900 text-xs border border-slate-200 focus:border-[#003400] focus:ring-1 focus:ring-[#003400] outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-800" htmlFor="mob-plan-tag">
                  Tag / Badge
                </label>
                <input
                  id="mob-plan-tag"
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Ex: Mais Vendido"
                  className="w-full h-11 px-3 rounded-lg bg-slate-50 text-slate-900 text-xs border border-slate-200 focus:border-[#003400] focus:ring-1 focus:ring-[#003400] outline-none transition-all"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-800" htmlFor="mob-plan-order">
                  Ordem de Exibição
                </label>
                <input
                  id="mob-plan-order"
                  type="number"
                  min={1}
                  value={order}
                  onChange={(e) => setOrder(parseInt(e.target.value, 10) || 1)}
                  className="w-full h-11 px-3 rounded-lg bg-slate-50 text-slate-900 text-xs border border-slate-200 focus:border-[#003400] focus:ring-1 focus:ring-[#003400] outline-none transition-all text-center font-bold"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-800" htmlFor="mob-plan-desc">
                Descrição do Plano
              </label>
              <textarea
                id="mob-plan-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva brevemente o público ideal deste plano..."
                className="w-full p-3 rounded-lg bg-slate-50 text-slate-900 text-xs border border-slate-200 focus:border-[#003400] focus:ring-1 focus:ring-[#003400] outline-none transition-all resize-none"
              />
            </div>
          </section>

          {/* Bloco 2: Precificação & Ciclo */}
          <section className="bg-white rounded-xl p-4 shadow-xs border border-slate-200/80 flex flex-col gap-3.5">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <span className="material-symbols-outlined text-[#006c49] text-[20px]">payments</span>
              <h2 className="text-sm font-bold text-slate-900">2. Precificação & Ciclo</h2>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-800" htmlFor="mob-plan-freq">
                Periodicidade de Faturamento <span className="text-red-600">*</span>
              </label>
              <div className="relative flex items-center">
                <select
                  id="mob-plan-freq"
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value as any)}
                  className="w-full h-11 pl-3 pr-10 rounded-lg bg-slate-50 text-slate-900 text-xs border border-slate-200 focus:border-[#003400] focus:ring-1 focus:ring-[#003400] outline-none appearance-none cursor-pointer"
                >
                  <option value="mensal">Mensal (Cobrança a cada 30 dias)</option>
                  <option value="trimestral">Trimestral (Cobrança a cada 90 dias)</option>
                  <option value="semestral">Semestral (Cobrança a cada 180 dias)</option>
                  <option value="anual">Anual (Faturamento consolidado)</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 pointer-events-none text-slate-400 text-[20px]">expand_more</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-800" htmlFor="mob-plan-price">
                  Valor Base (R$) <span className="text-red-600">*</span>
                </label>
                <input
                  id="mob-plan-price"
                  type="text"
                  required
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder="R$ 389,00"
                  className="w-full h-11 px-3 rounded-lg bg-slate-50 text-slate-900 text-xs font-bold border border-slate-200 focus:border-[#003400] focus:ring-1 focus:ring-[#003400] outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-800" htmlFor="mob-plan-discount">
                  Desconto (%)
                </label>
                <input
                  id="mob-plan-discount"
                  type="text"
                  value={cycleDiscount}
                  onChange={(e) => setCycleDiscount(e.target.value)}
                  placeholder="Ex: 15%"
                  className="w-full h-11 px-3 rounded-lg bg-slate-50 text-slate-900 text-xs border border-slate-200 focus:border-[#003400] focus:ring-1 focus:ring-[#003400] outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-800" htmlFor="mob-plan-trial">
                  Dias de Teste Grátis (Trial)
                </label>
                <span className="text-[11px] text-[#006c49] font-bold">Sem cartão obrigatório</span>
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[20px]">event_available</span>
                <input
                  id="mob-plan-trial"
                  type="number"
                  min={0}
                  value={trialDays}
                  onChange={(e) => setTrialDays(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-slate-50 text-slate-900 text-xs border border-slate-200 focus:border-[#003400] focus:ring-1 focus:ring-[#003400] outline-none transition-all"
                />
              </div>
              {trialDays === 0 ? (
                <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1 flex items-start gap-1.5 leading-snug">
                  <span className="material-symbols-outlined text-sm text-amber-600 shrink-0 mt-0.5">info</span>
                  <span><strong>Modo Free Limitado:</strong> Ao definir 0 dias, o plano funcionará de forma limitada contínua até o cliente assinar outro plano.</span>
                </p>
              ) : (
                <span className="text-[10px] text-slate-500 mt-0.5">Período de teste sem custos antes da primeira cobrança.</span>
              )}
            </div>
          </section>

          {/* Bloco 3: Limite de Quartos */}
          <section className="bg-white rounded-xl p-4 shadow-xs border border-slate-200/80 flex flex-col gap-3.5">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <span className="material-symbols-outlined text-[#006c49] text-[20px]">bed</span>
              <h2 className="text-sm font-bold text-slate-900">3. Limite de Quartos</h2>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-800" htmlFor="mob-room-limit">
                Quartos Inclusos no Plano <span className="text-red-600">*</span>
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[20px]">meeting_room</span>
                <input
                  id="mob-room-limit"
                  type="number"
                  min={1}
                  value={baseRooms}
                  onChange={(e) => setBaseRooms(parseInt(e.target.value, 10) || 1)}
                  placeholder="Ex: 45 quartos"
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-slate-50 text-slate-900 text-xs border border-slate-200 focus:border-[#003400] focus:ring-1 focus:ring-[#003400] outline-none transition-all font-bold"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col gap-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-bold text-slate-900">Permitir Quartos Excedentes</span>
                  <span className="text-[11px] text-slate-500">Taxa adicional por UH cadastrada acima da cota</span>
                </div>
                <div className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={allowExtraRooms}
                    onChange={(e) => setAllowExtraRooms(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003400]"></div>
                </div>
              </label>

              {allowExtraRooms && (
                <div className="flex flex-col gap-1 pt-2 border-t border-slate-200">
                  <label className="text-xs font-bold text-slate-800" htmlFor="mob-room-extra">
                    Valor por Quarto Excedente (R$)
                  </label>
                  <input
                    id="mob-room-extra"
                    type="text"
                    value={extraRoomPrice}
                    onChange={(e) => setExtraRoomPrice(e.target.value)}
                    placeholder="R$ 3,50/quarto"
                    className="w-full h-11 px-3 rounded-lg bg-white text-slate-900 text-xs border border-slate-200 focus:border-[#003400] focus:ring-1 focus:ring-[#003400] outline-none transition-all font-semibold"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Bloco 4: Conexões WhatsApp */}
          <section className="bg-white rounded-xl p-4 shadow-xs border border-slate-200/80 flex flex-col gap-3.5">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <span className="material-symbols-outlined text-[#006c49] text-[20px]">chat</span>
              <h2 className="text-sm font-bold text-slate-900">4. Conexões WhatsApp</h2>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-800" htmlFor="mob-zap-conn">
                Conexões Oficiais Inclusas <span className="text-red-600">*</span>
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[20px]">phone_iphone</span>
                <input
                  id="mob-zap-conn"
                  type="number"
                  min={1}
                  value={baseWhatsapp}
                  onChange={(e) => setBaseWhatsapp(parseInt(e.target.value, 10) || 1)}
                  placeholder="Ex: 2 conexões"
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-slate-50 text-slate-900 text-xs border border-slate-200 focus:border-[#003400] focus:ring-1 focus:ring-[#003400] outline-none transition-all font-bold"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col gap-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-bold text-slate-900">Permitir Conexões Extras</span>
                  <span className="text-[11px] text-slate-500">Habilita contratação autônoma de números adicionais</span>
                </div>
                <div className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={allowExtraWa}
                    onChange={(e) => setAllowExtraWa(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003400]"></div>
                </div>
              </label>

              {allowExtraWa && (
                <div className="flex flex-col gap-1 pt-2 border-t border-slate-200">
                  <label className="text-xs font-bold text-slate-800" htmlFor="mob-zap-extra">
                    Valor por Conexão Extra (R$)
                  </label>
                  <input
                    id="mob-zap-extra"
                    type="text"
                    value={extraWaPrice}
                    onChange={(e) => setExtraWaPrice(e.target.value)}
                    placeholder="R$ 49,90/mês"
                    className="w-full h-11 px-3 rounded-lg bg-white text-slate-900 text-xs border border-slate-200 focus:border-[#003400] focus:ring-1 focus:ring-[#003400] outline-none transition-all font-semibold"
                  />
                </div>
              )}
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50 text-emerald-950 border border-emerald-200/60">
              <span className="material-symbols-outlined text-[#006c49] text-[20px] shrink-0 mt-0.5">verified</span>
              <p className="text-[11px] leading-relaxed">
                Cobrança apenas por conexões e quartos (mensagens ilimitadas).
              </p>
            </div>
          </section>

          {/* Bloco 5: Observações & Ações */}
          <section className="bg-white rounded-xl p-4 shadow-xs border border-slate-200/80 flex flex-col gap-3.5">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <span className="material-symbols-outlined text-[#006c49] text-[20px]">assignment</span>
              <h2 className="text-sm font-bold text-slate-900">5. Observações & Conclusão</h2>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-800" htmlFor="mob-notes">
                Observações Internas
              </label>
              <textarea
                id="mob-notes"
                rows={2}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Anotações para a equipe de billing ou atendimento comercial..."
                className="w-full p-3 rounded-lg bg-slate-50 text-slate-900 text-xs border border-slate-200 focus:border-[#003400] focus:ring-1 focus:ring-[#003400] outline-none transition-all resize-none"
              />
            </div>

            {/* Ações do Formulário Mobile */}
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full h-12 bg-[#003400] hover:bg-[#002500] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">save</span>
                <span>{isSaving ? 'Salvando Plano...' : 'Salvar Plano'}</span>
              </button>

              <button
                type="button"
                onClick={onBack}
                className="w-full h-11 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </section>
        </form>
      </div>


      {/* ─────────────────────────────────────────────────────────────
          FORMULÁRIO DESKTOP (Telas lg e superiores)
          1:1 fiel à imagem e layout oficial de desktop
      ───────────────────────────────────────────────────────────── */}
      <div className="hidden lg:block w-full max-w-[1040px] mx-auto py-8 px-6">
        
        {/* Desktop Header & Navigation Area */}
        <div className="flex flex-col w-full mb-8">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-[#006c49] hover:text-[#0b1c30] transition-colors duration-150 font-semibold text-sm group cursor-pointer"
            >
              <span className="material-symbols-outlined text-base transition-transform duration-150 group-hover:-translate-x-1">arrow_back</span>
              <span>Voltar para Listagem de Planos</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#006c49]"></span>
                Ambiente Produção
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 font-bold text-xs">
                <span className="material-symbols-outlined text-sm">shield_lock</span>
                SSL 256-bit Seguro
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-6 pb-6 shadow-xs bg-white p-6 rounded-2xl border border-slate-200">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {planToEdit ? 'Edição de Plano de Assinatura' : 'Cadastro de Plano de Assinatura'}
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold">
                  SaaS Multi-tenant
                </span>
              </div>
              <p className="text-sm text-slate-500 max-w-3xl leading-relaxed">
                Configure as condições comerciais, limites de acomodações e conexões de WhatsApp do tier de assinatura para redes e pousadas associadas.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onBack}
                className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors font-bold text-xs cursor-pointer shadow-xs"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-[#003400] text-white hover:bg-[#002200] active:scale-[0.99] transition-all font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">save</span>
                <span>{isSaving ? 'Salvando...' : 'Salvar Plano'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Formulário Desktop */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-8 w-full">
          
          {/* Seção 1: Identificação & Status do Plano */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#003400] border border-emerald-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">tune</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">1. Identificação & Status do Plano</h2>
                  <p className="text-xs text-slate-500">Defina a nomenclatura oficial, visibilidade no catálogo e destaque mercadológico.</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">Passo 01/05</span>
            </div>

            {/* Switches de ativação e recomendação */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/70 transition-colors">
                <div className="flex flex-col pr-4">
                  <span className="text-sm font-bold text-slate-900">Status de Disponibilidade</span>
                  <span className="text-xs text-slate-500">Visível para contratação e cadastro de novos hotéis</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={status === 'Ativo'}
                    onChange={(e) => setStatus(e.target.checked ? 'Ativo' : 'Inativo')}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-slate-300 rounded-full peer peer-checked:bg-[#003400] peer-focus:outline-none transition-colors duration-200 after:content-[''] after:absolute after:top-[2px] after:left-[3px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm peer-checked:after:translate-x-6"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/70 transition-colors">
                <div className="flex flex-col pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">Destaque Comercial</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">Recomendado</span>
                  </div>
                  <span className="text-xs text-slate-500">Destacar como Mais Escolhido pelos Hotéis</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-slate-300 rounded-full peer peer-checked:bg-[#006c49] peer-focus:outline-none transition-colors duration-200 after:content-[''] after:absolute after:top-[2px] after:left-[3px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm peer-checked:after:translate-x-6"></div>
                </label>
              </div>
            </div>

            {/* Campos de texto */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-6 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between" htmlFor="desk-plan-name">
                  <span>Nome Oficial do Plano <span className="text-red-600">*</span></span>
                  <span className="text-slate-400 font-normal text-[11px]">Ex: Plano Professional</span>
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-slate-400 text-base pointer-events-none">hotel_class</span>
                  <input
                    id="desk-plan-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Plano Professional Gestão Pro"
                    className="w-full h-11 pl-10 pr-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between" htmlFor="desk-plan-tag">
                  <span>Badge Promocional / Tag</span>
                  <span className="text-slate-400 font-normal text-[11px]">Opcional</span>
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-slate-400 text-base pointer-events-none">sell</span>
                  <input
                    id="desk-plan-tag"
                    type="text"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    placeholder="Ex: Mais Vendido, -20% OFF, Verão"
                    className="w-full h-11 pl-10 pr-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="md:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800 text-center" htmlFor="desk-plan-order">
                  Ordem de Exibição
                </label>
                <div className="relative flex items-center">
                  <input
                    id="desk-plan-order"
                    type="number"
                    min={1}
                    max={99}
                    value={order}
                    onChange={(e) => setOrder(parseInt(e.target.value, 10) || 1)}
                    className="w-full h-11 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-bold text-center focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="md:col-span-12 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800" htmlFor="desk-plan-summary">
                  Descrição Resumida (Subtítulo Comercial)
                </label>
                <input
                  id="desk-plan-summary"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Recomendado para pousadas e redes hoteleiras de médio porte com gestão integrada e alta taxa de ocupação"
                  className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-xs"
                />
                <p className="text-[11px] text-slate-500">Esta descrição será exibida no card principal durante a escolha de plano pelo hoteleiro.</p>
              </div>
            </div>
          </div>

          {/* Seção 2: Precificação & Ciclo de Cobrança */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">payments</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">2. Precificação & Ciclo de Cobrança</h2>
                  <p className="text-xs text-slate-500">Configure o valor base de recorrência e bonificações por período contratado.</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">Passo 02/05</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800" htmlFor="desk-billing-cycle">
                  Periodicidade de Cobrança <span className="text-red-600">*</span>
                </label>
                <div className="relative flex items-center">
                  <select
                    id="desk-billing-cycle"
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as any)}
                    className="w-full h-11 px-3 pr-8 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-semibold focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none appearance-none cursor-pointer shadow-xs"
                  >
                    <option value="mensal">Mensal</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual (Compromisso 12 meses)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 text-slate-400 pointer-events-none text-base">expand_more</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800" htmlFor="desk-base-price">
                  Valor Base Recorrente <span className="text-red-600">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-bold text-slate-500 pointer-events-none">R$</span>
                  <input
                    id="desk-base-price"
                    type="text"
                    required
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="w-full h-11 pl-10 pr-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-extrabold focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800" htmlFor="desk-cycle-discount">
                  Desconto no Ciclo (Opcional)
                </label>
                <div className="relative flex items-center">
                  <input
                    id="desk-cycle-discount"
                    type="text"
                    value={cycleDiscount}
                    onChange={(e) => setCycleDiscount(e.target.value)}
                    placeholder="Ex: 15% ou R$ 50,00"
                    className="w-full h-11 px-3 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-medium focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800" htmlFor="desk-trial-days">
                  Dias de Teste Grátis (Trial)
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-slate-400 text-base pointer-events-none">schedule</span>
                  <input
                    id="desk-trial-days"
                    type="number"
                    min={0}
                    max={60}
                    value={trialDays}
                    onChange={(e) => setTrialDays(parseInt(e.target.value, 10) || 0)}
                    className="w-full h-11 pl-10 pr-12 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-xs"
                  />
                  <span className="absolute right-3 text-xs text-slate-400 pointer-events-none">dias</span>
                </div>
                {trialDays === 0 ? (
                  <p className="text-[11px] text-amber-800 bg-amber-50/90 p-2.5 rounded-xl border border-amber-200 mt-1 flex items-center gap-2 font-medium">
                    <span className="material-symbols-outlined text-base text-amber-600 shrink-0">info</span>
                    <span><strong>Modo Free Limitado:</strong> Ao definir 0 dias de teste, este plano funcionará de forma limitada contínua até o cliente assinar outro plano.</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-0.5">Período de teste sem custos antes da primeira cobrança recorrente.</p>
                )}
              </div>
            </div>

            {/* Preview de Faturamento Dinâmico */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#006c49] text-2xl">account_balance_wallet</span>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Simulação de Repasse Líquido Estimado</span>
                  <span className="text-[11px] text-slate-500">Valor líquido previsto por hotel após taxa de intermediação de cartão (estimativa 2.89%).</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Projeção por ciclo</span>
                <span className="text-lg font-black text-[#006c49]">
                  R$ {netSimulatedPrice} <span className="text-xs text-slate-500 font-normal">/mês/hotel</span>
                </span>
              </div>
            </div>
          </div>

          {/* Seção 3: Limites de Quartos & Acomodações */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">bed</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">3. Limites de Quartos & Acomodações</h2>
                  <p className="text-xs text-slate-500">Estabeleça a franquia volumétrica de unidades habitacionais inclusas no contrato.</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">Passo 03/05</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800" htmlFor="desk-base-rooms">
                  Quantidade Base Inclusa <span className="text-red-600">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-slate-400 text-base pointer-events-none">meeting_room</span>
                  <input
                    id="desk-base-rooms"
                    type="number"
                    min={1}
                    max={5000}
                    value={baseRooms}
                    onChange={(e) => setBaseRooms(parseInt(e.target.value, 10) || 1)}
                    className="w-full h-11 pl-10 pr-16 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-bold focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-xs"
                  />
                  <span className="absolute right-3 text-xs text-slate-400 pointer-events-none font-medium">quartos</span>
                </div>
                <span className="text-[11px] text-slate-500">Franquia inicial sem custo adicional.</span>
              </div>

              <div className="md:col-span-4 flex flex-col gap-1.5 justify-center">
                <span className="text-xs font-bold text-slate-800 mb-1">Permitir Quartos Excedentes?</span>
                <div className="flex items-center gap-3 h-11 px-3 rounded-xl bg-slate-50 border border-slate-100">
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={allowExtraRooms}
                      onChange={(e) => setAllowExtraRooms(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-300 rounded-full peer peer-checked:bg-[#003400] peer-focus:outline-none transition-colors duration-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-sm peer-checked:after:translate-x-5"></div>
                  </label>
                  <span className="text-xs font-semibold text-slate-700">Sim, tarifar quartos adicionais</span>
                </div>
              </div>

              <div className="md:col-span-4 flex flex-col gap-1.5" style={{ opacity: allowExtraRooms ? 1 : 0.4 }}>
                <label className="text-xs font-bold text-slate-800" htmlFor="desk-room-extra">
                  Valor por Quarto Adicional <span className="text-red-600">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-bold text-slate-500 pointer-events-none">R$</span>
                  <input
                    id="desk-room-extra"
                    type="text"
                    disabled={!allowExtraRooms}
                    value={extraRoomPrice}
                    onChange={(e) => setExtraRoomPrice(e.target.value)}
                    className="w-full h-11 pl-10 pr-24 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-xs"
                  />
                  <span className="absolute right-3 text-[11px] text-slate-400 pointer-events-none font-medium">/quarto/mês</span>
                </div>
                <span className="text-[11px] text-slate-500">Cobrado automaticamente no faturamento.</span>
              </div>
            </div>
          </div>

          {/* Seção 4: Conexões de WhatsApp (Instâncias Multi-Dispositivo) */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006c49] border border-emerald-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">chat</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">4. Conexões de WhatsApp (Instâncias Multi-Dispositivo)</h2>
                  <p className="text-xs text-slate-500">Controle a infraestrutura de números integrados ao motor de inteligência e atendimento.</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">Passo 04/05</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800" htmlFor="desk-base-wa">
                  Instâncias Inclusas no Plano <span className="text-red-600">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-slate-400 text-base pointer-events-none">devices</span>
                  <input
                    id="desk-base-wa"
                    type="number"
                    min={1}
                    max={100}
                    value={baseWhatsapp}
                    onChange={(e) => setBaseWhatsapp(parseInt(e.target.value, 10) || 1)}
                    className="w-full h-11 pl-10 pr-24 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-bold focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-xs"
                  />
                  <span className="absolute right-3 text-xs text-slate-400 pointer-events-none font-medium">conexões</span>
                </div>
                <span className="text-[11px] text-slate-500">Números operando simultaneamente.</span>
              </div>

              <div className="md:col-span-4 flex flex-col gap-1.5 justify-center">
                <span className="text-xs font-bold text-slate-800 mb-1">Permitir Conexões Extras?</span>
                <div className="flex items-center gap-3 h-11 px-3 rounded-xl bg-slate-50 border border-slate-100">
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={allowExtraWa}
                      onChange={(e) => setAllowExtraWa(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-300 rounded-full peer peer-checked:bg-[#003400] peer-focus:outline-none transition-colors duration-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-sm peer-checked:after:translate-x-5"></div>
                  </label>
                  <span className="text-xs font-semibold text-slate-700">Sim, permitir instâncias extras</span>
                </div>
              </div>

              <div className="md:col-span-4 flex flex-col gap-1.5" style={{ opacity: allowExtraWa ? 1 : 0.4 }}>
                <label className="text-xs font-bold text-slate-800" htmlFor="desk-wa-extra">
                  Valor por Instância Extra <span className="text-red-600">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-bold text-slate-500 pointer-events-none">R$</span>
                  <input
                    id="desk-wa-extra"
                    type="text"
                    disabled={!allowExtraWa}
                    value={extraWaPrice}
                    onChange={(e) => setExtraWaPrice(e.target.value)}
                    className="w-full h-11 pl-10 pr-28 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-xs"
                  />
                  <span className="absolute right-3 text-[11px] text-slate-400 pointer-events-none font-medium">/instância/mês</span>
                </div>
                <span className="text-[11px] text-slate-500">Cobrança pró-rata adicionada na fatura.</span>
              </div>
            </div>

            {/* Aviso Explicativo Oficial Hotel no Zap */}
            <div className="flex items-start gap-3.5 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/60 text-slate-800">
              <span className="material-symbols-outlined text-[#006c49] shrink-0 text-2xl">info</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-slate-900">Diretriz de Disparos Ilimitados Hotel no Zap</span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Atenção: Conforme as diretrizes do Hotel no Zap, <strong>não há limites por quantidade de disparos ou mensagens</strong>, apenas tarifação por conexões ativas e capacidade de quartos contratada pela propriedade.
                </p>
              </div>
            </div>
          </div>

          {/* Seção 5: Observações Internas & Termos do Plano */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-800 border border-purple-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">article</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">5. Observações Internas & Termos do Plano</h2>
                  <p className="text-xs text-slate-500">Registro para o time comercial, time de CS e suporte administrativo.</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">Passo 05/05</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-800" htmlFor="desk-notes">
                Observações Comerciais / Regras de Concessão Internas
              </label>
              <textarea
                id="desk-notes"
                rows={3}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Ex: Plano voltado para migração de clientes legados e parcerias com agências parceiras da ABIH..."
                className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-xs"
              />
              <span className="text-[11px] text-slate-500">Este campo não fica visível publicamente aos clientes na tela de checkout ou contratação.</span>
            </div>
          </div>

          {/* Rodapé inferior de ações Desktop */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-white rounded-2xl shadow-xs border border-slate-200 mb-6">
            <div className="flex items-center gap-2 text-slate-500">
              <span className="material-symbols-outlined text-lg text-[#006c49]">verified_user</span>
              <span className="text-xs">Alterações registradas com auditoria de IP corporativo do operador.</span>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onBack}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-xs font-bold cursor-pointer"
              >
                Cancelar Alterações
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-[#003400] text-white hover:bg-[#002200] active:scale-[0.99] transition-all text-xs font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>{isSaving ? 'Salvando Plano...' : 'Salvar Plano'}</span>
              </button>
            </div>
          </div>
        </form>

      </div>

    </div>
  );
};

export default CadastroPlano;
