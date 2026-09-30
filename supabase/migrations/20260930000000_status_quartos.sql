-- ================================================================
-- Migration: Status dos Quartos (Gestão Administrativa SaaS)
-- Data: 2026-09-30
-- Modo: 100% Idempotente e Seguro (pode executar várias vezes)
-- ================================================================

-- 1. Habilitar extensões necessárias para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Criação da tabela status_quartos
CREATE TABLE IF NOT EXISTS public.status_quartos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    icone TEXT NOT NULL DEFAULT 'bed',
    cor_fundo TEXT NOT NULL DEFAULT '#ECFDF5',
    cor_texto TEXT NOT NULL DEFAULT '#065F46',
    cor_borda TEXT NOT NULL DEFAULT '#A7F3D0',
    permite_ocupacao BOOLEAN NOT NULL DEFAULT true,
    padrao_sistema BOOLEAN NOT NULL DEFAULT false,
    notifica_camareira BOOLEAN NOT NULL DEFAULT false,
    exige_motivo BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    ordem INTEGER NOT NULL DEFAULT 1,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Adicionar colunas caso a tabela já tenha sido criada anteriormente
ALTER TABLE public.status_quartos ADD COLUMN IF NOT EXISTS notifica_camareira BOOLEAN DEFAULT false;
ALTER TABLE public.status_quartos ADD COLUMN IF NOT EXISTS exige_motivo BOOLEAN DEFAULT false;

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_status_quartos_status ON public.status_quartos(status);
CREATE INDEX IF NOT EXISTS idx_status_quartos_ordem ON public.status_quartos(ordem);
CREATE INDEX IF NOT EXISTS idx_status_quartos_slug ON public.status_quartos(slug);

-- 5. Habilita RLS (Row Level Security)
ALTER TABLE public.status_quartos ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de Acesso (com verificação segura de existência de tabela)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'status_quartos'
    ) THEN
        DROP POLICY IF EXISTS "Leitura pública de status_quartos" ON public.status_quartos;
        CREATE POLICY "Leitura pública de status_quartos"
            ON public.status_quartos
            FOR SELECT
            USING (true);

        DROP POLICY IF EXISTS "Inserção de status_quartos" ON public.status_quartos;
        CREATE POLICY "Inserção de status_quartos"
            ON public.status_quartos
            FOR INSERT
            WITH CHECK (true);

        DROP POLICY IF EXISTS "Atualização de status_quartos" ON public.status_quartos;
        CREATE POLICY "Atualização de status_quartos"
            ON public.status_quartos
            FOR UPDATE
            USING (true)
            WITH CHECK (true);

        DROP POLICY IF EXISTS "Exclusão de status_quartos" ON public.status_quartos;
        CREATE POLICY "Exclusão de status_quartos"
            ON public.status_quartos
            FOR DELETE
            USING (true);
    END IF;
END $$;

-- 7. Trigger para atualizar 'atualizado_em' automaticamente
CREATE OR REPLACE FUNCTION public.set_atualizado_em_status_quartos()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'status_quartos'
    ) THEN
        DROP TRIGGER IF EXISTS trg_status_quartos_atualizado ON public.status_quartos;
        CREATE TRIGGER trg_status_quartos_atualizado
        BEFORE UPDATE ON public.status_quartos
        FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em_status_quartos();
    END IF;
END $$;

-- 8. Habilitar Realtime para sincronização instantânea com o Mapa dos Hotéis
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'status_quartos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.status_quartos;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 9. Seed inicial com os status essenciais do Hotel no Zap e suas regras
INSERT INTO public.status_quartos (slug, nome, descricao, icone, cor_fundo, cor_texto, cor_borda, permite_ocupacao, padrao_sistema, notifica_camareira, exige_motivo, status, ordem)
VALUES
    ('livre', 'Livre / Disponível', 'Quarto pronto, limpo e liberado para hospedagem ou nova reserva.', 'check_circle', '#ECFDF5', '#065F46', '#A7F3D0', true, true, false, false, 'ativo', 1),
    ('ocupado', 'Ocupado', 'Quarto com hóspede ativo e estadia em andamento.', 'lock', '#FEF2F2', '#991B1B', '#FECDD3', false, true, false, false, 'ativo', 2),
    ('limpeza', 'Em Limpeza', 'Quarto aguardando ou em processo de higienização pela equipe de governança.', 'cleaning_services', '#FFFBEB', '#92400E', '#FDE68A', false, true, true, false, 'ativo', 3),
    ('manutencao', 'Em Manutenção', 'Quarto temporariamente fora de serviço para reparos ou vistoria técnica.', 'build', '#EFF6FF', '#1E40AF', '#BFDBFE', false, true, false, true, 'ativo', 4),
    ('reservado', 'Reservado', 'Quarto bloqueado para reserva confirmada com check-in previsto.', 'bookmark', '#F5F3FF', '#5B21B6', '#DDD6FE', false, false, false, false, 'ativo', 5),
    ('interditado', 'Interditado', 'Quarto bloqueado administrativamente por período indeterminado.', 'block', '#F3F4F6', '#374151', '#E5E7EB', false, false, false, true, 'ativo', 6)
ON CONFLICT (slug) DO UPDATE SET
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    icone = EXCLUDED.icone,
    cor_fundo = EXCLUDED.cor_fundo,
    cor_texto = EXCLUDED.cor_texto,
    cor_borda = EXCLUDED.cor_borda,
    permite_ocupacao = EXCLUDED.permite_ocupacao,
    padrao_sistema = EXCLUDED.padrao_sistema,
    notifica_camareira = EXCLUDED.notifica_camareira,
    exige_motivo = EXCLUDED.exige_motivo,
    status = EXCLUDED.status,
    ordem = EXCLUDED.ordem;
