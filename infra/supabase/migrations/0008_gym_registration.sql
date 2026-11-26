-- Alta de gimnasio desde las apps y aprobación por un administrador global.
-- Idempotente: puede reaplicarse con scripts/apply-all-migrations.py.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'staff_role' AND e.enumlabel = 'ADMIN'
  ) THEN
    ALTER TYPE public.staff_role ADD VALUE 'ADMIN';
  END IF;
END $$;

ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS legal_representative text,
  ADD COLUMN IF NOT EXISTS rfc text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS social_media text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS branch_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approval_token_hash text,
  ADD COLUMN IF NOT EXISTS approval_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS ux_gyms_approval_token
  ON public.gyms (approval_token_hash) WHERE approval_token_hash IS NOT NULL;
