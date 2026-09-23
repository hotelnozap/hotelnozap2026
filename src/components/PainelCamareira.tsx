import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { quartosService, currentHotelService, reservasService, HotelAtivo, usuariosService } from '../services/supabaseService';

export interface RoomHousekeeping {
  id: string;
  number: string;
  category: string;
  floor: string;
  status: 'livre' | 'ocupado' | 'limpeza' | 'manutencao';
  hkStatus: 'checkout' | 'em_limpeza' | 'ocupado_estadia' | 'inspecao' | 'manutencao' | 'pronto';
  guestName?: string;
  tempoEstimado?: number; // minutos
  tempoDecorrido?: number; // minutos
  progressoHigienizacao?: number; // 0-100%
  enxoval?: string;
  frigobarConsumos?: number;
  proximoHospedePrevisao?: string;
  recadoHospede?: string;
  tipoArrumacao?: string;
  agendadoHorario?: string;
  limpoPor?: string;
  terminoHorario?: string;
  ocorrenciaNumero?: string;
  ocorrenciaDescricao?: string;
  ocorrenciaStatus?: string;
  concluidoHorario?: string;
  checklist: { id: string; label: string; checked: boolean }[];
}

export interface PainelCamareiraProps {
  onNavigateBack?: () => void;
  onLogout?: () => void;
  currentUserRole?: string;
  activeHotel?: HotelAtivo | null;
}

export interface RegistroQuartoLimpo {
  id: string;
  quartoId: string;
  numero: string;
  categoria: string;
  andar: string;
  limpoPor: string;
  horarioConclusao: string;
  dataConclusao: string; // YYYY-MM-DD
  dataHoraFormatada: string;
  tempoGastoMinutos: number;
  tipoArrumacao: string;
  hotelId: string;
  checklistConcluido?: boolean;
}

export const getTodayYmd = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getYesterdayYmd = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDatePtBr = (ymd: string) => {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
};

// Paleta de cores suaves e distintas para que cada card tenha um fundo diferente
export const CARD_COLOR_THEMES = [
  // 0. Verde Menta / Esmeralda Suave
  {
    bg: 'bg-[#f0fdf4]',
    border: 'border-emerald-300/80',
    hoverBorder: 'hover:border-emerald-500',
    innerBg: 'bg-white/85',
    innerBorder: 'border-emerald-100',
    tagBg: 'bg-emerald-100/90 text-emerald-800 border-emerald-300',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    btnBg: 'bg-emerald-100/90 hover:bg-emerald-200 text-emerald-900',
    iconColor: 'text-emerald-600',
    accentText: 'text-emerald-700',
    checklistBg: 'bg-emerald-100/80 text-emerald-800 border-emerald-300/80',
    checkPill: 'bg-emerald-600 text-white'
  },
  // 1. Azul Céu / Oceano Suave
  {
    bg: 'bg-[#f0f9ff]',
    border: 'border-sky-300/80',
    hoverBorder: 'hover:border-sky-500',
    innerBg: 'bg-white/85',
    innerBorder: 'border-sky-100',
    tagBg: 'bg-sky-100/90 text-sky-800 border-sky-300',
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-300',
    btnBg: 'bg-sky-100/90 hover:bg-sky-200 text-sky-900',
    iconColor: 'text-sky-600',
    accentText: 'text-sky-700',
    checklistBg: 'bg-sky-100/80 text-sky-800 border-sky-300/80',
    checkPill: 'bg-sky-600 text-white'
  },
  // 2. Âmbar / Baunilha Dourada
  {
    bg: 'bg-[#fffbeb]',
    border: 'border-amber-300/80',
    hoverBorder: 'hover:border-amber-500',
    innerBg: 'bg-white/85',
    innerBorder: 'border-amber-100',
    tagBg: 'bg-amber-100/90 text-amber-900 border-amber-300',
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
    btnBg: 'bg-amber-100/90 hover:bg-amber-200 text-amber-950',
    iconColor: 'text-amber-600',
    accentText: 'text-amber-800',
    checklistBg: 'bg-amber-100/80 text-amber-900 border-amber-300/80',
    checkPill: 'bg-amber-600 text-white'
  },
  // 3. Lavanda / Violeta Suave
  {
    bg: 'bg-[#faf5ff]',
    border: 'border-purple-300/80',
    hoverBorder: 'hover:border-purple-500',
    innerBg: 'bg-white/85',
    innerBorder: 'border-purple-100',
    tagBg: 'bg-purple-100/90 text-purple-800 border-purple-300',
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-300',
    btnBg: 'bg-purple-100/90 hover:bg-purple-200 text-purple-900',
    iconColor: 'text-purple-600',
    accentText: 'text-purple-700',
    checklistBg: 'bg-purple-100/80 text-purple-800 border-purple-300/80',
    checkPill: 'bg-purple-600 text-white'
  },
  // 4. Rosa Coral / Framboesa Suave
  {
    bg: 'bg-[#fff1f2]',
    border: 'border-rose-300/80',
    hoverBorder: 'hover:border-rose-500',
    innerBg: 'bg-white/85',
    innerBorder: 'border-rose-100',
    tagBg: 'bg-rose-100/90 text-rose-800 border-rose-300',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
    btnBg: 'bg-rose-100/90 hover:bg-rose-200 text-rose-900',
    iconColor: 'text-rose-600',
    accentText: 'text-rose-700',
    checklistBg: 'bg-rose-100/80 text-rose-800 border-rose-300/80',
    checkPill: 'bg-rose-600 text-white'
  },
  // 5. Índigo Suave
  {
    bg: 'bg-[#eef2ff]',
    border: 'border-indigo-300/80',
    hoverBorder: 'hover:border-indigo-500',
    innerBg: 'bg-white/85',
    innerBorder: 'border-indigo-100',
    tagBg: 'bg-indigo-100/90 text-indigo-800 border-indigo-300',
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    btnBg: 'bg-indigo-100/90 hover:bg-indigo-200 text-indigo-900',
    iconColor: 'text-indigo-600',
    accentText: 'text-indigo-700',
    checklistBg: 'bg-indigo-100/80 text-indigo-800 border-indigo-300/80',
    checkPill: 'bg-indigo-600 text-white'
  },
  // 6. Verde Água / Teal Suave
  {
    bg: 'bg-[#f0fdfa]',
    border: 'border-teal-300/80',
    hoverBorder: 'hover:border-teal-500',
    innerBg: 'bg-white/85',
    innerBorder: 'border-teal-100',
    tagBg: 'bg-teal-100/90 text-teal-800 border-teal-300',
    badgeBg: 'bg-teal-100 text-teal-800 border-teal-300',
    btnBg: 'bg-teal-100/90 hover:bg-teal-200 text-teal-900',
    iconColor: 'text-teal-600',
    accentText: 'text-teal-700',
    checklistBg: 'bg-teal-100/80 text-teal-800 border-teal-300/80',
    checkPill: 'bg-teal-600 text-white'
  },
  // 7. Laranja Pêssego Suave
  {
    bg: 'bg-[#fff7ed]',
    border: 'border-orange-300/80',
    hoverBorder: 'hover:border-orange-500',
    innerBg: 'bg-white/85',
    innerBorder: 'border-orange-100',
    tagBg: 'bg-orange-100/90 text-orange-900 border-orange-300',
    badgeBg: 'bg-orange-100 text-orange-900 border-orange-300',
    btnBg: 'bg-orange-100/90 hover:bg-orange-200 text-orange-950',
    iconColor: 'text-orange-600',
    accentText: 'text-orange-800',
    checklistBg: 'bg-orange-100/80 text-orange-900 border-orange-300/80',
    checkPill: 'bg-orange-600 text-white'
  },
  // 8. Ciano Turquesa Suave
  {
    bg: 'bg-[#ecfeff]',
    border: 'border-cyan-300/80',
    hoverBorder: 'hover:border-cyan-500',
    innerBg: 'bg-white/85',
    innerBorder: 'border-cyan-100',
    tagBg: 'bg-cyan-100/90 text-cyan-800 border-cyan-300',
    badgeBg: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    btnBg: 'bg-cyan-100/90 hover:bg-cyan-200 text-cyan-900',
    iconColor: 'text-cyan-600',
    accentText: 'text-cyan-700',
    checklistBg: 'bg-cyan-100/80 text-cyan-800 border-cyan-300/80',
    checkPill: 'bg-cyan-600 text-white'
  },
  // 9. Limão Citrus Suave
  {
    bg: 'bg-[#f7fee7]',
    border: 'border-lime-300/80',
    hoverBorder: 'hover:border-lime-500',
    innerBg: 'bg-white/85',
    innerBorder: 'border-lime-100',
    tagBg: 'bg-lime-100/90 text-lime-900 border-lime-300',
    badgeBg: 'bg-lime-100 text-lime-900 border-lime-300',
    btnBg: 'bg-lime-100/90 hover:bg-lime-200 text-lime-950',
    iconColor: 'text-lime-600',
    accentText: 'text-lime-800',
    checklistBg: 'bg-lime-100/80 text-lime-900 border-lime-300/80',
    checkPill: 'bg-lime-600 text-white'
  },
  // 10. Fúcsia Orquídea Suave
  {
    bg: 'bg-[#fdf4ff]',
    border: 'border-fuchsia-300/80',
    hoverBorder: 'hover:border-fuchsia-500',
    innerBg: 'bg-white/85',
    innerBorder: 'border-fuchsia-100',
    tagBg: 'bg-fuchsia-100/90 text-fuchsia-800 border-fuchsia-300',
    badgeBg: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
    btnBg: 'bg-fuchsia-100/90 hover:bg-fuchsia-200 text-fuchsia-900',
    iconColor: 'text-fuchsia-600',
    accentText: 'text-fuchsia-700',
    checklistBg: 'bg-fuchsia-100/80 text-fuchsia-800 border-fuchsia-300/80',
    checkPill: 'bg-fuchsia-600 text-white'
  },
  // 11. Gelo / Ardósia Suave
  {
    bg: 'bg-[#f8fafc]',
    border: 'border-slate-300',
    hoverBorder: 'hover:border-slate-500',
    innerBg: 'bg-white',
    innerBorder: 'border-slate-200',
    tagBg: 'bg-slate-200/90 text-slate-800 border-slate-300',
    badgeBg: 'bg-slate-200 text-slate-800 border-slate-300',
    btnBg: 'bg-slate-200/90 hover:bg-slate-300 text-slate-900',
    iconColor: 'text-slate-600',
    accentText: 'text-slate-700',
    checklistBg: 'bg-slate-200/80 text-slate-800 border-slate-300',
    checkPill: 'bg-slate-700 text-white'
  }
];

// Som de sucesso ao liberar quarto
const playChimeSuccess = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.3); // C6
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  } catch {}
};

// Som de alerta quando a recepção altera o status do quarto para limpeza em tempo real
const playChimeAlert = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  } catch {}
};

export const PainelCamareira: React.FC<PainelCamareiraProps> = ({
  onNavigateBack,
  onLogout,
  currentUserRole = '',
  activeHotel
}) => {
  const [rooms, setRooms] = useState<RoomHousekeeping[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'todos' | 'checkout' | 'em_limpeza' | 'inspecao' | 'prontos'>('todos');
  const [activeMobileTab, setActiveMobileTab] = useState<'quartos' | 'ocorrencias' | 'frigobar' | 'perfil'>('quartos');
  const [emServico, setEmServico] = useState<boolean>(true);

  // Navegação entre Tela de Quartos Pendentes e Tela de Quartos Limpos (com datas)
  const [currentView, setCurrentView] = useState<'painel_quartos' | 'quartos_limpos'>('painel_quartos');
  const [cleanedHistory, setCleanedHistory] = useState<RegistroQuartoLimpo[]>([]);
  const [cleanDateFilterMode, setCleanDateFilterMode] = useState<'hoje' | 'ontem' | 'ultimos7' | 'custom' | 'todas'>('hoje');
  const [selectedCustomDate, setSelectedCustomDate] = useState<string>(getTodayYmd());
  const [cleanSearchQuery, setCleanSearchQuery] = useState<string>('');

  // Modais State
  const [modalRelatarManutencaoOpen, setModalRelatarManutencaoOpen] = useState<boolean>(false);
  const [modalInspecaoRoom, setModalInspecaoRoom] = useState<RoomHousekeeping | null>(null);
  const [modalOcorrenciaRoom, setModalOcorrenciaRoom] = useState<RoomHousekeeping | null>(null);
  const [modalFrigobarRoom, setModalFrigobarRoom] = useState<RoomHousekeeping | null>(null);
  const [modalInfoRoom, setModalInfoRoom] = useState<RoomHousekeeping | null>(null);
  const [modalEscalaOpen, setModalEscalaOpen] = useState<boolean>(false);

  // Form de Manutenção
  const [manutQuartoId, setManutQuartoId] = useState<string>('');
  const [manutTipo, setManutTipo] = useState<string>('Ar Condicionado');
  const [manutPrioridade, setManutPrioridade] = useState<'Baixa' | 'Média' | 'Alta' | 'Urgente'>('Alta');
  const [manutDescricao, setManutDescricao] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Usuário e Hotel Reais Identificados
  const [loggedUser, setLoggedUser] = useState<{
    id: string;
    nome: string;
    email: string;
    cargo: string;
    perfil: string;
    hotel_id?: string | null;
    url_avatar?: string | null;
    iniciais: string;
  }>(() => {
    const cachedName = localStorage.getItem('hotelnozap_user_name') || 'Colaboradora';
    const parts = cachedName.trim().split(/\s+/);
    const ini = (parts[0]?.[0] || 'C') + (parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] || 'M')).toUpperCase();
    return {
      id: '',
      nome: cachedName,
      email: localStorage.getItem('hotelnozap_user_email') || '',
      cargo: localStorage.getItem('hotelnozap_user_cargo') || 'Camareira',
      perfil: localStorage.getItem('hotelnozap_user_role') || currentUserRole || 'Camareira',
      hotel_id: null,
      url_avatar: null,
      iniciais: ini
    };
  });

  const [hotelInfo, setHotelInfo] = useState<{
    id: string;
    nome: string;
    cidade?: string;
    estado?: string;
  }>(() => {
    const curr = currentHotelService.getCurrentHotel();
    return {
      id: activeHotel?.id || curr.id,
      nome: activeHotel?.name || curr.name || 'Hotel'
    };
  });

  // Carregar dados reais do usuário logado, seu hotel e seus quartos
  const loadRealData = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }

      // 1. Identificar e-mail da sessão Supabase Auth ou localStorage
      let userEmail = localStorage.getItem('hotelnozap_user_email') || '';
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user?.email) {
          userEmail = sessionData.session.user.email;
          localStorage.setItem('hotelnozap_user_email', userEmail);
        }
      } catch (e) {
        console.warn('Erro ao obter sessão auth na camareira:', e);
      }

      // 2. Buscar perfil completo na tabela usuarios
      let dbUser: any = null;
      if (userEmail) {
        const { data } = await supabase
          .from('usuarios')
          .select('id, nome, email, perfil, cargo, hotel_id, url_avatar')
          .eq('email', userEmail)
          .maybeSingle();
        dbUser = data;
        usuariosService.registrarUltimoAcesso(userEmail);
      }

      const nomeFinal = dbUser?.nome || localStorage.getItem('hotelnozap_user_name') || 'Camareira';
      const cargoFinal = dbUser?.cargo || localStorage.getItem('hotelnozap_user_cargo') || 'Camareira';
      const perfilFinal = dbUser?.perfil || localStorage.getItem('hotelnozap_user_role') || currentUserRole || 'Camareira';
      const avatarFinal = dbUser?.url_avatar || null;
      const hotelIdFromUser = dbUser?.hotel_id;

      const parts = nomeFinal.trim().split(/\s+/);
      const iniciais = (parts[0]?.[0] || 'C') + (parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] || 'M')).toUpperCase();

      setLoggedUser(prev => {
        if (
          prev.id === (dbUser?.id || '') &&
          prev.nome === nomeFinal &&
          prev.cargo === cargoFinal &&
          prev.perfil === perfilFinal &&
          prev.hotel_id === hotelIdFromUser &&
          prev.url_avatar === avatarFinal &&
          prev.iniciais === iniciais
        ) {
          return prev;
        }
        return {
          id: dbUser?.id || '',
          nome: nomeFinal,
          email: userEmail,
          cargo: cargoFinal,
          perfil: perfilFinal,
          hotel_id: hotelIdFromUser,
          url_avatar: avatarFinal,
          iniciais
        };
      });

      localStorage.setItem('hotelnozap_user_name', nomeFinal);
      localStorage.setItem('hotelnozap_user_cargo', cargoFinal);
      localStorage.setItem('hotelnozap_user_role', perfilFinal);

      // 3. Determinar o hotel efetivo do colaborador
      const currentActive = currentHotelService.getCurrentHotel();
      let effectiveHotelId = hotelIdFromUser || activeHotel?.id || currentActive.id;
      let hotelNomeFinal = activeHotel?.name || currentActive.name;

      // Se o usuário tem hotel_id e for diferente do atual, sincroniza uma única vez
      if (hotelIdFromUser && currentActive.id !== hotelIdFromUser) {
        const { data: hData } = await supabase
          .from('hoteis')
          .select('*')
          .eq('id', hotelIdFromUser)
          .maybeSingle();

        if (hData) {
          hotelNomeFinal = hData.nome;
          effectiveHotelId = hData.id;
          const freshActive: HotelAtivo = {
            id: hData.id,
            name: hData.nome,
            category: 'Hotel',
            cityUf: `${hData.cidade || ''} / ${hData.estado || ''}`.trim(),
            city: hData.cidade || '',
            uf: hData.estado || '',
            cnpj: hData.cnpj || '',
            status: 'ativo',
            imageUrl: hData.banner_url || hData.logo_url || ''
          };
          currentHotelService.setCurrentHotel(freshActive);
        }
      }

      setHotelInfo(prev => {
        if (prev.id === effectiveHotelId && prev.nome === hotelNomeFinal) {
          return prev;
        }
        return {
          id: effectiveHotelId,
          nome: hotelNomeFinal
        };
      });

      // 4. Buscar quartos e reservas REAIS pertencentes a este hotel
      const [dbQuartos, dbReservas] = await Promise.all([
        quartosService.getQuartos(effectiveHotelId),
        reservasService.getReservas(effectiveHotelId).catch(() => [])
      ]);

      // Carregar cache local de housekeeping de progresso em tempo real
      const storageKey = `hotelnozap_camareira_dados_${effectiveHotelId}`;
      const savedHkRaw = localStorage.getItem(storageKey) || localStorage.getItem('hotelnozap_camareira_dados');
      const savedHk: Record<string, Partial<RoomHousekeeping>> = savedHkRaw ? JSON.parse(savedHkRaw) : {};

      if (dbQuartos && dbQuartos.length > 0) {
        const mapped: RoomHousekeeping[] = dbQuartos.map((q: any, idx: number) => {
          const s = savedHk[q.id] || {};
          
          // Buscar reserva vinculada para exibir dados reais do hóspede
          const res: any = (dbReservas || []).find((r: any) => 
            String(r.quarto_id) === String(q.id) || 
            String(r.numero_quarto) === String(q.numero || q.number)
          );

          // Inferir status de governança
          let inferredHkStatus: RoomHousekeeping['hkStatus'] = 'pronto';
          if (q.status === 'limpeza') {
            inferredHkStatus = s.hkStatus === 'em_limpeza' ? 'em_limpeza' : s.hkStatus === 'inspecao' ? 'inspecao' : 'checkout';
          } else if (q.status === 'ocupado') {
            inferredHkStatus = 'ocupado_estadia';
          } else if (q.status === 'manutencao') {
            inferredHkStatus = 'manutencao';
          } else if (q.status === 'livre') {
            inferredHkStatus = 'pronto';
          }

          // Andar formatado amigável
          let floorDisplay = q.floor || q.andar || '';
          if (!floorDisplay || floorDisplay === '0') {
            floorDisplay = 'Térreo';
          } else if (!floorDisplay.toLowerCase().includes('andar') && !floorDisplay.toLowerCase().includes('térreo')) {
            floorDisplay = `${floorDisplay}º Andar`;
          }

          const guestName = res?.hospedeNome || res?.nome_hospede || q.guestName || (q as any).hospede_atual || '';

          return {
            id: q.id,
            number: String(q.number || q.numero || 100 + idx + 1),
            category: q.category || q.categoria || q.tipo || 'Standard',
            floor: floorDisplay,
            status: q.status || 'livre',
            hkStatus: inferredHkStatus,
            guestName: guestName,
            tempoEstimado: s.tempoEstimado || 30,
            tempoDecorrido: s.tempoDecorrido || (inferredHkStatus === 'em_limpeza' ? 15 : 0),
            progressoHigienizacao: s.progressoHigienizacao !== undefined ? s.progressoHigienizacao : (inferredHkStatus === 'em_limpeza' ? 50 : inferredHkStatus === 'pronto' ? 100 : 0),
            enxoval: s.enxoval || (q.tipo?.toLowerCase().includes('casal') ? 'Troca Completa Casal + 2 Toalhas' : 'Troca Completa Solteiro + Toalhas'),
            frigobarConsumos: s.frigobarConsumos !== undefined ? s.frigobarConsumos : 0,
            proximoHospedePrevisao: s.proximoHospedePrevisao || (inferredHkStatus === 'checkout' ? (res?.checkIn ? `Check-in: ${res.checkIn}` : res?.data_checkin ? `Check-in: ${res.data_checkin}` : 'Check-in previsto para às 14:00') : undefined),
            recadoHospede: s.recadoHospede || (res?.observacao || res?.observacoes ? (res?.observacao || res?.observacoes) : (inferredHkStatus === 'ocupado_estadia' ? 'Favor arrumar o quarto após o almoço.' : undefined)),
            tipoArrumacao: s.tipoArrumacao || (inferredHkStatus === 'checkout' ? 'Higienização Completa' : 'Arrumação Diária'),
            agendadoHorario: s.agendadoHorario || '',
            limpoPor: s.limpoPor || nomeFinal,
            terminoHorario: s.terminoHorario || '',
            ocorrenciaNumero: s.ocorrenciaNumero,
            ocorrenciaDescricao: s.ocorrenciaDescricao,
            ocorrenciaStatus: s.ocorrenciaStatus,
            concluidoHorario: s.concluidoHorario,
            checklist: s.checklist || [
              { id: '1', label: 'Troca e alinhamento de enxoval', checked: inferredHkStatus === 'em_limpeza' || inferredHkStatus === 'inspecao' || inferredHkStatus === 'pronto' },
              { id: '2', label: 'Higienização e desinfecção do banheiro', checked: inferredHkStatus === 'em_limpeza' || inferredHkStatus === 'inspecao' || inferredHkStatus === 'pronto' },
              { id: '3', label: 'Reposição de amenities e toalhas', checked: inferredHkStatus === 'inspecao' || inferredHkStatus === 'pronto' },
              { id: '4', label: 'Limpeza e aspiração do piso', checked: inferredHkStatus === 'inspecao' || inferredHkStatus === 'pronto' },
              { id: '5', label: 'Conferência do frigobar e suprimentos', checked: inferredHkStatus === 'pronto' }
            ]
          };
        });

        setRooms(mapped);

        // Carregar e sincronizar histórico de quartos limpos para este hotel
        try {
          const histKey = `hotelnozap_historico_limpeza_${effectiveHotelId}`;
          const rawHist = localStorage.getItem(histKey);
          let loadedHist: RegistroQuartoLimpo[] = [];
          if (rawHist) {
            loadedHist = JSON.parse(rawHist);
          }

          const todayYmd = getTodayYmd();
          const yesterdayYmd = getYesterdayYmd();

          // Se histórico estiver vazio, popula com os quartos livres atuais de hoje e alguns registros de ontem
          if (loadedHist.length === 0 && dbQuartos && dbQuartos.length > 0) {
            const initialList: RegistroQuartoLimpo[] = [];
            const livres = dbQuartos.filter((q: any) => q.status === 'livre');
            livres.forEach((q: any, idx: number) => {
              initialList.push({
                id: `limpo_${q.id}_today`,
                quartoId: q.id,
                numero: String(q.numero || q.number || 101 + idx),
                categoria: q.categoria || q.category || q.tipo || 'Standard',
                andar: `${q.andar || (idx % 2 === 0 ? '1º Andar' : '2º Andar')}`,
                limpoPor: nomeFinal,
                horarioConclusao: idx === 0 ? '11:40' : '13:15',
                dataConclusao: todayYmd,
                dataHoraFormatada: `${formatDatePtBr(todayYmd)} às ${idx === 0 ? '11:40' : '13:15'}`,
                tempoGastoMinutos: 25 + idx * 5,
                tipoArrumacao: 'Higienização Completa',
                hotelId: effectiveHotelId,
                checklistConcluido: true
              });
            });

            // Amostra de ontem para permitir teste imediato da navegação de datas
            const sampleOntem = dbQuartos.slice(0, 2);
            sampleOntem.forEach((q: any, idx: number) => {
              initialList.push({
                id: `limpo_${q.id}_ontem`,
                quartoId: q.id,
                numero: String(q.numero || q.number || 201 + idx),
                categoria: q.categoria || q.category || q.tipo || 'Standard',
                andar: '1º Andar',
                limpoPor: nomeFinal,
                horarioConclusao: idx === 0 ? '10:30' : '15:10',
                dataConclusao: yesterdayYmd,
                dataHoraFormatada: `${formatDatePtBr(yesterdayYmd)} às ${idx === 0 ? '10:30' : '15:10'}`,
                tempoGastoMinutos: 28,
                tipoArrumacao: 'Higienização Completa',
                hotelId: effectiveHotelId,
                checklistConcluido: true
              });
            });

            loadedHist = initialList;
            localStorage.setItem(histKey, JSON.stringify(initialList));
          } else if (dbQuartos && dbQuartos.length > 0) {
            // Garante que qualquer quarto livre retornado do banco conste no histórico de hoje
            const livres = dbQuartos.filter((q: any) => q.status === 'livre');
            let hasNew = false;
            livres.forEach((q: any) => {
              const exists = loadedHist.some(h => (h.quartoId === q.id || h.numero === String(q.numero || q.number)) && h.dataConclusao === todayYmd);
              if (!exists) {
                loadedHist.unshift({
                  id: `limpo_${q.id}_${Date.now()}`,
                  quartoId: q.id,
                  numero: String(q.numero || q.number || '101'),
                  categoria: q.categoria || q.category || q.tipo || 'Standard',
                  andar: `${q.andar || '1º Andar'}`,
                  limpoPor: nomeFinal,
                  horarioConclusao: '12:00',
                  dataConclusao: todayYmd,
                  dataHoraFormatada: `${formatDatePtBr(todayYmd)} às 12:00`,
                  tempoGastoMinutos: 25,
                  tipoArrumacao: 'Higienização Completa',
                  hotelId: effectiveHotelId,
                  checklistConcluido: true
                });
                hasNew = true;
              }
            });
            if (hasNew) {
              localStorage.setItem(histKey, JSON.stringify(loadedHist));
            }
          }

          setCleanedHistory(loadedHist);
        } catch (errHist) {
          console.warn('Erro ao carregar histórico de limpeza:', errHist);
        }
      } else {
        // Hotel não tem quartos cadastrados ainda: manter vazio sem injetar dados fictícios
        setRooms([]);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados reais na camareira:', err);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [activeHotel?.id, currentUserRole]);

  useEffect(() => {
    // Carga inicial
    loadRealData(false);

    // Inscrição em tempo real no Supabase (WebSocket bidirecional entre Hotel e Camareiras)
    const unsubscribeQuartos = quartosService.subscribeQuartos((detail) => {
      if (detail && (detail.numero || detail.quartoId)) {
        const cleanNum = String(detail.numero || '').replace(/\D/g, '');
        const targetId = detail.quartoId;
        const newStatus = detail.status || 'limpeza';

        // Atualização otimista e imediata no estado visual dos quartos da camareira
        setRooms(prevRooms => prevRooms.map(r => {
          const rNum = String(r.number || '').replace(/\D/g, '');
          if ((cleanNum && rNum === cleanNum) || (targetId && r.id === targetId)) {
            let nextHk: RoomHousekeeping['hkStatus'] = r.hkStatus;
            if (newStatus === 'limpeza') {
              nextHk = 'checkout';
            } else if (newStatus === 'livre') {
              nextHk = 'pronto';
            } else if (newStatus === 'ocupado') {
              nextHk = 'ocupado_estadia';
            } else if (newStatus === 'manutencao') {
              nextHk = 'manutencao';
            }
            return {
              ...r,
              status: newStatus as any,
              hkStatus: nextHk,
              guestName: detail.hospede_atual !== undefined ? (detail.hospede_atual || '') : r.guestName
            };
          }
          return r;
        }));

        // Notificações sonoras e visuais para a camareira
        if (newStatus === 'limpeza') {
          playChimeAlert();
          showToast(`🧹 Quarto ${detail.numero || cleanNum} colocado em LIMPEZA pela Recepção!`);
        } else if (newStatus === 'ocupado') {
          showToast(`🔑 Quarto ${detail.numero || cleanNum} ocupado (Check-in realizado).`);
        } else if (newStatus === 'livre') {
          showToast(`✨ Quarto ${detail.numero || cleanNum} liberado no sistema.`);
        }
      }
      loadRealData(true);
    });

    // Sincronização ao reativar a tela do celular (quando a camareira desbloqueia o aparelho)
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadRealData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    // Polling heartbeat leve a cada 7 segundos (garante sync mesmo em redes móveis instáveis)
    const heartbeatInterval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadRealData(true);
      }
    }, 7000);

    const handleHotelChanged = (e: any) => {
      const newId = e?.detail?.id;
      if (newId && newId !== hotelInfo.id) {
        loadRealData(false);
      }
    };
    window.addEventListener('hotel_changed', handleHotelChanged);

    return () => {
      unsubscribeQuartos();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      clearInterval(heartbeatInterval);
      window.removeEventListener('hotel_changed', handleHotelChanged);
    };
  }, [loadRealData, hotelInfo.id]);

  // Salvar estado de housekeeping
  const persistHousekeeping = (updatedRooms: RoomHousekeeping[]) => {
    try {
      const cacheMap: Record<string, Partial<RoomHousekeeping>> = {};
      updatedRooms.forEach(r => {
        cacheMap[r.id] = {
          hkStatus: r.hkStatus,
          tempoEstimado: r.tempoEstimado,
          tempoDecorrido: r.tempoDecorrido,
          progressoHigienizacao: r.progressoHigienizacao,
          checklist: r.checklist,
          ocorrenciaNumero: r.ocorrenciaNumero,
          ocorrenciaDescricao: r.ocorrenciaDescricao,
          concluidoHorario: r.concluidoHorario
        };
      });
      localStorage.setItem('hotelnozap_camareira_dados', JSON.stringify(cacheMap));
    } catch {}
  };

  // 1. Iniciar Limpeza
  const handleIniciarLimpeza = async (room: RoomHousekeeping) => {
    const updated = rooms.map(r => {
      if (r.id === room.id) {
        return {
          ...r,
          status: 'limpeza' as const,
          hkStatus: 'em_limpeza' as const,
          tempoDecorrido: 1,
          progressoHigienizacao: 25,
          checklist: r.checklist.map((c, i) => i === 0 ? { ...c, checked: true } : c)
        };
      }
      return r;
    });
    setRooms(updated);
    persistHousekeeping(updated);
    showToast(`Limpeza iniciada no Quarto ${room.number}`);

    try {
      await quartosService.updateQuarto(room.id, {
        numero: room.number,
        number: room.number,
        status: 'limpeza'
      }, hotelInfo.id);
      quartosService.notifyQuartoAlterado({
        quartoId: room.id,
        numero: room.number,
        status: 'limpeza',
        hotel_id: hotelInfo.id,
        origem: 'camareira'
      });
    } catch (err) {
      console.warn('Erro ao atualizar quarto:', err);
    }
  };

  // 2. Concluir e Liberar Quarto
  const handleConcluirELiberar = async (room: RoomHousekeeping) => {
    const now = new Date();
    const nowTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const todayYmd = getTodayYmd();

    const updated = rooms.map(r => {
      if (r.id === room.id) {
        return {
          ...r,
          status: 'livre' as const,
          hkStatus: 'pronto' as const,
          progressoHigienizacao: 100,
          concluidoHorario: `${nowTime} por ${loggedUser.nome}`,
          checklist: r.checklist.map(c => ({ ...c, checked: true }))
        };
      }
      return r;
    });
    setRooms(updated);
    persistHousekeeping(updated);

    // Registra imediatamente na tela de Quartos Limpos (com data de hoje)
    const novoRegistro: RegistroQuartoLimpo = {
      id: `limpo_${room.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      quartoId: room.id,
      numero: room.number,
      categoria: room.category,
      andar: room.floor,
      limpoPor: loggedUser.nome,
      horarioConclusao: nowTime,
      dataConclusao: todayYmd,
      dataHoraFormatada: `${formatDatePtBr(todayYmd)} às ${nowTime}`,
      tempoGastoMinutos: room.tempoDecorrido && room.tempoDecorrido > 0 ? room.tempoDecorrido : (room.tempoEstimado || 25),
      tipoArrumacao: room.tipoArrumacao || 'Higienização Completa',
      hotelId: hotelInfo.id,
      checklistConcluido: true
    };

    setCleanedHistory(prev => {
      // Registra cada higienização realizada, permitindo que o mesmo quarto seja limpo múltiplas vezes no mesmo dia
      const next = [novoRegistro, ...prev];
      try {
        localStorage.setItem(`hotelnozap_historico_limpeza_${hotelInfo.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      await quartosService.updateQuarto(room.id, {
        numero: room.number,
        number: room.number,
        status: 'livre',
        hospede_atual: null
      }, hotelInfo.id);
      playChimeSuccess();
      showToast(`✨ Quarto ${room.number} 100% higienizado e movido para Quartos Limpos!`);
      
      // Notifica recepção e outros colaboradores em tempo real
      quartosService.notifyQuartoAlterado({
        quartoId: room.id,
        numero: room.number,
        status: 'livre',
        hotel_id: hotelInfo.id,
        origem: 'camareira'
      });
    } catch (err) {
      console.error('Erro ao liberar quarto:', err);
    }
  };

  // 3. Toggle checklist item
  const handleToggleChecklist = (roomId: string, checkId: string) => {
    const updated = rooms.map(r => {
      if (r.id === roomId) {
        const nextChecklist = r.checklist.map(c => c.id === checkId ? { ...c, checked: !c.checked } : c);
        const checkedCount = nextChecklist.filter(c => c.checked).length;
        const prog = Math.round((checkedCount / nextChecklist.length) * 100);
        return {
          ...r,
          checklist: nextChecklist,
          progressoHigienizacao: prog
        };
      }
      return r;
    });
    setRooms(updated);
    persistHousekeeping(updated);
  };

  // 4. Salvar Ocorrência / Manutenção
  const handleSalvarManutencao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manutQuartoId) {
      alert('Selecione o quarto com problema');
      return;
    }

    const numOcorrencia = `#MN-${Math.floor(1000 + Math.random() * 9000)}`;
    const updated = rooms.map(r => {
      if (r.id === manutQuartoId) {
        return {
          ...r,
          status: 'manutencao' as const,
          hkStatus: 'manutencao' as const,
          ocorrenciaNumero: numOcorrencia,
          ocorrenciaDescricao: `[${manutTipo} - ${manutPrioridade}] ${manutDescricao}`,
          ocorrenciaStatus: 'Limpeza pausada'
        };
      }
      return r;
    });

    setRooms(updated);
    persistHousekeeping(updated);

    try {
      await quartosService.updateQuarto(manutQuartoId, { status: 'manutencao' }, hotelInfo.id);
      const targetRoom = rooms.find(r => r.id === manutQuartoId);
      quartosService.notifyQuartoAlterado({
        quartoId: manutQuartoId,
        numero: targetRoom?.number,
        status: 'manutencao',
        hotel_id: hotelInfo.id,
        origem: 'camareira'
      });
      window.dispatchEvent(new CustomEvent('hotel_nova_solicitacao', {
        detail: {
          tipo: 'Manutenção / Ocorrência',
          quarto: targetRoom?.number || '',
          mensagem: `[${manutTipo}] ${manutDescricao}`,
          origem: 'Camareira'
        }
      }));
      showToast(`Ocorrência ${numOcorrencia} registrada para o Quarto ${targetRoom?.number}`);
      setModalRelatarManutencaoOpen(false);
      setManutDescricao('');
      setManutQuartoId('');
    } catch (err) {
      console.error('Erro ao registrar manutenção:', err);
    }
  };

  // KPIs
  const totalQuartos = rooms.length;
  const pendentesRooms = rooms.filter(r => r.status !== 'livre' && r.hkStatus !== 'pronto');
  const pendentesCount = pendentesRooms.length;
  const aguardandoCount = rooms.filter(r => (r.hkStatus === 'checkout' || r.status === 'limpeza') && r.status !== 'livre' && r.hkStatus !== 'pronto').length;
  const checkoutsCount = rooms.filter(r => r.hkStatus === 'checkout' && r.status !== 'livre').length;
  const emExecucaoCount = rooms.filter(r => r.hkStatus === 'em_limpeza').length;
  const inspecaoCount = rooms.filter(r => r.hkStatus === 'inspecao').length;
  const limposHojeCount = cleanedHistory.filter(item => item.dataConclusao === getTodayYmd()).length || rooms.filter(r => r.status === 'livre' || r.hkStatus === 'pronto').length;
  const prontosCount = limposHojeCount;
  const percentProntos = totalQuartos > 0 ? Math.round((limposHojeCount / totalQuartos) * 100) : 0;
  const ocorrenciasCount = rooms.filter(r => r.status === 'manutencao' || r.hkStatus === 'manutencao').length;

  // Andares atendidos dinamicamente pelos quartos reais
  const andaresAtendidos = useMemo(() => {
    if (!rooms || rooms.length === 0) return 'Geral';
    const distinct = Array.from(new Set(rooms.map(r => r.floor).filter(Boolean)));
    if (distinct.length === 0) return 'Geral';
    if (distinct.length <= 2) return distinct.join(' & ');
    return `${distinct.slice(0, 2).join(', ')} +${distinct.length - 2}`;
  }, [rooms]);

  // Filtragem dos Quartos Pendentes (Quartos com limpeza concluída NUNCA aparecem como cards na tela principal)
  const filteredRooms = useMemo(() => {
    return rooms.filter(r => {
      // Regra fundamental: quartos com limpeza concluída não aparecem no grid da tela principal
      if (r.status === 'livre' || r.hkStatus === 'pronto') {
        return false;
      }

      // Filtro de busca
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const numMatch = r.number.toLowerCase().includes(q);
        const catMatch = r.category.toLowerCase().includes(q);
        const guestMatch = r.guestName?.toLowerCase().includes(q) || false;
        const floorMatch = r.floor.toLowerCase().includes(q);
        if (!numMatch && !catMatch && !guestMatch && !floorMatch) return false;
      }

      // Filtro de status pendente
      if (activeFilter === 'checkout') {
        return r.hkStatus === 'checkout' || (r.status === 'limpeza' && r.hkStatus !== 'em_limpeza');
      }
      if (activeFilter === 'em_limpeza') {
        return r.hkStatus === 'em_limpeza';
      }
      if (activeFilter === 'inspecao') {
        return r.hkStatus === 'inspecao';
      }
      return true;
    });
  }, [rooms, searchQuery, activeFilter]);

  // Filtragem dos Quartos Limpos por Data e Busca
  const cleanedRoomsFiltered = useMemo(() => {
    const todayYmd = getTodayYmd();
    const yesterdayYmd = getYesterdayYmd();

    return cleanedHistory.filter(item => {
      // 1. Filtro de data
      if (cleanDateFilterMode === 'hoje') {
        if (item.dataConclusao !== todayYmd) return false;
      } else if (cleanDateFilterMode === 'ontem') {
        if (item.dataConclusao !== yesterdayYmd) return false;
      } else if (cleanDateFilterMode === 'ultimos7') {
        try {
          const itemDate = new Date(item.dataConclusao + 'T00:00:00');
          const now = new Date();
          const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7 || diffDays < 0) return false;
        } catch {
          return false;
        }
      } else if (cleanDateFilterMode === 'custom') {
        if (selectedCustomDate && item.dataConclusao !== selectedCustomDate) return false;
      }

      // 2. Filtro de texto / busca
      if (cleanSearchQuery.trim()) {
        const q = cleanSearchQuery.toLowerCase();
        const numMatch = item.numero.toLowerCase().includes(q);
        const catMatch = item.categoria.toLowerCase().includes(q);
        const respMatch = item.limpoPor.toLowerCase().includes(q);
        const floorMatch = item.andar.toLowerCase().includes(q);
        if (!numMatch && !catMatch && !respMatch && !floorMatch) return false;
      }

      return true;
    });
  }, [cleanedHistory, cleanDateFilterMode, selectedCustomDate, cleanSearchQuery]);

  // Quantidade de quartos distintos no período filtrado
  const distinctRoomsCount = useMemo(() => {
    return new Set(cleanedRoomsFiltered.map(item => item.numero || item.quartoId)).size;
  }, [cleanedRoomsFiltered]);

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-800 flex flex-col font-sans pb-20 sm:pb-8">
      
      {/* TOAST DE NOTIFICAÇÃO */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs sm:text-sm font-medium border border-slate-700 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TOP HEADER EXECUTIVO ESCURO COM DADOS REAIS DO HOTEL E COLABORADOR */}
      {/* ========================================================================= */}
      <header className="bg-[#0b1c14] text-white shadow-md border-b border-emerald-950/60 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex items-center justify-between gap-4">
          
          {/* Perfil da Camareira / Colaborador */}
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-emerald-500 shadow-md bg-emerald-950 flex items-center justify-center">
                {loggedUser.url_avatar ? (
                  <img
                    src={loggedUser.url_avatar}
                    alt={loggedUser.nome}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-black text-sm sm:text-base tracking-wider">
                    {loggedUser.iniciais}
                  </span>
                )}
              </div>
              <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#0b1c14] ${emServico ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-bold text-sm sm:text-base text-white tracking-tight truncate">
                  {loggedUser.nome}
                </h1>
                <button
                  type="button"
                  onClick={() => setEmServico(!emServico)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide transition-colors cursor-pointer ${
                    emServico ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                  title="Clique para alternar status do turno"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${emServico ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                  <span>{emServico ? 'EM SERVIÇO' : 'EM PAUSA'}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-emerald-200/80 truncate mt-0.5">
                <span className="font-semibold text-white bg-emerald-800/80 px-2 py-0.5 rounded border border-emerald-600/50 truncate max-w-[200px] sm:max-w-none">
                  {hotelInfo.nome}
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline truncate">{andaresAtendidos}</span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">Turno Manhã (07:00 às 15:20)</span>
              </div>
            </div>
          </div>

          {/* Botões de Ação Desktop */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCurrentView('painel_quartos')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'painel_quartos'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">cleaning_services</span>
              <span>Quartos Pendentes</span>
              {pendentesCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                  {pendentesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setCurrentView('quartos_limpos')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'quartos_limpos'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">verified</span>
              <span>Quartos Limpos</span>
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-bold">
                {limposHojeCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setModalEscalaOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-all cursor-pointer border border-white/10"
            >
              <span className="material-symbols-outlined text-[18px]">badge</span>
              <span>Meus Dados</span>
            </button>

            {onNavigateBack && (
              <button
                type="button"
                onClick={onNavigateBack}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-emerald-200 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                title="Voltar ao Sistema Principal"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span className="hidden md:inline">Voltar</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (window.confirm('Deseja realmente finalizar o turno da camareira?')) {
                  if (onLogout) onLogout();
                  else if (onNavigateBack) onNavigateBack();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-300 hover:text-rose-100 hover:bg-rose-950/40 transition-all cursor-pointer border border-rose-900/30"
              title="Finalizar Turno e Sair"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span className="hidden lg:inline">Finalizar Turno</span>
            </button>
          </div>

          {/* Botões de Ação Mobile (Meus Dados + Sair) */}
          <div className="flex sm:hidden items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setModalEscalaOpen(true)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              title="Meus Dados"
            >
              <span className="material-symbols-outlined text-lg">badge</span>
            </button>
            {onNavigateBack && (
              <button
                type="button"
                onClick={onNavigateBack}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                title="Voltar ao Sistema"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Finalizar turno?')) {
                  if (onLogout) onLogout();
                  else if (onNavigateBack) onNavigateBack();
                }
              }}
              className="p-1.5 rounded-lg bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 cursor-pointer"
              title="Sair"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
            </button>
          </div>

        </div>

        {/* Abas de Navegação Rápida no Topo Mobile (Pendentes vs Limpos) */}
        <div className="sm:hidden px-3 pb-2.5 pt-0.5 flex items-center gap-2 border-t border-emerald-950/60">
          <button
            type="button"
            onClick={() => setCurrentView('painel_quartos')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
              currentView === 'painel_quartos'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                : 'bg-emerald-950/70 hover:bg-emerald-900/60 text-emerald-200 border-emerald-800/40'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">cleaning_services</span>
            <span>Pendentes</span>
            {pendentesCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-black leading-none">
                {pendentesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setCurrentView('quartos_limpos')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
              currentView === 'quartos_limpos'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                : 'bg-emerald-950/70 hover:bg-emerald-900/60 text-emerald-200 border-emerald-800/40'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">verified</span>
            <span>Limpos</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-400/25 text-emerald-100 font-black leading-none">
              {limposHojeCount}
            </span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. CONTEÚDO PRINCIPAL (CONTAINER CENTRALIZADO) */}
      {/* ========================================================================= */}
      <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-6 flex-1 w-full space-y-3 sm:space-y-6">
        {currentView === 'painel_quartos' ? (
          <>
            {/* 2.1 CARDS DE KPIS (4 CARDS) */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Card 1: Meta Total */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <span className="material-symbols-outlined text-xl">bed</span>
              </div>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 tracking-wide uppercase">
                Meta Total
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">{totalQuartos}</span>
                <span className="text-xs text-slate-500 font-medium">quartos</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Andares 1 e 2</p>
            </div>
            <div className="w-full h-1 bg-slate-100 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-slate-900 rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>

          {/* Card 2: Prioridade Alta */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <span className="material-symbols-outlined text-xl">assignment_late</span>
              </div>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100/70 text-amber-800 tracking-wide uppercase">
                Prioridade Alta
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-amber-600">{aguardandoCount}</span>
                <span className="text-xs text-slate-500 font-medium">aguardando</span>
              </div>
              <p className="text-xs text-amber-700 font-medium mt-0.5">{checkoutsCount} Check-outs</p>
            </div>
            <div className="w-full h-1 bg-amber-100 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(aguardandoCount * 15, 100)}%` }}></div>
            </div>
          </div>

          {/* Card 3: Em Execução */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-blue-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <span className="material-symbols-outlined text-xl">cleaning_services</span>
              </div>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100/70 text-blue-800 tracking-wide uppercase">
                Em Execução
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-blue-600">{emExecucaoCount}</span>
                <span className="text-xs text-slate-500 font-medium">no momento</span>
              </div>
              <p className="text-xs text-blue-700 font-medium mt-0.5">Média 22 min</p>
            </div>
            <div className="w-full h-1 bg-blue-100 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(emExecucaoCount * 30, 100)}%` }}></div>
            </div>
          </div>

          {/* Card 4: Liberados Recepção / Quartos Limpos */}
          <div
            onClick={() => setCurrentView('quartos_limpos')}
            role="button"
            tabIndex={0}
            className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all group"
            title="Clique para abrir a tela de Quartos Limpos na data atual e outras datas"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                <span className="material-symbols-outlined text-xl">verified</span>
              </div>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100/70 text-emerald-800 tracking-wide uppercase flex items-center gap-1">
                <span>Quartos Limpos</span>
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-emerald-600">{limposHojeCount}</span>
                <span className="text-xs text-slate-500 font-medium">higienizados hoje</span>
              </div>
              <p className="text-xs text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
                <span>Ver histórico por data</span>
                <span className="material-symbols-outlined text-xs">calendar_month</span>
              </p>
            </div>
            <div className="w-full h-1 bg-emerald-100 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${percentProntos}%` }}></div>
            </div>
          </div>

        </section>

        {/* 2.2 BARRA DE BUSCA, FILTROS E AÇÃO RELATAR MANUTENÇÃO */}
        <section className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1">
            {/* Input de Busca */}
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-lg">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar quarto ou hóspede..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>

            {/* Chips de Filtros (Scroll horizontal em mobile) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveFilter('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === 'todos' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Todos Pendentes ({pendentesCount})
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('checkout')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === 'checkout' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Check-out / Sujos ({checkoutsCount})
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('em_limpeza')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === 'em_limpeza' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Em Limpeza ({emExecucaoCount})
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('inspecao')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === 'inspecao' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Para Inspecionar ({inspecaoCount})
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('quartos_limpos')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs"
                title="Abrir tela de Quartos Limpos com datas"
              >
                <span className="material-symbols-outlined text-sm">verified</span>
                <span>Ver Quartos Limpos ({limposHojeCount})</span>
              </button>
            </div>
          </div>

          {/* Botão de Manutenção em Destaque */}
          <button
            type="button"
            onClick={() => setModalRelatarManutencaoOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#072412] hover:bg-[#0b381c] text-white shadow-sm transition-all cursor-pointer shrink-0 active:scale-98"
          >
            <span className="material-symbols-outlined text-amber-400 text-lg">warning</span>
            <span>Relatar Problema / Manutenção</span>
          </button>

        </section>

        {/* 2.3 GRID DE CARDS DOS QUARTOS (3 COLUNAS NO DESKTOP, 1 NO MOBILE) */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <span className="material-symbols-outlined text-4xl animate-spin text-emerald-600 block mb-2">sync</span>
            Carregando governança de {hotelInfo.nome}...
          </div>
        ) : rooms.length === 0 ? (
          <div className="py-16 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 text-sm p-8 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shadow-xs">
              <span className="material-symbols-outlined text-3xl">hotel</span>
            </div>
            <h3 className="font-bold text-base text-slate-800">Nenhum quarto cadastrado para {hotelInfo.nome}</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Os quartos e estadias deste hotel aparecerão aqui em tempo real assim que forem adicionados pelo painel administrativo.
            </p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="py-16 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
            <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">hotel</span>
            Nenhum quarto corresponde aos filtros selecionados.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
            {filteredRooms.map((room, idx) => {
              const theme = CARD_COLOR_THEMES[idx % CARD_COLOR_THEMES.length];
              const timesAlreadyCleanedToday = cleanedHistory.filter(h =>
                (h.quartoId === room.id || h.numero === room.number) &&
                h.dataConclusao === getTodayYmd()
              ).length;

              return (
                <div
                  key={room.id}
                  onClick={() => setModalInfoRoom(room)}
                  className={`${theme.bg} rounded-xl sm:rounded-2xl border ${theme.border} shadow-xs hover:shadow-md ${theme.hoverBorder} transition-all flex flex-col justify-between overflow-hidden p-2.5 sm:p-5 space-y-2 sm:space-y-3.5 cursor-pointer group`}
                >
                  {/* TOPO DO CARD: QUARTO, ANDAR E STATUS BADGE */}
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                            Quarto {room.number}
                          </h3>
                          {timesAlreadyCleanedToday > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-amber-500 text-white shadow-xs shrink-0"
                              title={`Este quarto já foi higienizado ${timesAlreadyCleanedToday}x hoje. Esta será a ${timesAlreadyCleanedToday + 1}ª limpeza.`}
                            >
                              <span className="material-symbols-outlined text-[10px] sm:text-xs">repeat</span>
                              <span>{timesAlreadyCleanedToday + 1}ª vez</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate mt-0.5">
                          {room.floor} • {room.category}
                        </p>
                      </div>

                      {/* STATUS BADGE COMPACTO */}
                      {room.hkStatus === 'checkout' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-[9px] sm:text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                          <span className="material-symbols-outlined text-[11px] sm:text-sm text-amber-700">priority_high</span>
                          <span className="hidden sm:inline">Check-out Realizado</span>
                          <span className="sm:hidden">Check-out</span>
                        </span>
                      )}

                      {room.hkStatus === 'em_limpeza' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-[9px] sm:text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                          <span className="hidden sm:inline">Em Limpeza ({room.tempoDecorrido}m)</span>
                          <span className="sm:hidden">Limpando</span>
                        </span>
                      )}

                      {room.hkStatus === 'ocupado_estadia' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-[9px] sm:text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-300 shrink-0">
                          <span className="material-symbols-outlined text-[11px] sm:text-sm text-indigo-700">person</span>
                          <span className="hidden sm:inline">Estadia (Ocupado)</span>
                          <span className="sm:hidden">Estadia</span>
                        </span>
                      )}

                      {room.hkStatus === 'inspecao' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-[9px] sm:text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300 shrink-0">
                          <span className="material-symbols-outlined text-[11px] sm:text-sm text-purple-700">assignment_turned_in</span>
                          <span className="hidden sm:inline">Pendente Inspeção</span>
                          <span className="sm:hidden">Inspeção</span>
                        </span>
                      )}

                      {room.hkStatus === 'manutencao' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-[9px] sm:text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300 shrink-0">
                          <span className="material-symbols-outlined text-[11px] sm:text-sm text-rose-700">build</span>
                          <span className="hidden sm:inline">Manutenção Ativa</span>
                          <span className="sm:hidden">Manutenção</span>
                        </span>
                      )}

                      {room.hkStatus === 'pronto' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-[9px] sm:text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                          <span className="material-symbols-outlined text-[11px] sm:text-sm text-emerald-700">check_circle</span>
                          <span className="hidden sm:inline">Pronto & Liberado</span>
                          <span className="sm:hidden">Pronto</span>
                        </span>
                      )}
                    </div>

                    {/* Sub-tag de previsão / tipo */}
                    <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                      <span className={`text-[9px] sm:text-[10px] font-bold ${theme.tagBg} px-1.5 py-0.5 rounded border truncate`}>
                        {room.hkStatus === 'checkout' ? 'Higienização Completa' : room.tipoArrumacao || 'Limpeza Padrão'}
                      </span>
                      {room.tempoEstimado && (
                        <span className="text-[9px] sm:text-[11px] text-slate-500 font-medium">
                          ⏱ {room.tempoEstimado}m
                        </span>
                      )}
                    </div>
                  </div>

                  {/* DADOS E GOVERNANÇA (ESTILO INNERBG IGUAL AOS LIMPOS) */}
                  <div className={`${theme.innerBg} rounded-lg sm:rounded-xl p-1.5 sm:p-3 border ${theme.innerBorder} text-[10px] sm:text-xs space-y-1 sm:space-y-1.5 shadow-xs`}>
                    {room.hkStatus === 'checkout' && (
                      <>
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400">Tempo est.:</span>
                          <span className="font-bold text-slate-800 flex items-center gap-0.5">
                            <span className={`material-symbols-outlined text-[10px] sm:text-xs ${theme.iconColor}`}>schedule</span>
                            <span>{room.tempoEstimado} min</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400">Enxoval:</span>
                          <span className="font-bold text-slate-800 truncate max-w-[85px] sm:max-w-none flex items-center gap-0.5" title={room.enxoval}>
                            <span className={`material-symbols-outlined text-[10px] sm:text-xs ${theme.iconColor}`}>bed</span>
                            <span className="truncate">{room.enxoval}</span>
                          </span>
                        </div>
                        {room.frigobarConsumos && room.frigobarConsumos > 0 ? (
                          <div className="flex items-center justify-between text-amber-900 pt-1 border-t border-slate-200/60 font-bold">
                            <span className="text-[9px] uppercase">Frigobar:</span>
                            <span className="text-[10px] bg-amber-200/60 px-1 py-0.2 rounded">{room.frigobarConsumos} itens</span>
                          </div>
                        ) : null}
                      </>
                    )}

                    {room.hkStatus === 'em_limpeza' && (
                      <>
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400">Progresso:</span>
                          <span className="font-extrabold text-blue-700 text-[10px] sm:text-xs">{room.progressoHigienizacao || 65}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${room.progressoHigienizacao || 65}%` }}></div>
                        </div>
                        <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200/60">
                          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400">Decorrido:</span>
                          <span className="font-bold text-slate-800">{room.tempoDecorrido || 12} min</span>
                        </div>
                      </>
                    )}

                    {room.hkStatus === 'ocupado_estadia' && (
                      <>
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400">Arrumação:</span>
                          <span className="font-bold text-slate-800 truncate">{room.tipoArrumacao || 'Leve'}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400">Horário:</span>
                          <span className="font-bold text-slate-800">{room.agendadoHorario || '11:30'}</span>
                        </div>
                        {room.recadoHospede && (
                          <p className="text-[9px] sm:text-[10px] italic text-slate-600 truncate pt-1 border-t border-slate-200/60" title={room.recadoHospede}>
                            "{room.recadoHospede}"
                          </p>
                        )}
                      </>
                    )}

                    {room.hkStatus === 'inspecao' && (
                      <>
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400">Limpo por:</span>
                          <span className="font-bold text-purple-950 truncate max-w-[85px] sm:max-w-none">{room.limpoPor || 'Camareira'}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400">Término:</span>
                          <span className="font-bold text-slate-800">{room.terminoHorario || '10:45'}</span>
                        </div>
                      </>
                    )}

                    {room.hkStatus === 'manutencao' && (
                      <>
                        <div className="flex items-center justify-between text-rose-800">
                          <span className="text-[9px] sm:text-[10px] uppercase font-bold">Chamado:</span>
                          <span className="font-bold">{room.ocorrenciaNumero || '#MN-4892'}</span>
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-rose-900 truncate" title={room.ocorrenciaDescricao}>
                          {room.ocorrenciaDescricao || 'Manutenção técnica'}
                        </p>
                      </>
                    )}

                    {room.hkStatus === 'pronto' && (
                      <>
                        <div className="flex items-center justify-between text-emerald-800">
                          <span className="text-[9px] sm:text-[10px] uppercase font-bold">Status:</span>
                          <span className="font-bold">Liberado</span>
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-emerald-900 truncate">
                          {room.concluidoHorario || 'Concluído'}
                        </p>
                      </>
                    )}
                  </div>

                  {/* CHECKLIST NO CARD: 1 LINHA RESUMIDA NO MOBILE */}
                  {room.hkStatus === 'em_limpeza' && (
                    <div>
                      <div className={`sm:hidden flex items-center justify-between text-[10px] font-bold ${theme.checklistBg} px-2 py-1 rounded-lg border`}>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">checklist</span>
                          <span>Checklist</span>
                        </span>
                        <span className={`text-[9px] font-black ${theme.checkPill} px-1.5 py-0.2 rounded`}>
                          {room.checklist.filter(c => c.checked).length}/{room.checklist.length}
                        </span>
                      </div>
                      <div className="hidden sm:block space-y-1 pt-1">
                        {room.checklist.slice(0, 3).map((item) => (
                          <label
                            key={item.id}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-slate-700 hover:text-slate-900"
                          >
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() => handleToggleChecklist(room.id, item.id)}
                              className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                            />
                            <span className={item.checked ? 'line-through text-slate-400' : 'font-medium truncate'}>
                              {item.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* RODAPÉ DO CARD COM AÇÕES */}
                  <div className="pt-1.5 sm:pt-2 border-t border-slate-200/60 flex items-center gap-1.5">
                    {/* Botão de Info (i) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalInfoRoom(room);
                      }}
                      className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer shrink-0"
                      title="Ver detalhes do quarto"
                    >
                      <span className="material-symbols-outlined text-base sm:text-lg">info</span>
                    </button>

                    {/* Ação Primária Conforme o Status */}
                    {room.hkStatus === 'checkout' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleIniciarLimpeza(room);
                        }}
                        className="flex-1 py-1.5 sm:py-2.5 px-2 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 active:scale-98 text-white shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer truncate"
                      >
                        <span className="material-symbols-outlined text-sm sm:text-lg">play_arrow</span>
                        <span className="sm:hidden">Iniciar</span>
                        <span className="hidden sm:inline">Iniciar Limpeza</span>
                      </button>
                    )}

                    {room.hkStatus === 'em_limpeza' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConcluirELiberar(room);
                        }}
                        className="flex-1 py-1.5 sm:py-2.5 px-2 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer truncate"
                      >
                        <span className="material-symbols-outlined text-sm sm:text-lg">check</span>
                        <span className="sm:hidden">Concluir</span>
                        <span className="hidden sm:inline">Concluir e Liberar</span>
                      </button>
                    )}

                    {room.hkStatus === 'ocupado_estadia' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleIniciarLimpeza(room);
                        }}
                        className="flex-1 py-1.5 sm:py-2.5 px-2 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold bg-[#062414] hover:bg-[#0b381c] active:scale-98 text-white shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer truncate"
                      >
                        <span className="material-symbols-outlined text-sm sm:text-lg">add</span>
                        <span className="sm:hidden">Iniciar</span>
                        <span className="hidden sm:inline">Iniciar Limpeza Diária</span>
                      </button>
                    )}

                    {room.hkStatus === 'inspecao' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalInspecaoRoom(room);
                        }}
                        className="flex-1 py-1.5 sm:py-2.5 px-2 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold bg-purple-600 hover:bg-purple-700 active:scale-98 text-white shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer truncate"
                      >
                        <span className="material-symbols-outlined text-sm sm:text-lg">rate_review</span>
                        <span className="sm:hidden">Inspecionar</span>
                        <span className="hidden sm:inline">Inspecionar & Aprovar</span>
                      </button>
                    )}

                    {room.hkStatus === 'manutencao' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalOcorrenciaRoom(room);
                        }}
                        className="flex-1 py-1.5 sm:py-2.5 px-2 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-800 transition-all flex items-center justify-center gap-1 cursor-pointer border border-slate-300 truncate"
                      >
                        <span className="material-symbols-outlined text-sm sm:text-lg">visibility</span>
                        <span className="sm:hidden">Ocorrência</span>
                        <span className="hidden sm:inline">Ver Ocorrência</span>
                      </button>
                    )}

                    {room.hkStatus === 'pronto' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          showToast(`Quarto ${room.number} já está liberado e pronto para hospedagem.`);
                        }}
                        className="flex-1 py-1.5 sm:py-2.5 px-2 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 transition-all flex items-center justify-center gap-1 cursor-pointer truncate"
                      >
                        <span className="material-symbols-outlined text-sm sm:text-lg">done_all</span>
                        <span>Liberado</span>
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
          </>
        ) : (
          /* ========================================================================= */
          /* TELA DEDICADA: QUARTOS LIMPOS & HISTÓRICO POR DATA                        */
          /* ========================================================================= */
          <div className="space-y-4 sm:space-y-5">
            {/* Banner Topo da Tela de Quartos Limpos */}
            <div className="bg-white rounded-2xl p-3 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col gap-2.5 sm:gap-3.5">
              <div className="flex items-center justify-between gap-2">
                {/* Botão Voltar aos Pendentes */}
                <button
                  type="button"
                  onClick={() => setCurrentView('painel_quartos')}
                  className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-all cursor-pointer border border-slate-300/80 shrink-0"
                >
                  <span className="material-symbols-outlined text-base sm:text-lg">arrow_back</span>
                  <span className="sm:hidden">Voltar</span>
                  <span className="hidden sm:inline">Voltar aos Pendentes</span>
                </button>

                {/* Título Central / Responsivo */}
                <div className="flex items-center gap-1.5 min-w-0 justify-center">
                  <span className="material-symbols-outlined text-emerald-600 text-xl sm:text-2xl shrink-0">verified</span>
                  <h2 className="text-xs sm:text-xl font-black text-slate-900 truncate">
                    Quartos Higienizados
                  </h2>
                  <span className="text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                    {cleanedRoomsFiltered.length}
                  </span>
                </div>

                {/* Botão Atualizar */}
                <button
                  type="button"
                  onClick={() => loadRealData(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer shrink-0"
                  title="Sincronizar dados mais recentes"
                >
                  <span className="material-symbols-outlined text-base">sync</span>
                  <span className="hidden sm:inline">Atualizar</span>
                </button>
              </div>

              {/* Subtítulo Discreto e Informativo */}
              <p className="text-[11px] sm:text-xs text-slate-500 text-center sm:text-left border-t border-slate-100 pt-2 sm:border-0 sm:pt-0">
                Consulte os quartos limpos na data atual ({formatDatePtBr(getTodayYmd())}) ou selecione outras datas no histórico abaixo.
              </p>
            </div>

            {/* Painel de Filtro por Data e Busca */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                
                {/* Seletor de Data Rápido (Chips) */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Filtrar por Data
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setCleanDateFilterMode('hoje')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        cleanDateFilterMode === 'hoje'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">today</span>
                      <span>Hoje ({formatDatePtBr(getTodayYmd())})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCleanDateFilterMode('ontem')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        cleanDateFilterMode === 'ontem'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">history</span>
                      <span>Ontem ({formatDatePtBr(getYesterdayYmd())})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCleanDateFilterMode('ultimos7')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        cleanDateFilterMode === 'ultimos7'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">date_range</span>
                      <span>Últimos 7 dias</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCleanDateFilterMode('todas')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        cleanDateFilterMode === 'todas'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">all_inclusive</span>
                      <span>Todas as Datas</span>
                    </button>
                  </div>
                </div>

                {/* Seletor de Data Customizada (Calendário) */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Escolher Outra Data
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={selectedCustomDate}
                      onChange={(e) => {
                        setSelectedCustomDate(e.target.value);
                        setCleanDateFilterMode('custom');
                      }}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 cursor-pointer"
                    />
                    {cleanDateFilterMode === 'custom' && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                        Ativo: {formatDatePtBr(selectedCustomDate)}
                      </span>
                    )}
                  </div>
                </div>

              </div>

              {/* Barra de Busca de Quartos Limpos */}
              <div className="relative pt-2 border-t border-slate-100">
                <span className="material-symbols-outlined absolute left-3.5 top-5 text-slate-400 text-lg">search</span>
                <input
                  type="text"
                  value={cleanSearchQuery}
                  onChange={(e) => setCleanSearchQuery(e.target.value)}
                  placeholder="Pesquisar por número do quarto, responsável ou categoria..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
                {cleanSearchQuery && (
                  <button
                    onClick={() => setCleanSearchQuery('')}
                    className="absolute right-3 top-5 text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>
            </div>

            {/* Mini KPIs do Período Selecionado */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase block">Higienizados</span>
                <span className="text-xl font-black text-emerald-600">{cleanedRoomsFiltered.length}</span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {distinctRoomsCount < cleanedRoomsFiltered.length
                    ? `${distinctRoomsCount} quartos (${cleanedRoomsFiltered.length} limpezas)`
                    : 'no período filtrado'}
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase block">Tempo Médio</span>
                <span className="text-xl font-black text-blue-600">
                  {cleanedRoomsFiltered.length > 0
                    ? Math.round(cleanedRoomsFiltered.reduce((acc, c) => acc + (c.tempoGastoMinutos || 25), 0) / cleanedRoomsFiltered.length)
                    : 25} min
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">por higienização</p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase block">Checklist</span>
                <span className="text-xl font-black text-slate-900">100%</span>
                <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Conformidade total</p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase block">Disponibilidade</span>
                <span className="text-xl font-black text-emerald-600">Recepção</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Liberados para venda</p>
              </div>
            </div>

            {/* Lista / Grid de Quartos Limpos */}
            {cleanedRoomsFiltered.length === 0 ? (
              <div className="py-16 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 text-sm p-8 space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shadow-xs">
                  <span className="material-symbols-outlined text-3xl">event_busy</span>
                </div>
                <h3 className="font-bold text-base text-slate-800">
                  Nenhum quarto limpo encontrado {cleanDateFilterMode === 'hoje' ? 'hoje' : cleanDateFilterMode === 'ontem' ? 'ontem' : cleanDateFilterMode === 'custom' ? `na data ${formatDatePtBr(selectedCustomDate)}` : 'com os filtros aplicados'}
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Assim que os quartos forem higienizados e liberados, eles serão arquivados nesta tela para histórico e consulta.
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCleanDateFilterMode('hoje')}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                  >
                    Ver Quartos de Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => setCleanDateFilterMode('todas')}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                  >
                    Ver Todas as Datas
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                {cleanedRoomsFiltered.map((item, idx) => {
                  const theme = CARD_COLOR_THEMES[idx % CARD_COLOR_THEMES.length];
                  const roomCleaningsOnDate = cleanedHistory
                    .filter(h => (h.quartoId === item.quartoId || h.numero === item.numero) && h.dataConclusao === item.dataConclusao)
                    .sort((a, b) => (a.horarioConclusao || '').localeCompare(b.horarioConclusao || ''));
                  const timesCleanedOnDate = roomCleaningsOnDate.length;
                  const cleanInstanceIndex = Math.max(1, roomCleaningsOnDate.findIndex(h => h.id === item.id) + 1);

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        const foundRoom = rooms.find(r => r.id === item.quartoId || r.number === item.numero);
                        if (foundRoom) {
                          setModalInfoRoom(foundRoom);
                        } else {
                          setModalInfoRoom({
                            id: item.quartoId,
                            number: item.numero,
                            category: item.categoria,
                            floor: item.andar,
                            status: 'livre',
                            hkStatus: 'pronto',
                            checklist: [
                              { id: '1', label: 'Troca de enxoval', checked: true },
                              { id: '2', label: 'Higienização do banheiro', checked: true },
                              { id: '3', label: 'Reposição de amenities', checked: true },
                              { id: '4', label: 'Limpeza e aspiração do piso', checked: true },
                              { id: '5', label: 'Conferência do frigobar', checked: true }
                            ],
                            concluidoHorario: `${item.horarioConclusao} por ${item.limpoPor}`
                          });
                        }
                      }}
                      className={`${theme.bg} rounded-xl sm:rounded-2xl border ${theme.border} shadow-xs hover:shadow-md ${theme.hoverBorder} transition-all flex flex-col justify-between overflow-hidden p-2.5 sm:p-5 space-y-2 sm:space-y-3.5 cursor-pointer group`}
                    >
                      {/* Topo do Card: Número, Status e Categoria */}
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="text-sm sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                                Quarto {item.numero}
                              </h3>
                              {timesCleanedOnDate > 1 && (
                                <span
                                  title={`Este quarto foi limpo ${timesCleanedOnDate} vezes em ${formatDatePtBr(item.dataConclusao)} (${cleanInstanceIndex}ª limpeza)`}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs shrink-0"
                                >
                                  <span className="material-symbols-outlined text-[10px] sm:text-xs">repeat</span>
                                  <span>{timesCleanedOnDate}x limpo</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate mt-0.5">
                              {item.andar} • {item.categoria}
                            </p>
                          </div>
                          
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-[9px] sm:text-xs font-bold ${theme.badgeBg} shrink-0`}>
                            <span className="material-symbols-outlined text-[11px] sm:text-sm">verified</span>
                            <span className="hidden sm:inline">Higienizado</span>
                            <span className="sm:hidden">Limpo</span>
                          </span>
                        </div>

                        {/* Tipo de Arrumação & Duração */}
                        <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                          <span className={`text-[9px] sm:text-[10px] font-bold ${theme.tagBg} px-1.5 py-0.5 rounded border truncate`}>
                            {item.tipoArrumacao?.replace('Higienização ', '') || 'Completa'}
                          </span>
                          <span className="text-[9px] sm:text-[11px] text-slate-500 font-medium">
                            ⏱ {item.tempoGastoMinutos}m
                          </span>
                        </div>
                      </div>

                      {/* Dados de Conclusão e Governança Resumidos */}
                      <div className={`${theme.innerBg} rounded-lg sm:rounded-xl p-1.5 sm:p-3 border ${theme.innerBorder} text-[10px] sm:text-xs space-y-1 sm:space-y-1.5 shadow-xs`}>
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400">Data:</span>
                          <span className="font-bold text-slate-800 flex items-center gap-1">
                            <span className={`material-symbols-outlined text-[10px] sm:text-xs ${theme.iconColor}`}>calendar_today</span>
                            <span>{formatDatePtBr(item.dataConclusao)}</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400">Hora:</span>
                          <span className="font-bold text-slate-800 flex items-center gap-1">
                            <span className={`material-symbols-outlined text-[10px] sm:text-xs ${theme.iconColor}`}>schedule</span>
                            <span>{item.horarioConclusao}</span>
                            {timesCleanedOnDate > 1 && (
                              <span className="text-[8px] sm:text-[10px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 ml-0.5">
                                {cleanInstanceIndex}ª vez
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200/60">
                          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400">Por:</span>
                          <span className="font-bold text-slate-800 truncate ml-1 text-right max-w-[85px] sm:max-w-none flex items-center gap-0.5" title={item.limpoPor}>
                            <span className={`material-symbols-outlined text-[10px] sm:text-xs ${theme.iconColor}`}>person</span>
                            <span className="truncate">{item.limpoPor}</span>
                          </span>
                        </div>
                      </div>

                      {/* Checklist: 1 linha compacta no mobile, expandido no desktop */}
                      <div>
                        {/* Versão Mobile (1 linha resumida) */}
                        <div className={`sm:hidden flex items-center justify-between text-[10px] font-bold ${theme.checklistBg} px-2 py-1 rounded-lg border`}>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">checklist</span>
                            <span>Checklist</span>
                          </span>
                          <span className={`text-[9px] font-black ${theme.checkPill} px-1.5 py-0.2 rounded`}>
                            100% ✓
                          </span>
                        </div>

                        {/* Versão Desktop (completa) */}
                        <div className="hidden sm:block space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <span className={`font-semibold flex items-center gap-1 ${theme.accentText}`}>
                              <span className="material-symbols-outlined text-sm">checklist</span>
                              Checklist de Governança
                            </span>
                            <span className={`font-bold text-[10px] ${theme.accentText}`}>100% Concluído</span>
                          </div>
                          <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-700 pl-1">
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <span className={`material-symbols-outlined text-xs font-bold ${theme.iconColor}`}>check</span>
                              <span className="truncate">Troca e alinhamento de enxoval</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <span className={`material-symbols-outlined text-xs font-bold ${theme.iconColor}`}>check</span>
                              <span className="truncate">Higienização do banheiro</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <span className={`material-symbols-outlined text-xs font-bold ${theme.iconColor}`}>check</span>
                              <span className="truncate">Reposição de amenities e toalhas</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <span className={`material-symbols-outlined text-xs font-bold ${theme.iconColor}`}>check</span>
                              <span className="truncate">Limpeza, aspiração e frigobar</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Rodapé do Card */}
                      <div className="pt-1.5 sm:pt-2 border-t border-slate-200/60 flex items-center justify-between gap-1">
                        <span className={`inline-flex items-center gap-0.5 text-[9px] sm:text-[11px] font-semibold ${theme.accentText} truncate`}>
                          <span className="material-symbols-outlined text-[12px] sm:text-sm">done_all</span>
                          <span className="hidden sm:inline">Liberado na Recepção</span>
                          <span className="sm:hidden">Liberado</span>
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const foundRoom = rooms.find(r => r.id === item.quartoId || r.number === item.numero);
                            if (foundRoom) {
                              setModalInfoRoom(foundRoom);
                            } else {
                              setModalInfoRoom({
                                id: item.quartoId,
                                number: item.numero,
                                category: item.categoria,
                                floor: item.andar,
                                status: 'livre',
                                hkStatus: 'pronto',
                                checklist: [
                                  { id: '1', label: 'Troca de enxoval', checked: true },
                                  { id: '2', label: 'Higienização do banheiro', checked: true },
                                  { id: '3', label: 'Reposição de amenities', checked: true },
                                  { id: '4', label: 'Limpeza e aspiração do piso', checked: true },
                                  { id: '5', label: 'Conferência do frigobar', checked: true }
                                ],
                                concluidoHorario: `${item.horarioConclusao} por ${item.limpoPor}`
                              });
                            }
                          }}
                          className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold ${theme.btnBg} transition-colors cursor-pointer shrink-0`}
                        >
                          Detalhes
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* 3. BARRA DE NAVEGAÇÃO INFERIOR FIXA MOBILE (Bottom Navigation Bar) */}
      {/* ========================================================================= */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200/90 shadow-lg px-2 py-2 flex items-center justify-around">
        <button
          type="button"
          onClick={() => { setActiveMobileTab('quartos'); setCurrentView('painel_quartos'); }}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-colors cursor-pointer relative ${
            currentView === 'painel_quartos' && activeMobileTab === 'quartos' ? 'text-emerald-700 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="relative">
            <span className="material-symbols-outlined text-2xl">cleaning_services</span>
            {pendentesCount > 0 && (
              <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                {pendentesCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Pendentes</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveMobileTab('quartos'); setCurrentView('quartos_limpos'); }}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-colors cursor-pointer relative ${
            currentView === 'quartos_limpos' ? 'text-emerald-700 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="relative">
            <span className="material-symbols-outlined text-2xl">verified</span>
            {limposHojeCount > 0 && (
              <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center">
                {limposHojeCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Limpos</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveMobileTab('ocorrencias'); setModalRelatarManutencaoOpen(true); }}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-colors cursor-pointer relative ${
            activeMobileTab === 'ocorrencias' ? 'text-emerald-700 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="relative">
            <span className="material-symbols-outlined text-2xl">warning</span>
            {ocorrenciasCount > 0 && (
              <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center">
                {ocorrenciasCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Ocorrências</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const firstWithFrigobar = rooms.find(r => (r.frigobarConsumos || 0) > 0) || rooms[0];
            if (firstWithFrigobar) setModalFrigobarRoom(firstWithFrigobar);
            setActiveMobileTab('frigobar');
          }}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-colors cursor-pointer ${
            activeMobileTab === 'frigobar' ? 'text-emerald-700 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span className="material-symbols-outlined text-2xl">kitchen</span>
          <span className="text-[10px]">Frigobar</span>
        </button>

        <button
          type="button"
          onClick={() => { setModalEscalaOpen(true); setActiveMobileTab('perfil'); }}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-colors cursor-pointer ${
            activeMobileTab === 'perfil' ? 'text-emerald-700 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span className="material-symbols-outlined text-2xl">person</span>
          <span className="text-[10px]">Perfil</span>
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* 4. MODAIS DO SISTEMA DE GOVERNANÇA */}
      {/* ========================================================================= */}

      {/* MODAL 1: RELATAR PROBLEMA / MANUTENÇÃO */}
      {modalRelatarManutencaoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0b1c14] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">warning</span>
                </div>
                <div>
                  <h3 className="font-bold text-base">Relatar Problema / Manutenção</h3>
                  <p className="text-xs text-emerald-200/70">Avisa a equipe de manutenção e recepção instantaneamente</p>
                </div>
              </div>
              <button
                onClick={() => setModalRelatarManutencaoOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSalvarManutencao} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Selecione o Quarto com Problema *
                </label>
                <select
                  required
                  value={manutQuartoId}
                  onChange={(e) => setManutQuartoId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                >
                  <option value="">Selecione o quarto...</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      Quarto {r.number} ({r.floor} • {r.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Categoria do Problema
                  </label>
                  <select
                    value={manutTipo}
                    onChange={(e) => setManutTipo(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="Ar Condicionado">Ar Condicionado</option>
                    <option value="Hidráulica / Chuveiro / Pia">Hidráulica / Vazamento</option>
                    <option value="Elétrica / Lâmpada / Tomada">Elétrica / Tomadas</option>
                    <option value="Cofre / Fechadura Eletrônica">Fechadura / Cofre</option>
                    <option value="TV / Frigobar / Eletrônicos">TV / Frigobar</option>
                    <option value="Enxoval / Rasgo / Mancha">Enxoval / Cama</option>
                    <option value="Mobiliário / Porta / Janela">Mobiliário / Vidros</option>
                    <option value="Limpeza Pesada / Odor">Limpeza Pesada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nível de Urgência
                  </label>
                  <select
                    value={manutPrioridade}
                    onChange={(e) => setManutPrioridade(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="Baixa">Baixa (Pode aguardar)</option>
                    <option value="Média">Média (Reparo hoje)</option>
                    <option value="Alta">Alta (Antes do check-in)</option>
                    <option value="Urgente">Urgente (Imediato)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Descrição Detalhada do Problema *
                </label>
                <textarea
                  required
                  rows={3}
                  value={manutDescricao}
                  onChange={(e) => setManutDescricao(e.target.value)}
                  placeholder="Ex: Gotejamento constante no dreno do ar condicionado, molhando a cortina lateral..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm placeholder-slate-400 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-600 text-lg shrink-0">info</span>
                <p>
                  Ao salvar, o status do quarto no sistema passará automaticamente para <strong>Manutenção</strong>, pausando a liberação para novas reservas até o técnico finalizar.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalRelatarManutencaoOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">send</span>
                  <span>Registrar Ocorrência</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INSPEÇÃO & APROVAÇÃO (Checklist Completo de Governança) */}
      {modalInspecaoRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-purple-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-700/50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">rate_review</span>
                </div>
                <div>
                  <h3 className="font-bold text-base">Inspeção • Quarto {modalInspecaoRoom.number}</h3>
                  <p className="text-xs text-purple-200">Validação final da governança antes de liberar para a recepção</p>
                </div>
              </div>
              <button onClick={() => setModalInspecaoRoom(null)} className="text-white/70 hover:text-white">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 flex items-center justify-between">
                <span>Higienizado por: <strong>{modalInspecaoRoom.limpoPor}</strong></span>
                <span>Concluído às: <strong>{modalInspecaoRoom.terminoHorario}</strong></span>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Itens de Conferência</h4>
                {modalInspecaoRoom.checklist.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => handleToggleChecklist(modalInspecaoRoom.id, item.id)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                    />
                    <span className="font-medium text-slate-800">{item.label}</span>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalInspecaoRoom(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleConcluirELiberar(modalInspecaoRoom);
                    setModalInspecaoRoom(null);
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">verified</span>
                  <span>Aprovar e Liberar Quarto</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: VER OCORRÊNCIA DE MANUTENÇÃO */}
      {modalOcorrenciaRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">build</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Ocorrência {modalOcorrenciaRoom.ocorrenciaNumero}</h3>
                <p className="text-xs text-slate-500">Quarto {modalOcorrenciaRoom.number} ({modalOcorrenciaRoom.floor})</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Descrição do Problema:</span>
                <p className="font-semibold text-slate-800">{modalOcorrenciaRoom.ocorrenciaDescricao}</p>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between">
                <span className="text-slate-500">Situação da Manutenção:</span>
                <strong className="text-amber-600">Técnico em Atendimento</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOcorrenciaRoom(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Confirmar que a manutenção do Quarto ${modalOcorrenciaRoom.number} foi concluída?`)) {
                    handleIniciarLimpeza(modalOcorrenciaRoom);
                    setModalOcorrenciaRoom(null);
                    showToast(`Quarto ${modalOcorrenciaRoom.number} liberado para limpeza!`);
                  }
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-base">check</span>
                <span>Reparo Concluído (Iniciar Limpeza)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DETALHES DO FRIGOBAR & REPOSIÇÃO */}
      {modalFrigobarRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <span className="material-symbols-outlined text-amber-500 text-2xl">kitchen</span>
                <h3 className="font-bold text-base">Frigobar • Quarto {modalFrigobarRoom.number}</h3>
              </div>
              <button onClick={() => setModalFrigobarRoom(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-500">
                Conferência rápida dos itens consumidos pelo hóspede via WhatsApp / Central de Quarto:
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span>2x Água Mineral sem Gás (500ml)</span>
                  <span className="font-bold text-emerald-600">Confirmado</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span>1x Refrigerante Coca-Cola Lata</span>
                  <span className="font-bold text-emerald-600">Confirmado</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span>1x Barra de Chocolate Nestlé</span>
                  <span className="font-bold text-slate-400">Intacto</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalFrigobarRoom(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  showToast(`Frigobar do Quarto ${modalFrigobarRoom.number} abastecido com sucesso!`);
                  setModalFrigobarRoom(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-base">check</span>
                <span>Confirmar Reposição 100%</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: DETALHES COMPLETOS DO QUARTO (ℹ) */}
      {modalInfoRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{modalInfoRoom.floor}</span>
                <h3 className="text-xl font-black text-slate-900">Quarto {modalInfoRoom.number}</h3>
                <p className="text-xs text-slate-500">{modalInfoRoom.category}</p>
              </div>
              <button onClick={() => setModalInfoRoom(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-400 block">Status Atual:</span>
                  <strong className="text-slate-800 uppercase">{modalInfoRoom.hkStatus.replace('_', ' ')}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Enxoval Padrão:</span>
                  <strong className="text-slate-800">{modalInfoRoom.enxoval}</strong>
                </div>
              </div>

              {modalInfoRoom.guestName && (
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                  <span className="text-[10px] text-blue-600 block">Hóspede Atual:</span>
                  <strong className="text-blue-950 font-bold text-sm">{modalInfoRoom.guestName}</strong>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalInfoRoom(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: MEUS DADOS & ESCALA */}
      {modalEscalaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                  {loggedUser.iniciais}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">{loggedUser.nome}</h3>
                  <p className="text-xs text-slate-500">{loggedUser.cargo || 'Camareira'} • {hotelInfo.nome}</p>
                </div>
              </div>
              <button onClick={() => setModalEscalaOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100 space-y-1">
                <span className="text-[10px] text-emerald-800 font-bold uppercase">Turno Ativo</span>
                <p className="text-emerald-950 font-bold text-sm">07:00 às 15:20 (Escala 6x1)</p>
                <p className="text-slate-500 text-[11px]">Setor: {andaresAtendidos} • {hotelInfo.nome}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <span className="text-xl font-black text-emerald-600">{prontosCount}</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Quartos Limpos Hoje</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <span className="text-xl font-black text-blue-600">22 min</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Tempo Médio / Quarto</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalEscalaOpen(false)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PainelCamareira;
