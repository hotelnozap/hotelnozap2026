import { isValidCpf, isValidCnpj } from './masks';

/**
 * Utilitário para geração de dados de teste de Hotéis com CNPJ e CPF matematicamente válidos.
 * Ativado ao digitar 'hotel01' no campo Nome Fantasia (ou formulários de cadastro de hotel).
 */

export function generateValidCpf(): string {
  const n: number[] = [];
  for (let i = 0; i < 9; i++) {
    n.push(Math.floor(Math.random() * 10));
  }

  // 1º dígito verificador
  let d1 = 0;
  for (let i = 0; i < 9; i++) {
    d1 += n[i] * (10 - i);
  }
  const rest1 = d1 % 11;
  const digit1 = rest1 < 2 ? 0 : 11 - rest1;

  // 2º dígito verificador
  let d2 = 0;
  for (let i = 0; i < 9; i++) {
    d2 += n[i] * (11 - i);
  }
  d2 += digit1 * 2;
  const rest2 = d2 % 11;
  const digit2 = rest2 < 2 ? 0 : 11 - rest2;

  const raw = `${n.join('')}${digit1}${digit2}`;
  const formatted = `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`;
  
  // Garantia absoluta de validação
  if (!isValidCpf(formatted)) {
    return generateValidCpf();
  }
  return formatted;
}

export function generateValidCnpj(): string {
  const n: number[] = [];
  for (let i = 0; i < 8; i++) {
    n.push(Math.floor(Math.random() * 10));
  }
  // Filial 0001
  n.push(0, 0, 0, 1);

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let d1 = 0;
  for (let i = 0; i < 12; i++) {
    d1 += n[i] * w1[i];
  }
  const rest1 = d1 % 11;
  const digit1 = rest1 < 2 ? 0 : 11 - rest1;

  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let d2 = 0;
  for (let i = 0; i < 12; i++) {
    d2 += n[i] * w2[i];
  }
  d2 += digit1 * 2;
  const rest2 = d2 % 11;
  const digit2 = rest2 < 2 ? 0 : 11 - rest2;

  const raw = `${n.join('')}${digit1}${digit2}`;
  const formatted = `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12)}`;

  // Garantia absoluta de validação
  if (!isValidCnpj(formatted)) {
    return generateValidCnpj();
  }
  return formatted;
}

export interface MockHotelData {
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  categoria: string;
  telefone: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  urlHotel: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  nomeResponsavel: string;
  cpfResponsavel: string;
  emailResponsavel: string;
  whatsappResponsavel: string;
  cargoResponsavel: string;
  loginEmail: string;
  senha: string;
  confirmSenha: string;
  aceitaTermos: boolean;
}

export function generateMockHotelData(): MockHotelData {
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const randWa = String(Math.floor(1000 + Math.random() * 9000));
  const randWa2 = String(Math.floor(10 + Math.random() * 90));

  const nomes = ['Pousada Recanto do Sol', 'Hotel Vista Mar', 'Pousada Mar Azul', 'Hotel Brisa Tropical', 'Pousada Encanto Verde'];
  const baseNome = nomes[Math.floor(Math.random() * nomes.length)];
  const nomeFantasia = `${baseNome} ${randNum}`;
  const razaoSocial = `${baseNome} ${randNum} Ltda`;
  const slug = `${baseNome.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${randNum}`.replace(/-+/g, '-');
  const email = `hotel.teste.${randNum}@hotelnozap.com.br`;
  const whatsapp = `(11) 987${randWa2}-${randWa}`;

  return {
    nomeFantasia,
    razaoSocial,
    cnpj: generateValidCnpj(),
    categoria: 'Pousada',
    telefone: `(11) 3214-${randWa}`,
    whatsapp,
    instagram: `@hotelteste${randNum}`,
    facebook: `hotelteste${randNum}`,
    tiktok: `@hotelteste${randNum}`,
    urlHotel: slug,
    cep: '01310-100',
    logradouro: 'Avenida Paulista',
    numero: String(Math.floor(100 + Math.random() * 900)),
    complemento: 'Sala 101',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
    nomeResponsavel: `Carlos Gestor ${randNum}`,
    cpfResponsavel: generateValidCpf(),
    emailResponsavel: email,
    whatsappResponsavel: whatsapp,
    cargoResponsavel: 'Proprietário',
    loginEmail: email,
    senha: 'Hotel@123456',
    confirmSenha: 'Hotel@123456',
    aceitaTermos: true
  };
}

export function findPlanoTesteName(planos: any[]): string {
  if (!planos || planos.length === 0) return 'Plano Teste';
  // Procura pelo plano com valor base = 1 ou nome contendo 'teste' ou '1 real' ou '1,00'
  const found = planos.find(p => {
    const val = Number(p.basePrice ?? p.valor_base);
    const n = (p.name ?? p.nome ?? '').toLowerCase();
    return val === 1 || n.includes('teste') || n.includes('1,00') || n.includes('1.00');
  });
  return found ? (found.name || found.nome) : 'Plano Teste';
}
