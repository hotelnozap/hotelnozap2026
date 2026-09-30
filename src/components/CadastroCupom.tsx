import React, { useState, useMemo } from 'react';
import { cuponsService, CupomDesconto } from '../services/cuponsService';
import { currentHotelService } from '../services/supabaseService';

interface CadastroCupomProps {
  cupomToEdit?: CupomDesconto | null;
  onBack: () => void;
  onSaveSuccess: () => void;
}

export const CadastroCupom: React.FC<CadastroCupomProps> = ({
  cupomToEdit,
  onBack,
  onSaveSuccess
}) => {
  const activeHotel = currentHotelService.getCurrentHotel();

  // Estados do Formulário
  const [codigo, setCodigo] = useState<string>(cupomToEdit?.codigo || '');
  const [tipoDesconto, setTipoDesconto] = useState<'porcentagem' | 'fixo'>(
    cupomToEdit?.tipo_desconto || 'porcentagem'
  );
  const [valorDesconto, setValorDesconto] = useState<string>(
    cupomToEdit ? String(cupomToEdit.valor_desconto) : '10'
  );
  const [valorMinimo, setValorMinimo] = useState<string>(
    cupomToEdit?.valor_minimo_reserva ? String(cupomToEdit.valor_minimo_reserva) : ''
  );
  const [dataInicio, setDataInicio] = useState<string>(
    cupomToEdit?.data_inicio || new Date().toISOString().split('T')[0]
  );
  const [naoExpira, setNaoExpira] = useState<boolean>(
    cupomToEdit ? !cupomToEdit.data_expiracao : false
  );
  const [diasValidade, setDiasValidade] = useState<string>(() => {
    if (cupomToEdit?.data_expiracao && cupomToEdit?.data_inicio) {
      try {
        const diff = Math.round(
          (new Date(cupomToEdit.data_expiracao + 'T12:00:00').getTime() -
            new Date(cupomToEdit.data_inicio + 'T12:00:00').getTime()) /
            (1000 * 3600 * 24)
        );
        return diff > 0 ? String(diff) : '30';
      } catch {
        return '30';
      }
    }
    return '30';
  });

  // Data de expiração calculada dinamicamente a partir dos dias
  const dataExpiracaoCalculada = useMemo(() => {
    if (naoExpira) return null;
    const dias = parseInt(diasValidade, 10);
    if (isNaN(dias) || dias <= 0) return null;
    const baseDate = new Date((dataInicio || new Date().toISOString().split('T')[0]) + 'T12:00:00');
    baseDate.setDate(baseDate.getDate() + dias);
    return baseDate.toISOString().split('T')[0];
  }, [naoExpira, diasValidade, dataInicio]);

  const [temLimiteUsos, setTemLimiteUsos] = useState<boolean>(
    Boolean(cupomToEdit?.limite_usos && cupomToEdit.limite_usos > 0)
  );
  const [limiteUsos, setLimiteUsos] = useState<string>(
    cupomToEdit?.limite_usos ? String(cupomToEdit.limite_usos) : '50'
  );
  const [status, setStatus] = useState<'Ativo' | 'Inativo'>(
    cupomToEdit?.status || 'Ativo'
  );
  const [visivelHospedes, setVisivelHospedes] = useState<boolean>(
    cupomToEdit ? cupomToEdit.visivel_hospedes : true
  );
  const [descricao, setDescricao] = useState<string>(
    cupomToEdit?.descricao || ''
  );

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  // Gerador de Código Randômico
  const gerarCodigoAleatorio = () => {
    const prefixos = ['PROMO', 'FERIAS', 'VERAO', 'HOTEL', 'DESCONTO', 'BEMVINDO', 'RESERVA'];
    const prefixo = prefixos[Math.floor(Math.random() * prefixos.length)];
    const numero = Math.floor(10 + Math.random() * 90);
    setCodigo(`${prefixo}${numero}`);
  };

  // Cálculo de desconto e validação numérica
  const numDesconto = useMemo(() => {
    const val = parseFloat(valorDesconto.replace(',', '.')) || 0;
    if (tipoDesconto === 'porcentagem') return Math.min(Math.max(val, 0), 100);
    return Math.max(val, 0);
  }, [valorDesconto, tipoDesconto]);

  const numValorMinimo = useMemo(() => {
    return parseFloat(valorMinimo.replace(',', '.')) || 0;
  }, [valorMinimo]);

  const numLimiteUsos = useMemo(() => {
    if (!temLimiteUsos) return null;
    const val = parseInt(limiteUsos, 10);
    return isNaN(val) || val <= 0 ? null : val;
  }, [temLimiteUsos, limiteUsos]);

  // Simulação de Exemplo no Checkout
  const simulacaoReserva = 400.0;
  const valorDescontadoSimulado = useMemo(() => {
    if (numDesconto <= 0) return 0;
    if (tipoDesconto === 'porcentagem') {
      return (simulacaoReserva * numDesconto) / 100;
    }
    return Math.min(simulacaoReserva, numDesconto);
  }, [numDesconto, tipoDesconto]);

  const totalComDescontoSimulado = Math.max(0, simulacaoReserva - valorDescontadoSimulado);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroMsg(null);

    const cleanCodigo = codigo.trim().toUpperCase();
    if (!cleanCodigo) {
      setErroMsg('Por favor, informe o código do cupom de desconto.');
      return;
    }

    if (numDesconto <= 0) {
      setErroMsg('O valor do desconto deve ser maior que zero.');
      return;
    }

    if (!naoExpira) {
      const dias = parseInt(diasValidade, 10);
      if (isNaN(dias) || dias <= 0) {
        setErroMsg('Por favor, informe uma quantidade válida de dias para a validade do cupom.');
        return;
      }
      if (!dataExpiracaoCalculada) {
        setErroMsg('Erro ao calcular a data de expiração. Verifique os dias informados.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload: Partial<CupomDesconto> = {
        codigo: cleanCodigo,
        tipo_desconto: tipoDesconto,
        valor_desconto: numDesconto,
        valor_minimo_reserva: numValorMinimo,
        data_inicio: dataInicio,
        data_expiracao: naoExpira ? null : dataExpiracaoCalculada,
        limite_usos: numLimiteUsos,
        status,
        visivel_hospedes: visivelHospedes,
        descricao: descricao.trim(),
        hotel_id: cupomToEdit?.hotel_id || activeHotel?.id || 'hotel-local',
        hotel_nome: cupomToEdit?.hotel_nome || activeHotel?.name || 'Hotel Parceiro'
      };

      if (cupomToEdit?.id) {
        await cuponsService.updateCupom(cupomToEdit.id, payload);
      } else {
        await cuponsService.createCupom(payload);
      }

      onSaveSuccess();
    } catch (err) {
      console.error('Erro ao salvar cupom:', err);
      setErroMsg('Ocorreu um erro ao salvar o cupom. Verifique os dados e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#F8FAFC] min-h-screen text-slate-800 font-sans pb-16">
      {/* Header Sticky */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              title="Voltar à Listagem"
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                {cupomToEdit ? 'Editar Cupom de Desconto' : 'Novo Cupom de Desconto'}
              </h1>
              <p className="text-xs text-slate-500">
                Configure as condições, validade e regras de resgate do cupom no checkout.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer hidden sm:block"
            >
              Cancelar
            </button>
            <button
              form="form-cupom"
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002600] disabled:bg-slate-300 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              {isSaving ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">sync</span>
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">check</span>
                  <span>{cupomToEdit ? 'Salvar Alterações' : 'Criar Cupom'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {erroMsg && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-semibold animate-in fade-in duration-150">
            <span className="material-symbols-outlined text-rose-600 text-xl shrink-0">error</span>
            <span>{erroMsg}</span>
          </div>
        )}

        <form id="form-cupom" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* COLUNA ESQUERDA: FORMULÁRIO (8 colunas) */}
            <div className="lg:col-span-8 space-y-6">
              {/* Bloco 1: Identificação & Código */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                  <span className="material-symbols-outlined text-emerald-700 text-xl">confirmation_number</span>
                  <h2 className="text-sm font-bold text-slate-900">1. Identificação do Cupom</h2>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700" htmlFor="cupom-codigo">
                      Código do Cupom <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={gerarCodigoAleatorio}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer transition"
                    >
                      <span className="material-symbols-outlined text-sm">casino</span>
                      <span>Gerar Código</span>
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      id="cupom-codigo"
                      type="text"
                      required
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/\s/g, ''))}
                      placeholder="Ex: VERAO2026, BEMVINDO15"
                      className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono font-bold tracking-wider uppercase focus:bg-white focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    O hóspede digitará este código no momento da reserva ou no checkout.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700" htmlFor="cupom-descricao">
                    Descrição ou Regras do Cupom (Opcional)
                  </label>
                  <textarea
                    id="cupom-descricao"
                    rows={2}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Ex: Válido para estadias de pelo menos 2 noites em qualquer acomodação."
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition resize-none"
                  />
                </div>
              </div>

              {/* Bloco 2: Tipo de Desconto & Valores */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                  <span className="material-symbols-outlined text-emerald-700 text-xl">payments</span>
                  <h2 className="text-sm font-bold text-slate-900">2. Benefício & Desconto</h2>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Tipo de Desconto <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTipoDesconto('porcentagem')}
                      className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition cursor-pointer ${
                        tipoDesconto === 'porcentagem'
                          ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                        tipoDesconto === 'porcentagem' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        %
                      </div>
                      <div>
                        <span className="block text-xs font-bold">Porcentagem (%)</span>
                        <span className="block text-[10px] text-slate-500 font-normal">Ex: 10% ou 20% do total</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTipoDesconto('fixo')}
                      className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition cursor-pointer ${
                        tipoDesconto === 'fixo'
                          ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                        tipoDesconto === 'fixo' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        R$
                      </div>
                      <div>
                        <span className="block text-xs font-bold">Valor Fixo (R$)</span>
                        <span className="block text-[10px] text-slate-500 font-normal">Ex: R$ 50,00 de abatimento</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700" htmlFor="cupom-valor">
                      {tipoDesconto === 'porcentagem' ? 'Porcentagem de Desconto (%)' : 'Valor do Desconto (R$)'}{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-xs font-bold text-slate-400">
                        {tipoDesconto === 'porcentagem' ? '%' : 'R$'}
                      </span>
                      <input
                        id="cupom-valor"
                        type="text"
                        required
                        value={valorDesconto}
                        onChange={(e) => setValorDesconto(e.target.value)}
                        placeholder={tipoDesconto === 'porcentagem' ? '15' : '50,00'}
                        className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:bg-white focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700" htmlFor="cupom-minimo">
                      Valor Mínimo da Reserva (Opcional)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-xs font-bold text-slate-400">R$</span>
                      <input
                        id="cupom-minimo"
                        type="text"
                        value={valorMinimo}
                        onChange={(e) => setValorMinimo(e.target.value)}
                        placeholder="0,00 (Sem valor mínimo)"
                        className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:bg-white focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bloco 3: Período & Limites */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                  <span className="material-symbols-outlined text-emerald-700 text-xl">event_available</span>
                  <h2 className="text-sm font-bold text-slate-900">3. Validade & Limites de Utilização</h2>
                </div>

                {/* Switch: Cupom Não Expira */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      naoExpira ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <span className="material-symbols-outlined text-xl">all_inclusive</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Cupom Não Expira</span>
                      <span className="text-[11px] text-slate-500">
                        Validade permanente por tempo indeterminado (sem data de término).
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={naoExpira}
                      onChange={(e) => setNaoExpira(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003400]"></div>
                  </label>
                </div>

                {/* Se Não Expira: Mensagem explicativa */}
                {naoExpira ? (
                  <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-950 animate-in fade-in duration-150">
                    <span className="material-symbols-outlined text-emerald-700 text-xl shrink-0 mt-0.5">verified</span>
                    <div className="leading-relaxed">
                      <strong className="block text-emerald-900 font-bold mb-0.5">Validade Contínua e Sem Término</strong>
                      <span>Este cupom permanecerá ativo continuamente para reservas no checkout até que você decida pausá-lo ou inativá-lo manualmente na listagem.</span>
                    </div>
                  </div>
                ) : (
                  /* Se Expira: Contagem por DIAS (sem calendário de expiração) */
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-4 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Válido a partir de */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700" htmlFor="cupom-inicio">
                          Válido a Partir de <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="cupom-inicio"
                          type="date"
                          required
                          value={dataInicio}
                          onChange={(e) => setDataInicio(e.target.value)}
                          className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition cursor-pointer"
                        />
                      </div>

                      {/* Duração em dias */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700" htmlFor="cupom-dias">
                          Validade em Dias <span className="text-red-500">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <input
                            id="cupom-dias"
                            type="number"
                            min={1}
                            max={3650}
                            required={!naoExpira}
                            value={diasValidade}
                            onChange={(e) => setDiasValidade(e.target.value)}
                            placeholder="Ex: 30"
                            className="w-full h-11 pl-3.5 pr-14 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                          />
                          <span className="absolute right-3 text-xs font-bold text-slate-400 pointer-events-none">
                            dias
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botões de Atalhos Rápidos de Dias */}
                    <div className="pt-2 border-t border-slate-200/70">
                      <span className="text-[10.5px] uppercase font-bold text-slate-400 block mb-2">
                        Escolha Rápida de Dias:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: '7 dias', value: '7' },
                          { label: '15 dias', value: '15' },
                          { label: '30 dias', value: '30' },
                          { label: '45 dias', value: '45' },
                          { label: '60 dias', value: '60' },
                          { label: '90 dias', value: '90' },
                          { label: '180 dias', value: '180' },
                          { label: '365 dias (1 ano)', value: '365' }
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setDiasValidade(opt.value)}
                            className={`px-3 py-1.5 text-xs rounded-xl font-bold transition cursor-pointer ${
                              diasValidade === opt.value
                                ? 'bg-[#003400] text-white shadow-xs'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Resumo da Data Calculada */}
                    {dataExpiracaoCalculada && (
                      <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-950 font-medium">
                        <span className="material-symbols-outlined text-emerald-700 text-lg shrink-0">calendar_month</span>
                        <span>
                          Válido por <strong>{diasValidade} dias</strong>: expira automaticamente em{' '}
                          <strong>{new Date(dataExpiracaoCalculada + 'T12:00:00').toLocaleDateString('pt-BR')}</strong> (às 23:59h).
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Limite de utilizações */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Limitar Quantidade de Utilizações?</span>
                      <span className="text-[11px] text-slate-500">Defina se o cupom pode ser resgatado um número limitado de vezes.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={temLimiteUsos}
                        onChange={(e) => setTemLimiteUsos(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003400]"></div>
                    </label>
                  </div>

                  {temLimiteUsos && (
                    <div className="pt-2 border-t border-slate-200">
                      <label className="text-xs font-bold text-slate-700 block mb-1" htmlFor="cupom-limite">
                        Número Máximo de Utilizações
                      </label>
                      <input
                        id="cupom-limite"
                        type="number"
                        min={1}
                        value={limiteUsos}
                        onChange={(e) => setLimiteUsos(e.target.value)}
                        placeholder="Ex: 50"
                        className="w-full sm:w-48 h-10 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold focus:border-[#003400] focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Bloco 4: Visibilidade e Status */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                  <span className="material-symbols-outlined text-emerald-700 text-xl">visibility</span>
                  <h2 className="text-sm font-bold text-slate-900">4. Disponibilidade & Hóspedes</h2>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-amber-700 text-2xl">campaign</span>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Disponibilizar na Área dos Hóspedes
                      </span>
                      <span className="text-[11px] text-slate-600">
                        Quando ativo, todos os hóspedes poderão ver este cupom na aba de ofertas da sua conta.
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={visivelHospedes}
                      onChange={(e) => setVisivelHospedes(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003400]"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Status do Cupom</span>
                    <span className="text-[11px] text-slate-400">Ative para permitir o uso imediato no checkout.</span>
                  </div>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="Ativo">Ativo (Habilitado)</option>
                    <option value="Inativo">Inativo (Pausado)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: PREVIEW EM TEMPO REAL (4 colunas) */}
            <div className="lg:col-span-4 space-y-5">
              <div className="sticky top-24 space-y-5">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Preview do Hóspede
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Tempo Real
                    </span>
                  </div>

                  {/* Cartão Estilo Cupom/Voucher */}
                  <div className="rounded-2xl border-2 border-dashed border-emerald-500/40 bg-gradient-to-br from-emerald-50/70 to-emerald-100/40 p-4 space-y-3 relative overflow-hidden">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                          {activeHotel?.name || 'Hotel Parceiro'}
                        </span>
                        <div className="font-mono font-black text-lg text-slate-900 tracking-wider mt-0.5">
                          {codigo || 'SEU_CODIGO'}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-1 rounded-lg bg-emerald-600 text-white shadow-xs">
                        {tipoDesconto === 'porcentagem'
                          ? `${numDesconto}% OFF`
                          : `R$ ${numDesconto.toFixed(2)} OFF`}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-snug">
                      {descricao || 'Válido para reservas diretas no checkout online.'}
                    </p>

                    <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      {naoExpira ? (
                        <span className="text-emerald-800 font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-emerald-600">all_inclusive</span>
                          <span>Validade: Não expira</span>
                        </span>
                      ) : (
                        <span>
                          Válido até: {dataExpiracaoCalculada ? new Date(dataExpiracaoCalculada + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                        </span>
                      )}
                      {numValorMinimo > 0 && (
                        <span>Mín. R$ {numValorMinimo.toFixed(2).replace('.', ',')}</span>
                      )}
                    </div>
                  </div>

                  {/* Simulação no Checkout */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                    <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                      Simulação no Checkout
                    </span>
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Diária estimada:</span>
                      <span>R$ {simulacaoReserva.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-700 font-bold">
                      <span>Desconto aplicado:</span>
                      <span>- R$ {valorDescontadoSimulado.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between font-black text-slate-900 text-sm">
                      <span>Total da Reserva:</span>
                      <span className="text-[#006c49]">
                        R$ {totalComDescontoSimulado.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
export default CadastroCupom;
