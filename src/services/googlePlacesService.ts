// Serviço de integração com Google Places API (New)
// Suporta busca estruturada por Estado/Cidade e autopreenchimento individual

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';

export interface GooglePlaceHotel {
  placeId: string;
  name: string;
  category: string;
  formattedAddress: string;
  street: string;
  neighborhood: string;
  city: string;
  uf: string;
  cep: string;
  phone: string;
  rating?: number;
  reviewsCount?: number;
  imageUrl: string;
  link: string;
  googleMapsUri?: string;
}

// Helper para gerar slug limpo sem hífens
export const slugifyNoHyphens = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

// Infere categoria hoteleira a partir dos tipos e do nome do local
const inferCategory = (name: string, types?: string[]): string => {
  const lower = name.toLowerCase();
  if (lower.includes('resort')) return 'Resort All-Inclusive';
  if (lower.includes('pousada')) return 'Pousada Boutique / Charme';
  if (lower.includes('chalé') || lower.includes('chale')) return 'Chalé & Spa';
  if (lower.includes('flat') || lower.includes('apart')) return 'Flat / Apart Hotel';
  if (lower.includes('fazenda')) return 'Hotel Fazenda';
  if (lower.includes('boutique')) return 'Hotel Boutique';
  if (types && types.includes('resort_hotel')) return 'Resort';
  return 'Hotel Urbano / Executivo';
};

// Formata telefone nacional brasileiro
const cleanPhoneNumber = (rawPhone?: string): string => {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';
  // Se começar com 55 e tiver 12 ou 13 dígitos
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return `+${digits.substring(0, 2)} (${digits.substring(2, 4)}) ${digits.substring(4, 9)}-${digits.substring(9)}`;
  }
  // Formato nacional (10 ou 11 dígitos: DDD + número)
  if (digits.length === 11) {
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}`;
  }
  return rawPhone;
};

// Extrai componentes de endereço do Google Places
const parseAddressComponents = (components: any[], fallbackCity: string, fallbackUf: string) => {
  let street = '';
  let streetNumber = '';
  let neighborhood = '';
  let foundCity = '';
  let foundUf = '';
  let cep = '';

  if (Array.isArray(components)) {
    components.forEach((c: any) => {
      const types = c.types || [];
      if (types.includes('route')) {
        street = c.longText || c.shortText || '';
      } else if (types.includes('street_number')) {
        streetNumber = c.longText || c.shortText || '';
      } else if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
        neighborhood = c.longText || c.shortText || '';
      } else if (types.includes('administrative_area_level_2')) {
        // administrative_area_level_2 é a Cidade / Município oficial no Brasil
        foundCity = c.longText || c.shortText || foundCity;
      } else if (!foundCity && types.includes('locality')) {
        foundCity = c.longText || c.shortText || foundCity;
      } else if (types.includes('administrative_area_level_1')) {
        foundUf = c.shortText || c.longText || foundUf;
      } else if (types.includes('postal_code')) {
        cep = c.longText || c.shortText || '';
      }
    });
  }

  const fullStreet = streetNumber ? `${street}, ${streetNumber}` : street;
  return {
    street: fullStreet,
    neighborhood,
    city: foundCity || fallbackCity,
    uf: (foundUf || fallbackUf).toUpperCase(),
    cep
  };
};

// Converte um objeto bruto do Google Places v1 em GooglePlaceHotel padronizado
const mapRawPlaceToHotel = (p: any, fallbackCity: string, fallbackUf: string): GooglePlaceHotel => {
  const name = p.displayName?.text || 'Hotel sem nome';
  const phone = cleanPhoneNumber(p.nationalPhoneNumber || p.internationalPhoneNumber);
  const address = parseAddressComponents(p.addressComponents, fallbackCity, fallbackUf);

  // Se a cidade não foi resolvida pelos componentes, tenta extrair da formattedAddress (ex: "..., Cuiabá - MT, Brasil")
  let finalCity = address.city;
  if (!finalCity || (fallbackCity && finalCity.toLowerCase() === fallbackCity.toLowerCase() && fallbackCity.includes('todas'))) {
    if (p.formattedAddress) {
      const match = p.formattedAddress.match(/,\s*([A-Za-zÀ-ÿ\s]+)\s*-\s*([A-Z]{2})/);
      if (match && match[1]) {
        finalCity = match[1].trim();
      }
    }
  }

  // Gera URL da primeira foto disponível via Places Media CDN
  let imageUrl = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80';
  if (p.photos && p.photos.length > 0 && p.photos[0].name) {
    imageUrl = `https://places.googleapis.com/v1/${p.photos[0].name}/media?maxHeightPx=600&maxWidthPx=800&key=${GOOGLE_API_KEY}`;
  }

  const slug = slugifyNoHyphens(name);
  const link = `/hoteis/${slug}`;

  return {
    placeId: p.id,
    name,
    category: inferCategory(name, p.types),
    formattedAddress: p.formattedAddress || `${address.street}, ${address.neighborhood}, ${finalCity} - ${address.uf}`,
    street: address.street || p.formattedAddress?.split(',')[0] || '',
    neighborhood: address.neighborhood || 'Centro',
    city: finalCity || fallbackCity,
    uf: (address.uf || fallbackUf).toUpperCase(),
    cep: address.cep || '',
    phone: phone || '',
    rating: p.rating || 4.8,
    reviewsCount: p.userRatingCount || 25,
    imageUrl,
    link,
    googleMapsUri: p.googleMapsUri
  };
};

export const googlePlacesService = {
  /**
   * Busca hotéis via n8n (OpenStreetMap / Scraper gratuito sem custos do Google)
   */
  async searchHotelsByCity(
    uf: string,
    city: string,
    hotelType: string = 'hotéis e pousadas',
    maxResults: number = 25
  ): Promise<GooglePlaceHotel[]> {
    try {
      const cleanCity = city.split('(')[0].trim();

      // 1. Tenta buscar via webhook do n8n (gratuito, sem custos de API)
      try {
        const n8nResponse = await fetch('https://portaln8n.hotelnozap.com.br/webhook/buscar-hoteis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            uf,
            cidade: cleanCity,
            tipo: hotelType
          })
        });

        if (n8nResponse.ok) {
          const n8nData = await n8nResponse.json();
          const items = Array.isArray(n8nData) ? n8nData : (n8nData.hoteis || []);
          if (items.length > 0) {
            return items.map((h: any) => ({
              ...h,
              city: h.city || cleanCity,
              uf: h.uf || uf
            }));
          }
        }
      } catch (n8nErr) {
        console.warn('Busca n8n indisponível, tentando fallback...', n8nErr);
      }

      // 2. Se o n8n não retornar ou der erro, consulta direta no Nominatim OpenStreetMap (100% gratuito)
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?amenity=hotel&city=${encodeURIComponent(cleanCity)}&state=${encodeURIComponent(uf)}&format=json&addressdetails=1&limit=${maxResults}`;
      const osmResp = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'HotelNoZapApp/1.0 (contato@hotelnozap.com.br)'
        }
      });

      if (osmResp.ok) {
        const osmData = await osmResp.json();
        if (Array.isArray(osmData) && osmData.length > 0) {
          const defaultPhotos = [
            'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&auto=format&fit=crop&q=80'
          ];

          return osmData
            .filter((el: any) => el && el.name)
            .map((el: any, index: number) => {
              const addr = el.address || {};
              const nome = el.name;
              const rua = addr.road || addr.street || 'Centro';
              const bairro = addr.suburb || addr.neighbourhood || addr.residential || 'Centro';
              const cep = addr.postcode || '';
              const slug = slugifyNoHyphens(nome);

              return {
                placeId: `osm_${el.place_id || index}`,
                name: nome,
                category: inferCategory(nome),
                formattedAddress: el.display_name || `${rua} - ${bairro}, ${cleanCity} - ${uf}`,
                street: rua,
                neighborhood: bairro,
                city: addr.city || cleanCity,
                uf: uf.toUpperCase(),
                cep: cep,
                phone: '',
                rating: 4.8,
                reviewsCount: 25,
                imageUrl: defaultPhotos[index % defaultPhotos.length],
                link: `/hoteis/${slug}`
              };
            });
        }
      }

      return [];
    } catch (err) {
      console.error('Falha ao buscar hotéis:', err);
      return [];
    }
  },

  /**
   * Busca hotéis em todas as cidades de um estado consultando os principais polos
   */
  async searchHotelsByState(
    uf: string,
    stateName: string,
    hotelType: string = 'hotéis e pousadas',
    sampleCities: string[] = []
  ): Promise<GooglePlaceHotel[]> {
    try {
      const distinctCities = (sampleCities || [])
        .map(c => c.split('(')[0].trim())
        .filter(c => c && c.length > 2 && !c.toLowerCase().includes('todas'))
        .slice(0, 5);

      const fetchPromises = distinctCities.map(city => 
        googlePlacesService.searchHotelsByCity(uf, city, hotelType, 10)
      );

      const allBatches = await Promise.all(fetchPromises);
      const seenPlaceIds = new Set<string>();
      const combinedHotels: GooglePlaceHotel[] = [];

      allBatches.forEach(batch => {
        batch.forEach(hotel => {
          if (hotel && hotel.placeId && !seenPlaceIds.has(hotel.placeId)) {
            seenPlaceIds.add(hotel.placeId);
            combinedHotels.push(hotel);
          }
        });
      });

      return combinedHotels;
    } catch (err) {
      console.error('Falha ao buscar hotéis no estado:', err);
      return [];
    }
  },

  /**
   * Busca um hotel específico por nome/termo para o autopreenchimento do formulário
   */
  async searchHotelByName(query: string): Promise<GooglePlaceHotel[]> {
    if (!query || query.trim().length < 3) return [];

    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.userRatingCount,places.photos,places.types,places.addressComponents,places.googleMapsUri'
        },
        body: JSON.stringify({
          textQuery: query,
          languageCode: 'pt-BR',
          maxResultCount: 5
        })
      });

      if (!response.ok) return [];

      const data = await response.json();
      const places = data.places || [];

      return places.map((p: any) => {
        const name = p.displayName?.text || query;
        const phone = cleanPhoneNumber(p.nationalPhoneNumber || p.internationalPhoneNumber);
        const address = parseAddressComponents(p.addressComponents, '', '');

        let imageUrl = '';
        if (p.photos && p.photos.length > 0 && p.photos[0].name) {
          imageUrl = `https://places.googleapis.com/v1/${p.photos[0].name}/media?maxHeightPx=600&maxWidthPx=800&key=${GOOGLE_API_KEY}`;
        }

        const slug = slugifyNoHyphens(name);
        const link = `/hoteis/${slug}`;

        return {
          placeId: p.id,
          name,
          category: inferCategory(name, p.types),
          formattedAddress: p.formattedAddress || '',
          street: address.street || p.formattedAddress?.split(',')[0] || '',
          neighborhood: address.neighborhood || '',
          city: address.city || '',
          uf: (address.uf || '').toUpperCase(),
          cep: address.cep || '',
          phone,
          rating: p.rating,
          reviewsCount: p.userRatingCount,
          imageUrl,
          link,
          googleMapsUri: p.googleMapsUri
        };
      });
    } catch (err) {
      console.error('Falha ao autocompletar hotel do Google Places:', err);
      return [];
    }
  }
};
