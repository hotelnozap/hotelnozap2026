import React, { useState, useEffect, useMemo } from 'react';
import { reservasService, quartosService, hospedesService } from '../services/supabaseService';
import { templateMensagemService } from '../services/templateMensagemService';

interface CadastroReservaProps {
  onBack?: () => void;
  onSaveSuccess?: () => void;
}

const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getFutureDateString = (daysAhead: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateStr = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month, day);
};

const generateReservaCode = () => {
  const currentYear = new Date().getFullYear();
  const randomSixDigits = Math.floor(100000 + Math.random() * 900000);
  return `${currentYear}${randomSixDigits}`;
};

export const CadastroReserva: React.FC<CadastroReservaProps> = ({
  onBack,
  onSaveSuccess,
}) => {
  // Form State
  const [reservaCode] = useState(generateReservaCode);
  const [statusReserva, setStatusReserva] = useState<boolean>(true); // true = Confirmada
  const [hospedeId, setHospedeId] = useState('Carlos Silveira (CPF: 382.910.482-19)');
  const [quartoId, setQuartoId] = useState('Quarto 203 - Luxo Duplo (Disponível)');
  const [dataReserva, setDataReserva] = useState(getTodayString());
  const [checkInPrevisto, setCheckInPrevisto] = useState(getTodayString());
  const [checkOutPrevisto, setCheckOutPrevisto] = useState(getFutureDateString(5));
  const [qtdHospedes, setQtdHospedes] = useState(2);
  const [valorDiaria, setValorDiaria] = useState<number>(160);
  const [desconto, setDesconto] = useState<number>(0);
  const [origemReserva, setOrigemReserva] = useState('WhatsApp (Hotel no Zap)');
  const [observacoes, setObservacoes] = useState('');
  
  // Dynamic lists from Supabase
  const [hospedesOptions, setHospedesOptions] = useState<{ id: string; name: string; cpf: string; phone?: string }[]>([]);
  const [quartosOptions, setQuartosOptions] = useState<{ id: string; number: string; name: string; dailyPrice: number }[]>([]);
  
  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [hData, qData] = await Promise.all([
          hospedesService.getHospedes(),
          quartosService.getQuartos()
        ]);

        if (hData && hData.length > 0) {
          const mappedH = hData.map(h => ({
            id: h.id,
            name: h.name,
            cpf: h.cpfCnpj || 'Não informado',
            phone: h.phone || ''
          }));
          setHospedesOptions(mappedH);
          setHospedeId(`${mappedH[0].name} (CPF: ${mappedH[0].cpf})`);
        } else {
          setHospedesOptions([
            { id: '1', name: 'Carlos Silveira', cpf: '382.910.482-19', phone: '66981585014' },
            { id: '2', name: 'Mariana Costa', cpf: '219.832.741-00', phone: '' }
          ]);
        }

        if (qData && qData.length > 0) {
          const mappedQ = qData.map(q => ({
            id: q.id,
            number: q.number || '101',
            name: q.name || `Quarto ${q.number || '101'}`,
            dailyPrice: q.dailyPrice || 250
          }));
          setQuartosOptions(mappedQ);
          setQuartoId(`Quarto ${mappedQ[0].number} - ${mappedQ[0].name}`);
          setValorDiaria(mappedQ[0].dailyPrice);
        } else {
          setQuartosOptions([
            { id: 'q1', number: '203', name: 'Luxo Duplo', dailyPrice: 160 },
            { id: 'q2', number: '101', name: 'Suíte Master', dailyPrice: 400 }
          ]);
        }
      } catch (err) {
        console.warn('Erro ao carregar opções:', err);
      }
    };
    fetchOptions();
  }, []);

  // Dynamic Diárias Calculation
  const qtdDiarias = useMemo(() => {
    const start = parseDateStr(checkInPrevisto);
    const end = parseDateStr(checkOutPrevisto);
    if (!start || !end) return 1;
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  }, [checkInPrevisto, checkOutPrevisto]);

  // Handlers for automatic date logic
  const handleCheckInChange = (newCheckIn: string) => {
    setCheckInPrevisto(newCheckIn);
    const start = parseDateStr(newCheckIn);
    const end = parseDateStr(checkOutPrevisto);
    if (start && end && end <= start) {
      const nextDay = new Date(start);
      nextDay.setDate(nextDay.getDate() + 1);
      const y = nextDay.getFullYear();
      const m = String(nextDay.getMonth() + 1).padStart(2, '0');
      const d = String(nextDay.getDate()).padStart(2, '0');
      setCheckOutPrevisto(`${y}-${m}-${d}`);
    }
  };

  const handleCheckOutChange = (newCheckOut: string) => {
    setCheckOutPrevisto(newCheckOut);
    const start = parseDateStr(checkInPrevisto);
    const end = parseDateStr(newCheckOut);
    if (start && end && end <= start) {
      const prevDay = new Date(end);
      prevDay.setDate(prevDay.getDate() - 1);
      const y = prevDay.getFullYear();
      const m = String(prevDay.getMonth() + 1).padStart(2, '0');
      const d = String(prevDay.getDate()).padStart(2, '0');
      setCheckInPrevisto(`${y}-${m}-${d}`);
    }
  };

  const handleQuartoChange = (newQuartoLabel: string) => {
    setQuartoId(newQuartoLabel);
    const matched = quartosOptions.find(q => `Quarto ${q.number} - ${q.name}` === newQuartoLabel || newQuartoLabel.includes(q.number));
    if (matched) {
      setValorDiaria(matched.dailyPrice);
    }
  };

  // Dynamic Total Calculation
  const totalAPagar = useMemo(() => {
    const subtotal = qtdDiarias * (valorDiaria || 0);
    const total = subtotal - (desconto || 0);
    return total > 0 ? total : 0;
  }, [qtdDiarias, valorDiaria, desconto]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hospedeNomeOnly = hospedeId.split(' (CPF:')[0] || hospedeId;

    // REGRA DE NEGÓCIO: Usuários com perfil Hotel não podem fazer reservas para si mesmos
    const userRole = (localStorage.getItem('hotelnozap_user_role') || '').toLowerCase().trim();
    const userEmail = (localStorage.getItem('hotelnozap_user_email') || '').toLowerCase().trim();
    const userName = (localStorage.getItem('hotelnozap_user_name') || '').toLowerCase().trim();

    if (userRole === 'hotel' || userRole.includes('gerente')) {
      const nomeLower = hospedeNomeOnly.toLowerCase().trim();
      const isParaSiMesmo = (userName && (nomeLower === userName || nomeLower.includes(userName))) ||
        (userEmail && hospedeId.toLowerCase().includes(userEmail));

      if (isParaSiMesmo) {
        setToastMessage('⚠️ Usuários com perfil Hotel não podem fazer reservas para eles mesmos.');
        return;
      }
    }

    const quartoNumberMatch = quartoId.match(/(?:Quarto\s*|#)?(\d+)/i);
    const numeroQuartoOnly = quartoNumberMatch ? quartoNumberMatch[1] : '101';
    const selectedQuartoObj = quartosOptions.find(q => q.number === numeroQuartoOnly);
    const selectedHospedeObj = hospedesOptions.find(h => hospedeId.includes(h.name));

    const created = await reservasService.createReserva({
      nome_hospede: hospedeNomeOnly,
      numero_quarto: numeroQuartoOnly,
      data_checkin: checkInPrevisto,
      data_checkout: checkOutPrevisto,
      valor_total: totalAPagar,
      status: statusReserva ? 'Confirmada' : 'Pendente',
      observacoes: observacoes ? `${observacoes} (Origem: ${origemReserva})` : `Origem: ${origemReserva}`,
      quarto_id: selectedQuartoObj?.id,
      hospede_id: selectedHospedeObj?.id
    });

    if (created) {
      setToastMessage('Reserva cadastrada com sucesso!');

      setTimeout(() => {
        if (onSaveSuccess) onSaveSuccess();
      }, 1200);
    } else {
      setToastMessage('Erro ao salvar reserva no banco de dados.');
    }
  };

  return (
    <div className="bg-[#f8f9ff] min-h-screen p-4 sm:p-6 md:p-8 space-y-6 pb-28 sm:pb-12">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#d1fae5] border border-emerald-300 text-black font-bold px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-[#003400] text-xl">check_circle</span>
          <span className="text-sm text-black font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Main Container Wrapper */}
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Top Voltar Link & Header */}
        <div>
          {onBack && (
            <button
              onClick={onBack}
              type="button"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#003400] hover:text-emerald-950 transition-colors cursor-pointer mb-2"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Voltar para Listagem de Reservas
            </button>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                Cadastro de Reserva
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Insira os dados da nova hospedagem, hóspede vinculado, datas e cálculo financeiro.
              </p>
            </div>

            {/* Status Top Box */}
            <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-sm flex items-center justify-between sm:justify-end gap-3 shrink-0">
              <div className="text-left sm:text-right">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  STATUS DA RESERVA
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${statusReserva ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {statusReserva ? 'Confirmada' : 'Pendente'}
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={statusReserva}
                    onChange={(e) => setStatusReserva(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003400]"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* CARD 1: IDENTIFICAÇÃO & ACOMODAÇÃO */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 text-[#003400]">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#003400] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">badge</span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight">
                Identificação & Acomodação
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Código Reserva */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  CÓDIGO DA RESERVA <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-mono text-sm">
                    #
                  </span>
                  <input
                    type="text"
                    readOnly
                    value={reservaCode}
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-700 cursor-not-allowed"
                  />
                </div>
                <span className="text-[10.5px] text-slate-400 mt-1 block">Gerado automaticamente pelo sistema</span>
              </div>

              {/* Hóspede / Cliente */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  HÓSPEDE / CLIENTE <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-[18px]">person</span>
                  </span>
                  <select
                    value={hospedeId}
                    onChange={(e) => setHospedeId(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400] cursor-pointer"
                  >
                    {hospedesOptions.map(h => (
                      <option key={h.id} value={`${h.name} (CPF: ${h.cpf})`}>
                        {h.name} (CPF: {h.cpf})
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-[10.5px] text-slate-400 mt-1 block">Vincule um cadastro de hóspede existente</span>
              </div>

              {/* Quarto / Acomodação */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  QUARTO / ACOMODAÇÃO <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-[18px]">bed</span>
                  </span>
                  <select
                    value={quartoId}
                    onChange={(e) => handleQuartoChange(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400] cursor-pointer"
                  >
                    {quartosOptions.map(q => {
                      const label = `Quarto ${q.number} - ${q.name}`;
                      return (
                        <option key={q.id} value={label}>
                          {label} (R$ {q.dailyPrice}/dia)
                        </option>
                      );
                    })}
                  </select>
                </div>
                <span className="text-[10.5px] text-slate-400 mt-1 block">Apenas quartos disponíveis para o período</span>
              </div>
            </div>
          </div>

          {/* CARD 2: DATAS & CRONOGRAMA DE ESTADIA */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 text-[#003400]">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#003400] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">calendar_month</span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight">
                Datas & Cronograma de Estadia
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Data da Reserva */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  DATA DA RESERVA <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                  </span>
                  <input
                    type="date"
                    value={dataReserva}
                    onChange={(e) => setDataReserva(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                  />
                </div>
              </div>

              {/* Check-in Previsto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  CHECK-IN PREVISTO <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-600">
                    <span className="material-symbols-outlined text-[18px]">login</span>
                  </span>
                  <input
                    type="date"
                    value={checkInPrevisto}
                    onChange={(e) => handleCheckInChange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                  />
                </div>
              </div>

              {/* Check-out Previsto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  CHECK-OUT PREVISTO <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-amber-600">
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                  </span>
                  <input
                    type="date"
                    value={checkOutPrevisto}
                    onChange={(e) => handleCheckOutChange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                  />
                </div>
              </div>

              {/* Qtd de Hóspedes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  QTD. DE HÓSPEDES <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-[18px]">group</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={qtdHospedes}
                    onChange={(e) => setQtdHospedes(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CARD 3: VALORES, DIÁRIAS & TOTAL A PAGAR */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 text-[#003400]">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#003400] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">payments</span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight">
                Valores, Diárias & Total a Pagar
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              {/* Qtd Diárias (Calculado) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  QTD. DE DIÁRIAS
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-[18px]">hotel</span>
                  </span>
                  <input
                    type="number"
                    readOnly
                    value={qtdDiarias}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 cursor-not-allowed"
                  />
                </div>
                <span className="text-[10.5px] text-slate-400 mt-1 block">Calculado pelo período</span>
              </div>

              {/* Valor da Diária (R$) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  VALOR DA DIÁRIA (R$) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-bold">
                    R$
                  </span>
                  <input
                    type="number"
                    value={valorDiaria}
                    onChange={(e) => setValorDiaria(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                  />
                </div>
                <span className="text-[10.5px] text-slate-400 mt-1 block">Tarifa base da categoria</span>
              </div>

              {/* Desconto (R$) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  DESCONTO (R$)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-bold">
                    R$
                  </span>
                  <input
                    type="number"
                    value={desconto}
                    onChange={(e) => setDesconto(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                  />
                </div>
                <span className="text-[10.5px] text-slate-400 mt-1 block">Cupom ou negociação direta</span>
              </div>

              {/* Card Destaque: Total a Pagar */}
              <div className="bg-[#d1fae5]/60 border border-emerald-300 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#003400]">
                  TOTAL A PAGAR
                </span>
                <div className="mt-1">
                  <span className="text-xl sm:text-2xl font-black text-[#003400] tracking-tight block">
                    R$ {totalAPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-emerald-800 font-medium block mt-0.5">
                    {qtdDiarias} diárias × R$ {valorDiaria} - R$ {desconto} desc.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 4: CANAL DE ORIGEM & OBSERVAÇÕES */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 text-[#003400]">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#003400] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">cell_tower</span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight">
                Canal de Origem & Observações
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Origem da Reserva */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  ORIGEM DA RESERVA <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-[18px]">cell_tower</span>
                  </span>
                  <select
                    value={origemReserva}
                    onChange={(e) => setOrigemReserva(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400] cursor-pointer"
                  >
                    <option value="WhatsApp (Hotel no Zap)">WhatsApp (Hotel no Zap)</option>
                    <option value="Balcão / Presencial">Balcão / Presencial</option>
                    <option value="Booking.com">Booking.com</option>
                    <option value="Airbnb">Airbnb</option>
                    <option value="Telefone">Telefone</option>
                  </select>
                </div>
                <span className="text-[10.5px] text-slate-400 mt-1 block">Canal pelo qual a reserva foi feita</span>
              </div>

              {/* Observações & Solicitações Especiais */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  OBSERVAÇÕES & SOLICITAÇÕES ESPECIAIS
                </label>
                <textarea
                  rows={3}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Hóspede solicitou berço infantil adicional e check-in antecipado para as 12h..."
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400] resize-none"
                ></textarea>
              </div>
            </div>
          </div>

          {/* RODAPÉ DE AÇÕES */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-full sm:w-auto px-6 py-3 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs sm:text-sm font-bold transition-colors text-center cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="w-full sm:w-auto px-7 py-3 bg-[#003400] hover:bg-[#002500] active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Salvar Reserva
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default CadastroReserva;
