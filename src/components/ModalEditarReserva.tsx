import React, { useState, useEffect, useMemo } from 'react';
import { reservasService, quartosService } from '../services/supabaseService';

interface ReservaData {
  id: string;
  reservaNumber: string;
  hospedeNome: string;
  hospedeEmail?: string;
  hospedeTelefone?: string;
  hospedeCpf?: string;
  quartoNome: string;
  quartoTipo: string;
  numero_quarto?: string;
  quarto_id?: string;
  hospede_id?: string;
  checkIn: string;
  checkOut: string;
  valorTotal: string;
  valor_total?: number;
  status: 'Confirmada' | 'Hospedado' | 'Concluída' | 'Cancelada';
  observacao?: string;
  observacoes?: string;
  formaPagamento?: string;
}

interface ModalEditarReservaProps {
  isOpen: boolean;
  onClose: () => void;
  reserva: ReservaData | null;
  onSaveSuccess: (mensagemFeedback: string) => void;
  quartosDisponiveis?: any[];
}

export const ModalEditarReserva: React.FC<ModalEditarReservaProps> = ({
  isOpen,
  onClose,
  reserva,
  onSaveSuccess,
  quartosDisponiveis = []
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [status, setStatus] = useState<'Confirmada' | 'Hospedado' | 'Concluída' | 'Cancelada'>('Confirmada');
  const [nomeHospede, setNomeHospede] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [numeroQuarto, setNumeroQuarto] = useState('');
  const [quartoId, setQuartoId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [valorTotal, setValorTotal] = useState<number>(0);
  const [formaPagamento, setFormaPagamento] = useState('PIX');
  const [observacoes, setObservacoes] = useState('');

  // Quartos para o select
  const [quartosList, setQuartosList] = useState<any[]>(quartosDisponiveis);

  useEffect(() => {
    if (isOpen && quartosDisponiveis.length === 0) {
      quartosService.getQuartos()
        .then(q => setQuartosList(q || []))
        .catch(() => {});
    } else if (quartosDisponiveis.length > 0) {
      setQuartosList(quartosDisponiveis);
    }
  }, [isOpen, quartosDisponiveis]);

  // Carregar dados da reserva ao abrir
  useEffect(() => {
    if (reserva) {
      setStatus(reserva.status || 'Confirmada');
      setNomeHospede(reserva.hospedeNome || '');
      setTelefone(reserva.hospedeTelefone || '');
      setEmail(reserva.hospedeEmail || '');

      // Extrair apenas o número do quarto
      const rawNum = reserva.numero_quarto || (reserva.quartoNome ? reserva.quartoNome.replace(/\D/g, '') : '');
      setNumeroQuarto(rawNum);
      setQuartoId(reserva.quarto_id || '');

      // Datas YYYY-MM-DD
      const cIn = reserva.checkIn ? reserva.checkIn.split('T')[0] : '';
      const cOut = reserva.checkOut ? reserva.checkOut.split('T')[0] : '';
      setCheckIn(cIn);
      setCheckOut(cOut);

      // Valor numérico
      let valNum = 0;
      if (reserva.valor_total !== undefined) {
        valNum = Number(reserva.valor_total);
      } else if (reserva.valorTotal) {
        const cleaned = reserva.valorTotal.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        valNum = parseFloat(cleaned) || 0;
      }
      setValorTotal(valNum);

      setFormaPagamento(reserva.formaPagamento || 'PIX');
      setObservacoes(reserva.observacoes || reserva.observacao || '');
      setErrorMsg(null);
    }
  }, [reserva, isOpen]);

  // Cálculo de diárias
  const noitesCalculadas = useMemo(() => {
    if (!checkIn || !checkOut) return 1;
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }, [checkIn, checkOut]);

  // Recalcular valor total ao trocar de quarto se o usuário desejar
  const handleQuartoSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedNum = e.target.value;
    setNumeroQuarto(selectedNum);
    const qFound = quartosList.find(q => String(q.number || q.numero).trim() === String(selectedNum).trim());
    if (qFound) {
      setQuartoId(qFound.id || '');
      const precoDiaria = Number(qFound.dailyPrice || qFound.valor_diaria || qFound.price || 0);
      if (precoDiaria > 0 && valorTotal === 0) {
        setValorTotal(precoDiaria * noitesCalculadas);
      }
    }
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reserva) return;

    if (!nomeHospede.trim()) {
      setErrorMsg('Por favor, informe o nome do hóspede.');
      return;
    }
    if (!numeroQuarto) {
      setErrorMsg('Por favor, selecione um quarto.');
      return;
    }
    if (!checkIn || !checkOut) {
      setErrorMsg('Por favor, defina as datas de check-in e check-out.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // Montar observação preservando contatos
      let obsFinal = observacoes.trim();
      const contatosExtra: string[] = [];
      if (telefone && !obsFinal.includes(telefone)) contatosExtra.push(`WhatsApp: ${telefone}`);
      if (email && !obsFinal.includes(email)) contatosExtra.push(`E-mail: ${email}`);
      if (contatosExtra.length > 0) {
        obsFinal = obsFinal ? `${obsFinal} | ${contatosExtra.join(' - ')}` : contatosExtra.join(' - ');
      }

      // Se foi reativada de cancelamento, adicionar nota no histórico
      const eraCancelada = reserva.status === 'Cancelada';
      const virouAtiva = status === 'Confirmada' || status === 'Hospedado';
      if (eraCancelada && virouAtiva) {
        const carimboReativacao = `[REATIVADA em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}]`;
        obsFinal = obsFinal ? `${obsFinal} | ${carimboReativacao}` : carimboReativacao;
      }

      const qSelected = quartosList.find(q => String(q.number || q.numero).trim() === String(numeroQuarto).trim());

      const res = await reservasService.updateReserva(reserva.id, {
        nome_hospede: nomeHospede.trim(),
        numero_quarto: numeroQuarto,
        quarto_id: qSelected?.id || quartoId || undefined,
        data_checkin: checkIn,
        data_checkout: checkOut,
        valor_total: valorTotal,
        status: status,
        observacoes: obsFinal,
        forma_pagamento: formaPagamento
      });

      if (res.success) {
        let msgSucesso = `Reserva ${reserva.reservaNumber} atualizada com sucesso!`;
        if (eraCancelada && virouAtiva) {
          msgSucesso = `🎉 Reserva ${reserva.reservaNumber} reativada com sucesso como ${status}! Quarto ${numeroQuarto} atualizado.`;
        }
        onSaveSuccess(msgSucesso);
        onClose();
      } else {
        setErrorMsg(res.error || 'Erro ao salvar alterações no banco de dados.');
      }
    } catch (err: any) {
      console.error('Erro ao salvar edição de reserva:', err);
      setErrorMsg(err?.message || 'Falha na comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !reserva) return null;

  const isCancelada = reserva.status === 'Cancelada';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-[#FDB116] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">edit_calendar</span>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight flex items-center gap-2">
                Editar Reserva <span className="text-[#FDB116]">{reserva.reservaNumber}</span>
              </h2>
              <p className="text-xs text-slate-300">
                Ajuste datas, quarto, valores ou reative estadias canceladas.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Fechar"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* ALERTA ESPECIAL CASO A RESERVA ESTEJA CANCELADA */}
        {isCancelada && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-3 flex items-start gap-3 text-xs text-rose-900">
            <span className="material-symbols-outlined text-rose-600 text-lg shrink-0 mt-0.5">info</span>
            <div>
              <strong className="font-bold text-rose-950 block">Reserva Cancelada anteriormente:</strong>
              Para reativar a estadia (em caso de atraso de voo, trânsito ou no-show revertido), basta alterar o campo <strong>Status da Reserva</strong> abaixo para <strong>Confirmada</strong> ou <strong>Hospedado</strong>.
            </div>
          </div>
        )}

        {/* FORMULÁRIO */}
        <form onSubmit={handleSalvar} className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STATUS DA RESERVA (DESTAQUE) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Status da Reserva <span className="text-red-500">*</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className={`w-full py-2.5 px-3.5 rounded-lg border font-bold text-xs sm:text-sm transition-colors focus:ring-2 focus:outline-hidden ${
                status === 'Confirmada'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 focus:ring-emerald-400'
                  : status === 'Hospedado'
                  ? 'bg-blue-50 border-blue-300 text-blue-800 focus:ring-blue-400'
                  : status === 'Cancelada'
                  ? 'bg-rose-50 border-rose-300 text-rose-800 focus:ring-rose-400'
                  : 'bg-amber-50 border-amber-300 text-amber-800 focus:ring-amber-400'
              }`}
            >
              <option value="Confirmada">🟢 Confirmada (Reserva Ativa / Atraso Aceito)</option>
              <option value="Hospedado">🔵 Hospedado (Hóspede já no quarto / Check-in feito)</option>
              <option value="Concluída">🟡 Concluída (Estadia finalizada / Quarto em Limpeza)</option>
              <option value="Cancelada">🔴 Cancelada (No-Show ou Cancelada a pedido)</option>
            </select>
          </div>

          {/* HÓSPEDE (NOME, TELEFONE, EMAIL) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome Completo do Hóspede <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nomeHospede}
                onChange={(e) => setNomeHospede(e.target.value)}
                placeholder="Ex: Everaldo Souza da Silva"
                className="w-full py-2 px-3 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-[#003400] focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                WhatsApp / Telefone
              </label>
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Ex: 66981585014"
                className="w-full py-2 px-3 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-[#003400] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hospede@email.com"
                className="w-full py-2 px-3 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-[#003400] focus:border-transparent"
              />
            </div>
          </div>

          {/* QUARTO */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quarto Designado <span className="text-red-500">*</span>
            </label>
            <select
              value={numeroQuarto}
              onChange={handleQuartoSelect}
              className="w-full py-2 px-3 border border-slate-300 rounded-lg text-slate-800 bg-white font-medium focus:ring-2 focus:ring-[#003400]"
              required
            >
              <option value="">Selecione o quarto...</option>
              {quartosList.map((q) => {
                const num = String(q.number || q.numero || '').trim();
                const tipo = q.name || q.type || q.tipoQuarto || 'Quarto';
                const statusQ = q.status || 'livre';
                return (
                  <option key={q.id || num} value={num}>
                    Quarto {num} - {tipo} ({statusQ.toUpperCase()})
                  </option>
                );
              })}
            </select>
          </div>

          {/* DATAS (CHECK-IN E CHECK-OUT) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data de Check-in <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full py-2 px-3 border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-[#003400]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data de Check-out <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full py-2 px-3 border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-[#003400]"
                required
              />
            </div>
          </div>

          {/* FINANCEIRO (VALOR TOTAL E FORMA DE PAGAMENTO) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Valor Total da Reserva (R$) <span className="text-slate-400 font-normal">({noitesCalculadas} {noitesCalculadas === 1 ? 'diária' : 'diárias'})</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-500 font-bold text-xs">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorTotal}
                  onChange={(e) => setValorTotal(parseFloat(e.target.value) || 0)}
                  className="w-full py-2 pl-9 pr-3 border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-[#003400]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Forma de Pagamento
              </label>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className="w-full py-2 px-3 border border-slate-300 rounded-lg text-slate-800 bg-white font-medium focus:ring-2 focus:ring-[#003400]"
              >
                <option value="PIX">PIX (Instantâneo)</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Dinheiro">Dinheiro no Balcão</option>
                <option value="Faturado">Faturado / Empresa</option>
              </select>
            </div>
          </div>

          {/* OBSERVAÇÕES E MOTIVO DO ATRASO */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações / Justificativa de Atraso ou Reativação
            </label>
            <textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Hóspede avisou atraso no voo, chega após o horário. Reserva reativada pelo operador."
              className="w-full py-2 px-3 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-[#003400] text-xs"
            />
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="py-2.5 px-6 rounded-xl bg-[#003400] hover:bg-black text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  Salvando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">save</span>
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
