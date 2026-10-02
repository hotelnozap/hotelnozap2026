import { useState, useEffect, useRef, useCallback } from 'react';
import { hotelSecurityService, UniquenessCheckResult, initialCheckResult } from '../services/hotelSecurityService';
import { isValidCnpj, isValidCpf } from '../utils/masks';

export function useHotelSecurityCheck(params: {
  cnpj: string;
  cpf?: string;
  email: string;
  excludeHotelId?: string | null;
}) {
  const { cnpj, cpf = '', email, excludeHotelId } = params;

  const [cnpjCheck, setCnpjCheck] = useState<UniquenessCheckResult>(initialCheckResult);
  const [cpfCheck, setCpfCheck] = useState<UniquenessCheckResult>(initialCheckResult);
  const [emailCheck, setEmailCheck] = useState<UniquenessCheckResult>(initialCheckResult);

  // Debounce refs
  const cnpjTimer = useRef<any>(null);
  const cpfTimer = useRef<any>(null);
  const emailTimer = useRef<any>(null);

  // 1. Checagem de CNPJ em tempo real
  useEffect(() => {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) {
      setCnpjCheck(initialCheckResult);
      return;
    }

    if (!isValidCnpj(clean)) {
      setCnpjCheck({ checking: false, checked: true, exists: false, message: 'CNPJ inválido' });
      return;
    }

    setCnpjCheck(prev => ({ ...prev, checking: true }));
    if (cnpjTimer.current) clearTimeout(cnpjTimer.current);

    cnpjTimer.current = setTimeout(async () => {
      const res = await hotelSecurityService.checkCnpj(clean, excludeHotelId);
      setCnpjCheck(res);
    }, 450);

    return () => {
      if (cnpjTimer.current) clearTimeout(cnpjTimer.current);
    };
  }, [cnpj, excludeHotelId]);

  // 2. Checagem de CPF em tempo real
  useEffect(() => {
    const clean = (cpf || '').replace(/\D/g, '');
    if (!clean || clean.length < 11) {
      setCpfCheck(initialCheckResult);
      return;
    }

    if (!isValidCpf(clean)) {
      setCpfCheck({ checking: false, checked: true, exists: false, message: 'CPF inválido' });
      return;
    }

    setCpfCheck(prev => ({ ...prev, checking: true }));
    if (cpfTimer.current) clearTimeout(cpfTimer.current);

    cpfTimer.current = setTimeout(async () => {
      const res = await hotelSecurityService.checkCpf(clean, excludeHotelId);
      setCpfCheck(res);
    }, 450);

    return () => {
      if (cpfTimer.current) clearTimeout(cpfTimer.current);
    };
  }, [cpf, excludeHotelId]);

  // 3. Checagem de E-mail de Acesso em tempo real
  useEffect(() => {
    const clean = (email || '').trim().toLowerCase();
    if (!clean || !clean.includes('@') || !clean.includes('.')) {
      setEmailCheck(initialCheckResult);
      return;
    }

    setEmailCheck(prev => ({ ...prev, checking: true }));
    if (emailTimer.current) clearTimeout(emailTimer.current);

    emailTimer.current = setTimeout(async () => {
      const res = await hotelSecurityService.checkEmail(clean, excludeHotelId);
      setEmailCheck(res);
    }, 450);

    return () => {
      if (emailTimer.current) clearTimeout(emailTimer.current);
    };
  }, [email, excludeHotelId]);

  /**
   * Validação bloqueadora síncrona/imediata executada no envio final (última etapa).
   */
  const validateFinalStep = useCallback(async (): Promise<{
    allowed: boolean;
    error: string | null;
    cnpjExists: boolean;
    cpfExists: boolean;
    emailExists: boolean;
  }> => {
    const [cRes, pRes, eRes] = await Promise.all([
      hotelSecurityService.checkCnpj(cnpj, excludeHotelId),
      cpf && cpf.replace(/\D/g, '').length === 11
        ? hotelSecurityService.checkCpf(cpf, excludeHotelId)
        : Promise.resolve(initialCheckResult),
      hotelSecurityService.checkEmail(email, excludeHotelId)
    ]);

    setCnpjCheck(cRes);
    if (pRes.checked) setCpfCheck(pRes);
    setEmailCheck(eRes);

    if (cRes.exists) {
      return {
        allowed: false,
        error: cRes.message || 'CNPJ já cadastrado no sistema.',
        cnpjExists: true,
        cpfExists: pRes.exists,
        emailExists: eRes.exists
      };
    }

    if (pRes.exists) {
      return {
        allowed: false,
        error: pRes.message || 'CPF do proprietário já cadastrado no sistema.',
        cnpjExists: false,
        cpfExists: true,
        emailExists: eRes.exists
      };
    }

    if (eRes.exists) {
      return {
        allowed: false,
        error: eRes.message || 'E-mail de acesso já cadastrado no sistema.',
        cnpjExists: false,
        cpfExists: false,
        emailExists: true
      };
    }

    return {
      allowed: true,
      error: null,
      cnpjExists: false,
      cpfExists: false,
      emailExists: false
    };
  }, [cnpj, cpf, email, excludeHotelId]);

  return {
    cnpjCheck,
    cpfCheck,
    emailCheck,
    validateFinalStep,
    hasSecurityConflict: cnpjCheck.exists || cpfCheck.exists || emailCheck.exists
  };
}

export const SecurityFieldBadge: React.FC<{
  check: UniquenessCheckResult;
  isValidFormat: boolean;
  validLabel?: string;
  emptyText?: string;
}> = ({ check, isValidFormat, validLabel = 'Válido', emptyText }) => {
  if (check.checking) {
    return (
      <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1 animate-pulse">
        <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
        Verificando...
      </span>
    );
  }

  if (check.exists) {
    return (
      <span className="text-[11px] font-bold text-red-600 flex items-center gap-0.5">
        <span className="material-symbols-outlined text-xs">cancel</span>
        Já cadastrado
      </span>
    );
  }

  if (isValidFormat && check.checked && !check.exists) {
    return (
      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
        <span className="material-symbols-outlined text-xs">verified</span>
        {validLabel}
      </span>
    );
  }

  return emptyText ? <span className="text-[11px] text-gray-400">{emptyText}</span> : null;
};
