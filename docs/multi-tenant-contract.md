# Contrato de migración multi-tenant — Ludus GYM

Este documento es la entrega de la **Fase 1, punto 1**: esquema SQL completo y contrato JSON de los endpoints nuevos. Se versiona antes de los cambios de código. Los secretos solo se referencian por nombre de variable.

## 1. Esquema SQL de la migración

Archivo: `infra/supabase/migrations/0006_multi_tenant.sql`. Se aplica con `python scripts/apply-all-migrations.py` (usa `DIRECT_URL` para DDL). Es idempotente y conserva los datos demo.

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gym_status') THEN
    CREATE TYPE public.gym_status AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED');
  END IF;
END $$;

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

UPDATE public.gyms
SET status = 'ACTIVE', public_code = COALESCE(public_code, 'LUDUS-0001')
WHERE id = '00000000-0000-7000-8000-000000000001';

UPDATE public.gyms
SET status = 'ACTIVE',
    public_code = COALESCE(public_code, 'LUDUS-' || upper(substr(replace(id::text, '-', ''), 1, 4)))
WHERE status = 'PENDING_VERIFICATION' AND verification_token_hash IS NULL;

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

ALTER TABLE public.members
  ALTER COLUMN gym_id DROP NOT NULL,
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN document_number DROP NOT NULL,
  ALTER COLUMN birth_date DROP NOT NULL;

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

INSERT INTO public.gym_memberships (gym_id, member_id, joined_at)
SELECT gym_id, id, joined_at
FROM public.members
WHERE gym_id IS NOT NULL
ON CONFLICT (gym_id, member_id) DO NOTHING;
```

Las tablas operativas ya tenían `gym_id` y RLS `tenant_isolation` desde `0001`–`0005`; no se duplica esa columna. La identidad del socio pasa a ser global: un correo solo existe una vez, y la pertenencia a varios gimnasios se resuelve en `gym_memberships`.

## 2. Contrato JSON de endpoints nuevos

Formato de error global (sin cambios): `{ "error": { "code": "...", "message": "...", "details": {...} } }`.

### `POST /api/gyms/register` — público

```json
{
  "gymName": "GYM Norte",
  "slug": "gym-norte",
  "ownerName": "Ana López",
  "email": "ana@example.com",
  "password": "ClaveSegura2026!",
  "timezone": "America/Mexico_City",
  "capacity": 40,
  "currency": "MXN",
  "address": "Calle 1",
  "phone": "5512345678",
  "openingHours": "Lun–Vie 06:00–22:00"
}
```

```json
{
  "gym": { "id": "uuid", "name": "GYM Norte", "slug": "gym-norte", "status": "PENDING_VERIFICATION" },
  "owner": { "email": "ana@example.com", "fullName": "Ana López" },
  "verification": {
    "email": "ana@example.com",
    "expiresAt": "2026-11-25T18:00:00.000Z",
    "devToken": "solo fuera de producción",
    "devLink": "solo fuera de producción"
  }
}
```

Errores: `VALIDATION_ERROR` 400, `CONFLICT` 409 (slug ocupado).

### `POST /api/gyms/verify` — público

```json
{ "token": "token-de-32-bytes-en-base64url" }
```

```json
{
  "ok": true,
  "gym": {
    "id": "uuid",
    "name": "GYM Norte",
    "status": "ACTIVE",
    "publicCode": "LUDUS-A7K2",
    "enrollmentQrToken": "base64url(...firmado HMAC...)"
  }
}
```

Errores: `VERIFICATION_TOKEN_INVALID` 400, `VERIFICATION_TOKEN_EXPIRED` 410.

### `GET /api/gyms/me` y `PATCH /api/gyms/me` — staff autenticado

```json
{
  "id": "uuid", "name": "GYM Norte", "slug": "gym-norte", "status": "ACTIVE",
  "publicCode": "LUDUS-A7K2", "enrollmentQrToken": "base64url(...)",
  "timezone": "America/Mexico_City", "capacity": 40, "currency": "MXN",
  "address": "Calle 1", "phone": "5512345678", "openingHours": "Lun–Vie 06:00–22:00",
  "logoUrl": null
}
```

`PATCH` acepta cualquiera de: `name`, `address`, `phone`, `openingHours`, `logoUrl`, `timezone`, `capacity`, `currency`. Devuelve el mismo objeto. Errores: `VALIDATION_ERROR` 400, `NO_GYM` / `GYM_NOT_ACTIVE` 403.

### `POST /api/members/register` — público

```json
{
  "firstName": "Luis",
  "lastName": "Pérez",
  "email": "luis@example.com",
  "password": "ClaveSegura2026!",
  "phone": "5512345678",
  "documentNumber": "ABC123456",
  "birthDate": "1995-04-10"
}
```

```json
{
  "member": { "id": "uuid", "code": "LUD-000123", "email": "luis@example.com" },
  "verification": { "email": "luis@example.com", "expiresAt": "...", "devToken": "...", "devLink": "..." }
}
```

Errores: `VALIDATION_ERROR` 400, `CONFLICT` 409 (correo ya registrado). El socio queda sin gimnasio.

### `POST /api/members/join-gym` — socio autenticado (sin contexto de gimnasio)

```json
{ "code": "LUDUS-A7K2" }
```

También acepta `code` con el QR estático completo (base64url firmado).

```json
{
  "gym": { "id": "uuid", "name": "GYM Norte", "publicCode": "LUDUS-A7K2", "status": "ACTIVE" },
  "activeGymId": "uuid",
  "alreadyMember": false,
  "tokens": { "accessToken": "nuevo JWT con activeGymId", "refreshToken": "nuevo refresh" }
}
```

La app debe guardar `tokens` inmediatamente: sin ello el JWT anterior todavía no trae el gimnasio recién vinculado. Errores: `VALIDATION_ERROR` 400, `NOT_FOUND` 404 (código desconocido), `GYM_NOT_ACTIVE` 403, `CONFLICT` 409 (membresía suspendida).

### `POST /api/members/switch-gym` — socio autenticado

```json
{ "gymId": "uuid" }
```

```json
{
  "gym": { "id": "uuid", "name": "GYM Norte", "publicCode": "LUDUS-A7K2" },
  "activeGymId": "uuid",
  "tokens": { "accessToken": "...", "refreshToken": "..." }
}
```

Solo permite gimnasios donde el socio tenga membresía activa. Errores: `NO_GYM` 403, `VALIDATION_ERROR` 400.

### `GET /api/members/my-gyms` — socio autenticado

```json
{
  "activeGymId": "uuid|null",
  "gyms": [
    { "id": "uuid", "name": "GYM Norte", "publicCode": "LUDUS-A7K2",
      "status": "ACTIVE", "isActive": true, "joinedAt": "2026-11-25T12:00:00.000Z" }
  ]
}
```

`activeGymId` se resuelve de las membresías activas, no solo del JWT, para que un token emitido antes de vincularse siga siendo válido.

### `POST /api/access/qr-token` — socio autenticado

```json
{ "gymId": "uuid" }
```

```json
{
  "token": "base64url(...)",
  "bucket": 123456,
  "expiresAt": "2026-11-25T12:00:30.000Z",
  "offlineCredential": "base64url(...)",
  "gymId": "uuid"
}
```

Sin `gymId` en el body se usa el gimnasio activo del token; si no hay ninguno → `NO_GYM` 403. Ambos tokens incluyen `gymId` dentro del payload firmado HMAC-SHA256.

### `POST /api/access/verify-qr` — staff autenticado

Sin cambios en la petición. La respuesta de rechazo por tenant cruzado es:

```json
{ "error": { "code": "CROSS_GYM_PASS", "message": "Este pase pertenece a otro gimnasio" } }
```

HTTP 403. Se firma y valida `gymId` en el pase; un `gymId` distinto al del lector se rechaza antes de any consulta de socio.

### Cambios de contrato en endpoints existentes

- `GET /api/plans`, `POST /api/plans`, `PATCH /api/plans/:id`, `DELETE /api/plans/:id`: filtrados por `gym_id` del JWT; el `PATCH` valida propiedad del plan antes de actualizar. Aceptan `flags` y `active` además de `includesClasses`/`includesNutrition`, y devuelven ambos.
- `Principal` (en `/api/auth/*`, `/api/auth/me`): añade `activeGymId: string | null`.
- `TokenClaims` (JWT): añade `activeGymId`.

Nota: los campos `devToken`/`devLink` solo aparecen fuera de producción; en producción el correo es el único canal.
