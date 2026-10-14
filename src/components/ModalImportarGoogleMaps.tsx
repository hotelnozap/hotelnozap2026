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

// 142 cidades oficiais de Mato Grosso como fallback imediato
const CIDADES_MATO_GROSSO_142 = [
  "Acorizal","Água Boa","Alta Floresta","Alto Araguaia","Alto Boa Vista","Alto Garças","Alto Paraguai","Alto Taquari","Apiacás","Araguaiana","Araguainha","Araputanga","Arenápolis","Aripuanã","Barão de Melgaço","Barra do Bugres","Barra do Garças","Boa Esperança do Norte","Bom Jesus do Araguaia","Brasnorte","Cáceres","Campinápolis","Campo Novo do Parecis","Campo Verde","Campos de Júlio","Canabrava do Norte","Canarana","Carlinda","Castanheira","Chapada dos Guimarães","Cláudia","Cocalinho","Colíder","Colniza","Comodoro","Confresa","Conquista D'Oeste","Cotriguaçu","Cuiabá","Curvelândia","Denise","Diamantino","Dom Aquino","Feliz Natal","Figueirópolis D'Oeste","Gaúcha do Norte","General Carneiro","Glória D'Oeste","Guarantã do Norte","Guiratinga","Indiavaí","Ipiranga do Norte","Itanhangá","Itaúba","Itiquira","Jaciara","Jangada","Jauru","Juara","Juína","Juruena","Juscimeira","Lambari D'Oeste","Lucas do Rio Verde","Luciara","Marcelândia","Matupá","Mirassol d'Oeste","Nobres","Nortelândia","Nossa Senhora do Livramento","Nova Bandeirantes","Nova Brasilândia","Nova Canaã do Norte","Nova Guarita","Nova Lacerda","Nova Marilândia","Nova Maringá","Nova Monte Verde","Nova Mutum","Nova Nazaré","Nova Olímpia","Nova Santa Helena","Nova Ubiratã","Nova Xavantina","Novo Horizonte do Norte","Novo Mundo","Novo Santo Antônio","Novo São Joaquim","Paranaíta","Paranatinga","Pedra Preta","Peixoto de Azevedo","Planalto da Serra","Poconé","Pontal do Araguaia","Ponte Branca","Pontes e Lacerda","Porto Alegre do Norte","Porto dos Gaúchos","Porto Esperidião","Porto Estrela","Poxoréu","Primavera do Leste","Querência","Reserva do Cabaçal","Ribeirão Cascalheira","Ribeirãozinho","Rio Branco","Rondolândia","Rondonópolis","Rosário Oeste","Salto do Céu","Santa Carmem","Santa Cruz do Xingu","Santa Rita do Trivelato","Santa Terezinha","Santo Afonso","Santo Antônio de Leverger","Santo Antônio do Leste","São Félix do Araguaia","São José do Povo","São José do Rio Claro","São José do Xingu","São José dos Quatro Marcos","São Pedro da Cipa","Sapezal","Serra Nova Dourada","Sinop","Sorriso","Tabaporã","Tangará da Serra","Tapurah","Terra Nova do Norte","Tesouro","Torixoréu","União do Sul","Vale de São Domingos","Várzea Grande","Vera","Vila Bela da Santíssima Trindade","Vila Rica"
];

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

// Interface do painel de varredura massiva em tempo real
interface MassImportProgress {
  totalCities: number;
  currentCityIndex: number;
  currentCityName: string;
  addedCount: number;
  skippedCount: number;
  logs: Array<{ time: string; type: 'success' | 'info' | 'warn' | 'stop'; text: string }>;
  isFinished: boolean;
}

export const ModalImportarGoogleMaps: React.FC<ModalImportarGoogleMapsProps> = ({
  isOpen,
  onClose,
  existingHoteis,
  onImportSuccess
}) => {
  // Estado selecionado (começa sempre com MT - Mato Grosso)
  const [selectedUf, setSelectedUf] = useState<string>('MT');

  // Cidades carregadas do IBGE para o estado selecionado
  const [citiesList, setCitiesList] = useState<string[]>(CIDADES_MATO_GROSSO_142);
  const [isLoadingCities, setIsLoadingCities] = useState<boolean>(false);
  const citiesCache = useRef<Record<string, string[]>>({ 'MT': CIDADES_MATO_GROSSO_142 });

  // Campo de busca aproximada da cidade
  const [cityInput, setCityInput] = useState<string>('Cuiabá');
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState<boolean>(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  // Tipo de hospedagem
  const [tipoFiltro, setTipoFiltro] = useState<string>('hotéis e pousadas');

  // Hotéis vivos do banco para evitar duplicidades
  const [liveDbHoteis, setLiveDbHoteis] = useState<Hotel[]>(existingHoteis || []);

  // Estados de busca individual
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [results, setResults] = useState<GooglePlaceHotel[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Estados de importação e progresso ao vivo
  const [importing, setImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importStatusMessage, setImportStatusMessage] = useState<string>('');
  
  // Painel de Varredura Massiva ao Vivo
  const [massProgress, setMassProgress] = useState<MassImportProgress | null>(null);

  // FLAG DE CANCELAMENTO INSTANTÂNEO: Se fechar ou cancelar, o loop para imediatamente!
  const isCancelledRef = useRef<boolean>(false);

  // Sempre que o modal abre, garante início sempre em Mato Grosso (MT) e busca a lista fresca de hotéis do banco
  useEffect(() => {
    if (isOpen) {
      isCancelledRef.current = false;
      setSelectedUf('MT');
      setCitiesList(CIDADES_MATO_GROSSO_142);
      setCityInput(CIDADES_MATO_GROSSO_142[0] || 'Cuiabá');
      setResults([]);
      setHasSearched(false);
      setSelectedIds(new Set());
      setMassProgress(null);
      setImporting(false);
      setImportProgress(0);
      setImportStatusMessage('');

      hoteisService.getHoteis().then(data => {
        if (data && data.length > 0) {
          setLiveDbHoteis(data);
        }
      });
    } else {
      // Se fechou, interrompe qualquer processo pendente
      isCancelledRef.current = true;
      setImporting(false);
    }
  }, [isOpen]);

  // Carrega todos os municípios do estado via API oficial do IBGE
  useEffect(() => {
    if (!isOpen) return;

    if (selectedUf === 'MT') {
      setCitiesList(CIDADES_MATO_GROSSO_142);
      return;
    }

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

  // Fechar e interromper se pressionar a tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleStopOrClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, importing]);

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

    if (normSearchUf && normSearchUf.length === 2 && normDb.length >= 2) {
      if (!normDb.endsWith(normSearchUf) && !normDb.includes(normSearchUf)) {
        return false;
      }
    }

    if (normSearchCity && normSearchCity.length >= 3) {
      const dbCityPart = normDb.replace(normSearchUf, '');
      if (normDb.includes(normSearchCity) || (dbCityPart && normSearchCity.includes(dbCityPart))) {
        return true;
      }
      return false;
    }

    return false;
  };

  const isHotelAlreadyRegistered = (hotel: GooglePlaceHotel, currentDatabase?: Hotel[]): boolean => {
    const db = currentDatabase || liveDbHoteis;
    if (!db || db.length === 0) return false;

    const normSearchName = normalizeStr(hotel.name);
    const coreSearchName = stripHotelTypeWords(hotel.name);
    const searchPhone = (hotel.phone || '').replace(/\D/g, '');
    const hotelCity = hotel.city || cityInput;
    const hotelUf = hotel.uf || selectedUf;

    return db.some(dbH => {
      const dbPhone = (dbH.managerPhone || '').replace(/\D/g, '');
      const normDbName = normalizeStr(dbH.name);
      const coreDbName = stripHotelTypeWords(dbH.name);
      const sameLocation = isMatchingLocation(hotelCity, hotelUf, dbH.cityUf, dbH.city, dbH.uf);

      // 1. Checagem por Telefone válido
      const isPlaceholderPhone = 
        searchPhone === '81998765432' || 
        searchPhone.startsWith('000000') || 
        searchPhone.length < 10;

      if (!isPlaceholderPhone && dbPhone.length >= 10 && searchPhone === dbPhone) {
        return true;
      }

      // 2. Checagem por Nome na mesma cidade
      if (sameLocation) {
        if (normDbName === normSearchName) {
          return true;
        }
        if (coreSearchName && coreDbName && coreSearchName.length >= 4 && coreSearchName === coreDbName) {
          return true;
        }
      }

      return false;
    });
  };

  // INTERRUPÇÃO IMEDIATA: Função para parar e fechar a importação
  const handleStopOrClose = () => {
    if (importing) {
      isCancelledRef.current = true;
      setImporting(false);
      setImportStatusMessage('Importação interrompida pelo usuário.');
    }
    onClose();
  };

  // Apenas parar a importação mantendo a tela aberta para ver o resumo
  const handleStopOnly = () => {
    if (importing) {
      isCancelledRef.current = true;
      setImporting(false);
      setImportStatusMessage('Varredura pausada.');
    }
  };

  // INÍCIO DA VARREDURA DE TODAS AS CIDADES VISÍVEL NA TELA
  const handleStartMassImport = async () => {
    const citiesToProcess = selectedUf === 'MT' ? CIDADES_MATO_GROSSO_142 : (citiesList.length > 0 ? citiesList : ['Capital']);
    
    setIsCityDropdownOpen(false);
    isCancelledRef.current = false;
    setImporting(true);
    setHasSearched(true);
    setResults([]);

    const getNow = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Busca hotéis atualizados do banco para deduplicação precisa
    const freshDb = await hoteisService.getHoteis();
    const currentDb: Hotel[] = freshDb && freshDb.length > 0 ? [...freshDb] : [...liveDbHoteis];
    setLiveDbHoteis(currentDb);

    setMassProgress({
      totalCities: citiesToProcess.length,
      currentCityIndex: 0,
      currentCityName: citiesToProcess[0] || '',
      addedCount: 0,
      skippedCount: 0,
      logs: [{
        time: getNow(),
        type: 'info',
        text: `Iniciando varredura em tempo real nas ${citiesToProcess.length} cidades de ${currentEstado.name} (${selectedUf})...`
      }],
      isFinished: false
    });

    let totalAdded = 0;
    let totalSkipped = 0;

    for (let i = 0; i < citiesToProcess.length; i++) {
      if (isCancelledRef.current) {
        console.warn('Importação massiva cancelada pelo usuário.');
        break;
      }

      const cidade = citiesToProcess[i];

      setMassProgress(prev => prev ? ({
        ...prev,
        currentCityIndex: i + 1,
        currentCityName: cidade,
        logs: [
          { time: getNow(), type: 'info', text: `📍 [${i + 1}/${citiesToProcess.length}] Buscando em ${cidade}...` },
          ...prev.logs.slice(0, 30)
        ]
      }) : null);

      try {
        const places = await googlePlacesService.searchHotelsByCity(selectedUf, cidade, tipoFiltro, 15);

        if (isCancelledRef.current) break;

        const validPlaces = (places || []).filter(p => p && p.name);

        if (validPlaces.length === 0) {
          setMassProgress(prev => prev ? ({
            ...prev,
            logs: [
              { time: getNow(), type: 'info', text: `ℹ️ [${cidade}] Nenhum estabelecimento retornado.` },
              ...prev.logs.slice(0, 30)
            ]
          }) : null);
        } else {
          for (const place of validPlaces) {
            if (isCancelledRef.current) break;

            const already = isHotelAlreadyRegistered(place, currentDb);
            if (already) {
              totalSkipped++;
              setMassProgress(prev => prev ? ({
                ...prev,
                skippedCount: totalSkipped,
                logs: [
                  { time: getNow(), type: 'info', text: `🛡️ [${cidade}] ${place.name} já cadastrado (ignorado).` },
                  ...prev.logs.slice(0, 30)
                ]
              }) : null);
              continue;
            }

            // Inserir hotel novo
            const payload: Partial<Hotel> = {
              name: place.name,
              razaoSocial: place.name,
              category: place.category,
              cnpj: generateUniqueCnpj(),
              city: place.city || cidade,
              uf: (place.uf || selectedUf).toUpperCase(),
              cityUf: `${place.city || cidade}/${(place.uf || selectedUf).toUpperCase()}`,
              neighborhood: place.neighborhood || 'Centro',
              street: place.street || place.formattedAddress?.split(',')[0] || 'Centro',
              cep: place.cep || '',
              managerPhone: place.phone || '',
              managerName: place.name ? `Recepção ${place.name}` : 'Recepção / Gerência',
              plan: 'Grátis (Google Maps)',
              capacity: 0,
              capacityUnit: 'quartos',
              whatsappInstances: 0,
              status: 'ativo',
              imageUrl: place.imageUrl,
              link: place.link,
              notes: `Importado via Google Places (${cidade}) em ${new Date().toLocaleDateString('pt-BR')} [AVALIACOES: nota=${place.rating || 4.8}, total=${place.reviewsCount || 0}]`,
              isImportedFromGoogle: true
            };

            const res = await hoteisService.createHotel(payload);
            if (res.success) {
              totalAdded++;
              currentDb.push({
                ...payload,
                id: res.id || generateUniqueCnpj()
              } as Hotel);
              setMassProgress(prev => prev ? ({
                ...prev,
                addedCount: totalAdded,
                logs: [
                  { time: getNow(), type: 'success', text: `✅ [${cidade}] ${place.name} gravado no catálogo!` },
                  ...prev.logs.slice(0, 30)
                ]
              }) : null);
            }
          }
        }
      } catch (err: any) {
        console.warn(`Erro na cidade ${cidade}:`, err);
        setMassProgress(prev => prev ? ({
          ...prev,
          logs: [
            { time: getNow(), type: 'warn', text: `⚠️ Falha em ${cidade}: ${err?.message || 'Erro na consulta'}` },
            ...prev.logs.slice(0, 30)
          ]
        }) : null);
      }

      // Pequena pausa para fluidez da renderização na tela
      await new Promise(r => setTimeout(r, 450));
    }

    const wasCancelled = isCancelledRef.current;
    setImporting(false);

    setMassProgress(prev => prev ? ({
      ...prev,
      isFinished: true,
      logs: [
        {
          time: getNow(),
          type: wasCancelled ? 'stop' : 'success',
          text: wasCancelled
            ? `⏹ Varredura interrompida pelo usuário! ${totalAdded} hotéis foram gravados antes da pausa.`
            : `🎉 Varredura completa! ${totalAdded} novos hotéis foram adicionados com sucesso.`
        },
        ...prev.logs.slice(0, 30)
      ]
    }) : null);

    const updated = await hoteisService.getHoteis();
    if (updated) setLiveDbHoteis(updated);

    if (totalAdded > 0) {
      onImportSuccess(totalAdded);
    }
  };

  // BUSCA INDIVIDUAL POR CIDADE
  const handleSearch = async () => {
    const cleanCity = cityInput.trim();
    if (!cleanCity) {
      alert('Por favor, informe ou selecione a Cidade ou Estado.');
      return;
    }

    setIsCityDropdownOpen(false);

    // Se escolheu Todas as Cidades: inicia a Varredura Massiva 100% VISÍVEL NA TELA!
    if (isAllCitiesMode) {
      handleStartMassImport();
      return;
    }

    // Busca individual da cidade selecionada
    setMassProgress(null);
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

      const items = await googlePlacesService.searchHotelsByCity(selectedUf, cleanCity, tipoFiltro, 20);
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

  // IMPORTAÇÃO DE HOTÉIS SELECIONADOS NA BUSCA INDIVIDUAL
  const handleImport = async () => {
    const toImport = results.filter(r => selectedIds.has(r.placeId) && !isHotelAlreadyRegistered(r));
    if (toImport.length === 0) {
      alert('Nenhum hotel elegível selecionado para importação.');
      return;
    }

    isCancelledRef.current = false;
    setImporting(true);
    setImportProgress(0);
    let successCount = 0;

    for (let i = 0; i < toImport.length; i++) {
      if (isCancelledRef.current) {
        console.warn('Importação cancelada pelo usuário.');
        break;
      }

      const hotel = toImport[i];
      setImportStatusMessage(`Importando (${i + 1}/${toImport.length}): ${hotel.name}`);

      try {
        if (isHotelAlreadyRegistered(hotel)) {
          continue;
        }

        const finalCity = hotel.city || cityInput.trim();
        const finalUf = (hotel.uf || selectedUf).toUpperCase();

        const payload: Partial<Hotel> = {
          name: hotel.name,
          razaoSocial: hotel.name,
          category: hotel.category,
          cnpj: generateUniqueCnpj(),
          city: finalCity,
          uf: finalUf,
          cityUf: `${finalCity}/${finalUf}`,
          neighborhood: hotel.neighborhood || 'Centro',
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
          notes: `Importado via Google Places em ${new Date().toLocaleDateString('pt-BR')} [AVALIACOES: nota=${hotel.rating || 4.8}, total=${hotel.reviewsCount || 0}]`,
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

    if (successCount > 0) {
      onImportSuccess(successCount);
    }

    setResults(prev => prev.filter(r => !selectedIds.has(r.placeId)));
    setSelectedIds(new Set());
  };

  const eligibleCount = useMemo(() => {
    return results.filter(r => !isHotelAlreadyRegistered(r)).length;
  }, [results, liveDbHoteis]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Cabeçalho */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-emerald-950 via-[#003400] to-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <span className="material-symbols-outlined text-emerald-300 text-2xl">travel_explore</span>
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Importar Hotéis & Pousadas</h2>
              <p className="text-xs text-emerald-200/80">Busca em tempo real com fotos, telefone e catálogo anti-duplicidade</p>
            </div>
          </div>
          
          {/* Botão X: Para a importação imediatamente e fecha */}
          <button
            onClick={handleStopOrClose}
            title={importing ? "Parar importação e fechar" : "Fechar janela"}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Barra de Filtros (Apenas visível quando NÃO estiver no meio da varredura massiva) */}
        {!massProgress && (
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
                      <button
                        type="button"
                        onClick={() => {
                          setCityInput(allCitiesOption);
                          setIsCityDropdownOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-[#003400] bg-emerald-50/80 hover:bg-emerald-100/80 border-b border-emerald-200 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-emerald-700">travel_explore</span>
                          <span className="font-extrabold">{allCitiesOption}</span>
                        </div>
                        <span className="text-[10px] bg-emerald-700 text-white px-2 py-0.5 rounded font-bold">
                          Varredura Completa
                        </span>
                      </button>
                    )}

                    {/* Lista das cidades normais filtradas */}
                    {filteredCities.map((city) => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => {
                          setCityInput(city);
                          setIsCityDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs transition-colors hover:bg-emerald-50 cursor-pointer flex items-center justify-between ${
                          cityInput === city ? 'bg-emerald-50/50 font-bold text-emerald-900' : 'text-slate-700'
                        }`}
                      >
                        <span>{city}</span>
                        {cityInput === city && (
                          <span className="material-symbols-outlined text-sm text-emerald-700">check</span>
                        )}
                      </button>
                    ))}

                    {filteredCities.length === 0 && (
                      <div className="px-3.5 py-3 text-xs text-slate-400 text-center">
                        Nenhuma cidade encontrada com esse nome
                      </div>
                    )}
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

              {/* 4. Botão Buscar / Iniciar */}
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
                    <span className="material-symbols-outlined text-xl font-bold">
                      {isAllCitiesMode ? 'play_arrow' : 'search'}
                    </span>
                  )}
                  <span>
                    {loadingSearch 
                      ? 'Consultando...' 
                      : (isAllCitiesMode ? 'Iniciar Varredura' : 'Buscar')
                    }
                  </span>
                </button>
              </div>

            </div>

            {/* Banner explicativo quando estiver no modo "Todas as Cidades" */}
            {isAllCitiesMode && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-950 animate-fadeIn">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-700 text-lg">travel_explore</span>
                  <div>
                    <p className="font-extrabold text-emerald-950">Varredura das Cidades de {currentEstado.name} (100% Visível)</p>
                    <p className="text-[11px] text-emerald-800">
                      O processo roda diretamente na sua tela, mostrando as cidades, os hotéis gravados e as duplicatas ignoradas. Se você fechar a janela, a importação <strong>para imediatamente</strong>.
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-700 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider shrink-0 hidden sm:inline-block">
                  Ao Vivo na Tela
                </span>
              </div>
            )}

          </div>
        )}

        {/* Área Central de Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/60">

          {/* PAINEL DE VARREDURA MASSIVA AO VIVO NA TELA */}
          {massProgress && (
            <div className="max-w-4xl mx-auto space-y-5 animate-fadeIn">
              
              {/* Card de Status do Cabeçalho */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md ${
                    importing ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-800 text-emerald-400'
                  }`}>
                    <span className={`material-symbols-outlined text-3xl ${importing ? 'animate-spin' : ''}`}>
                      {importing ? 'sync' : (massProgress.isFinished ? 'task_alt' : 'pause_circle')}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        importing ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'
                      }`}>
                        {importing ? 'Varredura em Andamento' : (massProgress.isFinished ? 'Varredura Finalizada' : 'Pausado')}
                      </span>
                      <span className="text-xs text-slate-400">
                        {selectedUf} - {currentEstado.name}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mt-0.5">
                      {importing 
                        ? `Processando: ${massProgress.currentCityName}` 
                        : (massProgress.isFinished ? 'Varredura Concluída' : 'Importação Interrompida')}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Cidade {massProgress.currentCityIndex} de {massProgress.totalCities} • Tela 100% visível
                    </p>
                  </div>
                </div>

                {/* Botões de Ação Imediata */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {importing ? (
                    <>
                      <button
                        type="button"
                        onClick={handleStopOnly}
                        className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">pause</span>
                        Pausar
                      </button>

                      <button
                        type="button"
                        onClick={handleStopOrClose}
                        className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">stop_circle</span>
                        Parar e Fechar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMassProgress(null)}
                      className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-950 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_back</span>
                      Nova Pesquisa
                    </button>
                  )}
                </div>
              </div>

              {/* Barra de Progresso Geral */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-2">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-emerald-700 text-sm">location_city</span>
                    Progresso das Cidades ({massProgress.currentCityIndex} / {massProgress.totalCities})
                  </span>
                  <span className="text-emerald-700 font-black text-sm">
                    {Math.round((massProgress.currentCityIndex / massProgress.totalCities) * 100)}%
                  </span>
                </div>
                <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                  <div 
                    className="h-full bg-gradient-to-r from-[#003400] via-emerald-600 to-[#B9CC01] rounded-full transition-all duration-300 shadow-inner"
                    style={{ width: `${Math.round((massProgress.currentCityIndex / massProgress.totalCities) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Grid com os 3 Contadores */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                    <span className="material-symbols-outlined text-xl">map</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Cidades Processadas</span>
                    <span className="text-xl font-black text-slate-800">{massProgress.currentCityIndex} / {massProgress.totalCities}</span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-300">
                    <span className="material-symbols-outlined text-xl">hotel</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Hotéis Novos Gravados</span>
                    <span className="text-xl font-black text-emerald-900">{massProgress.addedCount}</span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                    <span className="material-symbols-outlined text-xl">verified</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Duplicados Evitados</span>
                    <span className="text-xl font-black text-slate-700">{massProgress.skippedCount}</span>
                  </div>
                </div>

              </div>

              {/* Terminal de Logs ao Vivo */}
              <div className="bg-slate-900 rounded-xl p-4 shadow-md border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-mono font-bold text-slate-300">Registro de Atividades ao Vivo</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {massProgress.logs.length} eventos
                  </span>
                </div>

                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-2 font-mono text-xs">
                  {massProgress.logs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-slate-500 text-[10px] shrink-0 pt-0.5">{log.time}</span>
                      <span className={
                        log.type === 'success' ? 'text-emerald-400 font-semibold' :
                        log.type === 'warn' ? 'text-amber-400' :
                        log.type === 'stop' ? 'text-red-400 font-bold' :
                        'text-slate-300'
                      }>
                        {log.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aviso de segurança e encerramento */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                💡 <strong>Controle total:</strong> A importação só continua enquanto esta janela estiver aberta. Ao clicar em <strong>Fechar</strong> ou <strong>Parar</strong>, a execução é interrompida na hora sem deixar processos fantasmas.
              </div>

            </div>
          )}

          {/* Loading da busca individual */}
          {loadingSearch && !massProgress && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full border-4 border-emerald-200 border-t-emerald-700 animate-spin mb-4" />
              <p className="text-base font-bold text-slate-800">Consultando o Google Maps...</p>
              <p className="text-xs text-slate-500 mt-1">
                Buscando estabelecimentos em {cityInput}, {selectedUf}
              </p>
            </div>
          )}

          {/* Estado inicial quando ainda não buscou */}
          {!loadingSearch && !massProgress && !hasSearched && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-3xl text-slate-400">pin_drop</span>
              </div>
              <h3 className="text-base font-bold text-slate-700">Selecione o Estado e a Cidade acima</h3>
              <p className="text-xs text-slate-500 max-w-md mt-1">
                Digite o nome da cidade para buscar ou escolha <strong>{allCitiesOption}</strong> para acompanhar a varredura completa ao vivo nesta tela.
              </p>
            </div>
          )}

          {/* Nenhum resultado */}
          {!loadingSearch && !massProgress && hasSearched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <span className="material-symbols-outlined text-4xl text-amber-500 mb-2">sentiment_dissatisfied</span>
              <h3 className="text-base font-bold text-slate-800">Nenhum hotel encontrado nesta localidade</h3>
              <p className="text-xs text-slate-500 mt-1">Tente ajustar o nome da cidade ou escolher outro filtro.</p>
            </div>
          )}

          {/* Resultados da busca individual por cidade */}
          {!loadingSearch && !massProgress && results.length > 0 && (
            <div>
              {/* Barra de Seleção em Lote */}
              <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-700">
                    {results.length} hotéis encontrados em {cityInput}, {selectedUf}
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

        {/* Rodapé padrão (Apenas visível para a busca individual) */}
        {!massProgress && (
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
                onClick={handleStopOrClose}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                {importing ? 'Parar e Fechar' : 'Fechar'}
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
        )}

      </div>
    </div>
  );
};
