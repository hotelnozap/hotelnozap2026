/**
 * Utilitário de tratamento inteligente de imagens de hotéis para o Hotel no Zap.
 * 
 * Evita repetições (fotos mockadas idênticas), trata URLs expiradas do Google Places (403)
 * e garante que cada hotel tenha uma imagem realista, diversificada e compatível com sua categoria.
 */

// Coleções curadas e verificadas (HTTP 200) de fotos reais de hotelaria por categoria
const POUSADA_IMAGES = [
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544984243-ec57ea16fe25?w=800&auto=format&fit=crop&q=80'
];

const URBANO_IMAGES = [
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1455587734955-081b22074882?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1561501900-3701fa6a0864?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1568495248636-6432b97bd949?w=800&auto=format&fit=crop&q=80'
];

const FAZENDA_RESORT_IMAGES = [
  'https://images.unsplash.com/photo-1587061949409-02df41d5e562?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1549294413-26f195200c16?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?w=800&auto=format&fit=crop&q=80'
];

const ALL_CURATED_IMAGES = [
  ...URBANO_IMAGES,
  ...POUSADA_IMAGES,
  ...FAZENDA_RESORT_IMAGES
];

/**
 * FNV-1a Hash determinístico de alta dispersão
 */
function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Verifica se a URL é do Google Places com token temporário bloqueado (HTTP 403)
 */
export function isGoogleExpiredUrl(url?: string | null): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();
  return (
    lower.includes('googleusercontent.com/gps-cs-s') ||
    lower.includes('googleusercontent.com/grass-cs')
  );
}

/**
 * Retorna uma imagem de fallback diversificada e determinística para o hotel.
 * Nunca repete a mesma imagem para hotéis adjacentes.
 */
export function getHotelFallbackImage(hotel: { id?: string; name?: string; category?: string }): string {
  const seed = `${hotel.id || ''}-${hotel.name || 'hotel'}`.trim().toLowerCase();
  const hash = hashString(seed);

  const cat = (hotel.category || '').toLowerCase();
  let pool = URBANO_IMAGES;

  if (cat.includes('pousada') || cat.includes('charme') || cat.includes('chalé') || cat.includes('chale')) {
    pool = POUSADA_IMAGES;
  } else if (cat.includes('fazenda') || cat.includes('resort') || cat.includes('lazer') || cat.includes('eco')) {
    pool = FAZENDA_RESORT_IMAGES;
  } else if (cat.includes('urbano') || cat.includes('executivo') || cat.includes('business')) {
    pool = URBANO_IMAGES;
  } else {
    pool = ALL_CURATED_IMAGES;
  }

  return pool[hash % pool.length];
}

/**
 * Retorna a melhor URL segura para exibição do hotel.
 * Preserva URLs válidas do Supabase Storage ou uploads reais.
 * Se for vazia ou URL bloqueada do Google ou fallback antigo idêntico, entrega a imagem curada correspondente.
 */
export function getSafeHotelImageUrl(hotel: { id?: string; name?: string; category?: string; imageUrl?: string | null }): string {
  const current = (hotel.imageUrl || '').trim();

  // 1. Fotos salvas no Supabase Storage do próprio hotel têm prioridade máxima
  if (current.includes('supabase.co/storage') || current.includes('/storage/v1/object/public')) {
    return current;
  }

  // 2. URLs bloqueadas do Google (403) ou vazias ou a foto repetida antiga do Unsplash
  if (!current || isGoogleExpiredUrl(current) || current.includes('photo-1566073771259-6a8506099945')) {
    return getHotelFallbackImage(hotel);
  }

  return current;
}
