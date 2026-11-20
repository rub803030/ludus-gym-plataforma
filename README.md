# Ludus GYM Platform

Plataforma integral de gestión operativa, financiera y de entrenamiento para **Ludus GYM**.

## Plataformas

| App | Tecnología | Público |
| --- | --- | --- |
| `apps/web` | Next.js App Router + TypeScript + Tailwind | OWNER / MANAGER / STAFF |
| `apps/api` | Node.js + TypeScript + Fastify, arquitectura limpia por dominio | Backend |
| `apps/mobile` | Android nativo (Kotlin + Jetpack Compose) | MEMBER |
| `packages/shared` | Zod + tipos + matriz RBAC | Compartido |

## Estado

**Fase 2 — Hardening y preparación comercial completada.** API, consola web y app Android
funcionales sobre Supabase, con RLS en 25/25 tablas, CSRF, rate limit distribuido,
cifrado de campos médicos, AAB firmado y runbooks de operación.

## Módulos incluidos

Socios y membresías · cobros/caja con idempotencia · control de acceso con QR dinámico
y offline · rutinas y nutrición · clases e inventario · reportes y auditoría ·
gestión de staff · almacenamiento con URLs prefirmadas · notificaciones Socket.io.

## Arranque local

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose -f infra/docker/compose.yaml up -d
pnpm --filter @ludus/api db:generate
pnpm --filter @ludus/api db:migrate
pnpm dev
```

Android: abrir `apps/mobile` con Android Studio y sincronizar Gradle.
Para generar el release firmado sigue `docs/runbooks/android-release.md`.

## Seguridad

La web rechaza credenciales de `MEMBER`. El móvil rechaza credenciales de staff.
El pase QR rota cada 30 s y se firma con HMAC-SHA256. Los cobros son idempotentes.
Las mutaciones web exigen token CSRF; las sesiones usan cookies Secure + HttpOnly +
SameSite=Strict en producción y los campos médicos se cifran con AES-256-GCM.

## Verificación y despliegue

```bash
python scripts/test-api-flows.py     # flujos extremo a extremo
python scripts/verify-all.py         # typecheck + tests + builds
```

- `docs/DEPLOYMENT.md` — arquitectura, variables y checklist de venta.
- `docs/CONFIGURATION.md` — configuración centralizada y URL pública.
- `docs/USER_GUIDE.md` — guía de uso para el gimnasio.
- `docs/runbooks/` — backups, rotación de secretos, incidentes, despliegue y Android.

## Soporte y licenciamiento

El propietario de la instalación es responsable de rotar los secretos de demo antes de
facturar, activar backups automáticos en Supabase y custodiar el keystore de Android.
Los runbooks de `docs/runbooks/` definen los procedimientos de operación y escalado.
