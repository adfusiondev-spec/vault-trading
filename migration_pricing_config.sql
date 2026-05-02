-- Dynamic module pricing configuration (single-row singleton)
CREATE TABLE IF NOT EXISTS public.pricing_config (
  id                    INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  base_price            NUMERIC NOT NULL DEFAULT 300,
  global_indices_addon  NUMERIC NOT NULL DEFAULT 100,
  saudi_indices_addon   NUMERIC NOT NULL DEFAULT 300,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the default row (no-op if already exists)
INSERT INTO public.pricing_config (id, base_price, global_indices_addon, saudi_indices_addon)
VALUES (1, 300, 100, 300)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read (sub-admins need this for subscription cost display)
CREATE POLICY "pricing_config_read" ON public.pricing_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only super_admin can update
CREATE POLICY "pricing_config_super_admin_write" ON public.pricing_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );
