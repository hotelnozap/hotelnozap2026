import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Hotel } from './CadastroHoteis';
import { Partner } from './ListagemParceiros';
import { fetchAddressByCep } from '../utils/viacep';
import { uploadImageToStorage } from '../services/storageService';
import {
  maskCep,
  maskCnpj,
  maskCpf,
  maskPhone,
  isValidCpf,
  isValidCnpj,
  getCpfValidationStatus,
  getCnpjValidationStatus
} from '../utils/masks';
import { hoteisService, currentHotelService, resolveHotelDbId, planosService, parceirosService, usuariosService } from '../services/supabaseService';
import { creditosService, InfoCreditoHotel } from '../services/creditosService';
import { supabase } from '../lib/supabase';


export interface FormHotelProps {
  hotelToEdit?: Hotel | null;
  preselectedPartner?: Partner | null;
  isProfileView?: boolean;
  isAdmin?: boolean;
  userRole?: string;
  onBack?: () => void;
  onSaveSuccess?: () => void;
}

export const isHotelGoogleMaps = (hotel?: Partial<Hotel> | null): boolean => {
  if (!hotel) return false;
  if ((hotel as any).isImportedFromGoogle) return true;
  const planLower = (hotel.plan || '').toLowerCase();
  const notesLower = (hotel.notes || '').toLowerCase();
  const img = (hotel.imageUrl || '').toLowerCase();
  return (
    planLower.includes('google') ||
    planLower.includes('maps') ||
    notesLower.includes('google') ||
    notesLower.includes('places') ||
    img.includes('places.googleapis.com')
  );
};

export const googleMapsPlanFallback = {
  id: 'gratis-google-maps',
  name: 'Grátis (Google Maps)',
  tag: 'Google Maps',
  isFeatured: true,
  description: 'Plano gratuito de entrada para estabelecimentos com origem no Google Maps / Places',
  periodicity: 'Vitalício',
  basePrice: 0.00,
  pricePeriodText: 'Grátis',
  priceSubtitle: 'Acesso sem custo de mensalidade / Sem cobrança de créditos',
  roomLimit: 0,
  roomLimitText: 'Capacidade livre (sem quartos cadastrados)',
  whatsappConnections: 1,
  whatsappConnectionsText: '1 Conexão WhatsApp',
  status: 'Ativo',
  features: [
    'Origem Google Maps',
    'Regras de Catálogo do Google Maps',
    'Sem cobrança de créditos SaaS',
    'Página pública do hotel liberada',
    'Atendimento direto via WhatsApp'
  ]
};

export const FormHotel: React.FC<FormHotelProps> = ({
  hotelToEdit,
  preselectedPartner,
  isProfileView = false,
  isAdmin = true,
  userRole,
  onBack,
  onSaveSuccess
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUserAdmin = isAdmin !== undefined ? isAdmin : (userRole ? userRole.toLowerCase().includes('admin') : true);

  // States
  const [status, setStatus] = useState<'ativo' | 'inativo'>(hotelToEdit?.status === 'bloqueado' ? 'inativo' : 'ativo');
  const [isGoogleMaps, setIsGoogleMaps] = useState<boolean>(() => isHotelGoogleMaps(hotelToEdit));
  const [logoPreview, setLogoPreview] = useState<string | null>(hotelToEdit?.imageUrl || null);
  const [infoCreditosState, setInfoCreditosState] = useState<InfoCreditoHotel | null>(() => {
    return hotelToEdit ? creditosService.calcularInfoCreditos(hotelToEdit) : null;
  });

  useEffect(() => {
    if (hotelToEdit) {
      setInfoCreditosState(creditosService.calcularInfoCreditos(hotelToEdit));
    }
  }, [hotelToEdit]);

  // Helper para gerar link limpo sem hífens conforme padrão /hoteis/nomedohotel
  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  // Seção 1: Identidade & Propriedade
  const [razaoSocial, setRazaoSocial] = useState(hotelToEdit?.razaoSocial || hotelToEdit?.name || '');
  const [nomeFantasia, setNomeFantasia] = useState(hotelToEdit?.name || '');
  
  const initialLink = hotelToEdit?.link 
    ? hotelToEdit.link.replace(/-/g, '') 
    : '';
  const [link, setLink] = useState(initialLink);
  const [isLinkManuallyEdited, setIsLinkManuallyEdited] = useState(false);

  const handleNomeFantasiaChange = (val: string) => {
    setNomeFantasia(val);
    if (!isLinkManuallyEdited) {
      const slug = slugify(val);
      setLink(slug ? `/hoteis/${slug}` : '');
    }
  };

  const [cnpj, setCnpj] = useState(hotelToEdit?.cnpj || '');
  const [category, setCategory] = useState(hotelToEdit?.category || 'Pousada Boutique / Charme');
  const [stars, setStars] = useState('4');
  const [capacity, setCapacity] = useState<number | string>(hotelToEdit?.capacity !== undefined ? hotelToEdit.capacity : '');
  const [phone, setPhone] = useState(hotelToEdit?.managerPhone || '');
  
  // Endereço
  const [cep, setCep] = useState(hotelToEdit?.cep || '');
  const [street, setStreet] = useState(hotelToEdit?.street || '');
  const [streetNumber, setStreetNumber] = useState<string>((hotelToEdit as any)?.streetNumber || '');
  const [neighborhood, setNeighborhood] = useState(hotelToEdit?.neighborhood || '');
  const [city, setCity] = useState(hotelToEdit?.city || (hotelToEdit?.cityUf ? hotelToEdit.cityUf.split('/')[0].trim() : ''));
  const [uf, setUf] = useState(hotelToEdit?.uf || (hotelToEdit?.cityUf ? hotelToEdit.cityUf.split('/')[1]?.trim() || '' : ''));

  // Redes Sociais do Hotel (Opcionais)
  const [instagram, setInstagram] = useState(hotelToEdit?.instagram || '');
  const [facebook, setFacebook] = useState(hotelToEdit?.facebook || '');
  const [tiktok, setTiktok] = useState(hotelToEdit?.tiktok || '');
  const [whatsappSocial, setWhatsappSocial] = useState(hotelToEdit?.whatsapp || '');

  // ViaCEP integration state
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  const handleSearchViaCep = async (rawCep: string) => {
    const clean = rawCep.replace(/\D/g, '');
    if (clean.length === 8) {
      setIsLoadingCep(true);
      setCepError(null);
      const data = await fetchAddressByCep(clean);
      setIsLoadingCep(false);
      if (data && !data.erro) {
        if (data.logradouro) setStreet(data.logradouro);
        if (data.bairro) setNeighborhood(data.bairro);
        if (data.localidade) setCity(data.localidade);
        if (data.uf) setUf(data.uf.toUpperCase());
      } else {
        setCepError('CEP não encontrado na base do ViaCEP.');
      }
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCep(e.target.value);
    setCep(masked);
    setCepError(null);
    if (masked.replace(/\D/g, '').length === 8) {
      handleSearchViaCep(masked);
    }
  };

  // Seção 2: Sistema de Cobrança por Créditos (Modelo 1)
  const [selectedPlan, setSelectedPlan] = useState<string>(hotelToEdit?.plan || '');
  const [dataCompra, setDataCompra] = useState<string>(() => {
    return infoCreditosState?.dataCompra || new Date().toISOString().split('T')[0];
  });
  // Parceiro padrão: "Hotel no Zap" (HOTELNOZAP) quando nenhum parceiro for passado via link.
  // Quando vier de link de parceiro, fica fixado no parceiro indicador sem permitir troca.
  const PARCEIRO_PADRAO_ID = 'HOTELNOZAP';
  const [partnerRef, setPartnerRef] = useState(
    preselectedPartner?.id || preselectedPartner?.coupon || PARCEIRO_PADRAO_ID
  );

  const [planos, setPlanos] = useState<any[]>([]);
  const [isLoadingPlanos, setIsLoadingPlanos] = useState<boolean>(true);
  const [partnersList, setPartnersList] = useState<Partner[]>([]);

  // Efeito para carregar planos e parceiros do Supabase em tempo real
  useEffect(() => {
    let isSubscribed = true;

    const loadPlanosAndPartners = async () => {
      try {
        const [planosData, partnersData] = await Promise.all([
          planosService.getPlanos().catch(() => []),
          parceirosService.getParceiros().catch(() => [])
        ]);
        if (isSubscribed) {
          const list = planosData || [];
          setPlanos(list);
          setPartnersList(partnersData || []);
          setIsLoadingPlanos(false);

          // Se não há plano selecionado ainda e temos planos ativos disponíveis, seleciona o padrão ativo
          setSelectedPlan(prev => {
            if (isGoogleMaps) {
              return 'Grátis (Google Maps)';
            }
            // No cadastro de novos hotéis, o plano grátis NÃO fica disponível para seleção a não ser que seja Google Maps
            const activeList = list.filter((p: any) => {
              if ((p.status || '').toLowerCase() === 'inativo') return false;
              if (!hotelToEdit && !isGoogleMaps) {
                const pName = (p.name || '').toLowerCase();
                if (p.basePrice === 0 || pName.includes('grátis') || pName.includes('gratis') || pName.includes('google maps')) {
                  return false;
                }
              }
              return true;
            });
            if (prev) {
              const matched = activeList.find((p: any) => 
                p.name?.toLowerCase() === prev.toLowerCase() || 
                String(p.id) === String(prev)
              );
              if (matched) return matched.name;
              // Mapeamento inteligente de planos legados para os pacotes do Modelo 1
              if (prev.toLowerCase().includes('prof')) {
                const p3 = activeList.find((p: any) => p.name.includes('Trimestre') || p.name.includes('3 Créditos'));
                if (p3) return p3.name;
              }
              if (prev.toLowerCase().includes('maps') || prev.toLowerCase().includes('grátis') || prev.toLowerCase().includes('gratis')) {
                const pg = activeList.find((p: any) => p.name.includes('Grátis') || p.name.includes('Google Maps'));
                if (pg) return pg.name;
              }
              if (prev.toLowerCase().includes('free') || prev.toLowerCase().includes('start')) {
                const p1 = activeList.find((p: any) => p.name.includes('1 Crédito'));
                if (p1) return p1.name;
              }
              if (prev.toLowerCase().includes('anual')) {
                const p12 = activeList.find((p: any) => p.name.includes('12 Créditos'));
                if (p12) return p12.name;
              }
              return activeList[0]?.name || prev;
            }
            if (activeList.length > 0) {
              const featured = activeList.find((p: any) => p.isFeatured) || activeList[0];
              return featured.name;
            }
            return '1 Crédito (Adesão / Teste)';
          });
        }
      } catch (err) {
        console.error('Erro ao carregar planos e parceiros do Supabase:', err);
        if (isSubscribed) setIsLoadingPlanos(false);
      }
    };

    loadPlanosAndPartners();

    const unsubPlanos = planosService.subscribePlanos
      ? planosService.subscribePlanos(() => {
          planosService.getPlanos().then(p => {
            if (isSubscribed && p) setPlanos(p);
          });
        })
      : null;

    const unsubParceiros = parceirosService.subscribeParceiros
      ? parceirosService.subscribeParceiros(() => {
          parceirosService.getParceiros().then(pr => {
            if (isSubscribed && pr) setPartnersList(pr);
          });
        })
      : null;

    return () => {
      isSubscribed = false;
      if (typeof unsubPlanos === 'function') (unsubPlanos as () => void)();
      if (typeof unsubParceiros === 'function') (unsubParceiros as () => void)();
    };
  }, []);

  const isPlanSelected = (plano: any) => {
    if (!selectedPlan) return false;
    const current = selectedPlan.trim().toLowerCase();
    const pName = (plano.name || '').trim().toLowerCase();
    const pId = String(plano.id || '').trim().toLowerCase();
    return current === pName || current === pId || (pName.length > 3 && current.includes(pName)) || (current.length > 3 && pName.includes(current));
  };

  const handleSelectPlan = (plano: any) => {
    setSelectedPlan(plano.name);
    if (plano.roomLimit !== undefined && plano.roomLimit !== null) {
      setCapacity(plano.roomLimit);
    }
  };

  const handleGoogleMapsChange = (checked: boolean) => {
    setIsGoogleMaps(checked);
    if (checked) {
      setSelectedPlan('Grátis (Google Maps)');
      if (capacity === '' || capacity === 10 || capacity === 15) {
        setCapacity(0);
      }
      setNotes(prev => {
        if (!prev || (!prev.toLowerCase().includes('google') && !prev.toLowerCase().includes('places'))) {
          return prev ? `${prev} | Cadastro manual - Origem Google Maps` : `Cadastro manual - Origem Google Maps (${new Date().toLocaleDateString('pt-BR')})`;
        }
        return prev;
      });
      showToast('Regras do Google Maps aplicadas: Plano Grátis (Google Maps) ativado.');
    } else {
      const commercialPlan = planos.find(p => {
        const pName = (p.name || '').toLowerCase();
        return (p.status || '').toLowerCase() !== 'inativo' && p.basePrice > 0 && !pName.includes('google') && !pName.includes('maps');
      }) || planos[0];
      if (commercialPlan) {
        setSelectedPlan(commercialPlan.name);
        if (commercialPlan.roomLimit) setCapacity(commercialPlan.roomLimit);
      }
      setNotes(prev => 
        prev
          .replace(/\s*\|\s*Cadastro manual - Origem Google Maps/g, '')
          .replace(/Cadastro manual - Origem Google Maps(\s*\([^)]*\))?/g, '')
          .trim()
      );
      showToast('Regras do Google Maps desativadas. Plano comercial restaurado.');
    }
  };

  // Preenchimento automático da capacidade quando:
  // 1) Planos carregarem e já houver selectedPlan definido (modo edição)
  // 2) selectedPlan mudar e não houver plano selecionado visualmente ainda (fallback)
  useEffect(() => {
    if (!selectedPlan || planos.length === 0) return;
    if (hotelToEdit) return; // Não sobrescrever quartos de hotel existente ao editar
    if (isGoogleMaps) return; // Google maps não precisa de capacidade automática
    const planoObj = planos.find(p => isPlanSelected(p)) || planos.find(p => p.name?.toLowerCase() === selectedPlan.toLowerCase());
    if (planoObj && planoObj.roomLimit !== undefined && planoObj.roomLimit !== null) {
      if (capacity === '' || capacity === undefined) {
        setCapacity(planoObj.roomLimit);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan, planos.length, hotelToEdit, isGoogleMaps]);

  // Filtrar apenas planos ativos para seleção (no cadastro de novo hotel, o plano grátis do Google Maps não fica disponível a não ser que isGoogleMaps esteja ativo)
  const planosAtivos = useMemo(() => {
    let result = planos.filter(p => {
      if ((p.status || '').toLowerCase() === 'inativo') return false;
      if (!hotelToEdit && !isGoogleMaps) {
        const pName = (p.name || '').toLowerCase();
        if (p.basePrice === 0 || pName.includes('grátis') || pName.includes('gratis') || pName.includes('google maps')) {
          return false;
        }
      }
      return true;
    });

    if (isGoogleMaps) {
      const hasGoogle = result.some(p => {
        const pName = (p.name || '').toLowerCase();
        return pName.includes('google') || pName.includes('maps');
      });
      if (!hasGoogle) {
        result = [googleMapsPlanFallback, ...result];
      }
    }

    return result;
  }, [planos, isGoogleMaps, hotelToEdit]);

  // Quantidade de dias totais (dias base + bônus) com base no plano selecionado
  const pacoteDias = useMemo(() => {
    if (isGoogleMaps) return 3650;
    const planoObj = planos.find(p => isPlanSelected(p)) || planos.find(p => p.name?.toLowerCase() === selectedPlan.toLowerCase());
    if (planoObj) {
      if (planoObj.name.includes('1 Crédito')) return 45;
      if (planoObj.name.includes('2 Créditos')) return 75;
      if (planoObj.name.includes('3 Créditos')) return 120;
      if (planoObj.name.includes('6 Créditos')) return 225;
      if (planoObj.name.includes('12 Créditos')) return 425;
      if (planoObj.name.includes('Grátis') || planoObj.name.includes('Google Maps')) return 3650;
    }
    return 45; // Padrão degustação 45 dias
  }, [selectedPlan, planos, isGoogleMaps]);

  // Cálculo inteligente da expiração e dias restantes a partir da data da compra
  const previsaoCreditos = useMemo(() => {
    return creditosService.calcularExpiracaoPorCompra(dataCompra, pacoteDias);
  }, [dataCompra, pacoteDias]);

  // Seção 3: Proprietário / Responsável
  const [managerName, setManagerName] = useState(hotelToEdit?.managerName || '');
  const [managerCpf, setManagerCpf] = useState(hotelToEdit?.managerCpf || '');
  const [managerWhatsapp, setManagerWhatsapp] = useState(hotelToEdit?.managerPhone || '');
  const [managerEmail, setManagerEmail] = useState(hotelToEdit?.managerEmail || '');
  const [managerRole, setManagerRole] = useState(hotelToEdit?.managerRole || '');

  // Validação em tempo real de CPF e CNPJ
  const managerCpfValidation = useMemo(() => getCpfValidationStatus(managerCpf), [managerCpf]);
  const cnpjValidation = useMemo(() => getCnpjValidationStatus(cnpj), [cnpj]);

  // Seção 4: Login Master
  const isEditing = Boolean(hotelToEdit || isProfileView);
  const [loginEmail, setLoginEmail] = useState(hotelToEdit?.loginEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Medidor de Força da Senha (score 0-4 | Fraca, Média, Forte, Extra Forte)
  const passwordStrength = useMemo(() => {
    const pwd = password || '';
    if (!pwd.trim()) {
      return { score: 0, percent: 0, label: '', barColor: 'bg-slate-200', textColor: 'text-slate-400' };
    }
    let score = 0;
    if (pwd.length >= 8) score++;
    else if (pwd.length >= 6) score += 0;
    if (/[A-ZÀ-Ú]/.test(pwd)) score++;
    if (/[a-zà-ú]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-zÀ-ú0-9\s]/.test(pwd)) score++;

    let percent = 0;
    let label = '';
    let barColor = '';
    let textColor = '';

    if (score <= 2) {
      percent = 33;
      label = 'Fraca';
      barColor = 'bg-rose-500';
      textColor = 'text-rose-600';
    } else if (score === 3 || score === 4) {
      percent = 66;
      label = 'Média';
      barColor = 'bg-amber-500';
      textColor = 'text-amber-600';
    } else if (score >= 5) {
      percent = 100;
      label = 'Forte';
      barColor = 'bg-emerald-500';
      textColor = 'text-emerald-600';
    }
    if (pwd.length < 6 && pwd.trim() !== '') {
      percent = 20;
      label = 'Muito curta';
      barColor = 'bg-rose-500';
      textColor = 'text-rose-600';
    }
    return { score, percent, label, barColor, textColor };
  }, [password]);

  // Seção 5: Instância WhatsApp & Agente IA
  const [agenteIa, setAgenteIa] = useState<string>(() => {
    return hotelToEdit?.agenteIa || 
      (hotelToEdit?.id && typeof window !== 'undefined' ? localStorage.getItem(`hotel_agente_ia_${hotelToEdit.id}`) : '') || 
      '';
  });
  const [instanceName, setInstanceName] = useState(hotelToEdit?.instanceName || '');
  const [apiUrl, setApiUrl] = useState(hotelToEdit?.apiUrl || '');
  const [apiKey, setApiKey] = useState(hotelToEdit?.apiKey || '');

  // Seção 6: Observações
  const [notes, setNotes] = useState(hotelToEdit?.notes || '');

  // Toast Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const tempUrl = URL.createObjectURL(file);
      setLogoPreview(tempUrl);
      showToast('Enviando logo do hotel para o bucket hotelnozap...');

      const uploadedUrl = await uploadImageToStorage(file, 'hoteis');
      if (uploadedUrl) {
        setLogoPreview(uploadedUrl);
        showToast('Logo do hotel salvo no bucket hotelnozap!');
      } else {
        showToast('Logo selecionado com sucesso!');
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copiado para a área de transferência!');
  };

  useEffect(() => {
    let isMounted = true;

    const loadHotelData = async () => {
      // Quando for cadastro de novo hotel, limpa TODOS os campos para garantir que nada venha preenchido/mockado
      if (!isProfileView && !hotelToEdit) {
        setNomeFantasia('');
        setRazaoSocial('');
        setCnpj('');
        setCategory('Pousada Boutique / Charme');
        setStars('4');
        setCapacity('');
        setPhone('');
        setCep('');
        setStreet('');
        setStreetNumber('');
        setNeighborhood('');
        setCity('');
        setUf('');
        setLogoPreview(null);
        setManagerName('');
        setManagerCpf('');
        setManagerWhatsapp('');
        setManagerEmail('');
        setManagerRole('');
        setLoginEmail('');
        setInstanceName('');
        setApiUrl('');
        setApiKey('');
        setNotes('');
        setLink('');
        setInstagram('');
        setFacebook('');
        setTiktok('');
        setWhatsappSocial('');
        setPassword('');
        setConfirmPassword('');
        setStatus('ativo');
        setIsGoogleMaps(false);
        setDataCompra(new Date().toISOString().split('T')[0]);
        return;
      }

      let targetHotel: Hotel | null = hotelToEdit || null;

      if (isProfileView) {
        const active: any = currentHotelService.getCurrentHotel();
        try {
          const dbHoteis = await hoteisService.getHoteis();
          const found = dbHoteis.find(h => h.id === active.id || (h.name && h.name.toLowerCase() === active.name.toLowerCase()));
          if (found) {
            targetHotel = found;
          } else {
            targetHotel = {
              id: active.id,
              name: active.name,
              razaoSocial: active.razaoSocial || (active.name ? `${active.name} EIRELI` : ''),
              category: active.category || 'Pousada Boutique / Charme',
              cnpj: active.cnpj || '',
              cityUf: active.cityUf || '',
              neighborhood: active.neighborhood || '',
              plan: active.plan || 'Professional',
              capacity: active.capacity || 10,
              capacityUnit: 'suítes',
              whatsappInstances: active.whatsappInstances || 2,
              managerName: active.managerName || '',
              managerPhone: active.managerPhone || '',
              status: (active.status as any) || 'ativo',
              imageUrl: active.imageUrl || undefined,
              cep: active.cep || '',
              street: active.street || '',
              streetNumber: (active as any).streetNumber || '',
              managerEmail: active.managerEmail || '',
              managerCpf: active.managerCpf || '',
              managerRole: active.managerRole || '',
              loginEmail: active.loginEmail || '',
              instanceName: active.instanceName || '',
              apiUrl: active.apiUrl || '',
              apiKey: active.apiKey || '',
              agenteIa: active.agenteIa || (active.id && typeof window !== 'undefined' ? localStorage.getItem(`hotel_agente_ia_${active.id}`) : '') || '',
              notes: active.notes || '',
              link: active.link || (active.name ? `/hoteis/${slugify(active.name)}` : '')
            };
          }
        } catch (e) {
          console.warn('Erro ao carregar dados do hotel:', e);
        }
      }

      if (!isMounted || !targetHotel) return;

      setNomeFantasia(targetHotel.name || '');
      setRazaoSocial(targetHotel.razaoSocial || (targetHotel.name ? `${targetHotel.name} EIRELI` : ''));
      setCnpj(targetHotel.cnpj ? maskCnpj(targetHotel.cnpj) : '');
      setCategory(targetHotel.category || 'Pousada Boutique / Charme');
      setCapacity(targetHotel.capacity !== undefined ? targetHotel.capacity : '');
      setPhone(targetHotel.managerPhone ? maskPhone(targetHotel.managerPhone) : '');
      setCep(targetHotel.cep ? maskCep(targetHotel.cep) : '');
      setStreet(targetHotel.street || '');
      setStreetNumber((targetHotel as any).streetNumber || '');
      setNeighborhood(targetHotel.neighborhood || '');
      setLogoPreview(targetHotel.imageUrl || null);
      
      if (targetHotel.city) {
        setCity(targetHotel.city);
      } else if (targetHotel.cityUf) {
        const parts = targetHotel.cityUf.split('/');
        setCity(parts[0]?.trim() || '');
      }
      if (targetHotel.uf) {
        setUf(targetHotel.uf);
      } else if (targetHotel.cityUf) {
        const parts = targetHotel.cityUf.split('/');
        setUf(parts[1]?.trim() || '');
      }
      
      if (targetHotel.plan) {
        setSelectedPlan(targetHotel.plan);
      }
      
      setManagerName(targetHotel.managerName || '');
      setManagerCpf(targetHotel.managerCpf ? maskCpf(targetHotel.managerCpf) : '');
      setManagerWhatsapp(targetHotel.managerPhone ? maskPhone(targetHotel.managerPhone) : '');
      setManagerEmail(targetHotel.managerEmail || '');
      setManagerRole(targetHotel.managerRole || '');
      setLoginEmail(targetHotel.loginEmail || '');
      setInstanceName(targetHotel.instanceName || '');
      setApiUrl(targetHotel.apiUrl || '');
      setApiKey(targetHotel.apiKey || '');
      setAgenteIa(targetHotel.agenteIa || (targetHotel.id && typeof window !== 'undefined' ? localStorage.getItem(`hotel_agente_ia_${targetHotel.id}`) : '') || '');
      setStatus(targetHotel.status === 'bloqueado' ? 'inativo' : 'ativo');
      setLink(targetHotel.link || (targetHotel.name ? `/hoteis/${slugify(targetHotel.name)}` : ''));
      setInstagram(targetHotel.instagram || '');
      setFacebook(targetHotel.facebook || '');
      setTiktok(targetHotel.tiktok || '');
      setWhatsappSocial(targetHotel.whatsapp || '');
      setPassword('');
      setConfirmPassword('');
      const infoCreds = creditosService.calcularInfoCreditos(targetHotel);
      if (infoCreds?.dataCompra) {
        setDataCompra(infoCreds.dataCompra);
      }
      setIsGoogleMaps(isHotelGoogleMaps(targetHotel));
    };

    loadHotelData();

    return () => {
      isMounted = false;
    };
  }, [hotelToEdit, isProfileView]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeFantasia.trim()) {
      showToast('Por favor, informe o Nome Fantasia do Hotel.');
      return;
    }

    if (!isEditing && loginEmail.trim() && !password.trim()) {
      showToast('Por favor, informe a Senha de Acesso Master para o novo hotel.');
      return;
    }

    if (password.trim() || confirmPassword.trim()) {
      if (password !== confirmPassword) {
        showToast('As senhas digitadas não coincidem.');
        return;
      }
      if (password.length < 6) {
        showToast('A senha de acesso master deve ter no mínimo 6 caracteres.');
        return;
      }
    }

    // Validação estrita de CPF do Responsável para barrar CPFs falsos
    if (managerCpf.trim()) {
      if (!isValidCpf(managerCpf)) {
        showToast('O CPF do Responsável é falso ou inválido. Por favor, digite um CPF autêntico da Receita Federal.');
        return;
      }
    }

    // Validação de CNPJ do Hotel
    if (cnpj.trim() && cnpj !== '00.000.000/0001-00') {
      if (!isValidCnpj(cnpj)) {
        showToast('O CNPJ informado é inválido. Por favor, verifique os dígitos.');
        return;
      }
    }

    try {
      const currentSelectedPlano = isGoogleMaps
        ? (planos.find(p => p.name?.toLowerCase().includes('google') || p.name?.toLowerCase().includes('maps')) || googleMapsPlanFallback)
        : (planos.find(p => isPlanSelected(p)) || planos.find(p => p.name?.toLowerCase() === selectedPlan.toLowerCase()));

      let finalNotes = notes;
      if (isGoogleMaps && !finalNotes.toLowerCase().includes('google') && !finalNotes.toLowerCase().includes('places')) {
        finalNotes = finalNotes ? `${finalNotes} | Cadastro manual - Origem Google Maps` : `Cadastro manual - Origem Google Maps (${new Date().toLocaleDateString('pt-BR')})`;
      }

      const payload: Partial<Hotel> = {
        name: nomeFantasia,
        razaoSocial: razaoSocial,
        category: category,
        cnpj: cnpj || '00.000.000/0001-00',
        city: city.trim(),
        uf: uf ? uf.toUpperCase().trim() : '',
        cityUf: (city.trim() && uf.trim()) ? `${city.trim()} / ${uf.trim().toUpperCase()}` : (city.trim() || uf.trim().toUpperCase()),
        neighborhood: neighborhood.trim(),
        cep: cep.trim(),
        street: street.trim(),
        streetNumber: streetNumber.trim(),
        plan: isGoogleMaps ? 'Grátis (Google Maps)' : (currentSelectedPlano?.name || selectedPlan || 'Professional'),
        capacity: capacity !== '' && capacity !== undefined ? Number(capacity) : 0,
        capacityUnit: 'quartos',
        whatsappInstances: isGoogleMaps ? 0 : (currentSelectedPlano?.whatsappConnections ?? (hotelToEdit?.whatsappInstances ?? 0)),
        managerName: managerName.trim() || (isGoogleMaps ? 'Origem Google Maps' : 'Não informado'),
        managerPhone: managerWhatsapp.trim() || phone.trim() || '',
        managerEmail: managerEmail,
        managerCpf: managerCpf,
        managerRole: managerRole,
        loginEmail: loginEmail,
        instanceName: instanceName,
        apiUrl: apiUrl,
        apiKey: apiKey,
        agenteIa: agenteIa.trim(),
        notes: finalNotes,
        status: status === 'ativo' ? 'ativo' : 'bloqueado',
        imageUrl: logoPreview || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&auto=format&fit=crop&q=80',
        link: link || (nomeFantasia ? `/hoteis/${slugify(nomeFantasia)}` : '/hoteis/nomedohotel'),
        instagram: instagram.trim() || undefined,
        facebook: facebook.trim() || undefined,
        tiktok: tiktok.trim() || undefined,
        whatsapp: whatsappSocial.trim() || undefined,
        isImportedFromGoogle: isGoogleMaps
      };

      const currentHotelId = hotelToEdit?.id || currentHotelService.getCurrentHotel().id;
      const dbHotelId = resolveHotelDbId(currentHotelId);

      const numCreditos = isGoogleMaps ? 0 : (pacoteDias >= 425 ? 12 : pacoteDias >= 225 ? 6 : pacoteDias >= 120 ? 3 : pacoteDias >= 75 ? 2 : 1);
      const dataExpFinal = isGoogleMaps ? '2099-12-31T23:59:59.000Z' : previsaoCreditos.dataExpiracao;
      const degustacaoFinal = isGoogleMaps ? false : (infoCreditosState?.emDegustacao || false);

      if (isEditing) {
        const targetId = (hotelToEdit && hotelToEdit.id) ? resolveHotelDbId(hotelToEdit.id) : dbHotelId;
        const updateOk = await hoteisService.updateHotel(targetId, payload);
        if (!updateOk) {
          const upsertRes = await hoteisService.createHotel({ ...payload, id: targetId } as any);
          if (!upsertRes.success) {
            throw new Error(upsertRes.error || 'Não foi possível salvar as alterações do hotel no banco de dados.');
          }
        }
        creditosService.saveCreditoHotel(
          targetId,
          numCreditos,
          dataExpFinal,
          isGoogleMaps ? false : degustacaoFinal,
          dataCompra
        );

        // Se o usuário digitou uma nova senha em modo edição, atualiza a credencial
        if (password.trim() && password.length >= 6 && password === confirmPassword) {
          try {
            const { data: sessao } = await supabase.auth.getSession();
            if (sessao?.session?.user?.email?.toLowerCase() === loginEmail.trim().toLowerCase()) {
              await supabase.auth.updateUser({ password: password.trim() });
            }
            await supabase.from('usuarios')
              .update({ password: password.trim() })
              .ilike('email', loginEmail.trim().toLowerCase());
          } catch (pwErr) {
            console.warn('Erro ao atualizar senha em modo edição:', pwErr);
          }
        }
        // Se as senhas ficaram em branco: a senha atual é mantida 100% inalterada!
      } else {
        let hotelCriadoId: string | null = null;
        try {
          const hotelRes = await hoteisService.createHotel(payload);
          if (!hotelRes.success || !hotelRes.id) {
            throw new Error(hotelRes.error || 'Não foi possível cadastrar o hotel no banco de dados.');
          }
          hotelCriadoId = hotelRes.id;
          creditosService.saveCreditoHotel(
            hotelCriadoId,
            numCreditos,
            dataExpFinal,
            isGoogleMaps ? false : true,
            dataCompra
          );

          if (loginEmail && loginEmail.trim()) {
            if (!password || password.trim().length < 6) {
              if (hotelCriadoId) {
                try { await hoteisService.deleteHotel(hotelCriadoId); } catch (_) {}
              }
              showToast('Por favor, defina uma senha de acesso master com pelo menos 6 caracteres para o novo usuário gerente do hotel.');
              setTimeout(() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('hotel_novo_hotel', { detail: { error: true } }));
                }
              }, 200);
              return;
            }
            if (confirmPassword !== password) {
              if (hotelCriadoId) {
                try { await hoteisService.deleteHotel(hotelCriadoId); } catch (_) {}
              }
              showToast('A confirmação da senha não confere com a senha digitada. Verifique e tente novamente.');
              setTimeout(() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('hotel_novo_hotel', { detail: { error: true } }));
                }
              }, 200);
              return;
            }
            const userRes = await usuariosService.createUsuario({
              name: managerName.trim() || nomeFantasia.trim() || 'Gestor do Hotel',
              email: loginEmail.trim().toLowerCase(),
              cargo: managerRole.trim() || 'Gerente Geral',
              perfil: 'Hotel',
              phone: managerWhatsapp.replace(/\D/g, '') || phone.replace(/\D/g, ''),
              status: status === 'ativo' ? 'ativo' : 'inativo',
              lastAccess: 'Nunca acessou',
              initials: (managerName.trim() || nomeFantasia.trim() || 'HT').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
              cep: cep.trim(),
              street: street.trim(),
              streetNumber: streetNumber.trim(),
              neighborhood: neighborhood.trim(),
              city: city.trim(),
              uf: uf.trim().toUpperCase(),
              hotel_id: hotelCriadoId
            }, password, { adminMode: true });

            if (!userRes.success) {
              if (hotelCriadoId) {
                try { await hoteisService.deleteHotel(hotelCriadoId); } catch (_) {}
              }
              throw new Error(userRes.error || 'Não foi possível cadastrar as credenciais do usuário administrador.');
            }
          }
        } catch (opErr) {
          const msg = opErr instanceof Error ? opErr.message : 'Erro desconhecido no cadastro do hotel.';
          showToast(msg);
          console.warn('Rollback / falha no FormHotel:', opErr);
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('hotel_novo_hotel', { detail: { error: true } }));
            }
          }, 200);
          return;
        }
      }

      if (isProfileView) {
        currentHotelService.setCurrentHotel({
          id: dbHotelId,
          name: nomeFantasia,
          category: category,
          city: city || 'Ipojuca',
          uf: uf ? uf.toUpperCase() : 'PE',
          cityUf: `${city || 'Ipojuca'} / ${uf ? uf.toUpperCase() : 'PE'}`,
          cnpj: cnpj || '00.000.000/0001-00',
          status: status === 'ativo' ? 'ativo' : 'bloqueado',
          imageUrl: logoPreview || undefined,
          link: link || (nomeFantasia ? `/hoteis/${slugify(nomeFantasia)}` : '/hoteis/nomedohotel'),
          instagram: instagram.trim() || undefined,
          facebook: facebook.trim() || undefined,
          tiktok: tiktok.trim() || undefined,
          whatsapp: whatsappSocial.trim() || undefined
        });
      }
    } catch (err) {
      console.warn('Erro ao salvar hotel no Supabase:', err);
      showToast(err instanceof Error ? err.message : 'Erro ao salvar hotel. Verifique os dados e tente novamente.');
      return;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_novo_hotel'));
      window.dispatchEvent(new CustomEvent('hotel_changed', { detail: currentHotelService.getCurrentHotel() }));
    }

    showToast(`Hotel "${nomeFantasia}" ${hotelToEdit || isProfileView ? 'atualizado' : 'cadastrado'} com sucesso!`);
    setTimeout(() => {
      if (onSaveSuccess) onSaveSuccess();
    }, 1200);
  };

  return (
    <div className="bg-[#F4F6F9] min-h-screen text-slate-800 font-sans antialiased p-4 md:p-10 pb-28 md:pb-12 max-w-6xl mx-auto">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div className="bg-[#d1fae5] border border-emerald-300 text-black px-5 py-3.5 rounded-xl shadow-lg flex items-center gap-3 font-semibold text-sm">
            <span className="material-symbols-outlined text-emerald-600 text-xl">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* TOPO: VOLTAR & CABEÇALHO (APENAS MOBILE) */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between lg:hidden">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs md:text-sm font-semibold text-slate-600 hover:text-[#003400] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>{isProfileView ? 'Voltar para o Dashboard' : 'Voltar para Listagem de Hotéis'}</span>
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-xs hidden sm:flex">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Ambiente Seguro • SaaS Hoteleiro v3.4</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                {isProfileView ? 'Meu Perfil' : hotelToEdit ? 'Editar Hotel' : 'Cadastro de Novo Hotel'}
              </h1>
              {!isProfileView && (
                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {hotelToEdit ? 'Registro de Edição' : 'Novo Registro'}
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              {isProfileView
                ? 'Confira e atualize as informações cadastradas da sua propriedade, dados do proprietário, plano SaaS e integração WhatsApp.'
                : 'Cadastre todas as informações da propriedade, selecione o plano SaaS, credenciais administrativas e dados da instância WhatsApp.'}
            </p>
          </div>

          {/* Ações da Barra Superior (Status e Checkbox Google Maps - Somente para Administrador) */}
          {isUserAdmin && (
            <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
              {/* Checkbox Origem Google Maps */}
              <div className={`flex items-center gap-2.5 p-2.5 px-4 rounded-xl border transition-all ${
                isGoogleMaps 
                  ? 'bg-blue-50/90 border-blue-300 text-blue-950 shadow-xs' 
                  : 'bg-white border-slate-200 text-slate-700 shadow-xs'
              }`}>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={isGoogleMaps}
                    onChange={(e) => handleGoogleMapsChange(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer accent-blue-600"
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-lg text-blue-600">travel_explore</span>
                    <span className="text-xs md:text-sm font-bold">Cadastro do Google Maps</span>
                  </div>
                </label>
                {isGoogleMaps && (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded-full">
                    Ativo
                  </span>
                )}
              </div>

              {/* Switch de Status Ativo */}
              <div className="flex items-center gap-3 bg-white p-2.5 px-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs md:text-sm font-semibold text-slate-700">Status do Hotel:</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={status === 'ativo'}
                    onChange={() => setStatus(status === 'ativo' ? 'inativo' : 'ativo')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  <span className="ml-2.5 text-xs font-bold text-emerald-700 uppercase tracking-wide peer-checked:inline hidden">Ativo</span>
                  <span className="ml-2.5 text-xs font-bold text-slate-400 uppercase tracking-wide peer-checked:hidden">Inativo</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FORMULÁRIO PRINCIPAL */}
      <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">

        {/* SEÇÃO 1: IDENTIDADE & INFORMAÇÕES DO HOTEL */}
        <div className="bg-white rounded-2xl p-5 md:p-7 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">hotel</span>
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900">1. Identidade & Informações do Hotel</h2>
              <p className="text-xs text-slate-500">Dados institucionais, logotipo e informações da propriedade</p>
            </div>
          </div>

          {/* Banner explicativo quando o modo Google Maps está ativo (somente visível para Administrador) */}
          {isUserAdmin && isGoogleMaps && (
            <div className="p-4 bg-blue-50/90 border border-blue-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-950 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                  <span className="material-symbols-outlined text-lg">travel_explore</span>
                </div>
                <div>
                  <span className="font-extrabold block text-sm text-blue-950">Hotel Cadastrado com Regras do Google Maps</span>
                  <span className="text-blue-800 text-xs font-medium">
                    Este estabelecimento segue todas as diretrizes dos hotéis importados do Google Places: plano 100% gratuito vitalício, sem cobrança de pacotes de créditos e exibição no catálogo público com foco em contato direto via Zap.
                  </span>
                </div>
              </div>
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shrink-0 shadow-2xs">
                Regras Maps Ativas
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Upload de Logo do Hotel */}
            <div className="md:col-span-4 flex flex-col">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Logo Oficial do Hotel *
              </label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-2xl p-5 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-emerald-50/20 transition-all cursor-pointer h-full min-h-[200px] group"
              >
                <div className="w-16 h-16 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-400 mb-3 group-hover:scale-105 transition-transform overflow-hidden">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo Hotel" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-3xl text-emerald-700">add_photo_alternate</span>
                  )}
                </div>
                <span className="text-xs md:text-sm font-bold text-slate-800">Carregar Logo do Hotel</span>
                <p className="text-[11px] text-slate-500 mt-1">PNG, JPG ou SVG até 5MB</p>
                
                <button 
                  type="button" 
                  className="mt-3 px-3.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-xs cursor-pointer"
                >
                  Selecionar do Computador
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*" 
                  onChange={handleLogoSelect} 
                  className="hidden" 
                />
              </div>
            </div>

            {/* Campos da Propriedade */}
            <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Razão Social / Nome Oficial do Estabelecimento *
                </label>
                <input 
                  type="text" 
                  required
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Ex: Hotel Master Porto de Galinhas EIRELI" 
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-slate-50/30"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Nome Fantasia (Exibição no Zap) *
                </label>
                <input 
                  type="text" 
                  required
                  value={nomeFantasia}
                  onChange={(e) => handleNomeFantasiaChange(e.target.value)}
                  placeholder="Ex: Hotel Master Porto de Galinhas" 
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-slate-50/30"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    CNPJ *
                  </label>
                  {cnpjValidation.isComplete && cnpj !== '00.000.000/0001-00' && (
                    <span className={`text-[11px] font-bold flex items-center gap-1 ${
                      cnpjValidation.isValid ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      <span className="material-symbols-outlined text-[13px]">
                        {cnpjValidation.isValid ? 'verified' : 'cancel'}
                      </span>
                      {cnpjValidation.isValid ? 'CNPJ Válido' : 'CNPJ Inválido'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    required
                    value={cnpj}
                    onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                    placeholder="00.000.000/0001-00" 
                    maxLength={18}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs md:text-sm focus:outline-none transition-all font-mono ${
                      cnpjValidation.isComplete && cnpj !== '00.000.000/0001-00'
                        ? cnpjValidation.isValid
                          ? 'border-emerald-500 bg-emerald-50/20 text-slate-900 focus:border-emerald-600'
                          : 'border-rose-400 bg-rose-50/30 text-rose-950 focus:border-rose-500'
                        : 'border-slate-200 focus:border-[#003400] bg-slate-50/30 text-slate-900'
                    }`}
                  />
                  {cnpjValidation.isComplete && cnpj !== '00.000.000/0001-00' && (
                    <span className={`absolute right-3.5 top-2.5 material-symbols-outlined text-lg pointer-events-none ${
                      cnpjValidation.isValid ? 'text-emerald-600' : 'text-rose-500'
                    }`}>
                      {cnpjValidation.isValid ? 'check_circle' : 'error'}
                    </span>
                  )}
                </div>
                {cnpjValidation.isComplete && !cnpjValidation.isValid && cnpj !== '00.000.000/0001-00' && (
                  <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                    <span className="material-symbols-outlined text-xs">warning</span>
                    Este CNPJ é inválido. Verifique os dígitos digitados.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Categoria / Tipo de Hospedagem *
                </label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-white cursor-pointer"
                >
                  <option value="Resort 5 estrelas">Resort All-Inclusive / Lazer</option>
                  <option value="Hotel Urbano / Executivo">Hotel Urbano / Executivo</option>
                  <option value="Pousada Boutique / Charme">Pousada Boutique / Charme</option>
                  <option value="Chalés & Eco Village">Chalés & Eco Village</option>
                  <option value="Flat / Apart-hotel">Flat / Apart-hotel</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Classificação / Estrelas
                </label>
                <select 
                  value={stars}
                  onChange={(e) => setStars(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-white cursor-pointer"
                >
                  <option value="5">⭐⭐⭐⭐⭐ (5 Estrelas / Luxo)</option>
                  <option value="4">⭐⭐⭐⭐ (4 Estrelas / Superior)</option>
                  <option value="3">⭐⭐⭐ (3 Estrelas / Padrão)</option>
                  <option value="2">⭐⭐ (2 Estrelas / Econômico)</option>
                  <option value="boutique">🌟 Charme / Pousada Boutique</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Total de Quartos Gerenciados *
                </label>
                <input 
                  type="number" 
                  min="0"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder={isGoogleMaps ? "0 (Sem quartos - Google Maps)" : "Ex: 15"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30 font-semibold"
                />
                {isGoogleMaps && (
                  <p className="text-[10px] text-blue-700 font-semibold flex items-center gap-1 mt-1">
                    <span className="material-symbols-outlined text-xs">info</span>
                    Hotéis do Google Maps não exigem quartos gerenciados (padrão: 0 quartos).
                  </p>
                )}
                {(() => {
                  const planoObj = planos.find(p => isPlanSelected(p)) || planos.find(p => p.name?.toLowerCase() === selectedPlan.toLowerCase());
                  if (planoObj && planoObj.roomLimit !== undefined && planoObj.roomLimit !== null) {
                    const isDefaultFromPlan = Number(capacity) === Number(planoObj.roomLimit);
                    return (
                      <div className={`flex items-start gap-1.5 mt-1.5 pl-0.5 ${isDefaultFromPlan ? 'text-[#003400]' : 'text-amber-700'}`}>
                        <span className="material-symbols-outlined text-[14px] mt-px shrink-0">
                          {isDefaultFromPlan ? 'verified' : 'tune'}
                        </span>
                        <p className="text-[10px] font-semibold leading-snug">
                          {isDefaultFromPlan ? (
                            <>Valor padrão do plano selecionado: <span className="font-bold">{planoObj.roomLimit} quartos</span>. {planoObj.roomExtraPriceText && <span className="text-[#003400]/80">{planoObj.roomExtraPriceText}.</span>}</>
                          ) : (
                            <>Ajuste manual do usuário. Limite padrão do plano <span className="font-bold">{planoObj.name}</span>: {planoObj.roomLimit} quartos.</>
                          )}
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Telefone Comercial Fixo
                </label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  placeholder="(81) 3456-7890" 
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30"
                />
              </div>
            </div>
          </div>

          {/* Endereço da Propriedade */}
          <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>CEP da Propriedade *</span>
                {isLoadingCep && (
                  <span className="text-[10px] text-emerald-700 flex items-center gap-1 font-semibold normal-case">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    Buscando ViaCEP...
                  </span>
                )}
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={cep}
                  onChange={handleCepChange}
                  onBlur={() => handleSearchViaCep(cep)}
                  placeholder="55590-000" 
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30 font-mono"
                />
                <button 
                  type="button" 
                  disabled={isLoadingCep}
                  onClick={() => handleSearchViaCep(cep)}
                  className="absolute right-2 top-2 px-2.5 py-1 text-xs font-semibold bg-[#003400] hover:bg-emerald-950 text-white rounded-lg cursor-pointer disabled:opacity-50 transition-all flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-xs">search</span>
                  <span>Buscar</span>
                </button>
              </div>
              {cepError && (
                <p className="text-[11px] text-red-600 font-semibold mt-1">{cepError}</p>
              )}
            </div>

            <div className="md:col-span-4 space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Endereço (Rua, Av, Rodovia) *
              </label>
              <input 
                type="text" 
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Rodovia PE-09, Km 08 - Praia do Cupe" 
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Número *
              </label>
              <input 
                type="text" 
                value={streetNumber}
                onChange={(e) => setStreetNumber(e.target.value)}
                placeholder="123 ou S/N" 
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30 font-semibold"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Bairro / Região *
              </label>
              <input 
                type="text" 
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Praia do Cupe" 
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30"
              />
            </div>

            <div className="md:col-span-3 space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Cidade *
              </label>
              <input 
                type="text" 
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ipojuca" 
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30"
              />
            </div>

            <div className="md:col-span-1 space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                UF *
              </label>
              <input 
                type="text" 
                value={uf}
                maxLength={2}
                onChange={(e) => setUf(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30 uppercase text-center font-bold"
              />
            </div>

            {/* Campo Link da Página do Hotel (Gerado Automaticamente - Depois do campo UF) */}
            <div className="md:col-span-6 space-y-1.5 pt-2 border-t border-slate-100 mt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-700 text-base">link</span>
                  <span>Link da Página do Hotel (Gerado Automaticamente) *</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    Rota Pública do Estabelecimento
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const slug = slugify(nomeFantasia);
                      setLink(slug ? `/hoteis/${slug}` : '/hoteis/nomedohotel');
                      setIsLinkManuallyEdited(false);
                      showToast('Link regenerado automaticamente a partir do Nome Fantasia!');
                    }}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                  >
                    Regenerar pelo Nome
                  </button>
                </div>
              </div>

              <div className="relative flex items-center">
                <input 
                  type="text" 
                  value={link}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (!val.startsWith('/hoteis/') && !val.startsWith('/hotel/')) {
                      if (!val.startsWith('/')) val = `/${val}`;
                    }
                    setLink(val);
                    setIsLinkManuallyEdited(true);
                  }}
                  placeholder="/hoteis/nomedohotel"
                  className="w-full pl-3.5 pr-20 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/50 font-mono text-emerald-900 font-semibold"
                />
                <div className="absolute right-2 flex items-center gap-1">
                  <button 
                    type="button" 
                    onClick={() => copyToClipboard(`${window.location.origin}${link.startsWith('/') ? link : `/${link}`}`)}
                    className="p-1.5 text-slate-500 hover:text-[#003400] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Copiar Link Completo"
                  >
                    <span className="material-symbols-outlined text-base">content_copy</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => window.open(link.startsWith('/') ? link : `/${link}`, '_blank')}
                    className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Testar Link em Nova Aba"
                  >
                    <span className="material-symbols-outlined text-base">open_in_new</span>
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-emerald-600">info</span>
                <span>Exemplo de link para o hóspede acessar: <strong className="text-slate-800 font-mono">{window.location.origin}{link || '/hoteis/nomedohotel'}</strong></span>
              </p>
            </div>
          </div>
        </div>

        {/* SEÇÃO: REDES SOCIAIS & CONTATOS PÚBLICOS (NÃO OBRIGATÓRIOS) */}
        <div className="bg-white rounded-2xl p-5 md:p-7 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-pink-50 text-pink-700 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-xl">share</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base md:text-lg font-bold text-slate-900">Redes Sociais do Hotel</h2>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Não Obrigatório
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Canais oficiais exibidos no rodapé da página pública do hotel (<span className="font-mono text-emerald-700">/hoteis/nomedohotel</span>). Cada hotel tem suas próprias redes.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full w-fit border border-emerald-200">
              Exibição no Rodapé
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Instagram */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 inline-block"></span>
                  <span>Instagram</span>
                </label>
                <span className="text-[10px] font-semibold text-slate-400">Opcional</span>
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@seuhotel ou link" 
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-pink-600 bg-slate-50/30"
                />
              </div>
              <p className="text-[10px] text-slate-400">Ex: @pousadamaster ou link completo</p>
            </div>

            {/* Facebook */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1877F2] inline-block"></span>
                  <span>Facebook</span>
                </label>
                <span className="text-[10px] font-semibold text-slate-400">Opcional</span>
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  placeholder="pousadamaster ou link" 
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-blue-600 bg-slate-50/30"
                />
              </div>
              <p className="text-[10px] text-slate-400">Ex: pousadamaster ou página oficial</p>
            </div>

            {/* TikTok */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-black inline-block"></span>
                  <span>TikTok</span>
                </label>
                <span className="text-[10px] font-semibold text-slate-400">Opcional</span>
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  value={tiktok}
                  onChange={(e) => setTiktok(e.target.value)}
                  placeholder="@seuhotel ou link" 
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-slate-900 bg-slate-50/30"
                />
              </div>
              <p className="text-[10px] text-slate-400">Ex: @pousadamaster ou perfil oficial</p>
            </div>

            {/* WhatsApp */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#25D366] inline-block"></span>
                  <span>WhatsApp Público</span>
                </label>
                <span className="text-[10px] font-semibold text-slate-400">Opcional</span>
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  value={whatsappSocial}
                  onChange={(e) => setWhatsappSocial(maskPhone(e.target.value))}
                  placeholder="(81) 99876-5432" 
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-emerald-600 bg-slate-50/30"
                />
              </div>
              <p className="text-[10px] text-slate-400">Número direto para os hóspedes no rodapé</p>
            </div>
          </div>
        </div>

        {/* SEÇÃO 2: ESCOLHA DO PLANO SAAS & FATURAMENTO */}
        <div className="bg-white rounded-2xl p-5 md:p-7 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-xl">loyalty</span>
              </div>
              <div>
                <h2 className="text-base md:text-lg font-bold text-slate-900">Selecione o Plano</h2>
                <p className="text-xs text-slate-500">Sistema de cobrança Modelo 1: Pacotes de créditos de acesso por tempo de uso com bônus inclusos</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full hidden sm:inline-block">
              Modelo 1 • Créditos & Bônus
            </span>
          </div>

          {/* Banner de Parceiro Indicador Selecionado via Link */}
          {preselectedPartner && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-950 font-bold shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#003400] text-white flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-lg">verified</span>
                </div>
                <div>
                  <span className="text-emerald-950 text-sm font-extrabold block">Hotel sendo cadastrado via indicação de: {preselectedPartner.name}</span>
                  <span className="text-emerald-800 text-xs font-mono font-semibold">Cupom Vinculado: {preselectedPartner.coupon} • Nível/Comissão: {preselectedPartner.commission}</span>
                </div>
              </div>
              <span className="bg-[#003400] text-white px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider shrink-0 shadow-xs">
                Link de Indicação Ativo
              </span>
            </div>
          )}

          {/* Banner do Google Maps OU Banner de Créditos & Degustação (Modelo 1) */}
          {isUserAdmin && isGoogleMaps ? (
            <div className="p-4 bg-blue-50 border border-blue-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-950 font-bold shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                  <span className="material-symbols-outlined text-lg">travel_explore</span>
                </div>
                <div>
                  <span className="text-blue-950 text-sm font-extrabold block">Regras de Cobrança do Google Maps Ativas</span>
                  <span className="text-blue-800 text-xs font-medium">
                    Hotel configurado com o <strong>Plano Grátis (Google Maps)</strong>. O estabelecimento não consome créditos SaaS e permanece ativo por tempo indeterminado sem expiração.
                  </span>
                </div>
              </div>
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider shrink-0 shadow-xs">
                R$ 0,00 • Vitalício
              </span>
            </div>
          ) : isUserAdmin && (
            !hotelToEdit ? (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-950 font-bold shadow-xs animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#003400] text-white flex items-center justify-center font-bold shrink-0">
                    <span className="material-symbols-outlined text-lg">card_giftcard</span>
                  </div>
                  <div>
                    <span className="text-emerald-950 text-sm font-extrabold block">Degustação Inicial Ativada (Modelo 1)</span>
                    <span className="text-emerald-800 text-xs font-medium">Este novo hotel começará automaticamente com <strong>1 Crédito (30 dias base + 15 dias de bônus = 45 dias sem compromisso)</strong>.</span>
                  </div>
                </div>
                <span className="bg-[#003400] text-white px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider shrink-0 shadow-xs">
                  45 Dias Grátis
                </span>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-950 font-bold shadow-xs animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#003400] text-white flex items-center justify-center font-bold shrink-0">
                    <span className="material-symbols-outlined text-lg">verified_user</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-emerald-950 text-sm font-extrabold">Sistema de Cobrança por Créditos Ativo (Modelo 1)</span>
                      {infoCreditosState?.emDegustacao && (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Em Degustação (45 Dias Sem Compromisso)
                        </span>
                      )}
                    </div>
                    <span className="text-emerald-800 text-xs font-medium block mt-0.5">
                      Saldo de Acesso: <strong>{infoCreditosState?.saldoCreditos || 1} Crédito(s)</strong> • Tempo Restante: <strong>{infoCreditosState?.diasRestantes} dias</strong> (Expiração: <strong>{infoCreditosState?.dataExpiracaoFormatada}</strong>)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = creditosService.adicionarDiasBonus(hotelToEdit.id, 15);
                      setInfoCreditosState(updated);
                      showToast('+15 Dias de Bônus adicionados ao hotel com sucesso!');
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Conceder +15 dias de bônus adicional"
                  >
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    <span>+15 Dias Bônus</span>
                  </button>
                  <span className="bg-[#003400] text-white px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider shrink-0 shadow-xs">
                    {infoCreditosState?.diasRestantes} Dias Ativos
                  </span>
                </div>
              </div>
            )
          )}

          {/* Grid de Seleção de Planos Dinâmico a partir do Supabase */}
          {isLoadingPlanos ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-5 rounded-2xl border-2 border-slate-200 bg-slate-50 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="h-5 w-24 bg-slate-200 rounded-full" />
                    <div className="w-5 h-5 bg-slate-200 rounded-full" />
                  </div>
                  <div className="h-8 w-32 bg-slate-200 rounded" />
                  <div className="h-4 w-full bg-slate-200 rounded" />
                  <div className="space-y-2 pt-3 border-t border-slate-200">
                    <div className="h-3 w-3/4 bg-slate-200 rounded" />
                    <div className="h-3 w-2/3 bg-slate-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : planosAtivos.length === 0 ? (
            <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-2">
              <span className="material-symbols-outlined text-3xl text-amber-600">inventory_2</span>
              <p className="text-sm font-bold text-slate-800">Nenhum plano ativo encontrado na tabela de planos</p>
              <p className="text-xs text-slate-500">Cadastre ou ative os planos no menu de Planos SaaS para que fiquem disponíveis para seleção.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {planosAtivos.map((plano) => {
                const selected = isPlanSelected(plano);
                const isFeatured = Boolean(plano.isFeatured);
                const tagText = plano.tag || (isFeatured ? 'Destaque' : undefined);

                return (
                  <label
                    key={plano.id || plano.name}
                    className={`relative flex flex-col p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                      selected
                        ? 'border-[#003400] bg-emerald-50/25 shadow-md ring-1 ring-[#003400]/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:shadow-xs'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="plano_hotel" 
                      value={plano.name}
                      checked={selected}
                      onChange={() => handleSelectPlan(plano)}
                      className="sr-only"
                    />
                    
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2.5 py-0.5 text-[11px] font-extrabold rounded-full uppercase tracking-wide ${
                          isFeatured 
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : selected
                            ? 'bg-[#003400] text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {plano.name}
                        </span>
                        {tagText && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 uppercase tracking-wider">
                            {tagText}
                          </span>
                        )}
                      </div>
                      <span className={`material-symbols-outlined text-xl shrink-0 transition-colors ${
                        selected ? 'text-[#003400]' : 'text-slate-300'
                      }`}>
                        {selected ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                    </div>

                    <div className="text-2xl font-black text-slate-900 mb-1">
                      {plano.basePrice === 0 ? (
                        'Grátis'
                      ) : (
                        <>
                          R$ {Number(plano.basePrice).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-xs font-medium text-slate-500"> {plano.pricePeriodText || '/mês'}</span>
                        </>
                      )}
                    </div>

                    {plano.description && (
                      <p className="text-xs text-slate-500 mb-4 line-clamp-2">{plano.description}</p>
                    )}

                    <div className="mt-auto space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-emerald-600 shrink-0">bed</span>
                        <span>{plano.roomLimitText || `Até ${plano.roomLimit || 15} quartos inclusos`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-emerald-600 shrink-0">chat</span>
                        <span>{plano.whatsappConnectionsText || `${plano.whatsappConnections || 1} Instância(s) WhatsApp`}</span>
                      </div>
                      {Array.isArray(plano.features) && plano.features.slice(0, 3).map((feat: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 truncate">
                          <span className="material-symbols-outlined text-sm text-emerald-600 shrink-0">check</span>
                          <span className="truncate">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* Parâmetros Inteligentes de Créditos & Validade (Modelo 1 - Sem ciclo ou vencimento fixo) */}
          <div className="pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* Campo 1: Data da Compra / Ativação dos Créditos */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-emerald-700">calendar_month</span>
                <span>Data da Compra dos Créditos *</span>
              </label>
              <input
                type="date"
                value={dataCompra}
                onChange={(e) => setDataCompra(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-white font-medium cursor-pointer shadow-xs"
              />
              <p className="text-[11px] text-slate-500">
                A contagem dos créditos e dias inicia nesta data.
              </p>
            </div>

            {/* Campo 2: Previsão Inteligente de Vencimento / Expiração */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-emerald-700">timer</span>
                <span>Validade Calculada Automaticamente</span>
              </label>
              <div className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50/50 flex items-center justify-between shadow-xs">
                <div className="min-w-0">
                  <span className="text-xs font-extrabold text-emerald-950 block truncate">
                    Expira em {previsaoCreditos.dataExpiracaoFormatada}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-medium block">
                    {pacoteDias} dias totais a partir da compra
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#003400] text-white shrink-0 ml-2">
                  {previsaoCreditos.diasRestantes} dias rest.
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Calculado com base no pacote selecionado ({pacoteDias} dias).
              </p>
            </div>

            {/* Campo 3: Parceiro / Indicador */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-amber-600">handshake</span>
                <span>Parceiro / Indicador</span>
              </label>

              {/* Se veio de link de parceiro: exibe info travada, sem possibilidade de troca */}
              {preselectedPartner ? (
                <div className="flex items-center gap-3 px-3.5 py-2.5 bg-emerald-50 border border-emerald-300 rounded-xl">
                  <span className="material-symbols-outlined text-emerald-700 text-base">lock</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-extrabold text-emerald-950 truncate">
                      ★ {preselectedPartner.name}
                    </p>
                    <p className="text-[11px] text-emerald-700 font-mono truncate">
                      Cupom: {preselectedPartner.coupon} • {preselectedPartner.commission}
                    </p>
                  </div>
                  <span className="shrink-0 bg-emerald-700 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Indicação Ativa
                  </span>
                  <input type="hidden" value={preselectedPartner.id || preselectedPartner.coupon} />
                </div>
              ) : (
                /* Sem link de parceiro: select com Hotel no Zap como padrão fixo sem escolha de "Sem indicação" */
                <select
                  value={partnerRef}
                  onChange={(e) => setPartnerRef(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-white font-medium cursor-pointer shadow-xs"
                >
                  <option value="HOTELNOZAP">🏨 Hotel no Zap (Padrão — Sem Indicador Externo)</option>
                  {partnersList
                    .filter(p => (p.coupon || '').toUpperCase() !== 'HOTELNOZAP')
                    .map((p) => (
                      <option key={p.id} value={p.id || p.coupon}>
                        ★ {p.name} {p.coupon ? `(Cupom: ${p.coupon})` : ''} {p.commission ? `• ${p.commission}` : ''}
                      </option>
                    ))}
                </select>
              )}

              <p className="text-[11px] text-slate-500">
                {preselectedPartner
                  ? 'Parceiro vinculado automaticamente via link de indicação — não pode ser alterado.'
                  : 'Por padrão, hotéis sem indicação externa ficam vinculados ao Hotel no Zap.'}
              </p>
            </div>

          </div>
        </div>

        {/* SEÇÃO 3: DADOS DO PROPRIETÁRIO / RESPONSÁVEL GERAL */}
        <div className="bg-white rounded-2xl p-5 md:p-7 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">person</span>
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900">3. Dados do Proprietário / Responsável Geral</h2>
              <p className="text-xs text-slate-500">Contato direto para notificações operacionais, cobrança e contratos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nome Completo do Proprietário / Gestor Geral *
              </label>
              <input 
                type="text" 
                required
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="Ex: Marcos Andrade Albuquerque" 
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  CPF do Responsável *
                </label>
                {managerCpfValidation.isComplete && (
                  <span className={`text-[11px] font-bold flex items-center gap-1 ${
                    managerCpfValidation.isValid ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    <span className="material-symbols-outlined text-[13px]">
                      {managerCpfValidation.isValid ? 'verified' : 'cancel'}
                    </span>
                    {managerCpfValidation.isValid ? 'CPF Autêntico' : 'CPF Inválido'}
                  </span>
                )}
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  value={managerCpf}
                  onChange={(e) => setManagerCpf(maskCpf(e.target.value))}
                  placeholder="000.000.000-00" 
                  maxLength={14}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs md:text-sm focus:outline-none transition-all font-mono ${
                    managerCpfValidation.isComplete
                      ? managerCpfValidation.isValid
                        ? 'border-emerald-500 bg-emerald-50/20 text-slate-900 focus:border-emerald-600'
                        : 'border-rose-400 bg-rose-50/30 text-rose-950 focus:border-rose-500'
                      : 'border-slate-200 focus:border-[#003400] bg-slate-50/30 text-slate-900'
                  }`}
                />
                {managerCpfValidation.isComplete && (
                  <span className={`absolute right-3.5 top-2.5 material-symbols-outlined text-lg pointer-events-none ${
                    managerCpfValidation.isValid ? 'text-emerald-600' : 'text-rose-500'
                  }`}>
                    {managerCpfValidation.isValid ? 'check_circle' : 'error'}
                  </span>
                )}
              </div>
              {managerCpfValidation.isComplete && !managerCpfValidation.isValid && (
                <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                  <span className="material-symbols-outlined text-xs">warning</span>
                  Este CPF é falso ou inválido. Digite um CPF autêntico da Receita Federal.
                </p>
              )}
              {managerCpfValidation.isComplete && managerCpfValidation.isValid && (
                <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-xs text-emerald-600">verified</span>
                  CPF validado e autêntico.
                </p>
              )}
              {!managerCpfValidation.isComplete && managerCpf.length > 0 && (
                <p className="text-[10px] text-slate-400 font-medium">
                  {managerCpfValidation.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                WhatsApp Pessoal do Responsável *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-emerald-600 material-symbols-outlined text-lg">chat</span>
                <input 
                  type="text" 
                  required
                  value={managerWhatsapp}
                  onChange={(e) => setManagerWhatsapp(maskPhone(e.target.value))}
                  placeholder="(81) 99876-5432" 
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30 font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                E-mail Comercial do Responsável *
              </label>
              <input 
                type="email" 
                required
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
                placeholder="marcos.andrade@hotelmaster.com.br" 
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Cargo / Função no Hotel
              </label>
              <input 
                type="text" 
                value={managerRole}
                onChange={(e) => setManagerRole(e.target.value)}
                placeholder="Sócio Proprietário / Diretor Geral" 
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30"
              />
            </div>
          </div>
        </div>

        {/* SEÇÃO 4: CREDENCIAIS DE ACESSO (LOGIN) */}
        <div className="bg-white rounded-2xl p-5 md:p-7 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">lock_open</span>
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900">4. Credenciais de Acesso</h2>
              <p className="text-xs text-slate-500">Usuário master para acesso ao painel de controle do hotel no Hotel no Zap</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                E-mail de Login Master *
              </label>
              <input 
                type="email" 
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@hotelmaster.com.br" 
                autoComplete="off"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Senha de Acesso Master {!isEditing && <span className="text-rose-500">*</span>}
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  required={!isEditing}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder={isEditing ? 'Deixe em branco para manter a mesma senha' : 'Mínimo 6 caracteres'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30 font-mono pr-10"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {passwordStrength.label && (
                <div className="mt-2.5 space-y-1.5">
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${passwordStrength.barColor} transition-all duration-500 ease-out rounded-full`}
                      style={{ width: `${passwordStrength.percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${passwordStrength.textColor}`}>
                      {passwordStrength.label}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-normal">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        mín. 6 chars
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        1+ letra maiúscula
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        1+ número
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        símbolo
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {!passwordStrength.label && !isEditing && (
                <p className="text-[11px] text-slate-400 font-normal mt-1">
                  Comece a digitar para ver a força da sua senha master.
                </p>
              )}
              {isEditing && (
                <p className="text-[11px] text-slate-500 font-normal mt-1">
                  Deixe em branco para manter a mesma senha atual.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Repetir Senha {!isEditing && <span className="text-rose-500">*</span>}
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  required={!isEditing || Boolean(password.trim())}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder={isEditing ? 'Deixe em branco para manter' : 'Repita a senha digitada'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30 font-mono pr-10"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SEÇÃO 5: DADOS PARA CONECTAR O WHATSAPP */}
        <div className="bg-white rounded-2xl p-5 md:p-7 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-xl">cell_tower</span>
              </div>
              <div>
                <h2 className="text-base md:text-lg font-bold text-slate-900">5. Dados para conectar o WhatsApp</h2>
                <p className="text-xs text-slate-500">Parâmetros de conexão API para disparos, atendimento automático e recepção 24h</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Evolution API Gateway
            </span>
          </div>

          {/* CAMPO NOME DO AGENTE IA (EXCLUSIVO DO HOTEL) */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-slate-50 border border-emerald-200/90 rounded-2xl shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#003400] text-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-2xl">smart_toy</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider" htmlFor="hotel_agente_ia">
                      Nome do Agente IA
                    </label>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                      Exclusivo deste Hotel
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Nome do atendente virtual de inteligência artificial exclusivo deste hotel para atendimento, tirar dúvidas e simular reservas no WhatsApp.
                  </p>
                </div>
              </div>
              <div className="w-full md:w-72 shrink-0">
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-emerald-700 material-symbols-outlined text-base">psychology</span>
                  <input 
                    id="hotel_agente_ia"
                    type="text" 
                    value={agenteIa}
                    onChange={(e) => setAgenteIa(e.target.value)}
                    placeholder="Ex: Sofia"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-emerald-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-[#003400] bg-white font-bold text-slate-900 shadow-xs placeholder-slate-400"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 text-right">Personalize o nome ou deixe em branco</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nome da Instância
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-mono text-xs">inst_</span>
                <input 
                  type="text" 
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30 font-mono font-semibold"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Identificador único sem espaços</p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                URL da API / Webhook Endpoint
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 material-symbols-outlined text-base">link</span>
                <input 
                  type="url" 
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30 font-mono text-xs"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Endereço do gateway de mensageria</p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                API Key / Token de Autenticação
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 material-symbols-outlined text-base">key</span>
                <input 
                  type="text" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30 font-mono text-xs"
                />
                <button 
                  type="button" 
                  onClick={() => copyToClipboard(apiKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer" 
                  title="Copiar Chave"
                >
                  <span className="material-symbols-outlined text-lg">content_copy</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Chave privada de segurança da API</p>
            </div>
          </div>
        </div>

        {/* SEÇÃO 6: OBSERVAÇÕES & INFORMAÇÕES INTERNAS */}
        <div className="bg-white rounded-2xl p-5 md:p-7 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">edit_note</span>
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900">6. Observações & Informações Internas</h2>
              <p className="text-xs text-slate-500">Notas para o time de suporte, implantação e account manager</p>
            </div>
          </div>

          <div>
            <textarea 
              rows={3} 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Insira quaisquer particularidades sobre o hotel, horários diferenciados de atendimento, data prevista de go-live ou acordos comerciais específicos..." 
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/30"
            ></textarea>
          </div>
        </div>

        {/* BARRA INFERIOR DE AÇÕES (RESPONSIVO DESKTOP vs MOBILE) */}
        <div className="pt-2">
          {/* Desktop Footer Actions */}
          <div className="hidden md:flex items-center justify-between bg-white rounded-2xl p-5 border border-slate-200 shadow-md">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="material-symbols-outlined text-emerald-600 text-lg">verified</span>
              <span>Ao salvar o cadastro, as instâncias e acessos serão provisionados imediatamente.</span>
            </div>

            <div className="flex items-center gap-3">
              <button 
                type="button" 
                onClick={onBack}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              
              <button 
                type="submit" 
                className="px-6 py-2.5 rounded-xl bg-[#003400] text-white text-sm font-bold hover:bg-[#002600] transition-colors shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">save</span>
                <span>Salvar Hotel</span>
              </button>
            </div>
          </div>

          {/* Mobile Footer Actions Stack */}
          <div className="md:hidden space-y-2 pt-2">
            <button 
              type="submit" 
              className="w-full bg-[#003400] text-white hover:bg-[#002500] active:scale-[0.99] font-bold text-xs py-3 px-4 rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              <span>Salvar Hotel</span>
            </button>
            <button 
              type="button" 
              onClick={onBack}
              className="w-full bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.99] font-semibold text-xs py-2.5 px-4 rounded-xl border border-slate-200 transition-all cursor-pointer text-center"
            >
              Cancelar
            </button>
          </div>
        </div>

      </form>

    </div>
  );
};

export default FormHotel;
