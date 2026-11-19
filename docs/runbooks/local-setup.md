# Runbook — Arranque local

1. Copiar `.env.example` a `.env` y rellenar secretos con valores aleatorios reales.
2. `docker compose -f infra/docker/compose.yaml up -d`.
3. `pnpm install && pnpm db:generate && pnpm db:migrate`.
4. `pnpm dev`.
5. Android Studio: File > Open > `apps/mobile`.

Nunca subir `.env` ni `local.properties`.
