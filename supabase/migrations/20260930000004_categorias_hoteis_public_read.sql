-- ================================================================
-- Migration: Permissões de Leitura Pública e Categorias de Hotéis
-- Data: 2026-09-30
-- Descrição: Concede privilégios SELECT para anon e authenticated na
--            tabela categorias_hoteis e cadastra as 8 categorias oficiais.
-- Modo: Idempotente (pode executar várias vezes com segurança)
-- ================================================================

-- 1. Criação da tabela categorias_hoteis caso não exista
CREATE TABLE IF NOT EXISTS public.categorias_hoteis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT DEFAULT '',
    icone TEXT NOT NULL DEFAULT 'domain',
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    ordem INTEGER NOT NULL DEFAULT 1,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_categorias_hoteis_status ON public.categorias_hoteis(status);
CREATE INDEX IF NOT EXISTS idx_categorias_hoteis_ordem ON public.categorias_hoteis(ordem);

-- 3. Habilita Row Level Security (RLS)
ALTER TABLE public.categorias_hoteis ENABLE ROW LEVEL SECURITY;

-- 4. CRÍTICO: Concessão de Permissões PostgreSQL (Evita erro 42501 permission denied)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.categorias_hoteis TO postgres, service_role;
GRANT SELECT ON TABLE public.categorias_hoteis TO anon, authenticated;
GRANT ALL ON TABLE public.categorias_hoteis TO authenticated;

-- 5. Políticas de Acesso RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Leitura pública de categorias_hoteis" ON public.categorias_hoteis;
    CREATE POLICY "Leitura pública de categorias_hoteis"
        ON public.categorias_hoteis
        FOR SELECT
        TO public
        USING (true);

    DROP POLICY IF EXISTS "Inserção de categorias_hoteis" ON public.categorias_hoteis;
    CREATE POLICY "Inserção de categorias_hoteis"
        ON public.categorias_hoteis
        FOR INSERT
        TO public
        WITH CHECK (true);

    DROP POLICY IF EXISTS "Atualização de categorias_hoteis" ON public.categorias_hoteis;
    CREATE POLICY "Atualização de categorias_hoteis"
        ON public.categorias_hoteis
        FOR UPDATE
        TO public
        USING (true)
        WITH CHECK (true);

    DROP POLICY IF EXISTS "Exclusão de categorias_hoteis" ON public.categorias_hoteis;
    CREATE POLICY "Exclusão de categorias_hoteis"
        ON public.categorias_hoteis
        FOR DELETE
        TO public
        USING (true);
END $$;

-- 6. Trigger para atualizar 'atualizado_em' automaticamente
CREATE OR REPLACE FUNCTION public.set_atualizado_em_categorias_hoteis()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_categorias_hoteis_atualizado ON public.categorias_hoteis;
CREATE TRIGGER trg_categorias_hoteis_atualizado
BEFORE UPDATE ON public.categorias_hoteis
FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em_categorias_hoteis();

-- 7. Inserção / Atualização das 8 categorias oficiais do Hotel no Zap
INSERT INTO public.categorias_hoteis (nome, descricao, icone, status, ordem)
VALUES
    ('Resort', 'Complexos turísticos com ampla estrutura de lazer, gastronomia inclusa e entretenimento.', 'beach_access', 'ativo', 1),
    ('Hotel Urbano', 'Hotéis localizados em centros comerciais, ideais para viagens corporativas e negócios.', 'apartment', 'ativo', 2),
    ('Pousada', 'Hospedagens aconchegantes com atendimento exclusivo, decoração refinada e ambiente intimista.', 'villa', 'ativo', 3),
    ('Chalés & Eco Village', 'Acomodações integradas à natureza, estilo rústico ou sustentável em áreas de serra e praia.', 'cabin', 'ativo', 4),
    ('Flat / Apart-hotel', 'Unidades residenciais com serviços de hotelaria e cozinha própria para estadias flexíveis.', 'holiday_village', 'ativo', 5),
    ('Hotel Fazenda & Ecoturismo', 'Estruturas rurais com passeios a cavalo, contato com animais e turismo de aventura.', 'forest', 'ativo', 6),
    ('Hostel / Albergue Turístico', 'Hospedagens comunitárias e compartilhadas, com ambiente jovem e econômico.', 'bed', 'ativo', 7),
    ('Hotel Boutique / Charme', 'Hotéis exclusivos de pequeno ou médio porte com design personalizado e atendimento diferenciado.', 'diamond', 'ativo', 8)
ON CONFLICT (nome) DO UPDATE SET
    descricao = EXCLUDED.descricao,
    icone = EXCLUDED.icone,
    status = EXCLUDED.status,
    ordem = EXCLUDED.ordem;

-- 8. Adiciona à publicação realtime para sincronização em tempo real entre abas
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.categorias_hoteis;
EXCEPTION
    WHEN others THEN NULL;
END $$;
