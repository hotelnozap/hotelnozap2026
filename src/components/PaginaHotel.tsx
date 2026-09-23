import React, { useState, useEffect } from 'react';
import { PublicHotel } from './CatalogoHoteis';
import { hoteisService, quartosService, tiposQuartosService, currentHotelService, comodidadesService, ComodidadeCategoria } from '../services/supabaseService';
import { supabase } from '../lib/supabase';
import { webhookN8nService } from '../services/webhookN8nService';
import { getAppLoginUrl } from '../utils/partnerUrl';

export const slugify = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
};

export interface QuartoCadastrado {
  id: string;
  hotel_id?: string;
  number: string;
  name: string;
  category: string;
  capacity: number;
  dailyPrice: number;
  description?: string;
  notes?: string;
  observacoes?: string;
  imageUrl?: string;
  fotoCapa?: string;
  photos?: string[];
  videoUrl?: string;
  status: string;
  amenities: { icon: string; label: string }[];
  items?: Record<string, any>;
  comodidades?: ComodidadeCategoria[];
}

const BUILD_AMENITIES_FROM_ITEMS = (rawItems: any, cap: number, comodidadesList?: ComodidadeCategoria[]): { icon: string; label: string }[] => {
  const dynamic: { icon: string; label: string }[] = [];

  if (Array.isArray(comodidadesList) && comodidadesList.length > 0) {
    for (const cat of comodidadesList) {
      if (cat.itens && Array.isArray(cat.itens)) {
        for (const it of cat.itens) {
          if (it.texto && it.texto.trim()) {
            dynamic.push({
              icon: cat.icon || 'check_circle',
              label: it.texto.trim()
            });
            if (dynamic.length >= 6) break;
          }
        }
      }
      if (dynamic.length >= 6) break;
    }
  }

  if (dynamic.length === 0) {
    return [
      { icon: 'king_bed', label: `${cap} Leitos` },
      { icon: 'ac_unit', label: 'Ar Climatizado' },
      { icon: 'wifi', label: 'Wi-Fi Rápido' },
      { icon: 'tv', label: 'Smart TV' },
      { icon: 'shower', label: 'Ducha Quente' }
    ];
  }
  return dynamic;
};

export interface PaginaHotelProps {
  hotel?: PublicHotel | null;
  hotelSlug?: string;
  onNavigateBack?: () => void;
  onNavigateToLogin?: () => void;
  onNavigateToRoom?: (quarto: QuartoCadastrado) => void;
}

function formatInstagramUrl(val?: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('instagram.com/')) return `https://${trimmed}`;
  if (trimmed.startsWith('www.instagram.com/')) return `https://${trimmed}`;
  const handle = trimmed.replace(/^@/, '');
  return `https://instagram.com/${handle}`;
}

function formatFacebookUrl(val?: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('facebook.com/')) return `https://${trimmed}`;
  if (trimmed.startsWith('www.facebook.com/')) return `https://${trimmed}`;
  const handle = trimmed.replace(/^@/, '');
  return `https://facebook.com/${handle}`;
}

function formatTikTokUrl(val?: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('tiktok.com/')) return `https://${trimmed}`;
  if (trimmed.startsWith('www.tiktok.com/')) return `https://${trimmed}`;
  const handle = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
  return `https://www.tiktok.com/${handle}`;
}

function formatWhatsAppUrl(val?: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  const fullPhone = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${fullPhone}`;
}

export const PaginaHotel: React.FC<PaginaHotelProps> = ({
  hotel: propHotel,
  hotelSlug: propSlug,
  onNavigateBack,
  onNavigateToLogin,
  onNavigateToRoom
}) => {
  const [currentHotel, setCurrentHotel] = useState<PublicHotel | null>(propHotel || null);
  const [quartosList, setQuartosList] = useState<QuartoCadastrado[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activePhoto, setActivePhoto] = useState<string>('');
  const [totalQuartosCount, setTotalQuartosCount] = useState<number>(0);

  // Estados para captura da Fila de Espera VIP (quando o hotel está 100% lotado)
  const [leadNome, setLeadNome] = useState<string>('');
  const [leadWhatsapp, setLeadWhatsapp] = useState<string>('');
  const [leadEmail, setLeadEmail] = useState<string>('');
  const [leadSubmitting, setLeadSubmitting] = useState<boolean>(false);
  const [leadSuccess, setLeadSuccess] = useState<boolean>(false);

  const menorDiaria = React.useMemo(() => {
    if (quartosList && quartosList.length > 0) {
      const validPrices = quartosList
        .map(q => Number(q.dailyPrice))
        .filter(p => !isNaN(p) && p > 0);
      if (validPrices.length > 0) {
        return Math.min(...validPrices);
      }
    }
    return currentHotel?.pricePerNight || 220;
  }, [quartosList, currentHotel]);

  const galleryImages: string[] = React.useMemo(() => {
    if (!currentHotel) return [];
    const imgs = [currentHotel.imageUrl];
    quartosList.forEach(q => {
      if (q.imageUrl && !imgs.includes(q.imageUrl)) imgs.push(q.imageUrl);
      if (q.photos) {
        q.photos.forEach(p => {
          if (p && !imgs.includes(p)) imgs.push(p);
        });
      }
    });
    return imgs.slice(0, 5);
  }, [currentHotel, quartosList]);

  useEffect(() => {
    loadHotelAndQuartos();

    const handleAtualizacao = () => {
      loadHotelAndQuartos();
    };

    window.addEventListener('hotel_nova_reserva', handleAtualizacao);
    window.addEventListener('hotel_reserva_modificada', handleAtualizacao);
    window.addEventListener('hotel_quarto_atualizado', handleAtualizacao);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'hotel_nova_reserva_trigger') {
        loadHotelAndQuartos();
      }
    };
    window.addEventListener('storage', handleStorage);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('hotel_notifications_channel');
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'NOVA_RESERVA_HOSPEDE' || ev.data?.type === 'CHECKOUT_REALIZADO') {
          loadHotelAndQuartos();
        }
      };
    } catch {}

    return () => {
      window.removeEventListener('hotel_nova_reserva', handleAtualizacao);
      window.removeEventListener('hotel_reserva_modificada', handleAtualizacao);
      window.removeEventListener('hotel_quarto_atualizado', handleAtualizacao);
      window.removeEventListener('storage', handleStorage);
      if (bc) {
        try { bc.close(); } catch {}
      }
    };
  }, [propHotel, propSlug]);

  // Submissão do formulário de fila de espera
  const handleEnviarFilaEspera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadNome.trim() || !leadWhatsapp.trim()) return;
    setLeadSubmitting(true);

    try {
      const waitlistPayload = {
        id: `espera-${Date.now()}`,
        hotelId: currentHotel?.id,
        hotelNome: currentHotel?.name,
        nome_hospede: leadNome.trim(),
        hospedeNome: leadNome.trim(),
        telefone: leadWhatsapp.trim(),
        email: leadEmail.trim() || 'Não informado',
        itemNome: `Fila de Espera VIP (Aguardando Desistência / Vaga)`,
        categoria: 'Fila de Espera',
        horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString()
      };

      // 1. Notificar tela do hotel via BroadcastChannel
      try {
        const bc = new BroadcastChannel('hotel_notifications_channel');
        bc.postMessage({ type: 'NOVA_RESERVA_HOSPEDE', data: waitlistPayload });
        bc.close();
      } catch {}

      // 2. Storage event
      try {
        localStorage.setItem('hotel_nova_reserva_trigger', JSON.stringify({
          ...waitlistPayload,
          _triggerUid: `${Date.now()}_${Math.random()}`
        }));
      } catch {}

      // 3. Supabase Realtime broadcast
      try {
        const rtChannel = supabase.channel('realtime_hotel_notifications');
        rtChannel.send({
          type: 'broadcast',
          event: 'solicitacao_hospede',
          payload: waitlistPayload
        });
      } catch {}

      setLeadSuccess(true);
    } catch (err) {
      console.error('Erro ao enviar dados para lista de espera:', err);
    } finally {
      setLeadSubmitting(false);
    }
  };

  // Contato direto no WhatsApp para quem está na fila de espera
  const openWhatsAppFilaEspera = () => {
    if (!currentHotel) return;
    const rawPhone = currentHotel.whatsappPhone ? currentHotel.whatsappPhone.replace(/\D/g, '') : '5581998765432';
    const formattedPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
    const rawMsg = `Olá! Sou *${leadNome || 'um cliente interessado'}* e gostaria de consultar a fila de espera do *${currentHotel.name}*.\n\n` +
      `Vi que todas as acomodações estão 100% ocupadas. Por favor, me avisem caso ocorra alguma desistência ou liberação de quarto!\n\n` +
      `📱 Meu WhatsApp: ${leadWhatsapp || 'o deste contato'}\n`;

    webhookN8nService.dispararWebhookAtendimento({
      hotel: currentHotel,
      contato: {
        nome: leadNome || 'Cliente Fila de Espera',
        telefone: leadWhatsapp || '',
        email: leadEmail || ''
      },
      mensagem: `Consulta fila de espera: ${currentHotel.name}`,
      origem: 'pagina_hotel_fila_espera'
    }).catch(() => {});

    const msg = encodeURIComponent(rawMsg);
    window.open(`https://wa.me/${formattedPhone}?text=${msg}`, '_blank');
  };

  const loadHotelAndQuartos = async () => {
    setLoading(true);
    try {

      // 1. Descobre o hotel
      const loggedHotel = currentHotelService.getCurrentHotel();
      let targetHotel: PublicHotel | null = propHotel || null;

      const pathSlug = window.location.pathname.replace(/^\/(hotel|hoteis)\/?/, '').split('/')[0] || '';
      const cleanSlug = (propSlug || pathSlug)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

      // Carrega sempre do Supabase para garantir os dados mais recentes (inclusive redes sociais)
      const dbHoteis = await hoteisService.getHoteis();
      const mappedDbHoteis: PublicHotel[] = (dbHoteis || []).map(h => {
        const cityParts = h.cityUf ? h.cityUf.split('/') : ['Ipojuca', 'PE'];
        const cName = cityParts[0]?.trim() || 'Ipojuca';
        const ufName = cityParts[1]?.trim() || 'PE';
        const isDemo = h.id === '11111111-1111-1111-1111-111111111111';
        const roomsCount = isDemo ? (h.capacity > 0 ? h.capacity : 4) : 0;

        return {
          id: h.id,
          name: h.name,
          link: h.link,
          category: h.category || 'Hotel & Pousada',
          city: h.city || cName,
          uf: h.uf || ufName,
          neighborhood: h.neighborhood || 'Centro / Orla',
          imageUrl: h.imageUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80',
          rating: 4.90,
          reviewsCount: 45,
          pricePerNight: isDemo ? 220 : 0,
          whatsappPhone: (h.whatsapp ? h.whatsapp.replace(/\D/g, '') : (h.managerPhone ? h.managerPhone.replace(/\D/g, '') : '')),
          instagram: h.instagram || undefined,
          facebook: h.facebook || undefined,
          tiktok: h.tiktok || undefined,
          whatsapp: h.whatsapp || undefined,
          cancellationText: 'Cancelamento flexível via Zap',
          capacity: roomsCount,
          notes: h.notes,
          plan: h.plan,
          isImportedFromGoogle: Boolean(
            (h.plan && h.plan.toLowerCase().includes('google')) ||
            (h.notes && h.notes.toLowerCase().includes('google')) ||
            (h.notes && h.notes.toLowerCase().includes('importado')) ||
            (h.imageUrl && h.imageUrl.includes('places.googleapis.com'))
          ),
          roomTitle: roomsCount > 0 ? `Acomodação com ${roomsCount} quartos` : 'Contato Direto',
          amenities: roomsCount > 0 ? [
            { icon: 'bedroom_parent', label: `${roomsCount} Quartos` },
            { icon: 'wifi', label: 'Wi-Fi Grátis' },
            { icon: 'directions_car', label: 'Garagem: Sim' },
            { icon: 'ac_unit', label: 'Ar Condicionado' }
          ] : []
        };
      });

      const combinedHoteis = [...mappedDbHoteis];

      if (targetHotel) {
        // Encontra no banco para obter os campos mais atualizados de redes sociais
        const dbMatch = combinedHoteis.find(h => h.id === targetHotel?.id || h.name.toLowerCase() === targetHotel?.name.toLowerCase());
        if (dbMatch) {
          targetHotel = {
            ...targetHotel,
            ...dbMatch,
            instagram: dbMatch.instagram || targetHotel.instagram,
            facebook: dbMatch.facebook || targetHotel.facebook,
            tiktok: dbMatch.tiktok || targetHotel.tiktok,
            whatsapp: dbMatch.whatsapp || targetHotel.whatsapp,
            whatsappPhone: dbMatch.whatsappPhone || targetHotel.whatsappPhone
          };
        }
      } else {
        if (cleanSlug) {
          const normCleanSlug = cleanSlug.replace(/[^a-z0-9]/g, '');

          // Se for 'nomedohotel' ou slug genérico, prioriza o hotel logado
          if ((cleanSlug === 'nomedohotel' || normCleanSlug === 'nomedohotel') && loggedHotel) {
            targetHotel = combinedHoteis.find((h: any) => h.id === loggedHotel.id || h.name.toLowerCase() === loggedHotel.name.toLowerCase()) || null;
          }

          if (!targetHotel) {
            targetHotel = combinedHoteis.find((h: any) => {
              const hSlug = slugify(h.name);
              const hSlugNoHyphen = h.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
              const hLinkSlug = h.link ? slugify(h.link.replace(/^\/(hotel|hoteis)\/?/, '')) : '';
              const hLinkNoHyphen = h.link ? h.link.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
              return hSlug === cleanSlug || 
                     hSlugNoHyphen === normCleanSlug ||
                     (hLinkSlug && hLinkSlug === cleanSlug) ||
                     (hLinkNoHyphen && hLinkNoHyphen === normCleanSlug) ||
                     h.id === cleanSlug || 
                     hSlug.includes(cleanSlug) || 
                     cleanSlug.includes(hSlug);
            }) || null;
          }
        }

        if (!targetHotel && loggedHotel) {
          targetHotel = combinedHoteis.find((h: any) => h.id === loggedHotel.id || h.name.toLowerCase() === loggedHotel.name.toLowerCase()) || null;
        }

        if (!targetHotel && combinedHoteis.length > 0) {
          targetHotel = combinedHoteis[0];
        }
      }

      if (targetHotel && loggedHotel && (targetHotel.id === loggedHotel.id || targetHotel.name?.toLowerCase() === loggedHotel.name?.toLowerCase())) {
        targetHotel = {
          ...targetHotel,
          instagram: targetHotel.instagram || loggedHotel.instagram,
          facebook: targetHotel.facebook || loggedHotel.facebook,
          tiktok: targetHotel.tiktok || loggedHotel.tiktok,
          whatsapp: targetHotel.whatsapp || loggedHotel.whatsapp
        };
      }

      setCurrentHotel(targetHotel);
      if (targetHotel) setActivePhoto(targetHotel.imageUrl);

      // 1b. Carregar comodidades do hotel (nível estabelecimento) para repassar ao DetalhesQuarto via props
      if (targetHotel?.id) {
        try {
          const comodidades = await comodidadesService.getCategoriasByHotelId(targetHotel.id);
          if (comodidades && comodidades.length > 0) {
            const updated = { ...targetHotel, comodidades };
            setCurrentHotel(updated);
            targetHotel = updated;
          }
        } catch (err) {
          console.warn('Falha ao carregar comodidades do hotel na página', err);
        }
      }

      // 2. Carregar quartos cadastrados no banco Supabase para este hotel
      const hotelIdForRooms = targetHotel?.id || '';
      const dbQuartos = hotelIdForRooms ? await quartosService.getQuartos(hotelIdForRooms) : [];

      // 2b. Carregar reservas ativas deste hotel (status 'Confirmada' ou 'Hospedado') para desocupação em tempo real
      let activeReservations: any[] = [];
      if (hotelIdForRooms) {
        try {
          const { data: resData, error: resErr } = await supabase
            .from('reservas')
            .select('id, numero_quarto, quarto_id, status')
            .eq('hotel_id', hotelIdForRooms)
            .in('status', ['Confirmada', 'Hospedado', 'confirmada', 'hospedado']);
          if (!resErr && resData) {
            activeReservations = resData;
          }
        } catch (e) {
          console.warn('Erro ao carregar reservas ativas do hotel:', e);
        }
      }

      let mappedQuartos: QuartoCadastrado[] = [];

      if (dbQuartos && dbQuartos.length > 0) {
        mappedQuartos = dbQuartos.map((q, idx) => {
          const roomPhotos = (Array.isArray(q.photos) && q.photos.length > 0
            ? q.photos
            : (q.fotoCapa ? [q.fotoCapa] : []).concat(q.imageUrl ? [q.imageUrl] : []))
            .filter((p: string) => p && !p.startsWith('blob:') && !p.includes('images.unsplash.com') && p !== targetHotel?.imageUrl);

          const hasRealPhoto = roomPhotos.length > 0 || (q.fotoCapa && !q.fotoCapa.includes('images.unsplash.com') && q.fotoCapa !== targetHotel?.imageUrl);
          const chosenImage = hasRealPhoto 
            ? (roomPhotos[0] || q.fotoCapa || (q.imageUrl && !q.imageUrl.includes('images.unsplash.com') && q.imageUrl !== targetHotel?.imageUrl ? q.imageUrl : '') || '')
            : '';

          const roomNum = String(q.number || q.numero || `${101 + idx}`);
          const roomName = q.name || `Quarto ${roomNum}`;
          const roomCat = (q.category || q.categoria || q.tipo || 'STANDARD').toUpperCase();
          const roomPrice = Number(q.dailyPrice || q.valor_diaria) || 0;
          const roomCap = Number(q.capacity || q.capacidade) || 2;

          const rawItems = q.items;
          const roomNotes = q.notes || q.observacoes || '';
          const roomComodidades = (rawItems?.comodidades && Array.isArray(rawItems.comodidades)) ? rawItems.comodidades : (q.comodidades || []);
          return {
            id: String(q.id || `q-${idx}`),
            hotel_id: q.hotel_id || targetHotel?.id,
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
            amenities: BUILD_AMENITIES_FROM_ITEMS(rawItems, roomCap, roomComodidades),
            items: (rawItems && typeof rawItems === 'object') ? rawItems : {},
            comodidades: roomComodidades
          };
        });
      }

      // Se não houver quartos no banco, limpa qualquer resquício de cache local para hotéis não-demo
      if (mappedQuartos.length === 0 && hotelIdForRooms && hotelIdForRooms !== '11111111-1111-1111-1111-111111111111') {
        try {
          localStorage.removeItem(`hotelnozap_quartos_${hotelIdForRooms}`);
        } catch { /* ignore */ }
      }

      // Mescla status recente do cache local (ex: quarto que acabou de ir para 'limpeza' no checkout)
      if (hotelIdForRooms) {
        try {
          const localKey = `hotelnozap_quartos_${hotelIdForRooms}`;
          const localSaved = JSON.parse(localStorage.getItem(localKey) || '[]');
          if (Array.isArray(localSaved) && localSaved.length > 0) {
            mappedQuartos = mappedQuartos.map(q => {
              const match = localSaved.find((lq: any) => 
                (lq.id && String(lq.id) === String(q.id)) ||
                (lq.number && String(lq.number || lq.numero).trim() === String(q.number).trim())
              );
              if (match?.status) {
                return { ...q, status: match.status };
              }
              return q;
            });
          }
        } catch {}
      }

      // Filtra estritamente os quartos disponíveis (remove os que possuem reserva ativa ou status ocupado)
      const isQuartoOcupado = (q: any) => {
        const qStatus = (q.status || '').toLowerCase();
        if (qStatus === 'ocupado' || qStatus === 'reservado') return true;
        return activeReservations.some(r => {
          const matchId = r.quarto_id && String(r.quarto_id) === String(q.id);
          const matchNum = r.numero_quarto && String(r.numero_quarto).trim() === String(q.number || q.numero).trim();
          return matchId || matchNum;
        });
      };

      const quartosDisponiveis = mappedQuartos.filter(q => !isQuartoOcupado(q));
      setTotalQuartosCount(mappedQuartos.length);
      setQuartosList(quartosDisponiveis);

      if (mappedQuartos.length > 0) {
        const prices = mappedQuartos
          .map(q => Number(q.dailyPrice))
          .filter(p => !isNaN(p) && p > 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : (targetHotel?.pricePerNight || 0);
        const firstRealPhoto = mappedQuartos.find(q => q.imageUrl && !q.imageUrl.includes('unsplash.com'))?.imageUrl;
        if (targetHotel) {
          const resolvedImage = (!targetHotel.imageUrl || targetHotel.imageUrl.includes('unsplash.com')) && firstRealPhoto
            ? firstRealPhoto
            : targetHotel.imageUrl;
          targetHotel = { ...targetHotel, pricePerNight: minPrice, capacity: mappedQuartos.length, imageUrl: resolvedImage };
          setCurrentHotel(targetHotel);
        }
      } else {
        if (targetHotel) {
          targetHotel = { ...targetHotel, pricePerNight: 0, capacity: 0 };
          setCurrentHotel(targetHotel);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar detalhes da página do hotel:', err);
    } finally {
      setLoading(false);
    }
  };

  const openWhatsAppRoomReservation = (quarto: QuartoCadastrado) => {
    if (!currentHotel) return;
    const rawPhone = currentHotel.whatsappPhone ? currentHotel.whatsappPhone.replace(/\D/g, '') : '5581998765432';
    const formattedPhone = rawPhone.startsWith('55') ? rawPhone : (rawPhone ? `55${rawPhone}` : '5581998765432');
    const msgText = `Olá! Encontrei o hotel *${currentHotel.name}* no portal *Hotel no Zap* (${currentHotel.city}) e gostaria de verificar disponibilidade para a acomodação *${quarto.name}* (Diária R$ ${quarto.dailyPrice})!`;
    const message = encodeURIComponent(msgText);

    webhookN8nService.dispararWebhookAtendimento({
      hotel: currentHotel,
      mensagem: msgText,
      origem: 'pagina_hotel_quarto'
    }).catch(() => {});

    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
  };

  const openWhatsAppDirectContact = () => {
    if (!currentHotel) return;
    const rawPhone = currentHotel.whatsappPhone ? currentHotel.whatsappPhone.replace(/\D/g, '') : '';
    const formattedPhone = rawPhone.startsWith('55') ? rawPhone : (rawPhone ? `55${rawPhone}` : '5581998765432');
    const cityName = currentHotel.city || 'sua região';
    const messageText = 
      `Olá! Encontrei o *${currentHotel.name}* no portal *Hotel no Zap* (${cityName}) e gostaria de consultar informações sobre tarifas e disponibilidade de reservas!\n` +
      `Se você é o dono deste hotel e ainda não conhece nosso portal acesse\n` +
      `hotelnozap.com.br faça seu cadastro e nunca mais perca uma reserva.`;
    const message = encodeURIComponent(messageText);

    webhookN8nService.dispararWebhookAtendimento({
      hotel: currentHotel,
      mensagem: messageText,
      origem: 'pagina_hotel_contato_direto'
    }).catch(() => {});

    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
  };

  const isHotelImportadoGoogle = React.useMemo(() => {
    if (!currentHotel) return false;
    if (currentHotel.id === '11111111-1111-1111-1111-111111111111') return false;

    if (currentHotel.isImportedFromGoogle) return true;
    const planLower = (currentHotel.plan || '').toLowerCase();
    const notesLower = (currentHotel.notes || '').toLowerCase();
    const image = currentHotel.imageUrl || '';

    if (planLower.includes('google') || planLower.includes('maps')) return true;
    if (notesLower.includes('google') || notesLower.includes('importado') || notesLower.includes('places')) return true;
    if (image.includes('places.googleapis.com')) return true;

    // Hotéis importados do Google Maps não possuem quartos cadastrados no sistema
    if (quartosList.length === 0 && totalQuartosCount === 0) {
      return true;
    }

    return false;
  }, [currentHotel, quartosList.length, totalQuartosCount]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-[#003400] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-700">Carregando acomodações do hotel...</p>
      </div>
    );
  }

  if (!currentHotel) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <span className="material-symbols-outlined text-6xl text-slate-400">domain_disabled</span>
        <h2 className="text-xl font-bold text-slate-900">Hotel não encontrado</h2>
        <p className="text-xs text-slate-500 max-w-sm">
          O hotel solicitado não está cadastrado ou foi removido da plataforma.
        </p>
        <button
          onClick={() => {
            if (onNavigateBack) onNavigateBack();
            else window.location.href = '/hoteis';
          }}
          className="px-6 py-2.5 bg-[#003400] text-white rounded-xl font-bold text-xs shadow-md cursor-pointer"
        >
          Voltar à Lista de Hotéis
        </button>
      </div>
    );
  }


  return (
    <div className="bg-[#f8f9ff] text-slate-800 font-sans min-h-screen pb-24 selection:bg-emerald-500 selection:text-white">
      
      {/* HEADER SUPERIOR */}
      <header className="fixed top-0 left-0 right-0 w-full z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-xs">
        <div className="h-16 w-full max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between">
          
          {/* Logo & Voltar */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (onNavigateBack) onNavigateBack();
                else window.location.href = '/hoteis';
              }}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-all cursor-pointer flex items-center gap-1 font-bold text-xs mr-1"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              <span className="hidden sm:inline">Voltar à Lista de Hotéis</span>
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
            <button onClick={() => { if (onNavigateBack) onNavigateBack(); else window.location.href = '/hoteis'; }} className="hidden sm:inline-block px-3 py-2 rounded-xl hover:bg-slate-100 transition-all">Lista de Hotéis</button>
            <button onClick={() => window.location.href = '/hoteis'} className="hidden sm:inline-block px-3 py-2 rounded-xl hover:bg-slate-100 transition-all">Troque de Cidade</button>
            <button 
              onClick={() => {
                if (quartosList.length > 0) {
                  openWhatsAppRoomReservation(quartosList[0]);
                } else {
                  openWhatsAppDirectContact();
                }
              }} 
              className="px-3 py-2 rounded-xl text-[#006c49] font-bold hover:bg-emerald-50 transition-all flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">chat</span>
              <span>Recepção Zap</span>
            </button>
          </nav>

        </div>
      </header>

      {/* HEADER COMPACTO DO HOTEL (oculto para hotéis importados do Google Maps tanto em desktop quanto em mobile) */}
      {!isHotelImportadoGoogle && (
        <section className="pt-20 pb-2 px-4 sm:px-8 max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            
            {/* Foto thumb */}
            <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-xs">
              <img
                src={currentHotel.imageUrl}
                alt={currentHotel.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#006c49] block">
                {currentHotel.category} • {currentHotel.city}/{currentHotel.uf}
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">{currentHotel.name}</h1>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-amber-500 text-sm">star</span>
                  <span className="font-bold text-slate-700">{currentHotel.rating.toFixed(2)}</span>
                  <span>({currentHotel.reviewsCount} avaliações)</span>
                </div>
                <span className="text-slate-300">•</span>
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-emerald-600 text-sm">location_on</span>
                  <span>{currentHotel.neighborhood}, {currentHotel.city} - {currentHotel.uf}</span>
                </div>
              </div>
            </div>

            {/* Botão Zap */}
            <button
              onClick={openWhatsAppDirectContact}
              className="shrink-0 px-5 py-3 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">chat</span>
              <span>Chamar Recepção no WhatsApp</span>
            </button>

          </div>
        </section>
      )}

      {/* SEÇÃO PRINCIPAL: QUARTOS AGRUPADOS POR CATEGORIA */}
      <main className={`px-4 sm:px-8 max-w-7xl mx-auto space-y-10 ${isHotelImportadoGoogle ? 'pt-24' : 'mt-8'}`}>
        
        {quartosList.length > 0 ? (
          (() => {
            // Agrupar quartos por categoria preservando a ordem de aparição
            const categoryOrder: string[] = [];
            const grouped: Record<string, typeof quartosList> = {};
            quartosList.forEach(q => {
              const cat = q.category || 'STANDARD';
              if (!grouped[cat]) {
                grouped[cat] = [];
                categoryOrder.push(cat);
              }
              grouped[cat].push(q);
            });

            return (
              <>
                {/* Cabeçalho geral */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#006c49] text-2xl">meeting_room</span>
                      Acomodações Disponíveis em {currentHotel.name}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Escolha a opção ideal e solicite disponibilidade diretamente pelo WhatsApp do hotel
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 font-bold text-xs hidden sm:inline">
                    {quartosList.length} Opções Cadastradas
                  </span>
                </div>

                {/* Grupos por categoria */}
                {categoryOrder.map(cat => (
                  <div key={cat} className="space-y-4">
                    {/* Título da categoria */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-4 py-2 bg-[#003400] rounded-xl text-white">
                        <span className="material-symbols-outlined text-emerald-400 text-base">bedroom_parent</span>
                        <span className="font-extrabold text-sm tracking-wide">{cat}</span>
                        <span className="ml-1 text-emerald-300 text-xs font-semibold">
                          {grouped[cat].length} {grouped[cat].length === 1 ? 'quarto' : 'quartos'}
                        </span>
                      </div>
                      <div className="flex-1 h-px bg-slate-200"></div>
                    </div>

                    {/* Cards desta categoria */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {grouped[cat].map((quarto) => {
                        const handleGoToRoom = () => {
                          const hSlug = slugify(currentHotel.name);
                          const qSlug = slugify(quarto.name);
                          window.history.pushState({}, '', `/hotel/${hSlug}/${qSlug}`);
                          if (onNavigateToRoom) {
                            onNavigateToRoom(quarto);
                          } else {
                            openWhatsAppRoomReservation(quarto);
                          }
                        };

                        return (
                          <article
                            key={quarto.id}
                            onClick={handleGoToRoom}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleGoToRoom();
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label={`Ver detalhes de ${quarto.name}`}
                            className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:border-emerald-600/40 hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col justify-between group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <div>
                              {/* Imagem do Quarto */}
                              <div className="relative h-48 w-full overflow-hidden bg-slate-100 flex items-center justify-center">
                                {quarto.imageUrl && !quarto.imageUrl.startsWith('blob:') ? (
                                  <img
                                    src={quarto.imageUrl}
                                    alt={quarto.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-4 text-center border-b border-slate-100">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-1.5 text-slate-400">
                                      <span className="material-symbols-outlined text-2xl">no_photography</span>
                                    </div>
                                    <span className="text-xs font-bold text-slate-600">Nenhuma foto do quarto cadastrado</span>
                                  </div>
                                )}
                                {quarto.imageUrl && (
                                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent"></div>
                                )}

                                <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                                  <span className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold">
                                    {quarto.category}
                                  </span>
                                  {quarto.status?.toLowerCase() === 'limpeza' && (
                                    <span className="px-2.5 py-1 rounded-full bg-amber-500/95 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1 shadow-sm">
                                      <span className="material-symbols-outlined text-[13px]">cleaning_services</span>
                                      Em Limpeza
                                    </span>
                                  )}
                                  {quarto.videoUrl && (
                                    <span className="px-2 py-0.5 rounded-full bg-slate-900/85 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1 shadow-sm border border-white/20">
                                      <span className="material-symbols-outlined text-[12px] text-emerald-400">videocam</span>
                                      Vídeo
                                    </span>
                                  )}
                                </div>

                                <div className="absolute bottom-3 left-3 text-white">
                                  <span className="text-xs font-bold drop-shadow-xs">Nº {quarto.number}</span>
                                </div>
                              </div>

                              {/* Conteúdo do Quarto */}
                              <div className="p-5 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="font-extrabold text-slate-900 text-base leading-snug group-hover:text-[#006c49] transition-colors">
                                    {quarto.category && !quarto.name.toLowerCase().includes(quarto.category.toLowerCase())
                                      ? `${quarto.category.charAt(0).toUpperCase() + quarto.category.slice(1).toLowerCase()} - ${quarto.name}`
                                      : quarto.name}
                                  </h3>
                                </div>

                                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                  {quarto.description}
                                </p>
                              </div>
                            </div>

                            {/* PREÇO E BOTÃO */}
                            <div className="p-5 pt-0 space-y-3">
                              <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
                                <div>
                                  <span className="text-[11px] font-semibold text-slate-500 block">Valor da Diária</span>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-xl sm:text-2xl font-black text-slate-900">R$ {quarto.dailyPrice}</span>
                                    <span className="text-xs text-slate-500 font-medium">/ noite</span>
                                  </div>
                                </div>
                                <span className="text-[10px] text-emerald-700 uppercase font-bold">Sem Taxas Extras</span>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGoToRoom();
                                }}
                                className="w-full py-3 px-4 rounded-xl bg-[#003400] hover:bg-[#002500] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]">visibility</span>
                                <span>Ver Quarto</span>
                              </button>
                            </div>

                          </article>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            );
          })()
        ) : totalQuartosCount > 0 ? (
          /* HOTEL LOTADO NO MOMENTO: FORMULÁRIO DE FILA DE ESPERA E AVISO 100% LOTADO */
          <div className="bg-white rounded-3xl p-6 sm:p-10 border-2 border-amber-500/30 shadow-xl max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* BADGE DE ALERTA DE LOTAÇÃO */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs uppercase tracking-wider shadow-xs">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                <span>Capacidade Máxima Atingida</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Estamos 100% Lotados no Momento!
              </h2>
              <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
                Todas as acomodações de <strong>{currentHotel.name}</strong> estão reservadas ou ocupadas no momento.
              </p>
            </div>

            {/* CARD EXPLICATIVO DA LISTA DE ESPERA INTELIGENTE */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50 via-emerald-50/50 to-amber-50 border border-amber-200/80 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <span className="material-symbols-outlined text-2xl">event_busy</span>
              </div>
              <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                <strong className="block text-slate-900 font-bold mb-1">
                  Deseja ser avisado caso ocorra um cancelamento?
                </strong>
                Cadastre seus dados abaixo para entrar na nossa <strong>Fila de Espera Prioritária</strong>. Se algum hóspede cancelar ou uma data for liberada, nosso atendente entrará em contato imediatamente com você pelo WhatsApp!
              </div>
            </div>

            {/* SE JÁ ENVIOU: TELA DE CONFIRMAÇÃO COM WHATSAPP DIRETO */}
            {leadSuccess ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 sm:p-8 text-center space-y-4 animate-in zoom-in-95 duration-300">
                <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                  <span className="material-symbols-outlined text-3xl">check_circle</span>
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-black text-emerald-950">
                    Você está na Fila de Espera Prioritária!
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-800 max-w-md mx-auto">
                    Seus dados foram enviados com sucesso à recepção de <strong>{currentHotel.name}</strong>. Havendo qualquer cancelamento, chamaremos você prioritariamente no WhatsApp!
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={openWhatsAppFilaEspera}
                    className="w-full sm:w-auto px-6 py-3.5 bg-[#10B981] hover:bg-emerald-600 text-white font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xl">chat</span>
                    <span>Falar com a Recepção no WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLeadSuccess(false);
                      setLeadNome('');
                      setLeadWhatsapp('');
                      setLeadEmail('');
                    }}
                    className="w-full sm:w-auto px-5 py-3 text-slate-600 hover:text-slate-900 font-bold text-xs rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Cadastrar outro contato
                  </button>
                </div>
              </div>
            ) : (
              /* FORMULÁRIO DE CAPTURA DE LEAD */
              <form onSubmit={handleEnviarFilaEspera} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">person</span>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Carlos Eduardo Silva"
                      value={leadNome}
                      onChange={(e) => setLeadNome(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">
                      WhatsApp com DDD <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">chat</span>
                      <input
                        type="tel"
                        required
                        placeholder="Ex: (81) 98765-4321"
                        value={leadWhatsapp}
                        onChange={(e) => setLeadWhatsapp(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">
                      Seu E-mail <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">mail</span>
                      <input
                        type="email"
                        required
                        placeholder="Ex: seuemail@exemplo.com"
                        value={leadEmail}
                        onChange={(e) => setLeadEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={leadSubmitting}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-700 to-[#003400] hover:from-emerald-800 hover:to-[#002500] text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
                  >
                    {leadSubmitting ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                        <span>Registrando na Fila de Espera...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">notification_add</span>
                        <span>Quero Entrar na Fila de Espera</span>
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-center text-slate-500 mt-2">
                    🔒 Seus dados são confidenciais e utilizados estritamente para avisar sobre desocupação de quartos neste hotel.
                  </p>
                </div>
              </form>
            )}

            {/* OPÇÃO DE CONTATO DIRETO COM A RECEPÇÃO */}
            <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-700 text-base">support_agent</span>
                Dúvidas sobre reservas ou pacotes futuros?
              </span>
              {currentHotel.whatsappPhone && (
                <button
                  type="button"
                  onClick={openWhatsAppDirectContact}
                  className="text-emerald-700 hover:text-emerald-900 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">chat</span>
                  Falar no WhatsApp da Recepção
                </button>
              )}
            </div>
          </div>
        ) : (
          /* HOTEL IMPORTADO / SEM QUARTOS: SOMENTE NÚMERO DO WHATSAPP OU TELEFONE PARA CONTATO */
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-sm text-center max-w-3xl mx-auto space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-[#006c49] flex items-center justify-center mx-auto border border-emerald-100">
              <span className="material-symbols-outlined text-3xl">chat</span>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-3 py-1 rounded-full">
                Contato Direto com o Estabelecimento
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Atendimento de {currentHotel.name}
              </h2>
              <p className="text-sm text-slate-600 max-w-lg mx-auto">
                Para consultar valores de diárias, disponibilidade de acomodações ou realizar sua reserva, entre em contato diretamente com a equipe do hotel pelos canais abaixo:
              </p>
            </div>

            {/* Ações de Contato Direto */}
            <div className="flex items-center justify-center pt-2">
              {currentHotel.whatsappPhone && (
                <button
                  type="button"
                  onClick={openWhatsAppDirectContact}
                  className="w-full sm:w-auto px-8 py-4 bg-[#10B981] hover:bg-emerald-600 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2.5 shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-2xl">chat</span>
                  <span>Falar no WhatsApp ({currentHotel.whatsappPhone})</span>
                </button>
              )}
            </div>

            {/* Localização & Avaliação do Google */}
            <div className="border-t border-slate-100 pt-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-center gap-4">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-emerald-700 text-base">location_on</span>
                {currentHotel.neighborhood}, {currentHotel.city} - {currentHotel.uf}
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-amber-500 text-base">star</span>
                {currentHotel.rating.toFixed(1)} no Google ({currentHotel.reviewsCount} avaliações)
              </span>
            </div>

            {/* BANNER DE PROSPECÇÃO SAAS PARA O PROPRIETÁRIO DO HOTEL */}
            <div className="mt-8 p-6 bg-gradient-to-r from-emerald-950 via-[#003400] to-emerald-900 rounded-2xl text-white text-left flex flex-col sm:flex-row items-center justify-between gap-5 shadow-md border border-emerald-800/60">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-white/10 px-2 py-0.5 rounded">Área do Hoteleiro</span>
                </div>
                <h4 className="text-base font-bold text-white">É o proprietário ou gerente deste hotel?</h4>
                <p className="text-xs text-emerald-200/80 max-w-md">
                  Cadastre suas suítes, fotos e valores no <strong>Hotel no Zap</strong> para receber reservas automáticas 24h por dia via WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onNavigateToLogin) onNavigateToLogin();
                  else window.location.href = getAppLoginUrl();
                }}
                style={{ backgroundColor: '#B9CC01' }}
                className="px-5 py-3 rounded-xl text-[#003400] font-black text-xs shadow-md hover:brightness-95 active:scale-95 transition-all whitespace-nowrap cursor-pointer"
              >
                Cadastrar Meus Quartos
              </button>
            </div>

          </div>
        )}

      </main>

      {/* FOOTER PÚBLICO */}
      <footer className="w-full bg-slate-900 text-slate-400 py-12 border-t border-slate-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-8">
          
          {/* BLOCO DE REDES SOCIAIS OFICIAIS DO HOTEL */}
          {Boolean(
            currentHotel && (
              (currentHotel.instagram && currentHotel.instagram.trim()) ||
              (currentHotel.facebook && currentHotel.facebook.trim()) ||
              (currentHotel.tiktok && currentHotel.tiktok.trim()) ||
              (currentHotel.whatsapp && currentHotel.whatsapp.trim()) ||
              (currentHotel.whatsappPhone && currentHotel.whatsappPhone.trim() && !currentHotel.whatsappPhone.includes('5581998765432'))
            )
          ) && (
            <div className="pb-8 border-b border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-1">
                <span className="text-[11px] uppercase font-extrabold tracking-widest text-emerald-400 block">
                  Canais Oficiais do Estabelecimento
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  Conecte-se com {currentHotel?.name}
                </h3>
                <p className="text-xs text-slate-400">
                  Acompanhe novidades, fotos da propriedade e fale diretamente com o atendimento oficial.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Instagram */}
                {Boolean(currentHotel?.instagram && currentHotel.instagram.trim()) && (
                  <a
                    href={formatInstagramUrl(currentHotel?.instagram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 text-white font-bold text-xs hover:brightness-110 transition-all shadow-md active:scale-95 group cursor-pointer"
                    title={`Visitar Instagram Oficial: ${currentHotel?.instagram}`}
                  >
                    <svg className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    <span>Instagram</span>
                  </a>
                )}

                {/* Facebook */}
                {Boolean(currentHotel?.facebook && currentHotel.facebook.trim()) && (
                  <a
                    href={formatFacebookUrl(currentHotel?.facebook)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1877F2] text-white font-bold text-xs hover:bg-[#166fe5] transition-all shadow-md active:scale-95 group cursor-pointer"
                    title={`Visitar Facebook Oficial: ${currentHotel?.facebook}`}
                  >
                    <svg className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <span>Facebook</span>
                  </a>
                )}

                {/* TikTok */}
                {Boolean(currentHotel?.tiktok && currentHotel.tiktok.trim()) && (
                  <a
                    href={formatTikTokUrl(currentHotel?.tiktok)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all shadow-md active:scale-95 group cursor-pointer"
                    title={`Visitar TikTok Oficial: ${currentHotel?.tiktok}`}
                  >
                    <svg className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01v8.86c0 1.57-.29 3.14-.92 4.58-.69 1.58-1.77 2.97-3.13 3.96-1.39 1.01-3.06 1.64-4.81 1.74-1.78.11-3.58-.27-5.18-1.05-1.63-.79-3.02-2.01-4-3.53-.98-1.52-1.5-3.32-1.48-5.13.02-1.8.58-3.58 1.58-5.08 1.01-1.5 2.43-2.68 4.09-3.37 1.66-.69 3.51-.83 5.27-.41v4.18c-1.02-.31-2.14-.31-3.14.01-.98.31-1.82.95-2.39 1.81-.57.86-.83 1.9-.74 2.94.09 1.04.56 2.02 1.31 2.75.76.73 1.77 1.15 2.82 1.18 1.06.03 2.1-.33 2.89-1.02.8-.69 1.32-1.67 1.45-2.73.07-.58.07-1.16.07-1.74V.02z"/>
                    </svg>
                    <span>TikTok</span>
                  </a>
                )}

                {/* WhatsApp */}
                {Boolean(
                  (currentHotel?.whatsapp && currentHotel.whatsapp.trim()) ||
                  (currentHotel?.whatsappPhone && currentHotel.whatsappPhone.trim() && !currentHotel.whatsappPhone.includes('5581998765432'))
                ) && (
                  <a
                    href={formatWhatsAppUrl(currentHotel?.whatsapp || currentHotel?.whatsappPhone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs transition-all shadow-md active:scale-95 group cursor-pointer"
                    title={`Falar no WhatsApp: ${currentHotel?.whatsapp || currentHotel?.whatsappPhone}`}
                  >
                    <svg className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                    </svg>
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Copyright & Links Gerais */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-xs">
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
              <button onClick={() => { if (onNavigateBack) onNavigateBack(); else window.location.href = '/hoteis'; }} className="hover:text-white transition-colors cursor-pointer">Voltar à Lista de Hotéis</button>
              <button 
                onClick={() => {
                  if (quartosList.length > 0) {
                    openWhatsAppRoomReservation(quartosList[0] || { name: 'Recepção' } as any);
                  } else {
                    openWhatsAppDirectContact();
                  }
                }} 
                className="hover:text-white transition-colors cursor-pointer"
              >
                Suporte WhatsApp
              </button>
              <button onClick={() => { if (onNavigateToLogin) onNavigateToLogin(); else window.location.href = getAppLoginUrl(); }} className="hover:text-white transition-colors cursor-pointer">Área do Hoteleiro</button>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default PaginaHotel;
