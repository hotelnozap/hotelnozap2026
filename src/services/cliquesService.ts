import { supabase } from '../lib/supabase';

export interface CliqueWhatsappGoogle {
  id?: string;
  hotel_id?: string;
  hotel_name: string;
  hotel_city?: string;
  hotel_uf?: string;
  hotel_phone?: string;
  origem?: string;
  referrer?: string;
  user_agent?: string;
  created_at?: string;
}

export interface MetricasCliquesGoogle {
  totalCliques: number;
  totalHoteisDistintos: number;
  rankingHoteis: Array<{
    hotel_name: string;
    hotel_id?: string;
    hotel_city?: string;
    hotel_uf?: string;
    hotel_phone?: string;
    total_cliques: number;
    ultimo_clique: string;
  }>;
  ultimosCliques: CliqueWhatsappGoogle[];
}

const LOCAL_STORAGE_KEY = 'hotelnozap_cliques_google_fallback';

export const cliquesService = {
  /**
   * Registra um novo clique no WhatsApp de um hotel importado do Google
   */
  async registrarCliqueWhatsappGoogle(dados: {
    hotel_id?: string;
    hotel_name: string;
    hotel_city?: string;
    hotel_uf?: string;
    hotel_phone?: string;
    origem?: string;
  }): Promise<void> {
    const novoClique: CliqueWhatsappGoogle = {
      hotel_id: dados.hotel_id,
      hotel_name: dados.hotel_name,
      hotel_city: dados.hotel_city || '',
      hotel_uf: dados.hotel_uf || '',
      hotel_phone: dados.hotel_phone || '',
      origem: dados.origem || 'pagina_hotel_google',
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      created_at: new Date().toISOString()
    };

    // 1. Salvar no LocalStorage para cache imediato e offline fallback
    try {
      const locaisRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const lista: CliqueWhatsappGoogle[] = locaisRaw ? JSON.parse(locaisRaw) : [];
      lista.unshift({ ...novoClique, id: `local_${Date.now()}` });
      // Mantém últimos 200 no cache local
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lista.slice(0, 200)));
    } catch (e) {
      console.warn('[CliquesService] Erro ao salvar cache local:', e);
    }

    // 2. Gravar no Supabase
    try {
      const { error } = await supabase
        .from('cliques_whatsapp_google')
        .insert([{
          hotel_id: dados.hotel_id || null,
          hotel_name: dados.hotel_name,
          hotel_city: dados.hotel_city || null,
          hotel_uf: dados.hotel_uf || null,
          hotel_phone: dados.hotel_phone || null,
          origem: dados.origem || 'pagina_hotel_google',
          referrer: novoClique.referrer,
          user_agent: novoClique.user_agent
        }]);

      if (error) {
        console.warn('[CliquesService] Aviso ao gravar no Supabase (verifique se a tabela foi criada):', error.message);
      }
    } catch (err) {
      console.warn('[CliquesService] Erro de rede ao gravar no Supabase:', err);
    }
  },

  /**
   * Obtém as métricas e a lista de cliques consolidados
   */
  async obterMetricas(): Promise<MetricasCliquesGoogle> {
    let listaSupabase: CliqueWhatsappGoogle[] = [];

    // Tentar ler do Supabase
    try {
      const { data, error } = await supabase
        .from('cliques_whatsapp_google')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      if (!error && Array.isArray(data)) {
        listaSupabase = data;
      }
    } catch (err) {
      console.warn('[CliquesService] Erro ao consultar Supabase:', err);
    }

    // Mesclar com cache local para nunca perder eventos recentes
    let todos: CliqueWhatsappGoogle[] = [...listaSupabase];
    try {
      const locaisRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (locaisRaw) {
        const locais: CliqueWhatsappGoogle[] = JSON.parse(locaisRaw);
        locais.forEach(l => {
          const jaExiste = todos.some(s => 
            s.hotel_name === l.hotel_name && 
            Math.abs(new Date(s.created_at || '').getTime() - new Date(l.created_at || '').getTime()) < 3000
          );
          if (!jaExiste) {
            todos.push(l);
          }
        });
      }
    } catch {}

    // Ordenar por data decrescente
    todos.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    // Agrupamento por hotel
    const mapaHoteis = new Map<string, {
      hotel_name: string;
      hotel_id?: string;
      hotel_city?: string;
      hotel_uf?: string;
      hotel_phone?: string;
      total_cliques: number;
      ultimo_clique: string;
    }>();

    todos.forEach(item => {
      const chave = item.hotel_name.trim().toLowerCase();
      const existente = mapaHoteis.get(chave);
      if (existente) {
        existente.total_cliques += 1;
        if (new Date(item.created_at || 0).getTime() > new Date(existente.ultimo_clique).getTime()) {
          existente.ultimo_clique = item.created_at || existente.ultimo_clique;
        }
      } else {
        mapaHoteis.set(chave, {
          hotel_name: item.hotel_name,
          hotel_id: item.hotel_id,
          hotel_city: item.hotel_city,
          hotel_uf: item.hotel_uf,
          hotel_phone: item.hotel_phone,
          total_cliques: 1,
          ultimo_clique: item.created_at || new Date().toISOString()
        });
      }
    });

    const rankingHoteis = Array.from(mapaHoteis.values()).sort((a, b) => b.total_cliques - a.total_cliques);

    return {
      totalCliques: todos.length,
      totalHoteisDistintos: rankingHoteis.length,
      rankingHoteis,
      ultimosCliques: todos.slice(0, 50)
    };
  },

  /**
   * Gera o link do WhatsApp para o Everaldo abordar o dono do hotel com mensagem persuasiva
   */
  gerarLinkAbordagem(hotel: { hotel_name: string; hotel_phone?: string; hotel_city?: string; total_cliques?: number }): string {
    const raw = (hotel.hotel_phone || '').replace(/\D/g, '');
    const cleanPhone = raw.startsWith('55') ? raw : (raw ? `55${raw}` : '');
    if (!cleanPhone) return '';

    const qtd = hotel.total_cliques && hotel.total_cliques > 1 ? `${hotel.total_cliques} hóspedes` : 'hóspedes';
    const cidade = hotel.hotel_city ? ` em ${hotel.hotel_city}` : '';

    const texto = `Olá! Aqui é o *Everaldo Souza*, fundador do *Hotel no Zap* aqui de MT.
Passei para avisar que registramos ${qtd} no nosso portal buscando o WhatsApp do *${hotel.hotel_name}*${cidade} para consultar valores de diárias e reservas!

Como criamos uma página oficial para o seu hotel no portal, a demanda já está chegando direta para vocês.

Se quiser, posso ativar a Inteligência Artificial e a Gestão de Reservas no seu WhatsApp gratuitamente para você não perder essas vendas diretas sem pagar comissão.

Você pode dar uma olhada e ativar por aqui:
🔗 https://lp.hotelnozap.com.br`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(texto)}`;
  }
};
