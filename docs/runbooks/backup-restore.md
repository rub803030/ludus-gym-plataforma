# Runbook — Backups y restauración (Supabase)

## Verificación inicial (una vez por instalación)

1. Entrar a Supabase Dashboard → **Project Settings → Database → Backups**.
2. Confirmar que los backups automáticos están activos (plan Pro o superior).
3. Configurar retención mínima de 7 días (recomendado 30).
4. Documentar el correo de alertas del proyecto.

## Backup manual antes de un cambio sensible

```bash
# Requiere SUPABASE_DB_PASSWORD y el CLI de Supabase vinculado al proyecto
supabase db dump --db-url "$DIRECT_URL" -f backup-$(Get-Date -Format yyyyMMdd).sql
```

Guardar el archivo fuera del repositorio, en almacenamiento cifrado. No subirlo a Git.

## Restauración

1. Avisar a los clientes y poner la API en modo mantenimiento.
2. Crear un **nuevo** proyecto Supabase o un branch de base de datos (nunca restaurar sobre producción sin copia previa).
3. Aplicar migraciones: `pnpm --filter @ludus/api db:migrate`.
4. Cargar el dump con `psql "$DIRECT_URL" -f backup.sql`.
5. Verificar: 25 tablas, RLS activo, login OWNER y un cobro de prueba.
6. Actualizar `DATABASE_URL`/`DIRECT_URL` y reiniciar API.

## Prueba de restauración

Hacer una prueba completa al menos una vez por trimestre y registrar fecha, responsable y resultado.
