-- Migration: Criação da tabela de cupons de desconto para os hotéis e hóspedes
CREATE TABLE IF NOT EXISTS public.cupons_desconto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES public.hoteis(id) ON DELETE CASCADE,
  hotel_nome TEXT,
  codigo VARCHAR(50) NOT NULL,
  tipo_desconto VARCHAR(20) NOT NULL DEFAULT 'porcentagem', -- 'porcentagem' ou 'fixo'
  valor_desconto NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
  valor_minimo_reserva NUMERIC(10, 2) DEFAULT 0.00,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_expiracao DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  limite_usos INTEGER, -- null = ilimitado
  usos_atuais INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Ativo', -- 'Ativo' ou 'Inativo'
  visivel_hospedes BOOLEAN NOT NULL DEFAULT true,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT cupom_codigo_hotel_unique UNIQUE (hotel_id, codigo)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cupons_hotel_id ON public.cupons_desconto(hotel_id);
CREATE INDEX IF NOT EXISTS idx_cupons_codigo ON public.cupons_desconto(codigo);
CREATE INDEX IF NOT EXISTS idx_cupons_visivel_status ON public.cupons_desconto(visivel_hospedes, status);

-- Habilitar RLS
ALTER TABLE public.cupons_desconto ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- 1. Qualquer usuário autenticado ou anônimo pode ler cupons ativos e públicos
DROP POLICY IF EXISTS "Cupons públicos visíveis para todos" ON public.cupons_desconto;
CREATE POLICY "Cupons públicos visíveis para todos"
  ON public.cupons_desconto FOR SELECT
  USING (status = 'Ativo' AND visivel_hospedes = true);

-- 2. Permitir leitura completa para o serviço
DROP POLICY IF EXISTS "Leitura de cupons" ON public.cupons_desconto;
CREATE POLICY "Leitura de cupons"
  ON public.cupons_desconto FOR SELECT
  USING (true);

-- 3. Permitir criação, atualização e exclusão
DROP POLICY IF EXISTS "Manipulação de cupons" ON public.cupons_desconto;
CREATE POLICY "Manipulação de cupons"
  ON public.cupons_desconto FOR ALL
  USING (true)
  WITH CHECK (true);
