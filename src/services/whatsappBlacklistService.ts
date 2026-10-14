import { supabase } from '../lib/supabase';

export interface WhatsappBlacklistEntry {
  id: string;
  hotel_id: string;
  telefone: string;
  nome?: string;
  motivo?: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export const whatsappBlacklistService = {
  /**
   * Busca todas as entradas da blacklist para um hotel específico
   */
  async getBlacklistByHotelId(hotelId: string): Promise<WhatsappBlacklistEntry[]> {
    if (!hotelId) return [];
    try {
      const { data, error } = await supabase
        .from('whatsapp_blacklist')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false });

      if (error) {
        // Se a tabela ainda não existir no Supabase, retorna vazio graciosamente
        console.warn('Aviso ao consultar whatsapp_blacklist no Supabase:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('Exceção ao carregar whatsapp_blacklist:', err);
      return [];
    }
  },

  /**
   * Adiciona um novo número à blacklist do hotel
   */
  async addBlacklistEntry(entry: {
    hotel_id: string;
    telefone: string;
    nome?: string;
    motivo?: string;
    ativo?: boolean;
  }): Promise<WhatsappBlacklistEntry | null> {
    try {
      const cleanPhone = String(entry.telefone || '').replace(/\D/g, '');
      const payload = {
        hotel_id: entry.hotel_id,
        telefone: cleanPhone,
        nome: (entry.nome || '').trim(),
        motivo: (entry.motivo || 'Familiar / Pessoal').trim(),
        ativo: entry.ativo ?? true,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('whatsapp_blacklist')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('Erro ao adicionar na whatsapp_blacklist:', error);
        throw error;
      }
      return data;
    } catch (err) {
      console.error('Falha ao inserir na whatsapp_blacklist:', err);
      throw err;
    }
  },

  /**
   * Atualiza uma entrada da blacklist (ex: ativar/desativar ou editar nome/motivo)
   */
  async updateBlacklistEntry(
    id: string,
    updates: Partial<Omit<WhatsappBlacklistEntry, 'id' | 'hotel_id' | 'created_at'>>
  ): Promise<WhatsappBlacklistEntry | null> {
    try {
      const payload: any = { ...updates, updated_at: new Date().toISOString() };
      if (payload.telefone) {
        payload.telefone = String(payload.telefone).replace(/\D/g, '');
      }

      const { data, error } = await supabase
        .from('whatsapp_blacklist')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar whatsapp_blacklist:', error);
        throw error;
      }
      return data;
    } catch (err) {
      console.error('Falha ao atualizar whatsapp_blacklist:', err);
      throw err;
    }
  },

  /**
   * Remove um número da blacklist
   */
  async deleteBlacklistEntry(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('whatsapp_blacklist')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao deletar da whatsapp_blacklist:', error);
        throw error;
      }
      return true;
    } catch (err) {
      console.error('Falha ao remover da whatsapp_blacklist:', err);
      return false;
    }
  },

  /**
   * Checagem rápida se um telefone está na blacklist ativa de um hotel
   */
  async checkIsBlacklisted(hotelId: string, phone: string): Promise<boolean> {
    if (!hotelId || !phone) return false;
    const clean = phone.replace(/\D/g, '');
    const last8 = clean.slice(-8);

    try {
      const { data, error } = await supabase
        .from('whatsapp_blacklist')
        .select('id')
        .eq('hotel_id', hotelId)
        .eq('ativo', true)
        .or(`telefone.eq.${clean},telefone.ilike.%${last8}`)
        .limit(1);

      if (error || !data) return false;
      return data.length > 0;
    } catch {
      return false;
    }
  }
};
