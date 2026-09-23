DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quartos' AND column_name = 'items'
  ) THEN
    ALTER TABLE public.quartos ADD COLUMN items JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quartos' AND column_name = 'foto_capa'
  ) THEN
    ALTER TABLE public.quartos ADD COLUMN foto_capa TEXT;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quartos' AND column_name = 'fotos'
  ) THEN
    ALTER TABLE public.quartos ADD COLUMN fotos JSONB DEFAULT '[]'::jsonb;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quartos' AND column_name = 'beds'
  ) THEN
    ALTER TABLE public.quartos ADD COLUMN beds INTEGER DEFAULT 1;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quartos' AND column_name = 'active'
  ) THEN
    ALTER TABLE public.quartos ADD COLUMN active BOOLEAN DEFAULT true;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;
