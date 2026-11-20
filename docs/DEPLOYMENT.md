# Despliegue a producción — Ludus GYM

## Arquitectura de despliegue

| Componente | Plataforma recomendada | Notas |
| --- | --- | --- |
| Web | Vercel | URL HTTPS gratuita `*.vercel.app`; root directory `apps/web` |
| API | Fly.io | Dockerfile `infra/docker/Dockerfile.api`, config en `fly.toml` |
| Base de datos | Supabase (ya configurada) | Aplicar migraciones con `pnpm db:migrate` |
| Redis | Upstash | Rate limit distribuido, revocación, idempotencia y Socket.io |
| Almacenamiento | Cloudflare R2 | Presigned URLs, reemplaza MinIO local |
| App Android | Google Play | `./gradlew :app:bundleRelease` |

## Variables de entorno de producción

La web llama a `/api/*` en el mismo origen; Next.js redirige a `API_UPSTREAM_URL`.
Así las cookies siguen siendo del mismo sitio aunque la API esté en Fly.io.
La guía completa está en `docs/CONFIGURATION.md`.

Rotar TODOS los secretos de `.env.example`. Nunca reutilizar los valores de desarrollo:

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `QR_HMAC_SECRET`, `FIELD_ENCRYPTION_KEY`, `CSRF_SECRET`: valores aleatorios de 32+ bytes.
- `DATABASE_URL` / `DIRECT_URL`: cadena de Supabase con contraseña real (usar pooler para `DATABASE_URL` y conexión directa para `DIRECT_URL`).
- `CORS_ORIGIN`: dominio **HTTPS** exacto de la web (URL de Vercel). La API rechaza el arranque si es `localhost` o no usa HTTPS.
- `NODE_ENV=production`.
- `REDIS_URL`: obligatorio y compartido en producción para el rate limit.
- `NEXT_PUBLIC_API_URL`: se deja vacío en Vercel (mismo origen).
- `API_UPSTREAM_URL`: URL HTTPS de la API en Fly.io, configurada solo en Vercel.

## Pasos

1. Aplicar migraciones: `pnpm --filter @ludus/api db:migrate` (incluye `0004_rls_remaining.sql`).
2. Verificar RLS: las 25 tablas `public` deben tener `relrowsecurity = true` y 26 políticas.
3. Crear el primer OWNER:

   ```bash
   node scripts/create-owner.mjs \
     --email owner@tu-gym.com \
     --password 'ContraseñaLarga123!' \
     --name 'Dueño del GYM' \
     --gym-name 'Tu GYM'
   ```

   Para rotar la contraseña de un OWNER existente añade `--force`.
4. Desplegar API y Web.
5. Verificar `/health` y el flujo de login web (el worker debe devolver `csrfToken`).
6. Generar el AAB firmado y subir a Play Console (ver `docs/runbooks/android-release.md`).

## Checklist de seguridad antes de vender

- [x] RLS verificado en Supabase para todas las tablas (25/25).
- [x] Rate limiting con Redis compartido cuando `REDIS_URL` está presente; store local solo en desarrollo.
- [x] CORS restringido al dominio de producción con validación HTTPS.
- [x] Cookies Secure + HttpOnly + SameSite=Strict en producción.
- [x] CSRF enforcement real en mutaciones web (`onRequest` global; móvil usa Bearer).
- [x] QR rotando cada 30 s con `QR_HMAC_SECRET` de producción.
- [x] Campos médicos cifrados (`medicalNotes`, `allergies`, `conditions`).
- [x] Contraseñas iniciales de socios aleatorias y entregadas una sola vez al staff.
- [x] AAB firmado mediante `LUDUS_RELEASE_*` (ver runbook).
- [ ] Secretos rotados y fuera del repositorio (**responsable del cliente** antes de facturar).
- [ ] Backups automáticos de Supabase habilitados (**verificar en consola**).
- [x] Pruebas de RBAC y build en CI en verde.

## Runbooks

- `docs/runbooks/backup-restore.md`
- `docs/runbooks/secret-rotation.md`
- `docs/runbooks/incident-access.md`
- `docs/runbooks/incident-billing.md`
- `docs/runbooks/deploy-rollback.md`
- `docs/runbooks/android-release.md`
