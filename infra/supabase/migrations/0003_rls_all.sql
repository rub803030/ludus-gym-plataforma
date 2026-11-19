-- Defensa en profundidad: RLS en todas las tablas con gym_id.
-- La API usa el rol postgres (bypasses RLS); estas políticas protegen
-- cualquier acceso directo desde PostgREST o roles anon/authenticated.

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'gym_id'
      AND table_name <> 'payments'
      AND table_name <> 'members'
      AND table_name <> 'access_events'
    GROUP BY table_name
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl AND policyname = 'tenant_isolation'
    ) THEN
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON public.%I USING (gym_id = current_setting(''app.gym_id'', true)::uuid)',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- Tablas sin gym_id pero vinculadas por FK: se protegen vía EXISTS.
ALTER TABLE public.member_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_sessions_own ON public.member_sessions
  USING (member_id IN (SELECT id FROM public.members WHERE gym_id = current_setting('app.gym_id', true)::uuid));

ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY refresh_tokens_own ON public.refresh_tokens
  USING (staff_id IN (SELECT id FROM public.staff_users WHERE gym_id = current_setting('app.gym_id', true)::uuid));
