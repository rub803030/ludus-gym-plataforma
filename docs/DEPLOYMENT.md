# Despliegue a producción — Ludus GYM

## Arquitectura de despliegue

| Componente | Plataforma recomendada | Notas |
| --- | --- | --- |
| Web | Vercel | Framework Next.js, root directory `apps/web` |
| API | Fly.io / Railway | Dockerfile `infra/docker/Dockerfile.api` |
| Base de datos | Supabase (ya configurada) | Aplicar migraciones con `pnpm db:migrate` |
| Redis | Upstash | Necesario para refresh revocado, idempotencia y Socket.io |
| Almacenamiento | Cloudflare R2 | Presigned URLs, reemplaza MinIO local |
| App Android | Google Play | `./gradlew :app:bundleRelease` |

## Variables de entorno de producción

Rotar TODOS los secretos de `.env.example`. Nunca reutilizar los valores de desarrollo:

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `QR_HMAC_SECRET`, `FIELD_ENCRYPTION_KEY`, `CSRF_SECRET`: valores aleatorios de 32+ bytes.
- `DATABASE_URL` / `DIRECT_URL`: cadena de Supabase con contraseña real (usar pooler para `DATABASE_URL` y conexión directa para `DIRECT_URL`).
- `CORS_ORIGIN`: dominio exacto de la web, sin comodines.
- `NODE_ENV=production`.

## Pasos

1. Aplicar migraciones: `pnpm --filter @ludus/api db:migrate`.
2. Sembrar datos iniciales: `psql "$DATABASE_URL" -f infra/supabase/seed/0001_initial_seed.sql`.
3. Crear el primer OWNER con el script `scripts/create-owner.mjs` (o el seed demo en development).
4. Desplegar API y Web.
5. Verificar `/health` y el flujo de login web.
6. Generar el AAB de Android y subir a Play Console.

## Checklist de seguridad antes de vender

- [ ] Secretos rotados y fuera del repositorio.
- [ ] RLS verificado en Supabase para todas las tablas sensibles.
- [ ] Rate limiting activo con Redis real.
- [ ] CORS restringido al dominio de producción.
- [ ] Cookies Secure + HttpOnly + SameSite=Strict en producción.
- [ ] QR rotando cada 30 s con `QR_HMAC_SECRET` de producción.
- [ ] Campos médicos cifrados con clave de producción.
- [ ] Backups automáticos de Supabase habilitados.
- [ ] Pruebas de RBAC en CI en verde.
