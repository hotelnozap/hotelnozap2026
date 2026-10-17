import { supabase } from '../lib/supabase';
import { Hotel } from '../components/CadastroHoteis';
import { slugify } from '../utils/slugify';
import { generateUniqueCnpj, quartosService } from './supabaseService';
import { evolutionApiService, generateHotelInstanceName } from './evolutionApiService';

export interface CriarHotelDemoParams {
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  hotelName: string;
  city: string;
  uf: string;
  whatsappPhone: string;
  criarQuartosExemplo?: boolean;
}

const LOCAL_STORAGE_DEMO_PREFIX = 'hotelnozap_partner_demo_';

export const QUARTOS_PADRAO_10_EXEMPLO = [
  // ==============================
  // 3 QUARTOS DE SOLTEIRO
  // ==============================
  {
    numero: '101',
    tipo: 'Solteiro',
    categoria: 'Standard',
    andar: '1º Andar',
    capacidade: 1,
    beds: 1,
    valor_diaria: 120.00,
    status: 'disponivel',
    observacoes: 'Quarto aconchegante com 1 cama de solteiro box, ar condicionado split, Wi-Fi 500MB, mesa de apoio e frigobar.',
    foto_capa: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&q=80&w=800',
    fotos: ['https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&q=80&w=800'],
    items: {
      categoria: 'Standard',
      tipoQuarto: 'Solteiro',
      comodidades: ['Ar Condicionado', 'Wi-Fi Grátis', 'Frigobar', 'Smart TV']
    },
    active: true
  },
  {
    numero: '102',
    tipo: 'Solteiro',
    categoria: 'Executivo',
    andar: '1º Andar',
    capacidade: 1,
    beds: 1,
    valor_diaria: 145.00,
    status: 'disponivel',
    observacoes: 'Ideal para viagens corporativas. Cama de solteiro especial, bancada de trabalho ergonômica, ar silencioso e ducha pressurizada.',
    foto_capa: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&q=80&w=800',
    fotos: ['https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&q=80&w=800'],
    items: {
      categoria: 'Executivo',
      tipoQuarto: 'Solteiro',
      comodidades: ['Ar Condicionado', 'Wi-Fi 500MB', 'Bancada de Trabalho', 'Smart TV', 'Frigobar']
    },
    active: true
  },
  {
    numero: '103',
    tipo: 'Solteiro',
    categoria: 'Standard',
    andar: '1º Andar',
    capacidade: 1,
    beds: 1,
    valor_diaria: 120.00,
    status: 'disponivel',
    observacoes: 'Quarto prático e confortável para viajantes solo. Roupa de cama premium, cortinas blackout e ambiente silencioso.',
    foto_capa: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&q=80&w=800',
    fotos: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&q=80&w=800'],
    items: {
      categoria: 'Standard',
      tipoQuarto: 'Solteiro',
      comodidades: ['Ar Condicionado', 'Wi-Fi Grátis', 'Frigobar']
    },
    active: true
  },

  // ==============================
  // 4 QUARTOS DE CASAL
  // ==============================
  {
    numero: '201',
    tipo: 'Casal',
    categoria: 'Standard',
    andar: '2º Andar',
    capacidade: 2,
    beds: 1,
    valor_diaria: 180.00,
    status: 'disponivel',
    observacoes: 'Apartamento casal standard com cama queen, ar-condicionado split, Wi-Fi rápido e iluminação acolhedora.',
    foto_capa: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&q=80&w=800',
    fotos: ['https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&q=80&w=800'],
    items: {
      categoria: 'Standard',
      tipoQuarto: 'Casal',
      comodidades: ['Cama Queen', 'Ar Condicionado', 'Wi-Fi', 'Smart TV 43"', 'Frigobar']
    },
    active: true
  },
  {
    numero: '202',
    tipo: 'Casal',
    categoria: 'Luxo',
    andar: '2º Andar',
    capacidade: 2,
    beds: 1,
    valor_diaria: 240.00,
    status: 'disponivel',
    observacoes: 'Suíte charmosa com cama queen size, ar condicionado split, varanda privativa com vista e amenities especiais.',
    foto_capa: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&q=80&w=800',
    fotos: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&q=80&w=800'],
    items: {
      categoria: 'Luxo',
      tipoQuarto: 'Casal',
      comodidades: ['Cama Queen', 'Varanda Privativa', 'Ar Condicionado', 'Smart TV 50"', 'Frigobar', 'Cafeteira']
    },
    active: true
  },
  {
    numero: '203',
    tipo: 'Casal',
    categoria: 'Master',
    andar: '2º Andar',
    capacidade: 2,
    beds: 1,
    valor_diaria: 280.00,
    status: 'disponivel',
    observacoes: 'Suíte Casal Master com cama King Size, enxoval 300 fios, banheira de hidromassagem e iluminação cênica.',
    foto_capa: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=80&w=800',
    fotos: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=80&w=800'],
    items: {
      categoria: 'Master',
      tipoQuarto: 'Casal',
      comodidades: ['Cama King Size', 'Banheira Hidro', 'Varanda', 'Smart TV 55"', 'Ar Inverter', 'Frigobar']
    },
    active: true
  },
  {
    numero: '204',
    tipo: 'Casal',
    categoria: 'Standard',
    andar: '2º Andar',
    capacidade: 2,
    beds: 1,
    valor_diaria: 180.00,
    status: 'disponivel',
    observacoes: 'Quarto casal moderno, decorado em tons neutros, isolamento acústico e colchão com pillow top.',
    foto_capa: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&q=80&w=800',
    fotos: ['https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&q=80&w=800'],
    items: {
      categoria: 'Standard',
      tipoQuarto: 'Casal',
      comodidades: ['Cama de Casal', 'Ar Condicionado', 'Wi-Fi', 'Smart TV', 'Frigobar']
    },
    active: true
  },

  // ==============================
  // 3 QUARTOS TRIPLOS
  // ==============================
  {
    numero: '301',
    tipo: 'Triplo',
    categoria: 'Família',
    andar: '3º Andar',
    capacidade: 3,
    beds: 2,
    valor_diaria: 290.00,
    status: 'disponivel',
    observacoes: 'Suíte Tripla Família composta por 1 cama de casal e 1 cama de solteiro. Amplo espaço, frigobar grande e guarda-roupa.',
    foto_capa: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&q=80&w=800',
    fotos: ['https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&q=80&w=800'],
    items: {
      categoria: 'Família',
      tipoQuarto: 'Triplo',
      comodidades: ['1 Cama Casal + 1 Solteiro', 'Ar Condicionado', 'Smart TV 50"', 'Frigobar', 'Wi-Fi']
    },
    active: true
  },
  {
    numero: '302',
    tipo: 'Triplo',
    categoria: 'Standard',
    andar: '3º Andar',
    capacidade: 3,
    beds: 3,
    valor_diaria: 270.00,
    status: 'disponivel',
    observacoes: 'Apartamento Triplo com 3 camas individuais de solteiro. Excelente opção para grupos, amigos ou viagens corporativas.',
    foto_capa: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&q=80&w=800',
    fotos: ['https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&q=80&w=800'],
    items: {
      categoria: 'Standard',
      tipoQuarto: 'Triplo',
      comodidades: ['3 Camas de Solteiro', 'Ar Condicionado', 'Wi-Fi 500MB', 'Tomadas Individuais', 'Frigobar']
    },
    active: true
  },
  {
    numero: '303',
    tipo: 'Triplo',
    categoria: 'Superior',
    andar: '3º Andar',
    capacidade: 3,
    beds: 2,
    valor_diaria: 320.00,
    status: 'disponivel',
    observacoes: 'Suíte Tripla Superior com 1 cama Queen e 1 de solteiro, vista panorâmica da cidade, varanda e acabamento refinado.',
    foto_capa: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&q=80&w=800',
    fotos: ['https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&q=80&w=800'],
    items: {
      categoria: 'Superior',
      tipoQuarto: 'Triplo',
      comodidades: ['1 Cama Queen + 1 Solteiro', 'Varanda Panorâmica', 'Ar Inverter', 'Smart TV', 'Frigobar']
    },
    active: true
  }
];

/**
 * Função utilitária para cadastrar os 10 quartos padrão (3 solteiro, 4 casal, 3 triplo) para um hotel
 */
export async function cadastrar10QuartosPadrao(hotelId: string): Promise<boolean> {
  if (!hotelId) return false;
  try {
    const rowsToInsert = QUARTOS_PADRAO_10_EXEMPLO.map(q => ({
      hotel_id: hotelId,
      numero: q.numero,
      tipo: q.tipo,
      andar: q.andar,
      status: q.status,
      capacidade: q.capacidade,
      valor_diaria: q.valor_diaria,
      observacoes: q.observacoes,
      fotos: q.fotos,
      foto_capa: q.foto_capa,
      items: q.items,
      beds: q.beds,
      active: q.active
    }));

    const { error: errQuartos } = await supabase.from('quartos').insert(rowsToInsert);
    if (errQuartos) {
      console.warn('[cadastrar10QuartosPadrao] Tentando fallback simplificado:', errQuartos.message);
      const simplified = rowsToInsert.map(r => ({
        hotel_id: r.hotel_id,
        numero: r.numero,
        tipo: r.tipo,
        andar: r.andar,
        status: r.status,
        capacidade: r.capacidade,
        valor_diaria: r.valor_diaria,
        observacoes: r.observacoes
      }));
      await supabase.from('quartos').insert(simplified);
    }

    // Cache local de quartos
    try {
      const syncedLocal = QUARTOS_PADRAO_10_EXEMPLO.map((q, idx) => ({
        id: `seed_${hotelId}_${q.numero}_${idx}`,
        hotel_id: hotelId,
        number: q.numero,
        name: `Quarto ${q.numero} (${q.tipo})`,
        category: q.categoria,
        categoria: q.categoria,
        status: 'livre',
        floor: q.andar,
        capacity: q.capacidade,
        dailyPrice: q.valor_diaria,
        active: true,
        photos: q.fotos,
        fotoCapa: q.foto_capa,
        imageUrl: q.foto_capa,
        notes: q.observacoes,
        observacoes: q.observacoes,
        items: q.items,
        comodidades: q.items.comodidades,
        beds: q.beds,
        type: q.tipo,
        tipoQuarto: q.tipo
      }));
      quartosService.saveLocalQuartos(syncedLocal, hotelId);
    } catch {}

    return true;
  } catch (err) {
    console.warn('[cadastrar10QuartosPadrao] Erro:', err);
    return false;
  }
}

export const partnerDemoHotelService = {
  /**
   * Busca o hotel de demonstração vinculado ao parceiro no Supabase
   */
  async buscarHotelDemo(partnerId?: string, partnerEmail?: string): Promise<Hotel | null> {
    // 1. Tentar ler do cache local primeiro para resposta instantânea
    try {
      if (partnerId) {
        const cached = localStorage.getItem(`${LOCAL_STORAGE_DEMO_PREFIX}${partnerId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.id) return parsed;
        }
      }
      if (partnerEmail) {
        const cachedEmail = localStorage.getItem(`${LOCAL_STORAGE_DEMO_PREFIX}${partnerEmail.toLowerCase().trim()}`);
        if (cachedEmail) {
          const parsed = JSON.parse(cachedEmail);
          if (parsed && parsed.id) return parsed;
        }
      }
      const cachedActive = localStorage.getItem('hotelnozap_partner_demo_active');
      if (cachedActive) {
        const parsed = JSON.parse(cachedActive);
        if (parsed && parsed.id) return parsed;
      }
    } catch {}

    if (!partnerId && !partnerEmail) return null;

    try {
      // 2. Buscar no Supabase por tag em observações ou email de login
      let query = supabase.from('hoteis').select('*');

      if (partnerId && partnerEmail) {
        query = query.or(`observacoes.ilike.%[DEMO_PARCEIRO_${partnerId}]%,email_login.ilike.${partnerEmail}`);
      } else if (partnerId) {
        query = query.ilike('observacoes', `%[DEMO_PARCEIRO_${partnerId}]%`);
      } else if (partnerEmail) {
        query = query.ilike('email_login', partnerEmail);
      }

      const { data, error } = await query.order('criado_em', { ascending: false }).limit(10);

      if (!error && Array.isArray(data) && data.length > 0) {
        // Encontrar o hotel demo do parceiro
        const demoFound = data.find((h: any) => 
          (h.observacoes && h.observacoes.includes(`[DEMO_PARCEIRO_${partnerId}]`)) ||
          (h.observacoes && h.observacoes.includes('[DEMO]')) ||
          (h.email_login && partnerEmail && h.email_login.toLowerCase() === partnerEmail.toLowerCase())
        );

        if (demoFound) {
          const hotelName = demoFound.nome || demoFound.name || 'Hotel Demo';
          const formatted: Hotel = {
            id: demoFound.id,
            name: hotelName,
            category: demoFound.categoria || demoFound.category || 'Pousada',
            city: demoFound.cidade || demoFound.city || 'Sua Cidade',
            uf: demoFound.uf || 'MT',
            cityUf: (demoFound.cidade && demoFound.uf) ? `${demoFound.cidade} / ${demoFound.uf}` : (demoFound.cidade || demoFound.uf || 'MT'),
            neighborhood: demoFound.bairro || demoFound.neighborhood || 'Centro',
            imageUrl: demoFound.url_imagem || demoFound.image_url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1000',
            rating: 5.0,
            reviewsCount: 28,
            pricePerNight: 180,
            whatsappPhone: demoFound.whatsapp || demoFound.telefone_gerente || '',
            whatsapp: demoFound.whatsapp || '',
            capacity: Number(demoFound.capacidade) || 10,
            status: demoFound.status || 'ativo',
            plan: demoFound.plano || 'Parceiro VIP (12 Meses)',
            slug: demoFound.link ? demoFound.link.replace('/hotel/', '').replace('/hoteis/', '') : slugify(hotelName),
            cnpj: demoFound.cnpj || '00.000.000/0001-99',
            whatsappInstances: Number(demoFound.instancias_whatsapp) || 1,
            managerName: demoFound.nome_gerente || 'Gestor Franqueado',
            notes: demoFound.observacoes || '',
            is_demo: true,
            partner_id: partnerId
          };

          if (partnerId) {
            localStorage.setItem(`${LOCAL_STORAGE_DEMO_PREFIX}${partnerId}`, JSON.stringify(formatted));
          }
          return formatted;
        }
      }
    } catch (err) {
      console.warn('[partnerDemoHotelService] Erro ao buscar hotel demo no Supabase:', err);
    }

    return null;
  },

  /**
   * Cria o hotel de demonstração e 10 quartos de exemplo (3 solteiro, 4 casal, 3 triplo) no Supabase
   */
  async criarHotelDemo(params: CriarHotelDemoParams): Promise<Hotel> {
    const rawSlug = slugify(params.hotelName);
    const uniqueSlug = `${rawSlug}-${Math.random().toString(36).substring(2, 6)}`;
    const cleanPhone = (params.whatsappPhone || '').replace(/\D/g, '');
    const cnpjGerado = generateUniqueCnpj();
    const instanceName = generateHotelInstanceName(params.hotelName.trim());

    // Criar instância na Evolution API conforme a regra oficial
    try {
      await evolutionApiService.createInstance(instanceName, { qrcode: true });
    } catch (e) {
      console.warn('[partnerDemoHotelService] Falha ao criar instância na Evolution API:', e);
    }

    // Mapeamento exato de colunas em português para a tabela 'hoteis' do Supabase
    const hotelPayload: Record<string, any> = {
      nome: params.hotelName.trim(),
      razao_social: `${params.hotelName.trim()} LTDA (Demonstração)`,
      categoria: 'Pousada',
      cnpj: cnpjGerado,
      cidade: params.city.trim(),
      uf: params.uf.trim().toUpperCase(),
      bairro: 'Centro / Turístico',
      url_imagem: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1000',
      whatsapp: cleanPhone,
      telefone_gerente: cleanPhone,
      nome_gerente: params.partnerName || 'Gestor Franqueado',
      email_login: params.partnerEmail.toLowerCase().trim(),
      capacidade: 10,
      status: 'ativo',
      plano: 'Parceiro VIP (12 Meses)',
      instancias_whatsapp: 1,
      nome_instancia: instanceName,
      link: `/hotel/${uniqueSlug}`,
      observacoes: `[DEMO_PARCEIRO_${params.partnerId}] [DEMO] Hotel de Demonstração do Franqueado ${params.partnerName}`,
      parceiro_referencia: params.partnerId
    };

    let hotelCriadoId = '';

    // 1. Gravar hotel diretamente no Supabase
    try {
      let result = await supabase.from('hoteis').insert([hotelPayload]).select('*').single();
      let error = result.error;
      let data = result.data;

      // Fallback: se a coluna parceiro_referencia não existir ainda no banco (código 42703)
      if (error && (error.code === '42703' || error.message?.includes('parceiro_referencia'))) {
        delete hotelPayload.parceiro_referencia;
        const retry = await supabase.from('hoteis').insert([hotelPayload]).select('*').single();
        error = retry.error;
        data = retry.data;
      }

      // Fallback: se houver colisão de CNPJ (código 23505)
      if (error && (error.code === '23505' || error.message?.includes('hoteis_cnpj_key'))) {
        hotelPayload.cnpj = generateUniqueCnpj();
        const retryCnpj = await supabase.from('hoteis').insert([hotelPayload]).select('*').single();
        error = retryCnpj.error;
        data = retryCnpj.data;
      }

      if (!error && data && data.id) {
        hotelCriadoId = data.id;
      } else if (error) {
        console.error('[partnerDemoHotelService] Erro ao cadastrar hotel demo no Supabase:', error);
      }
    } catch (e) {
      console.error('[partnerDemoHotelService] Exceção ao gravar hotel demo no Supabase:', e);
    }

    // Se o Supabase falhar completamente (ex: sem internet), gera ID local temporário
    if (!hotelCriadoId) {
      hotelCriadoId = `demo_${Date.now()}`;
    }

    const hotelFinal: Hotel = {
      id: hotelCriadoId,
      name: params.hotelName.trim(),
      category: 'Pousada',
      city: params.city.trim(),
      uf: params.uf.trim().toUpperCase(),
      cityUf: `${params.city.trim()} / ${params.uf.trim().toUpperCase()}`,
      neighborhood: 'Centro / Turístico',
      imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1000',
      rating: 5.0,
      reviewsCount: 28,
      pricePerNight: 180,
      whatsappPhone: cleanPhone,
      whatsapp: cleanPhone,
      capacity: 10,
      whatsappInstances: 1,
      cnpj: cnpjGerado,
      managerName: params.partnerName || 'Gestor Franqueado',
      status: 'ativo',
      plan: 'Parceiro VIP (12 Meses)',
      slug: uniqueSlug,
      notes: hotelPayload.observacoes,
      is_demo: true,
      partner_id: params.partnerId
    };

    // 2. Salvar no cache local para disponibilidade imediata na UI
    try {
      if (params.partnerId) {
        localStorage.setItem(`${LOCAL_STORAGE_DEMO_PREFIX}${params.partnerId}`, JSON.stringify(hotelFinal));
      }
      if (params.partnerEmail) {
        localStorage.setItem(`${LOCAL_STORAGE_DEMO_PREFIX}${params.partnerEmail.toLowerCase().trim()}`, JSON.stringify(hotelFinal));
      }
      localStorage.setItem('hotelnozap_partner_demo_active', JSON.stringify(hotelFinal));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('partner_demo_hotel_updated', { detail: hotelFinal }));
      }
    } catch {}

    // 3. Cadastrar 10 Quartos de Exemplo (3 Solteiro, 4 Casal, 3 Triplo) no Supabase
    if (params.criarQuartosExemplo !== false && hotelCriadoId && !hotelCriadoId.startsWith('demo_')) {
      await cadastrar10QuartosPadrao(hotelCriadoId);
    }

    return hotelFinal;
  }
};
