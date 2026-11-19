# Ludus GYM Platform

Plataforma integral de gestión operativa, financiera y de entrenamiento para **Ludus GYM**.

## Plataformas

| App | Tecnología | Público |
| --- | --- | --- |
| `apps/web` | Next.js App Router + TypeScript + Tailwind | OWNER / MANAGER / STAFF |
| `apps/api` | Node.js + TypeScript + Fastify, arquitectura limpia por dominio | Backend |
| `apps/mobile` | Android nativo (Kotlin + Jetpack Compose) | MEMBER |
| `packages/shared` | Zod + tipos + matriz RBAC | Compartido |

## Fase actual

**Fase 1 — Estructura y contratos.** La implementación de cada módulo se ejecuta por fases subsecuentes.

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

## Seguridad

La web rechaza credenciales de `MEMBER`. El móvil rechaza credenciales de staff.
El pase QR rota cada 30 s y se firma con HMAC-SHA256. Los cobros son idempotentes.
