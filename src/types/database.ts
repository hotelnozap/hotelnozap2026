export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      hoteis: {
        Row: {
          id: string;
          criado_em: string;
          nome: string;
          razao_social: string | null;
          categoria: string;
          cnpj: string;
          cidade: string | null;
          uf: string | null;
          bairro: string | null;
          cep: string | null;
          logradouro: string | null;
          plano: string;
          capacidade: number;
          unidade_capacidade: string;
          instancias_whatsapp: number;
          nome_gerente: string;
          telefone_gerente: string;
          email_gerente: string | null;
          cpf_gerente: string | null;
          cargo_gerente: string | null;
          email_login: string | null;
          nome_instancia: string | null;
          url_api: string | null;
          chave_api: string | null;
          observacoes: string | null;
          status: string;
          url_imagem: string | null;
          agente_ia: string | null;
        }
        Insert: Omit<Database['public']['Tables']['hoteis']['Row'], 'id' | 'criado_em'> & {
          id?: string;
          criado_em?: string;
        }
        Update: Partial<Database['public']['Tables']['hoteis']['Row']>
      }
      usuarios: {
        Row: {
          id: string;
          criado_em: string;
          hotel_id: string | null;
          nome: string;
          email: string;
          cargo: string;
          departamento: string | null;
          perfil: string;
          telefone: string;
          cpf: string | null;
          ramal: string | null;
          ultimo_acesso: string | null;
          status: string;
          url_avatar: string | null;
          iniciais: string;
          cep: string | null;
          logradouro: string | null;
          bairro: string | null;
          cidade: string | null;
          uf: string | null;
        }
        Insert: Omit<Database['public']['Tables']['usuarios']['Row'], 'id' | 'criado_em'> & {
          id?: string;
          criado_em?: string;
        }
        Update: Partial<Database['public']['Tables']['usuarios']['Row']>
      }
      categorias_produtos: {
        Row: {
          id: string;
          criado_em: string;
          hotel_id: string | null;
          nome: string;
          descricao: string | null;
          cor: string | null;
          status: string;
        }
        Insert: Omit<Database['public']['Tables']['categorias_produtos']['Row'], 'id' | 'criado_em'> & {
          id?: string;
          criado_em?: string;
        }
        Update: Partial<Database['public']['Tables']['categorias_produtos']['Row']>
      }
      categorias_contas_pagar: {
        Row: {
          id: string;
          criado_em: string;
          hotel_id: string | null;
          nome: string;
          descricao: string | null;
          cor: string | null;
          status: string;
        }
        Insert: Omit<Database['public']['Tables']['categorias_contas_pagar']['Row'], 'id' | 'criado_em'> & {
          id?: string;
          criado_em?: string;
        }
        Update: Partial<Database['public']['Tables']['categorias_contas_pagar']['Row']>
      }
      categorias_contas_receber: {
        Row: {
          id: string;
          criado_em: string;
          hotel_id: string | null;
          nome: string;
          descricao: string | null;
          cor: string | null;
          status: string;
        }
        Insert: Omit<Database['public']['Tables']['categorias_contas_receber']['Row'], 'id' | 'criado_em'> & {
          id?: string;
          criado_em?: string;
        }
        Update: Partial<Database['public']['Tables']['categorias_contas_receber']['Row']>
      }
      categorias_itens_quartos: {
        Row: {
          id: string;
          criado_em: string;
          hotel_id: string | null;
          nome: string;
          descricao: string | null;
          icone: string | null;
          status: string;
        }
        Insert: Omit<Database['public']['Tables']['categorias_itens_quartos']['Row'], 'id' | 'criado_em'> & {
          id?: string;
          criado_em?: string;
        }
        Update: Partial<Database['public']['Tables']['categorias_itens_quartos']['Row']>
      }
      tipos_quartos: {
        Row: {
          id: string;
          criado_em: string;
          hotel_id: string | null;
          nome: string;
          descricao: string | null;
          capacidade: number;
          valor_diaria_padrao: number;
          status: string;
        }
        Insert: Omit<Database['public']['Tables']['tipos_quartos']['Row'], 'id' | 'criado_em'> & {
          id?: string;
          criado_em?: string;
        }
        Update: Partial<Database['public']['Tables']['tipos_quartos']['Row']>
      }
      hospedes: {
        Row: {
          id: string;
          criado_em: string;
          hotel_id: string | null;
          nome: string;
          email: string;
          cpf_passaporte: string;
          telefone: string;
          cidade_uf: string;
          cep: string | null;
          logradouro: string | null;
          bairro: string | null;
          numero: string | null;
          observacoes: string | null;
          status: string;
        }
        Insert: Omit<Database['public']['Tables']['hospedes']['Row'], 'id' | 'criado_em'> & {
          id?: string;
          criado_em?: string;
        }
        Update: Partial<Database['public']['Tables']['hospedes']['Row']>
      }
      quartos: {
        Row: {
          id: string;
          criado_em: string;
          hotel_id: string | null;
          numero: string;
          tipo: string;
          andar: string;
          status: string;
          capacidade: number;
          valor_diaria: number;
          observacoes: string | null;
        }
        Insert: Omit<Database['public']['Tables']['quartos']['Row'], 'id' | 'criado_em'> & {
          id?: string;
          criado_em?: string;
        }
        Update: Partial<Database['public']['Tables']['quartos']['Row']>
      }
      reservas: {
        Row: {
          id: string;
          criado_em: string;
          hotel_id: string | null;
          hospede_id: string | null;
          quarto_id: string | null;
          nome_hospede: string;
          numero_quarto: string;
          data_checkin: string;
          data_checkout: string;
          status: string;
          valor_total: number;
          status_pagamento: string;
          observacoes: string | null;
        }
        Insert: Omit<Database['public']['Tables']['reservas']['Row'], 'id' | 'criado_em'> & {
          id?: string;
          criado_em?: string;
        }
        Update: Partial<Database['public']['Tables']['reservas']['Row']>
      }
      produtos: {
        Row: {
          id: string;
          criado_em: string;
          hotel_id: string | null;
          categoria_id: string | null;
          nome: string;
          categoria: string;
          preco: number;
          preco_custo: number | null;
          estoque: number;
          estoque_minimo: number | null;
          codigo_barras: string | null;
          sku: string | null;
          status: string;
          icone: string | null;
        }
        Insert: Omit<Database['public']['Tables']['produtos']['Row'], 'id' | 'criado_em'> & {
          id?: string;
          criado_em?: string;
        }
        Update: Partial<Database['public']['Tables']['produtos']['Row']>
      }
      parceiros: {
        Row: {
          id: string;
          criado_em: string;
          nome: string;
          categoria: string;
          documento: string;
          cidade_uf: string;
          cep: string | null;
          logradouro: string | null;
          bairro: string | null;
          nome_contato: string;
          whatsapp: string;
          cupom: string;
          taxa_comissao: number;
          status: string;
        }
        Insert: Omit<Database['public']['Tables']['parceiros']['Row'], 'id' | 'criado_em'> & {
          id?: string;
          criado_em?: string;
        }
        Update: Partial<Database['public']['Tables']['parceiros']['Row']>
      }
    }
  }
}

export interface HotelConfigData {
  // 1. Horários & Estadia
  checkInHorario: string;
  checkOutHorario: string;
  toleranciaCheckOutMinutos: number;
  cafeInicio: string;
  cafeFim: string;
  silencioInicio: string;
  silencioFim: string;
  recepcao24Horas: boolean;
  recepcaoInicio: string;
  recepcaoFim: string;
  lazerInicio: string;
  lazerFim: string;

  // 2. Regras & Políticas
  politicaCancelamento: 'flexivel' | 'moderada' | 'rigida' | 'personalizada';
  politicaCancelamentoTexto: string;
  permitePet: 'sim' | 'nao' | 'sob_consulta';
  taxaPet: number;
  proibidoFumar: boolean;
  idadeMinimaCheckin: number;
  permiteVisitantes: boolean;
  regrasGeraisTexto: string;

  // 3. LGPD & Privacidade
  dpoNome: string;
  dpoEmail: string;
  dpoTelefone: string;
  exigirConsentimentoCheckin: boolean;
  prazoRetencaoAnos: number;
  enviarAvisoPrivacidadeWhatsapp: boolean;
  politicaPrivacidadeTexto: string;

  // 4. Mercado Pago & Checkout
  mpEnvironment: 'production' | 'sandbox';
  mpPublicKey: string;
  mpAccessToken: string;
  mpClientId: string;
  mpClientSecret: string;
  mpEnablePix: boolean;
  mpEnableCreditCard: boolean;
  mpEnableBoleto: boolean;
  mpMaxInstallments: string;
}
