import { supabase } from '../lib/supabase';
import { Usuario } from '../components/ListagemUsuarios';
import { Hotel } from '../components/CadastroHoteis';
import { Partner } from '../components/ListagemParceiros';
import { GuestData } from '../components/ListagemHospedes';
import { ProductData } from '../components/ListagemProdutos';
export type { ProductData };
import { RoomTypeData } from '../components/ListagemTiposQuartos';
import { Reserva } from '../components/ListagemReservas';
import { caixaService } from './caixaService';
import { formatPhoneEvolution, maskPhone } from '../utils/masks';
import { HotelConfigData } from '../types/database';

export type { RoomTypeData, Reserva, HotelConfigData };

// ─────────────────────────────────────────────────────────────────────────────
// Multi-tenant: Hotel Ativo & Gestão por Hotel
// ─────────────────────────────────────────────────────────────────────────────
export interface HotelAtivo {
  id: string;
  name: string;
  category: string;
  cityUf: string;
  city?: string;
  uf?: string;
  cnpj: string;
  status: string;
  imageUrl?: string;
  link?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  whatsapp?: string;
  cep?: string;
  street?: string;
  streetNumber?: string;
  neighborhood?: string;
  plan?: string;
  capacity?: number;
  capacityUnit?: string;
  whatsappInstances?: number;
  managerName?: string;
  managerPhone?: string;
  managerEmail?: string;
  managerCpf?: string;
  managerRole?: string;
  razaoSocial?: string;
  loginEmail?: string;
  instanceName?: string;
  apiUrl?: string;
  apiKey?: string;
  notes?: string;
  agenteIa?: string;
}

export const DEFAULT_HOTEL: HotelAtivo = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Hotel Master',
  category: 'Resort & Hotel',
  cityUf: 'Porto de Galinhas / PE',
  city: 'Porto de Galinhas',
  uf: 'PE',
  cnpj: '12.345.678/0001-90',
  status: 'ativo',
  imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&auto=format&fit=crop&q=80',
  link: '/hoteis/nomedohotel',
  instagram: '@hotelmaster',
  facebook: 'hotelmasterporto',
  tiktok: '@hotelmaster',
  whatsapp: '5581998765432',
  agenteIa: ''
};

export function resolveHotelDbId(hotelId?: string): string {
  const hId = hotelId || currentHotelService.getCurrentHotel().id;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (hId && uuidRegex.test(hId)) {
    return hId;
  }
  return '11111111-1111-1111-1111-111111111111';
}

const LOCAL_KEY_ACTIVE_HOTEL = 'hotelnozap_current_hotel_v1';
const LOCAL_KEY_CUSTOM_HOTEIS = 'hotelnozap_custom_hoteis_v1';

export const currentHotelService = {
  getCurrentHotel(): HotelAtivo {
    try {
      const saved = localStorage.getItem(LOCAL_KEY_ACTIVE_HOTEL);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.name) return parsed;
      }
    } catch { /* ignore */ }
    return DEFAULT_HOTEL;
  },

  setCurrentHotel(hotel: HotelAtivo): void {
    try {
      const current = this.getCurrentHotel();
      if (current && current.id === hotel.id && current.name === hotel.name) {
        // Já é o hotel ativo atual, apenas garante persistência em cache sem disparar loop de eventos
        localStorage.setItem(LOCAL_KEY_ACTIVE_HOTEL, JSON.stringify(hotel));
        return;
      }
      localStorage.setItem(LOCAL_KEY_ACTIVE_HOTEL, JSON.stringify(hotel));
      window.dispatchEvent(new CustomEvent('hotel_changed', { detail: hotel }));
    } catch { /* ignore */ }
  },

  async getAvailableHoteis(): Promise<HotelAtivo[]> {
    try {
      const dbHoteis = await hoteisService.getHoteis();
      if (dbHoteis && dbHoteis.length > 0) {
        return dbHoteis.map(h => ({
          id: h.id,
          name: h.name,
          category: h.category,
          cityUf: h.cityUf,
          city: h.city,
          uf: h.uf,
          cnpj: h.cnpj,
          status: h.status,
          imageUrl: h.imageUrl,
          link: h.link,
          agenteIa: h.agenteIa || 'Sofia'
        }));
      }
    } catch { /* ignore */ }
    return [DEFAULT_HOTEL];
  }
};
export const usuariosService = {
  _FORBIDDEN_HOTEL_PROFILES: ['Super Admin', 'Administrador', 'Parceiro'] as const,

  _extractHotelRole(savedRole?: string | null): 'hotel' | 'admin' {
    const r = (savedRole || '').toString().toLowerCase();
    const isHotel = r.includes('hotel') || (!r.includes('super') && !r.includes('admin') && !r.includes('administrador') && !r.includes('parceiro'));
    // NÃO confundir Hotel com perfil usuário Hotel. Verifica explicitamente Super Admin / Admin:
    const isAdmin = r.includes('super') || r.includes('admin') || r.includes('administrador') || r.includes('master');
    if (isAdmin) return 'admin';
    if (isHotel) return 'hotel';
    return 'admin';
  },

  _currentScopeHotelId(): string | null {
    try {
      if (typeof window === 'undefined') return null;
      const cur = currentHotelService.getCurrentHotel();
      if (cur?.id) return cur.id;
      const saved = localStorage.getItem('hotelnozap_hotel_atual');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      return (parsed?.id as string) || null;
    } catch {
      return null;
    }
  },

  _currentUserRoleString(): string | null {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem('hotelnozap_user_role');
    } catch {
      return null;
    }
  },

  async getUsuarios(options?: { scopeHotelId?: string | null; includeAdminGlobal?: boolean }): Promise<Usuario[]> {
    let scopeHotelId = options?.scopeHotelId ?? null;
    if (!scopeHotelId && options?.includeAdminGlobal === false) {
      scopeHotelId = this._currentScopeHotelId();
    }
    const savedRole = this._currentUserRoleString();
    const roleScope = this._extractHotelRole(savedRole);
    if (!scopeHotelId && roleScope === 'hotel') {
      scopeHotelId = this._currentScopeHotelId();
    }
    const includeAdminGlobal = options?.includeAdminGlobal ?? (roleScope === 'admin' && !scopeHotelId);
    try {
      let query = supabase
        .from('usuarios')
        .select('*')
        .order('criado_em', { ascending: false });

      if (scopeHotelId) {
        query = query.eq('hotel_id', scopeHotelId);
      } else if (!includeAdminGlobal) {
        query = query.not('hotel_id', 'is', null).neq('perfil', 'Super Admin');
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        console.info('Supabase: Utilizando dados locais de fallback para usuários.');
        return [];
      }

      return data.map((u: any) => ({
        id: u.id,
        name: u.nome,
        email: u.email,
        cargo: u.cargo,
        perfil: u.perfil,
        phone: u.telefone,
        lastAccess: u.ultimo_acesso || 'Recente',
        status: u.status || 'ativo',
        initials: u.iniciais || u.nome.substring(0, 2).toUpperCase(),
        avatarUrl: u.url_avatar || undefined,
        cep: u.cep || undefined,
        street: u.logradouro || undefined,
        streetNumber: u.numero || undefined,
        neighborhood: u.bairro || undefined,
        city: u.cidade || undefined,
        uf: u.uf || undefined,
        hotelId: u.hotel_id || undefined,
        createdAt: u.criado_em || undefined
      }));
    } catch (err) {
      console.warn('Erro ao conectar ao Supabase para usuários:', err);
      return [];
    }
  },

  async createUsuario(
    usuario: Omit<Usuario, 'id' | 'lastAccess'> & { lastAccess?: string; hotel_id?: string },
    password?: string,
    options?: { adminMode?: boolean; skipAuth?: boolean }
  ): Promise<{ success: boolean; user: Usuario | null; authUserId: string | null; error: string | null }> {
    const cleanEmail = usuario.email.trim().toLowerCase();
    let authUserId: string | null = null;
    let authUserCreated = false;
    let createdDbUserId: string | null = null;
    let adminSessionRestored = false;

    try {
      if (!cleanEmail) {
        return { success: false, user: null, authUserId: null, error: 'E-mail não informado.' };
      }

      // R11: Escopo origem Hotel validações
      const savedRole = this._currentUserRoleString();
      const roleScope = this._extractHotelRole(savedRole);
      const forcedScopeHotelId = roleScope === 'hotel' ? this._currentScopeHotelId() : null;

      // Regra de Negócio: Todo usuário do tipo gerente tem perfil de acesso Hotel
      if (usuario.perfil === 'Gerente' || usuario.cargo?.toLowerCase().includes('gerente')) {
        usuario.perfil = 'Hotel';
      }

      if (roleScope === 'hotel') {
        const forbidden = (this._FORBIDDEN_HOTEL_PROFILES as readonly string[]).includes(usuario.perfil || '');
        if (forbidden) {
          return {
            success: false,
            user: null,
            authUserId: null,
            error: `Perfil "${usuario.perfil}" não é permitido para usuários cadastrados por este Hotel. Escolha entre Gerente/Hotel, Recepção, Governança, Financeiro ou Hóspede.`
          };
        }
      }

      // R11: força hotel_id para origem Hotel (não aceita valor diferente)
      let finalHotelId: string | null | undefined = usuario.hotel_id;
      if (roleScope === 'hotel') {
        if (!forcedScopeHotelId) {
          return { success: false, user: null, authUserId: null, error: 'Não foi possível identificar o Hotel da sessão. Efetue login novamente.' };
        }
        finalHotelId = forcedScopeHotelId;
      }

      // 0. Salva a sessão atual do admin (se houver) para restaurar depois
      const { data: sessaoAnterior } = await supabase.auth.getSession();
      const haviaSessaoAdmin = !!(sessaoAnterior?.session && (options?.adminMode ?? true));

      // 1. VALIDAÇÃO DE UNICIDADE DE E-MAIL em 2 fontes (usuarios + parceiros) antes de tocar Auth
      const [dupUsuario, dupParceiro] = await Promise.all([
        supabase.from('usuarios').select('id, email').eq('email', cleanEmail).maybeSingle(),
        supabase.from('parceiros').select('id, email, whatsapp').or(`email.eq.${cleanEmail},whatsapp.eq.${cleanEmail}`).maybeSingle()
      ]).catch(() => [{ data: null }, { data: null }]);

      if (dupUsuario?.data) {
        return { success: false, user: null, authUserId: null, error: `Este e-mail já está cadastrado no sistema (usuário existente). Utilize outro e-mail ou recupere a senha.` };
      }
      if (dupParceiro?.data) {
        return { success: false, user: null, authUserId: null, error: `Este e-mail/telefone já está vinculado a um parceiro cadastrado. Utilize outro contato.` };
      }

      const finalPassword = password || (() => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        return Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => chars[b % chars.length]).join('');
      })();
      if (!options?.skipAuth) {
        // 2. Registrar no Auth do Supabase com tratamento real de erro
        try {
          const signUpOptions: any = {
            emailRedirectTo: undefined,
            data: {
              name: usuario.name,
              nome: usuario.name,
              perfil: usuario.perfil,
              cargo: usuario.cargo
            }
          };
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: cleanEmail,
            password: finalPassword,
            options: signUpOptions
          });
          if (!authError && authData?.user && !authData.user.email_confirmed_at) {
            console.warn('⚠️ Usuário criado mas email ainda NÃO CONFIRMADO. Para login imediato, desative "Enable email confirmations" no Supabase > Authentication > Providers > Email. Ou envie o link de confirmação manualmente.');
          }

          if (authError) {
            const msg = authError.message || 'Erro desconhecido no Auth.';
            if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered') || msg.toLowerCase().includes('exist')) {
              return { success: false, user: null, authUserId: null, error: `Este e-mail já está registrado no sistema de autenticação. Utilize outro e-mail ou recupere a senha. Detalhe: ${msg}` };
            }
            console.error('Erro real ao registrar usuário no Supabase Auth:', authError);
            return { success: false, user: null, authUserId: null, error: `Falha ao criar credencial de autenticação: ${msg}` };
          }
          if (!authData?.user?.id) {
            return { success: false, user: null, authUserId: null, error: `O Supabase Auth não retornou o ID do usuário. Tente novamente.` };
          }
          authUserId = authData.user.id;
          authUserCreated = true;
          console.log('Auth OK: usuário criado no Supabase Auth:', cleanEmail, 'id=', authUserId);
        } catch (aErr: any) {
          console.error('Exceção crítica no Supabase Auth signUp:', aErr);
          return { success: false, user: null, authUserId: null, error: `Exceção ao registrar credencial de autenticação: ${aErr?.message || aErr}` };
        }

        // 3. RESTAURAÇÃO DE SESSÃO: havia admin logado? Volta para a sessão original.
        //    Se não havia admin (sign-up público), DEIXA o novo usuário logado.
        if (haviaSessaoAdmin && sessaoAnterior.session) {
          try {
            await supabase.auth.setSession({
              access_token: sessaoAnterior.session.access_token,
              refresh_token: sessaoAnterior.session.refresh_token
            });
            adminSessionRestored = true;
          } catch (restoreErr: any) {
            console.warn('Não foi possível restaurar a sessão do admin após cadastro (pode ter expirado).', restoreErr);
            try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
          }
        } else if (options?.adminMode && !sessaoAnterior?.session) {
          // Admin mode mas sem sessão: signUp não deve "logar" ninguém
          try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
        }
      }

      // 4. Registrar na tabela `usuarios` (SÓ INSERT, não faz upsert — rejeita duplicados)
      const payload: Record<string, any> = {
        nome: usuario.name,
        email: cleanEmail,
        cargo: usuario.cargo,
        perfil: usuario.perfil,
        telefone: usuario.phone,
        status: usuario.status,
        iniciais: usuario.initials,
        url_avatar: usuario.avatarUrl || null,
        cep: usuario.cep || null,
        logradouro: usuario.street || null,
        numero: (usuario as any).streetNumber || null,
        bairro: usuario.neighborhood || null,
        cidade: usuario.city || null,
        uf: usuario.uf || null,
        auth_user_id: authUserId
      };
      // R11: se origem Hotel, SEMPRE usa finalHotelId (forçado), senão usa valor recebido (se houver)
      if (finalHotelId) {
        payload.hotel_id = finalHotelId;
      } else if ((usuario as any).hotel_id) {
        payload.hotel_id = (usuario as any).hotel_id;
      }

      try {
        let insertResult = await supabase
          .from('usuarios')
          .insert([payload])
          .select('*')
          .single();
        let insertError = insertResult.error;
        let insertedData = insertResult.data;

        // Fallback gracioso: se colunas novas (auth_user_id, numero, etc.) ainda não existem no banco, remove e retenta
        if (insertError && (
          insertError.code === '42703' ||
          insertError.message?.includes('auth_user_id') ||
          insertError.message?.includes('numero') ||
          insertError.message?.includes('logradouro') ||
          insertError.message?.includes('bairro') ||
          insertError.message?.includes('cidade') ||
          insertError.message?.includes('cep') ||
          insertError.message?.includes('iniciais') ||
          insertError.message?.includes('url_avatar')
        )) {
          console.warn('⚠️ createUsuario: colunas novas detectadas faltantes no schema cache. Removendo campos e retentando insert...', insertError.message);
          delete payload.auth_user_id;
          delete payload.numero;
          delete payload.cep;
          delete payload.logradouro;
          delete payload.bairro;
          delete payload.cidade;
          delete payload.uf;
          delete payload.iniciais;
          delete payload.url_avatar;
          const retry = await supabase
            .from('usuarios')
            .insert([payload])
            .select('*')
            .single();
          insertError = retry.error;
          insertedData = retry.data;
        }

        if (insertError) {
          console.error('Erro Supabase ao inserir usuário na tabela:', insertError);
          // ROLLBACK informativo: Auth não pode ser apagado sem service role neste cliente, mas avisamos claramente
          if (authUserCreated) {
            console.warn(
              `[ATENÇÃO ROLLBACK PARCIAL] Usuário foi criado no Auth (id=${authUserId}) mas falhou na tabela usuarios. ` +
              `Se houver função admin configurada, remova manualmente o e-mail ${cleanEmail}.`
            );
          }
          // Tenta signOut para não deixar sessão "presa" do usuário que não foi completo
          if (!adminSessionRestored && !haviaSessaoAdmin) {
            try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
          }
          return { success: false, user: null, authUserId, error: `Falha ao salvar dados do usuário: ${insertError.message || insertError}` };
        }

        createdDbUserId = insertedData?.id || null;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('hotel_novo_usuario'));
        }

        return {
          success: true,
          user: {
            id: insertedData.id,
            name: insertedData.nome,
            email: insertedData.email,
            cargo: insertedData.cargo,
            perfil: insertedData.perfil,
            phone: insertedData.telefone,
            lastAccess: insertedData.ultimo_acesso || 'Recente',
            status: insertedData.status,
            initials: insertedData.iniciais,
            avatarUrl: insertedData.url_avatar,
            cep: insertedData.cep,
            street: insertedData.logradouro,
            streetNumber: insertedData.numero,
            neighborhood: insertedData.bairro,
            city: insertedData.cidade,
            uf: insertedData.uf
          },
          authUserId,
          error: null
        };
      } catch (dbErr: any) {
        console.error('Exceção ao inserir na tabela usuarios:', dbErr);
        if (!adminSessionRestored && !haviaSessaoAdmin) {
          try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
        }
        return { success: false, user: null, authUserId, error: `Exceção ao salvar dados do usuário: ${dbErr?.message || dbErr}` };
      }
    } catch (outerErr: any) {
      console.error('Falha geral no createUsuario:', outerErr);
      // Tenta evitar sessão "presa"
      try {
        const { data: s } = await supabase.auth.getSession();
        if (s?.session?.user?.email?.toLowerCase() === cleanEmail) {
          await supabase.auth.signOut({ scope: 'local' });
        }
      } catch { /* ignore */ }
      return { success: false, user: null, authUserId, error: `Falha inesperada no cadastro: ${outerErr?.message || outerErr}` };
    }
  },

  async updateUsuario(id: string, usuario: Partial<Usuario>): Promise<boolean> {
    try {
      // Regra de Negócio: Todo usuário do tipo gerente tem perfil de acesso Hotel
      if (usuario.perfil === 'Gerente' || usuario.cargo?.toLowerCase().includes('gerente')) {
        usuario.perfil = 'Hotel';
      }

      // R11: escopo Hotel não pode editar usuário de outro hotel e não pode promover perfil proibido
      const savedRole = this._currentUserRoleString();
      const roleScope = this._extractHotelRole(savedRole);
      const forcedScopeHotelId = roleScope === 'hotel' ? this._currentScopeHotelId() : null;
      if (roleScope === 'hotel' && forcedScopeHotelId) {
        const { data: userTarget } = await supabase
          .from('usuarios')
          .select('id, hotel_id')
          .eq('id', id)
          .maybeSingle();
        const targetHotelId = (userTarget as any)?.hotel_id || null;
        if (!targetHotelId || targetHotelId !== forcedScopeHotelId) {
          console.warn('updateUsuario bloqueado: usuário não pertence ao hotel da sessão.');
          return false;
        }
        if (usuario.perfil) {
          const forbidden = (this._FORBIDDEN_HOTEL_PROFILES as readonly string[]).includes(usuario.perfil);
          if (forbidden) {
            console.warn('updateUsuario bloqueado: perfil proibido para origem Hotel.');
            return false;
          }
        }
      }

      const payload: Record<string, any> = {};
      if (usuario.name !== undefined) payload.nome = usuario.name;
      if (usuario.email !== undefined) payload.email = usuario.email;
      if (usuario.cargo !== undefined) payload.cargo = usuario.cargo;
      if (usuario.perfil !== undefined) payload.perfil = usuario.perfil;
      if (usuario.phone !== undefined) payload.telefone = usuario.phone;
      if (usuario.status !== undefined) payload.status = usuario.status;
      if (usuario.initials !== undefined) payload.iniciais = usuario.initials;
      if (usuario.avatarUrl !== undefined) payload.url_avatar = usuario.avatarUrl;
      if (usuario.cep !== undefined) payload.cep = usuario.cep;
      if (usuario.street !== undefined) payload.logradouro = usuario.street;
      if ((usuario as any).streetNumber !== undefined) payload.numero = (usuario as any).streetNumber || null;
      if (usuario.neighborhood !== undefined) payload.bairro = usuario.neighborhood;
      if (usuario.city !== undefined) payload.cidade = usuario.city;
      if (usuario.uf !== undefined) payload.uf = usuario.uf;

      let { error } = await supabase
        .from('usuarios')
        .update(payload)
        .eq('id', id);

      // Fallback gracioso: se colunas novas ainda não existem no schema cache
      if (error && (
        error.code === '42703' ||
        error.message?.includes('numero') ||
        error.message?.includes('logradouro') ||
        error.message?.includes('bairro') ||
        error.message?.includes('cidade') ||
        error.message?.includes('uf') ||
        error.message?.includes('cep') ||
        error.message?.includes('iniciais') ||
        error.message?.includes('url_avatar')
      )) {
        delete payload.numero;
        delete payload.cep;
        delete payload.logradouro;
        delete payload.bairro;
        delete payload.cidade;
        delete payload.uf;
        delete payload.iniciais;
        delete payload.url_avatar;
        const retry = await supabase
          .from('usuarios')
          .update(payload)
          .eq('id', id);
        error = retry.error;
      }

      if (!error && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hotel_usuario_modificado', { detail: { id, ...payload } }));
        window.dispatchEvent(new CustomEvent('hotel_novo_usuario'));
      }

      return !error;
    } catch (err) {
      console.error('Erro Supabase ao atualizar usuário:', err);
      return false;
    }
  },

  async registrarUltimoAcesso(emailOuId: string): Promise<boolean> {
    if (!emailOuId) return false;
    try {
      const nowIso = new Date().toISOString();
      const cleanTarget = emailOuId.trim();
      const isEmail = cleanTarget.includes('@');

      let query = supabase.from('usuarios').update({ ultimo_acesso: nowIso });
      if (isEmail) {
        query = query.ilike('email', cleanTarget);
      } else {
        query = query.eq('id', cleanTarget);
      }
      const { error } = await query;

      try {
        localStorage.setItem(`hotelnozap_ultimo_acesso_${cleanTarget.toLowerCase()}`, nowIso);
      } catch {}

      if (!error && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hotel_usuario_modificado', { detail: { emailOuId: cleanTarget, ultimo_acesso: nowIso } }));
      }
      return !error;
    } catch (err) {
      console.warn('Erro ao registrar último acesso do usuário:', err);
      return false;
    }
  },

  async deleteUsuario(id: string): Promise<boolean> {
    try {
      const { data: targetUser } = await supabase
        .from('usuarios')
        .select('id, email, nome, perfil, hotel_id, criado_em')
        .eq('id', id)
        .single();

      if (targetUser && (targetUser.email?.toLowerCase() === 'everaldozs@gmail.com' || targetUser.nome?.toLowerCase().includes('everaldo'))) {
        console.warn('Tentativa de exclusão bloqueada para o usuário administrador master Everaldo Souza.');
        return false;
      }

      if (targetUser?.perfil === 'Hotel' && targetUser?.hotel_id) {
        const { data: hotelUsers } = await supabase
          .from('usuarios')
          .select('id, criado_em')
          .eq('hotel_id', targetUser.hotel_id)
          .eq('perfil', 'Hotel')
          .order('criado_em', { ascending: true });

        if (hotelUsers && hotelUsers.length > 0 && hotelUsers[0].id === targetUser.id) {
          console.warn('Tentativa de exclusão bloqueada para o primeiro usuário cadastrado com perfil Hotel (necessário para acesso).');
          return false;
        }
      }

      if (targetUser?.email) {
        try {
          await supabase.rpc('delete_user_cascade', {
            target_email: targetUser.email
          });
        } catch (rpcEx) {
          console.warn('Exceção RPC delete_user_cascade:', rpcEx);
        }
      }

      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', id);

      if (!error && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hotel_usuario_deletado', { detail: { id } }));
        window.dispatchEvent(new CustomEvent('hotel_usuario_modificado', { detail: { id, deleted: true } }));
        window.dispatchEvent(new CustomEvent('hotel_novo_usuario'));
      }

      return !error;
    } catch (err) {
      console.error('Erro Supabase ao deletar usuário:', err);
      return false;
    }
  },

  subscribeUsuarios(callback: () => void): () => void {
    try {
      const channel = supabase
        .channel(`realtime_usuarios_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'usuarios' },
          () => {
            callback();
          }
        )
        .subscribe();

      return () => {
        try { supabase.removeChannel(channel); } catch (e) {}
      };
    } catch (err) {
      return () => {};
    }
  }
};

// Service para Hotéis no Supabase (Tabela: hoteis)
export const hoteisService = {
  async getHoteis(): Promise<Hotel[]> {
    try {
      const { data, error } = await supabase
        .from('hoteis')
        .select('*')
        .order('criado_em', { ascending: false });

      if (error || !data || data.length === 0) {
        return [];
      }

      return data.map((h: any) => {
        const isImportedFromGoogle = Boolean(
          (h.plano && (h.plano.toLowerCase().includes('google') || h.plano.toLowerCase().includes('maps'))) ||
          (h.observacoes && (h.observacoes.toLowerCase().includes('google') || h.observacoes.toLowerCase().includes('importado') || h.observacoes.toLowerCase().includes('places'))) ||
          (h.url_imagem && h.url_imagem.includes('places.googleapis.com'))
        );

        return {
          id: h.id,
          name: h.nome,
          category: h.categoria,
          cnpj: h.cnpj,
          cityUf: (h.cidade && h.uf) ? `${h.cidade}/${h.uf}` : (h.cidade || h.uf || ''),
          city: h.cidade || '',
          uf: h.uf || '',
          neighborhood: h.bairro || '',
          plan: h.plano || 'Professional',
          capacity: isImportedFromGoogle ? 0 : (h.capacidade !== null && h.capacidade !== undefined ? Number(h.capacidade) : 0),
          capacityUnit: h.unidade_capacidade || 'quartos',
          whatsappInstances: isImportedFromGoogle ? 0 : (h.instancias_whatsapp !== null && h.instancias_whatsapp !== undefined ? Number(h.instancias_whatsapp) : 0),
          managerName: h.nome_gerente || '',
          managerPhone: h.telefone_gerente || '',
          status: h.status || 'ativo',
          imageUrl: h.url_imagem || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&auto=format&fit=crop&q=80',
          razaoSocial: h.razao_social || '',
          cep: h.cep || '',
          street: h.logradouro || '',
          streetNumber: h.numero || '',
          managerEmail: h.email_gerente || '',
          managerCpf: h.cpf_gerente || '',
          managerRole: h.cargo_gerente || '',
          loginEmail: h.email_login || '',
          instanceName: h.nome_instancia || '',
          apiUrl: h.url_api || '',
          apiKey: h.chave_api || '',
          notes: h.observacoes || '',
          link: h.link || '',
          instagram: h.instagram || '',
          facebook: h.facebook || '',
          tiktok: h.tiktok || '',
          whatsapp: h.whatsapp || '',
          agenteIa: h.agente_ia || (h.id && typeof window !== 'undefined' ? localStorage.getItem(`hotel_agente_ia_${h.id}`) : '') || '',
          createdAt: h.criado_em || '',
          isImportedFromGoogle,
          isTop10: Boolean(
            h.is_top_10 ||
            (h.observacoes && (h.observacoes.includes('[TOP10]') || h.observacoes.includes('TOP 10') || h.observacoes.includes('TOP_10'))) ||
            (h.notes && (h.notes.includes('[TOP10]') || h.notes.includes('TOP 10') || h.notes.includes('TOP_10')))
          )
        };
      });
    } catch (err) {
      console.warn('Erro ao conectar ao Supabase para hotéis:', err);
      return [];
    }
  },

  async createHotel(hotel: Partial<Hotel>): Promise<{ success: boolean; id: string | null; error: string | null }> {
    try {
      const isGoogleImport = Boolean(
        (hotel as any).isImportedFromGoogle ||
        (hotel.plan && (hotel.plan.toLowerCase().includes('google') || hotel.plan.toLowerCase().includes('maps'))) ||
        (hotel.notes && (hotel.notes.toLowerCase().includes('google') || hotel.notes.toLowerCase().includes('places') || hotel.notes.toLowerCase().includes('importado')))
      );

      const payload: Record<string, any> = {
        nome: hotel.name,
        razao_social: hotel.razaoSocial || hotel.name || 'Hotel & Hospedagem LTDA',
        categoria: hotel.category || 'Hotel & Pousada',
        cnpj: hotel.cnpj || '00.000.000/0001-00',
        cidade: hotel.city || (hotel.cityUf ? hotel.cityUf.split('/')[0]?.trim() : '') || 'Sinop',
        uf: hotel.uf || (hotel.cityUf ? hotel.cityUf.split('/')[1]?.trim() : '') || 'MT',
        bairro: hotel.neighborhood || 'Centro',
        cep: hotel.cep || '',
        logradouro: hotel.street || '',
        numero: hotel.streetNumber || null,
        plano: hotel.plan || 'Grátis (Google Maps)',
        capacidade: isGoogleImport ? 0 : (hotel.capacity !== undefined && hotel.capacity !== null ? Number(hotel.capacity) : 0),
        unidade_capacidade: hotel.capacityUnit || 'quartos',
        instancias_whatsapp: isGoogleImport ? 0 : (hotel.whatsappInstances !== undefined && hotel.whatsappInstances !== null ? Number(hotel.whatsappInstances) : 0),
        nome_gerente: hotel.managerName || 'Recepção / Gerência',
        telefone_gerente: hotel.managerPhone || null,
        email_gerente: hotel.managerEmail || null,
        cpf_gerente: hotel.managerCpf || null,
        cargo_gerente: hotel.managerRole || null,
        email_login: hotel.loginEmail || null,
        nome_instancia: hotel.instanceName || null,
        url_api: hotel.apiUrl || null,
        chave_api: hotel.apiKey || null,
        observacoes: hotel.notes || null,
        status: hotel.status || 'ativo',
        url_imagem: hotel.imageUrl || null,
        link: hotel.link || null,
        instagram: hotel.instagram || null,
        facebook: hotel.facebook || null,
        tiktok: hotel.tiktok || null,
        whatsapp: hotel.whatsapp || null,
        agente_ia: hotel.agenteIa?.trim() || (hotel as any).nomeAgenteIa?.trim() || null,
        parceiro_referencia: (hotel as any).partnerRef || null,
        is_top_10: Boolean(hotel.isTop10)
      };

      let result = await supabase.from('hoteis').insert([payload]).select('*').single();
      let error = result.error;
      let data = result.data;

      // Fallback gracioso se o usuário ainda não tiver rodado o SQL das novas colunas
      if (error && (error.code === '42703' || error.message?.includes('link') || error.message?.includes('is_top_10') || error.message?.includes('instagram') || error.message?.includes('facebook') || error.message?.includes('tiktok') || error.message?.includes('whatsapp') || error.message?.includes('parceiro_referencia') || error.message?.includes('numero') || error.message?.includes('agente_ia'))) {
        delete payload.link;
        delete payload.instagram;
        delete payload.facebook;
        delete payload.tiktok;
        delete payload.whatsapp;
        delete payload.parceiro_referencia;
        delete payload.numero;
        delete payload.agente_ia;
        delete payload.is_top_10;
        const retry = await supabase.from('hoteis').insert([payload]).select('*').single();
        error = retry.error;
        data = retry.data;
      }

      if (error) {
        console.error('Erro ao cadastrar hotel no Supabase:', error);
        return { success: false, id: null, error: `Falha ao criar hotel: ${error.message || error}` };
      }

      const hotelId = data?.id || null;
      if (typeof window !== 'undefined' && hotelId) {
        window.dispatchEvent(new CustomEvent('hotel_novo_hotel'));
      }

      return { success: true, id: hotelId, error: null };
    } catch (err: any) {
      console.error('Erro ao criar hotel no Supabase:', err);
      return { success: false, id: null, error: `Exceção ao criar hotel: ${err?.message || err}` };
    }
  },

  async updateHotel(id: string, hotel: Partial<Hotel>): Promise<boolean> {
    try {
      const payload: Record<string, any> = {};
      if (hotel.name !== undefined) payload.nome = hotel.name;
      if (hotel.razaoSocial !== undefined) payload.razao_social = hotel.razaoSocial;
      if (hotel.category !== undefined) payload.categoria = hotel.category;
      if (hotel.cnpj !== undefined) payload.cnpj = hotel.cnpj;
      if (hotel.city !== undefined) payload.cidade = hotel.city;
      if (hotel.uf !== undefined) payload.uf = hotel.uf;
      if (hotel.cityUf !== undefined && hotel.city === undefined && hotel.uf === undefined) {
        const parts = hotel.cityUf.split('/');
        if (parts[0]) payload.cidade = parts[0].trim();
        if (parts[1]) payload.uf = parts[1].trim().toUpperCase();
      }
      if (hotel.neighborhood !== undefined) payload.bairro = hotel.neighborhood;
      if (hotel.cep !== undefined) payload.cep = hotel.cep;
      if (hotel.street !== undefined) payload.logradouro = hotel.street;
      if (hotel.streetNumber !== undefined) payload.numero = hotel.streetNumber || null;
      if (hotel.plan !== undefined) payload.plano = hotel.plan;
      if (hotel.capacity !== undefined) payload.capacidade = hotel.capacity;
      if (hotel.capacityUnit !== undefined) payload.unidade_capacidade = hotel.capacityUnit;
      if (hotel.whatsappInstances !== undefined) payload.instancias_whatsapp = hotel.whatsappInstances;
      if (hotel.managerName !== undefined) payload.nome_gerente = hotel.managerName;
      if (hotel.managerPhone !== undefined) payload.telefone_gerente = hotel.managerPhone;
      if (hotel.managerEmail !== undefined) payload.email_gerente = hotel.managerEmail;
      if (hotel.managerCpf !== undefined) payload.cpf_gerente = hotel.managerCpf;
      if (hotel.managerRole !== undefined) payload.cargo_gerente = hotel.managerRole;
      if (hotel.loginEmail !== undefined) payload.email_login = hotel.loginEmail;
      if (hotel.instanceName !== undefined) payload.nome_instancia = hotel.instanceName;
      if (hotel.apiUrl !== undefined) payload.url_api = hotel.apiUrl;
      if (hotel.apiKey !== undefined) payload.chave_api = hotel.apiKey;
      if (hotel.notes !== undefined) payload.observacoes = hotel.notes;
      if (hotel.status !== undefined) payload.status = hotel.status;
      if (hotel.imageUrl !== undefined) payload.url_imagem = hotel.imageUrl;
      if (hotel.link !== undefined) payload.link = hotel.link;
      if (hotel.instagram !== undefined) payload.instagram = hotel.instagram || null;
      if (hotel.facebook !== undefined) payload.facebook = hotel.facebook || null;
      if (hotel.tiktok !== undefined) payload.tiktok = hotel.tiktok || null;
      if (hotel.whatsapp !== undefined) payload.whatsapp = hotel.whatsapp || null;
      if (hotel.isTop10 !== undefined) payload.is_top_10 = Boolean(hotel.isTop10);
      if (hotel.agenteIa !== undefined || (hotel as any).nomeAgenteIa !== undefined) {
        const agVal = (hotel.agenteIa || (hotel as any).nomeAgenteIa || '').trim();
        payload.agente_ia = agVal || null;
        if (typeof window !== 'undefined') {
          if (agVal) {
            localStorage.setItem(`hotel_agente_ia_${id}`, agVal);
          } else {
            localStorage.removeItem(`hotel_agente_ia_${id}`);
          }
        }
      }

      const targetId = resolveHotelDbId(id);
      let { error } = await supabase.from('hoteis').update(payload).eq('id', targetId);

      // Fallback gracioso se o usuário ainda não tiver rodado o SQL das novas colunas
      if (error && (error.code === '42703' || error.message?.includes('is_top_10') || error.message?.includes('link') || error.message?.includes('instagram') || error.message?.includes('facebook') || error.message?.includes('tiktok') || error.message?.includes('whatsapp') || error.message?.includes('numero') || error.message?.includes('agente_ia'))) {
        delete payload.link;
        delete payload.instagram;
        delete payload.facebook;
        delete payload.tiktok;
        delete payload.whatsapp;
        delete payload.numero;
        delete payload.agente_ia;
        delete payload.is_top_10;
        const retryResult = await supabase.from('hoteis').update(payload).eq('id', targetId);
        error = retryResult.error;
      }

      if (!error && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hotel_novo_hotel'));
        window.dispatchEvent(new CustomEvent('hotel_modificado', { detail: { id, ...payload } }));
      }

      return !error;
    } catch (err) {
      console.error('Erro ao atualizar hotel no Supabase:', err);
      return false;
    }
  },

  async updateHotelStatus(id: string, status: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('hoteis').update({ status }).eq('id', id);
      if (!error && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hotel_modificado', { detail: { id, status } }));
        window.dispatchEvent(new CustomEvent('hotel_novo_hotel'));
      }
      return !error;
    } catch (err) {
      console.error('Erro ao atualizar status do hotel no Supabase:', err);
      return false;
    }
  },

  async deleteHotel(id: string): Promise<boolean> {
    try {
      // Limpeza de tabelas dependentes para evitar erro de Foreign Key (integridade referencial)
      try { await supabase.from('reservas').delete().eq('hotel_id', id); } catch {}
      try { await supabase.from('quartos').delete().eq('hotel_id', id); } catch {}
      try { await supabase.from('hospedes').delete().eq('hotel_id', id); } catch {}
      try { await supabase.from('produtos').delete().eq('hotel_id', id); } catch {}
      try { await supabase.from('contas_pagar').delete().eq('hotel_id', id); } catch {}
      try { await supabase.from('contas_receber').delete().eq('hotel_id', id); } catch {}
      try { await supabase.from('usuarios').delete().eq('hotel_id', id); } catch {}
      try { await supabase.from('categorias_quartos').delete().eq('hotel_id', id); } catch {}
      try { await supabase.from('itens_quartos').delete().eq('hotel_id', id); } catch {}

      const { error } = await supabase.from('hoteis').delete().eq('id', id);
      if (error) {
        console.error('Erro ao deletar hotel no Supabase:', error);
        return false;
      }

      if (typeof window !== 'undefined') {
        const savedHotel = localStorage.getItem('hotelnozap_current_hotel_v1');
        if (savedHotel && savedHotel.includes(id)) {
          localStorage.removeItem('hotelnozap_current_hotel_v1');
          localStorage.removeItem('hotelnozap_hotel_atual');
        }
        window.dispatchEvent(new CustomEvent('hotel_novo_hotel'));
        window.dispatchEvent(new CustomEvent('hotel_deletado', { detail: { id } }));
        window.dispatchEvent(new CustomEvent('hotel_modificado', { detail: { id, deleted: true } }));
      }
      return true;
    } catch (err) {
      console.error('Erro ao deletar hotel no Supabase:', err);
      return false;
    }
  },

  subscribeHoteis(callback: () => void): () => void {
    try {
      const channel = supabase
        .channel(`realtime_hoteis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'hoteis' },
          () => {
            callback();
          }
        )
        .subscribe();

      return () => {
        try { supabase.removeChannel(channel); } catch (e) {}
      };
    } catch (err) {
      return () => {};
    }
  }
};

// Service para Hóspedes no Supabase (Tabela: hospedes)
const getHospedesKey = (hotelId?: string) => {
  const hId = hotelId || currentHotelService.getCurrentHotel().id;
  return `hotelnozap_hospedes_${hId}`;
};

export const hospedesService = {
  getLocalHospedes(hotelId?: string): GuestData[] {
    try {
      const saved = localStorage.getItem(getHospedesKey(hotelId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* ignore */ }
    return [];
  },

  saveLocalHospedes(guests: GuestData[], hotelId?: string): void {
    try {
      localStorage.setItem(getHospedesKey(hotelId), JSON.stringify(guests));
      window.dispatchEvent(new Event('hotel_novo_hospede'));
    } catch { /* ignore */ }
  },

  async getHospedes(hotelId?: string): Promise<GuestData[]> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const local = this.getLocalHospedes(hId);

    try {
      let query = supabase.from('hospedes').select('*').order('criado_em', { ascending: false });
      if (hId && !hId.startsWith('hotel-master')) {
        query = query.eq('hotel_id', hId);
      }
      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const mapped: GuestData[] = data.map((h: any) => ({
          id: h.id,
          name: h.nome,
          email: h.email,
          cpfCnpj: h.cpf_passaporte || h.cpf || '',
          phone: maskPhone(h.telefone || ''),
          initials: (h.nome || 'H').substring(0, 2).toUpperCase(),
          lastStay: h.cidade_uf || '',
          cidadeOrigem: h.cidade_uf || '',
          placaVeiculo: h.placa_veiculo || '',
          status: h.status || 'ativo'
        }));
        // Merge seguro: mantém itens locais que possam ser novos
        const merged = [...local];
        mapped.forEach(m => {
          const idx = merged.findIndex(l => l.id === m.id);
          if (idx >= 0) merged[idx] = m;
          else merged.push(m);
        });
        this.saveLocalHospedes(merged, hId);
        return merged;
      }
    } catch (err) {
      console.warn('Erro ao conectar ao Supabase para hóspedes:', err);
    }
    return local;
  },

  async createHospede(hospede: Partial<GuestData>, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const newGuest: GuestData = {
      id: `gh-${Date.now()}`,
      name: hospede.name || 'Hóspede Sem Nome',
      email: hospede.email || 'hospede@email.com',
      cpfCnpj: hospede.cpfCnpj || '',
      phone: maskPhone(hospede.phone || ''),
      initials: (hospede.name || 'H').substring(0, 2).toUpperCase(),
      lastStay: hospede.lastStay || 'Porto de Galinhas / PE',
      status: hospede.status || 'ativo'
    };

    const local = this.getLocalHospedes(hId);
    this.saveLocalHospedes([newGuest, ...local], hId);

    const fullRes = await this.createHospedeFull({
      nome: newGuest.name,
      email: newGuest.email,
      cpf_passaporte: newGuest.cpfCnpj,
      telefone: newGuest.phone,
      cidade_uf: newGuest.lastStay,
      status: newGuest.status,
      hotel_id: hId
    });
    return fullRes.success;
  },

  async updateHospede(id: string, changes: Partial<GuestData>, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const local = this.getLocalHospedes(hId);
    const target = local.find(g => g.id === id);
    let prevEmail = target?.email;

    const updated = local.map(g => g.id === id ? {
      ...g,
      ...changes,
      phone: changes.phone !== undefined ? maskPhone(changes.phone) : g.phone
    } : g);
    this.saveLocalHospedes(updated, hId);

    try {
      if (!prevEmail) {
        const { data: h } = await supabase.from('hospedes').select('email').eq('id', id).maybeSingle();
        prevEmail = h?.email;
      }

      const payload: any = {};
      if (changes.name !== undefined) payload.nome = changes.name;
      if (changes.email !== undefined) payload.email = changes.email;
      if (changes.cpfCnpj !== undefined) payload.cpf_passaporte = changes.cpfCnpj;
      if (changes.phone !== undefined) payload.telefone = formatPhoneEvolution(changes.phone);
      if (changes.status !== undefined) payload.status = changes.status;

      await supabase.from('hospedes').update(payload).eq('id', id);

      const targetEmail = prevEmail || changes.email;
      if (targetEmail) {
        const uPayload: any = { perfil: 'Hóspede', cargo: 'Hóspede' };
        if (changes.name !== undefined) uPayload.nome = changes.name;
        if (changes.phone !== undefined) uPayload.telefone = formatPhoneEvolution(changes.phone);
        if (changes.cpfCnpj !== undefined) uPayload.cpf = changes.cpfCnpj;
        if (changes.status !== undefined) uPayload.status = changes.status;
        if (changes.email !== undefined) uPayload.email = changes.email;

        const { data: existingUser } = await supabase
          .from('usuarios')
          .select('id')
          .ilike('email', targetEmail)
          .maybeSingle();

        if (existingUser?.id) {
          await supabase.from('usuarios').update(uPayload).eq('id', existingUser.id);
        } else {
          await supabase.from('usuarios').insert([{
            hotel_id: hId.startsWith('hotel-master') ? null : hId,
            nome: changes.name || target?.name || 'Hóspede',
            email: changes.email || targetEmail,
            telefone: changes.phone || target?.phone || '',
            cpf: changes.cpfCnpj || target?.cpfCnpj || '',
            cargo: 'Hóspede',
            perfil: 'Hóspede',
            status: changes.status || target?.status || 'ativo'
          }]);
        }
      }
    } catch (err) {
      console.warn('Erro ao atualizar hóspede no Supabase:', err);
    }
    return true;
  },

  async createHospedeFull(payload: {
    nome: string;
    email: string;
    cpf_passaporte?: string;
    telefone?: string;
    cidade_uf?: string;
    status?: string;
    senha?: string;
    observacoes?: string;
    cep?: string;
    logradouro?: string;
    bairro?: string;
    numero?: string;
    hotel_id?: string;
  }): Promise<{ success: boolean; error: string | null }> {
    const email = payload.email?.trim() || `hospede_${Date.now()}@hotelnozap.com.br`;
    const senha = payload.senha || 'Hospede123!';
    const nome = payload.nome?.trim() || 'Hóspede Sem Nome';
    let authCriado = false;

    try {
      const status = payload.status || 'ativo';
      const cpf = payload.cpf_passaporte || '';
      const telefone = payload.telefone ? formatPhoneEvolution(payload.telefone) : '';
      const cidadeUf = payload.cidade_uf || 'Recife/PE';
      const hId = payload.hotel_id || currentHotelService.getCurrentHotel().id;

      const { data: sessaoAnterior } = await supabase.auth.getSession();
      const haviaAdmin = !!sessaoAnterior?.session;

      let authUserId: string | null = null;
      try {
        const signUpOptsHosp: any = {
          data: { name: nome, nome: nome, perfil: 'Hóspede' }
        };
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: email,
          password: senha,
          options: signUpOptsHosp
        });
        if (authErr) {
          console.warn('Auth do hóspede falhou (ignorado parcialmente, mas logado):', authErr.message);
        } else {
          authCriado = true;
          authUserId = authData?.user?.id || null;
        }
      } catch (authEx) {
        console.warn('Exceção ao criar Auth do hóspede:', authEx);
      }

      // Restaura sessão do admin
      if (haviaAdmin && sessaoAnterior.session) {
        try {
          await supabase.auth.setSession({
            access_token: sessaoAnterior.session.access_token,
            refresh_token: sessaoAnterior.session.refresh_token
          });
        } catch {
          try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
        }
      } else if (!haviaAdmin && authCriado) {
        // Público: não deixa a sessão do hóspede logar no painel hotel
        try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
      }

      const { error: hErr } = await supabase.from('hospedes').insert([
        {
          hotel_id: hId.startsWith('hotel-master') ? null : hId,
          nome: nome,
          email: email,
          cpf_passaporte: cpf,
          telefone: telefone,
          cidade_uf: cidadeUf,
          status: status,
          observacoes: payload.observacoes || null,
          cep: payload.cep || null,
          logradouro: payload.logradouro || null,
          bairro: payload.bairro || null,
          numero: payload.numero || null
        }
      ]);

      if (hErr) {
        return { success: false, error: `Falha ao salvar hóspede na tabela: ${hErr.message || hErr}` };
      }

      // Garante que todo cadastro de hóspede feito pelos hotéis tenha usuário com perfil 'Hóspede'
      try {
        const cityParts = cidadeUf.split('/');
        const cCity = cityParts[0]?.trim() || '';
        const cUf = cityParts[1]?.trim() || '';
        const initials = nome.split(' ').map((n: string) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'HP';

        const usuarioPayload: any = {
          hotel_id: hId.startsWith('hotel-master') ? null : hId,
          nome: nome,
          email: email,
          telefone: telefone,
          cpf: cpf,
          cargo: 'Hóspede',
          perfil: 'Hóspede',
          status: status,
          cidade: cCity,
          uf: cUf,
          cep: payload.cep || null,
          logradouro: payload.logradouro || null,
          bairro: payload.bairro || null,
          numero: payload.numero || null,
          iniciais: initials
        };
        if (authUserId) {
          usuarioPayload.auth_user_id = authUserId;
        }

        const { data: existingUser } = await supabase
          .from('usuarios')
          .select('id')
          .ilike('email', email)
          .maybeSingle();

        if (existingUser?.id) {
          await supabase.from('usuarios').update(usuarioPayload).eq('id', existingUser.id);
        } else {
          await supabase.from('usuarios').insert([usuarioPayload]);
        }
      } catch (uErr) {
        console.warn('Erro ao sincronizar usuário Hóspede na tabela usuarios:', uErr);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hotel_novo_hospede', {
          detail: { nome, email }
        }));
      }

      // Disparar início de atendimento / boas-vindas automática caso habilitado e haja telefone
      if (telefone) {
        import('./templateMensagemService')
          .then(({ templateMensagemService }) => {
            templateMensagemService.dispararBoasVindasAutomatica(hId, {
              nome_hospede: nome,
              telefone: telefone,
              email: email
            });
          })
          .catch(e => console.warn('Erro ao disparar boas-vindas automática para novo hóspede:', e));
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.error('Erro ao salvar hóspede completo no Supabase:', err);
      return { success: false, error: err?.message || String(err) };
    }
  },

  async deleteHospede(id: string, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const local = this.getLocalHospedes(hId);
    const target = local.find(g => g.id === id);
    this.saveLocalHospedes(local.filter(g => g.id !== id), hId);

    try {
      let targetEmail = target?.email;
      if (!targetEmail) {
        const { data: h } = await supabase.from('hospedes').select('email').eq('id', id).maybeSingle();
        targetEmail = h?.email;
      }

      // 1. Chamar RPC em cascata no banco para limpar auth.users, usuarios e hospedes
      if (targetEmail) {
        try {
          await supabase.rpc('delete_user_cascade', {
            target_email: targetEmail
          });
        } catch (rpcErr) {
          console.warn('RPC delete_user_cascade falhou ou ainda não foi criada no banco:', rpcErr);
        }
      }

      // 2. Garantia de exclusão direta nas tabelas da aplicação
      await supabase.from('hospedes').delete().eq('id', id);

      if (targetEmail) {
        await supabase.from('usuarios').delete().ilike('email', targetEmail);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hotel_novo_hospede'));
        window.dispatchEvent(new CustomEvent('hotel_usuario_deletado', { detail: { email: targetEmail } }));
      }
    } catch (err) {
      console.warn('Erro ao deletar hóspede:', err);
    }
    return true;
  },

  subscribeHospedes(callback: () => void): () => void {
    try {
      const channel = supabase
        .channel(`realtime_hospedes_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'hospedes' },
          () => {
            callback();
          }
        )
        .subscribe();

      return () => {
        try { supabase.removeChannel(channel); } catch (e) {}
      };
    } catch (err) {
      return () => {};
    }
  },

  async getPerfilHospedeLogado(emailOrName?: string, explicitName?: string): Promise<any> {
    const normalizeStr = (val: string) =>
      (val || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    let searchEmail = (emailOrName && emailOrName.includes('@')) ? emailOrName.trim().toLowerCase() : '';
    let searchName = (explicitName || (emailOrName && !emailOrName.includes('@') ? emailOrName : '')).trim();

    if (!searchEmail && typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('hotelnozap_user_email');
      if (savedEmail) searchEmail = savedEmail.trim().toLowerCase();
    }
    if (!searchName && typeof window !== 'undefined') {
      const savedName = localStorage.getItem('hotelnozap_user_name');
      if (savedName) searchName = savedName.trim();
    }

    if (!searchEmail) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user?.email) {
          searchEmail = sessionData.session.user.email.trim().toLowerCase();
        }
      } catch { /* ignore */ }
    }

    let hData: any = null;
    let uData: any = null;

    try {
      // 1. Busca por e-mail em hospedes e usuarios
      if (searchEmail) {
        const { data: h } = await supabase.from('hospedes').select('*').ilike('email', searchEmail).maybeSingle();
        hData = h;
        const { data: u } = await supabase.from('usuarios').select('*').ilike('email', searchEmail).maybeSingle();
        uData = u;
      }

      // 2. Busca inteligente por Nome (se não achou por e-mail ou para enriquecer dados)
      if (searchName && searchName !== 'Hóspede' && searchName.length >= 2) {
        const nameTokens = searchName.split(/\s+/).filter((t: string) => t.length >= 2);
        const fName = nameTokens[0] || searchName;
        const lName = nameTokens.length > 1 ? nameTokens[nameTokens.length - 1] : '';

        if (!hData) {
          const { data: hList } = await supabase.from('hospedes').select('*').ilike('nome', `%${fName}%`).limit(10);
          if (hList && hList.length > 0) {
            const matched = hList.find((h: any) => {
              const hNorm = normalizeStr(h.nome);
              const sNorm = normalizeStr(searchName);
              return hNorm.includes(sNorm) || sNorm.includes(hNorm) ||
                (hNorm.includes(normalizeStr(fName)) && (!lName || hNorm.includes(normalizeStr(lName))));
            });
            if (matched) hData = matched;
            else if (hList.length === 1) hData = hList[0];
          }
        }

        if (!uData) {
          const { data: uList } = await supabase.from('usuarios').select('*').ilike('nome', `%${fName}%`).limit(10);
          if (uList && uList.length > 0) {
            const matched = uList.find((u: any) => {
              const uNorm = normalizeStr(u.nome);
              const sNorm = normalizeStr(searchName);
              return uNorm.includes(sNorm) || sNorm.includes(uNorm) ||
                (uNorm.includes(normalizeStr(fName)) && (!lName || uNorm.includes(normalizeStr(lName))));
            });
            if (matched) uData = matched;
            else if (uList.length === 1) uData = uList[0];
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar dados do hóspede no Supabase:', err);
    }

    const realNome = hData?.nome || uData?.nome || searchName || 'Hóspede';
    const realEmail = hData?.email || uData?.email || searchEmail || '';
    const realCpf = hData?.cpf_passaporte || uData?.cpf || '';
    const realTelefone = maskPhone(hData?.telefone || uData?.telefone || '');
    const realCep = hData?.cep || uData?.cep || '';
    const realLogradouro = hData?.logradouro || uData?.logradouro || '';
    const realNumero = hData?.numero || uData?.numero || '';
    const realBairro = hData?.bairro || uData?.bairro || '';
    const realCidade = uData?.cidade || (hData?.cidade_uf ? hData.cidade_uf.split('/')[0]?.trim() : '') || '';
    const realUf = uData?.uf || (hData?.cidade_uf ? hData.cidade_uf.split('/')[1]?.trim() : '') || '';

    // =========================================================================
    // 1. BUSCA INTELIGENTE DE TODAS AS RESERVAS DESTE HÓSPEDE NO SISTEMA
    // =========================================================================
    let reservasReais: any[] = [];
    try {
      const candidates: any[] = [];

      // A. Busca por ID do hóspede
      if (hData?.id) {
        const { data: byHospedeId } = await supabase
          .from('reservas')
          .select('*')
          .eq('hospede_id', hData.id)
          .order('criado_em', { ascending: false });
        if (byHospedeId) candidates.push(...byHospedeId);
      }

      // B. Busca por e-mail nas observações da reserva
      if (realEmail) {
        const { data: byObsEmail } = await supabase
          .from('reservas')
          .select('*')
          .ilike('observacoes', `%${realEmail}%`)
          .order('criado_em', { ascending: false });
        if (byObsEmail) candidates.push(...byObsEmail);
      }

      // C. Busca flexível e bidirecional por NOME do hóspede
      if (realNome && realNome !== 'Hóspede' && realNome.length >= 2) {
        const tokens = realNome.trim().split(/\s+/).filter((t: string) => t.length >= 2);
        const fName = tokens[0];
        const lName = tokens.length > 1 ? tokens[tokens.length - 1] : '';

        // Busca ampla por primeiro nome
        const { data: byNameQuery } = await supabase
          .from('reservas')
          .select('*')
          .ilike('nome_hospede', `%${fName}%`)
          .order('criado_em', { ascending: false });

        if (byNameQuery) {
          const matched = byNameQuery.filter((r: any) => {
            const rNorm = normalizeStr(r.nome_hospede);
            const uNorm = normalizeStr(realNome);
            return rNorm.includes(uNorm) || uNorm.includes(rNorm) ||
              (rNorm.includes(normalizeStr(fName)) && (!lName || rNorm.includes(normalizeStr(lName))));
          });
          candidates.push(...matched);
        }
      }

      // D. Busca por Telefone nas observações
      const phoneDigits = (realTelefone || '').replace(/\D/g, '');
      if (phoneDigits.length >= 8) {
        const lastDigits = phoneDigits.slice(-8);
        const { data: byPhone } = await supabase
          .from('reservas')
          .select('*')
          .ilike('observacoes', `%${lastDigits}%`)
          .order('criado_em', { ascending: false });
        if (byPhone) candidates.push(...byPhone);
      }

      // Desduplicação por ID único da reserva
      const seenIds = new Set<string>();
      for (const item of candidates) {
        if (item && item.id && !seenIds.has(item.id)) {
          seenIds.add(item.id);
          reservasReais.push(item);
        }
      }

      // Auto-vínculo permanente: se houver reserva sem hospede_id, associa ao hóspede
      if (hData?.id) {
        for (const res of reservasReais) {
          if (!res.hospede_id) {
            res.hospede_id = hData.id;
            supabase.from('reservas').update({ hospede_id: hData.id }).eq('id', res.id).then(() => {}, () => {});
          }
        }
      }

      reservasReais.sort((a, b) => {
        const tA = new Date(a.data_checkin || a.criado_em || 0).getTime();
        const tB = new Date(b.data_checkin || b.criado_em || 0).getTime();
        return tB - tA;
      });
    } catch (rErr) {
      console.warn('Erro ao buscar reservas do hóspede:', rErr);
    }

    // =========================================================================
    // 2. DETECÇÃO INTELIGENTE DAS DUAS SITUAÇÕES:
    //    Situação 1: Check-in ativo OU reserva confirmada
    //    Situação 2: Sem nenhuma reserva e sem check-in
    // =========================================================================
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Situação 1A: Check-in ativo / Hospedado no momento
    const reservaCheckinAtivo = reservasReais.find((r: any) => {
      const s = (r.status || '').toLowerCase().trim();
      const isStatusHospedado = s === 'hospedado' || s === 'checkin' || s === 'check-in' || s === 'em andamento' || s === 'em_andamento' || s === 'ativo';
      if (!isStatusHospedado) return false;
      if (r.data_checkout) {
        const checkout = new Date(r.data_checkout);
        checkout.setHours(23, 59, 59, 999);
        return checkout >= today;
      }
      return true;
    });

    // Situação 1B: Reserva futura confirmada ativa
    const reservaFuturaAtiva = reservasReais.find((r: any) => {
      const s = (r.status || '').toLowerCase().trim();
      const isStatusConfirmada = s === 'confirmada' || s === 'garantida' || s === 'pendente' || s === 'paga';
      if (!isStatusConfirmada) return false;
      if (r.data_checkout) {
        const checkout = new Date(r.data_checkout);
        checkout.setHours(23, 59, 59, 999);
        return checkout >= today;
      }
      return true;
    });

    const reservaAtivaPrincipal = reservaCheckinAtivo || reservaFuturaAtiva || null;
    const temCheckinAtivo = Boolean(reservaCheckinAtivo);
    const temReservaAtiva = Boolean(reservaFuturaAtiva);
    const temEstadiaOuReserva = Boolean(reservaAtivaPrincipal);

    // =========================================================================
    // 3. CARREGAMENTO DOS HOTÉIS VINCULADOS
    // =========================================================================
    const hotelIds = Array.from(new Set(reservasReais.map((r: any) => r.hotel_id).filter(Boolean)));
    const hoteisMap: Record<string, any> = {};
    if (hotelIds.length > 0) {
      try {
        const { data: hList } = await supabase.from('hoteis').select('*').in('id', hotelIds);
        if (hList) {
          hList.forEach((h: any) => {
            hoteisMap[h.id] = h;
          });
        }
      } catch (hErr) {
        console.warn('Erro ao carregar hotéis do histórico:', hErr);
      }
    }

    // Hotel da estadia ativa: estritamente da reserva ativa do hóspede!
    // NUNCA força Morada da Lua nem hotel genérico se o hóspede não tiver reserva ativa.
    let hotelData: any = null;
    if (temEstadiaOuReserva && reservaAtivaPrincipal?.hotel_id) {
      hotelData = hoteisMap[reservaAtivaPrincipal.hotel_id] || null;
      if (!hotelData) {
        try {
          const { data: ht } = await supabase.from('hoteis').select('*').eq('id', reservaAtivaPrincipal.hotel_id).maybeSingle();
          if (ht) {
            hotelData = ht;
            hoteisMap[ht.id] = ht;
          }
        } catch (htErr) {
          console.warn('Erro ao carregar hotel da reserva ativa:', htErr);
        }
      }
    }

    // Situação 2: Se NÃO tem estadia ou reserva ativa, nenhum hotel é retornado!
    const hotelId = temEstadiaOuReserva ? (hotelData?.id || null) : null;
    const hotelConfig = (temEstadiaOuReserva && hotelData) ? extractConfigFromObservacoes(hotelData.observacoes) : null;
    const hotelNome = temEstadiaOuReserva ? (hotelData?.nome || null) : null;
    const hotelCidade = temEstadiaOuReserva ? (hotelData?.cidade || null) : null;
    const hotelUf = temEstadiaOuReserva ? (hotelData?.uf || null) : null;
    const hotelCidadeUf = (temEstadiaOuReserva && hotelData) ? `${hotelData.cidade || ''} / ${hotelData.uf || ''}`.trim() : null;
    const hotelTelefone = temEstadiaOuReserva ? (hotelData?.whatsapp || hotelData?.telefone_gerente || null) : null;
    const hotelWhatsapp = hotelTelefone;
    const hotelWifi = (temEstadiaOuReserva && hotelNome) ? `${hotelNome.replace(/[^a-zA-Z0-9]/g, '')}_VIP` : null;

    // =========================================================================
    // 4. QUARTO DA ESTADIA ATIVA
    // =========================================================================
    let quartoData: any = null;
    if (temEstadiaOuReserva && (reservaAtivaPrincipal?.quarto_id || (reservaAtivaPrincipal?.numero_quarto && hotelData?.id))) {
      try {
        if (reservaAtivaPrincipal.quarto_id) {
          const { data: q } = await supabase.from('quartos').select('*').eq('id', reservaAtivaPrincipal.quarto_id).maybeSingle();
          quartoData = q;
        } else if (reservaAtivaPrincipal.numero_quarto && hotelData?.id) {
          const { data: q } = await supabase.from('quartos').select('*').eq('hotel_id', hotelData.id).eq('numero', reservaAtivaPrincipal.numero_quarto).maybeSingle();
          quartoData = q;
        }
      } catch (qErr) {
        console.warn('Erro ao carregar quarto da reserva:', qErr);
      }
    }

    const quartoNumero = temEstadiaOuReserva ? (reservaAtivaPrincipal?.numero_quarto || quartoData?.numero || '—') : '—';
    const quartoTipo = temEstadiaOuReserva ? (quartoData?.tipo || 'CASAL') : '—';
    const quartoNome = temEstadiaOuReserva
      ? (reservaAtivaPrincipal?.numero_quarto ? `Quarto ${reservaAtivaPrincipal.numero_quarto} (${quartoTipo})` : quartoData?.numero ? `Quarto ${quartoData.numero} (${quartoTipo})` : 'Acomodação')
      : 'Nenhum quarto ocupado';
    const quartoValor = temEstadiaOuReserva ? (Number(quartoData?.valor_diaria) || Number(reservaAtivaPrincipal?.valor_total) || 0) : 0;

    const comodidades: string[] = [];
    if (temEstadiaOuReserva) {
      if (quartoData?.items?.arCondicionado) comodidades.push('Ar Climatizado');
      if (quartoData?.items?.camaKing) comodidades.push('Cama King Size');
      if (quartoData?.items?.frigobar) comodidades.push('Frigobar');
      if (quartoData?.items?.wifi) comodidades.push('Wi-Fi Alta Velocidade');
      if (quartoData?.items?.tvSmart) comodidades.push('Smart TV');
      if (quartoData?.items?.banheira) comodidades.push('Banheira de Hidromassagem');
      if (comodidades.length === 0) {
        comodidades.push('Cama Confortável', 'Ar Climatizado', 'Wi-Fi', 'Smart TV');
      }
    }

    // =========================================================================
    // 5. HISTÓRICO DE RESERVAS DO HÓSPEDE (Com seus respectivos hotéis reais)
    // =========================================================================
    const historicoReservas = reservasReais.map((r: any) => {
      const rHotel = hoteisMap[r.hotel_id];
      const rHotelNome = rHotel?.nome || 'Hotel';
      const rHotelCidadeUf = rHotel ? `${rHotel.cidade || ''} / ${rHotel.uf || ''}`.trim() : '';
      return {
        id: r.id,
        codigo: `#RES-${r.id.substring(0, 6).toUpperCase()}`,
        quarto: r.numero_quarto ? `Quarto ${r.numero_quarto}` : 'Acomodação',
        quartoNumero: r.numero_quarto || '—',
        hotel: rHotelNome,
        hotelCidade: rHotelCidadeUf,
        checkIn: r.data_checkin ? new Date(r.data_checkin).toLocaleDateString('pt-BR') : '',
        checkOut: r.data_checkout ? new Date(r.data_checkout).toLocaleDateString('pt-BR') : '',
        diarias: r.diarias || 1,
        valorTotal: Number(r.valor_total) || 0,
        status: r.status || 'Pendente'
      };
    });

    // Contagem de hospedagens concluídas
    const hospedagensConcluidas = reservasReais.filter((r: any) => {
      const s = (r.status || '').toLowerCase();
      return s.includes('conclu') || s.includes('finaliz') || s.includes('hosped');
    }).length;

    const totalHospedagens = hospedagensConcluidas > 0 ? hospedagensConcluidas : reservasReais.length;
    const pontosFidelidade = totalHospedagens * 10;

    const statusEstadia = temCheckinAtivo
      ? (reservaCheckinAtivo?.status || 'Hospedado')
      : temReservaAtiva
        ? 'Reserva Confirmada'
        : 'Sem Estadia Ativa';

    return {
      id: hData?.id || uData?.id || 'guest-1',
      nome: realNome,
      email: realEmail,
      cpf: realCpf,
      telefone: realTelefone,
      cidade: realCidade,
      uf: realUf,
      cidadeUf: realCidade && realUf ? `${realCidade}/${realUf}` : realCidade || realUf || '',
      cep: realCep,
      logradouro: realLogradouro,
      numero: realNumero,
      bairro: realBairro,
      complemento: '',
      status: hData?.status || uData?.status || 'ativo',
      temCheckinAtivo,
      temReservaAtiva,
      temEstadiaOuReserva,
      hotelId,
      hotelNome,
      hotelCidade,
      hotelUf,
      hotelCidadeUf,
      hotelTelefone,
      hotelWhatsapp,
      hotelWifi,
      hotelConfig,
      quartoNumero,
      quartoTipo,
      quartoNome,
      quartoValor,
      quartoComodidades: comodidades,
      quartoFotos: temEstadiaOuReserva && Array.isArray(quartoData?.fotos) ? quartoData.fotos : [],
      quartoFotoCapa: temEstadiaOuReserva ? (quartoData?.foto_capa || (Array.isArray(quartoData?.fotos) && quartoData.fotos[0]) || hotelData?.url_imagem || '') : '',
      statusEstadia,
      reservaCodigo: temEstadiaOuReserva && reservaAtivaPrincipal ? `#RES-${reservaAtivaPrincipal.id.substring(0, 6).toUpperCase()}` : '—',
      dataCheckin: temEstadiaOuReserva && reservaAtivaPrincipal?.data_checkin ? new Date(reservaAtivaPrincipal.data_checkin).toLocaleDateString('pt-BR') : '—',
      dataCheckout: temEstadiaOuReserva && reservaAtivaPrincipal?.data_checkout ? new Date(reservaAtivaPrincipal.data_checkout).toLocaleDateString('pt-BR') : '—',
      totalDiarias: temEstadiaOuReserva ? (reservaAtivaPrincipal?.diarias || 1) : 0,
      diariaAtual: temCheckinAtivo ? 1 : 0,
      totalHospedagens,
      pontosFidelidade,
      totalConsumo: 0.00,
      historicoReservas
    };
  },

  async updatePerfilHospedeLogado(payload: {
    nome?: string;
    cpf?: string;
    telefone?: string;
    email?: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  }): Promise<boolean> {
    try {
      const email = payload.email?.trim().toLowerCase();
      if (!email) return false;

      const hPayload: any = {};
      if (payload.nome) hPayload.nome = payload.nome;
      if (payload.cpf) hPayload.cpf_passaporte = payload.cpf;
      if (payload.telefone) hPayload.telefone = formatPhoneEvolution(payload.telefone);
      if (payload.cep) hPayload.cep = payload.cep;
      if (payload.logradouro) hPayload.logradouro = payload.logradouro;
      if (payload.numero) hPayload.numero = payload.numero;
      if (payload.bairro) hPayload.bairro = payload.bairro;
      if (payload.cidade || payload.uf) {
        hPayload.cidade_uf = `${payload.cidade || ''}/${payload.uf || ''}`;
      }

      await supabase.from('hospedes').update(hPayload).ilike('email', email);

      const uPayload: any = {};
      if (payload.nome) uPayload.nome = payload.nome;
      if (payload.cpf) uPayload.cpf = payload.cpf;
      if (payload.telefone) uPayload.telefone = formatPhoneEvolution(payload.telefone);
      if (payload.cep) uPayload.cep = payload.cep;
      if (payload.logradouro) uPayload.logradouro = payload.logradouro;
      if (payload.numero) uPayload.numero = payload.numero;
      if (payload.bairro) uPayload.bairro = payload.bairro;
      if (payload.cidade) uPayload.cidade = payload.cidade;
      if (payload.uf) uPayload.uf = payload.uf;

      await supabase.from('usuarios').update(uPayload).ilike('email', email);

      if (payload.nome && typeof window !== 'undefined') {
        localStorage.setItem('hotelnozap_user_name', payload.nome);
        window.dispatchEvent(new CustomEvent('hotel_hospede_atualizado', { detail: payload }));
      }

      return true;
    } catch (err) {
      console.error('Erro ao atualizar perfil do hóspede:', err);
      return false;
    }
  }
};

// Service para Produtos no Supabase com particionamento por Hotel
const getProdutosKey = (hotelId?: string) => {
  const hId = hotelId || currentHotelService.getCurrentHotel().id;
  return `hotelnozap_produtos_${hId}`;
};

const SEED_PRODUTOS_INICIAIS: ProductData[] = [
  { id: 'prod-1', code: 'BEB-01', name: 'Água Mineral sem Gás 500ml', category: 'Bebidas', stock: 48, price: 6.00, status: 'ativo', icon: 'local_drink' },
  { id: 'prod-2', code: 'BEB-02', name: 'Refrigerante Coca-Cola 350ml', category: 'Bebidas', stock: 32, price: 8.50, status: 'ativo', icon: 'local_cafe' },
  { id: 'prod-3', code: 'ALM-01', name: 'Castanha de Caju Regional 100g', category: 'Alimentos', stock: 20, price: 15.00, status: 'ativo', icon: 'restaurant' },
  { id: 'prod-4', code: 'AMN-01', name: 'Kit Amenities Premium (Shampoo/Sabonete)', category: 'Higiene', stock: 60, price: 25.00, status: 'ativo', icon: 'clean_hands' },
];

export const produtosService = {
  getLocalProdutos(hotelId?: string): ProductData[] {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    try {
      const saved = localStorage.getItem(getProdutosKey(hId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* ignore */ }
    return [];
  },

  saveLocalProdutos(prods: ProductData[], hotelId?: string): void {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    try {
      localStorage.setItem(getProdutosKey(hId), JSON.stringify(prods));
      window.dispatchEvent(new Event('hotel_novo_produto'));
    } catch { /* ignore */ }
  },

  async getProdutos(hotelId?: string): Promise<ProductData[]> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const isAll = hotelId === 'ALL' || hotelId === 'all';
    const userRole = (typeof window !== 'undefined' ? localStorage.getItem('hotelnozap_user_role') : '') || '';
    const isSuperAdmin = userRole.toLowerCase().includes('super') || userRole.toLowerCase().includes('admin');

    try {
      let query = supabase.from('produtos').select('*').order('criado_em', { ascending: false });

      if (!isAll && !isSuperAdmin) {
        const dbHotelId = resolveHotelDbId(hId);
        if (dbHotelId && dbHotelId !== '11111111-1111-1111-1111-111111111111') {
          query = query.or(`hotel_id.eq.${dbHotelId},hotel_id.is.null`);
        }
      }

      const { data, error } = await query;

      if (!error && data) {
        const mapped: ProductData[] = data.map((p: any) => ({
          id: String(p.id),
          code: p.sku || `PRD-${String(p.id).substring(0, 4).toUpperCase()}`,
          name: p.nome,
          category: p.categoria || 'Geral',
          price: Number(p.preco) || 0,
          costPrice: Number(p.preco_custo) || 0,
          stock: Number(p.estoque) || 0,
          minStock: Number(p.estoque_minimo) || 5,
          barcode: p.codigo_barras || '',
          sku: p.sku || '',
          status: p.status || 'ativo',
          icon: p.icone || 'inventory_2'
        }));

        this.saveLocalProdutos(mapped, hId);
        return mapped;
      } else if (error) {
        console.warn('Erro ao consultar produtos no Supabase:', error);
      }
    } catch (err) {
      console.warn('Supabase offline para produtos. Usando dados locais:', err);
    }
    return this.getLocalProdutos(hId);
  },

  async createProduto(produto: Partial<ProductData>, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const dbHotelId = resolveHotelDbId(hId);
    const validHotelId = (dbHotelId && dbHotelId !== '11111111-1111-1111-1111-111111111111') ? dbHotelId : null;

    const payload: any = {
      hotel_id: validHotelId,
      nome: produto.name || 'Novo Produto',
      categoria: produto.category || 'Geral',
      preco: Number(produto.price) || 0,
      preco_custo: Number(produto.costPrice) || 0,
      estoque: Number(produto.stock) || 0,
      estoque_minimo: Number(produto.minStock) || 5,
      codigo_barras: produto.barcode || null,
      sku: produto.sku || produto.code || null,
      status: produto.status || 'ativo',
      icone: produto.icon || 'inventory_2'
    };

    try {
      const { data, error } = await supabase.from('produtos').insert([payload]).select();
      if (!error && data && data.length > 0) {
        const created = data[0];
        const mappedProd: ProductData = {
          id: String(created.id),
          code: created.sku || `PRD-${String(created.id).substring(0, 4).toUpperCase()}`,
          name: created.nome,
          category: created.categoria,
          price: Number(created.preco) || 0,
          costPrice: Number(created.preco_custo) || 0,
          stock: Number(created.estoque) || 0,
          minStock: Number(created.estoque_minimo) || 5,
          barcode: created.codigo_barras || '',
          sku: created.sku || '',
          status: created.status || 'ativo',
          icon: created.icone || 'inventory_2'
        };
        const local = this.getLocalProdutos(hId);
        this.saveLocalProdutos([mappedProd, ...local.filter(p => p.id !== mappedProd.id)], hId);
        window.dispatchEvent(new Event('hotel_novo_produto'));
        return true;
      } else if (error) {
        console.error('Erro ao inserir produto no Supabase:', error);
      }
    } catch (err) {
      console.error('Erro ao conectar ao Supabase para criar produto:', err);
    }

    const fallbackProd: ProductData = {
      id: `prd-${Date.now()}`,
      code: produto.code || `PRD-${Math.floor(100 + Math.random() * 900)}`,
      name: produto.name || 'Novo Produto',
      category: produto.category || 'Geral',
      price: Number(produto.price) || 0,
      costPrice: Number(produto.costPrice) || 0,
      stock: Number(produto.stock) || 0,
      minStock: Number(produto.minStock) || 5,
      barcode: produto.barcode || '',
      sku: produto.sku || '',
      status: produto.status || 'ativo',
      icon: produto.icon || 'inventory_2'
    };
    const local = this.getLocalProdutos(hId);
    this.saveLocalProdutos([fallbackProd, ...local], hId);
    window.dispatchEvent(new Event('hotel_novo_produto'));
    return true;
  },

  async updateProduto(id: string, changes: Partial<ProductData>, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const local = this.getLocalProdutos(hId);
    const updated = local.map(p => p.id === id ? { ...p, ...changes } : p);
    this.saveLocalProdutos(updated, hId);

    try {
      const payload: any = {};
      if (changes.name !== undefined) payload.nome = changes.name;
      if (changes.category !== undefined) payload.categoria = changes.category;
      if (changes.price !== undefined) payload.preco = changes.price;
      if (changes.costPrice !== undefined) payload.preco_custo = changes.costPrice;
      if (changes.stock !== undefined) payload.estoque = changes.stock;
      if (changes.minStock !== undefined) payload.estoque_minimo = changes.minStock;
      if (changes.status !== undefined) payload.status = changes.status;
      if (changes.icon !== undefined) payload.icone = changes.icon;
      if (changes.sku !== undefined) payload.sku = changes.sku;
      if (changes.barcode !== undefined) payload.codigo_barras = changes.barcode;

      await supabase.from('produtos').update(payload).eq('id', id);
    } catch (err) {
      console.warn('Erro ao atualizar produto no Supabase:', err);
    }
    window.dispatchEvent(new Event('hotel_novo_produto'));
    return true;
  },

  async deleteProduto(id: string, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const local = this.getLocalProdutos(hId);
    this.saveLocalProdutos(local.filter(p => p.id !== id), hId);

    try {
      await supabase.from('produtos').delete().eq('id', id);
    } catch (err) {
      console.warn('Erro ao excluir produto no Supabase:', err);
    }
    window.dispatchEvent(new Event('hotel_novo_produto'));
    return true;
  },

  subscribeProdutos(callback: () => void): () => void {
    try {
      const channel = supabase
        .channel(`realtime_produtos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'produtos' },
          () => {
            callback();
          }
        )
        .subscribe();

      return () => {
        try { supabase.removeChannel(channel); } catch (e) {}
      };
    } catch (err) {
      return () => {};
    }
  }
};

// Service para Parceiros no Supabase (Tabela: parceiros)
export const parceirosService = {
  async getParceiros(): Promise<Partner[]> {
    try {
      const { data, error } = await supabase
        .from('parceiros')
        .select('*')
        .order('criado_em', { ascending: false });

      if (error || !data || data.length === 0) {
        return [];
      }

      return data.map((p: any) => {
        const isHotelNoZap = (p.nome || p.name || '').toLowerCase().includes('hotel no zap') || 
                             (p.nome || p.name || '').toLowerCase().includes('hotelnozap') || 
                             (p.cupom || '').toUpperCase() === 'HOTELNOZAP';
        const taxaReal = isHotelNoZap ? 0 : (p.taxa_comissao !== undefined && p.taxa_comissao !== null ? Number(p.taxa_comissao) : 10);
        const commissionStr = isHotelNoZap ? '0% Recorrente' : `${taxaReal}% Recorrente`;
        const levelStr = isHotelNoZap ? (p.nivel || 'Institucional') : (p.nivel || p.level || (taxaReal >= 15 ? 'Ouro Master' : taxaReal >= 12 ? 'Ouro' : taxaReal >= 10 ? 'Prata' : 'Bronze'));

        return {
          id: p.id,
          name: p.nome || p.name || 'Parceiro',
          category: p.categoria || p.category || 'Consultor Hoteleiro',
          location: p.cidade_uf || p.location || 'Brasil',
          initials: (p.nome || p.name || 'PA').substring(0, 2).toUpperCase(),
          avatarColor: p.avatar_color || p.avatarColor || 'emerald',
          email: p.email || p.email_contato || 'contato@parceiro.com',
          phone: p.whatsapp || p.phone || '',
          document: p.documento || p.document || '',
          coupon: p.cupom || p.coupon || '',
          taxa_comissao: taxaReal,
          commission: commissionStr,
          level: levelStr,
          indicatedHotels: p.hoteis_indicados || p.indicatedHotels || 0,
          totalVendas: p.total_vendas || p.totalVendas || 0,
          ganhosAcumulados: p.ganhos_acumulados || p.ganhosAcumulados || 0,
          saldoAPagar: p.saldo_a_pagar || p.saldoAPagar || 0,
          status: p.status || 'ativo',
          pixType: p.pix_tipo || p.pixType || 'PIX',
          pixKey: p.pix_chave || p.pixKey || p.whatsapp,
          bankName: p.banco || p.bankName || '',
          holderName: p.titular_pix || p.holderName || (p.nome || p.name || ''),
          isTopAfiliado: p.is_top_afiliado || p.isTopAfiliado || false
        };
      });
    } catch (err) {
      console.warn('Erro ao conectar ao Supabase para parceiros:', err);
      return [];
    }
  },

  async createParceiro(
    parceiro: Partial<Partner>,
    extras?: { password?: string }
  ): Promise<{ success: boolean; id: string | null; authUserId: string | null; error: string | null }> {
    let authUserId: string | null = null;
    let parceiroCriadoId: string | null = null;
    let usuarioCriadoId: string | null = null;

    const cleanEmail = (parceiro.email || parceiro.phone || '').trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, id: null, authUserId: null, error: 'E-mail ou WhatsApp do parceiro não informado.' };
    }

    try {
      // 0. Salva sessão admin para restaurar
      const { data: sessaoAnterior } = await supabase.auth.getSession();
      const haviaSessaoAdmin = !!sessaoAnterior?.session;

      // 1. VALIDAÇÃO UNICIDADE nas 2 tabelas de referência
      const [dupUsuario, dupParceiro] = await Promise.all([
        supabase.from('usuarios').select('id').or(`email.eq.${cleanEmail},telefone.eq.${cleanEmail}`).maybeSingle(),
        supabase.from('parceiros').select('id').or(`email.eq.${cleanEmail},whatsapp.eq.${cleanEmail}`).maybeSingle()
      ]).catch(() => [{ data: null }, { data: null }]);

      if (dupUsuario?.data) {
        return { success: false, id: null, authUserId: null, error: 'Este contato já está cadastrado como usuário do sistema.' };
      }
      if (dupParceiro?.data) {
        return { success: false, id: null, authUserId: null, error: 'Este contato já pertence a um parceiro cadastrado.' };
      }

      // 2. Criar no Auth (com senha)
      const finalPassword = extras?.password || (() => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        return Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => chars[b % chars.length]).join('');
      })();
      try {
        const signUpOptsParc: any = {
          data: { name: parceiro.name, nome: parceiro.name, perfil: 'Parceiro' }
        };
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: cleanEmail.includes('@') ? cleanEmail : `${cleanEmail.replace(/\D/g, '')}@parceiro.hotelnozap.com.br`,
          password: finalPassword,
          options: signUpOptsParc
        });
        if (authError) {
          const msg = authError.message || 'Erro desconhecido.';
          if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered') || msg.toLowerCase().includes('exist')) {
            return { success: false, id: null, authUserId: null, error: `Este e-mail já está registrado no autenticador: ${msg}` };
          }
          return { success: false, id: null, authUserId: null, error: `Falha ao criar credencial do parceiro no Auth: ${msg}` };
        }
        authUserId = authData?.user?.id || null;
        if (!authUserId) {
          return { success: false, id: null, authUserId: null, error: 'Auth não retornou ID do parceiro.' };
        }
      } catch (aErr: any) {
        return { success: false, id: null, authUserId: null, error: `Exceção ao criar Auth do parceiro: ${aErr?.message || aErr}` };
      }

      // Restaura sessão admin após signUp
      if (haviaSessaoAdmin && sessaoAnterior.session) {
        try {
          await supabase.auth.setSession({
            access_token: sessaoAnterior.session.access_token,
            refresh_token: sessaoAnterior.session.refresh_token
          });
        } catch {
          try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
        }
      } else {
        try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
      }

      // 3. Criar na tabela `usuarios` com perfil Parceiro
      const emailUsuario = cleanEmail.includes('@') ? cleanEmail : `${cleanEmail.replace(/\D/g, '')}@parceiro.hotelnozap.com.br`;
      const initials = (parceiro.name || 'PA').trim().split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
      try {
        let insertUsuario = await supabase
          .from('usuarios')
          .insert([{
            nome: parceiro.name || 'Parceiro',
            email: emailUsuario,
            cargo: 'Parceiro Comercial',
            perfil: 'Parceiro',
            telefone: parceiro.phone?.replace(/\D/g, '') || null,
            status: parceiro.status || 'ativo',
            iniciais: initials,
            auth_user_id: authUserId
          }])
          .select('id')
          .single();
        let uErr = insertUsuario.error;
        let uData = insertUsuario.data;

        // Fallback: se colunas auth_user_id/iniciais/endereço não existirem ainda
        if (uErr && (
          uErr.code === '42703' ||
          uErr.message?.includes('auth_user_id') ||
          uErr.message?.includes('iniciais') ||
          uErr.message?.includes('numero') ||
          uErr.message?.includes('cep') ||
          uErr.message?.includes('logradouro')
        )) {
          console.warn('⚠️ createParceiro → usuarios: colunas novas faltantes, removendo e retentando:', uErr.message);
          const fallback: any = {
            nome: parceiro.name || 'Parceiro',
            email: emailUsuario,
            cargo: 'Parceiro Comercial',
            perfil: 'Parceiro',
            telefone: parceiro.phone?.replace(/\D/g, '') || null,
            status: parceiro.status || 'ativo'
          };
          const retry = await supabase
            .from('usuarios')
            .insert([fallback])
            .select('id')
            .single();
          uErr = retry.error;
          uData = retry.data;
        }

        if (uErr) {
          console.error('Erro ao criar usuário parceiro na tabela usuarios:', uErr);
          console.warn('🔴 ROLLBACK: Auth criado mas tabela usuarios falhou. Deletar manualmente o e-mail ', emailUsuario, ' no Auth Supabase.');
          try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
          return { success: false, id: null, authUserId, error: `Falha ao criar entrada na tabela usuarios para parceiro: ${uErr.message || uErr}. (Auth criado — limpe manualmente o e-mail ${emailUsuario} no Supabase Auth)` };
        }
        usuarioCriadoId = uData?.id || null;
      } catch (uEx: any) {
        console.warn('🔴 ROLLBACK: Exceção em usuarios. auth_user_id=', authUserId);
        try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
        return { success: false, id: null, authUserId, error: `Exceção ao criar usuário do parceiro: ${uEx?.message || uEx}. Auth requer limpeza manual.` };
      }

      // 4. Criar na tabela `parceiros`
      const payload: Record<string, any> = {
        nome: parceiro.name,
        categoria: parceiro.category,
        documento: parceiro.document || '00.000.000/0001-00',
        cidade_uf: parceiro.location || 'São Paulo / SP',
        nome_contato: parceiro.name,
        whatsapp: parceiro.phone?.replace(/\D/g, '') || null,
        email: emailUsuario.includes('@') ? emailUsuario : null,
        cupom: parceiro.coupon,
        taxa_comissao: parseFloat(parceiro.commission?.replace('%', '').replace('Recorrente', '').trim() || '10'),
        status: parceiro.status || 'ativo',
        usuario_id: usuarioCriadoId,
        auth_user_id: authUserId,
        pix_tipo: parceiro.pixType || 'PIX',
        pix_chave: parceiro.pixKey || parceiro.phone?.replace(/\D/g, '') || null,
        banco: parceiro.bankName || null,
        titular_pix: parceiro.holderName || parceiro.name || null,
        numero: parceiro.phone?.replace(/\D/g, '') || null
      };

      try {
        let insertResult = await supabase
          .from('parceiros')
          .insert([payload])
          .select('id')
          .single();
        let pErr = insertResult.error;
        let pData = insertResult.data;

        if (pErr && (
          pErr.code === '42703' ||
          pErr.message?.includes('banco') ||
          pErr.message?.includes('titular_pix') ||
          pErr.message?.includes('pix_tipo') ||
          pErr.message?.includes('pix_chave') ||
          pErr.message?.includes('numero') ||
          pErr.message?.includes('auth_user_id') ||
          pErr.message?.includes('usuario_id')
        )) {
          console.warn('⚠️ createParceiro: colunas novas faltantes. Removendo campos e retentando insert...', pErr.message);
          delete payload.banco;
          delete payload.titular_pix;
          delete payload.pix_tipo;
          delete payload.pix_chave;
          delete payload.numero;
          delete payload.auth_user_id;
          delete payload.usuario_id;
          const retry = await supabase
            .from('parceiros')
            .insert([payload])
            .select('id')
            .single();
          pErr = retry.error;
          pData = retry.data;
        }

        if (pErr) {
          console.error('Erro ao criar parceiro na tabela parceiros:', pErr);
          if (usuarioCriadoId) {
            try { await supabase.from('usuarios').delete().eq('id', usuarioCriadoId); } catch (rb) { console.warn('Rollback usuarios falhou:', rb); }
          }
          return { success: false, id: null, authUserId, error: `Falha ao criar entrada na tabela parceiros: ${pErr.message || pErr}` };
        }
        parceiroCriadoId = pData?.id || null;
      } catch (pEx: any) {
        if (usuarioCriadoId) {
          try { await supabase.from('usuarios').delete().eq('id', usuarioCriadoId); } catch (rb) { console.warn('Rollback usuarios falhou:', rb); }
        }
        return { success: false, id: null, authUserId, error: `Exceção ao criar parceiro: ${pEx?.message || pEx}` };
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hotel_novo_parceiro'));
      }

      return { success: true, id: parceiroCriadoId, authUserId, error: null };
    } catch (outerErr: any) {
      console.error('Falha geral em createParceiro:', outerErr);
      // Não deixa sessão "presa"
      try {
        const { data: s } = await supabase.auth.getSession();
        if (s?.session?.user?.id === authUserId) {
          await supabase.auth.signOut({ scope: 'local' });
        }
      } catch { /* ignore */ }
      return { success: false, id: parceiroCriadoId, authUserId, error: `Falha inesperada no cadastro de parceiro: ${outerErr?.message || outerErr}` };
    }
  },

  async updateParceiro(
    id: string,
    parceiro: Partial<Partner>,
    extras?: { password?: string }
  ): Promise<boolean> {
    try {
      // 0. Busca parceiro atual para pegar auth_user_id / usuario_id (vínculos)
      const { data: parceiroAtual, error: errBusca } = await supabase
        .from('parceiros')
        .select('id, auth_user_id, usuario_id, email')
        .eq('id', id)
        .maybeSingle();
      if (errBusca) {
        console.warn('updateParceiro: não achei parceiro por ID, continuando sem atualizar auth/usuarios:', errBusca);
      }
      const authUserId = parceiroAtual?.auth_user_id || null;
      const usuarioId = parceiroAtual?.usuario_id || null;
      const emailAtual = parceiroAtual?.email || parceiro.email || '';
      const cleanEmail = (parceiro.email || emailAtual).trim().toLowerCase();

      // 1. Atualiza AUTH (se senha foi passada, e temos auth_user_id)
      if (authUserId && extras?.password) {
        try {
          const { data: sessaoAnterior } = await supabase.auth.getSession();
          const adminAccessToken = sessaoAnterior?.session?.access_token;
          // Atualização de senha via REST /auth/admin é só com service_role. Sem service_role,
          // fazemos o melhor esforço: atualiza o user_metadata pelo usuário logado se possível.
          console.info('ℹ️ updateParceiro: senha informada, mas atualização via Admin API requer service_role key. Campos de usuário serão atualizados apenas na tabela usuarios/parceiros.');
        } catch (pwErr: any) {
          console.warn('updateParceiro: não atualizou auth (esperado sem service_role):', pwErr?.message);
        }
      }

      // 2. Atualiza TABELA usuarios (perfil Parceiro) - mesmos campos que o create
      if (usuarioId) {
        const initials = (parceiro.name || 'PA').trim().split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
        const payloadUsuarios: any = {};
        if (parceiro.name) payloadUsuarios.nome = parceiro.name;
        if (cleanEmail) payloadUsuarios.email = cleanEmail;
        if (parceiro.phone) payloadUsuarios.telefone = parceiro.phone.replace(/\D/g, '');
        if (parceiro.status) payloadUsuarios.status = parceiro.status;
        if (initials) payloadUsuarios.iniciais = initials;
        payloadUsuarios.cargo = 'Parceiro Comercial';
        payloadUsuarios.perfil = 'Parceiro';

        let updU = await supabase.from('usuarios').update(payloadUsuarios).eq('id', usuarioId);
        if (updU.error && updU.error.code === '42703') {
          delete payloadUsuarios.auth_user_id;
          delete payloadUsuarios.iniciais;
          updU = await supabase.from('usuarios').update(payloadUsuarios).eq('id', usuarioId);
        }
        if (updU.error) {
          console.warn('updateParceiro: não atualizou tabela usuarios (pode faltar coluna):', updU.error.message);
        }
      }

      // 3. Atualiza TABELA parceiros (dados cadastrais + bancários)
      const payload: any = {};
      if (parceiro.name) payload.nome = parceiro.name;
      if (parceiro.category) payload.categoria = parceiro.category;
      if (parceiro.document) payload.documento = parceiro.document;
      if (parceiro.phone) payload.whatsapp = parceiro.phone;
      if (parceiro.coupon) payload.cupom = parceiro.coupon;
      const isHotelNoZap = (parceiro.name || '').toLowerCase().includes('hotel no zap') || 
                           (parceiro.name || '').toLowerCase().includes('hotelnozap') || 
                           (parceiro.coupon || '').toUpperCase() === 'HOTELNOZAP';
      if (isHotelNoZap) {
        payload.taxa_comissao = 0;
      } else if (parceiro.taxa_comissao !== undefined && parceiro.taxa_comissao !== null) {
        payload.taxa_comissao = Number(parceiro.taxa_comissao);
      } else if (parceiro.commission !== undefined && parceiro.commission !== null) {
        payload.taxa_comissao = parseFloat(parceiro.commission.replace('%', '').replace('Recorrente', '').trim());
      }
      if (parceiro.status) payload.status = parceiro.status;
      if (parceiro.pixType) payload.pix_tipo = parceiro.pixType;
      if (parceiro.pixKey !== undefined) payload.pix_chave = parceiro.pixKey || null;
      if (parceiro.bankName !== undefined) payload.banco = parceiro.bankName || null;
      if (parceiro.holderName !== undefined) payload.titular_pix = parceiro.holderName || null;
      if (cleanEmail) payload.email = cleanEmail;

      let updateResult = await supabase.from('parceiros').update(payload).eq('id', id);
      let error = updateResult.error;

      if (error && (
        error.code === '42703' ||
        error.message?.includes('banco') ||
        error.message?.includes('titular_pix') ||
        error.message?.includes('pix_tipo') ||
        error.message?.includes('pix_chave')
      )) {
        delete payload.banco;
        delete payload.titular_pix;
        delete payload.pix_tipo;
        delete payload.pix_chave;
        const retry = await supabase.from('parceiros').update(payload).eq('id', id);
        error = retry.error;
      }

      if (!error && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hotel_parceiro_modificado', { detail: { id, ...payload } }));
      }
      return !error;
    } catch (err) {
      console.error('Erro ao atualizar parceiro no Supabase:', err);
      return false;
    }
  },

  async deleteParceiro(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('parceiros').delete().eq('id', id);
      if (!error && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hotel_parceiro_deletado', { detail: { id } }));
        window.dispatchEvent(new CustomEvent('hotel_parceiro_modificado', { detail: { id, deleted: true } }));
      }
      return !error;
    } catch (err) {
      console.error('Erro ao excluir parceiro no Supabase:', err);
      return false;
    }
  },

  subscribeParceiros(callback: () => void): () => void {
    try {
      const channel = supabase
        .channel(`realtime_parceiros_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'parceiros' },
          () => {
            callback();
          }
        )
        .subscribe();

      return () => {
        try { supabase.removeChannel(channel); } catch (e) {}
      };
    } catch (err) {
      return () => {};
    }
  }
};

// Service para Métricas da Dashboard no Supabase
export interface DashboardSemanaBar {
  day: string;
  name: string;
  date: string;
  value: number;
  height: string;
  active?: boolean;
}

export interface DashboardCategoriaOcupacao {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export interface DashboardAtividade {
  id: string;
  tipo: 'checkin' | 'checkout' | 'reserva' | 'limpeza' | 'quarto';
  titulo: string;
  detalhe: string;
  tempo: string;
  icone: string;
  corBg: string;
  corTexto: string;
}

export interface DashboardMetrics {
  quartosDisponiveis: number;
  quartosOcupados: number;
  quartosReservados: number;
  emLimpeza: number;
  emCheckOut: number;
  faturamentoDia: number;
  faturamentoPeriodo: number;
  totalQuartos: number;
  taxaOcupacao: number;
  faturamentoSemanaDias: DashboardSemanaBar[];
  ocupacaoCategorias: DashboardCategoriaOcupacao[];
  atividadesRecentes: DashboardAtividade[];
}

export const dashboardService = {
  async getMetrics(hotelId?: string, period: 'hoje' | 'semana' | 'mes' = 'hoje'): Promise<DashboardMetrics> {
    try {
      const hId = hotelId || currentHotelService.getCurrentHotel().id;
      const dbHotelId = resolveHotelDbId(hId);

      let queryQ = supabase.from('quartos').select('*');
      let queryR = supabase.from('reservas').select('*');

      if (dbHotelId === '11111111-1111-1111-1111-111111111111') {
        queryQ = queryQ.or(`hotel_id.eq.${dbHotelId},hotel_id.is.null`);
        queryR = queryR.or(`hotel_id.eq.${dbHotelId},hotel_id.is.null`);
      } else {
        queryQ = queryQ.or(`hotel_id.eq.${dbHotelId},hotel_id.is.null`);
        queryR = queryR.or(`hotel_id.eq.${dbHotelId},hotel_id.is.null`);
      }

      const [{ data: dbQuartos, error: errQ }, { data: dbReservas, error: errR }] = await Promise.all([
        queryQ,
        queryR
      ]);

      const quartos = (errQ || !dbQuartos) ? [] : dbQuartos;
      const reservas = (errR || !dbReservas) ? [] : dbReservas;

      // 1. Identificar todas as reservas com hóspedes atualmente hospedados (check-in confirmado/ativo)
      const reservasHospedadas = reservas.filter(r => {
        const s = (r.status || '').toLowerCase();
        return s.includes('hosped');
      });

      const quartosHospedadosIds = new Set<string>();
      const quartosHospedadosNumeros = new Set<string>();
      reservasHospedadas.forEach(r => {
        if (r.quarto_id) quartosHospedadosIds.add(String(r.quarto_id));
        if (r.numero_quarto) quartosHospedadosNumeros.add(String(r.numero_quarto));
      });

      // 2. Classificação dinâmica e precisa de cada quarto:
      // Se o quarto tem hóspede com status Hospedado -> É 1 quarto OCUPADO.
      // Quando o status do hóspede não for mais hospedado -> Se ainda em limpeza vai para LIMPEZA, e após liberado fica DISPONÍVEL para locação.
      let ocupados = 0;
      let limpeza = 0;
      let disponiveis = 0;
      let manutencao = 0;

      quartos.forEach(q => {
        const isHospedado = quartosHospedadosIds.has(String(q.id)) || quartosHospedadosNumeros.has(String(q.numero || q.number));
        const rawStatus = (q.status || 'disponivel').toLowerCase();

        if (isHospedado) {
          // Tem hóspede ativo com check-in -> Quarto OCUPADO
          ocupados++;
          if (rawStatus !== 'ocupado') {
            supabase.from('quartos').update({ status: 'ocupado' }).eq('id', q.id).then();
          }
        } else if (rawStatus === 'ocupado') {
          // O hóspede não está mais hospedado (concluiu/saiu), portanto o quarto entra em LIMPEZA
          limpeza++;
          supabase.from('quartos').update({ status: 'limpeza' }).eq('id', q.id).then();
        } else if (rawStatus === 'limpeza') {
          limpeza++;
        } else if (rawStatus === 'manutencao') {
          manutencao++;
        } else {
          disponiveis++;
        }
      });

      // O total de quartos ocupados considera todos os quartos vinculados a hóspedes hospedados
      const totalOcupados = Math.max(ocupados, reservasHospedadas.length);
      const totalQuartos = quartos.length;
      const taxaOcupacao = totalQuartos > 0 ? Math.min(100, Math.round((totalOcupados / totalQuartos) * 100)) : 0;

      const now = new Date();
      // Data local (YYYY-MM-DD) e hora local (fuso horário local)
      const ano = now.getFullYear();
      const mes = String(now.getMonth() + 1).padStart(2, '0');
      const dia = String(now.getDate()).padStart(2, '0');
      const todayStr = `${ano}-${mes}-${dia}`;
      const horaAtual = now.getHours();

      // Reservas ativas / confirmadas aguardando entrada
      const reservados = reservas.filter(r => {
        const s = (r.status || '').toLowerCase();
        return (s.includes('confirm') || s.includes('garant') || s.includes('pendent')) && !s.includes('hosped') && !s.includes('canc') && !s.includes('concl');
      }).length;

      // Check-outs do dia (regra inteligente):
      // Todo check-out deve ser feito até meio-dia (12:00).
      // Passou de meio-dia (horaAtual >= 12), o contador zera!
      // Antes de meio-dia (horaAtual < 12), conta todos os quartos que terão check-out hoje
      // (ex: entrou ontem e sai hoje, ou estadia ativa com saída até hoje que ainda não concluiu checkout).
      let checkouts = 0;
      if (horaAtual < 12) {
        const quartosEmCheckout = new Set<string>();
        reservas.forEach(r => {
          const s = (r.status || '').toLowerCase();
          // Não conta se cancelada ou se já teve check-out concluído
          if (s.includes('canc') || s.includes('concl') || s.includes('finaliz')) {
            return;
          }

          const rawCout = (r.data_checkout || r.checkout || '').split('T')[0].trim();
          let coutYmd = rawCout;
          if (rawCout.includes('/')) {
            const parts = rawCout.split('/');
            if (parts.length === 3) {
              coutYmd = parts[0].length === 4
                ? `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
                : `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }

          // Qualifica se a data de saída for hoje, ou se está ativo/hospedado com data de saída até hoje
          const isCheckoutHoje = coutYmd === todayStr || (coutYmd && coutYmd <= todayStr && (s.includes('hosped') || s === 'ativa' || s === 'confirmada'));
          if (isCheckoutHoje) {
            const qKey = r.quarto_id || r.numero_quarto || r.id;
            quartosEmCheckout.add(String(qKey));
          }
        });
        checkouts = quartosEmCheckout.size;
      }

      // Faturamento total
      const faturamentoTotal = reservas.reduce((sum, r) => sum + (Number(r.valor_total) || 0), 0);

      // Faturamento conforme o período
      let faturamentoPeriodo = faturamentoTotal;
      if (period === 'hoje') {
        const faturamentoHoje = reservas
          .filter(r => {
            const created = r.criado_em ? r.criado_em.split('T')[0] : '';
            const checkin = r.data_checkin ? r.data_checkin.split('T')[0] : '';
            const checkout = r.data_checkout ? r.data_checkout.split('T')[0] : '';
            return created === todayStr || (checkin && checkout && todayStr >= checkin && todayStr <= checkout);
          })
          .reduce((sum, r) => {
            const val = Number(r.valor_total) || 0;
            const checkin = r.data_checkin ? r.data_checkin.split('T')[0] : '';
            const checkout = r.data_checkout ? r.data_checkout.split('T')[0] : '';
            if (checkin && checkout) {
              const nights = Math.max(1, Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / (1000 * 60 * 60 * 24)));
              return sum + Math.round(val / nights);
            }
            return sum + val;
          }, 0);
        faturamentoPeriodo = faturamentoHoje > 0 ? faturamentoHoje : faturamentoTotal;
      } else if (period === 'semana') {
        faturamentoPeriodo = faturamentoTotal;
      } else if (period === 'mes') {
        faturamentoPeriodo = faturamentoTotal;
      }

      // Faturamento da semana (7 barras reais)
      const dayOfWeek = now.getDay();
      const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const daysMeta = [
        { day: 'S', name: 'Segunda', offset: 0 },
        { day: 'T', name: 'Terça', offset: 1 },
        { day: 'Q', name: 'Quarta', offset: 2 },
        { day: 'Q', name: 'Quinta', offset: 3 },
        { day: 'S', name: 'Sexta', offset: 4 },
        { day: 'S', name: 'Sábado', offset: 5 },
        { day: 'D', name: 'Domingo', offset: 6 },
      ];

      const rawBars = daysMeta.map(d => {
        const dObj = new Date(monday);
        dObj.setDate(monday.getDate() + d.offset);
        const dStr = dObj.toISOString().split('T')[0];
        const isToday = dObj.toDateString() === now.toDateString();

        let dayVal = 0;
        reservas.forEach(r => {
          const cr = r.criado_em ? r.criado_em.split('T')[0] : '';
          const cin = r.data_checkin ? r.data_checkin.split('T')[0] : '';
          const cout = r.data_checkout ? r.data_checkout.split('T')[0] : '';
          const val = Number(r.valor_total) || 0;

          if (cr === dStr) {
            dayVal += val;
          } else if (cin && cout && dStr >= cin && dStr <= cout) {
            const nights = Math.max(1, Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / (1000 * 60 * 60 * 24)));
            dayVal += Math.round(val / nights);
          }
        });

        return {
          day: d.day,
          name: d.name,
          date: dStr,
          value: dayVal,
          active: isToday
        };
      });

      const maxVal = Math.max(...rawBars.map(b => b.value), 1);
      const faturamentoSemanaDias: DashboardSemanaBar[] = rawBars.map(b => ({
        ...b,
        height: b.value > 0 ? `${Math.max(15, Math.round((b.value / maxVal) * 100))}%` : '8%'
      }));

      // Categorias reais do hotel
      const catCounts: Record<string, number> = {};
      quartos.forEach(q => {
        const rawType = (q.tipo || q.categoria || 'Standard').trim();
        const formattedType = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();
        catCounts[formattedType] = (catCounts[formattedType] || 0) + 1;
      });

      const colorsPalette = ['#006c49', '#2563eb', '#7c3aed', '#f59e0b', '#64748b'];
      const ocupacaoCategorias: DashboardCategoriaOcupacao[] = Object.entries(catCounts).map(([catName, count], idx) => ({
        name: catName,
        count,
        percentage: totalQuartos > 0 ? Math.round((count / totalQuartos) * 100) : 0,
        color: colorsPalette[idx % colorsPalette.length]
      }));

      // Atividades Recentes Reais
      const atividadesRecentes: DashboardAtividade[] = [];

      reservas.forEach(r => {
        atividadesRecentes.push({
          id: `res-${r.id}`,
          tipo: 'reserva',
          titulo: `Nova reserva: ${r.nome_hospede || 'Hóspede'}`,
          detalhe: `Quarto ${r.numero_quarto || '101'} • ${Number(r.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} • ${r.status || 'Confirmada'}`,
          tempo: r.criado_em ? new Date(r.criado_em).toLocaleDateString('pt-BR') : 'Hoje',
          icone: 'book_online',
          corBg: 'bg-[#dae2fd]',
          corTexto: 'text-[#131b2e]'
        });
      });

      quartos.forEach(q => {
        if (q.status === 'ocupado') {
          atividadesRecentes.push({
            id: `q-occ-${q.id}`,
            tipo: 'checkin',
            titulo: `Hóspede ativo: Quarto ${q.numero} (${q.tipo || 'STANDARD'})`,
            detalhe: 'Check-in ativo no sistema • Quarto Ocupado',
            tempo: 'Em andamento',
            icone: 'login',
            corBg: 'bg-[#6cf8bb]/20',
            corTexto: 'text-[#006c49]'
          });
        } else if (q.status === 'limpeza') {
          atividadesRecentes.push({
            id: `q-cln-${q.id}`,
            tipo: 'limpeza',
            titulo: `Higienização em andamento: Quarto ${q.numero}`,
            detalhe: 'Equipe de Governança • Em andamento',
            tempo: 'Hoje',
            icone: 'cleaning_services',
            corBg: 'bg-[#ffddb8]/40',
            corTexto: 'text-[#2a1700]'
          });
        }
      });

      return {
        quartosDisponiveis: disponiveis,
        quartosOcupados: ocupados,
        quartosReservados: reservados,
        emLimpeza: limpeza,
        emCheckOut: checkouts,
        faturamentoDia: faturamentoTotal,
        faturamentoPeriodo: faturamentoPeriodo,
        totalQuartos: totalQuartos,
        taxaOcupacao: taxaOcupacao,
        faturamentoSemanaDias,
        ocupacaoCategorias,
        atividadesRecentes: atividadesRecentes.slice(0, 5)
      };
    } catch (err) {
      console.warn('Erro ao carregar métricas reais da dashboard no Supabase:', err);
      return {
        quartosDisponiveis: 0,
        quartosOcupados: 0,
        quartosReservados: 0,
        emLimpeza: 0,
        emCheckOut: 0,
        faturamentoDia: 0,
        faturamentoPeriodo: 0,
        totalQuartos: 0,
        taxaOcupacao: 0,
        faturamentoSemanaDias: [],
        ocupacaoCategorias: [],
        atividadesRecentes: []
      };
    }
  }
};

// Service para Tipos de Quartos no Supabase com Fallback Local & Sincronização
const LOCAL_KEY_TIPOS_QUARTOS = 'hotelnozap_tipos_quartos_v1';

const INITIAL_SEED_TIPOS_QUARTOS: RoomTypeData[] = [
  {
    id: 'tq-casal',
    code: 'TP-CASAL',
    name: 'Casal',
    description: 'Acomodação confortável para casal com cama de casal.',
    icon: 'bed',
    capacity: 2,
    bedConfig: '1 Cama de Casal',
    dailyPrice: 220.00,
    linkedRoomsCount: 4,
    status: 'ativo',
  },
  {
    id: 'tq-solteiro',
    code: 'TP-SOLT',
    name: 'Solteiro',
    description: 'Acomodação individual prática e confortável.',
    icon: 'bed',
    capacity: 1,
    bedConfig: '1 Cama de Solteiro',
    dailyPrice: 150.00,
    linkedRoomsCount: 2,
    status: 'ativo',
  },
  {
    id: 'tq-1',
    code: 'TP-101',
    name: 'Suíte Master King',
    description: 'Acomodação luxuosa com cama King Size, banheira de hidromassagem e vista para o mar',
    icon: 'bed',
    capacity: 2,
    bedConfig: '1 Cama King Size',
    dailyPrice: 450.00,
    linkedRoomsCount: 4,
    status: 'ativo',
  },
  {
    id: 'tq-2',
    code: 'TP-102',
    name: 'Quarto Standard Duplo',
    description: 'Acomodação aconchegante com ar climatizado, Wi-Fi rápido e frigobar completo',
    icon: 'bed',
    capacity: 2,
    bedConfig: '2 Camas Solteiro ou 1 Casal',
    dailyPrice: 220.00,
    linkedRoomsCount: 8,
    status: 'ativo',
  },
  {
    id: 'tq-3',
    code: 'TP-103',
    name: 'Bangalô Premium Vista Mar',
    description: 'Bangalô privativo beira-mar com varanda gourmet e rede de descanso',
    icon: 'house',
    capacity: 4,
    bedConfig: '1 King + 2 Solteiro',
    dailyPrice: 680.00,
    linkedRoomsCount: 3,
    status: 'ativo',
  },
  {
    id: 'tq-4',
    code: 'TP-104',
    name: 'Apartamento Família Deluxe',
    description: 'Espaço amplo de 2 ambientes conjugados ideal para famílias com crianças',
    icon: 'apartment',
    capacity: 5,
    bedConfig: '2 Casal + 1 Solteiro',
    dailyPrice: 520.00,
    linkedRoomsCount: 5,
    status: 'ativo',
  },
];

const getTiposQuartosKey = (hotelId?: string) => {
  const hId = hotelId || currentHotelService.getCurrentHotel().id;
  return `hotelnozap_tipos_quartos_${hId}`;
};

export const tiposQuartosService = {
  getLocalStorageTypes(hotelId?: string): RoomTypeData[] {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    try {
      const saved = localStorage.getItem(getTiposQuartosKey(hId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao ler localStorage de tipos de quartos:', e);
    }
    const seed = INITIAL_SEED_TIPOS_QUARTOS.map(t => ({
      ...t,
      id: `${t.id}-${hId}`
    }));
    localStorage.setItem(getTiposQuartosKey(hId), JSON.stringify(seed));
    return seed;
  },

  saveLocalStorageTypes(types: RoomTypeData[], hotelId?: string): void {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    try {
      localStorage.setItem(getTiposQuartosKey(hId), JSON.stringify(types));
      window.dispatchEvent(new Event('hotel_novo_tipo_quarto'));
    } catch (e) {
      console.warn('Erro ao salvar localStorage de tipos de quartos:', e);
    }
  },

  async getTiposQuartos(hotelId?: string): Promise<RoomTypeData[]> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const localData = this.getLocalStorageTypes(hId);
    try {
      let query = supabase.from('tipos_quartos').select('*').order('criado_em', { ascending: false });
      if (hId && !hId.startsWith('hotel-master')) {
        query = query.eq('hotel_id', hId);
      }
      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const mappedData: RoomTypeData[] = data.map((t: any) => ({
          id: String(t.id),
          code: `TP-${String(t.id).substring(0, 4)}`,
          name: t.nome,
          description: t.descricao || '',
          icon: 'bed',
          capacity: t.capacidade || 2,
          bedConfig: `${t.capacidade || 2} Acomodações`,
          dailyPrice: Number(t.valor_diaria_padrao) || 0,
          linkedRoomsCount: t.ordenacao || 2,
          status: (t.status || 'ativo').toLowerCase() === 'inativo' ? 'inativo' : 'ativo',
        }));

        const merged = [...localData];
        mappedData.forEach(m => {
          const idx = merged.findIndex(l => l.id === m.id || l.name.toLowerCase() === m.name.toLowerCase());
          if (idx >= 0) merged[idx] = { ...merged[idx], ...m };
          else merged.push(m);
        });
        this.saveLocalStorageTypes(merged, hId);
        return merged;
      }
    } catch (err) {
      console.warn('Supabase offline para tipos de quartos:', err);
    }
    return localData;
  },

  async createTipoQuarto(tipo: Partial<RoomTypeData>, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const localData = this.getLocalStorageTypes(hId);
    const newId = `tq-${Date.now()}`;
    const newCode = `TP-${Math.floor(100 + Math.random() * 900)}`;

    const newType: RoomTypeData = {
      id: newId,
      code: newCode,
      name: tipo.name || 'Novo Tipo de Quarto',
      description: tipo.description || 'Sem descrição cadastrada.',
      icon: tipo.icon || 'bed',
      capacity: Number(tipo.capacity) || 2,
      bedConfig: tipo.bedConfig || `${tipo.capacity || 2} Acomodações`,
      dailyPrice: Number(tipo.dailyPrice) || 200,
      linkedRoomsCount: 0,
      status: tipo.status === 'inativo' ? 'inativo' : 'ativo',
    };

    const updated = [newType, ...localData];
    this.saveLocalStorageTypes(updated, hId);

    try {
      const payload = {
        hotel_id: hId.startsWith('hotel-master') ? null : hId,
        nome: newType.name,
        descricao: newType.description,
        capacidade: newType.capacity,
        valor_diaria_padrao: newType.dailyPrice,
        status: newType.status,
        ordenacao: 1,
      };

      await supabase.from('tipos_quartos').insert([payload]);
    } catch (err) {
      console.warn('Erro ao sincronizar tipo de quarto no Supabase:', err);
    }

    return true;
  },

  async updateTipoQuarto(id: string, tipo: Partial<RoomTypeData>, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const localData = this.getLocalStorageTypes(hId);
    const updated = localData.map((t) => {
      if (t.id === id) {
        return {
          ...t,
          ...tipo,
          name: tipo.name !== undefined ? tipo.name : t.name,
          description: tipo.description !== undefined ? tipo.description : t.description,
          capacity: tipo.capacity !== undefined ? Number(tipo.capacity) : t.capacity,
          dailyPrice: tipo.dailyPrice !== undefined ? Number(tipo.dailyPrice) : t.dailyPrice,
          status: tipo.status !== undefined ? tipo.status : t.status,
        };
      }
      return t;
    });

    this.saveLocalStorageTypes(updated, hId);

    try {
      const payload: any = {};
      if (tipo.name !== undefined) payload.nome = tipo.name;
      if (tipo.description !== undefined) payload.descricao = tipo.description;
      if (tipo.capacity !== undefined) payload.capacidade = tipo.capacity;
      if (tipo.dailyPrice !== undefined) payload.valor_diaria_padrao = tipo.dailyPrice;
      if (tipo.status !== undefined) payload.status = tipo.status;

      await supabase.from('tipos_quartos').update(payload).eq('id', id);
    } catch (err) {
      console.warn('Erro ao atualizar tipo de quarto no Supabase:', err);
    }

    return true;
  },

  async deleteTipoQuarto(id: string, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const localData = this.getLocalStorageTypes(hId);
    const updated = localData.filter((t) => t.id !== id);
    this.saveLocalStorageTypes(updated, hId);

    try {
      await supabase.from('tipos_quartos').delete().eq('id', id);
    } catch (err) {
      console.warn('Erro ao deletar tipo de quarto no Supabase:', err);
    }

    return true;
  },

  subscribeTiposQuartos(callback: () => void): () => void {
    try {
      const channel = supabase
        .channel(`realtime_tipos_quartos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tipos_quartos' },
          () => {
            callback();
          }
        )
        .subscribe();

      return () => {
        try { supabase.removeChannel(channel); } catch (e) {}
      };
    } catch (err) {
      return () => {};
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Realtime Sync Hub para Quartos (WebSocket bidirecional Hotel <-> Camareiras)
// ─────────────────────────────────────────────────────────────────────────────
const QUARTOS_CHANNEL_NAME = 'hotel_quartos_sync_channel';
let _quartosSyncChannel: any = null;
const _quartosSubscribers = new Set<(info?: any) => void>();

const getQuartosSyncChannel = () => {
  if (!_quartosSyncChannel) {
    try {
      _quartosSyncChannel = supabase
        .channel(QUARTOS_CHANNEL_NAME)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'quartos' },
          (payload: any) => {
            const record = payload.new || payload.old || {};
            const info = {
              quartoId: record.id,
              numero: record.numero,
              status: record.status === 'disponivel' ? 'livre' : record.status,
              hotel_id: record.hotel_id
            };
            _quartosSubscribers.forEach(cb => {
              try { cb(info); } catch (e) {}
            });
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('hotel_quarto_atualizado', { detail: info }));
            }
          }
        )
        .on(
          'broadcast',
          { event: 'quarto_status_alterado' },
          (msg: any) => {
            const payload = msg?.payload || msg;
            _quartosSubscribers.forEach(cb => {
              try { cb(payload); } catch (e) {}
            });
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('hotel_quarto_atualizado', { detail: payload }));
            }
          }
        );
      _quartosSyncChannel.subscribe();
    } catch (e) {
      console.warn('Erro ao inicializar canal realtime de quartos:', e);
    }
  }
  return _quartosSyncChannel;
};

// Service para Quartos no Supabase com particionamento por Hotel
const getQuartosKey = (hotelId?: string) => {
  const hId = hotelId || currentHotelService.getCurrentHotel().id;
  return `hotelnozap_quartos_${hId}`;
};

const SEED_QUARTOS_PADRAO: any[] = [
  { id: 'q-101', number: '101', name: 'Quarto 101', category: 'STANDARD', status: 'livre', floor: '1º Andar', capacity: 2, dailyPrice: 220, active: true },
  { id: 'q-102', number: '102', name: 'Quarto 102', category: 'LUXO', status: 'ocupado', floor: '1º Andar', capacity: 2, dailyPrice: 350, active: true },
  { id: 'q-201', number: '201', name: 'Quarto 201', category: 'SUÍTE', status: 'livre', floor: '2º Andar', capacity: 4, dailyPrice: 520, active: true },
  { id: 'q-202', number: '202', name: 'Quarto 202', category: 'PREMIUM', status: 'limpeza', floor: '2º Andar', capacity: 4, dailyPrice: 680, active: true },
];

export const quartosService = {
  notifyQuartoAlterado(data: { quartoId: string; numero?: string; status: string; hotel_id?: string; hospede_atual?: string | null; origem?: string }) {
    // 1. Notifica subscribers locais registrados no mesmo processo
    _quartosSubscribers.forEach(cb => {
      try { cb(data); } catch {}
    });

    // 2. Broadcast instantâneo via Supabase Realtime WebSocket (multidispositivos / redes diferentes)
    try {
      const ch = getQuartosSyncChannel();
      if (ch) {
        ch.send({
          type: 'broadcast',
          event: 'quarto_status_alterado',
          payload: {
            ...data,
            timestamp: Date.now()
          }
        }).catch(() => {});
      }
    } catch {}

    // 3. BroadcastChannel para sincronização instantânea multi-abas no mesmo navegador
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('hotel_notifications_channel');
        bc.postMessage({
          type: 'QUARTO_STATUS_ALTERADO',
          data
        });
        setTimeout(() => { try { bc.close(); } catch {} }, 1500);
      }
    } catch {}

    // 4. CustomEvents e localStorage no ambiente do navegador
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_quarto_atualizado', { detail: data }));
      window.dispatchEvent(new CustomEvent('hotel_quarto_modificado', { detail: data }));
      window.dispatchEvent(new CustomEvent('hotel_novo_quarto'));
      try {
        localStorage.setItem('hotel_quarto_status_trigger', JSON.stringify({
          ...data,
          _ts: Date.now()
        }));
      } catch {}
    }
  },

  getLocalQuartos(hotelId?: string): any[] {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    try {
      const saved = localStorage.getItem(getQuartosKey(hId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* ignore */ }
    
    // Apenas o hotel matriz/demo utiliza SEED inicial caso não haja nada cadastrado
    if (hId === '11111111-1111-1111-1111-111111111111') {
      return SEED_QUARTOS_PADRAO;
    }
    // Hotéis importados ou recém-cadastrados iniciam estritamente vazios
    return [];
  },

  saveLocalQuartos(rooms: any[], hotelId?: string): void {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    try {
      localStorage.setItem(getQuartosKey(hId), JSON.stringify(rooms));
      window.dispatchEvent(new Event('hotel_novo_quarto'));
    } catch { /* ignore */ }
  },

  async getQuartos(hotelId?: string): Promise<any[]> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const dbHotelId = resolveHotelDbId(hId);

    try {
      let query = supabase.from('quartos').select('*').order('numero', { ascending: true });
      if (dbHotelId === '11111111-1111-1111-1111-111111111111') {
        query = query.or(`hotel_id.eq.${dbHotelId},hotel_id.is.null`);
      } else {
        query = query.eq('hotel_id', dbHotelId);
      }
      const { data, error } = await query;

      if (!error) {
        if (data && data.length > 0) {
          const mapped = data.map((q: any) => {
            const photos: string[] = Array.isArray(q.fotos)
              ? q.fotos
              : (q.fotos && typeof q.fotos === 'string')
                ? (() => { try { return JSON.parse(q.fotos); } catch { return []; } })()
                : [];
            const fotoCapa = q.foto_capa || photos[0] || q.url_imagem || '';
            const savedCategoria = q.items?.categoria || q.items?.category || q.categoria || q.category || q.tipo || 'Standard';
            const savedTipo = q.items?.tipoQuarto || q.items?.type || q.items?.tipo || q.type || q.tipo_quarto || q.tipo || 'Casal';
            return {
              id: String(q.id),
              hotel_id: q.hotel_id,
              number: q.numero,
              name: `Quarto ${q.numero}`,
              category: savedCategoria,
              categoria: savedCategoria,
              status: q.status === 'disponivel' ? 'livre' : (q.status || 'livre').toLowerCase(),
              floor: q.andar || '1º Andar',
              capacity: q.capacidade || 2,
              dailyPrice: Number(q.valor_diaria) || 0,
              active: q.active !== undefined ? !!q.active : true,
              photos,
              fotoCapa,
              imageUrl: fotoCapa,
              notes: q.observacoes || '',
              observacoes: q.observacoes || '',
              videoUrl: q.video_url || q.videoUrl || q.items?.videoUrl || q.items?.video || q.video || '',
              items: (q.items && typeof q.items === 'object') ? q.items : {},
              comodidades: (q.items && Array.isArray(q.items.comodidades)) ? q.items.comodidades : (q.comodidades || []),
              beds: Number(q.beds) || 1,
              type: savedTipo,
              tipoQuarto: savedTipo
            };
          });

          this.saveLocalQuartos(mapped, hId);
          return mapped;
        } else {
          // Se a tabela no Supabase não tiver quartos:
          // Apenas o hotel matriz/demo pode auto-sincronizar os quartos de demonstração
          if (dbHotelId === '11111111-1111-1111-1111-111111111111') {
            const local = this.getLocalQuartos(hId);
            if (local && local.length > 0) {
              const payloadToSeed = local.map((q: any) => {
                const seedPhotos = Array.isArray(q.photos) ? q.photos : [];
                const seedFotoCapa = q.fotoCapa || seedPhotos[0] || q.imageUrl || null;
                return {
                  hotel_id: dbHotelId,
                  numero: String(q.number || q.numero),
                  tipo: (q.category || q.categoria || q.tipo || 'STANDARD').toUpperCase(),
                  andar: q.floor || q.andar || '1º Andar',
                  status: (q.status === 'livre' || q.status === 'disponivel') ? 'disponivel' : (q.status || 'disponivel'),
                  capacidade: Number(q.capacity || q.capacidade) || 2,
                  valor_diaria: Number(q.dailyPrice || q.valor_diaria) || 0,
                  observacoes: q.notes || q.observacoes || null,
                  fotos: seedPhotos,
                  foto_capa: seedFotoCapa,
                  items: q.items || {},
                  beds: Number(q.beds) || 1,
                  active: q.active !== undefined ? !!q.active : true
                };
              });
              const { data: inserted } = await supabase.from('quartos').insert(payloadToSeed).select();
              if (inserted && inserted.length > 0) {
                const synced = inserted.map((q: any) => {
                  const seedPhotos: string[] = Array.isArray(q.fotos) ? q.fotos : [];
                  const seedFotoCapa = q.foto_capa || seedPhotos[0] || q.url_imagem || '';
                  return {
                    id: String(q.id),
                    number: q.numero,
                    name: `Quarto ${q.numero}`,
                    category: (q.tipo || 'STANDARD').toUpperCase(),
                    status: q.status === 'disponivel' ? 'livre' : (q.status || 'livre').toLowerCase(),
                    floor: q.andar || '1º Andar',
                    capacity: q.capacidade || 2,
                    dailyPrice: Number(q.valor_diaria) || 0,
                    active: q.active !== undefined ? !!q.active : true,
                    photos: seedPhotos,
                    fotoCapa: seedFotoCapa,
                    imageUrl: seedFotoCapa,
                    notes: q.observacoes || '',
                    items: (q.items && typeof q.items === 'object') ? q.items : {},
                    comodidades: (q.items && Array.isArray(q.items.comodidades)) ? q.items.comodidades : (q.comodidades || []),
                    beds: Number(q.beds) || 1,
                    type: q.tipo || (q.tipo || 'STANDARD').toUpperCase()
                  };
                });
                this.saveLocalQuartos(synced, hId);
                return synced;
              }
            }
          }
          // Para todos os outros hotéis (inclusive importados), salva vazio e retorna vazio
          this.saveLocalQuartos([], hId);
          return [];
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar quartos do Supabase:', err);
    }
    return this.getLocalQuartos(hId);
  },

  async getAllQuartos(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('quartos')
        .select('*')
        .order('numero', { ascending: true });

      if (error || !data) return [];

      return data.map((q: any) => {
        const photos: string[] = Array.isArray(q.fotos)
          ? q.fotos
          : (q.fotos && typeof q.fotos === 'string')
            ? (() => { try { return JSON.parse(q.fotos); } catch { return []; } })()
            : [];
        const fotoCapa = q.foto_capa || photos[0] || q.url_imagem || '';
        const savedCategoria = q.items?.categoria || q.items?.category || q.categoria || q.category || q.tipo || 'Standard';
        const savedTipo = q.items?.tipoQuarto || q.items?.type || q.items?.tipo || q.type || q.tipo_quarto || q.tipo || 'Casal';
        return {
          id: String(q.id),
          hotel_id: q.hotel_id,
          number: q.numero,
          name: `Quarto ${q.numero}`,
          category: savedCategoria,
          categoria: savedCategoria,
          status: q.status === 'disponivel' ? 'livre' : (q.status || 'livre').toLowerCase(),
          floor: q.andar || '1º Andar',
          capacity: q.capacidade || 2,
          dailyPrice: Number(q.valor_diaria) || 0,
          active: q.active !== undefined ? !!q.active : true,
          photos,
          fotoCapa,
          imageUrl: fotoCapa,
          notes: q.observacoes || '',
          observacoes: q.observacoes || '',
          items: (q.items && typeof q.items === 'object') ? q.items : {},
          comodidades: (q.items && Array.isArray(q.items.comodidades)) ? q.items.comodidades : (q.comodidades || []),
          beds: Number(q.beds) || 1,
          type: savedTipo,
          tipoQuarto: savedTipo
        };
      });
    } catch (err) {
      console.warn('Erro ao carregar todos os quartos:', err);
      return [];
    }
  },

  async createQuarto(quarto: any, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const dbHotelId = resolveHotelDbId(hId);
    const local = this.getLocalQuartos(hId);

    const numero = String(quarto.number || quarto.numero || '').trim();
    if (!numero) return false;

    const categoryVal = quarto.category || quarto.categoria || quarto.items?.categoria || quarto.items?.category || 'Standard';
    const typeVal = quarto.type || quarto.tipoQuarto || quarto.tipo || quarto.items?.tipoQuarto || quarto.items?.type || 'Casal';
    const tipo = String(categoryVal || 'STANDARD').toUpperCase();
    const andar = String(quarto.floor || quarto.andar || '1º Andar');
    const status = (quarto.status === 'livre' || quarto.status === 'disponivel') ? 'livre' : (quarto.status || 'livre');
    const capacidade = Number(quarto.capacity || quarto.capacidade) || 2;
    const valorDiaria = Number(quarto.dailyPrice || quarto.valor_diaria) || 0;
    const observacoes = quarto.notes || quarto.observacoes || null;
    const photos: string[] = Array.isArray(quarto.photos) ? quarto.photos : [];
    const fotoCapa = quarto.fotoCapa || photos[0] || quarto.imageUrl || '';

    const videoUrl = quarto.videoUrl || quarto.video || quarto.items?.videoUrl || '';
    const finalItems = { ...(quarto.items || {}) };
    finalItems.categoria = categoryVal;
    finalItems.category = categoryVal;
    finalItems.tipoQuarto = typeVal;
    finalItems.type = typeVal;
    finalItems.videoUrl = videoUrl;
    finalItems.video = videoUrl;
    if (quarto.comodidades) {
      finalItems.comodidades = quarto.comodidades;
    }

    const newRoom = {
      id: `q-${Date.now()}`,
      number: numero,
      name: quarto.name || `Quarto ${numero}`,
      category: categoryVal,
      categoria: categoryVal,
      status: status,
      floor: andar,
      capacity: capacidade,
      dailyPrice: valorDiaria,
      active: quarto.active !== undefined ? !!quarto.active : true,
      photos,
      fotoCapa,
      imageUrl: fotoCapa,
      videoUrl: videoUrl,
      video: videoUrl,
      notes: observacoes || '',
      observacoes: observacoes || '',
      items: finalItems,
      beds: Number(quarto.beds) || 1,
      type: typeVal,
      tipoQuarto: typeVal
    };

    this.saveLocalQuartos([...local, newRoom], hId);

    try {
      const payload: any = {
        hotel_id: dbHotelId,
        numero: numero,
        tipo: tipo,
        andar: andar,
        status: status === 'livre' ? 'disponivel' : status,
        capacidade: capacidade,
        valor_diaria: valorDiaria,
        observacoes: observacoes,
        fotos: photos,
        foto_capa: fotoCapa || null,
        items: finalItems,
        beds: Number(quarto.beds) || 1,
        active: quarto.active !== undefined ? !!quarto.active : true
      };
      const { data, error } = await supabase.from('quartos').insert([payload]).select();
      if (error) {
        console.error('Erro ao inserir quarto no Supabase:', error);
      } else if (data && data[0]) {
        const updatedLocal = this.getLocalQuartos(hId).map(q => q.number === numero ? { ...q, id: data[0].id } : q);
        this.saveLocalQuartos(updatedLocal, hId);
      }
    } catch (err) {
      console.warn('Erro ao criar quarto no Supabase:', err);
    }
    return true;
  },

  async updateQuarto(id: string, changes: any, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const dbHotelId = resolveHotelDbId(hId);
    const local = this.getLocalQuartos(hId);
    const currentLocal = local.find(q => (q.id === id || (changes.number && q.number === changes.number) || (changes.numero && q.number === changes.numero)));

    const categoryVal = changes.category || changes.categoria || changes.items?.categoria || changes.items?.category || currentLocal?.category || currentLocal?.categoria || 'Standard';
    const typeVal = changes.type || changes.tipoQuarto || changes.tipo || changes.items?.tipoQuarto || changes.items?.type || currentLocal?.type || currentLocal?.tipoQuarto || 'Casal';

    const existingItems = changes.items || currentLocal?.items || {};
    const videoUrl = changes.videoUrl !== undefined ? changes.videoUrl : (changes.video !== undefined ? changes.video : (existingItems.videoUrl || currentLocal?.videoUrl || ''));
    const finalItems = {
      ...existingItems,
      categoria: categoryVal,
      category: categoryVal,
      tipoQuarto: typeVal,
      type: typeVal,
      videoUrl: videoUrl,
      video: videoUrl
    };
    if (changes.comodidades) {
      finalItems.comodidades = changes.comodidades;
    }

    const updated = local.map(q => (q.id === id || (changes.number && q.number === changes.number) || (changes.numero && q.number === changes.numero)) ? {
      ...q,
      ...changes,
      category: categoryVal,
      categoria: categoryVal,
      type: typeVal,
      tipoQuarto: typeVal,
      videoUrl: videoUrl,
      video: videoUrl,
      items: finalItems
    } : q);
    this.saveLocalQuartos(updated, hId);

    try {
      const payload: any = {};
      if (changes.number !== undefined || changes.numero !== undefined) {
        payload.numero = String(changes.number || changes.numero);
      }
      if (changes.category !== undefined || changes.categoria !== undefined || changes.tipo !== undefined) {
        payload.tipo = String(categoryVal || 'STANDARD').toUpperCase();
      }
      if (changes.floor !== undefined || changes.andar !== undefined) {
        payload.andar = String(changes.floor || changes.andar);
      }
      if (changes.status !== undefined) {
        payload.status = changes.status === 'livre' ? 'disponivel' : changes.status;
      }
      if (changes.capacity !== undefined || changes.capacidade !== undefined) {
        payload.capacidade = Number(changes.capacity || changes.capacidade);
      }
      if (changes.dailyPrice !== undefined || changes.valor_diaria !== undefined) {
        payload.valor_diaria = Number(changes.dailyPrice || changes.valor_diaria);
      }
      if (changes.notes !== undefined || changes.observacoes !== undefined) {
        payload.observacoes = changes.notes || changes.observacoes;
      }
      if (changes.photos !== undefined) {
        payload.fotos = Array.isArray(changes.photos) ? changes.photos : [];
      }
      if (changes.fotoCapa !== undefined) {
        payload.foto_capa = changes.fotoCapa || null;
      }
      if (changes.imageUrl !== undefined && !payload.foto_capa) {
        payload.foto_capa = changes.imageUrl || null;
      }
      payload.items = finalItems;
      if (changes.beds !== undefined) {
        payload.beds = Number(changes.beds) || 1;
      }
      if (changes.active !== undefined) {
        payload.active = !!changes.active;
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const targetNumber = String(changes.number || changes.numero || currentLocal?.number || currentLocal?.numero || '').trim();

      let updateQuery = supabase.from('quartos').update(payload);
      if (uuidRegex.test(id)) {
        updateQuery = updateQuery.eq('id', id);
      } else if (targetNumber) {
        updateQuery = updateQuery.eq('numero', targetNumber);
        if (dbHotelId && dbHotelId !== '11111111-1111-1111-1111-111111111111') {
          updateQuery = updateQuery.or(`hotel_id.eq.${dbHotelId},hotel_id.is.null`);
        }
      } else {
        updateQuery = updateQuery.or(`id.eq.${id},numero.eq.${id}`);
      }
      const { data: updatedRows, error: upErr } = await updateQuery.select();
      if (!upErr && (!updatedRows || updatedRows.length === 0) && targetNumber) {
        await supabase.from('quartos').update(payload).eq('numero', targetNumber);
      }
    } catch (err) {
      console.warn('Erro ao atualizar quarto no Supabase:', err);
    }

    // Emite notificações em tempo real para hotel e camareiras (cross-device e local)
    this.notifyQuartoAlterado({
      quartoId: id,
      numero: String(changes.number || changes.numero || currentLocal?.number || currentLocal?.numero || '').trim(),
      status: changes.status || currentLocal?.status || 'livre',
      hotel_id: dbHotelId || undefined,
      hospede_atual: changes.hospede_atual !== undefined ? changes.hospede_atual : currentLocal?.hospede_atual
    });

    return true;
  },

  async deleteQuarto(id: string, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const local = this.getLocalQuartos(hId);
    const target = local.find(q => q.id === id);
    this.saveLocalQuartos(local.filter(q => q.id !== id), hId);

    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        await supabase.from('quartos').delete().eq('id', id);
      } else if (target?.number) {
        await supabase.from('quartos').delete().eq('numero', target.number);
      }
    } catch { /* ignore */ }
    return true;
  },

  async solicitarLimpezaQuarto(quartoNumeroOuId: string, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const dbHotelId = resolveHotelDbId(hId);
    const cleanNum = String(quartoNumeroOuId).replace(/\D/g, '') || String(quartoNumeroOuId);

    // 1. Atualiza no cache local
    const local = this.getLocalQuartos(hId);
    let foundRoomId = '';
    const updated = local.map(q => {
      const qNum = String(q.number || q.numero || '').replace(/\D/g, '');
      if (q.id === quartoNumeroOuId || qNum === cleanNum || String(q.number) === String(quartoNumeroOuId)) {
        foundRoomId = q.id;
        return { ...q, status: 'limpeza' };
      }
      return q;
    });
    this.saveLocalQuartos(updated, hId);

    // 2. Atualiza no Supabase
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(quartoNumeroOuId)) {
        await supabase.from('quartos').update({ status: 'limpeza' }).eq('id', quartoNumeroOuId);
      } else if (foundRoomId && uuidRegex.test(foundRoomId)) {
        await supabase.from('quartos').update({ status: 'limpeza' }).eq('id', foundRoomId);
      } else {
        await supabase.from('quartos').update({ status: 'limpeza' }).eq('numero', cleanNum);
      }
    } catch (err) {
      console.warn('Erro ao atualizar quarto para limpeza no Supabase:', err);
    }

    // 3. Emite eventos em tempo real multi-abas e WebSocket
    this.notifyQuartoAlterado({
      quartoId: foundRoomId || quartoNumeroOuId,
      numero: cleanNum,
      status: 'limpeza',
      hotel_id: dbHotelId || undefined
    });

    return true;
  },

  subscribeQuartos(callback: (info?: { quartoId?: string; numero?: string; status?: string; hotel_id?: string; hospede_atual?: string | null }) => void): () => void {
    const listeners: Array<() => void> = [];

    // 1. Conecta no canal compartilhado Supabase Realtime (WebSocket cross-browser e multidispositivos)
    getQuartosSyncChannel();
    _quartosSubscribers.add(callback);
    listeners.push(() => {
      _quartosSubscribers.delete(callback);
    });

    // 2. BroadcastChannel local multi-abas no mesmo navegador
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('hotel_notifications_channel');
        const handleBcMsg = (event: MessageEvent) => {
          if (
            event.data?.type === 'QUARTO_STATUS_ALTERADO' ||
            event.data?.type === 'CHECKOUT_REALIZADO' ||
            event.data?.type === 'NOVA_RESERVA_HOSPEDE'
          ) {
            callback(event.data?.data);
          }
        };
        bc.addEventListener('message', handleBcMsg);
        listeners.push(() => {
          try {
            bc.removeEventListener('message', handleBcMsg);
            bc.close();
          } catch {}
        });
      }
    } catch {}

    // 3. Eventos locais de janela (CustomEvent)
    if (typeof window !== 'undefined') {
      const handleCustomEv = (e: any) => {
        callback(e?.detail);
      };
      window.addEventListener('hotel_quarto_atualizado', handleCustomEv);
      window.addEventListener('hotel_quarto_modificado', handleCustomEv);
      listeners.push(() => {
        window.removeEventListener('hotel_quarto_atualizado', handleCustomEv);
        window.removeEventListener('hotel_quarto_modificado', handleCustomEv);
      });

      // 4. StorageEvent para sincronização entre abas
      const handleStorage = (e: StorageEvent) => {
        if (e.key === 'hotel_quarto_status_trigger' && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            callback(parsed);
          } catch {
            callback();
          }
        }
      };
      window.addEventListener('storage', handleStorage);
      listeners.push(() => {
        window.removeEventListener('storage', handleStorage);
      });
    }

    return () => {
      listeners.forEach(fn => {
        try { fn(); } catch {}
      });
    };
  },

  async getAllQuartosRede(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('quartos')
        .select('*')
        .order('numero', { ascending: true });

      if (error) {
        console.warn('[quartosService.getAllQuartosRede] erro query:', error);
        return [];
      }
      if (!data || data.length === 0) return [];

      return data.map((q: any) => {
        const photosRede: string[] = Array.isArray(q.fotos)
          ? q.fotos
          : (q.fotos && typeof q.fotos === 'string')
            ? (() => { try { return JSON.parse(q.fotos); } catch { return []; } })()
            : [];
        const fotoCapaRede = q.foto_capa || photosRede[0] || q.url_imagem || '';
        return {
          id: String(q.id),
          hotelId: q.hotel_id || '',
          number: q.numero || String(q.numero || q.number || ''),
          name: q.nome || q.name || '',
          category: q.categoria || q.category || '',
          status: (q.status || '').toLowerCase() === 'ocupado' ? 'ocupado'
            : (q.status || '').toLowerCase() === 'limpeza' ? 'limpeza'
            : (q.status || '').toLowerCase() === 'manutencao' || (q.status || '').toLowerCase() === 'manutenção' ? 'manutenção'
            : 'livre',
          floor: q.andar || q.floor || '',
          capacity: Number(q.capacidade ?? q.capacity ?? 2) || 2,
          dailyPrice: Number(q.valor_diaria ?? q.dailyPrice ?? 0) || 0,
          active: (q.ativo ?? q.active ?? true) !== false,
          notes: q.observacoes || q.notes || '',
          photos: photosRede,
          fotoCapa: fotoCapaRede,
          imageUrl: fotoCapaRede,
          createdAt: q.criado_em || null,
          updatedAt: q.atualizado_em || null
        };
      });
    } catch (err) {
      console.warn('[quartosService.getAllQuartosRede] exceção:', err);
      return [];
    }
  }
};

// Service para Reservas no Supabase (Tabela: reservas)
export const reservasService = {
  async getReservas(hotelId?: string): Promise<Reserva[]> {
    try {
      const isAll = hotelId === 'ALL' || hotelId === 'all';
      const userRole = (typeof window !== 'undefined' ? localStorage.getItem('hotelnozap_user_role') : '') || '';
      const isSuperAdmin = userRole.toLowerCase().includes('super') || userRole.toLowerCase().includes('admin');

      let query = supabase
        .from('reservas')
        .select('*')
        .order('criado_em', { ascending: false });

      if (!isAll && !isSuperAdmin && hotelId) {
        const dbHotelId = resolveHotelDbId(hotelId);
        query = query.or(`hotel_id.eq.${dbHotelId},hotel_id.is.null`);
      } else if (!isAll && !isSuperAdmin) {
        const hId = currentHotelService.getCurrentHotel().id;
        const dbHotelId = resolveHotelDbId(hId);
        if (dbHotelId && dbHotelId !== '11111111-1111-1111-1111-111111111111') {
          query = query.or(`hotel_id.eq.${dbHotelId},hotel_id.is.null`);
        }
      }

      const { data, error } = await query;

      if (error || !data) {
        console.warn('Aviso ou erro ao carregar reservas do Supabase:', error);
        return [];
      }

      return data.map((r: any) => {
        const checkInDate = r.data_checkin ? r.data_checkin.split('T')[0] : '';
        const checkOutDate = r.data_checkout ? r.data_checkout.split('T')[0] : '';

        let noites = 1;
        if (checkInDate && checkOutDate) {
          const d1 = new Date(checkInDate);
          const d2 = new Date(checkOutDate);
          const diffTime = d2.getTime() - d1.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          noites = diffDays > 0 ? diffDays : 1;
        }

        const shortId = r.id ? r.id.substring(0, 6).toUpperCase() : '202601';

        // Tentar extrair email do hóspede das observações
        let emailExtraido = 'hospede@zaphotel.com.br';
        if (r.observacoes && r.observacoes.includes('@')) {
          const mEmail = r.observacoes.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
          if (mEmail) emailExtraido = mEmail[0];
        }

        // Normalização robusta do status para casar exatamente com os filtros da UI
        let normalizedStatus: Reserva['status'] = 'Confirmada';
        const rawStatus = (r.status || '').toString().toLowerCase();
        if (rawStatus.includes('hosped')) normalizedStatus = 'Hospedado';
        else if (rawStatus.includes('concl')) normalizedStatus = 'Concluída';
        else if (rawStatus.includes('canc')) normalizedStatus = 'Cancelada';
        else normalizedStatus = 'Confirmada';

        return {
          id: r.id,
          reservaNumber: `#RES-${shortId}`,
          hospedeNome: r.nome_hospede || 'Hóspede Não Identificado',
          hospedeEmail: emailExtraido,
          hospedeTelefone: '5581998765432',
          hospedeIniciais: (r.nome_hospede || 'Hóspede').substring(0, 2).toUpperCase(),
          quartoNome: r.numero_quarto ? `Quarto ${r.numero_quarto}` : 'Acomodação Principal',
          quartoTipo: 'Suíte / Quarto',
          checkIn: checkInDate,
          checkOut: checkOutDate,
          noites: noites,
          adultos: r.adultos ?? 1,
          criancas: r.criancas ?? 0,
          dataCriacao: r.criado_em ? new Date(r.criado_em).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
          dataCriacaoIso: r.criado_em || null,
          criado_em: r.criado_em || null,
          hotel_id: r.hotel_id,
          quarto_id: r.quarto_id,
          numero_quarto: r.numero_quarto,
          hospede_id: r.hospede_id,
          valorTotal: `R$ ${Number(r.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          valor_total: Number(r.valor_total || 0),
          status: normalizedStatus,
          observacao: r.observacoes || 'Reserva via Zap',
          formaPagamento: 'PIX / WhatsApp'
        };
      });
    } catch (err) {
      console.warn('Erro ao carregar reservas do Supabase:', err);
      return [];
    }
  },

  async getAllReservas(): Promise<Reserva[]> {
    return this.getReservas('ALL');
  },

  async createReserva(payload: {
    nome_hospede: string;
    numero_quarto: string;
    data_checkin: string;
    data_checkout: string;
    valor_total: number;
    status?: string;
    observacoes?: string;
    hotel_id?: string;
    quarto_id?: string;
    hospede_id?: string;
  }): Promise<Reserva | null> {
    try {
      // REGRA DE NEGÓCIO: Usuários com perfil Hotel não podem fazer reservas para si mesmos
      if (typeof window !== 'undefined') {
        const userRole = (localStorage.getItem('hotelnozap_user_role') || '').toLowerCase().trim();
        const userEmail = (localStorage.getItem('hotelnozap_user_email') || '').toLowerCase().trim();
        const userName = (localStorage.getItem('hotelnozap_user_name') || '').toLowerCase().trim();

        if (userRole === 'hotel' || userRole.includes('gerente')) {
          const nomeHospede = (payload.nome_hospede || '').toLowerCase().trim();
          const isParaSiMesmo =
            (userName && (nomeHospede === userName || nomeHospede.includes(userName))) ||
            (userEmail && payload.observacoes && payload.observacoes.toLowerCase().includes(userEmail));

          if (isParaSiMesmo) {
            console.warn('[Regra Negócio] Usuários com perfil Hotel não podem fazer reservas para si mesmos.');
            return null;
          }
        }
      }

      const isValidUUID = (id?: string | null): boolean => {
        if (!id) return false;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      };

      // 1. Resolução segura de hotel_id com validação no banco (evita erro FK reservas_hotel_id_fkey)
      let resolvedHotelId: string | null = null;
      const targetHotelId = payload.hotel_id || currentHotelService.getCurrentHotel().id;
      if (isValidUUID(targetHotelId)) {
        const { data: htl } = await supabase.from('hoteis').select('id').eq('id', targetHotelId).maybeSingle();
        if (htl?.id) resolvedHotelId = htl.id;
      }

      // 2. Resolução segura de quarto_id com validação no banco (evita erro FK reservas_quarto_id_fkey)
      let resolvedQuartoId: string | null = null;
      if (isValidUUID(payload.quarto_id)) {
        const { data: qrt } = await supabase.from('quartos').select('id, hotel_id').eq('id', payload.quarto_id).maybeSingle();
        if (qrt?.id) {
          resolvedQuartoId = qrt.id;
          if (!resolvedHotelId && qrt.hotel_id) {
            const { data: htlFromQrt } = await supabase.from('hoteis').select('id').eq('id', qrt.hotel_id).maybeSingle();
            if (htlFromQrt?.id) resolvedHotelId = htlFromQrt.id;
          }
        }
      }

      // Se ainda não resolveu hotel_id, buscar o hotel ativo ou primeiro hotel do banco
      if (!resolvedHotelId) {
        const curId = currentHotelService.getCurrentHotel().id;
        if (isValidUUID(curId)) {
          const { data: htlCur } = await supabase.from('hoteis').select('id').eq('id', curId).maybeSingle();
          if (htlCur?.id) resolvedHotelId = htlCur.id;
        }
      }
      if (!resolvedHotelId) {
        const { data: firstHtl } = await supabase.from('hoteis').select('id').order('criado_em', { ascending: false }).limit(1).maybeSingle();
        if (firstHtl?.id) resolvedHotelId = firstHtl.id;
      }

      // 3. Resolução segura de hospede_id com validação no banco (evita erro FK reservas_hospede_id_fkey)
      let resolvedHospedeId: string | null = null;
      if (isValidUUID(payload.hospede_id)) {
        const { data: hsp } = await supabase.from('hospedes').select('id').eq('id', payload.hospede_id).maybeSingle();
        if (hsp?.id) {
          resolvedHospedeId = hsp.id;
        } else {
          // Pode ter sido passado o auth_user_id do hóspede
          const { data: hspByAuth } = await supabase.from('hospedes').select('id').eq('auth_user_id', payload.hospede_id).maybeSingle();
          if (hspByAuth?.id) resolvedHospedeId = hspByAuth.id;
        }
      }
      if (!resolvedHospedeId && payload.observacoes) {
        const emailMatch = payload.observacoes.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) {
          const { data: hspByEmail } = await supabase.from('hospedes').select('id').eq('email', emailMatch[0].toLowerCase()).maybeSingle();
          if (hspByEmail?.id) resolvedHospedeId = hspByEmail.id;
        }
      }

      const dbPayload = {
        nome_hospede: payload.nome_hospede || 'Hóspede Zap',
        numero_quarto: payload.numero_quarto || '101',
        data_checkin: payload.data_checkin,
        data_checkout: payload.data_checkout,
        valor_total: payload.valor_total || 0,
        status: payload.status || 'Confirmada',
        status_pagamento: 'pendente',
        observacoes: payload.observacoes || 'Reserva enviada via portal público Hotel no Zap',
        hotel_id: resolvedHotelId,
        quarto_id: resolvedQuartoId,
        hospede_id: resolvedHospedeId
      };

      let { data, error } = await supabase
        .from('reservas')
        .insert([dbPayload])
        .select('*')
        .single();

      // Fallback resiliente: caso ocorra violação de FK em campos opcionais
      if (error && (error.code === '23503' || error.message?.includes('foreign key'))) {
        console.warn('Tentando inserção resiliente de reserva sem FKs opcionais...');
        const retryRes = await supabase
          .from('reservas')
          .insert([{
            nome_hospede: payload.nome_hospede || 'Hóspede Zap',
            numero_quarto: payload.numero_quarto || '101',
            data_checkin: payload.data_checkin,
            data_checkout: payload.data_checkout,
            valor_total: payload.valor_total || 0,
            status: payload.status || 'Confirmada',
            status_pagamento: 'pendente',
            observacoes: payload.observacoes || 'Reserva enviada via portal público Hotel no Zap',
            hotel_id: resolvedHotelId
          }])
          .select('*')
          .single();
        data = retryRes.data;
        error = retryRes.error;
      }

      if (error || !data) {
        console.error('Erro Supabase ao criar reserva:', error);
        return null;
      }

      // Notificar via CustomEvent em tempo real no window
      if (typeof window !== 'undefined') {
        const notifDetail = {
          id: data.id,
          hotel_id: data.hotel_id,
          nome_hospede: data.nome_hospede,
          quarto_nome: `Quarto ${data.numero_quarto}`,
          numero_quarto: data.numero_quarto,
          valor_total: data.valor_total,
          status: data.status,
          _timestamp: Date.now()
        };

        window.dispatchEvent(new CustomEvent('hotel_nova_reserva', { detail: notifDetail }));
        window.dispatchEvent(new CustomEvent('hotel_reserva_modificada', { detail: data }));

        try {
          localStorage.setItem('hotel_nova_reserva_trigger', JSON.stringify(notifDetail));
        } catch {}
      }

      // Se a reserva já foi criada como Concluída, lança imediatamente no caixa do dia
      if (data.status && data.status.toLowerCase().includes('concl')) {
        try {
          caixaService.registrarReservaConcluida(data);
        } catch (cErr) {
          console.warn('Aviso ao registrar reserva concluída no caixa:', cErr);
        }
      }

      // Disparar envio automático do template de confirmação pela instância conectada do hotel
      const statusCriacao = (data.status || '').toString().toLowerCase();
      if (statusCriacao.includes('confirmad')) {
        import('./templateMensagemService')
          .then(({ templateMensagemService }) => {
            templateMensagemService.dispararConfirmacaoAutomatica(data.hotel_id, data);
          })
          .catch(tErr => console.warn('[templateMensagemService] Erro ao disparar confirmação na criação:', tErr));
      }

      const shortId = data.id ? data.id.substring(0, 6).toUpperCase() : '202601';

      return {
        id: data.id,
        reservaNumber: `#RES-${shortId}`,
        hospedeNome: data.nome_hospede,
        hospedeEmail: 'hospede@zap.com',
        hospedeTelefone: '5581998765432',
        hospedeIniciais: data.nome_hospede.substring(0, 2).toUpperCase(),
        quartoNome: `Quarto ${data.numero_quarto}`,
        quartoTipo: 'Suíte / Quarto',
        checkIn: data.data_checkin ? data.data_checkin.split('T')[0] : '',
        checkOut: data.data_checkout ? data.data_checkout.split('T')[0] : '',
        noites: 1,
        dataCriacao: new Date().toLocaleDateString('pt-BR'),
        valorTotal: `R$ ${Number(data.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        status: (data.status as any) || 'Confirmada',
        observacao: data.observacoes,
        formaPagamento: 'PIX / WhatsApp'
      };
    } catch (err) {
      console.error('Erro ao conectar com Supabase para criar reserva:', err);
      return null;
    }
  },

  async deleteReserva(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('reservas')
        .delete()
        .eq('id', id);

      if (!error && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hotel_reserva_modificada', { detail: { id, deleted: true } }));
      }
      return !error;
    } catch (err) {
      console.error('Erro ao deletar reserva no Supabase:', err);
      return false;
    }
  },

  async updateReservaStatus(id: string, newStatus: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('reservas')
        .update({ status: newStatus })
        .eq('id', id)
        .select('*')
        .single();

      if (!error && data) {
        const qId = data.quarto_id;
        const qNum = data.numero_quarto;
        const hId = data.hotel_id;

        // Se o status do hóspede for 'Hospedado' -> quarto vira 'ocupado'
        if (newStatus.toLowerCase().includes('hosped')) {
          if (qId) await supabase.from('quartos').update({ status: 'ocupado' }).eq('id', qId);
          if (qNum) {
            let q = supabase.from('quartos').update({ status: 'ocupado' }).eq('numero', String(qNum));
            if (hId) q = q.eq('hotel_id', hId);
            await q;
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hotel_quarto_atualizado', { detail: { quartoId: qId, numero: qNum, status: 'ocupado' } }));
          }
        } 
        // Quando o status do hóspede não for mais hospedado (checkout/concluída) -> quarto vai para 'limpeza'
        else if (newStatus.toLowerCase().includes('concl') || newStatus.toLowerCase().includes('finaliz')) {
          if (qId) await supabase.from('quartos').update({ status: 'limpeza' }).eq('id', qId);
          if (qNum) {
            let q = supabase.from('quartos').update({ status: 'limpeza' }).eq('numero', String(qNum));
            if (hId) q = q.eq('hotel_id', hId);
            await q;
          }
          // Registrar automaticamente no caixa do dia
          try {
            caixaService.registrarReservaConcluida(data, hId);
          } catch (e) {
            console.warn('Aviso ao registrar reserva concluída no caixa:', e);
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hotel_quarto_atualizado', { detail: { quartoId: qId, numero: qNum, status: 'limpeza' } }));
          }
        }
        // Se a reserva foi cancelada -> quarto volta a ficar 'livre'
        else if (newStatus.toLowerCase().includes('canc')) {
          if (qId) await supabase.from('quartos').update({ status: 'livre' }).eq('id', qId);
          if (qNum) {
            let q = supabase.from('quartos').update({ status: 'livre' }).eq('numero', String(qNum));
            if (hId) q = q.eq('hotel_id', hId);
            await q;
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hotel_quarto_atualizado', { detail: { quartoId: qId, numero: qNum, status: 'livre' } }));
          }
        }

        // Disparar envio automático do template de confirmação pela instância conectada do hotel
        if (newStatus.toLowerCase().includes('confirmad')) {
          import('./templateMensagemService')
            .then(({ templateMensagemService }) => {
              templateMensagemService.dispararConfirmacaoAutomatica(data.hotel_id, data);
            })
            .catch(tErr => console.warn('[templateMensagemService] Erro ao disparar confirmação na alteração de status:', tErr));
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('hotel_reserva_modificada', { detail: data }));
          window.dispatchEvent(new Event('hotel_quarto_modificado'));
        }
      }
      return !error;
    } catch (err) {
      console.error('Erro ao atualizar status no Supabase:', err);
      return false;
    }
  },

  async realizarCheckout(
    reservaId: string,
    options?: { isAutomatico?: boolean }
  ): Promise<{ success: boolean; reserva?: any; quartoNumero?: string }> {
    try {
      // 1. Atualizar a reserva para 'Concluída'
      const { data: reservaAtualizada, error: resErr } = await supabase
        .from('reservas')
        .update({ status: 'Concluída' })
        .eq('id', reservaId)
        .select('*')
        .single();

      if (resErr || !reservaAtualizada) {
        console.error('Erro ao atualizar status da reserva no checkout:', resErr);
        return { success: false };
      }

      const quartoId = reservaAtualizada.quarto_id;
      const numeroQuarto = reservaAtualizada.numero_quarto;
      const hotelId = reservaAtualizada.hotel_id;
      const nomeHospede = reservaAtualizada.nome_hospede || 'Hóspede';

      // 1.1 Registrar automaticamente no caixa do dia como entrada
      try {
        caixaService.registrarReservaConcluida(reservaAtualizada, hotelId);
      } catch (cErr) {
        console.warn('Aviso ao registrar reserva concluída no caixa durante checkout:', cErr);
      }

      // 2. Atualizar o quarto para 'limpeza' no Supabase
      try {
        const isValidUUID = (id?: string | null): boolean => {
          if (!id) return false;
          return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        };

        if (isValidUUID(quartoId)) {
          await supabase
            .from('quartos')
            .update({ status: 'limpeza' })
            .eq('id', quartoId);
        }

        if (numeroQuarto) {
          let qQuery = supabase
            .from('quartos')
            .update({ status: 'limpeza' })
            .eq('numero', String(numeroQuarto));
          if (isValidUUID(hotelId)) {
            qQuery = qQuery.eq('hotel_id', hotelId);
          }
          await qQuery;
        }
      } catch (qErr) {
        console.warn('Aviso ao atualizar status do quarto para limpeza no Supabase:', qErr);
      }

      // 3. Atualizar cache local de quartos
      if (hotelId) {
        try {
          const localKey = `hotelnozap_quartos_${hotelId}`;
          const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
          const updated = localData.map((q: any) => {
            if ((quartoId && q.id === quartoId) || (numeroQuarto && String(q.number || q.numero) === String(numeroQuarto))) {
              return { ...q, status: 'limpeza' };
            }
            return q;
          });
          localStorage.setItem(localKey, JSON.stringify(updated));
        } catch { /* ignore */ }
      }

      // 4. Montar notificação de Recepção
      const isAuto = !!options?.isAutomatico;
      const notifMsg = isAuto
        ? `⏰ Check-out automático às 12:00 executado com sucesso para a reserva de ${nomeHospede}. O Quarto ${numeroQuarto || ''} foi liberado e o status alterado para LIMPEZA.`
        : `🛎️ Check-out manual realizado pela recepção para a reserva de ${nomeHospede}. O Quarto ${numeroQuarto || ''} foi liberado e o status alterado para LIMPEZA.`;

      const notifPayload = {
        id: `notif-co-${Date.now()}`,
        tipo: 'limpeza',
        hotel_id: hotelId,
        titulo: isAuto ? '⏰ Check-out Automático (12:00)' : '🛎️ Check-out Realizado',
        mensagem: notifMsg,
        itemNome: `Higienização Quarto ${numeroQuarto || ''}`,
        categoria: 'Limpeza',
        quartoNumero: String(numeroQuarto || ''),
        hospedeNome: nomeHospede,
        timestamp: new Date().toISOString()
      };

      // 5. Salvar no histórico de notificações locais do hotel
      if (hotelId) {
        try {
          const notifKey = `hotel_notifications_${hotelId}`;
          const hist = JSON.parse(localStorage.getItem(notifKey) || '[]');
          hist.unshift(notifPayload);
          localStorage.setItem(notifKey, JSON.stringify(hist.slice(0, 50)));
        } catch { /* ignore */ }
      }

      // 6. Broadcast em tempo real para sincronizar todas as abas e componentes
      if (typeof window !== 'undefined') {
        if ('BroadcastChannel' in window) {
          try {
            const bc = new BroadcastChannel('hotel_notifications_channel');
            bc.postMessage({ type: 'CHECKOUT_REALIZADO', data: notifPayload });
            bc.postMessage({ type: 'NOVA_NOTIFICACAO_HOTEL', data: notifPayload });
            bc.close();
          } catch {}
        }

        try {
          localStorage.setItem('hotel_nova_reserva_trigger', JSON.stringify({
            timestamp: Date.now(),
            tipo: 'checkout',
            quartoNumero: numeroQuarto,
            statusQuarto: 'limpeza'
          }));
        } catch { /* ignore */ }

        window.dispatchEvent(new CustomEvent('hotel_reserva_modificada', { detail: reservaAtualizada }));
        window.dispatchEvent(new CustomEvent('hotel_quarto_atualizado', { detail: { quartoId, numero: numeroQuarto, status: 'limpeza' } }));
        window.dispatchEvent(new CustomEvent('hotel_nova_notificacao', { detail: notifPayload }));

        // Disparar template pós checkout via instância conectada
        import('./templateMensagemService')
          .then(({ templateMensagemService }) => {
            templateMensagemService.dispararCheckoutAutomatico(hotelId, reservaAtualizada);
          })
          .catch(cErr => console.warn('[templateMensagemService] Erro ao disparar pós-checkout:', cErr));
      }

      return { success: true, reserva: reservaAtualizada, quartoNumero: String(numeroQuarto || '') };
    } catch (err) {
      console.error('Erro na operação de checkout:', err);
      return { success: false };
    }
  },

  async realizarCheckin(
    reservaId: string,
    dadosCheckin: {
      documento?: string;
      telefone?: string;
      cidadeOrigem?: string;
      placaVeiculo?: string;
      numeroChave?: string;
      observacoes?: string;
      pagoAgora?: boolean;
      metodoPagamento?: string;
      valorPago?: number;
      operador?: string;
      dataCheckin?: string;
      dataCheckout?: string;
      noites?: number;
      adultos?: number;
      criancas?: number;
      valorTotal?: number;
      nomeHospede?: string;
      hospedeId?: string;
    }
  ): Promise<{ success: boolean; reserva?: any; quartoNumero?: string; error?: string }> {
    try {
      // 1. Atualizar a reserva para 'Hospedado'
      const updatePayload: Record<string, any> = {
        status: 'Hospedado'
      };
      if (dadosCheckin.hospedeId) {
        updatePayload.hospede_id = dadosCheckin.hospedeId;
      }
      if (dadosCheckin.nomeHospede) {
        updatePayload.nome_hospede = dadosCheckin.nomeHospede;
      }
      if (dadosCheckin.dataCheckin) {
        updatePayload.data_checkin = dadosCheckin.dataCheckin;
      }
      if (dadosCheckin.dataCheckout) {
        updatePayload.data_checkout = dadosCheckin.dataCheckout;
      }
      if (dadosCheckin.valorTotal !== undefined) {
        updatePayload.valor_total = dadosCheckin.valorTotal;
      }
      if (dadosCheckin.pagoAgora) {
        updatePayload.status_pagamento = 'pago';
      }

      // Concatena informações extras (FNRH, Chave, Placa, Adultos, Crianças, Pagamento) de forma segura em observacoes
      const extraObsList: string[] = [];
      if (dadosCheckin.observacoes) extraObsList.push(dadosCheckin.observacoes);
      if (dadosCheckin.numeroChave) extraObsList.push(`Chave: ${dadosCheckin.numeroChave}`);
      if (dadosCheckin.placaVeiculo) extraObsList.push(`Veículo: ${dadosCheckin.placaVeiculo}`);
      if (dadosCheckin.adultos !== undefined) extraObsList.push(`Adultos: ${dadosCheckin.adultos}`);
      if (dadosCheckin.criancas !== undefined && dadosCheckin.criancas > 0) extraObsList.push(`Crianças: ${dadosCheckin.criancas}`);
      if (dadosCheckin.pagoAgora && dadosCheckin.metodoPagamento) extraObsList.push(`Pago via ${dadosCheckin.metodoPagamento}`);

      if (extraObsList.length > 0) {
        updatePayload.observacoes = extraObsList.join(' | ');
      }

      let { data: reservaAtualizada, error: resErr } = await supabase
        .from('reservas')
        .update(updatePayload)
        .eq('id', reservaId)
        .select('*')
        .single();

      // Fallback resiliente: caso algum campo opcional falhe no schema cache do Supabase
      if (resErr) {
        console.warn('Tentando check-in resiliente com campos essenciais:', resErr);
        const fallbackPayload: Record<string, any> = {
          status: 'Hospedado'
        };
        if (updatePayload.observacoes) fallbackPayload.observacoes = updatePayload.observacoes;
        if (updatePayload.status_pagamento) fallbackPayload.status_pagamento = updatePayload.status_pagamento;

        const retryRes = await supabase
          .from('reservas')
          .update(fallbackPayload)
          .eq('id', reservaId)
          .select('*')
          .single();

        reservaAtualizada = retryRes.data;
        resErr = retryRes.error;
      }

      // Se ainda assim o select falhar (por exemplo RLS), busca os dados atuais da reserva
      if (!reservaAtualizada) {
        const { data: reservaAtual } = await supabase
          .from('reservas')
          .select('*')
          .eq('id', reservaId)
          .single();

        if (reservaAtual) {
          reservaAtualizada = { ...reservaAtual, status: 'Hospedado' };
          resErr = null;
        }
      }

      if (resErr || !reservaAtualizada) {
        console.error('Erro ao atualizar status da reserva no check-in:', resErr);
        return { success: false, error: resErr?.message || 'Falha ao registrar check-in' };
      }

      const quartoId = reservaAtualizada.quarto_id;
      const numeroQuarto = reservaAtualizada.numero_quarto;
      const hotelId = reservaAtualizada.hotel_id;
      const nomeHospede = reservaAtualizada.nome_hospede || 'Hóspede';
      const hospedeId = dadosCheckin.hospedeId || reservaAtualizada.hospede_id;

      // 2. Se houver dados da FNRH (documento, telefone, cidade, placa), atualiza o cadastro do hóspede
      if (hospedeId && (dadosCheckin.documento || dadosCheckin.telefone || dadosCheckin.cidadeOrigem || dadosCheckin.placaVeiculo)) {
        try {
          const hospedeUpdate: Record<string, any> = {};
          if (dadosCheckin.documento) hospedeUpdate.cpf = dadosCheckin.documento;
          if (dadosCheckin.telefone) hospedeUpdate.telefone = dadosCheckin.telefone;
          if (dadosCheckin.cidadeOrigem) hospedeUpdate.cidade_uf = dadosCheckin.cidadeOrigem;
          if (dadosCheckin.placaVeiculo) hospedeUpdate.placa_veiculo = dadosCheckin.placaVeiculo;

          await supabase
            .from('hospedes')
            .update(hospedeUpdate)
            .eq('id', hospedeId);
        } catch (hErr) {
          console.warn('Aviso ao atualizar dados FNRH do hóspede no check-in:', hErr);
        }
      }

      // 3. Atualizar o quarto para 'ocupado'
      try {
        const isValidUUID = (id?: string | null): boolean => {
          if (!id) return false;
          return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        };

        if (isValidUUID(quartoId)) {
          await supabase
            .from('quartos')
            .update({ status: 'ocupado' })
            .eq('id', quartoId);
        }

        if (numeroQuarto) {
          let qQuery = supabase
            .from('quartos')
            .update({ status: 'ocupado' })
            .eq('numero', String(numeroQuarto));
          if (isValidUUID(hotelId)) {
            qQuery = qQuery.eq('hotel_id', hotelId);
          }
          await qQuery;
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('hotel_quarto_atualizado', {
            detail: { quartoId, numero: numeroQuarto, status: 'ocupado' }
          }));
          window.dispatchEvent(new Event('hotel_quarto_modificado'));
          window.dispatchEvent(new Event('hotel_reserva_modificada'));
        }
      } catch (qErr) {
        console.warn('Aviso ao atualizar status do quarto para ocupado no Supabase:', qErr);
      }

      // 4. Atualizar cache local de quartos
      if (hotelId) {
        try {
          const localKey = `hotelnozap_quartos_${hotelId}`;
          const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
          const updated = localData.map((q: any) => {
            if ((quartoId && q.id === quartoId) || (numeroQuarto && String(q.number || q.numero) === String(numeroQuarto))) {
              return { ...q, status: 'ocupado', guestName: nomeHospede };
            }
            return q;
          });
          localStorage.setItem(localKey, JSON.stringify(updated));
        } catch { /* ignore */ }
      }

      // 5. Montar notificação de Recepção
      const notifMsg = `🔑 Check-in realizado para ${nomeHospede}! Quarto ${numeroQuarto || ''} agora está OCUPADO.${dadosCheckin.pagoAgora ? ' Pagamento da diária recebido na entrada.' : ' Pagamento a ser acertado no check-out.'}`;
      const notifPayload = {
        id: `notif-ci-${Date.now()}`,
        tipo: 'reserva',
        hotel_id: hotelId,
        titulo: '🔑 Check-in Realizado',
        mensagem: notifMsg,
        itemNome: `Check-in Quarto ${numeroQuarto || ''}`,
        categoria: 'Recepção',
        quartoNumero: String(numeroQuarto || ''),
        hospedeNome: nomeHospede,
        timestamp: new Date().toISOString()
      };

      // 6. Broadcast em tempo real para sincronizar todas as abas e componentes
      if (typeof window !== 'undefined') {
        if ('BroadcastChannel' in window) {
          try {
            const bc = new BroadcastChannel('hotel_notifications_channel');
            bc.postMessage({ type: 'CHECKIN_REALIZADO', data: notifPayload });
            bc.postMessage({ type: 'NOVA_NOTIFICACAO_HOTEL', data: notifPayload });
            bc.close();
          } catch {}
        }

        try {
          localStorage.setItem('hotel_quarto_status_trigger', JSON.stringify({
            timestamp: Date.now(),
            quartoNumero: numeroQuarto,
            status: 'ocupado',
            hospedeNome: nomeHospede
          }));
          localStorage.setItem('hotel_nova_reserva_trigger', JSON.stringify({
            timestamp: Date.now(),
            tipo: 'checkin',
            quartoNumero: numeroQuarto,
            statusQuarto: 'ocupado'
          }));
        } catch { /* ignore */ }

        window.dispatchEvent(new CustomEvent('hotel_reserva_modificada', { detail: reservaAtualizada }));
        window.dispatchEvent(new CustomEvent('hotel_quarto_atualizado', { detail: { quartoId, numero: numeroQuarto, status: 'ocupado', guestName: nomeHospede } }));
        window.dispatchEvent(new CustomEvent('hotel_nova_notificacao', { detail: notifPayload }));
      }

      return { success: true, reserva: reservaAtualizada, quartoNumero: String(numeroQuarto || '') };
    } catch (err: any) {
      console.error('Erro na operação de check-in:', err);
      return { success: false, error: err?.message };
    }
  },

  subscribeReservas(callback?: (payload: any) => void): () => void {
    const channelId = `realtime_reservas_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservas' },
        (payload) => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hotel_reserva_modificada', { detail: payload }));
            if (payload.eventType === 'INSERT') {
              window.dispatchEvent(new CustomEvent('hotel_nova_reserva', { detail: payload.new }));
            }
          }
          if (callback) {
            callback(payload);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        console.warn('Erro ao cancelar inscrição Realtime de reservas:', e);
      }
    };
  }
};

// Service para Categorias no Supabase (Produtos, Itens, Contas Pagar, Contas Receber)
export const categoriasService = {
  async createCategoriaProduto(nome: string, descricao?: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('categorias_produtos').insert([{ nome, descricao }]);
      return !error;
    } catch (err) {
      console.error('Erro ao criar categoria de produto:', err);
      return false;
    }
  },
  async createCategoriaItemQuarto(nome: string, descricao?: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('categorias_itens_quartos').insert([{ nome, descricao }]);
      return !error;
    } catch (err) {
      console.error('Erro ao criar categoria de item de quarto:', err);
      return false;
    }
  },
  async createCategoriaContaPagar(nome: string, descricao?: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('categorias_contas_pagar').insert([{ nome, descricao }]);
      return !error;
    } catch (err) {
      console.error('Erro ao criar categoria de conta a pagar:', err);
      return false;
    }
  },
  async createCategoriaContaReceber(nome: string, descricao?: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('categorias_contas_receber').insert([{ nome, descricao }]);
      return !error;
    } catch (err) {
      console.error('Erro ao criar categoria de conta a receber:', err);
      return false;
    }
  }
};

// Service para Tipos de Usuários / Perfis (Tabela: tipos_usuarios)
export interface TipoUsuarioDB {
  id?: string;
  tipo_usuario: string;
  ordenacao: number;
  status: 'ativo' | 'inativo';
  observacao?: string;
  permissoes?: string[];
  created_at?: string;
}

const LOCAL_KEY_TIPOS_USUARIOS = 'hotelnozap_tipos_usuarios_v3';

export const DEFAULT_TIPOS_USUARIOS: TipoUsuarioDB[] = [
  {
    id: '11111111-2222-3333-4444-555555555550',
    tipo_usuario: 'Super Admin',
    ordenacao: 0,
    status: 'ativo',
    observacao: 'Master do sistema (Everaldo). Controle total de todos os hoteis parceiros, faturamento, planos e contas master.',
    permissoes: ['Multi-Tenant Total', 'Gestão Parceiros & Planos', 'Todas Permissões de Todos Hotéis', 'Backups & Suporte']
  },
  {
    id: '11111111-2222-3333-4444-555555555551',
    tipo_usuario: 'Administrador',
    ordenacao: 1,
    status: 'ativo',
    observacao: 'Acesso irrestrito a todas as configurações, cadastros, módulo financeiro, logs de auditoria e controle de contas.',
    permissoes: ['Acesso Total ao Sistema', 'Gestão de Usuários & Senhas', 'Relatórios & Auditoria', 'Configuração de Propriedade']
  },
  {
    id: '11111111-2222-3333-4444-555555555557',
    tipo_usuario: 'Hotel',
    ordenacao: 2,
    status: 'ativo',
    observacao: 'Usuário DONO/Gestor do Hotel. Perfil padrão para qualquer novo hotel cadastrado. Acesso total apenas ao seu hotel.',
    permissoes: ['Acesso Total ao Seu Hotel', 'Gestão Quartos & Reservas', 'Financeiro do Hotel', 'Configurações Gerentes/Equipe']
  },
  {
    id: '11111111-2222-3333-4444-555555555558',
    tipo_usuario: 'Parceiro',
    ordenacao: 3,
    status: 'ativo',
    observacao: 'Parceiro Comercial / Afiliado. Acompanha indicações, faturamento das comissões e extrato de repasses Pix.',
    permissoes: ['Dashboard de Indicações', 'Extrato de Comissões', 'Cadastro Clientes/Hoteis', 'Solicitação Saque Pix']
  },
  {
    id: '11111111-2222-3333-4444-555555555552',
    tipo_usuario: 'Gerente',
    ordenacao: 4,
    status: 'ativo',
    observacao: 'Gestão operacional completa do hotel, aprovação de reservas, relatórios gerenciais e controle de estoques.',
    permissoes: ['Gestão de Reservas & Tarifas', 'Cadastro de Produtos & Tarifários', 'Visualização de Métricas', 'Supervisão de Equipes']
  },
  {
    id: '11111111-2222-3333-4444-555555555553',
    tipo_usuario: 'Recepção',
    ordenacao: 5,
    status: 'ativo',
    observacao: 'Operação diária de atendimento, realização de check-in / check-out, lançamentos de consumo no PDV e reservas.',
    permissoes: ['Check-in & Check-out', 'Lançamento de Consumos PDV', 'Criar e Alterar Reservas', 'Cadastro Rápido de Hóspede']
  },
  {
    id: '11111111-2222-3333-4444-555555555554',
    tipo_usuario: 'Financeiro',
    ordenacao: 6,
    status: 'ativo',
    observacao: 'Controle de fluxo de caixa, contas a pagar, contas a receber, faturamento de reservas e relatórios fiscais.',
    permissoes: ['Contas a Pagar & Receber', 'Fluxo de Caixa & Conciliação', 'Relatórios Financeiros', 'Baixa de Pagamentos']
  },
  {
    id: '11111111-2222-3333-4444-555555555555',
    tipo_usuario: 'Governança',
    ordenacao: 7,
    status: 'ativo',
    observacao: 'Supervisão e limpeza de quartos, gestão do status das acomodações (limpo, ocupado, manutenção, sujo).',
    permissoes: ['Status de Limpeza das UH', 'Ordens de Serviço de Manutenção', 'Controle de Enxoval e Frigobar', 'Check-list de Quarto']
  },
  {
    id: '11111111-2222-3333-4444-555555555556',
    tipo_usuario: 'Hóspede',
    ordenacao: 8,
    status: 'ativo',
    observacao: 'Acesso do cliente para auto-atendimento, acompanhamento da reserva, solicitação de serviços de quarto e extrato.',
    permissoes: ['Consulta de Reservas Pessoais', 'Extrato de Consumo', 'Solicitação de Serviços', 'Atualização de Perfil']
  }
];

export const tiposUsuariosService = {
  getLocalTipos(): TipoUsuarioDB[] {
    try {
      const stored = localStorage.getItem(LOCAL_KEY_TIPOS_USUARIOS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch { /* ignore */ }
    return DEFAULT_TIPOS_USUARIOS;
  },

  saveLocalTipos(tipos: TipoUsuarioDB[]) {
    try {
      localStorage.setItem(LOCAL_KEY_TIPOS_USUARIOS, JSON.stringify(tipos));
    } catch { /* ignore */ }
  },

  async getTiposUsuarios(): Promise<TipoUsuarioDB[]> {
    try {
      const { data, error } = await supabase
        .from('tipos_usuarios')
        .select('*')
        .order('ordenacao', { ascending: true });

      if (!error && data && data.length > 0) {
        this.saveLocalTipos(data as TipoUsuarioDB[]);
        return data as TipoUsuarioDB[];
      }
    } catch (err) {
      console.warn('Tabela tipos_usuarios não acessível no Supabase:', err);
    }
    return this.getLocalTipos();
  },

  async createTipoUsuario(payload: {
    tipo_usuario: string;
    ordenacao: number;
    status: 'ativo' | 'inativo';
    observacao?: string;
    permissoes?: string[];
  }): Promise<TipoUsuarioDB> {
    const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : `11111111-2222-3333-4444-${Date.now().toString().slice(-12)}`;

    const newTipo: TipoUsuarioDB = {
      id: newId,
      ...payload,
      created_at: new Date().toISOString()
    };

    // 1. Salvar localmente primeiro para persistência imediata
    const current = this.getLocalTipos();
    const updated = [...current, newTipo];
    this.saveLocalTipos(updated);

    // 2. Persistir no Supabase
    try {
      const { data, error } = await supabase
        .from('tipos_usuarios')
        .insert([{
          id: newId,
          tipo_usuario: payload.tipo_usuario,
          ordenacao: payload.ordenacao,
          status: payload.status,
          observacao: payload.observacao || null,
          permissoes: payload.permissoes || []
        }])
        .select('*')
        .single();

      if (!error && data) {
        const idx = updated.findIndex(t => t.id === newId);
        if (idx !== -1) {
          updated[idx] = data as TipoUsuarioDB;
          this.saveLocalTipos(updated);
        }
      }
    } catch (err) {
      console.warn('Supabase offline ou sem permissão para tipos_usuarios:', err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_novo_tipo_usuario', { detail: newTipo }));
    }

    return newTipo;
  },

  async updateTipoUsuario(id: string, payload: Partial<TipoUsuarioDB>): Promise<boolean> {
    // 1. Atualizar imediatamente no localStorage
    const local = this.getLocalTipos();
    const index = local.findIndex(t => t.id === id || (payload.tipo_usuario && t.tipo_usuario.toLowerCase() === payload.tipo_usuario.toLowerCase()));

    if (index !== -1) {
      local[index] = { ...local[index], ...payload };
      this.saveLocalTipos(local);
    } else {
      local.push({
        id,
        tipo_usuario: payload.tipo_usuario || '',
        ordenacao: payload.ordenacao || 1,
        status: payload.status || 'ativo',
        observacao: payload.observacao
      });
      this.saveLocalTipos(local);
    }

    // 2. Persistir no Supabase
    try {
      const dbPayload: any = { ...payload };
      delete dbPayload.id;

      let res = await supabase
        .from('tipos_usuarios')
        .update(dbPayload)
        .eq('id', id);

      if (res.error && payload.tipo_usuario) {
        await supabase
          .from('tipos_usuarios')
          .update(dbPayload)
          .eq('tipo_usuario', payload.tipo_usuario);
      }
    } catch (err) {
      console.warn('Erro ao atualizar tipo de usuário no Supabase:', err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_novo_tipo_usuario'));
    }

    return true;
  },

  async deleteTipoUsuario(id: string): Promise<boolean> {
    // 1. Remover localmente
    const local = this.getLocalTipos();
    const target = local.find(t => t.id === id);
    const filtered = local.filter(t => t.id !== id && (!target || t.tipo_usuario !== target.tipo_usuario));
    this.saveLocalTipos(filtered);

    // 2. Remover no Supabase
    try {
      let res = await supabase
        .from('tipos_usuarios')
        .delete()
        .eq('id', id);

      if (res.error && target?.tipo_usuario) {
        await supabase
          .from('tipos_usuarios')
          .delete()
          .eq('tipo_usuario', target.tipo_usuario);
      }
    } catch (err) {
      console.warn('Erro ao excluir no Supabase:', err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_novo_tipo_usuario'));
    }

    return true;
  },

  subscribeTiposUsuarios(callback: () => void): () => void {
    try {
      const channel = supabase
        .channel(`realtime_tipos_usuarios_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tipos_usuarios' },
          () => {
            callback();
          }
        )
        .subscribe();

      return () => {
        try { supabase.removeChannel(channel); } catch (e) {}
      };
    } catch (err) {
      return () => {};
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Service para Itens dos Quartos com particionamento por Hotel
// ─────────────────────────────────────────────────────────────────────────────
const getItensQuartosKey = (hotelId?: string) => {
  const hId = hotelId || currentHotelService.getCurrentHotel().id;
  return `hotelnozap_itens_quartos_${hId}`;
};

export interface RoomItemData {
  id: string;
  hotel_id?: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  status: 'ativo' | 'inativo';
  linkedRoomsCount: number;
  category?: string;
}

const INITIAL_SEED_ITENS_QUARTOS: RoomItemData[] = [
  { id: 'it-1', code: '#ITM-001', name: 'Ar-condicionado Split', description: 'Ar-condicionado split 9.000 BTUs com controle remoto e temporizador.', icon: 'ac_unit', status: 'ativo', linkedRoomsCount: 0 },
  { id: 'it-2', code: '#ITM-002', name: 'TV Smart 50"', description: 'Televisor Smart com Android TV, YouTube, Netflix e Disney+ integrados.', icon: 'tv', status: 'ativo', linkedRoomsCount: 0 },
  { id: 'it-3', code: '#ITM-003', name: 'Frigobar', description: 'Frigobar 100 litros com espelho, abastecido diariamente pela governança.', icon: 'kitchen', status: 'ativo', linkedRoomsCount: 0 },
  { id: 'it-4', code: '#ITM-004', name: 'Wi-Fi Alta Velocidade', description: 'Internet de fibra óptica 300 Mbps dedicada com senha individual.', icon: 'wifi', status: 'ativo', linkedRoomsCount: 0 },
  { id: 'it-5', code: '#ITM-005', name: 'Cama King Size', description: 'Cama King 1,93 × 2,03 m com colchão pillow-top e roupa de cama 200 fios.', icon: 'bed', status: 'ativo', linkedRoomsCount: 0 },
  { id: 'it-6', code: '#ITM-006', name: 'Banheira de Hidromassagem', description: 'Banheira com 12 jatos de hidromassagem e controle de temperatura digital.', icon: 'bathtub', status: 'ativo', linkedRoomsCount: 0 },
];

export const itensQuartosService = {
  getLocalItems(hotelId?: string): RoomItemData[] {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    try {
      const saved = localStorage.getItem(getItensQuartosKey(hId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    const seed = INITIAL_SEED_ITENS_QUARTOS.map(i => ({ ...i, id: `${i.id}-${hId}`, hotel_id: hId }));
    localStorage.setItem(getItensQuartosKey(hId), JSON.stringify(seed));
    return seed;
  },

  saveLocalItems(items: RoomItemData[], hotelId?: string): void {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    try {
      localStorage.setItem(getItensQuartosKey(hId), JSON.stringify(items));
      window.dispatchEvent(new Event('hotel_novo_item_quarto'));
    } catch { /* ignore */ }
  },

  async getItens(hotelId?: string): Promise<RoomItemData[]> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const localData = this.getLocalItems(hId);
    try {
      let query = supabase.from('itens_quartos').select('*').order('criado_em', { ascending: false });
      if (hId && !hId.startsWith('hotel-master')) {
        query = query.eq('hotel_id', hId);
      }
      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const mapped: RoomItemData[] = data.map((row: any) => ({
          id: String(row.id),
          hotel_id: row.hotel_id || hId,
          code: `#ITM-${String(row.id).substring(0, 4).toUpperCase()}`,
          name: row.nome,
          description: row.descricao || '',
          icon: row.icone || 'inventory_2',
          status: (row.status || 'ativo').toLowerCase() === 'inativo' ? 'inativo' : 'ativo',
          linkedRoomsCount: 0,
          category: row.categoria || undefined,
        }));

        const merged = [...localData];
        mapped.forEach(m => {
          const idx = merged.findIndex(l => l.id === m.id || l.name.toLowerCase() === m.name.toLowerCase());
          if (idx >= 0) merged[idx] = { ...merged[idx], ...m };
          else merged.push(m);
        });
        this.saveLocalItems(merged, hId);
        return merged;
      }
    } catch (err) {
      console.warn('Supabase offline ou tabela itens_quartos inexistente:', err);
    }
    return localData;
  },

  async createItem(item: Pick<RoomItemData, 'name' | 'description' | 'icon' | 'status' | 'category'>, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const local = this.getLocalItems(hId);
    const newId = `it-${Date.now()}`;
    const newCode = `#ITM-${String(local.length + 1).padStart(3, '0')}`;
    const newItem: RoomItemData = {
      id: newId,
      hotel_id: hId,
      code: newCode,
      name: item.name,
      description: item.description || '',
      icon: item.icon || 'inventory_2',
      status: item.status === 'inativo' ? 'inativo' : 'ativo',
      linkedRoomsCount: 0,
      category: item.category,
    };
    this.saveLocalItems([newItem, ...local], hId);

    try {
      await supabase.from('itens_quartos').insert([{
        hotel_id: hId.startsWith('hotel-master') ? null : hId,
        nome: newItem.name,
        descricao: newItem.description,
        icone: newItem.icon,
        status: newItem.status,
        categoria: newItem.category || null,
      }]);
    } catch (err) {
      console.warn('Supabase offline para itens_quartos:', err);
    }
    return true;
  },

  async updateItem(id: string, changes: Partial<Pick<RoomItemData, 'name' | 'description' | 'icon' | 'status' | 'category'>>, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const local = this.getLocalItems(hId);
    const updated = local.map(i => i.id === id ? { ...i, ...changes } : i);
    this.saveLocalItems(updated, hId);

    try {
      const payload: any = {};
      if (changes.name !== undefined)        payload.nome      = changes.name;
      if (changes.description !== undefined) payload.descricao = changes.description;
      if (changes.icon !== undefined)        payload.icone     = changes.icon;
      if (changes.status !== undefined)      payload.status    = changes.status;
      if (changes.category !== undefined)    payload.categoria = changes.category;
      await supabase.from('itens_quartos').update(payload).eq('id', id);
    } catch (err) {
      console.warn('Supabase: erro ao atualizar item:', err);
    }
    return true;
  },

  async deleteItem(id: string, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const local = this.getLocalItems(hId);
    this.saveLocalItems(local.filter(i => i.id !== id), hId);
    try {
      await supabase.from('itens_quartos').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase: erro ao excluir item:', err);
    }
    return true;
  },

  subscribeItensQuartos(callback: () => void): () => void {
    try {
      const channel = supabase
        .channel(`realtime_itens_quartos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'itens_quartos' },
          () => {
            callback();
          }
        )
        .subscribe();

      return () => {
        try { supabase.removeChannel(channel); } catch (e) {}
      };
    } catch (err) {
      return () => {};
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Service para Categorias dos Quartos com particionamento por Hotel
// ─────────────────────────────────────────────────────────────────────────────
const getCatQuartosKey = (hotelId?: string) => {
  const hId = hotelId || currentHotelService.getCurrentHotel().id;
  return `hotelnozap_categorias_quartos_${hId}`;
};

export interface CategoriaQuartoData {
  id: string;
  hotel_id?: string;
  name: string;
  description: string;       // = observacao
  icon: string;
  iconBgColor: string;
  ordenacao: number;
  linkedRoomsCount: number;
  status: 'ativo' | 'inativo';
}

const INITIAL_SEED_CATEGORIAS: CategoriaQuartoData[] = [
  { id: 'cq-1', name: 'Standard',  description: 'Acomodação padrão do hotel.',         icon: 'bed',           iconBgColor: 'bg-blue-100/70 text-blue-800',    ordenacao: 1, linkedRoomsCount: 0, status: 'ativo' },
  { id: 'cq-2', name: 'Luxo',      description: 'Acomodação de alto padrão.',           icon: 'king_bed',      iconBgColor: 'bg-amber-100/70 text-amber-800',  ordenacao: 2, linkedRoomsCount: 0, status: 'ativo' },
  { id: 'cq-3', name: 'Suíte',     description: 'Suíte com sala de estar integrada.',   icon: 'bedroom_parent',iconBgColor: 'bg-purple-100/70 text-purple-800', ordenacao: 3, linkedRoomsCount: 0, status: 'ativo' },
  { id: 'cq-4', name: 'Premium',   description: 'Categoria premium com amenidades VIP.',icon: 'cottage',       iconBgColor: 'bg-rose-100/70 text-rose-800',    ordenacao: 4, linkedRoomsCount: 0, status: 'ativo' },
];

export const categoriasQuartosService = {
  getLocalCategorias(hotelId?: string): CategoriaQuartoData[] {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    try {
      const saved = localStorage.getItem(getCatQuartosKey(hId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    const seed = INITIAL_SEED_CATEGORIAS.map(c => ({
      ...c,
      id: `${c.id}-${hId}`,
      hotel_id: hId
    }));
    localStorage.setItem(getCatQuartosKey(hId), JSON.stringify(seed));
    return seed;
  },

  saveLocalCategorias(cats: CategoriaQuartoData[], hotelId?: string): void {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    try {
      localStorage.setItem(getCatQuartosKey(hId), JSON.stringify(cats));
      window.dispatchEvent(new Event('hotel_nova_categoria_quarto'));
    } catch { /* ignore */ }
  },

  async getCategorias(hotelId?: string): Promise<CategoriaQuartoData[]> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const localData = this.getLocalCategorias(hId);
    try {
      let query = supabase.from('categorias_quartos').select('*').order('ordenacao', { ascending: true });
      if (hId && !hId.startsWith('hotel-master')) {
        query = query.eq('hotel_id', hId);
      }
      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const ICON_COLORS: Record<number, string> = {
          0: 'bg-blue-100/70 text-blue-800',
          1: 'bg-amber-100/70 text-amber-800',
          2: 'bg-purple-100/70 text-purple-800',
          3: 'bg-rose-100/70 text-rose-800',
          4: 'bg-emerald-100/70 text-emerald-800',
        };
        const mapped: CategoriaQuartoData[] = data.map((row: any, idx: number) => ({
          id: String(row.id),
          hotel_id: row.hotel_id || hId,
          name: row.nome,
          description: row.observacao || row.descricao || '',
          icon: row.icone || 'king_bed',
          iconBgColor: ICON_COLORS[idx % 5] || 'bg-slate-100 text-slate-700',
          ordenacao: row.ordenacao || idx + 1,
          linkedRoomsCount: 0,
          status: (row.status || 'ativo').toLowerCase() === 'inativo' ? 'inativo' : 'ativo',
        }));

        // Merge seguro: dados locais editados pelo usuário são preservados
        const merged = [...localData];
        mapped.forEach(m => {
          const idx = merged.findIndex(l => l.id === m.id || l.name.toLowerCase() === m.name.toLowerCase());
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], ...m, id: merged[idx].id };
          } else {
            merged.push(m);
          }
        });

        this.saveLocalCategorias(merged, hId);
        return merged;
      }
    } catch (err) {
      console.warn('Supabase offline ou tabela categorias_quartos inexistente:', err);
    }
    return localData;
  },

  async createCategoria(cat: Pick<CategoriaQuartoData, 'name' | 'description' | 'icon' | 'ordenacao' | 'status'>, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const local = this.getLocalCategorias(hId);
    const ICON_COLORS = ['bg-blue-100/70 text-blue-800','bg-amber-100/70 text-amber-800','bg-purple-100/70 text-purple-800','bg-rose-100/70 text-rose-800','bg-emerald-100/70 text-emerald-800'];
    const newCat: CategoriaQuartoData = {
      id: `cq-${Date.now()}`,
      hotel_id: hId,
      name: cat.name,
      description: cat.description || '',
      icon: cat.icon || 'king_bed',
      iconBgColor: ICON_COLORS[local.length % ICON_COLORS.length],
      ordenacao: cat.ordenacao || local.length + 1,
      linkedRoomsCount: 0,
      status: cat.status === 'inativo' ? 'inativo' : 'ativo',
    };
    this.saveLocalCategorias([...local, newCat].sort((a, b) => a.ordenacao - b.ordenacao), hId);

    try {
      await supabase.from('categorias_quartos').insert([{
        hotel_id: hId.startsWith('hotel-master') ? null : hId,
        nome: newCat.name,
        observacao: newCat.description,
        icone: newCat.icon,
        ordenacao: newCat.ordenacao,
        status: newCat.status,
      }]);
    } catch (err) {
      console.warn('Supabase offline para categorias_quartos:', err);
    }
    return true;
  },

  async updateCategoria(id: string, changes: Partial<Pick<CategoriaQuartoData, 'name' | 'description' | 'icon' | 'ordenacao' | 'status'>>, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const local = this.getLocalCategorias(hId);
    const updated = local.map(c => c.id === id ? { ...c, ...changes } : c);
    this.saveLocalCategorias(updated, hId);

    try {
      const payload: any = {};
      if (changes.name !== undefined)        payload.nome       = changes.name;
      if (changes.description !== undefined) payload.observacao = changes.description;
      if (changes.icon !== undefined)        payload.icone      = changes.icon;
      if (changes.ordenacao !== undefined)   payload.ordenacao  = changes.ordenacao;
      if (changes.status !== undefined)      payload.status     = changes.status;

      await supabase.from('categorias_quartos').update(payload).eq('id', id);
    } catch (err) {
      console.warn('Supabase: erro ao atualizar categoria de quarto:', err);
    }
    return true;
  },

  async deleteCategoria(id: string, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const local = this.getLocalCategorias(hId);
    this.saveLocalCategorias(local.filter(c => c.id !== id), hId);
    try {
      await supabase.from('categorias_quartos').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase: erro ao excluir categoria de quarto:', err);
    }
    return true;
  },

  subscribeCategoriasQuartos(callback: () => void): () => void {
    try {
      const channel = supabase
        .channel(`realtime_categorias_quartos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'categorias_quartos' },
          () => {
            callback();
          }
        )
        .subscribe();

      return () => {
        try { supabase.removeChannel(channel); } catch (e) {}
      };
    } catch (err) {
      return () => {};
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Service para Planos de Assinatura no Supabase (Tabela: public.planos)
// ─────────────────────────────────────────────────────────────────────────────
export interface PlanoDB {
  id: string;
  ordem: number;
  nome: string;
  tag?: string | null;
  descricao?: string | null;
  destaque: boolean;
  status: string;
  periodicidade: string;
  valor_base: number;
  desconto_ciclo?: string | null;
  dias_trial: number;
  limite_quartos: number;
  permite_quartos_extras: boolean;
  valor_quarto_extra: number;
  conexoes_whatsapp: number;
  permite_conexoes_extras: boolean;
  valor_conexao_extra: number;
  observacoes?: string | null;
  hoteis_assinantes: number;
  recursos?: any;
  recursos_desabilitados?: any;
  criado_em?: string;
  atualizado_em?: string;
}

export function mapPlanoDBToFrontend(row: any): any {
  const ordemNum = Number(row.ordem) || 1;
  const destaque = Boolean(row.destaque);
  const valorBase = Number(row.valor_base) || 0;
  const periodicidade = (row.periodicidade || 'Mensal');

  let pricePeriodText = '/mês';
  if (periodicidade.toLowerCase() === 'anual') pricePeriodText = '/ano';
  else if (periodicidade.toLowerCase() === 'trimestral') pricePeriodText = '/trimestre';
  else if (periodicidade.toLowerCase() === 'semestral') pricePeriodText = '/semestre';

  let priceSubtitle = 'Cobrança recorrente';
  if (valorBase === 0 || (row.nome || '').toLowerCase().includes('free')) {
    priceSubtitle = Number(row.dias_trial) === 0
      ? 'Acesso gratuito limitado contínuo até upgrade'
      : `Período de teste grátis de ${row.dias_trial} dias`;
  } else if (periodicidade.toLowerCase() === 'anual') {
    priceSubtitle = `Equiv. R$ ${(valorBase / 12).toFixed(2).replace('.', ',')}/mês • Em até 12x`;
  } else if (destaque) {
    priceSubtitle = 'Mais recomendado para alta taxa de ocupação';
  } else {
    priceSubtitle = 'Cobrança mensal recorrente via PIX ou Cartão';
  }

  const emoji = destaque ? '🥈' : (row.nome || '').toLowerCase().includes('free') ? '🎁' : ordemNum === 1 ? '🥇' : ordemNum === 2 ? '⚡' : ordemNum === 3 ? '🎖️' : ordemNum === 4 ? '💎' : '📦';

  return {
    id: row.id,
    order: `#0${ordemNum}`,
    emoji,
    name: row.nome || '',
    tag: row.tag || undefined,
    description: row.descricao || '',
    periodicity: periodicidade,
    basePrice: valorBase,
    pricePeriodText,
    priceSubtitle,
    trialDays: Number(row.dias_trial) || 0,
    cycleDiscount: row.desconto_ciclo || '',
    roomLimit: row.limite_quartos !== null && row.limite_quartos !== undefined ? Number(row.limite_quartos) : 15,
    roomLimitText: Number(row.limite_quartos) === 0 ? 'Sem cadastro de quartos incluso' : `Capacidade para até ${row.limite_quartos || 15} quartos`,
    roomExtraPriceText: row.permite_quartos_extras !== false ? `R$ ${Number(row.valor_quarto_extra || 3.5).toFixed(2).replace('.', ',')}/adicional` : 'Sem quartos adicionais',
    whatsappConnections: row.conexoes_whatsapp !== null && row.conexoes_whatsapp !== undefined ? Number(row.conexoes_whatsapp) : 1,
    whatsappConnectionsText: Number(row.conexoes_whatsapp) === 0 ? 'Sem conexão WhatsApp inclusa' : `${row.conexoes_whatsapp || 1} Conexão${Number(row.conexoes_whatsapp || 1) > 1 ? 'ões' : ''} WhatsApp simultâneas`,
    whatsappExtraPriceText: row.permite_conexoes_extras !== false ? `R$ ${Number(row.valor_conexao_extra || 49.9).toFixed(2).replace('.', ',')}/adicional` : 'Inclusas no pacote',
    hotelsSubscribersCount: Number(row.hoteis_assinantes) || 0,
    status: row.status === 'Inativo' ? 'Inativo' : 'Ativo',
    isFeatured: destaque,
    features: Array.isArray(row.recursos) ? row.recursos : [],
    disabledFeatures: Array.isArray(row.recursos_desabilitados) ? row.recursos_desabilitados : []
  };
}

export const planosService = {
  async getPlanos(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .order('ordem', { ascending: true });

      if (error) {
        console.warn('Erro ao buscar planos no Supabase:', error);
        return [];
      }
      if (data && data.length > 0) {
        return data.map(mapPlanoDBToFrontend);
      }
    } catch (err) {
      console.warn('Falha de conexão ao buscar planos no Supabase:', err);
    }
    return [];
  },

  async createPlano(plano: any): Promise<any | null> {
    try {
      const payload = {
        ordem: Number(plano.order?.replace(/\D/g, '')) || 1,
        nome: plano.name,
        tag: plano.tag || null,
        descricao: plano.description || null,
        destaque: Boolean(plano.isFeatured),
        status: plano.status || 'Ativo',
        periodicidade: plano.periodicity || 'Mensal',
        valor_base: plano.basePrice !== undefined ? Number(plano.basePrice) : 0,
        desconto_ciclo: plano.cycleDiscount || null,
        dias_trial: Number(plano.trialDays !== undefined ? plano.trialDays : (plano.dias_trial || 0)),
        limite_quartos: plano.roomLimit !== undefined && plano.roomLimit !== null ? Number(plano.roomLimit) : 15,
        permite_quartos_extras: plano.allowExtraRooms !== false,
        valor_quarto_extra: Number(plano.extraRoomPrice?.toString().replace(',', '.')) || 3.50,
        conexoes_whatsapp: plano.whatsappConnections !== undefined && plano.whatsappConnections !== null ? Number(plano.whatsappConnections) : 1,
        permite_conexoes_extras: plano.allowExtraWa !== false,
        valor_conexao_extra: Number(plano.extraWaPrice?.toString().replace(',', '.')) || 49.90,
        hoteis_assinantes: plano.hotelsSubscribersCount || 0,
        recursos: plano.features || [],
        recursos_desabilitados: plano.disabledFeatures || [],
        observacoes: plano.internalNotes || null
      };

      const { data, error } = await supabase
        .from('planos')
        .insert([payload])
        .select();

      if (error) {
        console.error('Erro ao inserir plano no Supabase:', error);
        return null;
      }
      if (data && data[0]) {
        return mapPlanoDBToFrontend(data[0]);
      }
    } catch (err) {
      console.error('Falha de conexão ao criar plano no Supabase:', err);
    }
    return null;
  },

  async updatePlano(id: string, changes: any): Promise<boolean> {
    try {
      const payload: any = {
        atualizado_em: new Date().toISOString()
      };
      if (changes.name !== undefined) payload.nome = changes.name;
      if (changes.tag !== undefined) payload.tag = changes.tag || null;
      if (changes.description !== undefined) payload.descricao = changes.description || null;
      if (changes.isFeatured !== undefined) payload.destaque = Boolean(changes.isFeatured);
      if (changes.status !== undefined) payload.status = changes.status;
      if (changes.periodicity !== undefined) payload.periodicidade = changes.periodicity;
      if (changes.basePrice !== undefined) payload.valor_base = Number(changes.basePrice);
      if (changes.cycleDiscount !== undefined) payload.desconto_ciclo = changes.cycleDiscount || null;
      if (changes.trialDays !== undefined || changes.dias_trial !== undefined) {
        payload.dias_trial = Number(changes.trialDays !== undefined ? changes.trialDays : changes.dias_trial) || 0;
      }
      if (changes.roomLimit !== undefined) payload.limite_quartos = Number(changes.roomLimit);
      if (changes.allowExtraRooms !== undefined) payload.permite_quartos_extras = Boolean(changes.allowExtraRooms);
      if (changes.extraRoomPrice !== undefined) payload.valor_quarto_extra = Number(changes.extraRoomPrice?.toString().replace(',', '.')) || 3.50;
      if (changes.whatsappConnections !== undefined) payload.conexoes_whatsapp = Number(changes.whatsappConnections);
      if (changes.allowExtraWa !== undefined) payload.permite_conexoes_extras = Boolean(changes.allowExtraWa);
      if (changes.extraWaPrice !== undefined) payload.valor_conexao_extra = Number(changes.extraWaPrice?.toString().replace(',', '.')) || 49.90;
      if (changes.order !== undefined) payload.ordem = Number(changes.order?.toString().replace(/\D/g, '')) || 1;
      if (changes.features !== undefined) payload.recursos = changes.features;
      if (changes.disabledFeatures !== undefined) payload.recursos_desabilitados = changes.disabledFeatures;
      if (changes.internalNotes !== undefined) payload.observacoes = changes.internalNotes;

      const { error } = await supabase
        .from('planos')
        .update(payload)
        .eq('id', id);

      if (error) {
        console.error('Erro ao atualizar plano no Supabase:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Falha de conexão ao atualizar plano no Supabase:', err);
      return false;
    }
  },

  async deletePlano(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('planos')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao excluir plano no Supabase:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Falha de conexão ao excluir plano no Supabase:', err);
      return false;
    }
  },

  subscribePlanos(callback: () => void): () => void {
    try {
      const channel = supabase
        .channel('planos-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'planos' },
          () => {
            callback();
          }
        )
        .subscribe();

      return () => {
        try { supabase.removeChannel(channel); } catch (e) {}
      };
    } catch (err) {
      return () => {};
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Service: Destaques da Acomodação + Relacionamento Quarto <-> Destaques (M:N)
// ─────────────────────────────────────────────────────────────────────────────
export interface DestaqueQuarto {
  id: string;
  hotel_id?: string;
  icon: string;            // ex: "king_bed", "wifi", "waves", "ac_unit", "bathtub", "group", "signal_cellular_alt"
  iconColor?: string;      // cor customizada (opcional)
  iconClass?: string;      // classe CSS de ícone externo (ex: "fi fi-rr-user" da UIcons). Quando preenchido tem prioridade sobre icon.
  title: string;           // ex: "Cama King Size"
  subtitle: string;        // ex: "Lençóis 300 fios"
  order: number;
  status: 'ativo' | 'inativo';
  createdAt?: string;
}

/**
 * Extrai e limpa a classe CSS de um ícone caso o usuário tenha colado a tag HTML completa
 * como `<i class="fa-regular fa-chess-rook"></i>` ou `<span class="ri-hotel-bed-line"></span>`,
 * ou aspas soltas.
 */
export function cleanIconClass(raw?: string | null): string {
  if (!raw) return '';
  let str = raw.trim();
  // Se contiver atributo class="..." ou className="..."
  const classMatch = str.match(/class(?:Name)?=["']([^"']+)["']/i);
  if (classMatch && classMatch[1]) {
    str = classMatch[1];
  } else {
    // Remove eventuais tags HTML como <i ...>, </i>, <span>, </span>
    str = str.replace(/<[^>]+>/g, '');
    // Remove aspas
    str = str.replace(/["']/g, '');
  }
  return str.trim();
}

export interface QuartoDestaqueLink {
  quartoId: string;
  destaqueId: string;
}

const LOCAL_KEY_DESTAQUES_QUARTO = 'hotelnozap_destaques_quarto_v1';
const LOCAL_KEY_QUARTOS_DESTAQUES = 'hotelnozap_quartos_destaques_v1';

const getDestaquesKey = (hotelId?: string) => {
  const hId = hotelId || currentHotelService.getCurrentHotel().id;
  return `hotelnozap_destaques_quarto_${hId}`;
};
const getQuartosDestaquesKey = () => LOCAL_KEY_QUARTOS_DESTAQUES;

// Seed com os 7 destaques-padrão do layout DetalhesQuarto
const INITIAL_SEED_DESTAQUES: DestaqueQuarto[] = [
  { id: '1', icon: 'bed',                 title: 'Cama King Size',       subtitle: 'Com Molas Cônicas',        order: 1, status: 'ativo' },
  { id: '2', icon: 'group',               title: 'Até 2 Hóspedes',       subtitle: 'Espaço Família',          order: 2, status: 'ativo' },
  { id: '3', icon: 'bathtub',             title: 'Hidro Dupla',          subtitle: 'Privativa & Aquecida',    order: 3, status: 'ativo' },
  { id: '4', icon: 'waves',               title: 'Vista Panorâmica',     subtitle: 'Varanda com Rede',        order: 4, status: 'ativo' },
  { id: '5', icon: 'ac_unit',             title: 'Split Inverter',       subtitle: 'Silencioso & Potente',    order: 5, status: 'ativo' },
  { id: '6', icon: 'signal_cellular_alt', title: 'Wi-Fi Fibra 500M',     subtitle: 'Sinal dedicado',          order: 6, status: 'ativo' },
  { id: '7', icon: 'free_breakfast',      title: 'Café da Manhã',        subtitle: 'Buffet Incluso',          order: 7, status: 'ativo' },
];

function _readLocalDestaques(hotelId?: string): DestaqueQuarto[] {
  const hId = hotelId || currentHotelService.getCurrentHotel().id;
  try {
    const saved = localStorage.getItem(getDestaquesKey(hId));
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  const seed = INITIAL_SEED_DESTAQUES.map((d, idx) => ({
    ...d,
    id: String(d.id),
    hotel_id: hId,
    order: idx + 1,
  }));
  localStorage.setItem(getDestaquesKey(hId), JSON.stringify(seed));
  return seed;
}

function _saveLocalDestaques(list: DestaqueQuarto[], hotelId?: string): void {
  const hId = hotelId || currentHotelService.getCurrentHotel().id;
  try {
    localStorage.setItem(getDestaquesKey(hId), JSON.stringify(list));
    window.dispatchEvent(new Event('hotel_novo_destaque_quarto'));
  } catch {}
}

function _readLinks(): Record<string, string[]> {
  try {
    const saved = localStorage.getItem(getQuartosDestaquesKey());
    if (saved) return JSON.parse(saved) as Record<string, string[]>;
  } catch {}
  return {};
}

function _saveLinks(map: Record<string, string[]>): void {
  try {
    localStorage.setItem(getQuartosDestaquesKey(), JSON.stringify(map));
    window.dispatchEvent(new Event('hotel_quarto_destaques_atualizado'));
  } catch {}
}

export const destaquesQuartoService = {
  /** Retorna todos os destaques cadastrados no hotel lendo direto do Supabase. */
  async getDestaques(hotelId?: string): Promise<DestaqueQuarto[]> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    try {
      let query = supabase.from('destaques_quarto').select('*').order('ordenacao', { ascending: true });
      if (hId && !hId.startsWith('hotel-master')) {
        query = query.or(`hotel_id.eq.${hId},hotel_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const mapped: DestaqueQuarto[] = data.map((row: any, idx: number) => ({
          id: String(row.id),
          hotel_id: row.hotel_id || hId,
          icon: row.icone || 'bed',
          iconColor: row.icone_cor || undefined,
          iconClass: cleanIconClass(row.icone_classe),
          title: row.titulo,
          subtitle: row.subtitulo || '',
          order: row.ordenacao || idx + 1,
          status: ((row.status || 'ativo') === 'inativo' ? 'inativo' : 'ativo') as 'ativo' | 'inativo',
          createdAt: row.criado_em,
        }));
        _saveLocalDestaques(mapped, hId);
        return mapped;
      }

      // Se a tabela estiver vazia para este hotel, insere os 7 iniciais direto no Supabase
      if (!error && (!data || data.length === 0) && hId && !hId.startsWith('hotel-master')) {
        const seedPayloads = INITIAL_SEED_DESTAQUES.map(d => ({
          hotel_id: hId,
          icone: d.icon,
          titulo: d.title,
          subtitulo: d.subtitle || null,
          ordenacao: d.order,
          status: d.status
        }));
        const { data: seeded, error: seedErr } = await supabase.from('destaques_quarto').insert(seedPayloads).select();
        if (!seedErr && seeded && seeded.length > 0) {
          const mapped: DestaqueQuarto[] = seeded.map((row: any, idx: number) => ({
            id: String(row.id),
            hotel_id: row.hotel_id || hId,
            icon: row.icone || 'bed',
            iconColor: row.icone_cor || undefined,
            iconClass: row.icone_classe || '',
            title: row.titulo,
            subtitle: row.subtitulo || '',
            order: row.ordenacao || idx + 1,
            status: ((row.status || 'ativo') === 'inativo' ? 'inativo' : 'ativo') as 'ativo' | 'inativo',
            createdAt: row.criado_em,
          }));
          _saveLocalDestaques(mapped, hId);
          return mapped;
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar destaques do Supabase:', err);
    }
    return _readLocalDestaques(hId);
  },

  async createDestaque(
    item: Pick<DestaqueQuarto, 'icon' | 'title' | 'subtitle' | 'order' | 'status' | 'iconColor' | 'iconClass'>,
    hotelId?: string
  ): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const payload: any = {
      hotel_id: (hId && !hId.startsWith('hotel-master')) ? hId : null,
      icone: item.icon || 'bed',
      icone_cor: item.iconColor || null,
      icone_classe: cleanIconClass(item.iconClass),
      titulo: item.title,
      subtitulo: item.subtitle || null,
      ordenacao: item.order || 1,
      status: item.status || 'ativo',
    };

    try {
      const { data, error } = await supabase.from('destaques_quarto').insert([payload]).select().single();
      if (!error && data) {
        const novo: DestaqueQuarto = {
          id: String(data.id),
          hotel_id: data.hotel_id || hId,
          icon: data.icone || 'bed',
          iconColor: data.icone_cor || undefined,
          iconClass: cleanIconClass(data.icone_classe),
          title: data.titulo,
          subtitle: data.subtitulo || '',
          order: data.ordenacao || 1,
          status: data.status || 'ativo',
          createdAt: data.criado_em,
        };
        const local = _readLocalDestaques(hId).filter(d => d.id !== novo.id);
        _saveLocalDestaques([...local, novo].sort((a, b) => a.order - b.order), hId);
        return true;
      }
      if (error) console.error('Erro ao inserir destaque no Supabase:', error);
    } catch (err) {
      console.warn('Erro ao sincronizar destaque novo no Supabase:', err);
    }

    const local = _readLocalDestaques(hId);
    const fallbackNovo: DestaqueQuarto = {
      id: `dq-${Date.now()}`,
      hotel_id: hId,
      icon: item.icon || 'bed',
      iconColor: item.iconColor,
      iconClass: cleanIconClass(item.iconClass),
      title: item.title,
      subtitle: item.subtitle || '',
      order: item.order || local.length + 1,
      status: item.status || 'ativo',
    };
    _saveLocalDestaques([...local, fallbackNovo].sort((a, b) => a.order - b.order), hId);
    return true;
  },

  async updateDestaque(
    id: string,
    changes: Partial<Pick<DestaqueQuarto, 'icon' | 'title' | 'subtitle' | 'order' | 'status' | 'iconColor' | 'iconClass'>>,
    hotelId?: string
  ): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const payload: any = {};
    if (changes.icon !== undefined) payload.icone = changes.icon;
    if (changes.iconColor !== undefined) payload.icone_cor = changes.iconColor || null;
    if (changes.iconClass !== undefined) payload.icone_classe = cleanIconClass(changes.iconClass);
    if (changes.title !== undefined) payload.titulo = changes.title;
    if (changes.subtitle !== undefined) payload.subtitulo = changes.subtitle || null;
    if (changes.order !== undefined) payload.ordenacao = changes.order;
    if (changes.status !== undefined) payload.status = changes.status;

    const numId = Number(id);
    if (Number.isFinite(numId) && numId > 0) {
      try {
        const { error } = await supabase.from('destaques_quarto').update(payload).eq('id', numId);
        if (error) console.error('Erro ao atualizar destaque no Supabase:', error);
      } catch (err) {
        console.warn('Erro ao atualizar destaque no Supabase:', err);
      }
    }

    const local = _readLocalDestaques(hId);
    const updated = local.map(d => d.id === id ? { ...d, ...changes } : d);
    _saveLocalDestaques(updated, hId);
    return true;
  },

  async deleteDestaque(id: string, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const numId = Number(id);
    if (Number.isFinite(numId) && numId > 0) {
      try {
        await supabase.from('quartos_destaques').delete().eq('destaque_id', numId);
        const { error } = await supabase.from('destaques_quarto').delete().eq('id', numId);
        if (error) console.error('Erro ao excluir destaque no Supabase:', error);
      } catch (err) {
        console.warn('Erro ao excluir destaque no Supabase:', err);
      }
    }

    const local = _readLocalDestaques(hId);
    _saveLocalDestaques(local.filter(d => d.id !== id), hId);
    return true;
  },

  async toggleStatusDestaque(id: string, hotelId?: string): Promise<boolean> {
    const hId = hotelId || currentHotelService.getCurrentHotel().id;
    const list = await this.getDestaques(hId);
    const item = list.find(d => d.id === id);
    if (!item) return false;
    const newStatus = item.status === 'ativo' ? 'inativo' : 'ativo';
    return this.updateDestaque(id, { status: newStatus }, hId);
  },

  /**
   * Retorna a lista ordenada de destaques associados a um quarto (pelos IDs salvos no vínculo).
   * Fallback: se não houver vínculo, retorna a lista-padrão (seed) para manter a UX.
   */
  async getDestaquesDoQuarto(
    quartoId: string,
    todosDestaques?: DestaqueQuarto[],
    hotelId?: string
  ): Promise<DestaqueQuarto[]> {
    const todos = todosDestaques || (await this.getDestaques(hotelId));
    const links = _readLinks();
    let ids = links[quartoId];

    if (!ids || ids.length === 0) {
      try {
        const { data, error } = await supabase
          .from('quartos_destaques')
          .select('destaque_id')
          .eq('quarto_id', quartoId);

        if (!error && data && data.length > 0) {
          ids = data.map((r: any) => String(r.destaque_id));
          links[quartoId] = ids;
          _saveLinks(links);
        }
      } catch (err) {
        console.warn('Erro ao consultar quartos_destaques no Supabase:', err);
      }
    }

    if (ids && ids.length > 0) {
      return todos
        .filter(d => ids.includes(String(d.id)) && d.status === 'ativo')
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    // Fallback: se o quarto ainda não tiver destaques específicos vinculados, exibe todos os ativos cadastrados
    return todos
      .filter(d => d.status === 'ativo')
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  /** Atualiza a lista de destaque associados a um quarto. */
  async setDestaquesDoQuarto(quartoId: string, destaqueIds: string[]): Promise<void> {
    const links = _readLinks();
    links[quartoId] = destaqueIds || [];
    _saveLinks(links);
    try {
      // 1. Limpa os relacionamentos antigos no Supabase (quarto_id é UUID — manter como string)
      await supabase.from('quartos_destaques').delete().eq('quarto_id', quartoId);
      // 2. Insere os novos (IDs dos destaques são BIGSERIAL numeric; quartoId é UUID string)
      const validDestaqueIds = destaqueIds
        .map(id => Number(id))
        .filter(n => Number.isFinite(n) && n > 0);
      if (validDestaqueIds.length > 0) {
        const inserts = validDestaqueIds.map(did => ({ quarto_id: quartoId, destaque_id: did }));
        await supabase.from('quartos_destaques').insert(inserts);
      }
    } catch (err) {
      console.warn('Erro ao sincronizar vínculo quarto-destaques no Supabase:', err);
    }
  },

  subscribeDestaques(callback: () => void): () => void {
    try {
      const channel = supabase
        .channel(`realtime_destaques_quarto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'destaques_quarto' }, callback)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quartos_destaques' }, callback)
        .subscribe();
      return () => { try { supabase.removeChannel(channel); } catch {} };
    } catch { return () => {}; }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// COMODIDADES NÍVEL HOTEL (Categorias + Itens)
// Cadastro embedado FormHotel.tsx → render grid 2x2 DetalhesQuarto.tsx
// ─────────────────────────────────────────────────────────────────────────────
export interface ComodidadeItemHotel {
  id?: string;
  categoriaId?: string;
  texto: string;
  order: number;
}

export interface ComodidadeCategoria {
  id?: string;
  hotelId?: string;
  nome: string;
  icon: string;
  iconClass?: string;
  iconColor: string;
  order: number;
  status: string;
  itens: ComodidadeItemHotel[];
  createdAt?: string | Date;
}

const _LOCAL_KEY_COMODIDADES = (hotelId: string) => `hotelnozap_comodidades_${hotelId}`;

const _readLocalComodidades = (hotelId: string): ComodidadeCategoria[] => {
  try {
    const raw = localStorage.getItem(_LOCAL_KEY_COMODIDADES(hotelId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

const _saveLocalComodidades = (hotelId: string, data: ComodidadeCategoria[]) => {
  try { localStorage.setItem(_LOCAL_KEY_COMODIDADES(hotelId), JSON.stringify(data)); } catch {}
};

export const comodidadesService = {
  /**
   * Seed padrão: 4 categorias clássicas do layout de referência do Everaldo.
   * Chamado apenas quando abrir FormHotel no modo create (novo hotel).
   */
  getSeedPadrao(): ComodidadeCategoria[] {
    return [
      {
        nome: 'Banho & Bem-Estar Privativo',
        icon: 'spa',
        iconClass: '',
        iconColor: '#006c49',
        order: 1,
        status: 'ativo',
        itens: [
          { texto: 'Banheira de hidromassagem dupla com iluminação LED', order: 1 },
          { texto: 'Amenities de luxo e higiene pessoal', order: 2 },
          { texto: 'Roupões macios e ducha dupla a gás', order: 3 },
          { texto: 'Secador de cabelo de alta potência', order: 4 },
        ],
      },
      {
        nome: 'Tecnologia & Entretenimento',
        icon: 'tv',
        iconClass: '',
        iconColor: '#006c49',
        order: 2,
        status: 'ativo',
        itens: [
          { texto: 'Smart TV 55" 4K com apps liberados', order: 1 },
          { texto: 'Som Bluetooth integrado', order: 2 },
          { texto: 'Wi-Fi Fibra 500M de alta velocidade', order: 3 },
          { texto: 'Tomadas USB ao lado da cama', order: 4 },
        ],
      },
      {
        nome: 'Gastronomia & Bar Privativo',
        icon: 'coffee',
        iconClass: '',
        iconColor: '#006c49',
        order: 3,
        status: 'ativo',
        itens: [
          { texto: 'Cafeteira Nespresso com cápsulas de cortesia', order: 1 },
          { texto: 'Frigobar abastecido com água cortesia', order: 2 },
          { texto: 'Jogo de taças para vinho e espumante', order: 3 },
          { texto: 'Café da manhã servido na varanda', order: 4 },
        ],
      },
      {
        nome: 'Serviços Exclusivos no WhatsApp',
        icon: 'chat',
        iconClass: '',
        iconColor: '#006c49',
        order: 4,
        status: 'ativo',
        itens: [
          { texto: 'Room service com pedidos diretos pelo Zap', order: 1 },
          { texto: 'Arrumação diária personalizada', order: 2 },
          { texto: 'Concierge para agendamento de passeios', order: 3 },
          { texto: 'Toalhas extras para praia e piscina', order: 4 },
        ],
      },
    ];
  },

  /**
   * Carrega categorias + itens ordenados por `ordenacao` ASC de 1 hotel específico.
   * Fallback local se Supabase offline.
   */
  async getCategoriasByHotelId(hotelId: string): Promise<ComodidadeCategoria[]> {
    const local = _readLocalComodidades(hotelId);

    if (!hotelId || hotelId === DEFAULT_HOTEL.id) {
      return local.length > 0 ? local : this.getSeedPadrao();
    }

    try {
      // 1. Buscar categorias
      const { data: catData, error: catErr } = await supabase
        .from('hotel_comodidade_categorias')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('ordenacao', { ascending: true })
        .order('criado_em', { ascending: true });

      if (catErr || !catData) {
        return local.length > 0 ? local : this.getSeedPadrao();
      }

      if (catData.length === 0) {
        return local.length > 0 ? local : [];
      }

      // 2. Buscar itens
      const categoriaIds = catData.map(c => c.id);
      const { data: itensData, error: itensErr } = await supabase
        .from('hotel_comodidade_itens')
        .select('*')
        .in('categoria_id', categoriaIds)
        .order('ordenacao', { ascending: true })
        .order('criado_em', { ascending: true });

      const itensPorCategoria: Record<string, any[]> = {};
      if (!itensErr && itensData) {
        itensData.forEach(i => {
          if (!itensPorCategoria[i.categoria_id]) itensPorCategoria[i.categoria_id] = [];
          itensPorCategoria[i.categoria_id].push(i);
        });
      }

      // 3. Mapper snake → camel
      const mapped: ComodidadeCategoria[] = catData.map((row: any) => ({
        id: String(row.id),
        hotelId: row.hotel_id || hotelId,
        nome: row.nome || '',
        icon: row.icone || 'category',
        iconClass: row.icone_classe || '',
        iconColor: row.cor_icone || '#006c49',
        order: Number(row.ordenacao) || 1,
        status: (row.status || 'ativo') === 'inativo' ? 'inativo' : 'ativo',
        createdAt: row.criado_em,
        itens: (itensPorCategoria[row.id] || []).map((itemRow: any, i: number) => ({
          id: String(itemRow.id),
          categoriaId: itemRow.categoria_id,
          texto: itemRow.texto || '',
          order: Number(itemRow.ordenacao) || i + 1,
        })),
      }));

      mapped.sort((a, b) => a.order - b.order);
      _saveLocalComodidades(hotelId, mapped);
      return mapped;
    } catch (err) {
      console.warn('Supabase offline / tabela hotel_comodidade_categorias não existe:', err);
    }
    return local.length > 0 ? local : this.getSeedPadrao();
  },

  /**
   * Idempotente: deleta TODAS categorias antigas do hotel + insere as novas (c/ seus itens).
   * Usado no submit do FormHotel.
   */
  async upsertCategoriasDoHotel(
    hotelId: string,
    categorias: ComodidadeCategoria[]
  ): Promise<boolean> {
    if (!hotelId || hotelId === DEFAULT_HOTEL.id) {
      _saveLocalComodidades(hotelId, categorias);
      return true;
    }

    const validas = (categorias || [])
      .filter(c => c && c.nome && c.nome.trim().length > 0)
      .map(c => ({
        ...c,
        itens: (c.itens || []).filter(i => i && i.texto && i.texto.trim().length > 0),
      }))
      .filter(c => c.itens.length > 0);

    _saveLocalComodidades(hotelId, validas);

    try {
      // 1. Apagar as antigas (cascade delete já apaga os itens filhos)
      const idsParaApagar: string[] = (validas.map(c => c.id).filter(Boolean) as string[]);
      if (idsParaApagar.length === 0) {
        await supabase
          .from('hotel_comodidade_categorias')
          .delete()
          .eq('hotel_id', hotelId);
      } else {
        await supabase
          .from('hotel_comodidade_categorias')
          .delete()
          .eq('hotel_id', hotelId)
          .not('id', 'in', idsParaApagar);
      }

      // 2. Inserir novas / atualizar existentes (uma a uma)
      for (let i = 0; i < validas.length; i++) {
        const cat = validas[i];
        const catPayload: any = {
          hotel_id: hotelId,
          nome: cat.nome.trim(),
          icone: cat.icon || '',
          icone_classe: (cat.iconClass || '').trim(),
          cor_icone: cat.iconColor || '#006c49',
          ordenacao: Number(cat.order) || i + 1,
          status: cat.status || 'ativo',
        };

        let categoriaDbId = cat.id;
        let isUpdate = Boolean(cat.id && !String(cat.id).startsWith('local-') && !String(cat.id).startsWith('new-'));

        if (isUpdate) {
          try {
            const { error: updErr } = await supabase
              .from('hotel_comodidade_categorias')
              .update(catPayload)
              .eq('id', cat.id!);
            if (updErr) isUpdate = false;
          } catch { isUpdate = false; }
        }

        if (!isUpdate) {
          const { data: insData, error: insErr } = await supabase
            .from('hotel_comodidade_categorias')
            .insert([catPayload])
            .select()
            .single();
          if (!insErr && insData) categoriaDbId = String(insData.id);
          else categoriaDbId = undefined;
        }

        // 3. Itens da categoria
        if (categoriaDbId) {
          // Apaga itens antigos da categoria
          await supabase
            .from('hotel_comodidade_itens')
            .delete()
            .eq('categoria_id', categoriaDbId);

          if (cat.itens.length > 0) {
            const itensPayload = cat.itens.map((item, idx) => ({
              categoria_id: categoriaDbId,
              texto: item.texto.trim(),
              ordenacao: Number(item.order) || idx + 1,
            }));
            await supabase
              .from('hotel_comodidade_itens')
              .insert(itensPayload);
          }
        }
      }

      return true;
    } catch (err) {
      console.warn('Erro ao upsert comodidades do hotel:', err);
      return true;
    }
  },
};

// ============================================================================
//  SERVIÇO DE CATEGORIAS DE HOTÉIS & POUSADAS (categorias_hoteis)
// ============================================================================
export interface CategoriaHotelData {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  status: 'ativo' | 'inativo';
  order?: number;
  hotelsCount?: number;
  created_at?: string;
}

export const INITIAL_CATEGORIAS_HOTEL: CategoriaHotelData[] = [
  {
    id: 'cat-hotel-1',
    name: 'Resort All-Inclusive / Lazer',
    description: 'Complexos turísticos com ampla estrutura de lazer, gastronomia inclusa e entretenimento.',
    icon: 'beach_access',
    status: 'ativo',
    order: 1
  },
  {
    id: 'cat-hotel-2',
    name: 'Hotel Urbano / Executivo',
    description: 'Hotéis localizados em centros comerciais, ideais para viagens corporativas e negócios.',
    icon: 'apartment',
    status: 'ativo',
    order: 2
  },
  {
    id: 'cat-hotel-3',
    name: 'Pousada Boutique / Charme',
    description: 'Hospedagens aconchegantes com atendimento exclusivo, decoração refinada e ambiente intimista.',
    icon: 'villa',
    status: 'ativo',
    order: 3
  },
  {
    id: 'cat-hotel-4',
    name: 'Chalés & Eco Village',
    description: 'Acomodações integradas à natureza, estilo rústico ou sustentável em áreas de serra e praia.',
    icon: 'cabin',
    status: 'ativo',
    order: 4
  },
  {
    id: 'cat-hotel-5',
    name: 'Flat / Apart-hotel',
    description: 'Unidades residenciais com serviços de hotelaria e cozinha própria para estadias flexíveis.',
    icon: 'holiday_village',
    status: 'ativo',
    order: 5
  },
  {
    id: 'cat-hotel-6',
    name: 'Hotel Fazenda & Ecoturismo',
    description: 'Estruturas rurais com passeios a cavalo, contato com animais e turismo de aventura.',
    icon: 'forest',
    status: 'ativo',
    order: 6
  },
  {
    id: 'cat-hotel-7',
    name: 'Hostel / Albergue Turístico',
    description: 'Hospedagens comunitárias e compartilhadas, com ambiente jovem e econômico.',
    icon: 'bed',
    status: 'ativo',
    order: 7
  }
];

const LOCAL_STORAGE_CATEGORIAS_HOTEL = 'hotelnozap_categorias_hotel';

export const categoriasHoteisService = {
  getLocalCategorias(): CategoriaHotelData[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_CATEGORIAS_HOTEL);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return INITIAL_CATEGORIAS_HOTEL;
  },

  setLocalCategorias(list: CategoriaHotelData[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_CATEGORIAS_HOTEL, JSON.stringify(list));
    } catch { /* ignore */ }
  },

  async getCategorias(): Promise<CategoriaHotelData[]> {
    let categories: CategoriaHotelData[] = [];
    try {
      const { data, error } = await supabase
        .from('categorias_hoteis')
        .select('*')
        .order('ordem', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        categories = data.map((row: any) => ({
          id: String(row.id),
          name: row.nome || row.name || 'Categoria',
          description: row.descricao || row.description || '',
          icon: row.icone || row.icon || 'domain',
          status: (row.status === 'inativo' ? 'inativo' : 'ativo') as 'ativo' | 'inativo',
          order: Number(row.ordem ?? row.order ?? 1),
          created_at: row.created_at || row.criado_em
        }));
      }
    } catch {
      // Fallback local caso tabela ainda não exista no Supabase
    }

    if (categories.length === 0) {
      categories = this.getLocalCategorias();
    } else {
      this.setLocalCategorias(categories);
    }

    // Calcula quantidade de hotéis vinculados por categoria
    try {
      const dbHoteis = await hoteisService.getHoteis();
      if (Array.isArray(dbHoteis)) {
        categories = categories.map(cat => ({
          ...cat,
          hotelsCount: dbHoteis.filter(h => (h.category || '').trim().toLowerCase() === cat.name.trim().toLowerCase()).length
        }));
      }
    } catch { /* ignore */ }

    return categories;
  },

  async createCategoria(cat: Partial<CategoriaHotelData>): Promise<{ success: boolean; data?: CategoriaHotelData; error?: string }> {
    const newId = `cat-hotel-${Date.now()}`;
    const newCategory: CategoriaHotelData = {
      id: newId,
      name: (cat.name || 'Nova Categoria').trim(),
      description: (cat.description || '').trim(),
      icon: (cat.icon || 'domain').trim(),
      status: cat.status === 'inativo' ? 'inativo' : 'ativo',
      order: Number(cat.order || 1),
      created_at: new Date().toISOString()
    };

    // 1. Tenta salvar no Supabase
    try {
      const { data, error } = await supabase
        .from('categorias_hoteis')
        .insert([{
          nome: newCategory.name,
          descricao: newCategory.description,
          icone: newCategory.icon,
          status: newCategory.status,
          ordem: newCategory.order
        }])
        .select()
        .single();

      if (!error && data) {
        newCategory.id = String(data.id);
      }
    } catch { /* ignore */ }

    // 2. Atualiza local storage
    const currentList = this.getLocalCategorias();
    currentList.push(newCategory);
    this.setLocalCategorias(currentList);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_categoria_modificada'));
    }

    return { success: true, data: newCategory };
  },

  async updateCategoria(id: string, changes: Partial<CategoriaHotelData>): Promise<{ success: boolean; error?: string }> {
    // 1. Tenta atualizar no Supabase
    try {
      const payload: any = {};
      if (changes.name !== undefined) payload.nome = changes.name.trim();
      if (changes.description !== undefined) payload.descricao = changes.description.trim();
      if (changes.icon !== undefined) payload.icone = changes.icon.trim();
      if (changes.status !== undefined) payload.status = changes.status;
      if (changes.order !== undefined) payload.ordem = Number(changes.order);

      await supabase
        .from('categorias_hoteis')
        .update(payload)
        .eq('id', id);
    } catch { /* ignore */ }

    // 2. Atualiza local storage
    const currentList = this.getLocalCategorias();
    const updatedList = currentList.map(c => {
      if (c.id === id) {
        return {
          ...c,
          ...changes,
          name: changes.name !== undefined ? changes.name.trim() : c.name,
          description: changes.description !== undefined ? changes.description.trim() : c.description,
          icon: changes.icon !== undefined ? changes.icon.trim() : c.icon,
          status: changes.status !== undefined ? changes.status : c.status,
          order: changes.order !== undefined ? Number(changes.order) : c.order
        };
      }
      return c;
    });
    this.setLocalCategorias(updatedList);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_categoria_modificada'));
    }

    return { success: true };
  },

  async deleteCategoria(id: string): Promise<{ success: boolean; error?: string }> {
    // 1. Tenta deletar no Supabase
    try {
      await supabase
        .from('categorias_hoteis')
        .delete()
        .eq('id', id);
    } catch { /* ignore */ }

    // 2. Atualiza local storage
    const currentList = this.getLocalCategorias();
    const filtered = currentList.filter(c => c.id !== id);
    this.setLocalCategorias(filtered);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_categoria_modificada'));
    }

    return { success: true };
  }
};

export const isValidHotelUuid = (hotelId?: string | null): boolean => {
  if (!hotelId || hotelId === '11111111-1111-1111-1111-111111111111') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hotelId);
};

export const DEFAULT_HOTEL_CONFIG: HotelConfigData = {
  checkInHorario: '14:00',
  checkOutHorario: '12:00',
  toleranciaCheckOutMinutos: 30,
  cafeInicio: '06:30',
  cafeFim: '10:00',
  silencioInicio: '22:00',
  silencioFim: '08:00',
  recepcao24Horas: true,
  recepcaoInicio: '07:00',
  recepcaoFim: '23:00',
  lazerInicio: '08:00',
  lazerFim: '20:00',
  politicaCancelamento: 'flexivel',
  politicaCancelamentoTexto: 'Cancelamento gratuito até 7 dias antes do check-in. Após este prazo, cobrança da primeira diária.',
  permitePet: 'sob_consulta',
  taxaPet: 50.0,
  proibidoFumar: true,
  idadeMinimaCheckin: 18,
  permiteVisitantes: true,
  regrasGeraisTexto: 'Prezado hóspede, respeite os horários de silêncio e as áreas de convivência. É vedado o uso de caixas de som nas áreas comuns.',
  dpoNome: 'Encarregado de Privacidade',
  dpoEmail: 'privacidade@hotelnozap.com.br',
  dpoTelefone: '(11) 99999-9999',
  exigirConsentimentoCheckin: true,
  prazoRetencaoAnos: 5,
  enviarAvisoPrivacidadeWhatsapp: true,
  politicaPrivacidadeTexto: 'Seus dados pessoais coletados durante a estadia são utilizados exclusivamente para cumprimento de obrigações legais (FNRH/Embratur, emissão fiscal) e comunicação direta via WhatsApp sobre sua reserva, em total conformidade com a LGPD (Lei nº 13.709/2018).',
  mpEnvironment: 'production',
  mpPublicKey: 'APP_USR-78291048-2910-4819-b291-891028401928',
  mpAccessToken: 'APP_USR-9812401928409182-091219-4829104819284019-918240',
  mpClientId: '4829104819284019',
  mpClientSecret: 'SecretKey_MP_2026_Master_Hotel',
  mpEnablePix: true,
  mpEnableCreditCard: true,
  mpEnableBoleto: false,
  mpMaxInstallments: '12'
};

export const extractConfigFromObservacoes = (observacoes?: string | null): HotelConfigData | null => {
  if (!observacoes) return null;
  const match = observacoes.match(/<!-- HOTEL_CONFIG_JSON:(.*?):END_HOTEL_CONFIG -->/s);
  if (!match || !match[1]) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return { ...DEFAULT_HOTEL_CONFIG, ...parsed };
  } catch (e) {
    console.warn('Erro ao decodificar config JSON em observações do hotel:', e);
    return null;
  }
};

export const embedConfigInObservacoes = (currentObservacoes: string | null | undefined, config: HotelConfigData): string => {
  const clean = (currentObservacoes || '').replace(/\s*<!-- HOTEL_CONFIG_JSON:.*?:END_HOTEL_CONFIG -->\s*/gs, '').trim();
  const jsonTag = `<!-- HOTEL_CONFIG_JSON:${JSON.stringify(config)}:END_HOTEL_CONFIG -->`;
  return clean ? `${clean}\n${jsonTag}` : jsonTag;
};

export const hotelConfigService = {
  // Mapeia do Supabase (snake_case) para o TypeScript (camelCase)
  mapRowToConfig(row: any): HotelConfigData {
    return {
      checkInHorario: row.check_in_horario || '14:00',
      checkOutHorario: row.check_out_horario || '12:00',
      toleranciaCheckOutMinutos: Number(row.tolerancia_check_out_minutos) || 30,
      cafeInicio: row.cafe_inicio || '06:30',
      cafeFim: row.cafe_fim || '10:00',
      silencioInicio: row.silencio_inicio || '22:00',
      silencioFim: row.silencio_fim || '08:00',
      recepcao24Horas: row.recepcao_24_horas !== false,
      recepcaoInicio: row.recepcao_inicio || '07:00',
      recepcaoFim: row.recepcao_fim || '23:00',
      lazerInicio: row.lazer_inicio || '08:00',
      lazerFim: row.lazer_fim || '20:00',
      politicaCancelamento: row.politica_cancelamento || 'flexivel',
      politicaCancelamentoTexto: row.politica_cancelamento_texto || 'Cancelamento gratuito até 7 dias antes do check-in.',
      permitePet: row.permite_pet || 'sob_consulta',
      taxaPet: Number(row.taxa_pet) || 50.0,
      proibidoFumar: row.proibido_fumar !== false,
      idadeMinimaCheckin: Number(row.idade_minima_checkin) || 18,
      permiteVisitantes: row.permite_visitantes !== false,
      regrasGeraisTexto: row.regras_gerais_texto || 'Prezado hóspede, respeite os horários de silêncio e as áreas de convivência.',
      dpoNome: row.dpo_nome || 'Encarregado de Privacidade',
      dpoEmail: row.dpo_email || 'privacidade@hotelnozap.com.br',
      dpoTelefone: row.dpo_telefone || '(11) 99999-9999',
      exigirConsentimentoCheckin: row.exigir_consentimento_checkin !== false,
      prazoRetencaoAnos: Number(row.prazo_retencao_anos) || 5,
      enviarAvisoPrivacidadeWhatsapp: row.enviar_aviso_privacidade_whatsapp !== false,
      politicaPrivacidadeTexto: row.politica_privacidade_texto || '',
      mpEnvironment: row.mp_environment || 'production',
      mpPublicKey: row.mp_public_key || '',
      mpAccessToken: row.mp_access_token || '',
      mpClientId: row.mp_client_id || '',
      mpClientSecret: row.mp_client_secret || '',
      mpEnablePix: row.mp_enable_pix !== false,
      mpEnableCreditCard: row.mp_enable_credit_card !== false,
      mpEnableBoleto: row.mp_enable_boleto === true,
      mpMaxInstallments: row.mp_max_installments || '12',
    };
  },

  // Mapeia do TypeScript (camelCase) para o Supabase (snake_case)
  mapConfigToRow(config: HotelConfigData, hotelId: string) {
    return {
      hotel_id: hotelId,
      check_in_horario: config.checkInHorario,
      check_out_horario: config.checkOutHorario,
      tolerancia_check_out_minutos: config.toleranciaCheckOutMinutos,
      cafe_inicio: config.cafeInicio,
      cafe_fim: config.cafeFim,
      silencio_inicio: config.silencioInicio,
      silencio_fim: config.silencioFim,
      recepcao_24_horas: config.recepcao24Horas,
      recepcao_inicio: config.recepcaoInicio,
      recepcao_fim: config.recepcaoFim,
      lazer_inicio: config.lazerInicio,
      lazer_fim: config.lazerFim,
      politica_cancelamento: config.politicaCancelamento,
      politicaCancelamentoTexto: config.politicaCancelamentoTexto,
      permite_pet: config.permitePet,
      taxa_pet: config.taxaPet,
      proibido_fumar: config.proibidoFumar,
      idade_minima_checkin: config.idadeMinimaCheckin,
      permite_visitantes: config.permiteVisitantes,
      regras_gerais_texto: config.regrasGeraisTexto,
      dpo_nome: config.dpoNome,
      dpo_email: config.dpoEmail,
      dpo_telefone: config.dpoTelefone,
      exigir_consentimento_checkin: config.exigirConsentimentoCheckin,
      prazo_retencao_anos: config.prazoRetencaoAnos,
      enviar_aviso_privacidade_whatsapp: config.enviarAvisoPrivacidadeWhatsapp,
      politica_privacidade_texto: config.politicaPrivacidadeTexto,
      mp_environment: config.mpEnvironment,
      mp_public_key: config.mpPublicKey,
      mp_access_token: config.mpAccessToken,
      mp_client_id: config.mpClientId,
      mp_client_secret: config.mpClientSecret,
      mp_enable_pix: config.mpEnablePix,
      mp_enable_credit_card: config.mpEnableCreditCard,
      mp_enable_boleto: config.mpEnableBoleto,
      mp_max_installments: config.mpMaxInstallments,
      atualizado_em: new Date().toISOString()
    };
  },

  async getConfig(hotelId?: string): Promise<HotelConfigData | null> {
    try {
      let hId = isValidHotelUuid(hotelId) ? hotelId! : null;
      if (!hId) {
        const cur = currentHotelService.getCurrentHotel();
        if (isValidHotelUuid(cur?.id)) hId = cur.id;
      }

      // 1. Tenta buscar da tabela hotel_configuracoes
      try {
        let query = supabase.from('hotel_configuracoes').select('*');
        if (hId) {
          query = query.eq('hotel_id', hId);
        }
        const { data, error } = await query.limit(1).maybeSingle();
        if (data && !error) {
          return this.mapRowToConfig(data);
        }
      } catch {
        // Tabela não autorizada ou sem permissões, prossegue para fallback imediato
      }

      // 2. DUAL-STORAGE: Busca da tabela 'hoteis' (campo observacoes), que é 100% autorizada
      try {
        let queryH = supabase.from('hoteis').select('id, observacoes');
        if (hId) {
          queryH = queryH.eq('id', hId);
        } else {
          queryH = queryH.ilike('nome', '%Morada da Lua%');
        }
        const { data: hData } = await queryH.limit(1).maybeSingle();
        if (hData?.observacoes) {
          const cfg = extractConfigFromObservacoes(hData.observacoes);
          if (cfg) return cfg;
        }

        // Se não localizou no hotel específico, busca no primeiro hotel com configuração salva
        const { data: allHotels } = await supabase
          .from('hoteis')
          .select('id, observacoes')
          .not('observacoes', 'is', null)
          .limit(25);

        if (allHotels && allHotels.length > 0) {
          for (const h of allHotels) {
            const cfg = extractConfigFromObservacoes(h.observacoes);
            if (cfg) return cfg;
          }
        }
      } catch (hErr) {
        console.warn('Erro ao consultar config na tabela hoteis:', hErr);
      }

      // 3. Fallback do cache local caso offline
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(`hotelnozap_config_hotel_${hId}`) ||
          localStorage.getItem('hotelnozap_config_hotel_global');
        if (cached) {
          try {
            return { ...DEFAULT_HOTEL_CONFIG, ...JSON.parse(cached) };
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.warn('Erro ao obter configurações do hotel:', e);
    }
    return DEFAULT_HOTEL_CONFIG;
  },

  async saveConfig(config: HotelConfigData, hotelId?: string): Promise<boolean> {
    try {
      let hId: string | null = isValidHotelUuid(hotelId) ? hotelId! : null;
      if (!hId) {
        const currentH = currentHotelService.getCurrentHotel();
        if (isValidHotelUuid(currentH?.id)) hId = currentH.id;
      }
      if (!hId) {
        const { data: mHotel } = await supabase
          .from('hoteis')
          .select('id')
          .ilike('nome', '%Morada da Lua%')
          .maybeSingle();
        if (mHotel?.id) {
          hId = mHotel.id;
        } else {
          const { data: firstH } = await supabase
            .from('hoteis')
            .select('id')
            .order('criado_em', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (firstH?.id) hId = firstH.id;
        }
      }

      if (!hId) {
        console.warn('Não foi possível identificar o hotelId para salvar as configurações.');
        return false;
      }

      // 1. DUAL-STORAGE ESTRATÉGIA:
      // Salva imediatamente na tabela 'hoteis' (campo observacoes), 100% autorizada e compartilhada entre todos os subdomínios
      try {
        const { data: hotelRow } = await supabase
          .from('hoteis')
          .select('observacoes')
          .eq('id', hId)
          .maybeSingle();

        const updatedObs = embedConfigInObservacoes(hotelRow?.observacoes, config);
        const { error: hotelErr } = await supabase
          .from('hoteis')
          .update({ observacoes: updatedObs })
          .eq('id', hId);

        if (hotelErr) {
          console.warn('Aviso ao sincronizar na tabela hoteis:', hotelErr);
        } else {
          console.info('Configuração persistida com sucesso na tabela hoteis!');
        }
      } catch (obsErr) {
        console.warn('Erro ao salvar config em hoteis:', obsErr);
      }

      // 2. Salva na tabela dedicada 'hotel_configuracoes'
      try {
        const row = this.mapConfigToRow(config, hId);
        await supabase
          .from('hotel_configuracoes')
          .upsert(row, { onConflict: 'hotel_id' });
      } catch (tErr) {
        console.warn('Aviso ao atualizar hotel_configuracoes:', tErr);
      }

      // 3. Atualiza cache local
      if (typeof window !== 'undefined') {
        const serialized = JSON.stringify(config);
        localStorage.setItem(`hotelnozap_config_hotel_${hId}`, serialized);
        localStorage.setItem('hotelnozap_config_hotel_global', serialized);
      }

      return true;
    } catch (e) {
      console.warn('Exceção ao salvar configurações do hotel:', e);
      return false;
    }
  }
};


