export interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
  erro?: boolean | string;
}

/**
 * Fetches address information from ViaCEP API given a CEP string.
 * Strips non-digits and returns address data or null if invalid/not found.
 */
export const fetchAddressByCep = async (cep: string): Promise<ViaCepResponse | null> => {
  const cleanCep = cep.replace(/\D/g, '');
  if (cleanCep.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    if (!response.ok) return null;
    const data: ViaCepResponse = await response.json();
    if (data.erro === true || data.erro === 'true') return null;
    return data;
  } catch (error) {
    console.error('ViaCEP fetch error:', error);
    return null;
  }
};
