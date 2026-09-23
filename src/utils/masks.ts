/**
 * Helper utility functions for formatting user input fields.
 * Includes masks for CPF, CNPJ, dynamic CPF/CNPJ, CEP, and Telefone/WhatsApp.
 */

// Format CPF (11 digits: 000.000.000-00)
export const maskCpf = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

// Format CNPJ (14 digits: 00.000.000/0000-00)
export const maskCnpj = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

// Format CPF or CNPJ dynamically based on digit count
export const maskCpfCnpj = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) {
    return maskCpf(value);
  }
  return maskCnpj(value);
};

// Format CEP (8 digits: 00000-000)
export const maskCep = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

// Format Telefone / WhatsApp (10 digits: (00) 0000-0000 ou 11 digits: (00) 00000-0000)
export const maskPhone = (value: string): string => {
  if (!value) return '';
  let digits = value.replace(/\D/g, '');

  // Trata números vindos no padrão Evolution (12 dígitos começando com 55: 55 + DDD + 8 dígitos)
  if (digits.startsWith('55') && digits.length === 12) {
    const ddd = digits.slice(2, 4);
    const number = digits.slice(4);
    // Se o número de 8 dígitos começa com 6, 7 ou 8 (celular sem o 9):
    // No Brasil o celular é exibido visualmente com o 9: (XX) 9XXXX-XXXX
    if (/^[6-8]/.test(number)) {
      return `(${ddd}) 9${number.slice(0, 4)}-${number.slice(4)}`;
    }
    // Se já começa com 9 ou é fixo (2, 3, 4, 5): (XX) XXXX-XXXX
    return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  }

  // Trata números que chegam com DDI +55 (13 dígitos: 55 + DDD + 9 dígitos)
  if (digits.startsWith('55') && digits.length === 13) {
    digits = digits.slice(2);
  }

  // Limita a 11 dígitos (DDD + 9 dígitos)
  digits = digits.slice(0, 11);
  if (!digits) return '';

  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

/**
 * Converte qualquer telefone brasileiro para o formato numérico oficial exigido pela Evolution API.
 * A Evolution API NÃO utiliza o 9º dígito adicional em celulares brasileiros (utiliza 55 + DDD + 8 dígitos = 12 dígitos).
 * Exemplos:
 * - (66) 98158-5014 -> 556681585014
 * - 5566981585014   -> 556681585014
 * - (65) 9605-5823  -> 556596055823
 * - 556596055823    -> 556596055823
 */
export const formatPhoneEvolution = (value: string): string => {
  if (!value) return '';
  let digits = value.replace(/\D/g, '');
  if (!digits) return '';

  // Caso 1: Já veio com DDI 55
  if (digits.startsWith('55')) {
    // 13 dígitos: 55 + DDD (2) + 9 (1) + 8 dígitos (ex: 5566981585014)
    // Evolution API NÃO usa o 9, então remove o 9 (5º caractere)
    if (digits.length === 13) {
      const ddd = digits.slice(2, 4);
      const nonoDigito = digits.charAt(4);
      const resto = digits.slice(5);
      if (nonoDigito === '9') {
        return `55${ddd}${resto}`; // ex: 556681585014
      }
      return digits;
    }
    // 12 dígitos: 55 + DDD (2) + 8 dígitos (ex: 556681585014 ou 556596055823) -> já está correto!
    if (digits.length === 12) {
      return digits;
    }
    return digits;
  }

  // Caso 2: Sem DDI 55
  // 11 dígitos: DDD (2) + 9 (1) + 8 dígitos (ex: 66981585014 ou vindo de (66) 98158-5014)
  // Evolution API NÃO usa o 9, então remove o 9 e adiciona 55 na frente
  if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const nonoDigito = digits.charAt(2);
    const resto = digits.slice(3);
    if (nonoDigito === '9') {
      return `55${ddd}${resto}`; // ex: 556681585014
    }
    return `55${digits}`;
  }

  // 10 dígitos: DDD (2) + 8 dígitos (ex: 6596055823 ou 6681585014)
  if (digits.length === 10) {
    return `55${digits}`; // ex: 556596055823 ou 556681585014
  }

  return `55${digits}`;
};

/**
 * Validação básica de telefone brasileiro: DDD válido (11 a 99) e 10 ou 11 dígitos.
 */
export const isValidPhone = (phone: string): boolean => {
  const digits = (phone || '').replace(/\D/g, '');
  const clean = (digits.startsWith('55') && (digits.length === 12 || digits.length === 13))
    ? digits.slice(2)
    : digits;
  if (clean.length !== 10 && clean.length !== 11) return false;
  const ddd = parseInt(clean.slice(0, 2), 10);
  return ddd >= 11 && ddd <= 99;
};

/**
 * Validação de CPF autêntico segundo algoritmo oficial da Receita Federal do Brasil.
 * Bloqueia sequências repetidas (000.000.000-00, 111.111.111-11, etc.) e confere os dígitos verificadores.
 */
export const isValidCpf = (cpf: string): boolean => {
  const digits = (cpf || '').replace(/\D/g, '');
  if (digits.length !== 11) return false;

  // Bloqueia números com todos os dígitos iguais
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // 1º dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let rest = sum % 11;
  const digit1 = rest < 2 ? 0 : 11 - rest;
  if (digit1 !== parseInt(digits.charAt(9), 10)) return false;

  // 2º dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  rest = sum % 11;
  const digit2 = rest < 2 ? 0 : 11 - rest;
  return digit2 === parseInt(digits.charAt(10), 10);
};

/**
 * Validação de CNPJ segundo algoritmo oficial da Receita Federal.
 */
export const isValidCnpj = (cnpj: string): boolean => {
  const digits = (cnpj || '').replace(/\D/g, '');
  if (digits.length !== 14) return false;

  // Bloqueia números com todos os dígitos iguais
  if (/^(\d)\1{13}$/.test(digits)) return false;

  // 1º dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits.charAt(i), 10) * weights1[i];
  }
  let rest = sum % 11;
  const digit1 = rest < 2 ? 0 : 11 - rest;
  if (digit1 !== parseInt(digits.charAt(12), 10)) return false;

  // 2º dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits.charAt(i), 10) * weights2[i];
  }
  rest = sum % 11;
  const digit2 = rest < 2 ? 0 : 11 - rest;
  return digit2 === parseInt(digits.charAt(13), 10);
};

export interface ValidationStatus {
  isValid: boolean;
  isComplete: boolean;
  message: string;
}

/**
 * Análise em tempo real do estado de preenchimento do CPF.
 */
export const getCpfValidationStatus = (cpf: string): ValidationStatus => {
  const digits = (cpf || '').replace(/\D/g, '');
  if (!digits) {
    return { isValid: false, isComplete: false, message: '' };
  }
  if (digits.length < 11) {
    return {
      isValid: false,
      isComplete: false,
      message: `Preencha os 11 dígitos (${digits.length}/11)`
    };
  }
  const valid = isValidCpf(digits);
  return {
    isValid: valid,
    isComplete: true,
    message: valid ? 'CPF válido' : 'CPF inválido. Verifique os dígitos digitados.'
  };
};

/**
 * Análise em tempo real do estado de preenchimento do CNPJ.
 */
export const getCnpjValidationStatus = (cnpj: string): ValidationStatus => {
  const digits = (cnpj || '').replace(/\D/g, '');
  if (!digits) {
    return { isValid: false, isComplete: false, message: '' };
  }
  if (digits.length < 14) {
    return {
      isValid: false,
      isComplete: false,
      message: `Preencha os 14 dígitos (${digits.length}/14)`
    };
  }
  const valid = isValidCnpj(digits);
  return {
    isValid: valid,
    isComplete: true,
    message: valid ? 'CNPJ válido' : 'CNPJ inválido. Verifique os dígitos digitados.'
  };
};

/**
 * Análise dinâmica de CPF ou CNPJ baseada na quantidade de dígitos.
 */
export const getCpfCnpjValidationStatus = (value: string): ValidationStatus => {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) {
    return { isValid: false, isComplete: false, message: '' };
  }
  if (digits.length <= 11) {
    return getCpfValidationStatus(value);
  }
  return getCnpjValidationStatus(value);
};
