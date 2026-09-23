import React, { useState, useEffect } from 'react';
import { hoteisService, reservasService, quartosService, ComodidadeCategoria } from '../services/supabaseService';
import { Hotel } from './CadastroHoteis';
import { webhookN8nService } from '../services/webhookN8nService';
import { getAppLoginUrl } from '../utils/partnerUrl';

export interface PublicHotel {
  id: string;
  name: string;
  category: string;
  city: string;
  uf: string;
  neighborhood: string;
  imageUrl: string;
  rating: number;
  reviewsCount: number;
  pricePerNight: number;
  whatsappPhone: string;
  cancellationText: string;
  capacity?: number;
  amenities: { icon: string; label: string }[];
  isFeatured?: boolean;
  tag?: string;
  roomTitle?: string;
  hasRooms?: boolean;
  link?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  whatsapp?: string;
  comodidades?: ComodidadeCategoria[];
  notes?: string;
  plan?: string;
  isImportedFromGoogle?: boolean;
}

// Cidades populares pré-cadastradas por estado para o Modal de Seleção
export const CIDADES_POR_ESTADO: Record<string, string[]> = {
  'PE': ['Ipojuca (Porto de Galinhas)', 'Recife', 'Gravatá', 'Tamandaré (Praia dos Carneiros)', 'Olinda', 'Fernando de Noronha'],
  'AL': ['Maragogi', 'Maceió', 'São Miguel dos Milagres', 'Japaratinga', 'Marechal Deodoro'],
  'BA': ['Porto Seguro', 'Salvador', 'Arraial d\'Ajuda', 'Trancoso', 'Praia do Forte', 'Ilhéus'],
  'CE': ['Fortaleza', 'Jericoacoara', 'Canoa Quebrada', 'Aquiraz'],
  'RJ': ['Armação dos Búzios', 'Paraty', 'Arraial do Cabo', 'Rio de Janeiro', 'Angra dos Reis', 'Petrópolis'],
  'SP': ['Ubatuba', 'Campos do Jordão', 'Ilhabela', 'São Sebastião', 'São Paulo', 'Guarujá'],
  'SC': ['Florianópolis', 'Balneário Camboriú', 'Bombinhas', 'Garopaba', 'Penha'],
  'RS': ['Gramado', 'Canela', 'Bento Gonçalves', 'Torres'],
  'MG': ['Monte Verde', 'Ouro Preto', 'Tiradentes', 'Capitólio', 'Belo Horizonte'],
  'GO': ['Caldas Novas', 'Pirenópolis', 'Rio Quente']
};

export const ESTADOS_LISTA = [
  { code: 'AC', name: 'Acre' },
  { code: 'AL', name: 'Alagoas' },
  { code: 'AP', name: 'Amapá' },
  { code: 'AM', name: 'Amazonas' },
  { code: 'BA', name: 'Bahia' },
  { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'ES', name: 'Espírito Santo' },
  { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'PA', name: 'Pará' },
  { code: 'PB', name: 'Paraíba' },
  { code: 'PR', name: 'Paraná' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'PI', name: 'Piauí' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'RO', name: 'Rondônia' },
  { code: 'RR', name: 'Roraima' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'SP', name: 'São Paulo' },
  { code: 'SE', name: 'Sergipe' },
  { code: 'TO', name: 'Tocantins' },
];

export const ESTADOS_NOMES_MAP: Record<string, string> = {
  'AC': 'Acre',
  'AL': 'Alagoas',
  'AP': 'Amapá',
  'AM': 'Amazonas',
  'BA': 'Bahia',
  'CE': 'Ceará',
  'DF': 'Distrito Federal',
  'ES': 'Espírito Santo',
  'GO': 'Goiás',
  'MA': 'Maranhão',
  'MT': 'Mato Grosso',
  'MS': 'Mato Grosso do Sul',
  'MG': 'Minas Gerais',
  'PA': 'Pará',
  'PB': 'Paraíba',
  'PR': 'Paraná',
  'PE': 'Pernambuco',
  'PI': 'Piauí',
  'RJ': 'Rio de Janeiro',
  'RN': 'Rio Grande do Norte',
  'RS': 'Rio Grande do Sul',
  'RO': 'Rondônia',
  'RR': 'Roraima',
  'SC': 'Santa Catarina',
  'SP': 'São Paulo',
  'SE': 'Sergipe',
  'TO': 'Tocantins'
};

// Hotéis mockados removidos - catálogo exibe exclusivamente os hotéis cadastrados no Supabase
export const FALLBACK_PUBLIC_HOTEIS: PublicHotel[] = [];


export interface CatalogoHoteisProps {
  onNavigateToLogin?: () => void;
  onNavigateToHotel?: (hotel: PublicHotel) => void;
}

export const CatalogoHoteis: React.FC<CatalogoHoteisProps> = ({ onNavigateToLogin, onNavigateToHotel }) => {
  // Modal de localização (Estado / Cidade)
  const [selectedUf, setSelectedUf] = useState<string>('PE');
  const [selectedCity, setSelectedCity] = useState<string>('Ipojuca (Porto de Galinhas)');
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);
  const [cityFilterQuery, setCityFilterQuery] = useState<string>('');

  // Modais de "Quem Somos" e "Fale Conosco"
  const [isQuemSomosModalOpen, setIsQuemSomosModalOpen] = useState<boolean>(false);
  const [isFaleConoscoModalOpen, setIsFaleConoscoModalOpen] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);

  // Estado de autenticação do usuário
  // REGRA DE NEGÓCIO: Usuário do tipo Hotel NÃO PODE logar nem aparecer logado na página de listagem de hotéis.
  // A listagem de hotéis é exclusiva para hóspedes. Usuários de hotéis (Hotel, Gerente, etc.)
  // nunca têm sessão de catálogo ativa e sempre visualizam a opção "Acessar minha conta".
  const [currentUser, setCurrentUser] = useState<{
    isLoggedIn: boolean;
    name: string;
    email: string;
    role: string;
  }>(() => {
    try {
      const email = localStorage.getItem('hotelnozap_user_email') || '';
      const name = localStorage.getItem('hotelnozap_user_name') || 'Usuário';
      const role = localStorage.getItem('hotelnozap_user_role') || '';
      const roleLower = role.toLowerCase();

      const isHotel = roleLower.includes('hotel') || roleLower.includes('gerente') || roleLower.includes('pousada');
      const isHospede = (roleLower.includes('hospede') || roleLower.includes('hóspede')) && !isHotel;

      return {
        isLoggedIn: Boolean(email) && isHospede,
        name: name,
        email: email,
        role: role
      };
    } catch {
      return { isLoggedIn: false, name: '', email: '', role: '' };
    }
  });

  useEffect(() => {
    const syncUser = () => {
      try {
        const email = localStorage.getItem('hotelnozap_user_email') || '';
        const name = localStorage.getItem('hotelnozap_user_name') || 'Usuário';
        const role = localStorage.getItem('hotelnozap_user_role') || '';
        const roleLower = role.toLowerCase();

        const isHotel = roleLower.includes('hotel') || roleLower.includes('gerente') || roleLower.includes('pousada');
        const isHospede = (roleLower.includes('hospede') || roleLower.includes('hóspede')) && !isHotel;

        setCurrentUser({
          isLoggedIn: Boolean(email) && isHospede,
          name: name,
          email: email,
          role: role
        });
      } catch {
        setCurrentUser({ isLoggedIn: false, name: '', email: '', role: '' });
      }
    };

    window.addEventListener('storage', syncUser);
    window.addEventListener('user_role_changed', syncUser);
    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('user_role_changed', syncUser);
    };
  }, []);

  // Hotéis carregados do Supabase + Fallback
  const [hoteisList, setHoteisList] = useState<PublicHotel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filtros de busca na tela
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('Todos');
  const [sortBy, setSortBy] = useState<'recomendados' | 'preco_baixo' | 'avaliacao'>('recomendados');
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Modal Detalhes do Hotel
  const [selectedHotelDetails, setSelectedHotelDetails] = useState<PublicHotel | null>(null);

  // Carregar dados iniciais e verificar se há localização salva
  useEffect(() => {
    const savedUf = localStorage.getItem('hotelnozap_public_uf');
    const savedCity = localStorage.getItem('hotelnozap_public_city');

    if (savedUf && savedCity) {
      setSelectedUf(savedUf);
      setSelectedCity(savedCity);
    } else {
      // Abre modal de primeira visita
      setIsLocationModalOpen(true);
    }

    loadHoteisFromSupabase();
  }, []);

  const loadHoteisFromSupabase = async () => {
    setLoading(true);
    try {
      const [dbHoteis, dbQuartos] = await Promise.all([
        hoteisService.getHoteis(),
        quartosService.getAllQuartos()
      ]);

      // Mapeia o menor valor de diária, contagem e foto real a partir dos quartos reais cadastrados
      const minPriceByHotel: Record<string, number> = {};
      const roomsCountByHotel: Record<string, number> = {};
      const realPhotoByHotel: Record<string, string> = {};

      const isUnsplash = (url?: string) => !url || url.includes('images.unsplash.com');

      if (dbQuartos && dbQuartos.length > 0) {
        dbQuartos.forEach((q: any) => {
          const hKey = q.hotel_id;
          if (hKey) {
            roomsCountByHotel[hKey] = (roomsCountByHotel[hKey] || 0) + 1;
            const price = Number(q.dailyPrice || q.valor_diaria);
            if (price > 0) {
              if (!minPriceByHotel[hKey] || price < minPriceByHotel[hKey]) {
                minPriceByHotel[hKey] = price;
              }
            }
            if (!realPhotoByHotel[hKey]) {
              const photoCandidate = q.fotoCapa || (Array.isArray(q.photos) && q.photos[0]) || q.imageUrl;
              if (photoCandidate && !isUnsplash(photoCandidate)) {
                realPhotoByHotel[hKey] = photoCandidate;
              }
            }
          }
        });
      }

      const mappedDbHoteis: PublicHotel[] = (dbHoteis || []).map((h: any) => {
        let cName = (h.city || '').trim();
        let ufName = (h.uf || '').trim();
        if (!cName || !ufName) {
          if (h.cityUf) {
            const sep = h.cityUf.includes('/') ? '/' : (h.cityUf.includes('-') ? '-' : null);
            if (sep) {
              const parts = h.cityUf.split(sep);
              if (!cName) cName = parts[0]?.trim() || '';
              if (!ufName) ufName = parts[1]?.trim() || '';
            } else if (!cName) {
              cName = h.cityUf.trim();
            }
          }
        }
        if (!cName) cName = 'Ipojuca';
        if (!ufName) ufName = 'PE';
        const realRoomsCount = roomsCountByHotel[h.id] || 0;
        const hasRealRooms = realRoomsCount > 0;
        const hotelMinPrice = hasRealRooms ? (minPriceByHotel[h.id] || 0) : 0;

        // Foto real: prioriza foto do hotel se não for Unsplash; caso contrário, busca a foto real dos quartos
        let finalImageUrl = h.imageUrl;
        if (!h.imageUrl || isUnsplash(h.imageUrl)) {
          if (realPhotoByHotel[h.id]) {
            finalImageUrl = realPhotoByHotel[h.id];
            // Atualiza em background para persistir no Supabase
            hoteisService.updateHotel(h.id, { imageUrl: finalImageUrl }).catch(() => {});
          }
        }
        if (!finalImageUrl) {
          finalImageUrl = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80';
        }

        return {
          id: h.id,
          name: h.name,
          category: h.category || 'Hotel & Pousada',
          city: cName,
          uf: ufName,
          neighborhood: h.neighborhood || 'Centro / Orla',
          imageUrl: finalImageUrl,
          rating: 4.90,
          reviewsCount: 45,
          pricePerNight: hotelMinPrice,
          hasRooms: hasRealRooms,
          whatsappPhone: h.whatsapp ? h.whatsapp.replace(/\D/g, '') : (h.managerPhone ? h.managerPhone.replace(/\D/g, '') : ''),
          instagram: h.instagram || undefined,
          facebook: h.facebook || undefined,
          tiktok: h.tiktok || undefined,
          whatsapp: h.whatsapp || undefined,
          link: h.link || undefined,
          cancellationText: 'Cancelamento flexível via Zap',
          capacity: realRoomsCount,
          notes: h.notes,
          plan: h.plan,
          isImportedFromGoogle: Boolean(
            (h.plan && (h.plan.toLowerCase().includes('google') || h.plan.toLowerCase().includes('maps'))) ||
            (h.notes && (h.notes.toLowerCase().includes('google') || h.notes.toLowerCase().includes('importado') || h.notes.toLowerCase().includes('places'))) ||
            (h.imageUrl && h.imageUrl.includes('places.googleapis.com')) ||
            !hasRealRooms
          ),
          roomTitle: hasRealRooms ? `Acomodação com ${realRoomsCount} ${realRoomsCount === 1 ? 'quarto' : 'quartos'}` : 'Atendimento & Contato Direto',
          amenities: hasRealRooms ? [
            { icon: 'bedroom_parent', label: `${realRoomsCount} ${realRoomsCount === 1 ? 'Quarto' : 'Quartos'}` },
            { icon: 'wifi', label: 'Wi-Fi Grátis' },
            { icon: 'directions_car', label: 'Garagem: Sim' },
            { icon: 'ac_unit', label: 'Ar Condicionado' }
          ] : []
        };
      });

      // Define única e exclusivamente os hotéis cadastrados no Supabase
      setHoteisList(mappedDbHoteis);
    } catch (err) {
      console.warn('Erro ao carregar hotéis para catálogo público:', err);
      setHoteisList([]);
    } finally {
      setLoading(false);
    }
  };

  // Extrair UFs e Cidades dinamicamente APENAS dos hotéis cadastrados
  const availableUfsMap = React.useMemo(() => {
    const map: Record<string, Set<string>> = {};
    hoteisList.forEach(h => {
      const uf = (h.uf || 'PE').toUpperCase().trim();
      const city = (h.city || 'Ipojuca').trim();
      if (uf && city) {
        if (!map[uf]) map[uf] = new Set();
        map[uf].add(city);
      }
    });
    return map;
  }, [hoteisList]);

  const availableUfCodes = Object.keys(availableUfsMap);

  const availableEstados = ESTADOS_LISTA.filter(est => availableUfCodes.includes(est.code));
  availableUfCodes.forEach(code => {
    if (!availableEstados.some(e => e.code === code)) {
      availableEstados.push({ code, name: ESTADOS_NOMES_MAP[code] || code });
    }
  });

  const availableCities = React.useMemo(() => {
    const list = Array.from(availableUfsMap[selectedUf] || []);
    return list.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [availableUfsMap, selectedUf]);

  const filteredCities = React.useMemo(() => {
    if (!cityFilterQuery.trim()) return availableCities;
    const q = cityFilterQuery.toLowerCase().trim();
    return availableCities.filter(c => c.toLowerCase().includes(q));
  }, [availableCities, cityFilterQuery]);

  // Ajusta automaticamente a seleção inicial se o estado/cidade selecionado não existir nos cadastros
  useEffect(() => {
    if (availableUfCodes.length > 0 && !availableUfCodes.includes(selectedUf)) {
      const firstUf = availableUfCodes[0];
      setSelectedUf(firstUf);
      const cities = Array.from(availableUfsMap[firstUf] || []).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      if (cities.length > 0) setSelectedCity(cities[0]);
    } else if (availableCities.length > 0 && !availableCities.includes(selectedCity)) {
      setSelectedCity(availableCities[0]);
    }
  }, [hoteisList, selectedUf, availableUfCodes, availableCities]);

  const handleConfirmLocation = (uf: string, city: string) => {
    setSelectedUf(uf);
    setSelectedCity(city);
    localStorage.setItem('hotelnozap_public_uf', uf);
    localStorage.setItem('hotelnozap_public_city', city);
    setIsLocationModalOpen(false);
  };

  // Extrair Categorias e Bairros dinamicamente APENAS dos hotéis cadastrados
  const categoriesList = React.useMemo(() => {
    const cats = new Set<string>();
    cats.add('Todos');
    hoteisList.forEach(h => {
      if (h.category && h.category.trim()) {
        cats.add(h.category.trim());
      }
    });
    return Array.from(cats);
  }, [hoteisList]);

  const neighborhoodsList = React.useMemo(() => {
    const neighs = new Set<string>();
    neighs.add('Todos');
    hoteisList.forEach(h => {
      if (h.neighborhood && h.neighborhood.trim()) {
        neighs.add(h.neighborhood.trim());
      }
    });
    return Array.from(neighs);
  }, [hoteisList]);

  // Função auxiliar para normalizar nomes de cidades para busca exata (remove acentos, espaços extras e sufixos)
  const normalizeCityNameStrict = (name: string): string => {
    return (name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .toLowerCase()
      .split('(')[0] // remove sufixos explicativos em parênteses
      .replace(/[^a-z0-9\s]/g, '') // remove hífens, pontuações
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Filtrar hotéis pela Cidade / Estado e Filtros da UI — BUSCA EXATA
  const filteredHoteis = hoteisList.filter(h => {
    const normSelectedCity = normalizeCityNameStrict(selectedCity);
    const normHotelCity = normalizeCityNameStrict(h.city);
    const normSelectedUf = (selectedUf || '').toUpperCase().trim();
    const normHotelUf = (h.uf || '').toUpperCase().trim();

    // REGRA ESTRITA: O hotel DEVE pertencer exatamente à mesma UF E à mesma Cidade
    const matchesUf = !normSelectedUf || normHotelUf === normSelectedUf;
    const matchesCity = normHotelCity === normSelectedCity;
    const matchesCityAndUf = matchesUf && matchesCity;

    const matchesCategory = activeCategory === 'Todos' || 
      h.category.toLowerCase().trim() === activeCategory.toLowerCase().trim();

    const matchesNeighborhood = neighborhoodFilter === 'Todos' || 
      h.neighborhood.toLowerCase().trim().includes(neighborhoodFilter.toLowerCase().trim());

    return matchesCityAndUf && matchesCategory && matchesNeighborhood;
  });

  // Resultados de busca — busca global em todos os hotéis (sem filtro de cidade)
  const searchResults = isSearchActive && searchQuery.trim()
    ? hoteisList.filter(h => {
        const q = searchQuery.toLowerCase().trim();
        return (
          h.name.toLowerCase().includes(q) ||
          h.neighborhood.toLowerCase().includes(q) ||
          h.category.toLowerCase().includes(q) ||
          (h.city || '').toLowerCase().includes(q) ||
          (h.uf || '').toLowerCase().includes(q)
        );
      })
    : [];

  // Ordenação
  const sortedHoteis = [...filteredHoteis].sort((a, b) => {
    if (sortBy === 'preco_baixo') return a.pricePerNight - b.pricePerNight;
    if (sortBy === 'avaliacao') return b.rating - a.rating;
    return 0; // recomendados
  });

  const sortedSearchResults = [...searchResults].sort((a, b) => {
    if (sortBy === 'preco_baixo') return a.pricePerNight - b.pricePerNight;
    if (sortBy === 'avaliacao') return b.rating - a.rating;
    return 0;
  });

  // Gerar link direto para o WhatsApp do hotel
  const openWhatsAppReservation = async (hotel: PublicHotel) => {
    const rawPhone = hotel.whatsappPhone ? hotel.whatsappPhone.replace(/\D/g, '') : '5581998765432';
    const formattedPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
    const initialMsg = `Olá! Encontrei o hotel *${hotel.name}* no portal *Hotel no Zap* (${selectedCity}) e gostaria de verificar disponibilidade e consultar valores de reserva!`;

    // Disparar Webhook n8n de Atendimento (iniciar conversa) com todos os dados do hotel
    webhookN8nService.dispararWebhookAtendimento({
      hotel,
      mensagem: initialMsg,
      origem: 'catalogo_hoteis',
      cliente: {
        nome: 'Visitante (Catálogo de Hotéis)',
      }
    }).catch(err => {
      console.warn('[Webhook n8n] Erro ao disparar atendimento do catálogo:', err);
    });

    try {
      const checkInDate = new Date();
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 5);

      await reservasService.createReserva({
        nome_hospede: 'Hóspede Zap (Catálogo)',
        numero_quarto: '101',
        data_checkin: checkInDate.toISOString().split('T')[0],
        data_checkout: checkOutDate.toISOString().split('T')[0],
        valor_total: (hotel.pricePerNight || 350) * 5,
        hotel_id: hotel.id,
        observacoes: `Reserva efetuada via catálogo de hotéis para ${hotel.name}`
      });
    } catch (err) {
      console.warn('Erro ao salvar reserva no catálogo:', err);
    }

    const text = encodeURIComponent(initialMsg);
    window.open(`https://wa.me/${formattedPhone}?text=${text}`, '_blank');
  };

  const handleVerHotel = (hotel: PublicHotel) => {
    const slug = hotel.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
    window.history.pushState({}, '', `/hoteis/${slug}`);
    if (onNavigateToHotel) {
      onNavigateToHotel(hotel);
    } else {
      setSelectedHotelDetails(hotel);
    }
  };

  return (
    <div className="bg-[#f8f9ff] text-slate-800 font-sans min-h-screen pb-20 selection:bg-emerald-500 selection:text-white">
      
      {/* HEADER SUPERIOR PUBLICO */}
      <header className="fixed top-0 left-0 right-0 w-full z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-xs">
        <div className="h-16 w-full max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between">
          
          {/* Logo & Cidade */}
          <div className="flex items-center gap-3">
            {/* Marca */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#006c49] flex items-center justify-center text-white shadow-xs shrink-0">
                <span className="material-symbols-outlined text-[22px]">hotel</span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">Hotel no Zap</span>
                <span className="text-[10px] text-[#006c49] font-bold uppercase tracking-wider">Hospitalidade Digital</span>
              </div>
            </div>

            {/* Pill seletor de cidade */}
            <button
              onClick={() => setIsLocationModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#003400] hover:bg-[#004d00] text-white text-xs font-bold transition-all active:scale-95 cursor-pointer border border-[#006c49]/60 shadow-sm ml-1"
            >
              <span className="material-symbols-outlined text-[14px] text-emerald-400">location_on</span>
              <span>{selectedCity}, {ESTADOS_NOMES_MAP[selectedUf] || selectedUf}</span>
              <span className="material-symbols-outlined text-[14px] text-emerald-400">edit_location</span>
            </button>
          </div>

          {/* Nav Desktop / Responsiva */}
          <nav className="flex items-center gap-1 sm:gap-1.5 md:gap-2 font-semibold text-xs text-slate-700">
            {/* 1. Troque de Cidade */}
            <button 
              onClick={() => setIsLocationModalOpen(true)} 
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-all font-semibold text-slate-700 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base text-[#006c49]">near_me</span>
              <span className="hidden sm:inline">Troque de Cidade</span>
              <span className="sm:hidden">Cidade</span>
            </button>

            {/* 2. Lista de Hotéis */}
            <button 
              onClick={() => {
                const el = document.getElementById('lista-de-hoteis');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                } else {
                  window.scrollTo({ top: 380, behavior: 'smooth' });
                }
              }} 
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-all font-semibold text-slate-700 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base text-[#006c49]">apartment</span>
              <span className="hidden sm:inline">Lista de Hotéis</span>
              <span className="sm:hidden">Hotéis</span>
            </button>

            {/* 3. Quem Somos */}
            <button 
              onClick={() => setIsQuemSomosModalOpen(true)} 
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-all font-semibold text-slate-700 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base text-[#006c49]">info</span>
              <span className="hidden md:inline">Quem Somos</span>
              <span className="md:hidden">Sobre</span>
            </button>

            {/* 4. Fale Conosco */}
            <button 
              onClick={() => setIsFaleConoscoModalOpen(true)} 
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-all font-semibold text-slate-700 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base text-[#006c49]">support_agent</span>
              <span className="hidden md:inline">Fale Conosco</span>
              <span className="md:hidden">Contato</span>
            </button>

            {/* 5. Ícone do usuário logado e não logado */}
            {currentUser.isLoggedIn ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(prev => !prev)}
                  className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#006c49] border border-emerald-200 transition-all font-bold text-xs cursor-pointer shadow-2xs"
                  title={currentUser.name}
                >
                  <div className="w-6 h-6 rounded-full bg-[#006c49] text-white flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[15px]">person</span>
                  </div>
                  <span className="max-w-[70px] sm:max-w-[120px] truncate">{currentUser.name}</span>
                  <span className="material-symbols-outlined text-xs">expand_more</span>
                </button>

                {isUserMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-3 py-2 border-b border-slate-100 mb-1">
                        <p className="text-[11px] text-slate-400 font-medium">Usuário logado</p>
                        <p className="text-xs font-bold text-slate-800 truncate">{currentUser.name}</p>
                        {currentUser.email && (
                          <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                        )}
                        {currentUser.role && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#006c49]">
                            {currentUser.role}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          const roleLower = (currentUser.role || '').toLowerCase();
                          if (roleLower.includes('hospede') || roleLower.includes('hóspede')) {
                            window.location.href = '/minhaconta';
                          } else {
                            window.location.href = getAppLoginUrl();
                          }
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base text-[#006c49]">dashboard</span>
                        <span>Minha Conta / Painel</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          localStorage.removeItem('hotelnozap_user_role');
                          localStorage.removeItem('hotelnozap_user_email');
                          localStorage.removeItem('hotelnozap_user_name');
                          localStorage.removeItem('hotelnozap_user_cargo');
                          window.dispatchEvent(new Event('user_role_changed'));
                          setCurrentUser({ isLoggedIn: false, name: '', email: '', role: '' });
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">logout</span>
                        <span>Sair da conta</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  const savedRole = (localStorage.getItem('hotelnozap_user_role') || '').toLowerCase();
                  const savedEmail = localStorage.getItem('hotelnozap_user_email') || '';
                  if (savedEmail && (savedRole.includes('hotel') || savedRole.includes('gerente') || savedRole.includes('admin') || savedRole.includes('super'))) {
                    window.location.href = getAppLoginUrl();
                    return;
                  }
                  if (onNavigateToLogin) {
                    onNavigateToLogin();
                  } else {
                    window.location.href = getAppLoginUrl();
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-[#006c49] hover:bg-[#005438] text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-base">person</span>
                <span className="hidden sm:inline">Acessar minha conta</span>
                <span className="sm:hidden">Entrar</span>
              </button>
            )}
          </nav>

        </div>
      </header>

      {/* BANNER SELETOR DE CIDADE & HERO */}
      <section className="pt-20 pb-8 px-4 sm:px-8 max-w-7xl mx-auto">
        
        {/* CARD HERO DE DESTINO SELECIONADO */}
        <div className="bg-gradient-to-br from-[#003400] via-[#004d00] to-slate-900 text-white rounded-3xl p-6 sm:p-10 shadow-lg relative overflow-hidden">
          <div className="relative z-10 max-w-3xl space-y-4">

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Hotéis &amp; Pousadas em {selectedCity}, {selectedUf}
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 max-w-xl">
              Confira as melhores opções de hospedagem verificadas na região com reserva direta pelo WhatsApp, sem intermediários nem taxas adicionais.
            </p>
          </div>

          {/* ELEMENTOS DECORATIVOS DE FUNDO */}
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-10 translate-y-10">
            <span className="material-symbols-outlined text-[280px]">apartment</span>
          </div>
        </div>

        {/* BARRA DE BUSCA E FILTROS RAPIDOS */}
        <div className="bg-white rounded-2xl p-4 shadow-md border border-slate-200 mt-4 space-y-3">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Campo Busca */}
            <div className={`md:col-span-6 relative flex items-center bg-slate-50 rounded-xl px-3.5 py-2.5 border transition-all ${isSearchActive ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200'}`}>
              <span className="material-symbols-outlined text-slate-400 text-[20px] mr-2">search</span>
              <input 
                type="text" 
                placeholder="Buscar por nome do hotel, cidade, bairro..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    setIsSearchActive(true);
                  }
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    setIsSearchActive(false);
                  }
                }}
                className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setIsSearchActive(false); }}
                  className="text-xs font-bold text-slate-400 hover:text-slate-700 mr-1"
                >✕</button>
              )}
              {searchQuery.trim() && (
                <button
                  onClick={() => setIsSearchActive(true)}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-[#003400] hover:bg-[#004d00] text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">search</span>
                  Buscar
                </button>
              )}
            </div>

            {/* Select Bairro */}
            <div className="md:col-span-3 relative flex items-center bg-slate-50 rounded-xl px-3.5 py-2.5 border border-slate-200">
              <span className="material-symbols-outlined text-emerald-700 text-[20px] mr-2">pin_drop</span>
              <select 
                value={neighborhoodFilter}
                onChange={(e) => setNeighborhoodFilter(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none cursor-pointer appearance-none"
              >
                <option value="Todos">Todos os Bairros</option>
                {neighborhoodsList.map(neigh => (
                  <option key={neigh} value={neigh}>{neigh}</option>
                ))}
              </select>
              <span className="material-symbols-outlined text-slate-400 text-sm absolute right-3 pointer-events-none">expand_more</span>
            </div>

            {/* Select Ordenação */}
            <div className="md:col-span-3 relative flex items-center bg-slate-50 rounded-xl px-3.5 py-2.5 border border-slate-200">
              <span className="material-symbols-outlined text-slate-500 text-[20px] mr-2">sort</span>
              <select 
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none cursor-pointer appearance-none"
              >
                <option value="recomendados">Mais recomendados</option>
                <option value="preco_baixo">Menor preço por diária</option>
                <option value="avaliacao">Melhor avaliação (4.8+)</option>
              </select>
              <span className="material-symbols-outlined text-slate-400 text-sm absolute right-3 pointer-events-none">expand_more</span>
            </div>
          </div>

          {/* PILLS DE CATEGORIA */}
          <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1 scrollbar-none text-nowrap">
            {categoriesList.map(cat => (
              <button 
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeCategory === cat 
                    ? 'bg-[#003400] text-white shadow-xs' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

        </div>

      </section>

      {/* PÁGINA DE RESULTADOS DE BUSCA */}
      {isSearchActive && !!searchQuery.trim() && (
        <main className="px-4 sm:px-8 max-w-7xl mx-auto space-y-6">

          {/* Header de resultados */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-emerald-700 text-lg">search</span>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                  Resultados para "<span className="text-emerald-700">{searchQuery}</span>"
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                {sortedSearchResults.length === 0
                  ? 'Nenhum hotel encontrado para este termo'
                  : <><span className="font-bold text-slate-800">{sortedSearchResults.length}</span> {sortedSearchResults.length === 1 ? 'hotel encontrado' : 'hotéis encontrados'} em toda a rede Hotel no Zap</>
                }
              </p>
            </div>
            <button
              onClick={() => { setSearchQuery(''); setIsSearchActive(false); }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Voltar à Lista de Hotéis
            </button>
          </div>

          {/* Grade de resultados */}
          {sortedSearchResults.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl">search_off</span>
              </div>
              <h3 className="font-bold text-slate-900 text-base">Nenhum resultado para "{searchQuery}"</h3>
              <p className="text-xs text-slate-500 max-w-md">
                Tente buscar pelo nome do hotel, cidade, bairro ou tipo de acomodação.
              </p>
              <button
                onClick={() => { setSearchQuery(''); setIsSearchActive(false); }}
                className="px-5 py-2.5 rounded-xl bg-[#003400] text-white text-xs font-bold shadow-xs hover:bg-[#002500] cursor-pointer"
              >
                Ver Todos os Hotéis
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {sortedSearchResults.map(hotel => (
                <article
                  key={hotel.id}
                  onClick={() => handleVerHotel(hotel)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleVerHotel(hotel); } }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Ver acomodações e detalhes de ${hotel.name}`}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-emerald-600/50 hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                    <img 
                      src={hotel.imageUrl} 
                      alt={hotel.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                    <div className="absolute top-3 right-3 z-10">
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md shadow-xs text-xs font-bold text-slate-900">
                        <span className="material-symbols-outlined text-amber-500 text-sm">star</span>
                        <span>{hotel.rating.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 flex items-center gap-1 text-white z-10">
                      <span className="material-symbols-outlined text-emerald-400 text-sm">location_on</span>
                      <span className="text-xs font-semibold drop-shadow-xs">{hotel.city}, {hotel.uf}</span>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block mb-1">{hotel.category}</span>
                      <h3 className="font-extrabold text-slate-900 text-base leading-tight line-clamp-1">{hotel.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{hotel.neighborhood}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      {hotel.hasRooms && hotel.pricePerNight > 0 ? (
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 block">A partir de</span>
                          <span className="text-lg font-black text-slate-900">R$ {hotel.pricePerNight}</span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-emerald-600">chat</span>
                          Consulte via WhatsApp
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleVerHotel(hotel); }}
                        className="px-4 py-2 rounded-xl bg-[#003400] hover:bg-[#002500] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        Ver Hotel
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

        </main>
      )}

      {/* CONTAGEM E LISTAGEM DOS HOTÉIS DA CIDADE */}
      {(!isSearchActive || !searchQuery.trim()) && (
      <main id="lista-de-hoteis" className="px-4 sm:px-8 max-w-7xl mx-auto space-y-6 scroll-mt-24">
        
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
              Acomodações em {selectedCity}
            </h2>
            <p className="text-xs text-slate-500">
              Exibindo <span className="font-bold text-slate-800">{sortedHoteis.length}</span> opções encontradas para este destino
            </p>
          </div>

          <button 
            onClick={() => setIsLocationModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#006c49] hover:underline cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">tune</span>
            <span>Alterar Cidade/UF</span>
          </button>
        </div>

        {/* GRADE DE CARDS DOS HOTÉIS (3 COLUNAS DESKTOP) */}
        {sortedHoteis.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-3xl">
              <span className="material-symbols-outlined text-4xl">travel_explore</span>
            </div>
            <h3 className="font-bold text-slate-900 text-base">Nenhuma pousada ou hotel encontrado em {selectedCity}</h3>
            <p className="text-xs text-slate-500 max-w-md">
              Você pode alterar a cidade ou estado selecionado para explorar outros destinos parceiros da rede Hotel no Zap.
            </p>
            <button 
              onClick={() => setIsLocationModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#003400] text-white text-xs font-bold shadow-xs hover:bg-[#002500] cursor-pointer"
            >
              Escolher Outra Cidade
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {sortedHoteis.map(hotel => (
              <article 
                key={hotel.id} 
                onClick={() => handleVerHotel(hotel)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleVerHotel(hotel);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Ver acomodações e detalhes de ${hotel.name}`}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-emerald-600/50 hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                
                {/* FOTO E BADGES */}
                <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                  <img 
                    src={hotel.imageUrl} 
                    alt={hotel.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent"></div>
                  
                  {/* Tag Superior */}
                  {hotel.tag && (
                    <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10">
                      <span className="px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-semibold">
                        {hotel.tag}
                      </span>
                    </div>
                  )}

                  {/* Avaliação */}
                  <div className="absolute top-2.5 right-2.5 z-10">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/95 backdrop-blur-md shadow-xs text-xs font-bold text-slate-900">
                      <span className="material-symbols-outlined text-amber-500 text-sm">star</span>
                      <span>{hotel.rating.toFixed(2)}</span>
                      <span className="text-slate-400 font-normal text-[10px]">({hotel.reviewsCount})</span>
                    </div>
                  </div>

                  {/* Localização Footer da Foto */}
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white z-10">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-emerald-400 text-sm">location_on</span>
                      <span className="text-xs font-semibold text-white drop-shadow-xs truncate">{hotel.neighborhood}</span>
                    </div>
                  </div>
                </div>

                {/* CORPO DO CARD */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block mb-1 truncate">
                      {hotel.category} • {hotel.city}
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-base leading-tight line-clamp-1">
                      {hotel.name}
                    </h3>

                    {/* COMODIDADES GRID - Apenas para hotéis com quartos reais verificados (removido para hotéis do Google Maps) */}
                    {!hotel.isImportedFromGoogle && hotel.hasRooms && (hotel.capacity || 0) > 0 && (
                      <div className="grid grid-cols-2 gap-1.5 mt-2.5 bg-slate-50 p-2 rounded-xl border border-slate-100 text-[11px] text-slate-700">
                        <div className="flex items-center gap-1 truncate">
                          <span className="material-symbols-outlined text-emerald-700 text-[15px]">bedroom_parent</span>
                          <span className="truncate text-[10px] font-semibold">{hotel.capacity} {hotel.capacity === 1 ? 'Quarto' : 'Quartos'}</span>
                        </div>
                        <div className="flex items-center gap-1 truncate">
                          <span className="material-symbols-outlined text-emerald-700 text-[15px]">wifi</span>
                          <span className="truncate text-[10px] font-semibold">Wi-Fi Grátis</span>
                        </div>
                        <div className="flex items-center gap-1 truncate">
                          <span className="material-symbols-outlined text-emerald-700 text-[15px]">directions_car</span>
                          <span className="truncate text-[10px] font-semibold">Garagem: Sim</span>
                        </div>
                        <div className="flex items-center gap-1 truncate">
                          <span className="material-symbols-outlined text-emerald-700 text-[15px]">ac_unit</span>
                          <span className="truncate text-[10px] font-semibold">Ar Condicionado</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PREÇO E BOTÃO ÚNICO */}
                  <div className="pt-2 border-t border-slate-100 space-y-2.5">
                    {hotel.hasRooms && hotel.pricePerNight > 0 ? (
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] font-semibold text-slate-500 block">Diárias a partir de</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black text-slate-900">R$ {hotel.pricePerNight}</span>
                          </div>
                        </div>
                        <span className="text-[9px] text-slate-400 uppercase font-bold">Sem taxas extras</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] font-semibold text-slate-500 block">Tarifas e Reservas</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xs font-black text-emerald-800 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm text-emerald-600">chat</span>
                              Consulte via WhatsApp
                            </span>
                          </div>
                        </div>
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase font-bold border border-emerald-200/60">Contato Direto</span>
                      </div>
                    )}

                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVerHotel(hotel);
                      }}
                      className="w-full py-2.5 px-3.5 rounded-xl bg-[#003400] group-hover:bg-[#002500] hover:bg-[#002500] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">{hotel.hasRooms ? 'visibility' : 'contact_phone'}</span>
                      <span>{hotel.hasRooms ? 'Ver Quartos & Tarifas' : 'Ver Hotel & Contato'}</span>
                    </button>
                  </div>

                </div>

              </article>
            ))}
          </div>
        )}

        {/* BANNER DE SUPORTE CONCIERGE VIA WHATSAPP */}
        <div className="bg-gradient-to-r from-emerald-900 via-[#003400] to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-400/30">
              <span className="material-symbols-outlined text-3xl">support_agent</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg">Não encontrou as datas que desejava em {selectedCity}?</h3>
              <p className="text-xs sm:text-sm text-emerald-200 mt-1 max-w-xl">
                Nosso time de Concierge Zap consulta vagas de reserva técnica e cancelamentos diretamente com os proprietários dos hotéis parceiros em tempo real.
              </p>
            </div>
          </div>

          <button 
            onClick={() => window.open(`https://wa.me/5581998765432?text=Ola%2C%20gostaria%20de%20ajuda%20para%20encontrar%20vagas%20em%20${encodeURIComponent(selectedCity)}`, '_blank')}
            className="w-full md:w-auto shrink-0 px-6 py-3.5 rounded-xl bg-[#10B981] hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">chat</span>
            <span>Falar com Concierge Zap</span>
          </button>
        </div>

      </main>
      )}

      {/* MODAL DE SELEÇÃO DE CIDADE */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col my-auto">
            <div className="bg-[#003400] text-white p-6 relative">
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-400/30">
                  <span className="material-symbols-outlined text-2xl">location_on</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Selecione seu Destino</h3>
                  <p className="text-xs text-emerald-200 mt-0.5">Escolha onde você deseja se hospedar</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4 text-slate-800">
              <p className="text-xs text-slate-600 leading-relaxed">Selecione o Estado e digite para filtrar a Cidade desejada:</p>
              
              {/* 1. ESTADO */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">1. Estado (UF)</label>
                <select 
                  value={selectedUf} 
                  onChange={(e) => { 
                    const newUf = e.target.value; 
                    setSelectedUf(newUf); 
                    setCityFilterQuery('');
                    const cities = Array.from(availableUfsMap[newUf] || []).sort((a, b) => a.localeCompare(b, 'pt-BR')); 
                    if (cities.length > 0) setSelectedCity(cities[0]); 
                  }} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400] cursor-pointer"
                >
                  {availableEstados.map(est => (<option key={est.code} value={est.code}>{est.name}</option>))}
                </select>
              </div>

              {/* 2. CIDADE COM FILTRO POR DIGITAÇÃO */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">2. Cidade / Destino</label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {filteredCities.length} {filteredCities.length === 1 ? 'cidade' : 'cidades'}
                  </span>
                </div>

                {/* Campo de digitação para busca/filtro */}
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
                    search
                  </span>
                  <input
                    type="text"
                    value={cityFilterQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCityFilterQuery(val);
                      const matching = availableCities.filter(c => c.toLowerCase().includes(val.toLowerCase()));
                      if (matching.length > 0 && !matching.includes(selectedCity)) {
                        setSelectedCity(matching[0]);
                      }
                    }}
                    placeholder="Digite o nome da cidade para filtrar..."
                    className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400] transition-colors"
                  />
                  {cityFilterQuery && (
                    <button
                      type="button"
                      onClick={() => setCityFilterQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
                      title="Limpar pesquisa"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  )}
                </div>

                {/* Lista com as cidades filtradas */}
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white shadow-2xs">
                  {filteredCities.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      Nenhuma cidade encontrada com "<span className="font-semibold text-slate-700">{cityFilterQuery}</span>"
                    </div>
                  ) : (
                    filteredCities.map((cid) => {
                      const isSelected = selectedCity === cid;
                      return (
                        <button
                          key={cid}
                          type="button"
                          onClick={() => setSelectedCity(cid)}
                          className={`w-full text-left px-3.5 py-2.5 text-xs sm:text-sm flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50 text-[#003400] font-bold'
                              : 'text-slate-700 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className={`material-symbols-outlined text-base shrink-0 ${isSelected ? 'text-[#006c49]' : 'text-slate-400'}`}>
                              location_on
                            </span>
                            <span className="truncate">{cid}</span>
                          </div>
                          {isSelected && (
                            <span className="material-symbols-outlined text-base text-[#006c49] shrink-0">check</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="button" 
                  onClick={() => handleConfirmLocation(selectedUf, selectedCity)} 
                  className="w-full py-3.5 px-4 rounded-xl bg-[#003400] hover:bg-[#002500] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">search</span>
                  <span>Ver Hotéis em {selectedCity.split('(')[0].trim()}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHES DO HOTEL */}
      {selectedHotelDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col my-auto max-h-[90vh]">
            <div className="relative h-64 w-full bg-slate-900">
              <img src={selectedHotelDetails.imageUrl} alt={selectedHotelDetails.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent"></div>
              <button onClick={() => setSelectedHotelDetails(null)} className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-all cursor-pointer">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
              <div className="absolute bottom-4 left-6 right-6 text-white space-y-1">
                <span className="px-3 py-1 rounded-full bg-[#10B981] text-white text-xs font-bold">{selectedHotelDetails.category}</span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white">{selectedHotelDetails.name}</h3>
                <p className="text-xs text-emerald-200 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">location_on</span>
                  <span>{selectedHotelDetails.neighborhood}, {selectedHotelDetails.city} - {selectedHotelDetails.uf}</span>
                </p>
              </div>
            </div>
            <div className="p-6 overflow-y-auto space-y-5 text-slate-700 text-xs sm:text-sm">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">Sobre esta acomodação</h4>
                <p className="text-slate-600 leading-relaxed">{selectedHotelDetails.roomTitle}. Hospedagem verificada com suporte direto da recepção e atendimento ágil pelo WhatsApp.</p>
              </div>
              {!selectedHotelDetails.isImportedFromGoogle && selectedHotelDetails.hasRooms && selectedHotelDetails.amenities && selectedHotelDetails.amenities.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-sm">Comodidades inclusas</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedHotelDetails.amenities.map((am, i) => (
                      <div key={i} className="flex items-center gap-2 p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-100 text-emerald-950">
                        <span className="material-symbols-outlined text-emerald-700 text-lg">{am.icon}</span>
                        <span className="font-semibold text-xs">{am.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-2xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block">Diária a partir de</span>
                  <span className="text-2xl font-black text-slate-900">R$ {selectedHotelDetails.pricePerNight}</span>
                  <span className="text-[11px] font-bold text-emerald-700 block">{selectedHotelDetails.cancellationText}</span>
                </div>
                <button onClick={() => openWhatsAppReservation(selectedHotelDetails)} className="py-3 px-5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-95">
                  <span className="material-symbols-outlined text-lg">chat</span>
                  <span>Chamar no WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL QUEM SOMOS */}
      {isQuemSomosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="bg-gradient-to-br from-[#003400] via-[#004d00] to-slate-900 text-white p-6 relative">
              <button
                onClick={() => setIsQuemSomosModalOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold mb-3 border border-emerald-500/30">
                <span className="material-symbols-outlined text-sm">hotel</span>
                <span>Sobre o Hotel no Zap</span>
              </div>
              <h3 className="text-2xl font-black tracking-tight">Quem Somos</h3>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 max-w-lg">
                A ponte direta entre você e a melhor experiência de hospedagem no Brasil.
              </p>
            </div>

            {/* Conteúdo Modal */}
            <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-xs sm:text-sm">
              <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-2">
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006c49] text-lg">travel_explore</span>
                  Nossa Missão
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  O <strong>Hotel no Zap</strong> nasceu com o propósito de desintermediar o setor hoteleiro brasileiro, conectando viajantes e hóspedes diretamente às recepções de hotéis, pousadas e resorts através do WhatsApp — sem taxas de comissão adicionais e com negociação transparente.
                </p>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-900 text-sm mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006c49] text-lg">verified</span>
                  Por que escolher o Hotel no Zap?
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl border border-slate-100 bg-white shadow-2xs flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#006c49] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-lg">chat</span>
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 text-xs">Reserva Direta no WhatsApp</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">Atendimento em tempo real com a recepção, negociando condições exclusivas.</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-slate-100 bg-white shadow-2xs flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#006c49] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-lg">price_check</span>
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 text-xs">Sem Taxas Ocultas</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">Economia real para o hóspede e margem justa para o hoteleiro parceiro.</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-slate-100 bg-white shadow-2xs flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#006c49] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-lg">hotel</span>
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 text-xs">Hospedagens Verificadas</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">Fotos reais de quartos, comodidades detalhadas e avaliações confiáveis.</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-slate-100 bg-white shadow-2xs flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#006c49] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-lg">bolt</span>
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 text-xs">Agilidade Total</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">Encontre opções por cidade, filtre categorias e reserve em menos de 2 minutos.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsQuemSomosModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-[#006c49] hover:bg-[#005438] text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FALE CONOSCO */}
      {isFaleConoscoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="bg-gradient-to-br from-[#003400] via-[#004d00] to-slate-900 text-white p-6 relative">
              <button
                onClick={() => setIsFaleConoscoModalOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold mb-3 border border-emerald-500/30">
                <span className="material-symbols-outlined text-sm">support_agent</span>
                <span>Atendimento & Suporte</span>
              </div>
              <h3 className="text-2xl font-black tracking-tight">Fale Conosco</h3>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-1">
                Tire dúvidas, envie sugestões ou solicite suporte com nossa equipe.
              </p>
            </div>

            {/* Conteúdo Modal */}
            <div className="p-6 overflow-y-auto space-y-4 text-slate-700 text-xs sm:text-sm">
              {/* Opção WhatsApp */}
              <a
                href="https://wa.me/5581998765432?text=Ol%C3%A1%2C%20gostaria%20de%20ajuda%20com%20o%20Hotel%20no%20Zap"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/50 transition-all flex items-center justify-between group cursor-pointer block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-xl">chat</span>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs sm:text-sm">WhatsApp Oficial</h5>
                    <p className="text-[11px] text-slate-500">Atendimento rápido e suporte a reservas</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-emerald-700 group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </a>

              {/* Opção E-mail */}
              <a
                href="mailto:contato@hotelnozap.com.br"
                className="p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-all flex items-center justify-between group cursor-pointer block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">mail</span>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs sm:text-sm">E-mail Corporativo</h5>
                    <p className="text-[11px] text-slate-500">contato@hotelnozap.com.br</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-slate-400 group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </a>

              {/* Horários */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 space-y-1">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#006c49]">schedule</span>
                  Horário de Funcionamento:
                </p>
                <p>• Segunda a Sexta: 08:00 às 20:00</p>
                <p>• Sábados e Domingos: 09:00 às 17:00</p>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setIsFaleConoscoModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="w-full bg-slate-900 text-slate-400 py-10 border-t border-slate-800 mt-16">
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
            <button onClick={() => setIsLocationModalOpen(true)} className="hover:text-white transition-colors">Trocar Destino</button>
            <button onClick={() => window.open('https://wa.me/5581998765432', '_blank')} className="hover:text-white transition-colors">Suporte WhatsApp</button>
            <button onClick={() => { if (onNavigateToLogin) onNavigateToLogin(); else window.location.href = getAppLoginUrl(); }} className="hover:text-white transition-colors">Área do Hoteleiro</button>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default CatalogoHoteis;
