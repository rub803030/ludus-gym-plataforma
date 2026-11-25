-- Evolución multi-tenant de Ludus GYM.
-- Idempotente: puede reaplicarse con scripts/apply-all-migrations.py.
-- Compatible con los datos demo existentes: los socios actuales se vinculan
-- automáticamente a su gimnasio mediante gym_memberships.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gym_status') THEN
    CREATE TYPE public.gym_status AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Perfil, estado y credencial de afiliación por gimnasio
-- ---------------------------------------------------------------------------
ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS status public.gym_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
  ADD COLUMN IF NOT EXISTS public_code text,
  ADD COLUMN IF NOT EXISTS enrollment_qr_token text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS opening_hours text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS verification_token_hash text,
  ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_sent_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS ux_gyms_public_code
  ON public.gyms (public_code) WHERE public_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_gyms_verification_token
  ON public.gyms (verification_token_hash) WHERE verification_token_hash IS NOT NULL;

-- El gimnasio demo ya estaba operativo antes de esta migración.
UPDATE public.gyms
SET status = 'ACTIVE',
    public_code = COALESCE(public_code, 'LUDUS-0001')
WHERE id = '00000000-0000-7000-8000-000000000001';

-- Cualquier gimnasio creado antes de este cambio no tenía flujo de verificación.
UPDATE public.gyms
SET status = 'ACTIVE',
    public_code = COALESCE(public_code, 'LUDUS-' || upper(substr(replace(id::text, '-', ''), 1, 4)))
WHERE status = 'PENDING_VERIFICATION' AND verification_token_hash IS NULL;

-- ---------------------------------------------------------------------------
-- 2) Tabla intermedia socio <-> gimnasio
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gym_memberships (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  gym_id uuid NOT NULL REFERENCES public.gyms (id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT uq_gym_membership UNIQUE (gym_id, member_id)
);

CREATE INDEX IF NOT EXISTS ix_gym_memberships_member
  ON public.gym_memberships (member_id, is_active) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_gym_memberships_gym
  ON public.gym_memberships (gym_id, is_active) WHERE deleted_at IS NULL;

ALTER TABLE public.gym_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.gym_memberships;
CREATE POLICY tenant_isolation ON public.gym_memberships
  USING (gym_id = public.current_gym_id())
  WITH CHECK (gym_id = public.current_gym_id());

-- ---------------------------------------------------------------------------
-- 3) Socios globales: un socio puede existir sin gimnasio y unirse después
-- ---------------------------------------------------------------------------
ALTER TABLE public.members
  ALTER COLUMN gym_id DROP NOT NULL,
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN document_number DROP NOT NULL,
  ALTER COLUMN birth_date DROP NOT NULL;

-- La identidad del socio es global: un mismo correo no se duplica entre gyms.
DO $$
DECLARE
  constraint_name record;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.members'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%email%'
  LOOP
    EXECUTE format('ALTER TABLE public.members DROP CONSTRAINT %I', constraint_name.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_members_email_global
  ON public.members (email) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_members_code_global
  ON public.members (code) WHERE deleted_at IS NULL;

-- Backfill: los socios existentes conservan su gimnasio y su membresía.
INSERT INTO public.gym_memberships (gym_id, member_id, joined_at)
SELECT gym_id, id, joined_at
FROM public.members
WHERE gym_id IS NOT NULL
ON CONFLICT (gym_id, member_id) DO NOTHING;
