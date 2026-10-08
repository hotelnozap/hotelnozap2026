import React, { useState, useEffect, useMemo } from 'react';
import { cuponsService, CupomDesconto } from '../services/cuponsService';
import { slugify } from './PaginaHotel';

interface CuponsHospedeProps {
  onNavigateBack?: () => void;
  onNavigateToCatalogo?: () => void;
  onNavigateToHotel?: (hotelSlugOrId: string, codigoCupom?: string, cupomObj?: CupomDesconto) => void;
}

export const CuponsHospede: React.FC<CuponsHospedeProps> = ({
  onNavigateBack,
  onNavigateToCatalogo,
  onNavigateToHotel
}) => {
  const [cupons, setCupons] = useState<CupomDesconto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filtroHotel, setFiltroHotel] = useState<string>('Todos');
  const [filtroTipo, setFiltroTipo] = useState<'Todos' | 'porcentagem' | 'fixo'>('Todos');
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      try {
        const dados = await cuponsService.getTodosCuponsPublicos();
        setCupons(dados);
      } catch (err) {
        console.error('Erro ao carregar cupons públicos:', err);
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, []);

  const handleCopiarCupom = (cupom: CupomDesconto) => {
    navigator.clipboard.writeText(cupom.codigo);
    setCopiadoId(cupom.id);
    setTimeout(() => setCopiadoId(null), 3000);
  };

  const listaHoteis = useMemo(() => {
    const set = new Set<string>();
    cupons.forEach(c => {
      if (c.hotel_nome) set.add(c.hotel_nome);
    });
    return Array.from(set);
  }, [cupons]);

  const cuponsFiltrados = useMemo(() => {
    return cupons.filter(c => {
      const matchBusca =
        c.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.hotel_nome && c.hotel_nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.hotel_cidade && c.hotel_cidade.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.descricao && c.descricao.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchHotel = filtroHotel === 'Todos' || c.hotel_nome === filtroHotel;
      const matchTipo = filtroTipo === 'Todos' || c.tipo_desconto === filtroTipo;
      return matchBusca && matchHotel && matchTipo;
    });
  }, [cupons, searchTerm, filtroHotel, filtroTipo]);

  const formatarDataBR = (dataStr?: string | null) => {
    if (!dataStr) return '-';
    try {
      const [ano, mes, dia] = dataStr.split('-');
      if (ano && mes && dia) return `${dia}/${mes}/${ano}`;
      return new Date(dataStr).toLocaleDateString('pt-BR');
    } catch {
      return dataStr;
    }
  };

  const gerarLinkHotel = (hotelNome?: string, codigoCupom?: string, hotelId?: string) => {
    if (!hotelNome && !hotelId) return '/hoteis';
    const slug = hotelNome ? slugify(hotelNome) : (hotelId ? slugify(hotelId) : 'hotel');
    return `/hoteis/${slug}${codigoCupom ? `?cupom=${encodeURIComponent(codigoCupom)}` : ''}`;
  };

  const handleUsarCupom = (e: React.MouseEvent, cupom: CupomDesconto) => {
    try {
      localStorage.setItem('hotelnozap_cupom_ativo', cupom.codigo);
    } catch {}

    // Se o usuário clicar com Ctrl, Cmd, Shift ou botão do meio, abre nativamente em nova guia
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
      return;
    }

    if (onNavigateToHotel && (cupom.hotel_id || cupom.hotel_nome)) {
      e.preventDefault();
      onNavigateToHotel(cupom.hotel_id || cupom.hotel_nome || '', cupom.codigo, cupom);
      return;
    }

    e.preventDefault();
    const link = gerarLinkHotel(cupom.hotel_nome, cupom.codigo, cupom.hotel_id);
    window.location.href = link;
  };

  return (
    <div className="space-y-5 max-w-6xl animate-in fade-in duration-200">
      {/* Cabeçalho da Aba */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="Voltar para a Visão Geral"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
            <span className="material-symbols-outlined text-2xl">confirmation_number</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 leading-tight">
                Cupons de Desconto
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-200">
                Ofertas da Rede
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Aproveite cupons promocionais exclusivos de todos os hotéis para economizar nas suas próximas reservas.
            </p>
          </div>
        </div>

        {onNavigateToCatalogo && (
          <button
            onClick={onNavigateToCatalogo}
            className="px-4 py-2 rounded-xl bg-[#003400] hover:bg-[#002600] text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-base">travel_explore</span>
            <span>Explorar Hotéis</span>
          </button>
        )}
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por hotel, código ou benefício..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro por Hotel */}
          <select
            value={filtroHotel}
            onChange={(e) => setFiltroHotel(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="Todos">Todos os Hotéis</option>
            {listaHoteis.map(h => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>

          {/* Filtro por Tipo */}
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as any)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="Todos">Todos os Descontos</option>
            <option value="porcentagem">Porcentagem (%)</option>
            <option value="fixo">Valor Fixo (R$)</option>
          </select>
        </div>
      </div>

      {/* Grid de Cupons Mais Compacta (3 colunas em telas médias/grandes) */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
          <span className="material-symbols-outlined text-3xl text-emerald-600 animate-spin">sync</span>
          <p className="text-xs text-slate-500">Buscando cupons disponíveis...</p>
        </div>
      ) : cuponsFiltrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">sentiment_dissatisfied</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Nenhum cupom encontrado</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {searchTerm || filtroHotel !== 'Todos' || filtroTipo !== 'Todos'
                ? 'Tente ajustar os filtros de busca para encontrar outros cupons ativos.'
                : 'Não há cupons ativos no momento. Fique atento às nossas próximas campanhas!'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {cuponsFiltrados.map((cupom) => {
            const isCopiado = copiadoId === cupom.id;
            const hotelLink = gerarLinkHotel(cupom.hotel_nome, cupom.codigo, cupom.hotel_id);

            return (
              <div
                key={cupom.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all p-3.5 sm:p-4 flex flex-col justify-between gap-3 relative overflow-hidden group"
              >
                {/* Linha decorativa de ticket */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-amber-100/40 to-transparent pointer-events-none rounded-bl-full" />

                <div className="space-y-2.5">
                  {/* Topo do Card: Nome do Hotel em destaque com LINK + Badge de Desconto */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <a
                        href={hotelLink}
                        onClick={(e) => handleUsarCupom(e, cupom)}
                        className="group/hotel flex items-center gap-1.5 text-sm sm:text-base font-black text-slate-900 hover:text-[#006c49] transition-colors leading-tight"
                        title={`Visitar página de ${cupom.hotel_nome || 'Hotel Parceiro'}`}
                      >
                        <span className="material-symbols-outlined text-base text-[#006c49] shrink-0">apartment</span>
                        <span className="truncate group-hover/hotel:underline">
                          {cupom.hotel_nome || 'Rede de Hotéis'}
                        </span>
                        <span className="material-symbols-outlined text-[13px] text-slate-400 group-hover/hotel:text-[#006c49] shrink-0">open_in_new</span>
                      </a>

                      {/* Nome da Cidade do Hotel */}
                      {cupom.hotel_cidade && (
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mt-0.5">
                          <span className="material-symbols-outlined text-xs text-rose-500 shrink-0">location_on</span>
                          <span className="truncate">{cupom.hotel_cidade}</span>
                        </div>
                      )}

                      <h3 className="text-xs sm:text-sm font-extrabold text-emerald-800 mt-1 leading-tight">
                        {cupom.tipo_desconto === 'porcentagem'
                          ? `${cupom.valor_desconto}% de Desconto`
                          : `R$ ${cupom.valor_desconto.toFixed(2).replace('.', ',')} de Desconto`}
                      </h3>
                    </div>

                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                      {cupom.tipo_desconto === 'porcentagem' ? `${cupom.valor_desconto}% OFF` : `R$ ${cupom.valor_desconto} OFF`}
                    </span>
                  </div>

                  {cupom.descricao && (
                    <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                      {cupom.descricao}
                    </p>
                  )}

                  {/* Informações de Regras Compactas */}
                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[10.5px] text-slate-500">
                    <div>
                      <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Reserva Mínima</span>
                      <span className="font-semibold text-slate-700">
                        {cupom.valor_minimo_reserva && cupom.valor_minimo_reserva > 0
                          ? `R$ ${cupom.valor_minimo_reserva.toFixed(2).replace('.', ',')}`
                          : 'Sem mínimo'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Válido Até</span>
                      <span className="font-semibold text-slate-700">
                        {!cupom.data_expiracao ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-xs">all_inclusive</span>
                            <span>Não expira</span>
                          </span>
                        ) : (
                          formatarDataBR(cupom.data_expiracao)
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Box do Código & Ações: Copiar + Link Direto para o Hotel */}
                <div className="pt-2.5 border-t border-dashed border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 flex items-center justify-between min-w-0">
                    <span className="font-mono font-black text-xs sm:text-sm text-slate-900 tracking-wider truncate">
                      {cupom.codigo}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopiarCupom(cupom)}
                      className={`text-[11px] font-bold px-2 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer shrink-0 ml-1 ${
                        isCopiado
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200'
                      }`}
                      title="Copiar código do cupom"
                    >
                      <span className="material-symbols-outlined text-xs">
                        {isCopiado ? 'check' : 'content_copy'}
                      </span>
                      <span>{isCopiado ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>

                  <a
                    href={hotelLink}
                    onClick={(e) => handleUsarCupom(e, cupom)}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#006c49] border border-emerald-200 text-[11px] font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer shadow-2xs hover:scale-102 active:scale-98"
                    title="Abrir página deste hotel já com este cupom ativado"
                  >
                    <span>Usar Cupom</span>
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default CuponsHospede;
