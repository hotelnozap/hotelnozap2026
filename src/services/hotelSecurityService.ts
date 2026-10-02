import { supabase } from '../lib/supabase';
import { maskCnpj, maskCpf, isValidCnpj, isValidCpf } from '../utils/masks';

export interface UniquenessCheckResult {
  checking: boolean;
  checked: boolean;
  exists: boolean;
  message: string;
}

export const initialCheckResult: UniquenessCheckResult = {
  checking: false,
  checked: false,
  exists: false,
  message: ''
};

/**
 * Serviço de segurança e unicidade para cadastro de hotéis.
 * Valida em tempo real e bloqueia duplicidade de:
 * 1. CNPJ do Hotel
 * 2. CPF do Proprietário / Responsável
 * 3. E-mail de Acesso (Login / Gestor)
 */
export const hotelSecurityService = {
  /**
   * Verifica se o CNPJ já está cadastrado na base de hotéis.
   */
  async checkCnpj(cnpj: string, excludeHotelId?: string | null): Promise<UniquenessCheckResult> {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) {
      return { checking: false, checked: false, exists: false, message: '' };
    }

    if (!isValidCnpj(clean)) {
      return { checking: false, checked: true, exists: false, message: 'CNPJ inválido' };
    }

    const masked = maskCnpj(clean);
    try {
      let query = supabase
        .from('hoteis')
        .select('id, nome, cnpj')
        .or(`cnpj.eq.${clean},cnpj.eq.${masked}`);

      if (excludeHotelId) {
        query = query.neq('id', excludeHotelId);
      }

      const { data, error } = await query.limit(1);

      if (error) {
        console.warn('hotelSecurityService.checkCnpj: erro na consulta:', error);
        return { checking: false, checked: true, exists: false, message: 'Válido' };
      }

      if (data && data.length > 0) {
        const hotelName = data[0].nome || 'outro hotel';
        return {
          checking: false,
          checked: true,
          exists: true,
          message: `Este CNPJ já está cadastrado no sistema (Hotel: ${hotelName}).`
        };
      }

      return {
        checking: false,
        checked: true,
        exists: false,
        message: 'Válido'
      };
    } catch (err) {
      console.warn('hotelSecurityService.checkCnpj exceção:', err);
      return { checking: false, checked: true, exists: false, message: 'Válido' };
    }
  },

  /**
   * Verifica se o CPF já está cadastrado para algum proprietário ou usuário.
   */
  async checkCpf(cpf: string, excludeHotelId?: string | null): Promise<UniquenessCheckResult> {
    const clean = cpf.replace(/\D/g, '');
    if (!clean) {
      return { checking: false, checked: false, exists: false, message: '' };
    }

    if (clean.length !== 11) {
      return { checking: false, checked: false, exists: false, message: '' };
    }

    if (!isValidCpf(clean)) {
      return { checking: false, checked: true, exists: false, message: 'CPF inválido' };
    }

    const masked = maskCpf(clean);
    try {
      // 1. Consulta em hoteis (cpf_gerente)
      let qHotel = supabase
        .from('hoteis')
        .select('id, nome, cpf_gerente')
        .or(`cpf_gerente.eq.${clean},cpf_gerente.eq.${masked}`);

      if (excludeHotelId) {
        qHotel = qHotel.neq('id', excludeHotelId);
      }

      // 2. Consulta em usuarios (cpf)
      const qUsuario = supabase
        .from('usuarios')
        .select('id, nome, cpf')
        .or(`cpf.eq.${clean},cpf.eq.${masked}`)
        .limit(1);

      const [resHotel, resUsuario] = await Promise.all([
        qHotel.limit(1),
        qUsuario
      ]).catch(() => [{ data: null }, { data: null }]);

      if (resHotel?.data && resHotel.data.length > 0) {
        const hotelNome = resHotel.data[0].nome || 'um hotel';
        return {
          checking: false,
          checked: true,
          exists: true,
          message: `Este CPF já está cadastrado no sistema (Responsável de: ${hotelNome}).`
        };
      }

      if (resUsuario?.data && resUsuario.data.length > 0) {
        const userName = resUsuario.data[0].nome || 'um usuário';
        return {
          checking: false,
          checked: true,
          exists: true,
          message: `Este CPF já está cadastrado no sistema (Usuário: ${userName}).`
        };
      }

      return {
        checking: false,
        checked: true,
        exists: false,
        message: 'Válido'
      };
    } catch (err) {
      console.warn('hotelSecurityService.checkCpf exceção:', err);
      return { checking: false, checked: true, exists: false, message: 'Válido' };
    }
  },

  /**
   * Verifica se o E-mail de Acesso já está cadastrado no sistema (usuarios, hoteis, parceiros).
   */
  async checkEmail(email: string, excludeHotelId?: string | null): Promise<UniquenessCheckResult> {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes('@') || !clean.includes('.')) {
      return { checking: false, checked: false, exists: false, message: '' };
    }

    try {
      // 1. Consulta em usuarios (email)
      const qUsuario = supabase
        .from('usuarios')
        .select('id, nome, email')
        .ilike('email', clean)
        .limit(1);

      // 2. Consulta em hoteis (email_login ou email_gerente)
      let qHotel = supabase
        .from('hoteis')
        .select('id, nome, email_login, email_gerente')
        .or(`email_login.ilike.${clean},email_gerente.ilike.${clean}`);

      if (excludeHotelId) {
        qHotel = qHotel.neq('id', excludeHotelId);
      }

      // 3. Consulta em parceiros (email)
      const qParceiro = supabase
        .from('parceiros')
        .select('id, nome, email')
        .ilike('email', clean)
        .limit(1);

      const [resUsuario, resHotel, resParceiro] = await Promise.all([
        qUsuario,
        qHotel.limit(1),
        qParceiro
      ]).catch(() => [{ data: null }, { data: null }, { data: null }]);

      if (resUsuario?.data && resUsuario.data.length > 0) {
        const userName = resUsuario.data[0].nome || 'um usuário';
        return {
          checking: false,
          checked: true,
          exists: true,
          message: `Este e-mail de acesso já está cadastrado no sistema (${userName}).`
        };
      }

      if (resHotel?.data && resHotel.data.length > 0) {
        const hotelNome = resHotel.data[0].nome || 'um hotel';
        return {
          checking: false,
          checked: true,
          exists: true,
          message: `Este e-mail já está em uso pelo hotel "${hotelNome}".`
        };
      }

      if (resParceiro?.data && resParceiro.data.length > 0) {
        const parcNome = resParceiro.data[0].nome || 'um parceiro';
        return {
          checking: false,
          checked: true,
          exists: true,
          message: `Este e-mail já está cadastrado como parceiro (${parcNome}).`
        };
      }

      return {
        checking: false,
        checked: true,
        exists: false,
        message: 'Válido'
      };
    } catch (err) {
      console.warn('hotelSecurityService.checkEmail exceção:', err);
      return { checking: false, checked: true, exists: false, message: 'Válido' };
    }
  },

  /**
   * Executa a validação combinada de segurança completa (usada na última etapa antes de submeter).
   */
  async validateAll(params: {
    cnpj: string;
    cpf?: string;
    email: string;
    excludeHotelId?: string | null;
  }): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    const [cnpjRes, cpfRes, emailRes] = await Promise.all([
      this.checkCnpj(params.cnpj, params.excludeHotelId),
      params.cpf && params.cpf.replace(/\D/g, '').length === 11
        ? this.checkCpf(params.cpf, params.excludeHotelId)
        : Promise.resolve(initialCheckResult),
      this.checkEmail(params.email, params.excludeHotelId)
    ]);

    if (cnpjRes.exists) {
      errors.push(cnpjRes.message || 'CNPJ já cadastrado no sistema.');
    }
    if (cpfRes.exists) {
      errors.push(cpfRes.message || 'CPF do proprietário já cadastrado no sistema.');
    }
    if (emailRes.exists) {
      errors.push(emailRes.message || 'E-mail de acesso já cadastrado no sistema.');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};
