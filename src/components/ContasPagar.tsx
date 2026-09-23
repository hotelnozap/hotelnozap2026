import React, { useState } from 'react';
import { CreditCard, Plus, Calendar, DollarSign, AlertCircle, CheckCircle2, Clock, FileText } from 'lucide-react';

interface Conta {
  id: string;
  fornecedor: string;
  categoria: string;
  vencimento: string;
  valor: number;
  status: 'pago' | 'pendente' | 'vencido';
}

const mockContas: Conta[] = [];

export const ContasPagar: React.FC = () => {
  const [contas, setContas] = useState<Conta[]>(mockContas);

  const totalPendente = contas.filter(c => c.status === 'pendente').reduce((acc, c) => acc + c.valor, 0);
  const totalVencido = contas.filter(c => c.status === 'vencido').reduce((acc, c) => acc + c.valor, 0);

  const marcarComoPago = (id: string) => {
    setContas(contas.map(c => c.id === id ? { ...c, status: 'pago' } : c));
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Gesto de Contas a Pagar</h1>
            <p className="text-xs text-slate-400">Controle financeiro de fornecedores e despesas operacionais</p>
          </div>
        </div>

        <button className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer">
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>Nova Conta</span>
        </button>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Contas Pendentes</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">R$ {totalPendente.toFixed(2)}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Contas Vencidas</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400">R$ {totalVencido.toFixed(2)}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Cadastrado</span>
            <FileText className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            R$ {contas.reduce((acc, c) => acc + c.valor, 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-6">Fornecedor / Descrio</th>
                <th className="py-3.5 px-6">Categoria</th>
                <th className="py-3.5 px-6">Vencimento</th>
                <th className="py-3.5 px-6">Valor (R$)</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Ao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm text-slate-200">
              {contas.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-4 px-6 font-medium text-white">{c.fornecedor}</td>
                  <td className="py-4 px-6 text-slate-400">{c.categoria}</td>
                  <td className="py-4 px-6 text-xs text-slate-400 flex items-center space-x-1 mt-2.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{c.vencimento}</span>
                  </td>
                  <td className="py-4 px-6 font-bold text-white">R$ {c.valor.toFixed(2)}</td>
                  <td className="py-4 px-6">
                    {c.status === 'pago' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Pago
                      </span>
                    )}
                    {c.status === 'pendente' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock className="w-3 h-3 mr-1" /> Pendente
                      </span>
                    )}
                    {c.status === 'vencido' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <AlertCircle className="w-3 h-3 mr-1" /> Vencido
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    {c.status !== 'pago' ? (
                      <button
                        onClick={() => marcarComoPago(c.id)}
                        className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/30 text-xs font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer"
                      >
                        Baixar Pago
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500 font-medium">Concluído</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
