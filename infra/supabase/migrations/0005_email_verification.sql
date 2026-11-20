-- Verificación obligatoria de correo para STAFF y SOCIOS.
-- Patrón idempotente de 0002_member_auth.sql.

ALTER TABLE public.staff_users
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_token_hash text,
  ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_sent_at timestamptz;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_token_hash text,
  ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_sent_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS ux_staff_verification_token
  ON public.staff_users (verification_token_hash)
  WHERE verification_token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_member_verification_token
  ON public.members (verification_token_hash)
  WHERE verification_token_hash IS NOT NULL;

-- Correos de prueba reales (variantes + del propietario de Resend).
UPDATE public.staff_users SET email = 'rubnlira2+owner@gmail.com', email_verified = false, verification_token_hash = NULL, verification_expires_at = NULL
  WHERE id = '00000000-0000-7000-8000-000000000101';
UPDATE public.staff_users SET email = 'rubnlira2+manager@gmail.com', email_verified = false, verification_token_hash = NULL, verification_expires_at = NULL
  WHERE id = '00000000-0000-7000-8000-000000000102';
UPDATE public.staff_users SET email = 'rubnlira2+staff@gmail.com', email_verified = false, verification_token_hash = NULL, verification_expires_at = NULL
  WHERE id = '00000000-0000-7000-8000-000000000103';
UPDATE public.members SET email = 'rubnlira2+socio@gmail.com', email_verified = false, verification_token_hash = NULL, verification_expires_at = NULL
  WHERE id = '00000000-0000-7000-8000-000000000201';
