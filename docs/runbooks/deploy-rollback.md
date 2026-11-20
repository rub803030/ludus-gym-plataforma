# Runbook — Despliegue y rollback

## Despliegue normal

1. Verificar que CI esté en verde en `master` (typecheck, lint, tests, build, RBAC).
2. Crear tag `vX.Y.Z` → el workflow `release.yaml` publica la imagen en GHCR y el AAB firmado.
3. Aplicar migraciones SQL con `python scripts/apply-all-migrations.py` (usa `DIRECT_URL`; incluye `0005_email_verification.sql`).
4. Configurar en Fly `RESEND_API_KEY`, `EMAIL_FROM`, `WEB_APP_URL`, `EMAIL_VERIFICATION_TTL_MINUTES` y `RESEND_TEST_RECIPIENT` (este último solo mientras se usen cuentas demo).
5. Desplegar API (`fly deploy`) y Web (deploy automático de Vercel al hacer push).
6. Comprobar `/health`, login web, login móvil, verificación de correo y un cobro de prueba.

## Rollback de aplicación

1. En el proveedor de hosting, volver al deploy anterior (Vercel: **Promote**; Fly/Railway: redeploy del release anterior).
2. No revertir migraciones de base de datos: las migraciones son forward-only.

## Rollback de base de datos

1. Restaurar el backup previo siguiendo `backup-restore.md` en un proyecto nuevo.
2. Actualizar `DATABASE_URL`/`DIRECT_URL` y reiniciar la API.
3. Verificar 25 tablas, RLS activo y login OWNER.

## Señales de alerta para rollback

- `/health` distinto de 200.
- Tasa de errores 5xx > 1 % sostenida 5 minutos.
- Fallos de login o de cobro idempotente.
- Pérdida de eventos de acceso.

## Registro

Anotar versión desplegada, hora, responsable y resultado de la verificación.
