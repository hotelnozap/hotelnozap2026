-- Migration: Criação das tabelas da Lavanderia de Hóspedes e Catálogo de Itens
-- Data: 2026-10-11
-- Autor: Jarvis para HotelNoZap

-- 1. TABELA DE ITENS / TABELA DE PREÇOS DA LAVANDERIA
CREATE TABLE IF NOT EXISTS public.lavanderia_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  valor NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lavanderia_itens_hotel_id ON public.lavanderia_itens(hotel_id);
CREATE INDEX IF NOT EXISTS idx_lavanderia_itens_ativo ON public.lavanderia_itens(ativo);

-- Habilitar RLS na tabela de itens
ALTER TABLE public.lavanderia_itens ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para lavanderia_itens
DROP POLICY IF EXISTS "Leitura de itens da lavanderia" ON public.lavanderia_itens;
CREATE POLICY "Leitura de itens da lavanderia"
  ON public.lavanderia_itens FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Manipulação de itens da lavanderia" ON public.lavanderia_itens;
CREATE POLICY "Manipulação de itens da lavanderia"
  ON public.lavanderia_itens FOR ALL
  USING (true)
  WITH CHECK (true);


-- 2. TABELA DE PEDIDOS DE LAVANDERIA (ORDENS DE SERVIÇO DE ROUPAS NO BALCÃO)
CREATE TABLE IF NOT EXISTS public.lavanderia_pedidos (
  id TEXT PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL,
  hotel_id TEXT NOT NULL,
  quarto_numero VARCHAR(30) NOT NULL,
  hospede_nome TEXT NOT NULL,
  hospede_telefone VARCHAR(40),
  reserva_id TEXT,
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_pecas INTEGER NOT NULL DEFAULT 0,
  valor_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  forma_cobranca VARCHAR(30) NOT NULL DEFAULT 'quarto', -- 'quarto', 'pago_balcao', 'cortesia'
  status VARCHAR(30) NOT NULL DEFAULT 'recebido',       -- 'recebido', 'lavando', 'pronto', 'entregue', 'cancelado'
  observacoes TEXT,
  recebido_por TEXT,
  previsao_entrega TEXT,
  pronto_em TIMESTAMP WITH TIME ZONE,
  entregue_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para performance nos pedidos
CREATE INDEX IF NOT EXISTS idx_lavanderia_pedidos_hotel_id ON public.lavanderia_pedidos(hotel_id);
CREATE INDEX IF NOT EXISTS idx_lavanderia_pedidos_quarto ON public.lavanderia_pedidos(hotel_id, quarto_numero);
CREATE INDEX IF NOT EXISTS idx_lavanderia_pedidos_status ON public.lavanderia_pedidos(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_lavanderia_pedidos_codigo ON public.lavanderia_pedidos(codigo);

-- Habilitar RLS na tabela de pedidos
ALTER TABLE public.lavanderia_pedidos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para lavanderia_pedidos
DROP POLICY IF EXISTS "Leitura de pedidos de lavanderia" ON public.lavanderia_pedidos;
CREATE POLICY "Leitura de pedidos de lavanderia"
  ON public.lavanderia_pedidos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Manipulação de pedidos de lavanderia" ON public.lavanderia_pedidos;
CREATE POLICY "Manipulação de pedidos de lavanderia"
  ON public.lavanderia_pedidos FOR ALL
  USING (true)
  WITH CHECK (true);
