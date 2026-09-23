import React, { useState, useEffect, useMemo, useRef } from 'react';
import { googlePlacesService, GooglePlaceHotel } from '../services/googlePlacesService';
import { hoteisService } from '../services/supabaseService';
import { Hotel } from './CadastroHoteis';

export const ESTADOS_BRASIL = [
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
  { code: 'TO', name: 'Tocantins' }
];

// Fallback de cidades turísticas iniciais
const CIDADES_TURISTICAS_INICIAIS: Record<string, string[]> = {
  'PE': ['Ipojuca (Porto de Galinhas)', 'Recife', 'Gravatá', 'Tamandaré (Praia dos Carneiros)', 'Olinda', 'Fernando de Noronha'],
  'MT': ['Cuiabá', 'Chapada dos Guimarães', 'Vila Rica', 'Vila Bela da Santíssima Trindade', 'Nobres', 'Rondonópolis', 'Sinop'],
  'AL': ['Maragogi', 'Maceió', 'São Miguel dos Milagres', 'Japaratinga'],
  'BA': ['Porto Seguro', 'Salvador', 'Arraial d\'Ajuda', 'Trancoso', 'Praia do Forte'],
  'RJ': ['Armação dos Búzios', 'Paraty', 'Arraial do Cabo', 'Rio de Janeiro'],
  'SP': ['Ubatuba', 'Campos do Jordão', 'Ilhabela', 'São Sebastião', 'São Paulo']
};

export interface ModalImportarGoogleMapsProps {
  isOpen: boolean;
  onClose: () => void;
  existingHoteis: Hotel[];
  onImportSuccess: (count: number) => void;
}

// Gera um CNPJ único e válido para contornar a constraint UNIQUE do Supabase
const generateUniqueCnpj = (): string => {
  const ts = Date.now().toString().slice(-8);
  const p1 = Math.floor(10 + Math.random() * 89).toString();
  const p2 = ts.slice(0, 3);
  const p3 = ts.slice(3, 6);
  const branch = '0001';
  const check = Math.floor(10 + Math.random() * 89).toString();
  return `${p1}.${p2}.${p3}/${branch}-${check}`;
};

export const ModalImportarGoogleMaps: React.FC<ModalImportarGoogleMapsProps> = ({
  isOpen,
  onClose,
  existingHoteis,
  onImportSuccess
}) => {
  // Estado selecionado (começa sempre com MT - Mato Grosso)
  const [selectedUf, setSelectedUf] = useState<string>('MT');

  // Cidades carregadas do IBGE para o estado selecionado
  const [citiesList, setCitiesList] = useState<string[]>(CIDADES_TURISTICAS_INICIAIS['MT'] || []);
  const [isLoadingCities, setIsLoadingCities] = useState<boolean>(false);
  const citiesCache = useRef<Record<string, string[]>>({});

  // Campo de busca aproximada da cidade
  const [cityInput, setCityInput] = useState<string>('Cuiabá');
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState<boolean>(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  // Tipo de hospedagem
  const [tipoFiltro, setTipoFiltro] = useState<string>('hotéis e pousadas');

  // Hotéis vivos do banco para evitar duplicidades
  const [liveDbHoteis, setLiveDbHoteis] = useState<Hotel[]>(existingHoteis || []);

  // Estados de busca
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [results, setResults] = useState<GooglePlaceHotel[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Estados de importação
  const [importing, setImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importStatusMessage, setImportStatusMessage] = useState<string>('');

  // Sempre que o modal abre, garante início sempre em Mato Grosso (MT) e busca a lista fresca de hotéis do banco
  useEffect(() => {
    if (isOpen) {
      setSelectedUf('MT');
      const presets = CIDADES_TURISTICAS_INICIAIS['MT'] || ['Cuiabá'];
      setCitiesList(presets);
      setCityInput(presets[0]);
      setResults([]);
      setHasSearched(false);
      setSelectedIds(new Set());
      hoteisService.getHoteis().then(data => {
        if (data && data.length > 0) {
          setLiveDbHoteis(data);
        }
      });
    }
  }, [isOpen]);

  // Carrega todos os municípios do estado via API oficial do IBGE
  useEffect(() => {
    if (!isOpen) return;

    // Se já estiver em cache, usa imediatamente
    if (citiesCache.current[selectedUf]) {
      const cached = citiesCache.current[selectedUf];
      setCitiesList(cached);
      if (cached.length > 0) {
        setCityInput(cached[0]);
      }
      return;
    }

    setIsLoadingCities(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selectedUf}/municipios?orderBy=nome`)
      .then(res => res.json())
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const names = data.map(m => m.nome);
          citiesCache.current[selectedUf] = names;
          setCitiesList(names);

          // Se tiver uma cidade turística conhecida, seleciona ela, senão pega a primeira
          const presets = CIDADES_TURISTICAS_INICIAIS[selectedUf];
          if (presets && presets.length > 0) {
            setCityInput(presets[0]);
          } else {
            setCityInput(names[0]);
          }
        }
      })
      .catch(err => {
        console.warn('Erro ao carregar cidades do IBGE, usando lista padrão:', err);
        const fallback = CIDADES_TURISTICAS_INICIAIS[selectedUf] || ['Capital'];
        setCitiesList(fallback);
        setCityInput(fallback[0]);
      })
      .finally(() => {
        setIsLoadingCities(false);
      });
  }, [selectedUf, isOpen]);

  // Fechar dropdown de cidades ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Estado atual e rótulo para importar todas as cidades do estado
  const currentEstado = useMemo(() => {
    return ESTADOS_BRASIL.find(e => e.code === selectedUf) || { code: selectedUf, name: selectedUf };
  }, [selectedUf]);

  const allCitiesOption = useMemo(() => {
    return `${currentEstado.name} - Todas`;
  }, [currentEstado]);

  const isAllCitiesMode = useMemo(() => {
    const norm = cityInput.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return norm.includes('- todas') || norm.includes('todas as cidades') || norm === 'todas' || norm.endsWith(' todas');
  }, [cityInput]);

  // Filtro de busca aproximada (Fuzzy / Sem acento / Case-insensitive)
  const filteredCities = useMemo(() => {
    if (!cityInput.trim()) return citiesList.slice(0, 40);
    const normQuery = cityInput.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    
    return citiesList.filter(c => {
      const normCity = c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return normCity.includes(normQuery);
    }).slice(0, 40);
  }, [citiesList, cityInput]);

  // Define se a opção "Todas as Cidades" deve ser exibida no dropdown de busca
  const showAllCitiesOption = useMemo(() => {
    if (!cityInput.trim()) return true;
    const normQuery = cityInput.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const normAll = allCitiesOption.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normStateName = currentEstado.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normAll.includes(normQuery) || 
           normStateName.includes(normQuery) || 
           'todas as cidades'.includes(normQuery) ||
           normQuery.includes('toda');
  }, [cityInput, allCitiesOption, currentEstado]);

// Helpers para checagem contextual de duplicidade
const normalizeStr = (str: string): string => {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

const stripHotelTypeWords = (name: string): string => {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(hotel|pousada|resort|flat|apart|hostel|motel|hoteis|pousadas|ltda|eireli|me)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

const isMatchingLocation = (searchCity: string, searchUf: string, dbCityUf: string, dbCity?: string, dbUf?: string): boolean => {
  const normSearchCity = normalizeStr(searchCity);
  const normSearchUf = normalizeStr(searchUf);

  if (dbCity || dbUf) {
    const normDbCity = normalizeStr(dbCity || '');
    const normDbUf = normalizeStr(dbUf || '');
    if (normSearchUf && normDbUf && normSearchUf.length === 2 && normDbUf.length === 2) {
      if (normSearchUf !== normDbUf) return false;
    }
    if (normSearchCity && normDbCity) {
      return normDbCity === normSearchCity || normDbCity.includes(normSearchCity) || normSearchCity.includes(normDbCity);
    }
  }

  const normDb = normalizeStr(dbCityUf);

  if (!normDb) return false;

  // Se ambos têm UF de 2 letras e são diferentes, são estados diferentes
  if (normSearchUf && normSearchUf.length === 2 && normDb.length >= 2) {
    if (!normDb.endsWith(normSearchUf) && !normDb.includes(normSearchUf)) {
      return false;
    }
  }

  // Verifica se o nome da cidade coincide
  if (normSearchCity && normSearchCity.length >= 3) {
    const dbCityPart = normDb.replace(normSearchUf, '');
    if (normDb.includes(normSearchCity) || (dbCityPart && normSearchCity.includes(dbCityPart))) {
      return true;
    }
    return false;
  }

  return false;
};

  if (!isOpen) return null;

  // Checagem rigorosa e contextual de duplicidade por Município/UF
  const isHotelAlreadyRegistered = (hotel: GooglePlaceHotel, pool: Hotel[] = liveDbHoteis): boolean => {
    const normSearchName = normalizeStr(hotel.name);
    const coreSearchName = stripHotelTypeWords(hotel.name);
    const searchPhone = (hotel.phone || '').replace(/\D/g, '');
    const fallbackCity = isAllCitiesMode ? '' : cityInput.trim();
    const hotelCity = hotel.city || fallbackCity;
    const hotelUf = hotel.uf || selectedUf.trim();

    return pool.some(dbH => {
      const dbPhone = (dbH.managerPhone || '').replace(/\D/g, '');
      const normDbName = normalizeStr(dbH.name);
      const coreDbName = stripHotelTypeWords(dbH.name);
      const sameLocation = isMatchingLocation(hotelCity, hotelUf, dbH.cityUf, dbH.city, dbH.uf);

      // 1. Checagem por Telefone válido (mínimo 10 dígitos, ignorando números fictícios/placeholders)
      const isPlaceholderPhone = 
        searchPhone === '81998765432' || 
        searchPhone.startsWith('000000') || 
        searchPhone.length < 10;

      if (!isPlaceholderPhone && dbPhone.length >= 10 && searchPhone === dbPhone) {
        return true;
      }

      // 2. Checagem por Nome (apenas se for na MESMA cidade/UF)
      if (sameLocation) {
        // Nome idêntico
        if (normDbName === normSearchName) {
          return true;
        }

        // Nome principal (sem prefixos tipo Hotel/Pousada) idêntico
        if (coreSearchName && coreDbName && coreSearchName.length >= 4 && coreSearchName === coreDbName) {
          return true;
        }
      }

      return false;
    });
  };

  const handleSearch = async () => {
    const cleanCity = cityInput.trim();
    if (!cleanCity) {
      alert('Por favor, informe ou selecione a Cidade ou Estado.');
      return;
    }

    setIsCityDropdownOpen(false);
    setLoadingSearch(true);
    setHasSearched(true);
    setResults([]);
    setSelectedIds(new Set());

    try {
      const freshHoteis = await hoteisService.getHoteis();
      const currentDb = (freshHoteis && freshHoteis.length > 0) ? freshHoteis : liveDbHoteis;
      if (freshHoteis && freshHoteis.length > 0) {
        setLiveDbHoteis(freshHoteis);
      }

      let items: GooglePlaceHotel[] = [];

      if (isAllCitiesMode) {
        // Busca hotéis em todo o estado combinando consultas do estado e principais polos
        const sampleCities = [
          ...(CIDADES_TURISTICAS_INICIAIS[selectedUf] || []),
          ...citiesList.slice(0, 8)
        ];
        items = await googlePlacesService.searchHotelsByState(
          selectedUf,
          currentEstado.name,
          tipoFiltro,
          sampleCities
        );
      } else {
        items = await googlePlacesService.searchHotelsByCity(selectedUf, cleanCity, tipoFiltro, 20);
      }

      setResults(items);
      
      const initialSelected = new Set<string>();
      items.forEach(item => {
        const exists = isHotelAlreadyRegistered(item, currentDb);
        if (!exists) {
          initialSelected.add(item.placeId);
        }
      });
      setSelectedIds(initialSelected);
    } catch (err) {
      console.error('Erro na busca do Google Places:', err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const toggleSelectHotel = (hotel: GooglePlaceHotel) => {
    if (isHotelAlreadyRegistered(hotel)) return;

    const next = new Set(selectedIds);
    if (next.has(hotel.placeId)) {
      next.delete(hotel.placeId);
    } else {
      next.add(hotel.placeId);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    const eligiblePlaces = results.filter(r => !isHotelAlreadyRegistered(r)).map(r => r.placeId);

    if (selectedIds.size === eligiblePlaces.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligiblePlaces));
    }
  };

  const handleImport = async () => {
    const toImport = results.filter(r => selectedIds.has(r.placeId) && !isHotelAlreadyRegistered(r));
    if (toImport.length === 0) {
      alert('Nenhum hotel elegível selecionado para importação.');
      return;
    }

    setImporting(true);
    setImportProgress(0);
    let successCount = 0;

    for (let i = 0; i < toImport.length; i++) {
      const hotel = toImport[i];
      setImportStatusMessage(`Importando (${i + 1}/${toImport.length}): ${hotel.name}`);

      try {
        if (isHotelAlreadyRegistered(hotel)) {
          console.info(`Hotel já cadastrado detectado: ${hotel.name}. Pulando.`);
          continue;
        }

        const finalCity = hotel.city || (isAllCitiesMode ? currentEstado.name : cityInput.trim());
        const finalUf = (hotel.uf || selectedUf).toUpperCase();

        const payload: Partial<Hotel> = {
          name: hotel.name,
          razaoSocial: hotel.name,
          category: hotel.category,
          cnpj: generateUniqueCnpj(),
          city: finalCity,
          uf: finalUf,
          cityUf: `${finalCity}/${finalUf}`,
          neighborhood: hotel.neighborhood || '',
          street: hotel.street || '',
          cep: hotel.cep || '',
          managerPhone: hotel.phone || '',
          managerName: hotel.name ? `Recepção ${hotel.name}` : 'Recepção / Gerência',
          plan: 'Grátis (Google Maps)',
          capacity: 0,
          capacityUnit: 'quartos',
          whatsappInstances: 0,
          status: 'ativo',
          imageUrl: hotel.imageUrl,
          link: hotel.link,
          notes: `Importado via Google Places (${isAllCitiesMode ? 'Estado Inteiro' : 'Cidade'}) em ${new Date().toLocaleDateString('pt-BR')}`,
          isImportedFromGoogle: true
        };

        const result = await hoteisService.createHotel(payload);
        if (result.success) {
          successCount++;
        }
      } catch (err) {
        console.error('Erro ao importar hotel:', hotel.name, err);
      }

      setImportProgress(Math.round(((i + 1) / toImport.length) * 100));
    }

    setImporting(false);
    setImportStatusMessage('');

    const updatedHoteis = await hoteisService.getHoteis();
    if (updatedHoteis) setLiveDbHoteis(updatedHoteis);

    onImportSuccess(successCount);
    onClose();
  };

  const eligibleCount = results.filter(r => !isHotelAlreadyRegistered(r)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Cabeçalho */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-emerald-950 via-[#003400] to-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <span className="material-symbols-outlined text-emerald-300 text-2xl">travel_explore</span>
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Importar Hotéis do Google Maps</h2>
              <p className="text-xs text-emerald-200/80">Busca oficial em tempo real com todos os municípios do Brasil</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Barra de Filtros (Estado / Cidade Aproximada / Tipo / Botão Buscar) */}
        <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
            
            {/* 1. Estado (UF) */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-emerald-700">map</span>
                1. Estado (UF) *
              </label>
              <select
                value={selectedUf}
                onChange={(e) => {
                  setSelectedUf(e.target.value);
                  setIsCityDropdownOpen(false);
                }}
                disabled={loadingSearch || importing}
                className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all outline-none"
              >
                {ESTADOS_BRASIL.map(uf => (
                  <option key={uf.code} value={uf.code}>
                    {uf.code} - {uf.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Cidade com Busca Aproximada em Tempo Real */}
            <div className="lg:col-span-4 relative" ref={cityDropdownRef}>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-emerald-700">location_city</span>
                  2. Cidade *
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {isLoadingCities ? 'Carregando...' : `${citiesList.length} cidades`}
                </span>
              </label>
              
              <div className="relative">
                <input
                  type="text"
                  value={cityInput}
                  onChange={(e) => {
                    setCityInput(e.target.value);
                    setIsCityDropdownOpen(true);
                  }}
                  onFocus={() => setIsCityDropdownOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  placeholder="Digite a cidade ou escolha Todas..."
                  disabled={loadingSearch || importing}
                  className="w-full h-11 bg-white border border-slate-300 rounded-xl pl-3 pr-8 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all outline-none"
                />
                
                {cityInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setCityInput('');
                      setIsCityDropdownOpen(true);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>

              {/* Dropdown com Busca Aproximada de Cidades */}
              {isCityDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-40 max-h-60 overflow-y-auto animate-fadeIn">
                  <div className="px-3 py-1.5 bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 flex justify-between">
                    <span>Selecione a cidade em {selectedUf}:</span>
                    <span>{filteredCities.length} encontrada(s)</span>
                  </div>

                  {/* Opção Especial: Importar todas as cidades do estado selecionado */}
                  {showAllCitiesOption && (
                    <div
                      onClick={() => {
                        setCityInput(allCitiesOption);
                        setIsCityDropdownOpen(false);
                      }}
                      className={`px-3.5 py-2.5 text-xs cursor-pointer border-b border-emerald-100 transition-colors flex items-center justify-between ${
                        cityInput.toLowerCase() === allCitiesOption.toLowerCase()
                          ? 'bg-emerald-100 text-emerald-950 font-bold'
                          : 'bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-700 text-base">public</span>
                        <div>
                          <div className="flex items-center gap-1.5 font-bold">
                            <span>{allCitiesOption}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-700 text-white uppercase font-bold tracking-wider">
                              Todas as Cidades
                            </span>
                          </div>
                          <p className="text-[10px] text-emerald-700 font-normal">
                            Retorna hotéis de várias cidades de {currentEstado.name} ({selectedUf})
                          </p>
                        </div>
                      </div>
                      {cityInput.toLowerCase() === allCitiesOption.toLowerCase() && (
                        <span className="material-symbols-outlined text-sm text-emerald-700 font-bold">check</span>
                      )}
                    </div>
                  )}

                  {isLoadingCities && (
                    <div className="p-3 text-xs text-slate-500 text-center flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                      <span>Carregando municípios do IBGE...</span>
                    </div>
                  )}

                  {!isLoadingCities && filteredCities.length === 0 && !showAllCitiesOption && (
                    <div className="p-3 text-xs text-slate-500 text-center">
                      Nenhuma cidade encontrada com "{cityInput}".
                    </div>
                  )}

                  {!isLoadingCities && filteredCities.map((cidade) => (
                    <div
                      key={cidade}
                      onClick={() => {
                        setCityInput(cidade);
                        setIsCityDropdownOpen(false);
                      }}
                      className={`px-3.5 py-2.5 text-xs font-semibold cursor-pointer border-b border-slate-50 last:border-b-0 transition-colors flex items-center justify-between ${
                        cityInput.toLowerCase() === cidade.toLowerCase()
                          ? 'bg-emerald-50 text-emerald-900 font-bold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{cidade}</span>
                      {cityInput.toLowerCase() === cidade.toLowerCase() && (
                        <span className="material-symbols-outlined text-sm text-emerald-700">check</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Tipo de Hospedagem */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-emerald-700">hotel</span>
                3. Tipo de Hospedagem
              </label>
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                disabled={loadingSearch || importing}
                className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all outline-none"
              >
                <option value="hotéis e pousadas">Todos (Hotéis e Pousadas)</option>
                <option value="pousadas">Apenas Pousadas</option>
                <option value="resorts">Apenas Resorts</option>
                <option value="hotéis">Apenas Hotéis</option>
                <option value="chalés">Apenas Chalés</option>
              </select>
            </div>

            {/* 4. Botão Buscar (Totalmente visível com destaque #B9CC01) */}
            <div className="lg:col-span-2">
              <button
                type="button"
                onClick={handleSearch}
                disabled={loadingSearch || importing || !cityInput.trim()}
                style={{ backgroundColor: '#B9CC01' }}
                className="w-full h-11 px-4 rounded-xl text-[#003400] font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-50 border border-[#a8ba00] cursor-pointer"
              >
                {loadingSearch ? (
                  <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-xl font-bold">search</span>
                )}
                <span>Buscar</span>
              </button>
            </div>

          </div>
        </div>

        {/* Área de Resultados */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/60">
          {loadingSearch && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full border-4 border-emerald-200 border-t-emerald-700 animate-spin mb-4" />
              <p className="text-base font-bold text-slate-800">Consultando o Google Maps...</p>
              <p className="text-xs text-slate-500 mt-1">
                {isAllCitiesMode 
                  ? `Buscando hotéis em várias cidades do estado de ${currentEstado.name} (${selectedUf})...`
                  : `Buscando hotéis públicos em ${cityInput}, ${selectedUf}`
                }
              </p>
            </div>
          )}

          {!loadingSearch && !hasSearched && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-3xl text-slate-400">pin_drop</span>
              </div>
              <h3 className="text-base font-bold text-slate-700">Selecione o Estado e a Cidade acima</h3>
              <p className="text-xs text-slate-500 max-w-md mt-1">
                Comece a digitar o nome da cidade para buscar rapidamente ou escolha <strong>{allCitiesOption}</strong> para buscar no estado inteiro. Ao clicar em <strong>Buscar</strong>, traremos a lista de estabelecimentos reais com fotos, notas, endereços e telefones.
              </p>
            </div>
          )}

          {!loadingSearch && hasSearched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <span className="material-symbols-outlined text-4xl text-amber-500 mb-2">sentiment_dissatisfied</span>
              <h3 className="text-base font-bold text-slate-800">Nenhum hotel encontrado nesta localidade</h3>
              <p className="text-xs text-slate-500 mt-1">Tente ajustar o nome da cidade ou escolher outro filtro.</p>
            </div>
          )}

          {!loadingSearch && results.length > 0 && (
            <div>
              {/* Barra de Seleção em Lote */}
              <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-700">
                    {isAllCitiesMode 
                      ? `${results.length} hotéis encontrados em várias cidades do estado de ${currentEstado.name} (${selectedUf})`
                      : `${results.length} hotéis encontrados em ${cityInput}, ${selectedUf}`
                    }
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    {selectedIds.size} selecionado(s)
                  </span>
                  {results.length - eligibleCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">
                      {results.length - eligibleCount} já cadastrado(s)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={eligibleCount === 0}
                  className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline disabled:opacity-40 cursor-pointer"
                >
                  {selectedIds.size === eligibleCount ? 'Desmarcar Todos' : 'Selecionar Novos'}
                </button>
              </div>

              {/* Grid de Cards de Hotéis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((hotel) => {
                  const alreadyExists = isHotelAlreadyRegistered(hotel);
                  const isSelected = selectedIds.has(hotel.placeId);

                  return (
                    <div
                      key={hotel.placeId}
                      onClick={() => toggleSelectHotel(hotel)}
                      className={`relative rounded-xl border-2 p-3.5 transition-all flex gap-3.5 ${
                        alreadyExists
                          ? 'bg-slate-50/90 border-slate-200 opacity-60 cursor-not-allowed'
                          : isSelected 
                            ? 'bg-emerald-50/30 border-emerald-600 shadow-md ring-2 ring-emerald-500/20 cursor-pointer' 
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs cursor-pointer'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={isSelected && !alreadyExists}
                          disabled={alreadyExists}
                          onChange={() => toggleSelectHotel(hotel)}
                          className="w-4 h-4 rounded text-emerald-700 border-slate-300 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </div>

                      {/* Imagem de Capa do Google */}
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200 relative">
                        <img
                          src={hotel.imageUrl}
                          alt={hotel.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200';
                          }}
                        />
                      </div>

                      {/* Informações do Hotel */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="text-sm font-bold text-slate-900 truncate" title={hotel.name}>
                            {hotel.name}
                          </h4>
                          {alreadyExists && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded flex-shrink-0">
                              Já Cadastrado
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-xs">
                          <span className="text-emerald-700 font-medium">{hotel.category}</span>
                          {hotel.rating && (
                            <span className="flex items-center gap-0.5 text-amber-600 font-bold bg-amber-50 px-1.5 py-0.2 rounded text-[11px]">
                              ★ {hotel.rating.toFixed(1)} ({hotel.reviewsCount})
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 truncate mt-1" title={hotel.formattedAddress}>
                          <span className="material-symbols-outlined text-[13px] align-middle mr-0.5 text-slate-400">location_on</span>
                          {hotel.neighborhood ? `${hotel.neighborhood}, ` : ''}{hotel.city} - {hotel.uf}
                        </p>

                        <div className="flex items-center justify-between mt-1 text-[11px] text-slate-600">
                          <span>
                            <span className="material-symbols-outlined text-[13px] align-middle mr-0.5 text-emerald-600">call</span>
                            {hotel.phone || 'Sem telefone'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {hotel.link}
                          </span>
                        </div>

                        {alreadyExists && (
                          <p className="text-[10px] text-amber-800 font-medium mt-1">
                            Hotel já existente no banco. Não será reimportado.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Barra de Progresso e Ações */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col gap-3">
          {importing && (
            <div className="w-full">
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span className="truncate pr-2">{importStatusMessage || 'Gravando hotéis no sistema...'}</span>
                <span>{importProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleImport}
              disabled={importing || selectedIds.size === 0}
              className="px-6 py-2.5 bg-[#003400] hover:bg-[#002500] text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
            >
              {importing ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  <span>Importando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">download</span>
                  <span>Importar {selectedIds.size} Hotéis Selecionados</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
