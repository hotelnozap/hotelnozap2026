import React, { useState, useEffect, useMemo, useRef } from 'react';
import { hoteisService, reservasService, quartosService, ComodidadeCategoria } from '../services/supabaseService';
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

export interface CityGroup {
  city: string;
  uf: string;
  slug: string;
  hotels: PublicHotel[];
}

// Cidades populares pré-cadastradas por estado
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
  'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia', 'CE': 'Ceará',
  'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás', 'MA': 'Maranhão', 'MT': 'Mato Grosso',
  'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais', 'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná',
  'PE': 'Pernambuco', 'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte',
  'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina',
  'SP': 'São Paulo', 'SE': 'Sergipe', 'TO': 'Tocantins'
};

export const FALLBACK_PUBLIC_HOTEIS: PublicHotel[] = [];

// =========================================================================
// SUB-COMPONENTE: CARROSSEL HORIZONTAL POR CIDADE (ESTILO AIRBNB)
// Suporta arrastar com o mouse (drag & scroll) + touch swipe suave no mobile
// =========================================================================
interface CityCarouselProps {
  group: CityGroup;
  onHotelClick: (hotel: PublicHotel) => void;
  favorites: Set<string>;
  toggleFavorite: (hotelId: string, e: React.MouseEvent) => void;
}

const CityCarousel: React.FC<CityCarouselProps> = ({
  group,
  onHotelClick,
  favorites,
  toggleFavorite
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const hasMovedRef = useRef(false);

  // Navegação pelos botões < e >
  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 320 * 2;
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  // Suporte a Mouse Drag (clicar, segurar e arrastar)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    hasMovedRef.current = false;
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.3;
    if (Math.abs(walk) > 6) {
      hasMovedRef.current = true;
    }
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <section id={`cidade-${group.slug}`} className="space-y-3.5 scroll-mt-28 py-2">
      {/* CABEÇALHO DA SEÇÃO DE CIDADE */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5 hover:text-emerald-700 transition-colors">
            <span>Hotéis e Pousadas em {group.city} · {group.uf}</span>
            <span className="material-symbols-outlined text-base text-slate-400 group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
          </h2>
          <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
            ({group.hotels.length} {group.hotels.length === 1 ? 'acomodação' : 'acomodações'})
          </span>
        </div>

        {/* SETAS DE NAVEGAÇÃO DESKTOP (< e >) */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => handleScroll('left')}
            className="w-8 h-8 rounded-full border border-slate-300 bg-white hover:bg-slate-50 active:scale-95 flex items-center justify-center text-slate-700 transition-all cursor-pointer shadow-xs"
            aria-label="Rolar para a esquerda"
          >
            <span className="material-symbols-outlined text-base">chevron_left</span>
          </button>
          <button
            onClick={() => handleScroll('right')}
            className="w-8 h-8 rounded-full border border-slate-300 bg-white hover:bg-slate-50 active:scale-95 flex items-center justify-center text-slate-700 transition-all cursor-pointer shadow-xs"
            aria-label="Rolar para a direita"
          >
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
        </div>
      </div>

      {/* TRACK DO CARROSSEL HORIZONTAL (TOUCH PAN & MOUSE DRAG) */}
      <div
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-3 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar ${
          isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
        }`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {group.hotels.map((hotel) => {
          const isFav = favorites.has(hotel.id);
          return (
            <article
              key={hotel.id}
              onClick={() => {
                if (hasMovedRef.current) return;
                onHotelClick(hotel);
              }}
              className="snap-start shrink-0 w-[260px] sm:w-[290px] md:w-[310px] flex flex-col group cursor-pointer"
            >
              {/* FOTO 4:3 COM BORDAS ARREDONDADAS (ESTILO AIRBNB) */}
              <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-slate-100 shadow-xs group-hover:shadow-md transition-all duration-300">
                <img
                  src={hotel.imageUrl}
                  alt={hotel.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent pointer-events-none" />

                {/* BADGE "Preferido dos hóspedes" */}
                <div className="absolute top-3 left-3 z-10">
                  <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md text-slate-900 font-bold text-[10px] sm:text-[11px] shadow-xs">
                    Preferido dos hóspedes
                  </span>
                </div>

                {/* BOTÃO FAVORITO (CORAÇÃO) */}
                <button
                  onClick={(e) => toggleFavorite(hotel.id, e)}
                  className="absolute top-3 right-3 z-10 p-1.5 rounded-full text-white hover:scale-110 active:scale-95 transition-transform cursor-pointer drop-shadow-md"
                  aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                >
                  <span
                    className={`material-symbols-outlined text-2xl transition-colors ${
                      isFav ? 'text-red-500 fill-current' : 'text-white/90 stroke-black'
                    }`}
                    style={isFav ? { fontVariationSettings: "'FILL' 1" } : {}}
                  >
                    favorite
                  </span>
                </button>
              </div>

              {/* DETALHES DO HOTEL ABAIXO DA FOTO */}
              <div className="mt-2.5 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 truncate leading-snug">
                    {hotel.name}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0 text-xs font-bold text-slate-900">
                    <span className="material-symbols-outlined text-amber-500 text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span>{hotel.rating.toFixed(2)}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 font-medium truncate">
                  {hotel.neighborhood ? `${hotel.neighborhood}, ${hotel.city}` : hotel.city}
                </p>

                <p className="text-xs text-slate-600 font-medium">
                  {hotel.category || 'Hotel & Pousada'}
                </p>

                <div className="pt-1 flex items-baseline gap-1">
                  {hotel.hasRooms && hotel.pricePerNight > 0 ? (
                    <>
                      <span className="text-sm sm:text-base font-extrabold text-slate-900">
                        R$ {hotel.pricePerNight}
                      </span>
                      <span className="text-xs text-slate-500 font-normal">noite</span>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-emerald-600">chat</span>
                      Consulte no WhatsApp
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

// =========================================================================
// COMPONENTE PRINCIPAL: CATALOGO DE HOTEIS
// =========================================================================
export interface CatalogoHoteisProps {
  onNavigateToLogin?: () => void;
  onNavigateToHotel?: (hotel: PublicHotel) => void;
}

export const CatalogoHoteis: React.FC<CatalogoHoteisProps> = ({ onNavigateToLogin, onNavigateToHotel }) => {
  // Lista geral de hotéis do Supabase
  const [hoteisList, setHoteisList] = useState<PublicHotel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Estados de busca e popover estilo Airbnb
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Tudo');
  const [focusedCity, setFocusedCity] = useState<string | null>(null);

  // Infinite Scroll / Lazy Loading de Cidades
  const [visibleCitiesCount, setVisibleCitiesCount] = useState<number>(3);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Favoritos
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('hotelnozap_favorites');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleFavorite = (hotelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(hotelId)) {
        next.delete(hotelId);
      } else {
        next.add(hotelId);
      }
      localStorage.setItem('hotelnozap_favorites', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  // Modais de "Quem Somos", "Fale Conosco" e Detalhes
  const [isQuemSomosModalOpen, setIsQuemSomosModalOpen] = useState<boolean>(false);
  const [isFaleConoscoModalOpen, setIsFaleConoscoModalOpen] = useState<boolean>(false);
  const [selectedHotelDetails, setSelectedHotelDetails] = useState<PublicHotel | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);

  // Usuário logado
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
      return { isLoggedIn: Boolean(email) && isHospede, name, email, role };
    } catch {
      return { isLoggedIn: false, name: '', email: '', role: '' };
    }
  });

  useEffect(() => {
    loadHoteisFromSupabase();
  }, []);

  const loadHoteisFromSupabase = async () => {
    setLoading(true);
    try {
      const [dbHoteis, dbQuartos] = await Promise.all([
        hoteisService.getHoteis(),
        quartosService.getAllQuartos()
      ]);

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
        if (!cName) cName = 'Água Boa';
        if (!ufName) ufName = 'MT';
        const realRoomsCount = roomsCountByHotel[h.id] || 0;
        const hasRealRooms = realRoomsCount > 0;
        const hotelMinPrice = hasRealRooms ? (minPriceByHotel[h.id] || 0) : 0;

        let finalImageUrl = h.imageUrl;
        if (!h.imageUrl || isUnsplash(h.imageUrl)) {
          if (realPhotoByHotel[h.id]) {
            finalImageUrl = realPhotoByHotel[h.id];
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
          rating: 4.92,
          reviewsCount: Math.floor(Math.random() * 45) + 12,
          pricePerNight: hotelMinPrice,
          whatsappPhone: h.whatsapp || h.telefone_gerente || '5581998765432',
          cancellationText: 'Cancelamento gratuito',
          capacity: realRoomsCount,
          amenities: [
            { icon: 'wifi', label: 'Wi-Fi Grátis' },
            { icon: 'ac_unit', label: 'Ar Condicionado' },
            { icon: 'free_breakfast', label: 'Café da Manhã' },
            { icon: 'local_parking', label: 'Estacionamento' }
          ],
          hasRooms: hasRealRooms,
          notes: h.observacoes,
          isImportedFromGoogle: h.is_imported_from_google || false
        };
      });

      setHoteisList(mappedDbHoteis);
    } catch (err) {
      console.error('Erro ao carregar hotéis no catálogo:', err);
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // AGRUPAMENTO DOS HOTÉIS POR CIDADE (ESTILO AIRBNB)
  // =========================================================================
  const cityGroups = useMemo<CityGroup[]>(() => {
    const map: Record<string, { city: string; uf: string; hotels: PublicHotel[] }> = {};

    hoteisList.forEach(h => {
      const c = (h.city || '').trim();
      const u = (h.uf || '').trim();
      if (!c) return;

      // Filtro de categoria
      if (activeCategory !== 'Tudo') {
        const catLower = activeCategory.toLowerCase();
        const hotelCat = (h.category || '').toLowerCase();
        if (catLower.includes('pousada') && !hotelCat.includes('pousada')) return;
        if (catLower.includes('resort') && !hotelCat.includes('resort')) return;
        if (catLower.includes('hotel') && !hotelCat.includes('hotel')) return;
      }

      // Filtro textual se houver busca digitada
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesHotel =
          h.name.toLowerCase().includes(q) ||
          h.city.toLowerCase().includes(q) ||
          h.uf.toLowerCase().includes(q) ||
          h.neighborhood.toLowerCase().includes(q);
        if (!matchesHotel) return;
      }

      const key = `${c.toLowerCase()}__${u.toLowerCase()}`;
      if (!map[key]) {
        map[key] = { city: c, uf: u, hotels: [] };
      }
      map[key].hotels.push(h);
    });

    // Ordenação com destaque para cidades polo / mais populosas de hotéis
    return Object.values(map)
      .sort((a, b) => {
        // Água Boa em primeiro destaque
        const aIsAguaBoa = a.city.toLowerCase().includes('água boa') || a.city.toLowerCase().includes('agua boa');
        const bIsAguaBoa = b.city.toLowerCase().includes('água boa') || b.city.toLowerCase().includes('agua boa');
        if (aIsAguaBoa && !bIsAguaBoa) return -1;
        if (!aIsAguaBoa && bIsAguaBoa) return 1;
        return b.hotels.length - a.hotels.length;
      })
      .map(g => ({
        city: g.city,
        uf: g.uf,
        slug: g.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-'),
        hotels: g.hotels
      }));
  }, [hoteisList, activeCategory, searchQuery]);

  // Lista de cidades disponíveis para o popover de busca
  const allDestinations = useMemo(() => {
    const set = new Map<string, { city: string; uf: string; slug: string; count: number }>();
    hoteisList.forEach(h => {
      const c = (h.city || '').trim();
      const u = (h.uf || '').trim();
      if (!c) return;
      const key = `${c.toLowerCase()}__${u.toLowerCase()}`;
      if (!set.has(key)) {
        set.set(key, {
          city: c,
          uf: u,
          slug: c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-'),
          count: 1
        });
      } else {
        const item = set.get(key)!;
        item.count++;
      }
    });
    return Array.from(set.values()).sort((a, b) => b.count - a.count);
  }, [hoteisList]);

  // =========================================================================
  // INFINITE SCROLL / LAZY LOADING DE CIDADES
  // =========================================================================
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCitiesCount(prev => Math.min(prev + 2, cityGroups.length));
      }
    }, { rootMargin: '350px' });

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [cityGroups.length]);

  // Rola suavemente até uma cidade selecionada
  const handleSelectDestination = (slug: string, cityName: string) => {
    setFocusedCity(cityName);
    setIsSearchPopoverOpen(false);

    // Garante que a cidade esteja no range visível
    const cityIdx = cityGroups.findIndex(g => g.slug === slug);
    if (cityIdx >= visibleCitiesCount) {
      setVisibleCitiesCount(cityIdx + 2);
    }

    setTimeout(() => {
      const el = document.getElementById(`cidade-${slug}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
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

  const openWhatsAppReservation = async (hotel: PublicHotel) => {
    const rawPhone = hotel.whatsappPhone ? hotel.whatsappPhone.replace(/\D/g, '') : '5581998765432';
    const formattedPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
    const initialMsg = `Olá! Encontrei o hotel *${hotel.name}* no portal *Hotel no Zap* (${hotel.city}) e gostaria de verificar disponibilidade e consultar valores de reserva!`;

    webhookN8nService.dispararWebhookAtendimento({
      hotel,
      mensagem: initialMsg,
      origem: 'catalogo_hoteis',
      cliente: { nome: 'Visitante (Catálogo de Hotéis)' }
    }).catch(err => console.warn('[Webhook n8n] Erro:', err));

    try {
      const checkInDate = new Date();
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + 5);

      await reservasService.createReserva({
        nome_hospede: 'Hóspede Zap (Catálogo)',
        numero_quarto: '101',
        data_checkin: checkInDate.toISOString().split('T')[0],
        data_checkout: checkOutDate.toISOString().split('T')[0],
        valor_total: (hotel.pricePerNight || 250) * 5,
        hotel_id: hotel.id,
        observacoes: `Reserva efetuada via catálogo de hotéis para ${hotel.name}`
      });
    } catch (err) {
      console.warn('Erro ao salvar reserva no catálogo:', err);
    }

    const text = encodeURIComponent(initialMsg);
    window.open(`https://wa.me/${formattedPhone}?text=${text}`, '_blank');
  };

  // Cidades a serem renderizadas agora
  const visibleGroups = cityGroups.slice(0, visibleCitiesCount);

  // Categorias horizontais estilo Airbnb
  const CATEGORIAS_HEADER = [
    { id: 'Tudo', label: 'Tudo', icon: 'travel_explore' },
    { id: 'Hotéis', label: 'Hotéis', icon: 'hotel' },
    { id: 'Pousadas', label: 'Pousadas', icon: 'cottage' },
    { id: 'Resorts', label: 'Resorts', icon: 'beach_access' },
    { id: 'Piscina', label: 'Com Piscina', icon: 'pool' },
    { id: 'Cafe', label: 'Café Incluso', icon: 'free_breakfast' },
  ];

  return (
    <div className="bg-white text-slate-800 font-sans min-h-screen pb-24 selection:bg-emerald-500 selection:text-white">

      {/* ========================================================================= */}
      {/* HEADER SUPERIOR COM BARRA EM CÁPSULA (ESTILO AIRBNB)                      */}
      {/* ========================================================================= */}
      <header className="fixed top-0 left-0 right-0 w-full z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-xs">
        <div className="h-20 w-full max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between gap-4">

          {/* 1. LOGO HOTEL NO ZAP */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-[#006c49] flex items-center justify-center text-white shadow-xs">
              <span className="material-symbols-outlined text-[24px]">hotel</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-lg text-slate-900 tracking-tight">Hotel no Zap</span>
              <span className="text-[10px] text-[#006c49] font-bold uppercase tracking-wider">Hospitalidade Digital</span>
            </div>
          </div>

          {/* 2. SEARCH PILL CENTRAL (DESKTOP) */}
          <div className="hidden md:flex items-center rounded-full border border-slate-300 shadow-sm hover:shadow-md transition-all divide-x divide-slate-200 bg-white py-1.5 px-2 relative">
            <button
              onClick={() => setIsSearchPopoverOpen(prev => !prev)}
              className="px-4 py-1.5 text-left hover:bg-slate-50 rounded-full transition-colors cursor-pointer"
            >
              <span className="block text-[11px] font-extrabold text-slate-900 leading-tight">Onde</span>
              <span className="block text-xs text-slate-500 truncate max-w-[130px]">
                {focusedCity || 'Buscar destinos'}
              </span>
            </button>

            <button
              onClick={() => setIsSearchPopoverOpen(prev => !prev)}
              className="px-4 py-1.5 text-left hover:bg-slate-50 rounded-full transition-colors cursor-pointer"
            >
              <span className="block text-[11px] font-extrabold text-slate-900 leading-tight">Quando</span>
              <span className="block text-xs text-slate-500">Insira as datas</span>
            </button>

            <button
              onClick={() => setIsSearchPopoverOpen(prev => !prev)}
              className="px-4 py-1.5 text-left hover:bg-slate-50 rounded-full transition-colors cursor-pointer"
            >
              <span className="block text-[11px] font-extrabold text-slate-900 leading-tight">Quem</span>
              <span className="block text-xs text-slate-500">Hóspedes?</span>
            </button>

            <div className="pl-2">
              <button
                onClick={() => setIsSearchPopoverOpen(prev => !prev)}
                className="w-9 h-9 rounded-full bg-[#006c49] hover:bg-[#005438] text-white flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95"
                aria-label="Buscar"
              >
                <span className="material-symbols-outlined text-[19px]">search</span>
              </button>
            </div>
          </div>

          {/* SEARCH PILL COMPACTO (MOBILE) */}
          <div className="flex md:hidden flex-1 max-w-sm">
            <button
              onClick={() => setIsSearchPopoverOpen(true)}
              className="w-full flex items-center gap-3 px-3.5 py-2 rounded-full border border-slate-300 bg-white shadow-xs text-left"
            >
              <span className="material-symbols-outlined text-xl text-emerald-800">search</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold text-slate-900 leading-tight truncate">
                  {focusedCity ? `Destino: ${focusedCity}` : 'Inicie sua busca'}
                </p>
                <p className="text-[10px] text-slate-500 truncate">Qualquer destino • Qualquer semana</p>
              </div>
            </button>
          </div>

          {/* 3. MENU DIREITO (QUEM SOMOS, LOGIN / CONTA) */}
          <nav className="flex items-center gap-1 sm:gap-2 font-semibold text-xs text-slate-700 shrink-0">
            <button
              onClick={() => setIsQuemSomosModalOpen(true)}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-slate-100 text-slate-700 transition-all font-semibold cursor-pointer"
            >
              Quem Somos
            </button>

            <button
              onClick={() => setIsFaleConoscoModalOpen(true)}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-slate-100 text-slate-700 transition-all font-semibold cursor-pointer"
            >
              Fale Conosco
            </button>

            {currentUser.isLoggedIn ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(prev => !prev)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-300 hover:shadow-md transition-all font-bold text-xs cursor-pointer bg-white"
                >
                  <span className="material-symbols-outlined text-lg text-slate-700">menu</span>
                  <div className="w-7 h-7 rounded-full bg-[#006c49] text-white flex items-center justify-center font-bold text-xs">
                    {currentUser.name.substring(0, 1).toUpperCase()}
                  </div>
                </button>

                {isUserMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-2 border-b border-slate-100 mb-1">
                        <p className="text-[11px] text-slate-400 font-medium">Logado como</p>
                        <p className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</p>
                      </div>
                      <button
                        onClick={() => { window.location.href = '/minhaconta'; }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base text-[#006c49]">dashboard</span>
                        <span>Área do Hóspede</span>
                      </button>
                      <button
                        onClick={() => {
                          localStorage.removeItem('hotelnozap_user_role');
                          localStorage.removeItem('hotelnozap_user_email');
                          localStorage.removeItem('hotelnozap_user_name');
                          window.location.reload();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
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
                  if (onNavigateToLogin) onNavigateToLogin();
                  else window.location.href = getAppLoginUrl();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-bold transition-all shadow-xs cursor-pointer bg-white"
              >
                <span className="material-symbols-outlined text-base">account_circle</span>
                <span>Entrar</span>
              </button>
            )}
          </nav>
        </div>

        {/* POPOVER FLUTUANTE DE DESTINOS (SEM MODAL, ESTILO AIRBNB) */}
        {isSearchPopoverOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-2xs" onClick={() => setIsSearchPopoverOpen(false)} />
            <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 p-5 z-50 animate-in fade-in zoom-in-95 duration-150 mx-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-700 text-base">travel_explore</span>
                  Destinos Parceiros Hotel no Zap
                </span>
                <button
                  onClick={() => setIsSearchPopoverOpen(false)}
                  className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              {/* Input de filtro imediato */}
              <div className="mt-3 relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Digite o nome da cidade ou hotel..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Lista com scroll de destinos */}
              <div className="mt-3 max-h-64 overflow-y-auto space-y-1 divide-y divide-slate-100">
                {allDestinations
                  .filter(d => !searchQuery.trim() || d.city.toLowerCase().includes(searchQuery.toLowerCase()) || d.uf.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(dest => (
                    <button
                      key={dest.slug}
                      onClick={() => handleSelectDestination(dest.slug, dest.city)}
                      className="w-full p-2.5 rounded-xl hover:bg-emerald-50/70 text-left flex items-center justify-between transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-emerald-100 text-slate-600 group-hover:text-emerald-800 flex items-center justify-center transition-colors">
                          <span className="material-symbols-outlined text-lg">apartment</span>
                        </div>
                        <div>
                          <p className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-950">{dest.city} · {dest.uf}</p>
                          <p className="text-[11px] text-slate-500">{dest.count} {dest.count === 1 ? 'hotel verificado' : 'hotéis verificados'}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">Explorar ➔</span>
                    </button>
                  ))}
              </div>
            </div>
          </>
        )}
      </header>

      {/* ========================================================================= */}
      {/* BARRA DE CATEGORIAS HORIZONTAL (CHIPS ESTILO AIRBNB)                      */}
      {/* ========================================================================= */}
      <div className="pt-20 border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-20 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center gap-6 overflow-x-auto py-3 no-scrollbar">
          {CATEGORIAS_HEADER.map(cat => {
            const isActive = activeCategory === cat.label || (cat.id === 'Tudo' && activeCategory === 'Tudo');
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.label)}
                className={`flex flex-col items-center gap-1.5 pb-2 transition-all shrink-0 cursor-pointer border-b-2 text-xs font-bold ${
                  isActive
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-2xl">{cat.icon}</span>
                <span className="tracking-tight">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CORPO PRINCIPAL: SEÇÕES DE CARROSSEL HORIZONTAL POR CIDADE                */}
      {/* ========================================================================= */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-10">

        {loading ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Carregando acomodações da rede...</p>
          </div>
        ) : cityGroups.length === 0 ? (
          <div className="py-20 text-center bg-slate-50 rounded-3xl border border-slate-200 p-8 space-y-3">
            <span className="material-symbols-outlined text-4xl text-slate-400">search_off</span>
            <h3 className="text-base font-bold text-slate-900">Nenhum hotel encontrado para "{searchQuery}"</h3>
            <p className="text-xs text-slate-500">Tente buscar por outra cidade ou categoria.</p>
            <button
              onClick={() => { setSearchQuery(''); setActiveCategory('Tudo'); setFocusedCity(null); }}
              className="px-4 py-2 bg-[#006c49] text-white text-xs font-bold rounded-xl shadow-xs"
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
          <>
            {/* CARROSSÉIS RENDERIZADOS (LAZY LOADED / INFINITE SCROLL) */}
            {visibleGroups.map((group) => (
              <CityCarousel
                key={group.slug}
                group={group}
                onHotelClick={handleVerHotel}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
              />
            ))}

            {/* SENTINELA DE INFINITE SCROLL (CARREGA CONFORME ROLA A TELA) */}
            <div ref={sentinelRef} className="py-6 text-center">
              {visibleCitiesCount < cityGroups.length ? (
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400">
                  <div className="w-4 h-4 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                  <span>Carregando mais destinos parceiros...</span>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-medium">Você explorou todos os destinos parceiros disponíveis na rede.</p>
              )}
            </div>
          </>
        )}
      </main>

      {/* ========================================================================= */}
      {/* BARRA INFERIOR MOBILE FIXA (ESTILO AIRBNB)                                 */}
      {/* ========================================================================= */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 px-6 py-2 flex items-center justify-around shadow-lg">
        <button
          onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="flex flex-col items-center gap-0.5 text-emerald-800 font-extrabold text-[10px]"
        >
          <span className="material-symbols-outlined text-2xl">search</span>
          <span>Explorar</span>
        </button>

        <button
          onClick={() => setIsSearchPopoverOpen(true)}
          className="flex flex-col items-center gap-0.5 text-slate-500 font-bold text-[10px]"
        >
          <span className="material-symbols-outlined text-2xl">location_on</span>
          <span>Destinos</span>
        </button>

        <button
          onClick={() => {
            if (currentUser.isLoggedIn) {
              window.location.href = '/minhaconta';
            } else if (onNavigateToLogin) {
              onNavigateToLogin();
            } else {
              window.location.href = getAppLoginUrl();
            }
          }}
          className="flex flex-col items-center gap-0.5 text-slate-500 font-bold text-[10px]"
        >
          <span className="material-symbols-outlined text-2xl">account_circle</span>
          <span>{currentUser.isLoggedIn ? 'Perfil' : 'Entrar'}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MODAL DETALHES DO HOTEL                                                   */}
      {/* ========================================================================= */}
      {selectedHotelDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col my-auto max-h-[90vh]">
            <div className="relative h-64 w-full bg-slate-900">
              <img src={selectedHotelDetails.imageUrl} alt={selectedHotelDetails.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
              <button
                onClick={() => setSelectedHotelDetails(null)}
                className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-all cursor-pointer"
              >
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
                <p className="text-slate-600 leading-relaxed">
                  {selectedHotelDetails.roomTitle || 'Hospedagem verificada'}. Reserva direta e transparente com atendimento ágil da recepção pelo WhatsApp.
                </p>
              </div>

              {selectedHotelDetails.amenities && selectedHotelDetails.amenities.length > 0 && (
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
                  <span className="text-2xl font-black text-slate-900">
                    {selectedHotelDetails.pricePerNight > 0 ? `R$ ${selectedHotelDetails.pricePerNight}` : 'Sob Consulta'}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 block">{selectedHotelDetails.cancellationText}</span>
                </div>
                <button
                  onClick={() => openWhatsAppReservation(selectedHotelDetails)}
                  className="py-3 px-5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-lg">chat</span>
                  <span>Chamar no WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL QUEM SOMOS                                                          */}
      {/* ========================================================================= */}
      {isQuemSomosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-br from-[#003400] via-[#004d00] to-slate-900 text-white p-6 relative">
              <button
                onClick={() => setIsQuemSomosModalOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
              <h3 className="text-2xl font-black tracking-tight">Quem Somos</h3>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-1">
                A ponte direta entre você e a melhor experiência de hospedagem no Brasil.
              </p>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-slate-700 text-xs sm:text-sm">
              <p className="leading-relaxed">
                O <strong>Hotel no Zap</strong> conecta viajantes e hóspedes diretamente às recepções de hotéis e pousadas através do WhatsApp — sem intermediários, sem comissões abusivas e com atendimento ágil em tempo real.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setIsQuemSomosModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-[#006c49] text-white font-bold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL FALE CONOSCO                                                        */}
      {/* ========================================================================= */}
      {isFaleConoscoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-br from-[#003400] via-[#004d00] to-slate-900 text-white p-6 relative">
              <button
                onClick={() => setIsFaleConoscoModalOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
              <h3 className="text-2xl font-black tracking-tight">Fale Conosco</h3>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-1">
                Tire dúvidas ou solicite suporte com nossa equipe.
              </p>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-slate-700 text-xs sm:text-sm">
              <a
                href="https://wa.me/5581998765432?text=Ol%C3%A1%2C%20gostaria%20de%20ajuda%20com%20o%20Hotel%20no%20Zap"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/50 transition-all flex items-center justify-between group cursor-pointer block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">chat</span>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs sm:text-sm">WhatsApp Oficial</h5>
                    <p className="text-[11px] text-slate-500">Atendimento e suporte a reservas</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-emerald-700 group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </a>

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
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setIsFaleConoscoModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FOOTER                                                                    */}
      {/* ========================================================================= */}
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
            <button onClick={() => setIsSearchPopoverOpen(true)} className="hover:text-white transition-colors cursor-pointer">Destinos</button>
            <button onClick={() => window.open('https://wa.me/5581998765432', '_blank')} className="hover:text-white transition-colors cursor-pointer">Suporte WhatsApp</button>
            <button onClick={() => { if (onNavigateToLogin) onNavigateToLogin(); else window.location.href = getAppLoginUrl(); }} className="hover:text-white transition-colors cursor-pointer">Área do Hoteleiro</button>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default CatalogoHoteis;
