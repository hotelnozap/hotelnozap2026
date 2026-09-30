import { supabase } from '../lib/supabase';

export const HOTEL_URL_BASE = 'https://hotelnozap.com.br/hoteis/';

/**
 * Converte o nome do hotel em um slug limpo e padronizado:
 * - Letras minúsculas
 * - Sem acentos ou caracteres especiais
 * - Apenas caracteres alfanuméricos (a-z, 0-9)
 * Exemplo: "Pousada Recanto dos Corais!" -> "recantodoscorais"
 */
export const slugifyHotelName = (text: string): string => {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Retorna a URL canônica pública completa do hotel.
 * Formato oficial: https://hotelnozap.com.br/hoteis/nomedohotel
 */
export const formatHotelUrl = (slugOrName: string): string => {
  const cleanSlug = extractHotelSlug(slugOrName);
  return `${HOTEL_URL_BASE}${cleanSlug || 'nomedohotel'}`;
};

/**
 * Extrai apenas o slug limpo de uma URL ou caminho relativo.
 * Suporta formatos:
 * - "https://hotelnozap.com.br/hoteis/nomedohotel"
 * - "/hoteis/nomedohotel"
 * - "nomedohotel"
 */
export const extractHotelSlug = (urlOrSlug: string): string => {
  if (!urlOrSlug) return '';
  let str = urlOrSlug.trim();
  // Remove protocolo e domínio
  str = str.replace(/^https?:\/\/[^\/]+/i, '');
  // Remove prefixos /hoteis/ ou /hotel/
  str = str.replace(/^\/?(hoteis|hotel)\/?/i, '');
  // Limpa para apenas alfanumérico
  return slugifyHotelName(str);
};

export interface HotelUrlValidationResult {
  slug: string;
  fullUrl: string;
  isAvailable: boolean;
  message: string;
}

/**
 * Gera uma URL única inteligente para um novo hotel ou edição,
 * garantindo que não colida com nenhum hotel existente na rede.
 * Se o slug já existir, adiciona sufixo numérico (ex: "hotelteste2", "hotelteste3").
 */
export const generateUniqueHotelUrl = (
  hotelName: string,
  existingHoteis: Array<{ id?: string; link?: string; name?: string }> = [],
  currentHotelId?: string
): string => {
  const baseSlug = slugifyHotelName(hotelName) || 'hotel';

  // Coleta todos os slugs já em uso por outros hotéis
  const takenSlugs = new Set<string>();
  for (const h of existingHoteis) {
    if (currentHotelId && h.id === currentHotelId) continue;
    if (h.link) {
      const s = extractHotelSlug(h.link);
      if (s) takenSlugs.add(s);
    }
  }

  // Se o slug base está livre, usa ele
  if (!takenSlugs.has(baseSlug)) {
    return `${HOTEL_URL_BASE}${baseSlug}`;
  }

  // Caso contrário, busca o próximo número disponível
  let counter = 2;
  while (takenSlugs.has(`${baseSlug}${counter}`)) {
    counter++;
  }

  return `${HOTEL_URL_BASE}${baseSlug}${counter}`;
};

/**
 * Verifica se uma URL / slug está disponível entre os hotéis cadastrados.
 */
export const isHotelUrlAvailable = (
  urlOrSlug: string,
  existingHoteis: Array<{ id?: string; link?: string; name?: string }> = [],
  currentHotelId?: string
): boolean => {
  const targetSlug = extractHotelSlug(urlOrSlug);
  if (!targetSlug) return false;

  for (const h of existingHoteis) {
    if (currentHotelId && h.id === currentHotelId) continue;
    if (h.link) {
      const s = extractHotelSlug(h.link);
      if (s === targetSlug) return false;
    }
  }
  return true;
};

/**
 * Checagem assíncrona inteligente no Supabase para garantir unicidade em tempo real.
 */
export const checkHotelUrlAvailabilityInSupabase = async (
  urlOrSlug: string,
  currentHotelId?: string
): Promise<boolean> => {
  const targetSlug = extractHotelSlug(urlOrSlug);
  if (!targetSlug) return false;

  try {
    let query = supabase
      .from('hoteis')
      .select('id, link')
      .ilike('link', `%${targetSlug}%`);

    if (currentHotelId) {
      query = query.neq('id', currentHotelId);
    }

    const { data, error } = await query;
    if (error || !data) return true;

    // Confirma se o slug bate exatamente após extração
    const collision = data.some(row => extractHotelSlug(row.link || '') === targetSlug);
    return !collision;
  } catch {
    return true;
  }
};
