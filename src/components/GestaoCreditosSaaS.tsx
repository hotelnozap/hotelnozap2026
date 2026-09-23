import React, { useState, useEffect, useMemo } from 'react';
import { hoteisService } from '../services/supabaseService';
import { Hotel } from './CadastroHoteis';
import { creditosService, PACOTES_CREDITOS_MODELO_1, PacoteCredito, InfoCreditoHotel } from '../services/creditosService';

export interface GestaoCreditosSaaSProps {
  onBackToDashboard?: () => void;
  onNavigateToHotel?: (hotel: Hotel) => void;
}

export const GestaoCreditosSaaS: React.FC<GestaoCreditosSaaSProps> = ({
  onBackToDashboard,
  onNavigateToHotel
}) => {
  const [hoteis, setHoteis] = useState<Hotel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'degustacao' | 'alerta' | 'expirado'>('todos');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal de Recarga
  const [selectedHotelForRecharge, setSelectedHotelForRecharge] = useState<Hotel | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PacoteCredito>(PACOTES_CREDITOS_MODELO_1[0]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const carregarHoteis = async () => {
    setIsLoading(true);
    try {
      const data = await hoteisService.getHoteis();
      setHoteis(data || []);
    } catch (e) {
      console.error('Erro ao carregar hoteis para gestao de creditos:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarHoteis();

    const unsub = hoteisService.subscribeHoteis
      ? hoteisService.subscribeHoteis(() => carregarHoteis())
      : null;

    return () => {
      if (typeof unsub === 'function') (unsub as () => void)();
    };
  }, []);

  // Mapa de status de crédito por hotel
  const creditosMap = useMemo(() => {
    const map = new Map<string, InfoCreditoHotel>();
    hoteis.forEach(h => {
      map.set(h.id, creditosService.calcularInfoCreditos(h));
    });
    return map;
  }, [hoteis]);

  // Filtragem dos hotéis
  const filteredHoteis = useMemo(() => {
    return hoteis.filter(h => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q || h.name.toLowerCase().includes(q) || (h.cnpj || '').includes(q) || (h.managerName || '').toLowerCase().includes(q);
      
      const info = creditosMap.get(h.id);
      if (!info) return matchSearch;

      if (statusFilter === 'degustacao') return matchSearch && info.emDegustacao;
      if (statusFilter === 'alerta') return matchSearch && info.status === 'alerta';
      if (statusFilter === 'expirado') return matchSearch && info.status === 'expirado';

      return matchSearch;
    });
  }, [hoteis, searchTerm, statusFilter, creditosMap]);

  // Ação: Adicionar 15 dias de bônus cortesia
  const handleDarBonus = (hotel: Hotel) => {
    const novaInfo = creditosService.adicionarDiasBonus(hotel.id, 15);
    showToast(`+15 dias de bônus adicionados com sucesso ao "${hotel.name}"! Nova validade: ${novaInfo.dataExpiracaoFormatada}`);
    carregarHoteis();
  };

  // Ação: Confirmar Recarga do Pacote
  const handleConfirmarRecarga = () => {
    if (!selectedHotelForRecharge) return;
    const novaInfo = creditosService.recarregarPacote(selectedHotelForRecharge.id, selectedPackage);
    showToast(`Recarga de ${selectedPackage.nome} aplicada ao "${selectedHotelForRecharge.name}"! Saldo: ${novaInfo.saldoCreditos} créditos (${novaInfo.diasRestantes} dias restantes).`);
    setSelectedHotelForRecharge(null);
    carregarHoteis();
  };

  // Totalizadores
  const totalHoteisEmDegustacao = useMemo(() => {
    return Array.from(creditosMap.values()).filter(i => i.emDegustacao).length;
  }, [creditosMap]);

  const totalEmAlerta = useMemo(() => {
    return Array.from(creditosMap.values()).filter(i => i.status === 'alerta').length;
  }, [creditosMap]);

  const totalExpirados = useMemo(() => {
    return Array.from(creditosMap.values()).filter(i => i.status === 'expirado').length;
  }, [creditosMap]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#f8f9ff] overflow-y-auto">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200 border border-slate-800">
          <span className="material-symbols-outlined text-emerald-400 text-xl">verified</span>
          <span className="text-xs sm:text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-5 sticky top-0 z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Voltar ao Dashboard Master"
              >
                <span className="material-symbols-outlined text-2xl">arrow_back</span>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Créditos
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#003400] text-white uppercase tracking-wider">
                  Modelo 1 (Oficial)
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Gestão exclusiva de administradores para recargas de tempo de uso, controle de degustação e bonificações.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => carregarHoteis()}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <span className={`material-symbols-outlined text-base ${isLoading ? 'animate-spin' : ''}`}>sync</span>
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
        
        {/* BANNER DE REGRA: Degustação Sem Compromisso */}
        <div className="bg-gradient-to-r from-emerald-900 via-[#003400] to-emerald-950 rounded-2xl p-5 sm:p-6 text-white shadow-md border border-emerald-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-400/20 border border-emerald-300/40 flex items-center justify-center text-emerald-300 shrink-0">
              <span className="material-symbols-outlined text-2xl">card_giftcard</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-400/20 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider">
                  Regra Oficial para Novos Hotéis
                </span>
                <span className="text-xs text-emerald-200/80">Ativado Automaticamente</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white">
                30 Dias Base + 15 Dias de Bônus = 45 Dias Sem Compromisso
              </h3>
              <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed max-w-3xl">
                Todo novo hotel cadastrado no Hotel no Zap inicia automaticamente com <strong>1 Crédito</strong> e <strong>45 dias de acesso liberado</strong> para degustar todas as ferramentas (WhatsApp, Mapa de Quartos, Reservas e Catálogo) antes de qualquer cobrança.
              </p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-xl px-4 py-3 shrink-0 text-center w-full md:w-auto">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-300 block">Hotéis em Degustação</span>
            <span className="text-2xl font-black text-white">{totalHoteisEmDegustacao}</span>
          </div>
        </div>

        {/* TABELA OFICIAL DE PACOTES DE CRÉDITO (MODELO 1) */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-700">inventory_2</span>
                <span>Tabela Oficial de Pacotes de Créditos (Modelo 1)</span>
              </h2>
              <p className="text-xs text-slate-500">Cada crédito equivale a 30 dias de uso. Pacotes maiores recebem dias bônus progressivos.</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 w-fit">
              5 Pacotes Disponíveis
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {PACOTES_CREDITOS_MODELO_1.map((pkg, idx) => (
              <div 
                key={pkg.id} 
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  idx === 0 
                    ? 'border-emerald-300 bg-emerald-50/40' 
                    : idx === 4
                    ? 'border-amber-300 bg-amber-50/30'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                      {pkg.creditos} {pkg.creditos === 1 ? 'Crédito' : 'Créditos'}
                    </span>
                    {idx === 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-600 text-white uppercase">
                        Adesão
                      </span>
                    )}
                    {idx === 4 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-500 text-white uppercase">
                        Super Bônus
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">{pkg.nome}</h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{pkg.vantagem}</p>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 space-y-1.5">
                  <div className="text-xs text-slate-600 flex items-center justify-between">
                    <span>Base:</span>
                    <strong className="text-slate-800">{pkg.diasBase} dias</strong>
                  </div>
                  <div className="text-xs text-emerald-700 flex items-center justify-between font-semibold">
                    <span>Bônus:</span>
                    <span>+{pkg.diasBonus} dias</span>
                  </div>
                  <div className="text-xs font-black text-slate-900 flex items-center justify-between pt-1 border-t border-slate-100">
                    <span>Total Ativo:</span>
                    <span className="text-emerald-900 bg-emerald-100/70 px-2 py-0.5 rounded font-mono font-bold">
                      {pkg.totalDias} dias
                    </span>
                  </div>
                  <div className="pt-2 text-center">
                    <span className="text-base font-black text-slate-900">
                      R$ {pkg.preco.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MONITORAMENTO DE HOTÉIS & DIAS RESTANTES */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Header da Tabela com Filtros */}
          <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003400]">hotel</span>
                <span>Status de Validade &amp; Créditos dos Hotéis</span>
              </h3>
              <p className="text-xs text-slate-500">
                Monitore em tempo real o saldo de créditos e validade de cada hotel. Adicione bônus ou recargas com 1 clique.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Barra de Pesquisa */}
              <div className="relative min-w-[220px]">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar hotel, CNPJ ou gestor..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#003400] bg-slate-50"
                />
              </div>

              {/* Filtros Rápidos */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('todos')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    statusFilter === 'todos' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos ({hoteis.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('degustacao')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'degustacao' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Degustação ({totalHoteisEmDegustacao})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('alerta')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'alerta' ? 'bg-amber-500 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Acabando ({totalEmAlerta})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('expirado')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'expirado' ? 'bg-red-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Expirados ({totalExpirados})
                </button>
              </div>
            </div>
          </div>

          {/* Listagem em Tabela */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-extrabold tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Hotel / Pousada</th>
                  <th className="px-4 py-3.5">Plano Contratado</th>
                  <th className="px-4 py-3.5 text-center">Saldo Créditos</th>
                  <th className="px-4 py-3.5 text-center">Dias Restantes</th>
                  <th className="px-4 py-3.5 text-center">Expiração</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-right">Ações de Crédito (Admin)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-xl text-emerald-600">sync</span>
                        <span className="text-xs font-medium">Carregando situação dos hotéis...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredHoteis.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      Nenhum hotel encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredHoteis.map((hotel) => {
                    const info = creditosMap.get(hotel.id) || creditosService.calcularInfoCreditos(hotel);

                    return (
                      <tr key={hotel.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Identidade */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {hotel.imageUrl ? (
                                <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="material-symbols-outlined text-slate-400 text-base">hotel</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate max-w-[200px]" title={hotel.name}>
                                {hotel.name}
                              </span>
                              <span className="text-[11px] text-slate-500 truncate block">
                                {hotel.cityUf || 'Brasil'} • CNPJ: {hotel.cnpj || 'Não informado'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Plano */}
                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-slate-800 block text-xs">
                            {hotel.plan || 'Professional'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {hotel.capacity || 10} quartos
                          </span>
                        </td>

                        {/* Saldo de Créditos */}
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-black text-xs border border-emerald-200/60">
                            <span className="material-symbols-outlined text-sm text-emerald-600">toll</span>
                            {info.saldoCreditos} {info.saldoCreditos === 1 ? 'crédito' : 'créditos'}
                          </span>
                        </td>

                        {/* Dias Restantes */}
                        <td className="px-4 py-3.5 text-center">
                          <span 
                            className={`inline-block px-3 py-1 rounded-full text-xs font-black ${
                              info.status === 'expirado'
                                ? 'bg-red-100 text-red-700'
                                : info.status === 'alerta'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {info.diasRestantes > 0 ? `${info.diasRestantes} dias` : 'Expirado'}
                          </span>
                        </td>

                        {/* Data de Expiração */}
                        <td className="px-4 py-3.5 text-center">
                          <span className="font-mono text-xs text-slate-700 font-semibold block">
                            {info.dataExpiracaoFormatada}
                          </span>
                        </td>

                        {/* Status / Degustação */}
                        <td className="px-4 py-3.5 text-center">
                          {info.emDegustacao ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                              <span className="material-symbols-outlined text-xs">card_giftcard</span>
                              Degustação
                            </span>
                          ) : info.status === 'ativo' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              Ativo
                            </span>
                          ) : info.status === 'alerta' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                              Reta Final
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                              Expirado
                            </span>
                          )}
                        </td>

                        {/* Botões de Ação */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Dar +15 dias bônus imediato */}
                            <button
                              type="button"
                              onClick={() => handleDarBonus(hotel)}
                              title="Conceder +15 dias de bônus imediato a este hotel"
                              className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                            >
                              <span className="material-symbols-outlined text-sm">add_circle</span>
                              <span>+15d Bônus</span>
                            </button>

                            {/* Recarregar com Pacote */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedHotelForRecharge(hotel);
                                setSelectedPackage(PACOTES_CREDITOS_MODELO_1[0]);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#003400] hover:bg-[#002500] text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1 active:scale-95"
                            >
                              <span className="material-symbols-outlined text-sm">replay</span>
                              <span>Recarregar</span>
                            </button>

                            {/* Acessar Hotel */}
                            {onNavigateToHotel && (
                              <button
                                type="button"
                                onClick={() => onNavigateToHotel(hotel)}
                                title="Acessar painel deste hotel"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-base">login</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL DE RECARGA DE CRÉDITOS (ADMINISTRADOR) */}
      {selectedHotelForRecharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">toll</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Recarga de Créditos (Modelo 1)
                  </h3>
                  <p className="text-xs text-slate-500 truncate max-w-[280px]">
                    Hotel: <strong>{selectedHotelForRecharge.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHotelForRecharge(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Selecione o Pacote de Créditos Desejado:
              </label>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {PACOTES_CREDITOS_MODELO_1.map((p) => {
                  const isSelected = selectedPackage.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPackage(p)}
                      className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected 
                          ? 'border-[#003400] bg-emerald-50/50 shadow-xs' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`material-symbols-outlined text-xl ${isSelected ? 'text-[#003400]' : 'text-slate-300'}`}>
                          {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900 text-sm block">{p.nome}</span>
                          <span className="text-xs text-slate-500">
                            {p.diasBase} dias base <strong className="text-emerald-700">+ {p.diasBonus} dias bônus</strong> = <strong>{p.totalDias} dias ativos</strong>
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-black text-slate-900 block">R$ {p.preco.toFixed(2).replace('.', ',')}</span>
                        <span className="text-[10px] text-slate-400">{p.creditos} {p.creditos === 1 ? 'crédito' : 'créditos'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resumo da Ação */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <span>Total a ser somado ao hotel:</span>
              <span className="font-extrabold text-emerald-900 text-sm">+ {selectedPackage.totalDias} dias ativos</span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedHotelForRecharge(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmarRecarga}
                className="px-5 py-2 rounded-xl bg-[#003400] hover:bg-[#002500] text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer active:scale-95 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">check</span>
                <span>Confirmar Recarga</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
