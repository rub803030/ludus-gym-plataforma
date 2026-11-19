-- Autenticación de socios: hash de contraseña scrypt.
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS password_hash text;
CREATE INDEX IF NOT EXISTS idx_members_password ON public.members (id) WHERE password_hash IS NOT NULL;
