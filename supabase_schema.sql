-- ====================================================================
-- HOTEL NO ZAP - SCRIPT SQL COMPLETO EM PT-BR (INCLUINDO CATEGORIAS)
-- Execute este script no SQL Editor do seu projeto Supabase.
-- URL: https://obkvgluunbnktzulzjfg.supabase.co
-- ====================================================================

-- 1. TABELA DE HOTÉIS
CREATE TABLE IF NOT EXISTS public.hoteis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  nome TEXT NOT NULL,
  razao_social TEXT,
  categoria TEXT DEFAULT 'Pousada Boutique',
  cnpj TEXT UNIQUE NOT NULL,
  cidade TEXT NOT NULL,
  uf TEXT NOT NULL,
  bairro TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  plano TEXT DEFAULT 'Professional',
  capacidade INTEGER DEFAULT 10,
  unidade_capacidade TEXT DEFAULT 'suítes',
  instancias_whatsapp INTEGER DEFAULT 1,
  nome_gerente TEXT NOT NULL,
  telefone_gerente TEXT NOT NULL,
  email_gerente TEXT,
  cpf_gerente TEXT,
  cargo_gerente TEXT,
  email_login TEXT,
  nome_instancia TEXT,
  url_api TEXT,
  chave_api TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'ativo',
  url_imagem TEXT,
  link TEXT,
  instagram TEXT,
  facebook TEXT,
  tiktok TEXT,
  whatsapp TEXT,
  parceiro_referencia TEXT
);

-- 2. TABELA DE USUÁRIOS DO SISTEMA
CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  hotel_id UUID REFERENCES public.hoteis(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  cargo TEXT NOT NULL,
  departamento TEXT,
  perfil TEXT DEFAULT 'Recepção',
  telefone TEXT NOT NULL,
  cpf TEXT,
  ramal TEXT,
  ultimo_acesso TEXT DEFAULT 'Nunca acessou',
  status TEXT DEFAULT 'ativo',
  url_avatar TEXT,
  iniciais TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  auth_user_id UUID,
  password TEXT
);

-- 3. TABELA DE CATEGORIAS DE PRODUTOS
CREATE TABLE IF NOT EXISTS public.categorias_produtos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  hotel_id UUID REFERENCES public.hoteis(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT '#006c49',
  status TEXT DEFAULT 'ativo'
);

-- 4. TABELA DE CATEGORIAS DE CONTAS A PAGAR
CREATE TABLE IF NOT EXISTS public.categorias_contas_pagar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  hotel_id UUID REFERENCES public.hoteis(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT '#ba1a1a',
  status TEXT DEFAULT 'ativo'
);

-- 5. TABELA DE CATEGORIAS DE CONTAS A RECEBER
CREATE TABLE IF NOT EXISTS public.categorias_contas_receber (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  hotel_id UUID REFERENCES public.hoteis(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT '#006c49',
  status TEXT DEFAULT 'ativo'
);

-- 6. TABELA DE CATEGORIAS DE ITENS DOS QUARTOS
CREATE TABLE IF NOT EXISTS public.categorias_itens_quartos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  hotel_id UUID REFERENCES public.hoteis(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  icone TEXT DEFAULT 'king_bed',
  status TEXT DEFAULT 'ativo'
);

-- 7. TABELA DE TIPOS DE QUARTOS
CREATE TABLE IF NOT EXISTS public.tipos_quartos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  hotel_id UUID REFERENCES public.hoteis(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  capacidade INTEGER DEFAULT 2,
  valor_diaria_padrao NUMERIC(10,2) DEFAULT 0.00,
  status TEXT DEFAULT 'ativo'
);

-- 8. TABELA DE HÓSPEDES
CREATE TABLE IF NOT EXISTS public.hospedes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  hotel_id UUID REFERENCES public.hoteis(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  cpf_passaporte TEXT NOT NULL,
  telefone TEXT NOT NULL,
  cidade_uf TEXT NOT NULL,
  cep TEXT,
  logradouro TEXT,
  bairro TEXT,
  numero TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'ativo'
);

-- 9. TABELA DE QUARTOS
CREATE TABLE IF NOT EXISTS public.quartos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  hotel_id UUID REFERENCES public.hoteis(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  tipo TEXT NOT NULL,
  andar TEXT DEFAULT 'Térreo',
  status TEXT DEFAULT 'disponivel',
  capacidade INTEGER DEFAULT 2,
  valor_diaria NUMERIC(10,2) DEFAULT 0.00,
  observacoes TEXT
);

-- 10. TABELA DE RESERVAS
CREATE TABLE IF NOT EXISTS public.reservas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  hotel_id UUID REFERENCES public.hoteis(id) ON DELETE CASCADE,
  hospede_id UUID REFERENCES public.hospedes(id) ON DELETE SET NULL,
  quarto_id UUID REFERENCES public.quartos(id) ON DELETE SET NULL,
  nome_hospede TEXT NOT NULL,
  numero_quarto TEXT NOT NULL,
  data_checkin TIMESTAMPTZ NOT NULL,
  data_checkout TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'confirmada',
  valor_total NUMERIC(10,2) DEFAULT 0.00,
  status_pagamento TEXT DEFAULT 'pendente',
  observacoes TEXT
);

-- 11. TABELA DE PRODUTOS E ESTOQUE
CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  hotel_id UUID REFERENCES public.hoteis(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.categorias_produtos(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  categoria TEXT DEFAULT 'Geral',
  preco NUMERIC(10,2) DEFAULT 0.00,
  preco_custo NUMERIC(10,2) DEFAULT 0.00,
  estoque INTEGER DEFAULT 0,
  estoque_minimo INTEGER DEFAULT 5,
  codigo_barras TEXT,
  sku TEXT,
  status TEXT DEFAULT 'ativo',
  icone TEXT
);

-- 12. TABELA DE PARCEIROS
CREATE TABLE IF NOT EXISTS public.parceiros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT DEFAULT 'Agência de Turismo',
  documento TEXT NOT NULL,
  cidade_uf TEXT NOT NULL,
  cep TEXT,
  logradouro TEXT,
  bairro TEXT,
  numero TEXT,
  cidade TEXT,
  uf TEXT,
  nome_contato TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT,
  cupom TEXT UNIQUE NOT NULL,
  taxa_comissao NUMERIC(5,2) DEFAULT 10.00,
  status TEXT DEFAULT 'ativo',
  pix_tipo TEXT DEFAULT 'PIX',
  pix_chave TEXT,
  banco TEXT,
  titular_pix TEXT,
  usuario_id UUID,
  auth_user_id UUID
);

-- ====================================================================
-- SEED DE DADOS INICIAIS EM PT-BR (INCLUINDO CATEGORIAS)
-- ====================================================================

INSERT INTO public.hoteis (id, nome, razao_social, categoria, cnpj, cidade_uf, bairro, cep, logradouro, plano, capacidade, unidade_capacidade, instancias_whatsapp, nome_gerente, telefone_gerente, email_gerente, status, url_imagem)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Hotel Master Porto de Galinhas',
  'Hotel Master Porto de Galinhas EIRELI',
  'Resort 5 estrelas',
  '12.345.678/0001-90',
  'Ipojuca / PE',
  'Praia do Cupe',
  '55590-000',
  'Rodovia PE-09, Km 08',
  'Enterprise',
  64,
  'suítes',
  3,
  'Marcos Andrade',
  '(81) 99876-5432',
  'contato@hotelmaster.com.br',
  'ativo',
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&auto=format&fit=crop&q=80'
) ON CONFLICT (cnpj) DO NOTHING;

-- SEED CATEGORIAS DE PRODUTOS
INSERT INTO public.categorias_produtos (hotel_id, nome, descricao, cor)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Bebidas & Frigobar', 'Águas, refrigerantes, sucos e alcoólicos', '#006c49'),
  ('11111111-1111-1111-1111-111111111111', 'Alimentos & Snacks', 'Chocolates, batatas, amendoins e biscoitos', '#fdb116'),
  ('11111111-1111-1111-1111-111111111111', 'Higiene & Acessórios', 'Kits de barbear, escovas, sabonetes e protetor', '#2563eb');

-- SEED CATEGORIAS DE CONTAS A PAGAR
INSERT INTO public.categorias_contas_pagar (hotel_id, nome, descricao, cor)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Fornecedores & Insumos', 'Compras de alimentos, bebidas e enxoval', '#ba1a1a'),
  ('11111111-1111-1111-1111-111111111111', 'Energia & Água & Conectividade', 'Contas públicas da propriedade', '#d97706'),
  ('11111111-1111-1111-1111-111111111111', 'Folha de Pagamento & Salários', 'Pagamento de funcionários e encargos', '#2563eb');

-- SEED CATEGORIAS DE CONTAS A RECEBER
INSERT INTO public.categorias_contas_receber (hotel_id, nome, descricao, cor)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Diárias & Hospedagens', 'Recebíveis diretos de reservas de quartos', '#006c49'),
  ('11111111-1111-1111-1111-111111111111', 'Consumo no Frigobar & Bar', 'Vendas diretas de produtos e serviços extras', '#0284c7'),
  ('11111111-1111-1111-1111-111111111111', 'Eventos & Passeios', 'Comissões de passeios e locação de salão', '#9333ea');

-- SEED CATEGORIAS DE ITENS DOS QUARTOS
INSERT INTO public.categorias_itens_quartos (hotel_id, nome, descricao, icone)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Camas & Enxoval', 'Camas king, queen, lençóis 300 fios e travesseiros', 'king_bed'),
  ('11111111-1111-1111-1111-111111111111', 'Eletrônicos & Climatização', 'Smart TVs 55, ar-condicionado Split e secador', 'tv'),
  ('11111111-1111-1111-1111-111111111111', 'Móveis & Decoração', 'Poltronas, mesas de trabalho, espelhos e armários', 'chair');

-- SEED DE PRODUTOS
INSERT INTO public.produtos (hotel_id, nome, categoria, preco, preco_custo, estoque, estoque_minimo, codigo_barras, sku, status, icone)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Água Mineral com Gás 500ml', 'Bebidas & Frigobar', 5.00, 1.80, 145, 20, '7891234567890', 'BEB-AGU-001', 'ativo', 'water_drop'),
  ('11111111-1111-1111-1111-111111111111', 'Amendoim Japonês 150g', 'Alimentos & Snacks', 8.50, 3.20, 0, 10, '7891234567891', 'SNA-AME-002', 'esgotado', 'cookie'),
  ('11111111-1111-1111-1111-111111111111', 'Cerveja Artesanal IPA 600ml', 'Bebidas & Frigobar', 25.00, 11.50, 42, 15, '7891234567892', 'BEB-CER-003', 'ativo', 'sports_bar'),
  ('11111111-1111-1111-1111-111111111111', 'Kit Banho Premium', 'Higiene & Acessórios', 45.00, 18.00, 18, 5, '7891234567893', 'HIG-KIT-004', 'ativo', 'soap'),
  ('11111111-1111-1111-1111-111111111111', 'Refrigerante Coca-Cola 350ml', 'Bebidas & Frigobar', 7.00, 2.50, 88, 25, '7891234567894', 'BEB-COC-005', 'ativo', 'local_bar'),
  ('11111111-1111-1111-1111-111111111111', 'Batata Pringles Original 114g', 'Alimentos & Snacks', 14.00, 6.80, 5, 10, '7891234567895', 'SNA-BAT-006', 'ativo', 'bakery_dining'),
  ('11111111-1111-1111-1111-111111111111', 'Barbeador Descartável Duplo', 'Higiene & Acessórios', 12.00, 4.00, 22, 10, '7891234567896', 'HIG-BAR-007', 'ativo', 'content_cut'),
  ('11111111-1111-1111-1111-111111111111', 'Chaveiro Lembrança do Hotel', 'Souvenirs', 18.00, 5.00, 50, 15, '7891234567897', 'SOU-CHA-008', 'ativo', 'key')
ON CONFLICT DO NOTHING;

-- SEED DE PARCEIROS
INSERT INTO public.parceiros (nome, categoria, documento, cidade_uf, cep, logradouro, bairro, nome_contato, whatsapp, cupom, taxa_comissao, status)
VALUES
  ('Rodrigo Carvalho', 'Influencer Hoteleiro', '123.456.789-00', 'São Paulo / SP', '01310-100', 'Av. Paulista, 1000', 'Bela Vista', 'Rodrigo Carvalho', '(11) 98123-4567', 'HOTELRODRIGO10', 10.00, 'ativo'),
  ('Agência Viaje Tranquilo', 'Consultoria de Expansão', '98.765.432/0001-11', 'Rio de Janeiro / RJ', '22041-001', 'Av. Atlântica, 500', 'Copacabana', 'Juliana Lima', '(21) 97654-3210', 'VIAJETRANQUILO', 15.00, 'ativo'),
  ('Mariana Souza', 'Consultoria Hoteleira', '456.789.123-44', 'Recife / PE', '51020-010', 'Av. Boa Viagem, 200', 'Boa Viagem', 'Mariana Souza', '(81) 99122-3344', 'MARIGUIA5', 5.00, 'ativo'),
  ('Carlos Pousadas & Dicas', 'Portal de Hospedagem', '321.654.987-88', 'Belo Horizonte / MG', '30130-000', 'Rua da Bahia, 1200', 'Centro', 'Carlos Silva', '(31) 98455-8899', 'CARLOSPOUSADA', 8.00, 'pausado'),
  ('Lucas & Paula Viagens', 'Criadores de Conteúdo', '654.321.987-55', 'Florianópolis / SC', '88010-000', 'Rua Felipe Schmidt, 300', 'Centro', 'Lucas Mendes', '(48) 99888-7766', 'LUCASPAULA12', 12.00, 'ativo')
ON CONFLICT (cupom) DO NOTHING;

-- HABILITAR RLS E POLÍTICAS DE ACESSO
ALTER TABLE public.hoteis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_itens_quartos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_quartos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quartos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS (LIBERAÇÃO TOTAL DE ACESSO PARA API / ANON / AUTHENTICATED)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Acesso Total Hoteis" ON public.hoteis;
CREATE POLICY "Acesso Total Hoteis" ON public.hoteis FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Usuarios" ON public.usuarios;
CREATE POLICY "Acesso Total Usuarios" ON public.usuarios FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Cat Produtos" ON public.categorias_produtos;
CREATE POLICY "Acesso Total Cat Produtos" ON public.categorias_produtos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Cat Pagar" ON public.categorias_contas_pagar;
CREATE POLICY "Acesso Total Cat Pagar" ON public.categorias_contas_pagar FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Cat Receber" ON public.categorias_contas_receber;
CREATE POLICY "Acesso Total Cat Receber" ON public.categorias_contas_receber FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Cat Itens" ON public.categorias_itens_quartos;
CREATE POLICY "Acesso Total Cat Itens" ON public.categorias_itens_quartos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Tipos Quartos" ON public.tipos_quartos;
CREATE POLICY "Acesso Total Tipos Quartos" ON public.tipos_quartos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Hospedes" ON public.hospedes;
CREATE POLICY "Acesso Total Hospedes" ON public.hospedes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Quartos" ON public.quartos;
CREATE POLICY "Acesso Total Quartos" ON public.quartos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Reservas" ON public.reservas;
CREATE POLICY "Acesso Total Reservas" ON public.reservas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Produtos" ON public.produtos;
CREATE POLICY "Acesso Total Produtos" ON public.produtos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Parceiros" ON public.parceiros;
CREATE POLICY "Acesso Total Parceiros" ON public.parceiros FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 12. REMOÇÃO DE CIDADE_UF E USO EXCLUSIVO DE CIDADE E UF NA TABELA HOTEIS
-- ==============================================================================
ALTER TABLE public.hoteis ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE public.hoteis ADD COLUMN IF NOT EXISTS uf TEXT;
DROP TRIGGER IF EXISTS trg_sync_hotel_cidade_uf ON public.hoteis;
DROP FUNCTION IF EXISTS public.sync_hotel_cidade_uf();
ALTER TABLE public.hoteis DROP COLUMN IF EXISTS cidade_uf CASCADE;

-- ==============================================================================
-- 13. TABELA DE TIPOS DE USUÁRIOS E NÍVEIS DE ACESSO
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tipos_usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  tipo_usuario TEXT NOT NULL,
  ordenacao INTEGER DEFAULT 1,
  status TEXT DEFAULT 'ativo',
  observacao TEXT,
  permissoes TEXT[]
);

GRANT ALL ON TABLE public.tipos_usuarios TO anon, authenticated, service_role;
ALTER TABLE public.tipos_usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Tipos Usuarios" ON public.tipos_usuarios;
CREATE POLICY "Acesso Total Tipos Usuarios" ON public.tipos_usuarios FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 14. ATIVAÇÃO DO SUPABASE REALTIME EM TODAS AS TABELAS DO SISTEMA
-- ==============================================================================
-- Configura replicação completa para envio em tempo real de inserts, updates e deletes
ALTER TABLE public.hoteis REPLICA IDENTITY FULL;
ALTER TABLE public.usuarios REPLICA IDENTITY FULL;
ALTER TABLE public.parceiros REPLICA IDENTITY FULL;
ALTER TABLE public.planos REPLICA IDENTITY FULL;
ALTER TABLE public.reservas REPLICA IDENTITY FULL;
ALTER TABLE public.quartos REPLICA IDENTITY FULL;
ALTER TABLE public.hospedes REPLICA IDENTITY FULL;
ALTER TABLE public.produtos REPLICA IDENTITY FULL;
ALTER TABLE public.tipos_usuarios REPLICA IDENTITY FULL;
ALTER TABLE public.tipos_quartos REPLICA IDENTITY FULL;
ALTER TABLE public.itens_quartos REPLICA IDENTITY FULL;
ALTER TABLE public.categorias_produtos REPLICA IDENTITY FULL;
ALTER TABLE public.categorias_contas_pagar REPLICA IDENTITY FULL;
ALTER TABLE public.categorias_contas_receber REPLICA IDENTITY FULL;

-- ==============================================================================
-- 15. CAMPO NÚMERO NO ENDEREÇO (hoteis, usuarios, parceiros, hospedes)
-- ==============================================================================
ALTER TABLE public.hoteis ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE public.parceiros ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE public.hospedes ADD COLUMN IF NOT EXISTS numero TEXT;

-- ==============================================================================
-- 16. COLUNAS FALTANTES: vínculo Auth, redes sociais em hoteis, dados bancários em parceiros
--     RODAR NO SQL EDITOR DO SUPABASE ANTES DE CADASTRAR NOVO HOTEL/PARCEIRO/USUÁRIO
-- ==============================================================================
-- 16.1 Usuários: vínculo com auth.users (corrige erro "Could not find auth_user_id column")
ALTER TABLE IF EXISTS public.usuarios ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE IF EXISTS public.usuarios ADD COLUMN IF NOT EXISTS password TEXT;

-- 16.2 Hoteis: redes sociais, link público, referência parceiro
ALTER TABLE IF EXISTS public.hoteis ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE IF EXISTS public.hoteis ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE IF EXISTS public.hoteis ADD COLUMN IF NOT EXISTS facebook TEXT;
ALTER TABLE IF EXISTS public.hoteis ADD COLUMN IF NOT EXISTS tiktok TEXT;
ALTER TABLE IF EXISTS public.hoteis ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE IF EXISTS public.hoteis ADD COLUMN IF NOT EXISTS parceiro_referencia TEXT;

-- 16.3 Parceiros: dados bancários (PIX + Banco + Titular), endereço completo, vínculo Auth
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS pix_tipo TEXT DEFAULT 'PIX';
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS pix_chave TEXT;
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS banco TEXT;
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS titular_pix TEXT;
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS uf TEXT;
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS usuario_id UUID;
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- 16.3.1 Foreign Keys: parceiros.usuario_id → public.usuarios.id  e  parceiros.auth_user_id → auth.users.id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'parceiros' AND column_name = 'usuario_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuarios'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'parceiros_usuario_id_fkey' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.parceiros
      ADD CONSTRAINT parceiros_usuario_id_fkey
      FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'parceiros' AND column_name = 'auth_user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'parceiros_auth_user_id_fkey' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.parceiros
      ADD CONSTRAINT parceiros_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Adiciona as tabelas à publicação realtime do Supabase
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hoteis; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.usuarios; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.parceiros; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.planos; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reservas; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.quartos; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hospedes; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tipos_usuarios; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tipos_quartos; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.itens_quartos; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.categorias_produtos; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.categorias_contas_pagar; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.categorias_contas_receber; EXCEPTION WHEN others THEN NULL; END;
END $$;

