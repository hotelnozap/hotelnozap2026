// =========================================================================
// SERVIÇO DE LOCALIZAÇÃO E PERMISSÕES DO APP (PWA / MOBILE)
// Gerencia geolocalização por GPS, geocodificação reversa e permissões
// =========================================================================

export interface UserLocation {
  city: string;
  uf: string;
  lat?: number;
  lng?: number;
}

const STORAGE_KEY_CITY = 'hotelnozap_user_city';
const STORAGE_KEY_UF = 'hotelnozap_user_uf';
const STORAGE_KEY_LAT = 'hotelnozap_user_lat';
const STORAGE_KEY_LNG = 'hotelnozap_user_lng';
const STORAGE_KEY_ASKED = 'hotelnozap_permissions_asked';
const STORAGE_KEY_TIMESTAMP = 'hotelnozap_user_location_timestamp';

// Mapeamento de nomes de estados brasileiros para códigos de UF
const ESTADOS_MAP: Record<string, string> = {
  'acre': 'AC',
  'alagoas': 'AL',
  'amapa': 'AP',
  'amapá': 'AP',
  'amazonas': 'AM',
  'bahia': 'BA',
  'ceara': 'CE',
  'ceará': 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  'espírito santo': 'ES',
  'goias': 'GO',
  'goiás': 'GO',
  'maranhao': 'MA',
  'maranhão': 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  'para': 'PA',
  'pará': 'PA',
  'paraiba': 'PB',
  'paraíba': 'PB',
  'parana': 'PR',
  'paraná': 'PR',
  'pernambuco': 'PE',
  'piaui': 'PI',
  'piauí': 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  'rondonia': 'RO',
  'rondônia': 'RO',
  'roraima': 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  'são paulo': 'SP',
  'sergipe': 'SE',
  'tocantins': 'TO'
};

const normalizeStateToUf = (stateNameOrCode: string): string => {
  if (!stateNameOrCode) return '';
  const clean = stateNameOrCode.trim();
  if (clean.length === 2) return clean.toUpperCase();

  // Pode vir como 'BR-PE' ou 'BR-SP'
  if (clean.startsWith('BR-') && clean.length === 5) {
    return clean.replace('BR-', '').toUpperCase();
  }

  const lower = clean.toLowerCase();
  return ESTADOS_MAP[lower] || clean.substring(0, 2).toUpperCase();
};

export const locationService = {
  /**
   * Obtém localização salva previamente no localStorage
   */
  getUserLocationFromStorage(): UserLocation | null {
    try {
      if (typeof window === 'undefined') return null;
      const city = localStorage.getItem(STORAGE_KEY_CITY);
      const uf = localStorage.getItem(STORAGE_KEY_UF);
      if (!city) return null;

      const latStr = localStorage.getItem(STORAGE_KEY_LAT);
      const lngStr = localStorage.getItem(STORAGE_KEY_LNG);

      return {
        city: city.trim(),
        uf: (uf || '').trim().toUpperCase(),
        lat: latStr ? parseFloat(latStr) : undefined,
        lng: lngStr ? parseFloat(lngStr) : undefined
      };
    } catch {
      return null;
    }
  },

  /**
   * Salva a localização detectada no localStorage e emite evento para componentes
   */
  saveUserLocation(loc: UserLocation): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(STORAGE_KEY_CITY, loc.city);
      if (loc.uf) localStorage.setItem(STORAGE_KEY_UF, loc.uf);
      if (loc.lat !== undefined) localStorage.setItem(STORAGE_KEY_LAT, String(loc.lat));
      if (loc.lng !== undefined) localStorage.setItem(STORAGE_KEY_LNG, String(loc.lng));
      localStorage.setItem(STORAGE_KEY_TIMESTAMP, String(Date.now()));

      // Dispara evento para atualização reativa instantânea
      window.dispatchEvent(new CustomEvent('hotelnozap_location_updated', {
        detail: loc
      }));
    } catch (e) {
      console.warn('[locationService] Erro ao salvar local:', e);
    }
  },

  /**
   * Verifica se as permissões já foram solicitadas na primeira abertura
   */
  hasAskedPermissions(): boolean {
    try {
      if (typeof window === 'undefined') return true;
      return localStorage.getItem(STORAGE_KEY_ASKED) === 'true';
    } catch {
      return true;
    }
  },

  /**
   * Marca as permissões como já solicitadas
   */
  markPermissionsAsAsked(): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(STORAGE_KEY_ASKED, 'true');
    } catch {}
  },

  /**
   * Geocodificação reversa rápida de Lat/Lng para Cidade e UF
   */
  async reverseGeocode(lat: number, lng: number): Promise<{ city: string; uf: string } | null> {
    // 1. Tenta BigDataCloud (muito rápido e formato limpo para o Brasil)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=pt`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const adminCity = data.localityInfo?.administrative?.find(
          (a: any) => a.adminLevel === 8 || a.adminLevel === 7 || a.adminLevel === 6
        )?.name;
        const city = data.city || data.locality || adminCity || data.localityInfo?.administrative?.[2]?.name;
        const subdivision = data.principalSubdivisionCode || data.principalSubdivision;
        const uf = normalizeStateToUf(subdivision || '');

        if (city) {
          return {
            city: city.trim(),
            uf: uf.trim()
          };
        }
      }
    } catch (err) {
      // Falhou BigDataCloud, tentar OpenStreetMap Nominatim
    }

    // 2. Fallback Nominatim (OpenStreetMap)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt`,
        { signal: controller.signal, headers: { 'User-Agent': 'HotelNoZap-App/1.0' } }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const address = data.address || {};
        const city = address.city || address.town || address.municipality || address.village || address.suburb || address.county;
        const state = address.state || address['ISO3166-2-lvl4'] || '';
        const uf = normalizeStateToUf(state);

        if (city) {
          return {
            city: city.trim(),
            uf: uf.trim()
          };
        }
      }
    } catch (err) {
      console.warn('[locationService] Erro no fallback Nominatim:', err);
    }

    return null;
  },

  /**
   * Executa a captura do GPS do usuário e descobre a cidade
   */
  async requestUserLocation(): Promise<UserLocation | null> {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const geoResult = await locationService.reverseGeocode(latitude, longitude);

            if (geoResult && geoResult.city) {
              const fullLoc: UserLocation = {
                city: geoResult.city,
                uf: geoResult.uf,
                lat: latitude,
                lng: longitude
              };
              locationService.saveUserLocation(fullLoc);
              resolve(fullLoc);
              return;
            }

            // Não conseguiu reverter nome, salva apenas coordenadas
            const coordLoc: UserLocation = {
              city: '',
              uf: '',
              lat: latitude,
              lng: longitude
            };
            resolve(coordLoc);
          } catch (e) {
            console.warn('[locationService] Erro ao processar geolocalização:', e);
            resolve(null);
          }
        },
        (error) => {
          console.warn('[locationService] Usuário recusou ou erro de geolocalização:', error.message);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 1000 * 60 * 15 // Cache de 15 minutos
        }
      );
    });
  },

  /**
   * Detecta a cidade do usuário via endereço IP (sem precisar de permissão de GPS e com fallback instantâneo)
   */
  async detectCityByIp(): Promise<UserLocation | null> {
    // 1. Tenta ipwho.is (rápido, gratuito e preciso para o Brasil)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('https://ipwho.is/', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success !== false && data.city) {
          const uf = normalizeStateToUf(data.region_code || data.region || '');
          const loc: UserLocation = {
            city: data.city.trim(),
            uf: uf.trim(),
            lat: data.latitude,
            lng: data.longitude
          };
          locationService.saveUserLocation(loc);
          return loc;
        }
      }
    } catch (e) {
      // Ignora e tenta fallback freeipapi
    }

    // 2. Fallback freeipapi.com
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('https://freeipapi.com/api/json', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.cityName) {
          const uf = normalizeStateToUf(data.regionName || '');
          const loc: UserLocation = {
            city: data.cityName.trim(),
            uf: uf.trim(),
            lat: data.latitude,
            lng: data.longitude
          };
          locationService.saveUserLocation(loc);
          return loc;
        }
      }
    } catch (e) {
      console.warn('[locationService] Erro no fallback de geolocalização por IP:', e);
    }

    return null;
  },

  /**
   * Reconhecimento automático completo da cidade tanto em Mobile quanto Desktop:
   * 1. Inicia GPS nativo do aparelho com alta precisão
   * 2. Inicia IP em paralelo para resposta instantânea (< 350ms)
   * 3. Se GPS responder dentro da janela, prioriza GPS; se demorar ou for bloqueado, usa IP imediatamente
   * 4. Se o usuário conceder GPS posteriormente, atualiza em background e dispara evento
   */
  async autoDetectUserLocation(): Promise<UserLocation | null> {
    const cached = locationService.getUserLocationFromStorage();

    // 1. Inicia IP em paralelo (instantâneo, sem necessidade de popup)
    const ipPromise = locationService.detectCityByIp();

    // 2. Se suporte a geolocalização nativa existir
    if (typeof window !== 'undefined' && navigator.geolocation) {
      try {
        const gpsPromise = locationService.requestUserLocation();

        // Aguarda até 3.5 segundos pelo GPS nativo
        const timeoutGps = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500));
        const quickGps = await Promise.race([gpsPromise, timeoutGps]);

        if (quickGps && quickGps.city) {
          return quickGps;
        }

        // Se o GPS demorou ou o usuário não respondeu no primeiro momento, usa o IP instantâneo
        const ipLoc = await ipPromise;
        if (ipLoc && ipLoc.city) {
          // Deixa o GPS rodando em segundo plano: quando o usuário clicar "Permitir", atualiza automaticamente
          gpsPromise.then((bgGps) => {
            if (bgGps && bgGps.city) {
              console.log('[locationService] GPS refinado obtido em background:', bgGps.city);
              locationService.saveUserLocation(bgGps);
            }
          }).catch(() => {});

          return ipLoc;
        }
      } catch (err) {
        console.warn('[locationService] Falha GPS, fallback IP:', err);
      }
    }

    const ipLoc = await ipPromise;
    if (ipLoc && ipLoc.city) return ipLoc;

    return cached;
  },

  /**
   * Verifica se o usuário escolheu uma cidade manualmente nesta sessão
   */
  hasManualCityOverride(): boolean {
    try {
      if (typeof window === 'undefined') return false;
      return sessionStorage.getItem('hotelnozap_manual_city_override') === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Marca que o usuário escolheu uma cidade manualmente
   */
  setManualCityOverride(city: string): void {
    try {
      if (typeof window === 'undefined') return;
      sessionStorage.setItem('hotelnozap_manual_city_override', 'true');
      sessionStorage.setItem('hotelnozap_override_city_name', city);
    } catch {}
  },

  /**
   * Limpa o override manual para voltar ao GPS automático
   */
  clearManualCityOverride(): void {
    try {
      if (typeof window === 'undefined') return;
      sessionStorage.removeItem('hotelnozap_manual_city_override');
      sessionStorage.removeItem('hotelnozap_override_city_name');
    } catch {}
  },

  /**
   * Solicita as permissões do app (Notificações Push + Localização GPS)
   */
  async requestAllAppPermissions(): Promise<{ notifications: boolean; location: boolean; locationData?: UserLocation | null }> {
    locationService.markPermissionsAsAsked();

    let notificationGranted = false;
    let locationGranted = false;
    let locationData: UserLocation | null = null;

    // 1. Notificações
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          notificationGranted = true;
        } else if (Notification.permission !== 'denied') {
          const res = await Notification.requestPermission();
          notificationGranted = res === 'granted';
        }
      }

      // OneSignal sync se ativo
      const oneSignal = (window as any).OneSignal;
      if (oneSignal?.Notifications) {
        try {
          await oneSignal.Notifications.requestPermission();
        } catch {}
      }
    } catch (e) {
      console.warn('[locationService] Falha ao solicitar notificação:', e);
    }

    // 2. Localização GPS com fallback inteligente de IP
    try {
      locationData = await locationService.autoDetectUserLocation();
      if (locationData && (locationData.city || locationData.lat)) {
        locationGranted = true;
      }
    } catch (e) {
      console.warn('[locationService] Falha ao solicitar GPS:', e);
    }

    return {
      notifications: notificationGranted,
      location: locationGranted,
      locationData
    };
  }
};

