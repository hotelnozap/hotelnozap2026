import { supabase } from '../lib/supabase';
import { Hotel } from '../components/CadastroHoteis';
import { slugify } from '../utils/slugify';

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

export const partnerDemoHotelService = {
  /**
   * Busca o hotel de demonstração vinculado ao parceiro
   */
  async buscarHotelDemo(partnerId?: string, partnerEmail?: string): Promise<Hotel | null> {
    // 1. Tentar ler do cache local primeiro
    if (partnerId) {
      try {
        const cached = localStorage.getItem(`${LOCAL_STORAGE_DEMO_PREFIX}${partnerId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.id) return parsed;
        }
      } catch {}
    }

    if (!partnerId && !partnerEmail) return null;

    try {
      // 2. Buscar no Supabase por partner_id ou email_login ou notes
      let query = supabase.from('hoteis').select('*');

      if (partnerId && partnerEmail) {
        query = query.or(`partner_id.eq.${partnerId},email_login.ilike.${partnerEmail},notes.ilike.%[DEMO_PARCEIRO_${partnerId}]%`);
      } else if (partnerId) {
        query = query.or(`partner_id.eq.${partnerId},notes.ilike.%[DEMO_PARCEIRO_${partnerId}]%`);
      } else if (partnerEmail) {
        query = query.ilike('email_login', partnerEmail);
      }

      const { data, error } = await query.limit(5);

      if (!error && Array.isArray(data) && data.length > 0) {
        // Encontrar o que é demo
        const demoFound = data.find((h: any) => 
          h.is_demo === true || 
          h.isDemo === true || 
          (h.notes && h.notes.includes('[DEMO_PARCEIRO')) ||
          (h.plan && h.plan.toLowerCase().includes('demo'))
        );

        if (demoFound) {
          const formatted: Hotel = {
            id: demoFound.id,
            name: demoFound.name,
            category: demoFound.category || 'Pousada',
            city: demoFound.city || 'Sua Cidade',
            uf: demoFound.uf || 'MT',
            cityUf: `${demoFound.city || ''} - ${demoFound.uf || ''}`,
            neighborhood: demoFound.neighborhood || 'Centro',
            imageUrl: demoFound.image_url || demoFound.imageUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1000',
            rating: Number(demoFound.rating) || 5.0,
            reviewsCount: Number(demoFound.reviews_count) || 28,
            pricePerNight: Number(demoFound.price_per_night) || 180,
            whatsappPhone: demoFound.whatsapp_phone || demoFound.whatsapp || demoFound.phone || '',
            capacity: demoFound.capacity || 20,
            status: demoFound.status || 'ativo',
            plan: demoFound.plan || 'Profissional',
            slug: demoFound.slug || slugify(demoFound.name),
            cnpj: demoFound.cnpj || '00.000.000/0001-99',
            whatsappInstances: demoFound.whatsapp_instances || 1,
            managerName: demoFound.manager_name || demoFound.managerName || 'Gestor Demo',
            is_demo: true
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
   * Cria o hotel de demonstração e quartos de exemplo para o parceiro
   */
  async criarHotelDemo(params: CriarHotelDemoParams): Promise<Hotel> {
    const rawSlug = slugify(params.hotelName);
    const uniqueSlug = `${rawSlug}-${Math.random().toString(36).substring(2, 6)}`;
    const cleanPhone = (params.whatsappPhone || '').replace(/\D/g, '');

    const hotelPayload: any = {
      name: params.hotelName.trim(),
      category: 'Pousada',
      city: params.city.trim(),
      uf: params.uf.trim().toUpperCase(),
      neighborhood: 'Bairro Nobre',
      image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1000',
      rating: 5.0,
      reviews_count: 28,
      price_per_night: 180,
      whatsapp: cleanPhone,
      whatsapp_phone: cleanPhone,
      phone: cleanPhone,
      capacity: 25,
      status: 'ativo',
      plan: 'Profissional',
      slug: uniqueSlug,
      email_login: params.partnerEmail.toLowerCase().trim(),
      notes: `[DEMO_PARCEIRO_${params.partnerId}] Hotel de Demonstração do Franqueado ${params.partnerName}`,
      is_demo: true,
      partner_id: params.partnerId
    };

    let hotelCriadoId = '';
    let hotelCriadoObj: any = null;

    // 1. Tentar gravar no Supabase com is_demo e partner_id
    try {
      const { data, error } = await supabase
        .from('hoteis')
        .insert([hotelPayload])
        .select()
        .single();

      if (!error && data) {
        hotelCriadoId = data.id;
        hotelCriadoObj = data;
      } else if (error) {
        console.warn('[partnerDemoHotelService] Falha inicial ao criar com colunas estendidas:', error.message);
        // Fallback: se is_demo ou partner_id ainda não existirem no schema do banco, tenta sem eles
        const fallbackPayload = { ...hotelPayload };
        delete fallbackPayload.is_demo;
        delete fallbackPayload.partner_id;

        const { data: dataFb, error: errFb } = await supabase
          .from('hoteis')
          .insert([fallbackPayload])
          .select()
          .single();

        if (!errFb && dataFb) {
          hotelCriadoId = dataFb.id;
          hotelCriadoObj = dataFb;
        } else {
          console.error('[partnerDemoHotelService] Erro no fallback de criação:', errFb);
        }
      }
    } catch (e) {
      console.error('[partnerDemoHotelService] Exceção ao criar hotel no Supabase:', e);
    }

    // Se o Supabase falhar completamente (ex: sem conexão), gera ID local temporário
    if (!hotelCriadoId) {
      hotelCriadoId = `demo_${Date.now()}`;
    }

    const hotelFinal: Hotel = {
      id: hotelCriadoId,
      name: params.hotelName.trim(),
      category: 'Pousada',
      city: params.city.trim(),
      uf: params.uf.trim().toUpperCase(),
      cityUf: `${params.city.trim()} - ${params.uf.trim().toUpperCase()}`,
      neighborhood: 'Bairro Nobre',
      imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1000',
      rating: 5.0,
      reviewsCount: 28,
      pricePerNight: 180,
      whatsappPhone: cleanPhone,
      capacity: 25,
      whatsappInstances: 1,
      cnpj: '00.000.000/0001-99',
      managerName: params.partnerName || 'Gestor Demo',
      status: 'ativo',
      plan: 'Profissional',
      slug: uniqueSlug,
      is_demo: true,
      partner_id: params.partnerId
    };

    // 2. Salvar no cache local para disponibilidade instantânea
    try {
      localStorage.setItem(`${LOCAL_STORAGE_DEMO_PREFIX}${params.partnerId}`, JSON.stringify(hotelFinal));
    } catch {}

    // 3. Cadastrar Quartos de Exemplo (se solicitado e se hotel foi criado no Supabase)
    if (params.criarQuartosExemplo !== false && hotelCriadoId && !hotelCriadoId.startsWith('demo_')) {
      try {
        const quartosExemplo = [
          {
            hotel_id: hotelCriadoId,
            number: '101',
            name: 'Suíte Casal Master com Varanda',
            category: 'Luxo',
            capacity: 2,
            daily_price: 240.00,
            price_per_night: 240.00,
            status: 'disponivel',
            description: 'Suíte charmosa com cama queen size, ar condicionado split, Smart TV, Wi-Fi 500MB, frigobar e varanda privativa.',
            image_url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&q=80&w=800',
            active: true
          },
          {
            hotel_id: hotelCriadoId,
            number: '102',
            name: 'Apartamento Casal Standard',
            category: 'Standard',
            capacity: 2,
            daily_price: 180.00,
            price_per_night: 180.00,
            status: 'disponivel',
            description: 'Confortável e silencioso, ideal para estadias de negócios ou descanso. Ar-condicionado, Wi-Fi e mesa de trabalho.',
            image_url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&q=80&w=800',
            active: true
          },
          {
            hotel_id: hotelCriadoId,
            number: '201',
            name: 'Suíte Família Superior',
            category: 'Família',
            capacity: 4,
            daily_price: 350.00,
            price_per_night: 350.00,
            status: 'disponivel',
            description: 'Espaçosa suíte para até 4 pessoas com 1 cama de casal e 2 camas de solteiro, frigobar, cofre e vista para o jardim.',
            image_url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=80&w=800',
            active: true
          }
        ];

        await supabase.from('quartos').insert(quartosExemplo);
      } catch (errQuartos) {
        console.warn('[partnerDemoHotelService] Aviso ao pré-cadastrar quartos de exemplo:', errQuartos);
      }
    }

    return hotelFinal;
  }
};
