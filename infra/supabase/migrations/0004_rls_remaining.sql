-- Cierra la brecha de RLS: tablas sin gym_id propio se protegen por FK.
-- Las políticas usan USING para lectura/escritura y WITH CHECK para INSERT.

CREATE OR REPLACE FUNCTION public.current_gym_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$ SELECT NULLIF(current_setting('app.gym_id', true), '')::uuid $$;

-- 1) Tabla raíz: el gimnasio solo ve su propia fila.
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.gyms;
CREATE POLICY tenant_isolation ON public.gyms
  USING (id = public.current_gym_id())
  WITH CHECK (id = public.current_gym_id());

-- 2) Tablas vinculadas por FK a una tabla con gym_id.
DO $$
DECLARE
  spec record;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('cash_movements', 'cash_sessions', 'cash_session_id', 'id'),
      ('memberships',    'members',        'member_id',       'id'),
      ('class_bookings', 'classes',        'class_id',        'id'),
      ('meals',          'nutrition_plans','plan_id',         'id'),
      ('routine_exercises','routines',     'routine_id',      'id'),
      ('workout_logs',   'members',        'member_id',       'id')
    ) AS v(child, parent, child_col, parent_col)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', spec.child);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', spec.child);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I USING ( EXISTS ('
      'SELECT 1 FROM public.%I p WHERE p.%I = %I.%I AND p.gym_id = public.current_gym_id()'
      ')) WITH CHECK ( EXISTS ('
      'SELECT 1 FROM public.%I p WHERE p.%I = %I.%I AND p.gym_id = public.current_gym_id()'
      '))',
      spec.child,
      spec.parent, spec.parent_col, spec.child, spec.child_col,
      spec.parent, spec.parent_col, spec.child, spec.child_col
    );
  END LOOP;
END $$;

-- 3) Añade WITH CHECK a las policies directas creadas en 0003.
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'gym_id'
      AND table_name NOT IN ('payments', 'members', 'access_events')
    GROUP BY table_name
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I USING (gym_id = public.current_gym_id()) '
      'WITH CHECK (gym_id = public.current_gym_id())',
      tbl
    );
  END LOOP;
END $$;

-- 4) Particiones de auditoría: heredan la política del padre en PG 12+,
--    pero las habilitamos explícitamente para evitar descuidos.
DO $$
DECLARE
  part record;
BEGIN
  FOR part IN
    SELECT c.relname
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_class p ON p.oid = i.inhparent
    JOIN pg_namespace n ON n.oid = p.relnamespace
    WHERE n.nspname = 'public' AND p.relname = 'audit_logs'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', part.relname);
  END LOOP;
END $$;
