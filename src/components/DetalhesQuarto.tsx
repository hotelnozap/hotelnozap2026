import React, { useState, useEffect, useMemo } from 'react';
import { PublicHotel } from './CatalogoHoteis';
import { QuartoCadastrado, slugify } from './PaginaHotel';
import {
  hoteisService,
  quartosService,
  reservasService,
  destaquesQuartoService,
  comodidadesService,
  hospedesService,
  DestaqueQuarto,
  cleanIconClass,
} from '../services/supabaseService';
import { supabase } from '../lib/supabase';
import { maskCpfCnpj, maskCep, maskPhone } from '../utils/masks';
import { fetchAddressByCep } from '../utils/viacep';
import { webhookN8nService } from '../services/webhookN8nService';

export interface DetalhesQuartoProps {
  hotel?: PublicHotel | null;
  hotelSlug?: string;
  quarto?: QuartoCadastrado | null;
  roomSlug?: string;
  onNavigateToHotel?: () => void;
  onNavigateToCatalog?: () => void;
  onNavigateToLogin?: () => void;
  onNavigateToMinhaConta?: () => void;
}

export const DetalhesQuarto: React.FC<DetalhesQuartoProps> = ({
  hotel: propHotel,
  hotelSlug: propHotelSlug,
  quarto: propQuarto,
  roomSlug: propRoomSlug,
  onNavigateToHotel,
  onNavigateToCatalog,
  onNavigateToLogin,
  onNavigateToMinhaConta,
}) => {
  const [currentHotel, setCurrentHotel] = useState<PublicHotel | null>(propHotel || null);
  const [currentQuarto, setCurrentQuarto] = useState<QuartoCadastrado | null>(propQuarto || null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activePhoto, setActivePhoto] = useState<string>('');
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [quartoDestaques, setQuartoDestaques] = useState<DestaqueQuarto[]>([]);
  const [isModalFotosOpen, setIsModalFotosOpen] = useState<boolean>(false);
  const [modalPhotoIndex, setModalPhotoIndex] = useState<number>(0);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState<boolean>(false);

  // Formata data YYYY-MM-DD para DD/MM/YYYY
  const formatarDataBR = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Datas de Check-in e Check-out
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Regra de Negócio: Não permitir reservas com mais de 30 dias de antecedência
  const getMaxCheckInStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Data máxima permitida para check-out (máximo 30 dias a partir da data de check-in)
  const getMaxCheckOutStr = (baseCheckIn?: string) => {
    const base = baseCheckIn || getTodayStr();
    const d = new Date(base + 'T12:00:00');
    d.setDate(d.getDate() + 30);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [checkInDate, setCheckInDate] = useState<string>(() => getTodayStr());
  const [checkOutDate, setCheckOutDate] = useState<string>(() => getTomorrowStr());

  // Estados dos Modais Inteligentes de Reserva e Autenticação
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'cadastro'>('login');
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [isAvisoLimpezaModalOpen, setIsAvisoLimpezaModalOpen] = useState<boolean>(false);
  const [isHotelUserBloqueadoModalOpen, setIsHotelUserBloqueadoModalOpen] = useState<boolean>(false);
  const [reservaConfirmadaData, setReservaConfirmadaData] = useState<any>(null);
  const [submittingReserva, setSubmittingReserva] = useState<boolean>(false);
  const [isQuartoOcupado, setIsQuartoOcupado] = useState<boolean>(false);

  // Status Inteligente: Quarto em Limpeza
  const isQuartoEmLimpeza = (currentQuarto?.status || '').toLowerCase() === 'limpeza';

  // Estados de formulário para Login no Modal
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Estados de formulário para Cadastro Completo de Hóspede (Tabela Hospedes)
  const [cadNome, setCadNome] = useState<string>('');
  const [cadEmail, setCadEmail] = useState<string>('');
  const [cadTelefone, setCadTelefone] = useState<string>('');
  const [cadCpf, setCadCpf] = useState<string>('');
  const [cadSenha, setCadSenha] = useState<string>('');
  const [cadCep, setCadCep] = useState<string>('');
  const [cadLogradouro, setCadLogradouro] = useState<string>('');
  const [cadNumero, setCadNumero] = useState<string>('');
  const [cadComplemento, setCadComplemento] = useState<string>('');
  const [cadBairro, setCadBairro] = useState<string>('');
  const [cadCidade, setCadCidade] = useState<string>('');
  const [cadEstadoUf, setCadEstadoUf] = useState<string>('');
  const [cadObservacoes, setCadObservacoes] = useState<string>('');
  const [isLoadingCep, setIsLoadingCep] = useState<boolean>(false);

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCep(e.target.value);
    setCadCep(masked);
    const cleanCep = masked.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      setIsLoadingCep(true);
      try {
        const data = await fetchAddressByCep(cleanCep);
        if (data) {
          if (data.logradouro) setCadLogradouro(data.logradouro);
          if (data.bairro) setCadBairro(data.bairro);
          if (data.localidade) setCadCidade(data.localidade);
          if (data.uf) setCadEstadoUf(data.uf);
          if (data.complemento && !cadComplemento) setCadComplemento(data.complemento);
        }
      } catch (err) {
        console.warn('Erro ao consultar ViaCEP:', err);
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  // Retorna o título explícito com o tipo do quarto (ex: "Casal - Quarto 100", "Solteiro - Quarto 100", "Triplo - Quarto 100")
  const getTituloExplicitoQuarto = (quarto?: QuartoCadastrado | null) => {
    if (!quarto) return '';
    const cat = (quarto.category || '').trim();
    const name = (quarto.name || '').trim();
    const num = (quarto.number || '').trim();

    // Normaliza capitalização (ex: "CASAL" -> "Casal")
    const catFormatada = cat
      ? cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()
      : '';

    // Se já tiver a categoria dentro do nome (ex: "Casal - Quarto 100" ou "Suíte Casal")
    if (catFormatada && name.toLowerCase().includes(catFormatada.toLowerCase())) {
      return name;
    }

    if (catFormatada) {
      const nomeBase = name || (num ? `Quarto ${num}` : '');
      return `${catFormatada} - ${nomeBase}`;
    }

    return name || (num ? `Quarto ${num}` : 'Acomodação');
  };

  // Cálculo Dinâmico de Diárias e Valor Total
  const totalNoites = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 1;
    const d1 = new Date(checkInDate + 'T12:00:00');
    const d2 = new Date(checkOutDate + 'T12:00:00');
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  }, [checkInDate, checkOutDate]);

  const valorTotalCalculado = useMemo(() => {
    const diaria = Number(currentQuarto?.dailyPrice) || 0;
    return diaria * totalNoites;
  }, [currentQuarto?.dailyPrice, totalNoites]);

  // Validação em tempo real: impede qualquer reserva com mais de 30 dias de antecedência ou superior a 30 diárias
  const isReservaMaisDe30Dias = useMemo(() => {
    const maxIn = getMaxCheckInStr();
    const maxOut = getMaxCheckOutStr(checkInDate);
    return checkInDate > maxIn || checkOutDate > maxOut || totalNoites > 30;
  }, [checkInDate, checkOutDate, totalNoites]);

  const handleCheckInChange = (newCheckIn: string) => {
    const maxDate = getMaxCheckInStr();
    if (newCheckIn > maxDate) {
      setToastMessage(`Não é permitido reservas com mais de 30 dias de antecedência (máximo até ${formatarDataBR(maxDate)}).`);
      setTimeout(() => setToastMessage(null), 4000);
      setCheckInDate(maxDate);
      return;
    }
    setCheckInDate(newCheckIn);

    const maxCheckOut = getMaxCheckOutStr(newCheckIn);
    const nextDay = new Date(newCheckIn + 'T12:00:00');
    nextDay.setDate(nextDay.getDate() + 1);
    const year = nextDay.getFullYear();
    const month = String(nextDay.getMonth() + 1).padStart(2, '0');
    const day = String(nextDay.getDate()).padStart(2, '0');
    const nextDayStr = `${year}-${month}-${day}`;

    // Se o check-out for anterior ao novo check-in ou ultrapassar 30 dias, recalcula
    if (newCheckIn >= checkOutDate || checkOutDate > maxCheckOut) {
      setCheckOutDate(nextDayStr);
    }
  };

  const handleCheckOutChange = (newCheckOut: string) => {
    if (newCheckOut <= checkInDate) {
      setToastMessage('A data de check-out deve ser posterior ao check-in.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    const maxCheckOut = getMaxCheckOutStr(checkInDate);
    if (newCheckOut > maxCheckOut) {
      setToastMessage(`Não permitimos reservas com mais de 30 dias (máximo permitido até ${formatarDataBR(maxCheckOut)}).`);
      setTimeout(() => setToastMessage(null), 4000);
      setCheckOutDate(maxCheckOut);
      return;
    }
    setCheckOutDate(newCheckOut);
  };

  const galleryImages = React.useMemo(() => {
    const list: string[] = [];

    const isUnsplashStock = (url: string) => {
      if (!url) return false;
      return url.includes('images.unsplash.com');
    };

    const isHotelPhoto = (url: string) => {
      if (!url || !currentHotel?.imageUrl) return false;
      return url === currentHotel.imageUrl;
    };

    // 1. Fotos cadastradas no array de fotos do quarto
    if (Array.isArray(currentQuarto?.photos)) {
      currentQuarto.photos.forEach((p: string) => {
        if (p && !p.startsWith('blob:') && !isUnsplashStock(p) && !isHotelPhoto(p) && !list.includes(p)) {
          list.push(p);
        }
      });
    }

    // 2. Foto de capa do quarto
    const capa = currentQuarto?.fotoCapa || currentQuarto?.imageUrl;
    if (capa && !capa.startsWith('blob:') && !isUnsplashStock(capa) && !isHotelPhoto(capa) && !list.includes(capa)) {
      list.unshift(capa);
    }

    return list;
  }, [currentQuarto, currentHotel]);

  // Prepara as fotos para a grade de desktop estilo Airbnb (1 principal + 4 em grade 2x2) conforme anexo
  const desktopGridPhotos = React.useMemo(() => {
    if (galleryImages.length === 0) return [];
    if (galleryImages.length >= 5) return galleryImages.slice(0, 5);
    
    // Se tiver menos de 5 fotos, complementa para preencher os 5 slots da grade idêntica ao anexo
    const list = [...galleryImages];
    if (currentHotel?.imageUrl && !list.includes(currentHotel.imageUrl)) {
      list.push(currentHotel.imageUrl);
    }
    let i = 0;
    while (list.length < 5) {
      list.push(galleryImages[i % galleryImages.length]);
      i++;
    }
    return list.slice(0, 5);
  }, [galleryImages, currentHotel]);

  React.useEffect(() => {
    setCurrentSlideIndex(0);
  }, [currentQuarto?.id]);

  // Atalhos de teclado e bloqueio de scroll quando o modal de fotos estiver aberto
  useEffect(() => {
    if (!isModalFotosOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalFotosOpen(false);
      } else if (e.key === 'ArrowRight') {
        setModalPhotoIndex((prev) => (prev < galleryImages.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowLeft') {
        setModalPhotoIndex((prev) => (prev > 0 ? prev - 1 : galleryImages.length - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isModalFotosOpen, galleryImages.length]);



  useEffect(() => {
    loadRoomDetails();

    const handleRoomRefresh = () => {
      loadRoomDetails();
    };

    window.addEventListener('hotel_quarto_atualizado', handleRoomRefresh);
    window.addEventListener('hotel_reserva_modificada', handleRoomRefresh);
    window.addEventListener('storage', handleRoomRefresh);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('hotel_notifications_channel');
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'CHECKOUT_REALIZADO' || ev.data?.type === 'NOVA_RESERVA_HOSPEDE') {
          loadRoomDetails();
        }
      };
    } catch {}

    return () => {
      window.removeEventListener('hotel_quarto_atualizado', handleRoomRefresh);
      window.removeEventListener('hotel_reserva_modificada', handleRoomRefresh);
      window.removeEventListener('storage', handleRoomRefresh);
      if (bc) {
        try { bc.close(); } catch {}
      }
    };
  }, [propHotel, propHotelSlug, propQuarto, propRoomSlug]);

  useEffect(() => {
    if (!currentQuarto) {
      setQuartoDestaques([]);
      return;
    }
    const loadDestaques = async () => {
      try {
        const data = await destaquesQuartoService.getDestaquesDoQuarto(currentQuarto.id);
        setQuartoDestaques(data || []);
      } catch (err) {
        console.warn('Erro ao carregar destaques do quarto:', err);
      }
    };
    loadDestaques();

    const handleAtualizacao = () => loadDestaques();
    window.addEventListener('hotel_novo_destaque_quarto', handleAtualizacao);
    window.addEventListener('hotel_quarto_destaques_atualizado', handleAtualizacao);
    return () => {
      window.removeEventListener('hotel_novo_destaque_quarto', handleAtualizacao);
      window.removeEventListener('hotel_quarto_destaques_atualizado', handleAtualizacao);
    };
  }, [currentQuarto]);

  const loadRoomDetails = async () => {
    setLoading(true);
    try {
      let resolvedHotel = propHotel || null;
      let resolvedQuarto = propQuarto || null;

      const path = window.location.pathname;
      const pathParts = path.split('/').filter(Boolean); // ['hotel', 'hotelSlug', 'roomSlug']
      const urlHotelSlug = propHotelSlug || pathParts[1] || '';
      const urlRoomSlug = propRoomSlug || pathParts[2] || '';

      // 1. Resolver Hotel se não veio via prop
      if (!resolvedHotel) {
        const dbHoteis = await hoteisService.getHoteis();
        const mappedDbHoteis: PublicHotel[] = (dbHoteis || []).map(h => {
          const cityParts = h.cityUf ? h.cityUf.split('/') : ['Ipojuca', 'PE'];
          const cName = cityParts[0]?.trim() || 'Ipojuca';
          const ufName = cityParts[1]?.trim() || 'PE';
          const roomsCount = h.capacity > 0 ? h.capacity : 10;

          return {
            id: h.id,
            name: h.name,
            category: h.category || 'Hotel & Pousada',
            city: cName,
            uf: ufName,
            neighborhood: h.neighborhood || 'Centro / Orla',
            imageUrl: h.imageUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80',
            rating: 4.90,
            reviewsCount: 45,
            pricePerNight: 220,
            whatsappPhone: h.managerPhone ? h.managerPhone.replace(/\D/g, '') : '5581998765432',
            cancellationText: 'Cancelamento flexível via Zap',
            capacity: roomsCount,
            roomTitle: `Acomodação com ${roomsCount} quartos`,
            amenities: [
              { icon: 'bedroom_parent', label: `${roomsCount} Quartos` },
              { icon: 'wifi', label: 'Wi-Fi Grátis' },
              { icon: 'directions_car', label: 'Garagem: Sim' },
              { icon: 'ac_unit', label: 'Ar Condicionado' }
            ]
          };
        });

        const allHoteis = mappedDbHoteis;
        resolvedHotel = allHoteis.find(h => slugify(h.name) === urlHotelSlug || h.id === urlHotelSlug) || allHoteis[0];
      }

      setCurrentHotel(resolvedHotel);

      // 1b. Carregar comodidades do hotel (nível estabelecimento)
      if (resolvedHotel?.id) {
        try {
          const comodidades = await comodidadesService.getCategoriasByHotelId(resolvedHotel.id);
          if (comodidades && comodidades.length > 0) {
            setCurrentHotel(prev => prev ? { ...prev, comodidades } : prev);
          }
        } catch (err) {
          console.warn('Falha ao carregar comodidades do hotel', err);
        }
      }

      // 2. Resolver Quarto se não veio via prop
      if (!resolvedQuarto && resolvedHotel) {
        const hotelIdForRooms = resolvedHotel.id || '11111111-1111-1111-1111-111111111111';
        const dbQuartos = await quartosService.getQuartos(hotelIdForRooms);
        let hotelQuartos: QuartoCadastrado[] = [];

        if (dbQuartos && dbQuartos.length > 0) {
          hotelQuartos = dbQuartos.map((q, idx) => {
            const roomPhotos = (Array.isArray(q.photos) && q.photos.length > 0
              ? q.photos
              : (q.fotoCapa ? [q.fotoCapa] : []).concat(q.imageUrl ? [q.imageUrl] : []))
              .filter((p: string) => p && !p.startsWith('blob:') && !p.includes('images.unsplash.com') && p !== resolvedHotel?.imageUrl);

            const hasRealPhoto = roomPhotos.length > 0 || (q.fotoCapa && !q.fotoCapa.includes('images.unsplash.com') && q.fotoCapa !== resolvedHotel?.imageUrl);
            const chosenImage = hasRealPhoto 
              ? (roomPhotos[0] || q.fotoCapa || (q.imageUrl && !q.imageUrl.includes('images.unsplash.com') && q.imageUrl !== resolvedHotel?.imageUrl ? q.imageUrl : '') || '')
              : '';

            const roomNum = String(q.number || q.numero || `${101 + idx}`);
            const roomName = q.name || `Quarto ${roomNum}`;
            const roomCat = (q.category || q.categoria || q.tipo || 'STANDARD').toUpperCase();
            const roomPrice = Number(q.dailyPrice || q.valor_diaria) || (resolvedHotel?.pricePerNight || 220);
            const roomCap = Number(q.capacity || q.capacidade) || 2;
            const rawItems = q.items;

            const roomNotes = q.notes || q.observacoes || '';
            const roomComodidades = (rawItems?.comodidades && Array.isArray(rawItems.comodidades)) ? rawItems.comodidades : (q.comodidades || []);

            return {
              id: String(q.id || `q-${idx}`),
              hotel_id: q.hotel_id || resolvedHotel?.id,
              number: roomNum,
              name: roomName,
              category: roomCat,
              capacity: roomCap,
              dailyPrice: roomPrice,
              description: roomNotes || `Quarto ${roomNum} (${roomCat}) preparado com acabamento de alto padrão.`,
              notes: roomNotes,
              observacoes: roomNotes,
              imageUrl: chosenImage,
              photos: roomPhotos,
              videoUrl: q.videoUrl || q.video_url || q.items?.videoUrl || q.items?.video || q.video || '',
              status: q.status || 'disponivel',
              amenities: [],
              items: (rawItems && typeof rawItems === 'object') ? rawItems : {},
              comodidades: roomComodidades
            };
          });
        }



        if (urlRoomSlug) {
          resolvedQuarto = hotelQuartos.find(q => slugify(q.name) === urlRoomSlug || q.id === urlRoomSlug || q.number === urlRoomSlug) || null;
        }

        if (!resolvedQuarto) {
          resolvedQuarto = hotelQuartos[0];
        }

        if (hotelQuartos.length > 0 && resolvedHotel) {
          const validPrices = hotelQuartos.map(q => Number(q.dailyPrice)).filter(p => !isNaN(p) && p > 0);
          if (validPrices.length > 0) {
            resolvedHotel = { ...resolvedHotel, pricePerNight: Math.min(...validPrices) };
            setCurrentHotel(resolvedHotel);
          }
        }
      }

      // 3. Atualizar com o status mais recente (ex: se acabou de receber check-out e foi para 'limpeza')
      if (resolvedQuarto && resolvedHotel?.id) {
        try {
          const targetQId = resolvedQuarto.id;
          const targetQNum = resolvedQuarto.number;
          const localKey = `hotelnozap_quartos_${resolvedHotel.id}`;
          const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
          const localRoom = localData.find((q: any) => 
            (targetQId && String(q.id) === String(targetQId)) || 
            (targetQNum && String(q.number || q.numero).trim() === String(targetQNum).trim())
          );
          if (localRoom?.status) {
            resolvedQuarto = { ...resolvedQuarto, status: localRoom.status };
          }

          const { data: dbRoom } = await supabase
            .from('quartos')
            .select('status')
            .eq('id', targetQId)
            .maybeSingle();
          if (dbRoom?.status) {
            resolvedQuarto = { ...resolvedQuarto, status: dbRoom.status };
          }
        } catch (statusErr) {
          console.warn('Aviso ao sincronizar status do quarto:', statusErr);
        }
      }

      setCurrentQuarto(resolvedQuarto);
      if (resolvedQuarto?.imageUrl) setActivePhoto(resolvedQuarto.imageUrl);
      else if (resolvedHotel?.imageUrl) setActivePhoto(resolvedHotel.imageUrl);

      // 4. Verificar se este quarto possui reserva ativa ou status ocupado (quartos em limpeza estão LIBERADOS para reserva)
      if (resolvedQuarto && resolvedHotel?.id) {
        try {
          const { data: activeRes } = await supabase
            .from('reservas')
            .select('id, status, numero_quarto, quarto_id')
            .eq('hotel_id', resolvedHotel.id)
            .in('status', ['Confirmada', 'Hospedado', 'confirmada', 'hospedado']);

          const isReserved = (activeRes || []).some((r: any) => {
            const matchId = r.quarto_id && String(r.quarto_id) === String(resolvedQuarto?.id);
            const matchNum = r.numero_quarto && String(r.numero_quarto).trim() === String(resolvedQuarto?.number).trim();
            return matchId || matchNum;
          });

          const qStat = (resolvedQuarto.status || '').toLowerCase();
          const isStatusOccupied = qStat === 'ocupado' || qStat === 'reservado';
          setIsQuartoOcupado(isReserved || isStatusOccupied);
        } catch (occupancyErr) {
          console.warn('Aviso ao checar ocupação do quarto:', occupancyErr);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar detalhes do quarto:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${currentQuarto?.name || 'Acomodação'} - ${currentHotel?.name || 'Hotel no Zap'}`,
        text: `Confira este quarto incrível no hotel ${currentHotel?.name} com reserva direta pelo WhatsApp!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Link do quarto copiado para a área de transferência!');
    }
  };

  // REGRA DE NEGÓCIO: Usuários com perfil Hotel não podem fazer reservas para si mesmos
  const isUsuarioPerfilHotel = async (email?: string): Promise<boolean> => {
    const savedRole = (localStorage.getItem('hotelnozap_user_role') || '').toLowerCase().trim();
    if (savedRole === 'hotel' || savedRole.includes('gerente')) {
      return true;
    }

    const emailToCheck = (email || localStorage.getItem('hotelnozap_user_email') || '').toLowerCase().trim();
    if (!emailToCheck) return false;

    try {
      const { data: dbUser } = await supabase
        .from('usuarios')
        .select('id, perfil, cargo, hotel_id')
        .ilike('email', emailToCheck)
        .maybeSingle();

      if (dbUser) {
        const pLower = (dbUser.perfil || '').toLowerCase().trim();
        const cLower = (dbUser.cargo || '').toLowerCase().trim();
        if (pLower === 'hotel' || pLower.includes('hotel') || pLower.includes('gerente') || cLower.includes('gerente')) {
          return true;
        }
      }
    } catch (err) {
      console.warn('Erro ao verificar perfil hotel:', err);
    }
    return false;
  };

  // Helper para verificar se há sessão ativa de hóspede logado
  const getGuestSession = async () => {
    // Se o usuário logado tiver perfil Hotel, não retorna sessão de hóspede
    const isHotel = await isUsuarioPerfilHotel();
    if (isHotel) return null;

    const savedEmail = localStorage.getItem('hotelnozap_user_email');
    const savedName = localStorage.getItem('hotelnozap_user_name');

    let sessionUser: any = null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      sessionUser = sessionData?.session?.user;
    } catch {}

    const emailToUse = savedEmail || sessionUser?.email;
    if (!emailToUse) return null;

    try {
      const perfil = await hospedesService.getPerfilHospedeLogado(emailToUse);
      if (perfil) {
        return {
          id: perfil.id,
          nome: perfil.nome || savedName || 'Hóspede',
          email: perfil.email || emailToUse,
          telefone: perfil.telefone || '',
          cpf: perfil.cpf || ''
        };
      }
    } catch (err) {
      console.warn('Erro ao buscar perfil do hóspede:', err);
    }

    return {
      id: sessionUser?.id || 'guest-session',
      nome: savedName || sessionUser?.user_metadata?.nome || sessionUser?.user_metadata?.name || emailToUse.split('@')[0],
      email: emailToUse,
      telefone: sessionUser?.user_metadata?.telefone || '',
      cpf: sessionUser?.user_metadata?.cpf || ''
    };
  };

  // Efetua a reserva no banco de dados e notifica imediatamente a recepção do hotel
  const executarReservaFinal = async (guest: { id?: string; nome: string; email: string; telefone?: string; cpf?: string }) => {
    if (!currentHotel || !currentQuarto) return;
    setSubmittingReserva(true);

    try {
      const quartoNumero = currentQuarto.number || currentQuarto.name;
      const hotelIdToUse = currentQuarto.hotel_id || currentHotel.id;

      const reservaCreated = await reservasService.createReserva({
        nome_hospede: guest.nome || 'Hóspede',
        numero_quarto: quartoNumero,
        data_checkin: checkInDate,
        data_checkout: checkOutDate,
        valor_total: valorTotalCalculado,
        hotel_id: hotelIdToUse,
        quarto_id: currentQuarto.id,
        hospede_id: guest.id && guest.id.length > 10 ? guest.id : undefined,
        status: 'Confirmada',
        observacoes: `Reserva online via Hotel no Zap pelo Hóspede VIP ${guest.nome} (${guest.email})`
      });

      if (!reservaCreated) {
        throw new Error('Não foi possível gravar a reserva no banco de dados. Tente novamente.');
      }

      // Dispara notificação inteligente em tempo real para a tela do hotel
      const payloadNotif = {
        id: reservaCreated.id || `res-${Date.now()}`,
        hotelId: hotelIdToUse,
        hotelNome: currentHotel.name,
        nome_hospede: guest.nome,
        hospedeNome: guest.nome,
        quarto_nome: `Quarto ${quartoNumero}`,
        numero_quarto: quartoNumero,
        quartoNumero: quartoNumero,
        check_in: checkInDate,
        check_out: checkOutDate,
        diarias: totalNoites,
        valor_total: valorTotalCalculado,
        itemNome: `Reserva ${currentQuarto.name} (${totalNoites} ${totalNoites === 1 ? 'diária' : 'diárias'})`,
        categoria: 'Nova Reserva',
        horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString()
      };

      // 1. BroadcastChannel para outras abas/janelas
      try {
        const bc = new BroadcastChannel('hotel_notifications_channel');
        bc.postMessage({ type: 'NOVA_RESERVA_HOSPEDE', data: payloadNotif });
        bc.close();
      } catch {}

      // 2. Storage Event
      try {
        localStorage.setItem('hotel_nova_reserva_trigger', JSON.stringify({
          ...payloadNotif,
          _triggerUid: `${Date.now()}_${Math.random()}`
        }));
      } catch {}

      // 3. Supabase Realtime broadcast
      try {
        const rtChannel = supabase.channel('realtime_hotel_notifications');
        rtChannel.send({
          type: 'broadcast',
          event: 'solicitacao_hospede',
          payload: payloadNotif
        });
      } catch {}

      setReservaConfirmadaData({
        ...payloadNotif,
        reservaNumber: reservaCreated?.reservaNumber || `#RES-${Date.now().toString().slice(-6)}`,
        quartoNome: currentQuarto.name,
        hotelNome: currentHotel.name,
        whatsapp: currentHotel.whatsappPhone || currentHotel.whatsapp
      });

      setIsAuthModalOpen(false);
      setIsSuccessModalOpen(true);
      showToast('🎉 Reserva confirmada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao efetuar reserva:', err);
      showToast('Erro ao confirmar reserva. Tente novamente.');
    } finally {
      setSubmittingReserva(false);
    }
  };

  // Dispara o fluxo de reserva (login ou reserva imediata se logado)
  const prosseguirFluxoReserva = async () => {
    setAuthError('');

    // REGRA DE NEGÓCIO: Não permitir reservas com mais de 30 dias de antecedência ou superior a 30 diárias
    const maxIn = getMaxCheckInStr();
    const maxOut = getMaxCheckOutStr(checkInDate);
    if (checkInDate > maxIn || checkOutDate > maxOut || totalNoites > 30) {
      setToastMessage(`Não é permitido realizar reservas com mais de 30 dias (máximo permitido até ${formatarDataBR(maxOut)}).`);
      setTimeout(() => setToastMessage(null), 4500);
      return;
    }

    // REGRA DE NEGÓCIO: Usuários com perfil Hotel não podem fazer reservas para si mesmos
    const isHotel = await isUsuarioPerfilHotel();
    if (isHotel) {
      setIsHotelUserBloqueadoModalOpen(true);
      showToast('Usuários com perfil Hotel não podem fazer reservas para si mesmos.');
      return;
    }

    const guest = await getGuestSession();

    if (!guest) {
      // NÃO está logado: Abre o modal para login ou cadastro
      setAuthModalTab('login');
      setIsAuthModalOpen(true);
      return;
    }

    // JÁ ESTÁ LOGADO: Efetua a reserva imediatamente com os dados do mesmo!
    await executarReservaFinal(guest);
  };

  // Clique no botão "RESERVAR AGORA":
  // O usuário NÃO precisa estar logado para ser informado e bloqueado sobre o limite de 30 dias!
  const handleCliqueReservar = async () => {
    // REGRA DE NEGÓCIO: Bloqueia imediatamente antes de abrir qualquer modal
    const maxIn = getMaxCheckInStr();
    const maxOut = getMaxCheckOutStr(checkInDate);
    if (checkInDate > maxIn || checkOutDate > maxOut || totalNoites > 30) {
      setToastMessage(`Não é permitido realizar reservas com mais de 30 dias (máximo permitido até ${formatarDataBR(maxOut)}).`);
      setTimeout(() => setToastMessage(null), 4500);
      return;
    }

    // REGRA DE NEGÓCIO: Usuários com perfil Hotel não podem fazer reservas para si mesmos
    const isHotel = await isUsuarioPerfilHotel();
    if (isHotel) {
      setIsHotelUserBloqueadoModalOpen(true);
      showToast('Usuários com perfil Hotel não podem fazer reservas para si mesmos.');
      return;
    }

    if (isQuartoEmLimpeza) {
      setIsAvisoLimpezaModalOpen(true);
      return;
    }

    await prosseguirFluxoReserva();
  };

  // Confirmar no modal de aviso de limpeza e avançar com a reserva
  const handleConfirmarAvisoLimpeza = async () => {
    setIsAvisoLimpezaModalOpen(false);

    // REGRA DE NEGÓCIO: Usuários com perfil Hotel não podem fazer reservas para si mesmos
    const isHotel = await isUsuarioPerfilHotel();
    if (isHotel) {
      setIsHotelUserBloqueadoModalOpen(true);
      showToast('Usuários com perfil Hotel não podem fazer reservas para si mesmos.');
      return;
    }

    await prosseguirFluxoReserva();
  };

  // Submeter Login do Hóspede dentro do Modal
  const handleSubmeterLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const cleanEmail = loginEmail.trim().toLowerCase();
    if (!cleanEmail || !loginPassword) {
      setAuthError('Informe seu e-mail e sua senha para continuar.');
      return;
    }

    // REGRA DE NEGÓCIO: Checagem prévia se o e-mail pertence a um usuário de perfil Hotel
    const isHotelPreCheck = await isUsuarioPerfilHotel(cleanEmail);
    if (isHotelPreCheck) {
      setAuthError('Usuários com perfil de Hotel não podem fazer reservas para si mesmos. Por favor, utilize uma conta de hóspede.');
      return;
    }

    setAuthLoading(true);

    try {
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: loginPassword
      });

      if (authErr) {
        setAuthError('E-mail ou senha inválidos. Verifique suas credenciais ou cadastre-se.');
        setAuthLoading(false);
        return;
      }

      const authUser = authData.user;

      // Validação no banco se o usuário autenticado possui perfil de Hotel
      const { data: dbUser } = await supabase
        .from('usuarios')
        .select('id, perfil, cargo, hotel_id')
        .ilike('email', authUser.email || cleanEmail)
        .maybeSingle();

      if (dbUser) {
        const pLower = (dbUser.perfil || '').toLowerCase().trim();
        const cLower = (dbUser.cargo || '').toLowerCase().trim();
        if (pLower === 'hotel' || pLower.includes('hotel') || pLower.includes('gerente') || cLower.includes('gerente')) {
          setAuthError('Usuários com perfil de Hotel não podem fazer reservas para si mesmos. Por favor, utilize uma conta de hóspede.');
          setAuthLoading(false);
          return;
        }
      }

      let perfil: any = null;
      try {
        perfil = await hospedesService.getPerfilHospedeLogado(authUser.email || cleanEmail);
      } catch {}

      const guestNome = perfil?.nome || authUser.user_metadata?.nome || authUser.user_metadata?.name || cleanEmail.split('@')[0];

      localStorage.setItem('hotelnozap_user_role', 'Hóspede');
      localStorage.setItem('hotelnozap_user_email', authUser.email || cleanEmail);
      localStorage.setItem('hotelnozap_user_name', guestNome);
      localStorage.setItem('hotelnozap_last_authenticated_at', new Date().toISOString());
      window.dispatchEvent(new CustomEvent('user_role_changed', { detail: 'Hóspede' }));

      const guestObj = {
        id: authUser.id,
        nome: guestNome,
        email: authUser.email || cleanEmail,
        telefone: perfil?.telefone || '',
        cpf: perfil?.cpf || ''
      };

      // Imediatamente conclui a reserva
      await executarReservaFinal(guestObj);
    } catch (err: any) {
      setAuthError(err?.message || 'Erro ao efetuar login.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Submeter Cadastro Rápido do Hóspede dentro do Modal
  const handleSubmeterCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const cleanNome = cadNome.trim();
    const cleanEmail = cadEmail.trim().toLowerCase();
    if (!cleanNome || !cleanEmail || !cadSenha) {
      setAuthError('Preencha seu nome completo, e-mail e uma senha de acesso.');
      return;
    }
    if (cadSenha.length < 6) {
      setAuthError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    // REGRA DE NEGÓCIO: Checa se o e-mail informado pertence a um usuário de perfil Hotel
    const isHotelPreCheck = await isUsuarioPerfilHotel(cleanEmail);
    if (isHotelPreCheck) {
      setAuthError('Este e-mail pertence a um usuário com perfil Hotel. Usuários de hotel não podem fazer reservas para si mesmos.');
      return;
    }

    setAuthLoading(true);

    try {
      const cityStateStr = cadCidade.trim()
        ? `${cadCidade.trim()}${cadEstadoUf.trim() ? '/' + cadEstadoUf.trim().toUpperCase() : ''}`
        : '';

      const res = await hospedesService.createHospedeFull({
        nome: cleanNome,
        email: cleanEmail,
        telefone: cadTelefone.trim(),
        cpf_passaporte: cadCpf.trim(),
        senha: cadSenha,
        hotel_id: currentHotel?.id,
        status: 'ativo',
        cep: cadCep.trim() || undefined,
        logradouro: cadLogradouro.trim() || undefined,
        numero: cadNumero.trim() || undefined,
        bairro: cadBairro.trim() || undefined,
        cidade_uf: cityStateStr || undefined,
        observacoes: cadObservacoes.trim() || (cadComplemento.trim() ? `Compl: ${cadComplemento.trim()}` : undefined)
      });

      if (!res.success && res.error) {
        setAuthError(res.error);
        setAuthLoading(false);
        return;
      }

      // Autentica o hóspede recém-criado
      try {
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cadSenha
        });
      } catch {}

      localStorage.setItem('hotelnozap_user_role', 'Hóspede');
      localStorage.setItem('hotelnozap_user_email', cleanEmail);
      localStorage.setItem('hotelnozap_user_name', cleanNome);
      localStorage.setItem('hotelnozap_last_authenticated_at', new Date().toISOString());
      window.dispatchEvent(new CustomEvent('user_role_changed', { detail: 'Hóspede' }));

      const guestObj = {
        nome: cleanNome,
        email: cleanEmail,
        telefone: cadTelefone.trim(),
        cpf: cadCpf.trim()
      };

      // Imediatamente conclui a reserva com o cadastro criado
      await executarReservaFinal(guestObj);
    } catch (err: any) {
      setAuthError(err?.message || 'Erro ao criar cadastro do hóspede.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Contato geral com o WhatsApp da recepção do hotel
  const openWhatsAppReservation = () => {
    if (!currentHotel) return;
    const rawPhone = currentHotel.whatsappPhone ? currentHotel.whatsappPhone.replace(/\D/g, '') : '5581998765432';
    const formattedPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
    const msgText = `Olá! Gostaria de informações sobre o ${currentQuarto?.name || 'quarto'} no ${currentHotel.name}.`;
    const msg = encodeURIComponent(msgText);

    webhookN8nService.dispararWebhookAtendimento({
      hotel: currentHotel,
      mensagem: msgText,
      origem: 'detalhes_quarto_contato_whatsapp'
    }).catch(() => {});

    window.open(`https://wa.me/${formattedPhone}?text=${msg}`, '_blank');
  };

  // Envia mensagem direta no WhatsApp da recepção após a reserva confirmada
  const enviarWhatsAppConfirmado = () => {
    if (!currentHotel || !currentQuarto) return;
    const rawPhone = currentHotel.whatsappPhone ? currentHotel.whatsappPhone.replace(/\D/g, '') : '5581998765432';
    const formattedPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
    const dIn = new Date(checkInDate + 'T12:00:00').toLocaleDateString('pt-BR');
    const dOut = new Date(checkOutDate + 'T12:00:00').toLocaleDateString('pt-BR');
    const nomeH = reservaConfirmadaData?.nome_hospede || localStorage.getItem('hotelnozap_user_name') || 'Hóspede';
    
    const msg = encodeURIComponent(
      `Olá! Sou *${nomeH}* e acabei de confirmar minha reserva pelo portal *Hotel no Zap*!\n\n` +
      `🏨 *Hotel:* ${currentHotel.name}\n` +
      `🛏️ *Acomodação:* ${currentQuarto.name} (Quarto ${currentQuarto.number || currentQuarto.name})\n` +
      `📅 *Check-in:* ${dIn}\n` +
      `📅 *Check-out:* ${dOut} (${totalNoites} ${totalNoites === 1 ? 'diária' : 'diárias'})\n` +
      `💰 *Valor Total:* R$ ${valorTotalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
      `Gostaria de consultar as instruções para meu check-in!`
    );
    window.open(`https://wa.me/${formattedPhone}?text=${msg}`, '_blank');
  };


  // Redireciona o hóspede para a tela Minha Conta com sessão ativa
  const handleIrParaMinhaConta = () => {
    setIsSuccessModalOpen(false);
    if (onNavigateToMinhaConta) {
      onNavigateToMinhaConta();
    } else {
      window.history.pushState({}, '', '/minhaconta');
      window.location.href = '/minhaconta';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-[#003400] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-700">Carregando detalhes do quarto...</p>
      </div>
    );
  }

  if (!currentHotel || !currentQuarto) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <span className="material-symbols-outlined text-6xl text-slate-400">meeting_room</span>
        <h2 className="text-xl font-bold text-slate-900">Quarto não encontrado</h2>
        <p className="text-xs text-slate-500 max-w-sm">
          A acomodação solicitada não está disponível ou foi desativada no sistema.
        </p>
        <button
          onClick={() => {
            if (onNavigateToHotel) onNavigateToHotel();
            else window.location.href = `/hotel/${slugify(currentHotel?.name || 'hotel')}`;
          }}
          className="px-6 py-2.5 bg-[#003400] text-white rounded-xl font-bold text-xs shadow-md cursor-pointer"
        >
          Voltar para a Página do Hotel
        </button>
      </div>
    );
  }



  return (
    <div className="bg-[#f8f9ff] text-slate-800 font-sans min-h-screen pb-32 lg:pb-20 selection:bg-emerald-500 selection:text-white relative">
      
      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER SUPERIOR FIXO */}
      <header className="fixed top-0 left-0 right-0 w-full z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-xs">
        <div className="h-16 w-full max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between">
          
          {/* Logo & Voltar */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (onNavigateToHotel) onNavigateToHotel();
                else window.location.href = `/hotel/${slugify(currentHotel.name)}`;
              }}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-all cursor-pointer flex items-center gap-1 font-bold text-xs"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              <span className="hidden sm:inline">Voltar ao Hotel</span>
            </button>

            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = '/hoteis'}>
              <div className="w-9 h-9 rounded-xl bg-[#006c49] flex items-center justify-center text-white shadow-xs">
                <span className="material-symbols-outlined text-[20px]">hotel</span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">Hotel no Zap</span>
                <span className="text-[9px] text-[#006c49] font-bold uppercase tracking-wider">Hospitalidade Digital</span>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1 font-semibold text-xs text-slate-600">
            <button onClick={() => { if (onNavigateToCatalog) onNavigateToCatalog(); else window.location.href = '/hoteis'; }} className="hidden sm:inline-block px-3 py-2 rounded-xl hover:bg-slate-100 transition-all">Lista de Hotéis</button>
            <button onClick={() => { if (onNavigateToHotel) onNavigateToHotel(); else window.location.href = `/hotel/${slugify(currentHotel.name)}`; }} className="hidden sm:inline-block px-3 py-2 rounded-xl hover:bg-slate-100 transition-all">{currentHotel.name}</button>
            <button onClick={openWhatsAppReservation} className="px-3 py-2 rounded-xl text-[#006c49] font-bold hover:bg-emerald-50 transition-all flex items-center gap-1">
              <span className="material-symbols-outlined text-base">chat</span>
              <span>Recepção Zap</span>
            </button>
          </nav>

        </div>
      </header>

      {/* BREADCRUMB NAVEGAÇÃO */}
      <section className="pt-20 pb-3 px-4 sm:px-8 max-w-7xl mx-auto border-b border-slate-200/80">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2 overflow-x-auto text-nowrap">
            <button onClick={() => { if (onNavigateToCatalog) onNavigateToCatalog(); else window.location.href = '/hoteis'; }} className="hover:text-slate-900 transition-colors">Lista de Hotéis</button>
            <span>/</span>
            <span className="text-slate-700">{currentHotel.city}, {currentHotel.uf}</span>
            <span>/</span>
            <button onClick={() => { if (onNavigateToHotel) onNavigateToHotel(); else window.location.href = `/hotel/${slugify(currentHotel.name)}`; }} className="hover:text-slate-900 transition-colors">{currentHotel.name}</button>
            <span>/</span>
            <span className="font-bold text-slate-900">{getTituloExplicitoQuarto(currentQuarto)}</span>
          </div>

          <button 
            onClick={() => { if (onNavigateToHotel) onNavigateToHotel(); else window.location.href = `/hotel/${slugify(currentHotel.name)}`; }}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#006c49] hover:underline cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>Voltar ao Hotel</span>
          </button>
        </div>
      </section>

      <main className="px-4 sm:px-8 max-w-7xl mx-auto mt-6 space-y-8">
        
        {/* TITULO DO QUARTO */}
        <section className="space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1.5">
              {/* TAGS DESTAQUE DO TIPO E NÚMERO DO QUARTO */}
              {currentQuarto.category && (
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-black uppercase tracking-wider border border-emerald-300 shadow-2xs">
                    <span className="material-symbols-outlined text-sm">hotel</span>
                    Tipo: {currentQuarto.category.charAt(0).toUpperCase() + currentQuarto.category.slice(1).toLowerCase()}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                    <span className="material-symbols-outlined text-xs">tag</span>
                    Quarto {currentQuarto.number || currentQuarto.name}
                  </span>
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                {getTituloExplicitoQuarto(currentQuarto)}
              </h1>
              <p className="text-slate-600 mt-1 text-xs sm:text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006c49] text-base">location_on</span>
                <span className="font-bold text-slate-900">{currentHotel.name}</span>
                <span>•</span>
                <span>{currentHotel.neighborhood}, {currentHotel.city}/{currentHotel.uf}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-800">
                <span className="text-amber-500 font-extrabold text-sm">★ 4.98</span>
                <span className="text-slate-500 font-normal">(128 avaliações reais)</span>
              </div>
              <button 
                onClick={handleShare}
                className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-all cursor-pointer flex items-center gap-1 font-bold text-xs"
              >
                <span className="material-symbols-outlined text-base">share</span>
                <span className="hidden sm:inline">Compartilhar</span>
              </button>
              <button 
                onClick={() => {
                  setIsFavorite(!isFavorite);
                  showToast(isFavorite ? 'Removido dos favoritos!' : 'Adicionado aos favoritos!');
                }}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1 font-bold text-xs ${
                  isFavorite ? 'bg-rose-50 border-rose-200 text-rose-600' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <span className={`material-symbols-outlined text-base ${isFavorite ? 'fill-current text-rose-600' : ''}`}>
                  {isFavorite ? 'favorite' : 'favorite_border'}
                </span>
                <span className="hidden sm:inline">{isFavorite ? 'Salvo' : 'Salvar'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* GRADE DE FOTOS DO QUARTO OU AVISO DE NENHUMA FOTO CADASTRADA */}
        {galleryImages.length === 0 ? (
          <section className="relative">
            <div className="relative rounded-2xl md:rounded-3xl overflow-hidden shadow-xs bg-gradient-to-b from-slate-50 to-slate-100/80 border-2 border-dashed border-slate-200 h-64 sm:h-72 md:h-80 lg:h-96 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-400 mb-3">
                <span className="material-symbols-outlined text-3xl sm:text-4xl text-slate-400">no_photography</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                Nenhuma foto do quarto cadastrado
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mt-1">
                Esta acomodação ({currentQuarto?.name || 'Quarto'}) ainda não possui fotos cadastradas no sistema.
              </p>
              {currentQuarto?.videoUrl && (
                <button
                  type="button"
                  onClick={() => setIsVideoModalOpen(true)}
                  className="mt-4 px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md flex items-center gap-2 cursor-pointer transition-all hover:scale-102"
                >
                  <span className="material-symbols-outlined text-[20px]">play_circle</span>
                  <span>Assistir Tour em Vídeo da Acomodação</span>
                </button>
              )}
            </div>
          </section>
        ) : (
          <section className="relative">
            <div className="relative rounded-2xl md:rounded-3xl overflow-hidden shadow-xs bg-slate-100 border border-slate-200/70">
              {/* Layout Desktop / Tablet (md+) estilo Airbnb conforme anexo */}
              {desktopGridPhotos.length === 1 ? (
                <div 
                  onClick={() => {
                    setModalPhotoIndex(0);
                    setIsModalFotosOpen(true);
                  }}
                  className="hidden md:block h-[380px] lg:h-[440px] xl:h-[480px] w-full relative cursor-pointer overflow-hidden group"
                >
                  <img 
                    src={desktopGridPhotos[0]} 
                    alt={`${currentQuarto.name} - Principal`}
                    className="w-full h-full object-cover group-hover:brightness-95 transition-all duration-300"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                </div>
              ) : (
                <div className="hidden md:grid md:grid-cols-2 gap-2 sm:gap-2.5 h-[380px] sm:h-[420px] lg:h-[460px] xl:h-[480px] w-full">
                  {/* Foto 1: Principal (Lado Esquerdo - 50% da largura, altura total) */}
                  <div 
                    onClick={() => {
                      setModalPhotoIndex(0);
                      setIsModalFotosOpen(true);
                    }}
                    className="relative h-full w-full cursor-pointer overflow-hidden group"
                  >
                    <img 
                      src={desktopGridPhotos[0]} 
                      alt={`${currentQuarto.name} - Foto Principal`}
                      className="w-full h-full object-cover group-hover:brightness-95 group-hover:scale-101 transition-all duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                  </div>

                  {/* Fotos 2, 3, 4, 5: Grade 2x2 (Lado Direito - 50% da largura) */}
                  <div className="grid grid-cols-2 grid-rows-2 gap-2 sm:gap-2.5 h-full w-full">
                    {desktopGridPhotos.slice(1, 5).map((img, idx) => {
                      const photoIndex = (idx + 1) % galleryImages.length;
                      return (
                        <div 
                          key={idx}
                          onClick={() => {
                            setModalPhotoIndex(photoIndex);
                            setIsModalFotosOpen(true);
                          }}
                          className="relative h-full w-full cursor-pointer overflow-hidden group"
                        >
                          <img 
                            src={img} 
                            alt={`${currentQuarto.name} - Foto ${idx + 2}`}
                            className="w-full h-full object-cover group-hover:brightness-95 group-hover:scale-101 transition-all duration-300"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Layout Mobile (< md): Imagem com navegação quando houver fotos */}
              <div className="md:hidden relative h-72 sm:h-80 w-full overflow-hidden bg-slate-900">
                <img 
                  src={galleryImages[currentSlideIndex] || galleryImages[0]} 
                  alt={currentQuarto.name}
                  onClick={() => {
                    setModalPhotoIndex(currentSlideIndex);
                    setIsModalFotosOpen(true);
                  }}
                  className="w-full h-full object-cover cursor-pointer"
                />
                {galleryImages.length > 1 && (
                  <>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentSlideIndex((prev) => (prev > 0 ? prev - 1 : galleryImages.length - 1));
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/60 text-white flex items-center justify-center backdrop-blur-xs cursor-pointer active:scale-95 z-10"
                      aria-label="Foto anterior"
                    >
                      <span className="material-symbols-outlined text-xl">chevron_left</span>
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentSlideIndex((prev) => (prev < galleryImages.length - 1 ? prev + 1 : 0));
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/60 text-white flex items-center justify-center backdrop-blur-xs cursor-pointer active:scale-95 z-10"
                      aria-label="Próxima foto"
                    >
                      <span className="material-symbols-outlined text-xl">chevron_right</span>
                    </button>
                    <div className="absolute bottom-3 left-3 bg-slate-950/80 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-xs">
                      {currentSlideIndex + 1} / {galleryImages.length}
                    </div>
                  </>
                )}
              </div>

              {/* Botão Flutuante: Assistir Vídeo da Acomodação */}
              {currentQuarto?.videoUrl && (
                <button 
                  type="button"
                  onClick={() => setIsVideoModalOpen(true)}
                  className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 z-10 inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 bg-purple-700/90 hover:bg-purple-800 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold shadow-md backdrop-blur-xs transition-all hover:scale-102 active:scale-98 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-purple-200">play_circle</span>
                  <span>Ver Vídeo da Acomodação</span>
                </button>
              )}

              {/* Botão Flutuante: Mostrar Todas as Fotos (conforme anexo / Airbnb) */}
              {galleryImages.length > 0 && (
                <button 
                  type="button"
                  onClick={() => {
                    setModalPhotoIndex(0);
                    setIsModalFotosOpen(true);
                  }}
                  className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 z-10 inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 bg-white hover:bg-slate-50 text-slate-900 rounded-lg text-xs sm:text-[13px] font-semibold shadow-md border border-slate-900 transition-all hover:scale-102 active:scale-98 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-900 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="2.5" cy="2.5" r="1.5" />
                    <circle cx="8" cy="2.5" r="1.5" />
                    <circle cx="13.5" cy="2.5" r="1.5" />
                    <circle cx="2.5" cy="8" r="1.5" />
                    <circle cx="8" cy="8" r="1.5" />
                    <circle cx="13.5" cy="8" r="1.5" />
                    <circle cx="2.5" cy="13.5" r="1.5" />
                    <circle cx="8" cy="13.5" r="1.5" />
                    <circle cx="13.5" cy="13.5" r="1.5" />
                  </svg>
                  <span>Mostrar todas as fotos</span>
                </button>
              )}
            </div>
          </section>
        )}

        {/* AVISO INTELIGENTE: QUARTO EM LIMPEZA (SÓ DEVE APARECER SE O QUARTO ESTIVER COM STATUS LIMPEZA) */}
        {isQuartoEmLimpeza && (
          <section className="bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-50 border-2 border-amber-300/90 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center gap-4 text-amber-950 animate-in fade-in duration-300">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <span className="material-symbols-outlined text-2xl">cleaning_services</span>
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200/90 text-amber-900 px-2.5 py-0.5 rounded-full">
                  Higienização em Andamento
                </span>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">check_circle</span>
                  Liberado para Reserva
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-amber-950">
                Esta acomodação acabou de realizar check-out e está em processo de limpeza
              </h2>
              <p className="text-xs sm:text-sm text-amber-900/90 leading-relaxed">
                Nossa equipe de governança está realizando o protocolo completo de higienização, troca de enxoval e preparação dos ambientes. <strong>Você já pode reservar normalmente para garantir a sua estadia</strong> — o quarto estará 100% pronto no horário do seu check-in!
              </p>
            </div>
          </section>
        )}

        {/* ESTRUTURA DE 2 COLUNAS: CONTEÚDO (70%) + WIDGET DE RESERVA (30%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* COLUNA ESQUERDA: DETALHES DO QUARTO */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* SELEÇÃO DE DATAS NO MODO MOBILE */}
            <div className="lg:hidden bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="material-symbols-outlined text-[#006c49] text-base">calendar_month</span>
                  Datas da Estadia
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {totalNoites} {totalNoites === 1 ? 'diária' : 'diárias'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-600 block">Check-in</label>
                    <span className="text-[10px] text-slate-400 font-medium">Máx. 30 dias</span>
                  </div>
                  <input
                    type="date"
                    value={checkInDate}
                    min={getTodayStr()}
                    max={getMaxCheckInStr()}
                    onChange={(e) => handleCheckInChange(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#006c49] transition-all cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-600 block">Check-out</label>
                    <span className="text-[10px] text-slate-400 font-medium">Máx. 30 diárias</span>
                  </div>
                  <input
                    type="date"
                    value={checkOutDate}
                    min={checkInDate}
                    max={getMaxCheckOutStr(checkInDate)}
                    onChange={(e) => handleCheckOutChange(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#006c49] transition-all cursor-pointer"
                  />
                </div>
              </div>

              {/* AVISO PREVENTIVO: RESERVAS ACIMA DE 30 DIAS */}
              {isReservaMaisDe30Dias && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700 font-bold animate-in fade-in duration-200">
                  <span className="material-symbols-outlined text-rose-600 text-base shrink-0 mt-0.5">error</span>
                  <span>Não é permitido reservas com mais de 30 dias (máximo permitido até {formatarDataBR(getMaxCheckOutStr(checkInDate))}).</span>
                </div>
              )}

              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">
                  {totalNoites} {totalNoites === 1 ? 'diária' : 'diárias'} × R$ {currentQuarto.dailyPrice}
                </span>
                <span className="text-sm font-black text-[#006c49]">
                  Total: R$ {valorTotalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* DESTAQUES DA ACOMODAÇÃO */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#006c49] block">
                Destaques Principais da Acomodação
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs text-slate-700">
                {[...quartoDestaques].sort((a, b) => a.order - b.order).map((d) => {
                  const renderedTitle = d.title.includes('{X}') || d.title === 'Até {X} Hóspedes'
                    ? `Até ${currentQuarto.capacity || 2} Hóspedes`
                    : d.title;

                  return (
                    <div key={d.id} className="flex items-start gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      {cleanIconClass(d.iconClass) ? (
                        <i
                          className={cleanIconClass(d.iconClass)}
                          style={{ color: d.iconColor || '#6d28d9', fontSize: '1.8rem', lineHeight: 1 }}
                        />
                      ) : (
                        <span
                          className="material-symbols-outlined text-2xl shrink-0"
                          style={{ color: d.iconColor || '#6d28d9' }}
                        >
                          {d.icon}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900">{renderedTitle}</p>
                        <p className="text-[11px] text-slate-500 leading-tight">{d.subtitle}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TOUR EM VÍDEO DA ACOMODAÇÃO */}
            {currentQuarto?.videoUrl && (
              <div className="bg-white p-6 sm:p-7 rounded-3xl border border-purple-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-2xl">videocam</span>
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug flex items-center gap-2">
                        <span>Tour em Vídeo da Acomodação</span>
                        <span className="text-[10px] uppercase font-black tracking-wider bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                          Vídeo Real
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Assista ao vídeo e confira cada detalhe do quarto {currentQuarto.number} antes de fazer sua reserva
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsVideoModalOpen(true)}
                    className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">fullscreen</span>
                    <span>Modo Cinema</span>
                  </button>
                </div>

                <div className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-200/80 shadow-inner relative aspect-video max-h-[460px] w-full flex items-center justify-center">
                  <video
                    src={currentQuarto.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-contain"
                  >
                    Seu navegador não suporta reprodução de vídeo.
                  </video>
                </div>
              </div>
            )}

            {/* OBSERVAÇÕES / DETALHES DA ACOMODAÇÃO */}
            {Boolean((currentQuarto?.notes && currentQuarto.notes.trim()) || (currentQuarto?.observacoes && currentQuarto.observacoes.trim())) && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006c49] text-xl">description</span>
                  <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">Observações</h3>
                </div>
                <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-100">
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {currentQuarto?.notes || currentQuarto?.observacoes}
                  </p>
                </div>
              </div>
            )}

            {/* COMODIDADES E CONFORTO CATEGORIZADOS (NÍVEL QUARTO) */}
            {(() => {
              const comodidadesDoQuarto = (currentQuarto?.comodidades && currentQuarto.comodidades.length > 0)
                ? currentQuarto.comodidades
                : ((currentQuarto?.items?.comodidades && Array.isArray(currentQuarto.items.comodidades) && currentQuarto.items.comodidades.length > 0)
                    ? currentQuarto.items.comodidades
                    : ((currentHotel?.comodidades && currentHotel.comodidades.length > 0)
                        ? currentHotel.comodidades
                        : comodidadesService.getSeedPadrao()));

              if (!comodidadesDoQuarto || comodidadesDoQuarto.length === 0) return null;

              return (
                <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#006c49] text-xl">list_alt</span>
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">Comodidades & Conforto Inclusos</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {comodidadesDoQuarto
                      .slice()
                      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                      .map((cat: any, ci: number) => {
                        const itensValidos = (cat.itens || []).filter((it: any) => it.texto && it.texto.trim().length > 0);
                        if (itensValidos.length === 0) return null;
                        const iconeCor = cat.iconColor || '#006c49';
                        return (
                          <div key={cat.id || `cat-${ci}`} className="p-8 sm:p-6 rounded-3xl border border-slate-200/70 bg-white space-y-4">
                            <div className="flex items-center gap-3">
                              {cleanIconClass(cat.iconClass) ? (
                                <i
                                  className={cleanIconClass(cat.iconClass)}
                                  style={{ color: iconeCor, fontSize: '1.35rem', lineHeight: 1 }}
                                />
                              ) : (
                                <span
                                  className="material-symbols-outlined text-2xl shrink-0"
                                  style={{ color: iconeCor }}
                                >
                                  {cat.icon || 'check_circle'}
                                </span>
                              )}
                              <h4 className="text-base font-bold text-slate-900 leading-tight">
                                {cat.nome}
                              </h4>
                            </div>

                            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                              {itensValidos
                                .slice()
                                .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                                .map((item: any, ii: number) => (
                                  <li key={item.id || `item-${ci}-${ii}`} className="flex items-start gap-2">
                                    <span className="material-symbols-outlined text-emerald-600 text-base shrink-0 mt-0.5">
                                      check_circle
                                    </span>
                                    <span className="leading-relaxed">{item.texto}</span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        );
                      })}
                  </div>
                </section>
              );
            })()}

            {/* POLÍTICAS E GARANTIAS */}
            <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006c49]">verified_user</span>
                Políticas de Hospedagem & Garantias Hotel no Zap
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-100 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-emerald-700 text-xl">event_available</span>
                  <div>
                    <h4 className="font-bold text-slate-900">Cancelamento Grátis</h4>
                    <p className="text-slate-600 text-[11px] mt-0.5">Cancelamento flexível sem multas</p>
                  </div>
                </div>

                <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-100 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-blue-700 text-xl">price_check</span>
                  <div>
                    <h4 className="font-bold text-slate-900">Melhor Tarifa Direta</h4>
                    <p className="text-slate-600 text-[11px] mt-0.5">Sem taxas extras de intermediários</p>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-100 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-amber-700 text-xl">support_agent</span>
                  <div>
                    <h4 className="font-bold text-slate-900">Suporte no WhatsApp</h4>
                    <p className="text-slate-600 text-[11px] mt-0.5">Atendimento rápido com a recepção</p>
                  </div>
                </div>
              </div>
            </section>

          </div>

          {/* COLUNA DIREITA: WIDGET DE RESERVA STICKY DESKTOP (30%) */}
          <aside className="lg:col-span-4 sticky top-20">
            <div className="bg-white rounded-3xl border-2 border-[#003400]/20 shadow-xl overflow-hidden p-6 space-y-6">
              
              {/* Badge Alerta de Vagas ou Limpeza */}
              {isQuartoEmLimpeza ? (
                <div className="bg-amber-100/90 text-amber-950 border border-amber-300/80 px-3.5 py-2 rounded-2xl text-xs font-bold text-center flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-amber-700 text-base">cleaning_services</span>
                  <span>Acomodação em processo de higienização</span>
                </div>
              ) : (
                <div className="bg-amber-100 text-amber-950 px-3 py-1.5 rounded-xl text-xs font-black text-center flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-amber-600 text-base">local_fire_department</span>
                  <span>Acomodação procurada nesta região!</span>
                </div>
              )}

              {/* Preço Header */}
              <div className="flex items-baseline justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs text-slate-500 block">Valor da Diária</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900">R$ {currentQuarto.dailyPrice}</span>
                    <span className="text-xs text-slate-500 font-medium">/ noite</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-950 font-bold text-[11px]">
                  Sem Taxas Extras
                </span>
              </div>

              {/* Aviso adicional de Quarto em Limpeza */}
              {isQuartoEmLimpeza && (
                <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-950">
                  <span className="material-symbols-outlined text-amber-600 text-lg shrink-0 mt-0.5">cleaning_services</span>
                  <div className="leading-snug">
                    <strong className="block text-amber-950">Quarto em Limpeza:</strong>
                    <span className="text-[11px] text-amber-800">Liberado para reserva. Higienização completa garantida para o seu check-in.</span>
                  </div>
                </div>
              )}

              {/* Matriz de Escolha */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Acomodação Escolhida:</span>
                  <span className="font-bold text-[#006c49]">{getTituloExplicitoQuarto(currentQuarto)}</span>
                </div>
                {currentQuarto.category && (
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Tipo de Quarto:</span>
                    <span className="font-extrabold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300">
                      {currentQuarto.category.charAt(0).toUpperCase() + currentQuarto.category.slice(1).toLowerCase()}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Capacidade Max:</span>
                  <span className="font-bold text-slate-900">{currentQuarto.capacity || 2} Hóspedes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Café da Manhã:</span>
                  <span className="font-bold text-emerald-700">Incluso</span>
                </div>
              </div>

              {/* SELEÇÃO DE DATAS: CHECK-IN E CHECK-OUT */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                    <span className="material-symbols-outlined text-[#006c49] text-base">calendar_month</span>
                    Período da Hospedagem
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {totalNoites} {totalNoites === 1 ? 'diária' : 'diárias'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-600 block">Check-in</label>
                      <span className="text-[10px] text-slate-400 font-medium">Máx. 30 dias</span>
                    </div>
                    <input
                      type="date"
                      value={checkInDate}
                      min={getTodayStr()}
                      max={getMaxCheckInStr()}
                      onChange={(e) => handleCheckInChange(e.target.value)}
                      className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006c49] transition-all cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-600 block">Check-out</label>
                      <span className="text-[10px] text-slate-400 font-medium">Máx. 30 diárias</span>
                    </div>
                    <input
                      type="date"
                      value={checkOutDate}
                      min={checkInDate}
                      max={getMaxCheckOutStr(checkInDate)}
                      onChange={(e) => handleCheckOutChange(e.target.value)}
                      className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006c49] transition-all cursor-pointer"
                    />
                  </div>
                </div>

                {/* AVISO PREVENTIVO: RESERVAS ACIMA DE 30 DIAS */}
                {isReservaMaisDe30Dias && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700 font-bold animate-in fade-in duration-200">
                    <span className="material-symbols-outlined text-rose-600 text-base shrink-0 mt-0.5">error</span>
                    <span>Não é permitido reservas com mais de 30 dias (máximo permitido até {formatarDataBR(getMaxCheckOutStr(checkInDate))}).</span>
                  </div>
                )}

                {/* Cálculo Dinâmico */}
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">
                    {totalNoites} {totalNoites === 1 ? 'diária' : 'diárias'} × R$ {currentQuarto.dailyPrice}
                  </span>
                  <span className="text-base font-black text-[#006c49]">
                    R$ {valorTotalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* BOTÃO PRINCIPAL ALTO IMPACTO (RESERVAR AGORA OU AVISO DE OCUPADO) */}
              <div className="space-y-2.5">
                {isQuartoOcupado ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-1.5">
                      <div className="flex items-center gap-2 font-black text-amber-900">
                        <span className="material-symbols-outlined text-amber-600 text-lg">event_busy</span>
                        <span>Acomodação Ocupada / Reservada</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Este quarto possui reserva confirmada para este período. Fale com a recepção no WhatsApp para consultar outras datas disponíveis ou entrar na lista de espera.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openWhatsAppReservation}
                      className="w-full py-4 px-4 rounded-2xl bg-[#10B981] hover:bg-emerald-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xl">chat</span>
                      <span>Consultar Vagas no WhatsApp</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleCliqueReservar}
                    disabled={submittingReserva || isReservaMaisDe30Dias}
                    className={`w-full py-4 px-4 rounded-2xl text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer group ${
                      isReservaMaisDe30Dias 
                        ? 'bg-slate-400 cursor-not-allowed opacity-80' 
                        : 'bg-[#003400] hover:bg-[#002500] active:scale-95'
                    }`}
                  >
                    {submittingReserva ? (
                      <span className="material-symbols-outlined animate-spin text-xl text-emerald-400">progress_activity</span>
                    ) : isReservaMaisDe30Dias ? (
                      <span className="material-symbols-outlined text-rose-200 text-xl">block</span>
                    ) : (
                      <span className="material-symbols-outlined text-[#10B981] text-xl group-hover:scale-110 transition-transform">event_available</span>
                    )}
                    <span>
                      {submittingReserva 
                        ? 'PROCESSANDO RESERVA...' 
                        : isReservaMaisDe30Dias 
                        ? 'PERÍODO ACIMA DE 30 DIAS' 
                        : 'RESERVAR AGORA'}
                    </span>
                  </button>
                )}
              </div>

              {/* Micro-Selos de Segurança */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-slate-500">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="material-symbols-outlined text-emerald-700 text-base">lock</span>
                  <span>100% Seguro</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="material-symbols-outlined text-emerald-700 text-base">check_circle</span>
                  <span>Sem Taxas</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="material-symbols-outlined text-emerald-700 text-base">bolt</span>
                  <span>Atendimento Rápido</span>
                </div>
              </div>

            </div>
          </aside>

        </div>

      </main>

      {/* MOBILE STICKY BOTTOM BAR (WIDGET DE RESERVA FIXO NO RODAPÉ DO CELULAR) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl p-3 px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 flex-wrap">
              <span className="text-slate-700">{formatarDataBR(checkInDate)}</span>
              <span className="text-slate-400">➜</span>
              <span className="text-slate-700">{formatarDataBR(checkOutDate)}</span>
              <span className={`px-1.5 py-0.5 rounded font-black text-[9px] ${isReservaMaisDe30Dias ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-emerald-100 text-[#006c49]'}`}>
                {totalNoites}d {isReservaMaisDe30Dias ? '(Inválido)' : ''}
              </span>
              {isQuartoEmLimpeza && (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-bold text-[9px] flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[10px]">cleaning_services</span>
                  Limpeza
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-slate-900">
                R$ {valorTotalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">total</span>
            </div>
          </div>

          {isQuartoOcupado ? (
            <button
              onClick={openWhatsAppReservation}
              className="py-3 px-5 rounded-xl bg-[#10B981] text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-base">chat</span>
              <span>Ocupado (Ver no Zap)</span>
            </button>
          ) : (
            <button
              onClick={handleCliqueReservar}
              disabled={submittingReserva || isReservaMaisDe30Dias}
              className={`py-3 px-5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md shrink-0 transition-all ${
                isReservaMaisDe30Dias 
                  ? 'bg-slate-400 text-white cursor-not-allowed opacity-80' 
                  : 'bg-[#003400] text-white active:scale-95 cursor-pointer'
              }`}
            >
              {submittingReserva ? (
                <span className="material-symbols-outlined animate-spin text-sm text-emerald-400">progress_activity</span>
              ) : isReservaMaisDe30Dias ? (
                <span className="material-symbols-outlined text-rose-200 text-sm">block</span>
              ) : (
                <span className="material-symbols-outlined text-[#10B981] text-base">event_available</span>
              )}
              <span>
                {submittingReserva 
                  ? 'RESERVANDO...' 
                  : isReservaMaisDe30Dias 
                  ? 'MÁX 30 DIAS' 
                  : 'RESERVAR AGORA'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* FOOTER PÚBLICO */}
      <footer className="w-full bg-slate-900 text-slate-400 py-10 border-t border-slate-800 mt-16 pb-20 lg:pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#006c49] flex items-center justify-center text-white font-bold">
              <span className="material-symbols-outlined text-base">hotel</span>
            </div>
            <div>
              <span className="font-bold text-white block">Hotel no Zap © 2026</span>
              <span className="text-slate-500">Rede Inteligente de Pousadas e Hotéis</span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-slate-400 font-medium">
            <button onClick={() => { if (onNavigateToCatalog) onNavigateToCatalog(); else window.location.href = '/hoteis'; }} className="hover:text-white transition-colors">Voltar à Lista de Hotéis</button>
            <button onClick={() => { if (onNavigateToHotel) onNavigateToHotel(); else window.location.href = `/hotel/${slugify(currentHotel.name)}`; }} className="hover:text-white transition-colors">{currentHotel.name}</button>
            <button onClick={openWhatsAppReservation} className="hover:text-white transition-colors">Suporte WhatsApp</button>
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* MODAL: BLOQUEIO DE RESERVA PARA USUÁRIO COM PERFIL HOTEL                  */}
      {/* ========================================================================= */}
      {isHotelUserBloqueadoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col text-center p-6 sm:p-8 space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-xs">
              <span className="material-symbols-outlined text-3xl">block</span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Reserva Não Permitida
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Você está conectado com um perfil de <strong>Hotel</strong>. Pela regra do sistema, usuários com perfil hotel <strong>não podem fazer reservas para eles mesmos</strong>.
              </p>
              <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                O fluxo de reservas online do catálogo é destinado exclusivamente a <strong>Hóspedes</strong>.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setIsHotelUserBloqueadoModalOpen(false)}
                className="w-full py-3 px-4 rounded-xl bg-[#003400] hover:bg-[#002500] text-white font-bold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer shadow-md"
              >
                Entendi
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsHotelUserBloqueadoModalOpen(false);
                  localStorage.removeItem('hotelnozap_user_role');
                  localStorage.removeItem('hotelnozap_user_email');
                  localStorage.removeItem('hotelnozap_user_name');
                  try { supabase.auth.signOut({ scope: 'local' }); } catch {}
                  window.dispatchEvent(new CustomEvent('user_role_changed', { detail: '' }));
                  showToast('Você saiu da conta de Hotel. Agora pode reservar com uma conta de Hóspede.');
                }}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-all cursor-pointer"
              >
                Sair da conta de Hotel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 0: AVISO DE QUARTO EM LIMPEZA (ABRE AO CLICAR EM RESERVAR)          */}
      {/* ========================================================================= */}
      {isAvisoLimpezaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal com Ícone de Limpeza */}
            <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 p-6 text-white text-center relative">
              <button
                onClick={() => setIsAvisoLimpezaModalOpen(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Fechar"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>

              <div className="w-16 h-16 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <span className="material-symbols-outlined text-3xl text-white">cleaning_services</span>
              </div>

              <span className="px-3 py-1 rounded-full bg-white/20 text-white font-extrabold text-[10px] tracking-wider uppercase inline-block mb-1.5">
                Aviso Importante de Higienização
              </span>
              <h3 className="text-xl sm:text-2xl font-black leading-tight">
                Quarto em Processo de Limpeza
              </h3>
              <p className="text-amber-100 text-xs mt-1 max-w-xs mx-auto">
                Acomodação recém-desocupada via check-out
              </p>
            </div>

            {/* Corpo do Modal */}
            <div className="p-6 space-y-4">
              <div className="bg-amber-50/80 rounded-2xl p-4 border border-amber-200/80 space-y-2 text-xs text-amber-950">
                <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                  <span className="material-symbols-outlined text-base text-amber-600">info</span>
                  <span>{currentQuarto?.name} ({currentQuarto?.category})</span>
                </div>
                <p className="text-xs text-amber-900/90 leading-relaxed">
                  Informamos que esta acomodação acabou de passar pelo procedimento de check-out e nossa equipe de governança está realizando a limpeza completa, troca de enxovais e higienização dos ambientes.
                </p>
                <div className="pt-2 border-t border-amber-200/60 flex items-center gap-2 text-[11px] text-amber-800 font-semibold">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                  <span>O quarto estará 100% pronto e higienizado para o seu check-in.</span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs flex items-center justify-between text-slate-700">
                <span className="text-slate-500">Datas da sua estadia:</span>
                <span className="font-bold text-slate-900">
                  {formatarDataBR(checkInDate)} a {formatarDataBR(checkOutDate)}
                </span>
              </div>

              {/* Botões de Ação */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmarAvisoLimpeza}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#003400] hover:bg-[#002500] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base text-emerald-400">arrow_forward</span>
                  <span>Entendi, Continuar com a Reserva</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAvisoLimpezaModalOpen(false)}
                  className="w-full py-2.5 px-4 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
                >
                  Voltar e Ver Outras Acomodações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: AUTENTICAÇÃO / CADASTRO INTELIGENTE DO HÓSPEDE (QUANDO NÃO LOGADO) */}
      {/* ========================================================================= */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#003400] to-[#004d26] p-6 text-white relative">
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Fechar"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>

              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-bold text-[10px] tracking-wider uppercase">
                  Identificação do Hóspede
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black leading-tight">
                {authModalTab === 'login' ? 'Acesse sua Conta para Reservar' : 'Cadastre-se para Confirmar sua Reserva'}
              </h3>
              <p className="text-emerald-100 text-xs mt-1">
                Identifique-se para garantir sua reserva e acompanhar tudo na área Minha Conta.
              </p>
            </div>

            {/* Resumo da Reserva Escolhida */}
            <div className="bg-emerald-50/60 border-b border-emerald-100 p-4 px-6 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-800 block text-sm">{getTituloExplicitoQuarto(currentQuarto)}</span>
                <span className="text-slate-500 text-[11px]">
                  {formatarDataBR(checkInDate)} até {formatarDataBR(checkOutDate)} ({totalNoites} {totalNoites === 1 ? 'diária' : 'diárias'})
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">Total</span>
                <span className="text-base font-black text-[#006c49]">
                  R$ {valorTotalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Alternador de Abas (Tabs) */}
            <div className="flex border-b border-slate-200 bg-slate-50/70 p-1.5 gap-2 px-6">
              <button
                type="button"
                onClick={() => { setAuthModalTab('login'); setAuthError(''); }}
                className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  authModalTab === 'login'
                    ? 'bg-white text-[#003400] shadow-xs border border-slate-200/80 font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-base">login</span>
                <span>Já tenho Cadastro</span>
              </button>

              <button
                type="button"
                onClick={() => { setAuthModalTab('cadastro'); setAuthError(''); }}
                className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  authModalTab === 'cadastro'
                    ? 'bg-white text-[#003400] shadow-xs border border-slate-200/80 font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-base">person_add</span>
                <span>Criar Novo Cadastro</span>
              </button>
            </div>

            {/* Mensagem de Erro */}
            {authError && (
              <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2 text-xs text-rose-700">
                <span className="material-symbols-outlined text-rose-600 text-base shrink-0 mt-0.5">error</span>
                <span>{authError}</span>
              </div>
            )}

            {/* Conteúdo do Formulário */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {authModalTab === 'login' ? (
                <form onSubmit={handleSubmeterLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">E-mail do Hóspede</label>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                      className="w-full text-xs font-medium px-3.5 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#006c49] focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Senha de Acesso</label>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Digite sua senha"
                      className="w-full text-xs font-medium px-3.5 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#006c49] focus:border-transparent transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3.5 px-4 rounded-2xl bg-[#003400] hover:bg-[#002500] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                  >
                    {authLoading ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                        <span>Autenticando e Reservando...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base text-[#10B981]">lock_open</span>
                        <span>Entrar e Confirmar Reserva</span>
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => { setAuthModalTab('cadastro'); setAuthError(''); }}
                      className="text-xs font-bold text-[#006c49] hover:underline"
                    >
                      Ainda não tem conta? Cadastre-se aqui em segundos
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSubmeterCadastro} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={cadNome}
                      onChange={(e) => setCadNome(e.target.value)}
                      placeholder="Ex: Carlos Eduardo Silva"
                      className="w-full text-xs font-medium px-3.5 py-2.5 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#006c49] focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">E-mail *</label>
                    <input
                      type="email"
                      required
                      value={cadEmail}
                      onChange={(e) => setCadEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                      className="w-full text-xs font-medium px-3.5 py-2.5 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#006c49] focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 block">WhatsApp / Celular</label>
                      <input
                        type="tel"
                        value={cadTelefone}
                        onChange={(e) => setCadTelefone(maskPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        className="w-full text-xs font-medium px-3.5 py-2.5 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#006c49] focus:border-transparent transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 block">CPF / Documento</label>
                      <input
                        type="text"
                        value={cadCpf}
                        onChange={(e) => setCadCpf(maskCpfCnpj(e.target.value))}
                        placeholder="000.000.000-00"
                        className="w-full text-xs font-medium px-3.5 py-2.5 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#006c49] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* BLOCO DE ENDEREÇO COMPLETO DO HÓSPEDE */}
                  <div className="pt-2 pb-1 border-t border-slate-200/80 flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#006c49] text-base">location_on</span>
                      Endereço do Hóspede
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Auto-preenchimento via CEP</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1 sm:col-span-1">
                      <label className="text-xs font-bold text-slate-700 block">CEP</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={cadCep}
                          onChange={handleCepChange}
                          placeholder="00000-000"
                          maxLength={9}
                          className="w-full text-xs font-medium px-3.5 py-2.5 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#006c49] focus:border-transparent transition-all"
                        />
                        {isLoadingCep && (
                          <span className="material-symbols-outlined animate-spin text-[#006c49] text-sm absolute right-3 top-2.5">
                            progress_activity
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-bold text-slate-700 block">Rua / Logradouro</label>
                      <input
                        type="text"
                        value={cadLogradouro}
                        onChange={(e) => setCadLogradouro(e.target.value)}
                        placeholder="Ex: Av. Paulista, Rua das Flores"
                        className="w-full text-xs font-medium px-3.5 py-2.5 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#006c49] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1 sm:col-span-1">
                      <label className="text-xs font-bold text-slate-700 block">Número</label>
                      <input
                        type="text"
                        value={cadNumero}
                        onChange={(e) => setCadNumero(e.target.value)}
                        placeholder="123 ou S/N"
                        className="w-full text-xs font-medium px-3.5 py-2.5 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#006c49] focus:border-transparent transition-all"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-bold text-slate-700 block">Complemento</label>
                      <input
                        type="text"
                        value={cadComplemento}
                        onChange={(e) => setCadComplemento(e.target.value)}
                        placeholder="Apto, Bloco, Sala (opcional)"
                        className="w-full text-xs font-medium px-3.5 py-2.5 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#006c49] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="space-y-1 sm:col-span-5">
                      <label className="text-xs font-bold text-slate-700 block">Bairro</label>
                      <input
                        type="text"
                        value={cadBairro}
                        onChange={(e) => setCadBairro(e.target.value)}
                        placeholder="Bairro"
                        className="w-full text-xs font-medium px-3.5 py-2.5 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#006c49] focus:border-transparent transition-all"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-5">
                      <label className="text-xs font-bold text-slate-700 block">Cidade</label>
                      <input
                        type="text"
                        value={cadCidade}
                        onChange={(e) => setCadCidade(e.target.value)}
                        placeholder="Cidade"
                        className="w-full text-xs font-medium px-3.5 py-2.5 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#006c49] focus:border-transparent transition-all"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-bold text-slate-700 block">UF</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={cadEstadoUf}
                        onChange={(e) => setCadEstadoUf(e.target.value.toUpperCase())}
                        placeholder="UF"
                        className="w-full text-xs font-medium px-3.5 py-2.5 rounded-2xl border border-slate-300 text-center uppercase focus:outline-none focus:ring-2 focus:ring-[#006c49] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* OBSERVAÇÕES */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Observações / Preferências</label>
                    <input
                      type="text"
                      value={cadObservacoes}
                      onChange={(e) => setCadObservacoes(e.target.value)}
                      placeholder="Ex: Cama extra, andar alto, horário de chegada (opcional)"
                      className="w-full text-xs font-medium px-3.5 py-2.5 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#006c49] focus:border-transparent transition-all"
                    />
                  </div>

                  {/* SENHA DE ACESSO */}
                  <div className="pt-2 pb-1 border-t border-slate-200/80">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 block">Crie uma Senha de Acesso *</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={cadSenha}
                        onChange={(e) => setCadSenha(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full text-xs font-medium px-3.5 py-2.5 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#006c49] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                    <span className="material-symbols-outlined text-[#006c49] text-base shrink-0 mt-0.5">verified_user</span>
                    <span>Ao se cadastrar, seu login é ativado imediatamente com acesso ao painel Minha Conta e sua reserva é confirmada sem esperas!</span>
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3.5 px-4 rounded-2xl bg-[#003400] hover:bg-[#002500] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                  >
                    {authLoading ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                        <span>Criando Cadastro e Reservando...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base text-[#10B981]">how_to_reg</span>
                        <span>Cadastrar e Confirmar Reserva</span>
                      </>
                    )}
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => { setAuthModalTab('login'); setAuthError(''); }}
                      className="text-xs font-bold text-[#006c49] hover:underline"
                    >
                      Já possui cadastro? Clique aqui para entrar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIRMAÇÃO DE RESERVA REALIZADA COM SUCESSO (COM LINK MINHA CONTA) */}
      {/* ========================================================================= */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header de Celebração */}
            <div className="bg-gradient-to-br from-[#003400] via-[#004d26] to-[#006c49] p-6 text-white text-center relative">
              <button
                onClick={() => setIsSuccessModalOpen(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Fechar"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>

              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-3xl text-emerald-300">task_alt</span>
              </div>

              <span className="px-3 py-1 rounded-full bg-white/20 text-white font-extrabold text-[10px] tracking-wider uppercase inline-block mb-1">
                Reserva Registrada com Sucesso!
              </span>
              <h3 className="text-2xl font-black leading-tight">
                Parabéns pela sua Reserva!
              </h3>
              <p className="text-emerald-100 text-xs mt-1 max-w-sm mx-auto">
                A recepção de <strong>{currentHotel.name}</strong> foi alertada em tempo real com a sua solicitação.
              </p>
            </div>

            {/* Detalhes da Reserva */}
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-bold">Código da Reserva:</span>
                  <span className="font-black text-[#006c49] text-sm font-mono">
                    {reservaConfirmadaData?.reservaNumber || '#RES-ONLINE'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Hóspede:</span>
                  <span className="font-bold text-slate-900">
                    {reservaConfirmadaData?.nome_hospede || localStorage.getItem('hotelnozap_user_name') || 'Hóspede'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Hotel / Pousada:</span>
                  <span className="font-bold text-slate-900">{currentHotel.name}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Acomodação:</span>
                  <span className="font-bold text-slate-900">{getTituloExplicitoQuarto(currentQuarto)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Período:</span>
                  <span className="font-bold text-slate-900">
                    {formatarDataBR(checkInDate)} a {formatarDataBR(checkOutDate)} ({totalNoites} {totalNoites === 1 ? 'diária' : 'diárias'})
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-slate-700 font-bold">Valor Total:</span>
                  <span className="text-base font-black text-[#006c49]">
                    R$ {valorTotalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Ações Inteligentes: Minha Conta + WhatsApp */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleIrParaMinhaConta}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#003400] hover:bg-[#002500] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg text-[#10B981]">manage_accounts</span>
                  <span>Acessar Minha Conta de Hóspede</span>
                </button>

                <button
                  type="button"
                  onClick={enviarWhatsAppConfirmado}
                  className="w-full py-3 px-4 rounded-2xl border-2 border-[#10B981] bg-emerald-50 hover:bg-emerald-100 text-[#003400] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg text-[#10B981]">chat</span>
                  <span>Enviar Comprovante no WhatsApp do Hotel</span>
                </button>
              </div>

              <p className="text-[11px] text-center text-slate-500 pt-1">
                Sua reserva já está sincronizada em sua conta. Você pode acessá-la quando quiser!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FULLSCREEN / LIGHTBOX DE TODAS AS FOTOS DO QUARTO */}
      {isModalFotosOpen && galleryImages.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between animate-in fade-in duration-200">
          {/* Barra Superior */}
          <div className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4 border-b border-white/10 z-10 bg-black/40">
            <button
              type="button"
              onClick={() => setIsModalFotosOpen(false)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
              <span>Fechar</span>
            </button>

            <div className="text-center">
              <p className="text-white font-bold text-xs sm:text-sm">
                {currentQuarto.name}
              </p>
              <p className="text-slate-400 text-[11px] sm:text-xs">
                {modalPhotoIndex + 1} de {galleryImages.length} fotos
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                title="Compartilhar"
              >
                <span className="material-symbols-outlined text-lg">share</span>
              </button>
            </div>
          </div>

          {/* Área Central com Imagem Grande e Navegação */}
          <div className="relative flex-1 flex items-center justify-center p-3 sm:p-6 overflow-hidden select-none">
            {galleryImages.length > 1 && (
              <button
                type="button"
                onClick={() => setModalPhotoIndex((prev) => (prev > 0 ? prev - 1 : galleryImages.length - 1))}
                className="absolute left-2 sm:left-6 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 backdrop-blur-xs transition-all active:scale-90 cursor-pointer"
                aria-label="Foto anterior"
              >
                <span className="material-symbols-outlined text-2xl sm:text-3xl">chevron_left</span>
              </button>
            )}

            <img
              src={galleryImages[modalPhotoIndex]}
              alt={`${currentQuarto.name} foto ${modalPhotoIndex + 1}`}
              className="max-h-[70vh] sm:max-h-[76vh] max-w-[92vw] sm:max-w-[85vw] object-contain rounded-2xl shadow-2xl transition-all duration-200"
            />

            {galleryImages.length > 1 && (
              <button
                type="button"
                onClick={() => setModalPhotoIndex((prev) => (prev < galleryImages.length - 1 ? prev + 1 : 0))}
                className="absolute right-2 sm:right-6 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 backdrop-blur-xs transition-all active:scale-90 cursor-pointer"
                aria-label="Próxima foto"
              >
                <span className="material-symbols-outlined text-2xl sm:text-3xl">chevron_right</span>
              </button>
            )}
          </div>

          {/* Miniaturas Inferiores */}
          {galleryImages.length > 1 && (
            <div className="px-4 py-3 bg-black/60 border-t border-white/10 overflow-x-auto flex items-center justify-start sm:justify-center gap-2 sm:gap-3 z-10 scrollbar-thin">
              {galleryImages.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setModalPhotoIndex(idx)}
                  className={`h-12 w-16 sm:h-16 sm:w-24 rounded-lg overflow-hidden shrink-0 transition-all border-2 cursor-pointer ${
                    modalPhotoIndex === idx
                      ? 'border-white ring-2 ring-white/50 scale-105 opacity-100'
                      : 'border-transparent opacity-50 hover:opacity-90'
                  }`}
                >
                  <img
                    src={img}
                    alt={`Miniatura ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL FULLSCREEN DE VÍDEO DO QUARTO */}
      {isVideoModalOpen && currentQuarto?.videoUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 animate-in fade-in"
          onClick={() => setIsVideoModalOpen(false)}
        >
          {/* Top Bar */}
          <div 
            className="w-full max-w-4xl flex items-center justify-between pb-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-400 text-2xl">videocam</span>
              <div>
                <h4 className="font-bold text-sm sm:text-base leading-tight">{currentQuarto.name}</h4>
                <p className="text-[11px] text-slate-400">Tour em Vídeo da Acomodação</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsVideoModalOpen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              title="Fechar vídeo"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Video Container */}
          <div 
            className="w-full max-w-4xl aspect-video max-h-[80vh] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={currentQuarto.videoUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            >
              Seu navegador não suporta a tag de vídeo.
            </video>
          </div>

          {/* Bottom Bar */}
          <div 
            className="w-full max-w-4xl flex items-center justify-between pt-3 text-xs text-slate-400"
            onClick={(e) => e.stopPropagation()}
          >
            <span>{currentHotel?.name} • Quarto {currentQuarto.number}</span>
            <button
              type="button"
              onClick={() => setIsVideoModalOpen(false)}
              className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default DetalhesQuarto;
