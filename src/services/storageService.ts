import { supabase } from '../lib/supabase';

export const BUCKET_NAME = 'hotelnozap';

/**
 * Uploads an image file to the 'hotelnozap' Supabase Storage bucket.
 * @param file The image File object from input
 * @param folder Subfolder inside bucket e.g. 'hoteis', 'usuarios', 'produtos', 'quartos/fotos'
 * @returns The public URL of the uploaded image or null if upload fails
 */
export async function uploadImageToStorage(file: File, folder: string = 'geral'): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'image/jpeg'
      });

    if (error) {
      console.error(`Erro ao fazer upload da imagem no bucket '${BUCKET_NAME}':`, error);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error(`Erro de conexão com o bucket '${BUCKET_NAME}':`, err);
    return null;
  }
}

/**
 * Faz o upload e organização de arquivos de vídeo no bucket 'hotelnozap' do Supabase.
 * Organiza os arquivos na pasta estruturada 'quartos/videos'.
 * @param file Arquivo de vídeo (MP4, WebM, MOV, OGG, etc.)
 * @param folder Pasta estruturada dentro do bucket (padrão: 'quartos/videos')
 * @returns URL pública do vídeo ou null em caso de falha
 */
export async function uploadVideoToStorage(
  file: File,
  folder: string = 'quartos/videos'
): Promise<string | null> {
  try {
    const fileExt = (file.name.split('.').pop() || 'mp4').toLowerCase();
    const cleanBaseName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 30);
    
    // Organização no bucket: quartos/videos/[timestamp]_[nome_limpo].[ext]
    const fileName = `${folder}/${Date.now()}_${cleanBaseName}.${fileExt}`;

    // Determina mimeType correto do vídeo
    let mimeType = file.type || 'video/mp4';
    if (!mimeType.startsWith('video/')) {
      if (fileExt === 'mp4') mimeType = 'video/mp4';
      else if (fileExt === 'webm') mimeType = 'video/webm';
      else if (fileExt === 'mov') mimeType = 'video/quicktime';
      else if (fileExt === 'ogg' || fileExt === 'ogv') mimeType = 'video/ogg';
    }

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '86400',
        upsert: true,
        contentType: mimeType
      });

    if (error) {
      console.error(`Erro ao fazer upload do vídeo no bucket '${BUCKET_NAME}' em '${folder}':`, error);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error(`Erro de conexão ao enviar vídeo para o bucket '${BUCKET_NAME}':`, err);
    return null;
  }
}
