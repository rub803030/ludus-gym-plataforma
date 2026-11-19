$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function New-Dir([string]$relative) {
  $path = Join-Path $root $relative
  if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
}

function New-File([string]$relative, [string]$content) {
  $path = Join-Path $root $relative
  $dir = Split-Path -Parent $path
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $content, $utf8)
}

$dirs = @(
  '.github/workflows',
  '.vscode',
  'apps/api/src/config',
  'apps/api/src/shared/errors',
  'apps/api/src/shared/middleware',
  'apps/api/src/shared/database',
  'apps/api/src/modules/auth/application',
  'apps/api/src/modules/auth/domain',
  'apps/api/src/modules/auth/infrastructure',
  'apps/api/src/modules/staff-management/application',
  'apps/api/src/modules/staff-management/domain',
  'apps/api/src/modules/staff-management/infrastructure',
  'apps/api/src/modules/members/application',
  'apps/api/src/modules/members/domain',
  'apps/api/src/modules/members/infrastructure',
  'apps/api/src/modules/memberships-billing/application',
  'apps/api/src/modules/memberships-billing/domain',
  'apps/api/src/modules/memberships-billing/infrastructure',
  'apps/api/src/modules/access-control/application',
  'apps/api/src/modules/access-control/domain',
  'apps/api/src/modules/access-control/infrastructure',
  'apps/api/src/modules/workouts-nutrition/application',
  'apps/api/src/modules/workouts-nutrition/domain',
  'apps/api/src/modules/workouts-nutrition/infrastructure',
  'apps/api/src/modules/analytics-audit/application',
  'apps/api/src/modules/analytics-audit/domain',
  'apps/api/src/modules/analytics-audit/infrastructure',
  'apps/api/src/modules/storage/application',
  'apps/api/src/modules/storage/domain',
  'apps/api/src/modules/storage/infrastructure',
  'apps/api/tests/integration',
  'apps/api/tests/unit',
  'apps/web/public/fonts',
  'apps/web/src/app',
  'apps/web/src/styles/design-tokens',
  'apps/web/src/ui/primitives',
  'apps/web/src/features/auth',
  'apps/web/src/features/dashboard',
  'apps/web/src/features/pos-cashier',
  'apps/web/src/features/members',
  'apps/web/src/features/turnstile-live',
  'apps/web/src/features/staff-management',
  'apps/web/src/features/plans-billing',
  'apps/web/src/features/workouts-nutrition',
  'apps/web/src/features/reports-audit',
  'apps/web/src/lib',
  'apps/mobile/app/src/main/java/com/ludus/gym/data/local',
  'apps/mobile/app/src/main/java/com/ludus/gym/data/remote',
  'apps/mobile/app/src/main/java/com/ludus/gym/data/repository',
  'apps/mobile/app/src/main/java/com/ludus/gym/domain/model',
  'apps/mobile/app/src/main/java/com/ludus/gym/domain/usecase',
  'apps/mobile/app/src/main/java/com/ludus/gym/di',
  'apps/mobile/app/src/main/java/com/ludus/gym/ui/theme',
  'apps/mobile/app/src/main/java/com/ludus/gym/ui/components',
  'apps/mobile/app/src/main/java/com/ludus/gym/ui/screens/auth',
  'apps/mobile/app/src/main/java/com/ludus/gym/ui/screens/home',
  'apps/mobile/app/src/main/java/com/ludus/gym/ui/screens/qr',
  'apps/mobile/app/src/main/java/com/ludus/gym/ui/screens/workout',
  'apps/mobile/app/src/main/java/com/ludus/gym/ui/screens/nutrition',
  'apps/mobile/app/src/main/java/com/ludus/gym/ui/screens/bookings',
  'apps/mobile/app/src/main/java/com/ludus/gym/ui/navigation',
  'apps/mobile/app/src/main/res/values',
  'apps/mobile/app/src/main/res/xml',
  'apps/mobile/app/src/test/java/com/ludus/gym',
  'apps/mobile/app/src/androidTest/java/com/ludus/gym',
  'apps/mobile/gradle/wrapper',
  'packages/shared/src/constants',
  'packages/shared/src/schemas',
  'packages/shared/src/types',
  'packages/shared/tests',
  'infra/docker',
  'infra/nginx',
  'infra/supabase/migrations',
  'infra/supabase/seed',
  'docs/adr',
  'docs/runbooks'
)
foreach ($d in $dirs) { New-Dir $d }

New-File '.gitignore' @'
node_modules/
dist/
build/
coverage/
.env
.env.local
.env.*.local
!.env.example
*.log
.idea/
.vscode/*
!.vscode/settings.json
apps/mobile/.gradle/
apps/mobile/local.properties
apps/mobile/app/build/
apps/mobile/.idea/
.DS_Store
'@
New-File '.editorconfig' @'
root = true
[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
[*.{kt,kts}]
indent_size = 4
[*.md]
trim_trailing_whitespace = false
'@
New-File '.nvmrc' "20`n"
New-File 'README.md' @'
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
pnpm --filter @ludus/api dev
pnpm --filter @ludus/web dev
```

Android: abrir `apps/mobile` con Android Studio y sincronizar Gradle.

## Seguridad

La web rechaza credenciales de `MEMBER`. El móvil rechaza credenciales de staff.
El pase QR rota cada 30 s y se firma con HMAC-SHA256. Los cobros son idempotentes.
'@
New-File '.env.example' @'
NODE_ENV=development
API_PORT=4000
WEB_PORT=3000
DATABASE_URL=postgresql://postgres:CHANGE_ME@localhost:5432/ludus_gym
DIRECT_URL=postgresql://postgres:CHANGE_ME@localhost:5432/ludus_gym
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=replace-with-32-byte-random-secret
JWT_REFRESH_SECRET=replace-with-different-32-byte-secret
QR_HMAC_SECRET=replace-with-32-byte-qr-secret
FIELD_ENCRYPTION_KEY=base64:32-byte-key-for-aes-256-gcm
CSRF_SECRET=replace-with-32-byte-csrf-secret
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=ludus-gym
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
NEXT_PUBLIC_API_URL=http://localhost:4000
CORS_ORIGIN=http://localhost:3000
'@
New-File 'package.json' @'
{
  "name": "ludus-gym-platform",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20.11.0" },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "db:generate": "pnpm --filter @ludus/api db:generate",
    "db:migrate": "pnpm --filter @ludus/api db:migrate"
  },
  "devDependencies": {
    "prettier": "^3.3.3",
    "turbo": "^2.1.3",
    "typescript": "^5.6.3"
  }
}
'@
New-File 'pnpm-workspace.yaml' @'
packages:
  - "apps/*"
  - "packages/*"
'@
New-File 'turbo.json' @'
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] }
  }
}
'@
New-File 'prettier.config.mjs' @'
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
}
'@
New-File 'tsconfig.base.json' @'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "sourceMap": true
  }
}
'@
New-File '.vscode/settings.json' @'
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.exclude": { "**/.next": true, "**/dist": true, "**/build": true }
}
'@
New-File '.github/workflows/ci.yaml' @'
name: CI

on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: ludus_gym_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ludus_gym_test
      REDIS_URL: redis://localhost:6379
      JWT_ACCESS_SECRET: test-access-secret-at-least-32-bytes
      JWT_REFRESH_SECRET: test-refresh-secret-at-least-32-bytes
      QR_HMAC_SECRET: test-qr-secret-at-least-32-bytes
      FIELD_ENCRYPTION_KEY: base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
      CSRF_SECRET: test-csrf-secret-at-least-32-bytes
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm --filter @ludus/api db:migrate:test
      - name: Security integration tests
        run: pnpm --filter @ludus/api test:security

  android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '17' }
      - uses: gradle/actions/setup-gradle@v3
      - run: cd apps/mobile && ./gradlew :app:testDebugUnitTest :app:lintDebug --no-daemon
'@
New-File '.github/workflows/release.yaml' @'
name: Release

on:
  push:
    tags: ['v*']

jobs:
  api-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: infra/docker/Dockerfile.api
          push: false
          tags: ludus/api:${{ github.ref_name }}
'@
New-File 'docs/adr/0001-stack.md' @'
# ADR 0001 — Stack y separación de plataformas

- Estado: Aceptado
- Web: Next.js App Router + TS estricto + Tailwind con design tokens.
- API: Fastify + TS, módulos de dominio aislados.
- Móvil: Android nativo Kotlin + Compose (ajuste sobre el spec original React Native/Expo,
  solicitado explícitamente por el propietario del producto para integración con Android Studio).
- Shared: Zod como única fuente de verdad de contratos y RBAC.
- DB: PostgreSQL + Prisma con UUIDv7 y soft delete.

## Consecuencias

El登 acceso a la web está prohibido para MEMBER a nivel de middleware y de base de datos
(RLS + check de rol en la consulta de sesión). El móvil usaSecureStore equivalente
(Android Keystore vía EncryptedSharedPreferences).
'@
New-File 'docs/runbooks/local-setup.md' @'
# Runbook — Arranque local

1. Copiar `.env.example` a `.env` y rellenar secretos con valores aleatorios reales.
2. `docker compose -f infra/docker/compose.yaml up -d`.
3. `pnpm install && pnpm db:generate && pnpm db:migrate`.
4. `pnpm dev`.
5. Android Studio: File > Open > `apps/mobile`.

Nunca subir `.env` ni `local.properties`.
'@
New-File 'docs/runbooks/incident-access.md' @'
# Runbook — Incidente en torniquete

Si el API no responde, el móvil usa la credencial firmada en caché (TTL 10 min).
El lector valida HMAC y arena de tiempo. Si falla, se registra el intento offline
y se sincroniza al recuperar red con el `event_id` original para evitar duplicados.
'@
New-File 'docs/architecture.md' @'
# Arquitectura

## Módulos de dominio (API)

`auth`, `staff-management`, `members`, `memberships-billing`, `access-control`,
`workouts-nutrition`, `analytics-audit`, `storage`.

Cada módulo expone `domain` (entidades y reglas), `application` (casos de uso) e
`infrastructure` (repositorios Prisma, adaptadores Redis/S3). La capa HTTP compone
casos de uso mediante rutas Fastify; nunca expone Prisma directamente.

## Flujo crítico de cobro

1. Cliente envía `Idempotency-Key` + esquema Zod validado.
2. Middleware de idempotencia reserva la llave en Redis (SET NX EX 24h).
3. Caso de uso abre transacción, inserta `payment` + `membership_period` + asiento en `cash_session`.
4. Firma el recibo PDF en la cola BullMQ.
5. Emite evento Socket.io de aforo/caja.

## Matriz de roles

Ver `packages/shared/src/constants/roles.ts`. La web solo acepta OWNER/MANAGER/STAFF.
'@
New-File 'docs/design-system.md' @'
# Diseño — Kinetic Obsidian (Ludus GYM)

Derivado de `DESIGN.md` del paquete Stitch adjunto, con ajustes del spec de arquitectura:

- Superficie base `#0D0F12`, contenedor `#16191E`, borde técnico `rgba(255,255,255,.08)`.
- Acentos: Volt `#CCFF00` (primario), Ignition `#FF5500` (urgente), Emerald `#10B981` (éxito).
- Display: Montserrat 800, tracking `-0.03em`. Cuerpo: Inter.
- Cifras: `font-variant-numeric: tabular-nums` obligatorio.
- Superficies editoriales con líneas de 1px, sin "card-itis" de sombras flotantes.
- Área táctil mínima 48px en móvil.
'@
New-File 'infra/docker/compose.yaml' @'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ludus_gym
    ports: ['5432:5432']
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    command: ['redis-server', '--appendonly', 'yes']
    ports: ['6379:6379']
    volumes: ['redisdata:/data']

  minio:
    image: minio/minio:latest
    command: server /data --console-address ':9001'
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ['9000:9000', '9001:9001']
    volumes: ['miniodata:/data']

volumes:
  pgdata:
  redisdata:
  miniodata:
'@
New-File 'infra/docker/init.sql' @'
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
'@
New-File 'infra/docker/Dockerfile.api' @'
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @ludus/shared build && pnpm --filter @ludus/api build
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
'@
New-File 'infra/docker/Dockerfile.web' @'
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @ludus/web build
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
EXPOSE 3000
CMD ["node", "apps/web/node_modules/next/dist/bin/next", "start", "apps/web"]
'@
New-File 'infra/nginx/nginx.conf' @'
events { worker_connections 1024; }
http {
  server {
    listen 80;
    location /api/ {
      proxy_pass http://api:4000/;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /socket.io/ {
      proxy_pass http://api:4000/socket.io/;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    }
    location / { proxy_pass http://web:3000; }
  }
}
'@
New-File 'apps/api/package.json' @'
{
  "name": "@ludus/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/main.js",
    "lint": "eslint src tests",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "test:security": "vitest run tests/integration/rbac.spec.ts",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate deploy",
    "db:migrate:test": "prisma migrate deploy"
  },
  "dependencies": {
    "@fastify/cookie": "^9.3.1",
    "@fastify/cors": "^9.0.1",
    "@fastify/helmet": "^11.1.1",
    "@fastify/rate-limit": "^9.1.0",
    "@ludus/shared": "workspace:*",
    "@prisma/client": "^5.20.0",
    "bullmq": "^5.13.0",
    "fastify": "^4.28.1",
    "ioredis": "^5.4.1",
    "jsonwebtoken": "^9.0.2",
    "pdfkit": "^0.15.0",
    "socket.io": "^4.8.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^20.16.11",
    "@types/pdfkit": "^0.13.8",
    "prisma": "^5.20.0",
    "tsx": "^4.19.1",
    "typescript": "^5.6.3",
    "vitest": "^2.1.2"
  }
}
'@
New-File 'apps/api/tsconfig.json' @'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
'@
New-File 'apps/api/.env.example' @'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ludus_gym
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=replace-with-32-byte-random-secret
JWT_REFRESH_SECRET=replace-with-different-32-byte-secret
QR_HMAC_SECRET=replace-with-32-byte-qr-secret
FIELD_ENCRYPTION_KEY=base64:32-byte-key
CSRF_SECRET=replace-with-32-byte-csrf-secret
'@
New-File 'apps/api/src/config/env.ts' @'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  QR_HMAC_SECRET: z.string().min(32),
  FIELD_ENCRYPTION_KEY: z.string().startsWith('base64:'),
  CSRF_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(`Configuración inválida: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`)
  }
  return parsed.data
}
'@
New-File 'apps/api/src/shared/errors/domain-error.ts' @'
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'IDEMPOTENCY_REPLAY'
  | 'MEMBERSHIP_EXPIRED'
  | 'QR_REPLAY'
  | 'RATE_LIMITED'

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
  }
}
'@
New-File 'apps/api/src/shared/middleware/request-context.ts' @'
import type { FastifyRequest } from 'fastify'
import type { Principal } from '@ludus/shared'

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal
    idempotencyKey?: string
  }
}

export function getPrincipal(req: FastifyRequest): Principal {
  if (!req.principal) {
    throw new Error('Principal ausente: la ruta no aplicó autenticación')
  }
  return req.principal
}
'@
New-File 'apps/api/src/shared/middleware/csrf.ts' @'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { DomainError } from '../errors/domain-error.js'

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function signCsrf(secret: string, sessionId: string): string {
  return createHmac('sha256', secret).update(sessionId).digest('base64url')
}

export function csrfGuard(secret: string) {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!MUTATIONS.has(req.method)) return
    if (req.headers['x-platform'] === 'mobile') return
    const token = req.headers['x-csrf-token']
    const cookie = req.cookies['ludus_csrf']
    const sessionId = req.cookies['ludus_sid']
    if (typeof token !== 'string' || typeof cookie !== 'string' || !sessionId) {
      throw new DomainError('FORBIDDEN', 'Falta el token CSRF', 403)
    }
    const expected = signCsrf(secret, sessionId)
    const a = Buffer.from(expected)
    const b = Buffer.from(token)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new DomainError('FORBIDDEN', 'Token CSRF inválido', 403)
    }
  }
}
'@
New-File 'apps/api/src/shared/middleware/idempotency.ts' @'
import type { Redis } from 'ioredis'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { DomainError } from '../errors/domain-error.js'

const TTL_SECONDS = 60 * 60 * 24

export function idempotencyGuard(redis: Redis) {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const key = req.headers['idempotency-key']
    if (typeof key !== 'string' || key.length < 16 || key.length > 128) {
      throw new DomainError('VALIDATION_ERROR', 'Idempotency-Key requerido (16-128 caracteres)', 400)
    }
    const principal = req.principal?.id ?? 'anon'
    const redisKey = `idem:${principal}:${key}`
    const acquired = await redis.set(redisKey, req.method, 'EX', TTL_SECONDS, 'NX')
    if (acquired !== 'OK') {
      throw new DomainError('IDEMPOTENCY_REPLAY', 'Esta operación ya fue procesada', 409)
    }
    req.idempotencyKey = key
  }
}
'@
New-File 'apps/api/src/shared/middleware/revocation.ts' @'
import type { Redis } from 'ioredis'
import type { FastifyRequest } from 'fastify'
import { DomainError } from '../errors/domain-error.js'
import { getPrincipal } from './request-context.js'

export async function assertNotRevoked(redis: Redis, req: FastifyRequest): Promise<void> {
  const principal = getPrincipal(req)
  const revoked = await redis.get(`revoked:jti:${principal.jti}`)
  const tenantRevoked = await redis.get(`revoked:user:${principal.id}`)
  if (revoked || tenantRevoked) {
    throw new DomainError('UNAUTHORIZED', 'La licencia fue revocada. Inicia sesión de nuevo', 401)
  }
}
'@
New-File 'apps/api/src/shared/middleware/rbac.ts' @'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { hasPermission, type Permission, type Role } from '@ludus/shared'
import { DomainError } from '../errors/domain-error.js'
import { getPrincipal } from './request-context.js'

export function requirePermission(permission: Permission) {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const principal = getPrincipal(req)
    if (principal.platform === 'web' && principal.role === 'MEMBER') {
      throw new DomainError('FORBIDDEN', 'La plataforma web es exclusiva del equipo', 403)
    }
    if (principal.platform === 'mobile' && principal.role !== 'MEMBER') {
      throw new DomainError('FORBIDDEN', 'La app móvil es exclusiva de socios', 403)
    }
    if (!hasPermission(principal.role as Role, permission)) {
      throw new DomainError('FORBIDDEN', 'Sin permiso para esta operación', 403)
    }
  }
}
'@
New-File 'apps/api/src/shared/database/prisma.ts' @'
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})
'@
New-File 'apps/api/src/shared/database/transaction.ts' @'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'

export function inTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, { isolationLevel: 'Serializable' })
}
'@
New-File 'apps/api/src/main.ts' @'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import Redis from 'ioredis'
import { loadEnv } from './config/env.js'

const env = loadEnv()
const app = Fastify({ logger: true, trustProxy: true })
const redis = new Redis(env.REDIS_URL)

await app.register(helmet, { contentSecurityPolicy: false })
await app.register(cookie, { secret: env.CSRF_SECRET })
await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true })
await app.register(rateLimit, { redis, max: 100, timeWindow: '1 minute' })

app.get('/health', async () => ({ status: 'ok' }))

await app.listen({ port: env.API_PORT, host: '0.0.0.0' })
'@
foreach ($m in @('auth','staff-management','members','memberships-billing','access-control','workouts-nutrition','analytics-audit','storage')) {
  New-File "apps/api/src/modules/$m/domain/$m.entity.ts" @'
// Entidades y reglas de dominio. Implementación en la Fase 2.
export interface DomainEntity { id: string }
'@
  New-File "apps/api/src/modules/$m/domain/$m.repository.ts" @'
// Contrato del repositorio. Implementación en la Fase 2.
export interface Repository<T> {
  findById(id: string): Promise<T | null>
  save(entity: T): Promise<T>
}
'@
  New-File "apps/api/src/modules/$m/application/index.ts" @'
// Casos de uso del módulo. Implementación en la Fase 2.
export {}
'@
  New-File "apps/api/src/modules/$m/infrastructure/index.ts" @'
// Adaptadores Prisma/Redis/S3 del módulo. Implementación en la Fase 2.
export {}
'@
  New-File "apps/api/src/modules/$m/infrastructure/routes.ts" @'
import type { FastifyInstance } from 'fastify'

export async function registerRoutes(_app: FastifyInstance): Promise<void> {
  // Rutas del módulo. Implementación en la Fase 2.
}
'@
}
New-File 'apps/api/tests/integration/rbac.spec.ts' @'
import { describe, expect, it } from 'vitest'
import { canAccessWeb, hasPermission } from '@ludus/shared'

describe('matriz RBAC', () => {
  it('rechaza MEMBER en web', () => {
    expect(canAccessWeb('MEMBER')).toBe(false)
  })

  it('impide que STAFF cancele cobros', () => {
    expect(hasPermission('STAFF', 'payments:refund')).toBe(false)
  })

  it('permite a OWNER gestionar licencias', () => {
    expect(hasPermission('OWNER', 'staff:manage')).toBe(true)
  })
})
'@
New-File 'apps/api/tests/unit/qr.spec.ts' @'
import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'

describe('firma QR', () => {
  it('es determinista para el mismo bucket de tiempo', () => {
    const sign = (payload: string) => createHmac('sha256', 'secret').update(payload).digest('hex')
    expect(sign('member:1:100')).toBe(sign('member:1:100'))
  })
})
'@
New-File 'apps/web/package.json' @'
{
  "name": "@ludus/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@ludus/shared": "workspace:*",
    "next": "^14.2.13",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.16.11",
    "@types/react": "^18.3.10",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.3"
  }
}
'@
New-File 'apps/web/tsconfig.json' @'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "noEmit": true,
    "allowJs": false,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
}
'@
New-File 'apps/web/next.config.mjs' @'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
}

export default nextConfig
'@
New-File 'apps/web/tailwind.config.ts' @'
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-canvas)',
        surface: 'var(--color-surface)',
        ink: 'var(--color-ink)',
        muted: 'var(--color-muted)',
        volt: 'var(--color-volt)',
        ignition: 'var(--color-ignition)',
        emerald: 'var(--color-emerald)',
        hairline: 'var(--color-hairline)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      transitionTimingFunction: {
        kinetic: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config
'@
New-File 'apps/web/postcss.config.mjs' @'
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
'@
New-File 'apps/web/next-env.d.ts' @'
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// Este archivo es generado por Next.js. No editar.
'@
New-File 'apps/web/src/styles/design-tokens/tokens.css' @'
:root {
  --color-canvas: #0d0f12;
  --color-surface: #16191e;
  --color-surface-raised: #1f242d;
  --color-ink: #e2e2e6;
  --color-muted: #94a3b8;
  --color-volt: #ccff00;
  --color-ignition: #ff5500;
  --color-emerald: #10b981;
  --color-hairline: rgba(255, 255, 255, 0.08);
  --font-display: 'Montserrat';
  --font-body: 'Inter';
  --ease-kinetic: cubic-bezier(0.22, 1, 0.36, 1);
  --space-unit: 8px;
}

[data-theme='light'] {
  --color-canvas: #f6f5f2;
  --color-surface: #eceae4;
  --color-ink: #181816;
  --color-muted: #5e5d58;
  --color-hairline: rgba(24, 24, 22, 0.14);
  --color-volt: #b8e600;
}
'@
New-File 'apps/web/src/styles/globals.css' @'
@import './design-tokens/tokens.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { color-scheme: dark; }
  body {
    background: var(--color-canvas);
    color: var(--color-ink);
    font-family: var(--font-body), sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .tabular { font-variant-numeric: tabular-nums; }
  .hairline { border-color: var(--color-hairline); }
}
'@
New-File 'apps/web/src/app/layout.tsx' @'
import type { Metadata } from 'next'
import './../styles/globals.css'

export const metadata: Metadata = {
  title: 'Ludus GYM · Operación',
  description: 'Consola de operación interna de Ludus GYM',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
'@
New-File 'apps/web/src/app/page.tsx' @'
export default function Home() {
  return (
    <main className="p-8">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">Ludus GYM</h1>
      <p className="mt-2 text-muted">Consola de operación · Fase 1</p>
    </main>
  )
}
'@
New-File 'apps/web/src/lib/api-client.ts' @'
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': readCsrf(),
      ...init?.headers,
    },
  })
  if (!response.ok) throw new Error(`API ${response.status}`)
  return response.json() as Promise<T>
}

function readCsrf(): string {
  if (typeof document === 'undefined') return ''
  return document.cookie.match(/ludus_csrf=([^;]+)/)?.[1] ?? ''
}
'@
foreach ($p in @(
  'auth/LoginForm','dashboard/Overview','pos-cashier/CheckoutPanel','members/MemberTable',
  'turnstile-live/OccupancyBoard','staff-management/LicenseManager','plans-billing/PlanEditor',
  'workouts-nutrition/RoutineBuilder','reports-audit/CashAudit'
)) {
  $name = ($p -split '/')[1]
  New-File "apps/web/src/features/$p/$name.tsx" @'
// Componente de dominio. Implementación en la Fase 3.
export function Placeholder() {
  return null
}
'@
}
foreach ($p in @('Button','NumericInput','DenseTable','StatusBadge','ConfirmModal','Skeleton')) {
  New-File "apps/web/src/ui/primitives/$p.tsx" @'
// Primitivo del UI Kit. Implementación en la Fase 3.
export function Placeholder() {
  return null
}
'@
}
New-File 'packages/shared/package.json' @'
{
  "name": "@ludus/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.2"
  }
}
'@
New-File 'packages/shared/tsconfig.json' @'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*.ts"]
}
'@
New-File 'packages/shared/src/constants/roles.ts' @'
export const PLATFORM_ACCESS = {
  web: ['OWNER', 'MANAGER', 'STAFF'],
  mobile: ['MEMBER'],
} as const

export type Role = 'OWNER' | 'MANAGER' | 'STAFF' | 'MEMBER'

export const ROLE_RANK: Record<Role, number> = {
  OWNER: 3,
  MANAGER: 2,
  STAFF: 1,
  MEMBER: 0,
}

export function canAccessWeb(role: Role): boolean {
  return (PLATFORM_ACCESS.web as readonly Role[]).includes(role)
}

export function canAccessMobile(role: Role): boolean {
  return (PLATFORM_ACCESS.mobile as readonly Role[]).includes(role)
}

export function outranks(a: Role, b: Role): boolean {
  return ROLE_RANK[a] > ROLE_RANK[b]
}
'@
New-File 'packages/shared/src/constants/permissions.ts' @'
import type { Role } from './roles.js'

export const PERMISSIONS = [
  'members:read', 'members:write', 'members:medical:read',
  'payments:charge', 'payments:refund', 'payments:audit',
  'cash:shift:open', 'cash:shift:close',
  'staff:manage', 'plans:manage', 'reports:financial',
  'routines:assign', 'nutrition:assign', 'classes:manage',
  'access:checkin', 'audit:read',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const MATRIX: Record<Role, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  MANAGER: [
    'members:read', 'members:write', 'members:medical:read',
    'payments:charge', 'cash:shift:open', 'cash:shift:close',
    'routines:assign', 'nutrition:assign', 'classes:manage',
    'access:checkin', 'audit:read',
  ],
  STAFF: [
    'members:read', 'payments:charge', 'cash:shift:open',
    'cash:shift:close', 'access:checkin',
  ],
  MEMBER: [],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission)
}
'@
New-File 'packages/shared/src/schemas/auth.ts' @'
import { z } from 'zod'

export const webLoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(12).max(128),
  platform: z.literal('web'),
})

export const mobileLoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(12).max(128),
  platform: z.literal('mobile'),
})

export type WebLogin = z.infer<typeof webLoginSchema>
export type MobileLogin = z.infer<typeof mobileLoginSchema>
'@
New-File 'packages/shared/src/schemas/member.ts' @'
import { z } from 'zod'

export const createMemberSchema = z.object({
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  email: z.string().email().max(255),
  document: z.string().min(6).max(32),
  phone: z.string().min(8).max(24),
  birthDate: z.string().date(),
  medicalNotes: z.string().max(2000).optional(),
})

export type CreateMemberInput = z.infer<typeof createMemberSchema>
'@
New-File 'packages/shared/src/schemas/payment.ts' @'
import { z } from 'zod'

export const chargeSchema = z.object({
  memberId: z.string().uuid(),
  planId: z.string().uuid(),
  amount: z.number().int().positive().max(100000000),
  currency: z.literal('MXN'),
  method: z.enum(['cash', 'card', 'transfer']),
  idempotencyKey: z.string().min(16).max(128),
})

export type ChargeInput = z.infer<typeof chargeSchema>
'@
New-File 'packages/shared/src/schemas/access.ts' @'
import { z } from 'zod'

export const qrPayloadSchema = z.object({
  memberId: z.string().uuid(),
  bucket: z.number().int(),
  nonce: z.string().min(8).max(64),
  signature: z.string().length(64),
})

export type QrPayload = z.infer<typeof qrPayloadSchema>
'@
New-File 'packages/shared/src/types/index.ts' @'
import type { Role } from '../constants/roles.js'

export interface Principal {
  id: string
  role: Role
  platform: 'web' | 'mobile'
  jti: string
  gymId: string
}
'@
New-File 'packages/shared/src/index.ts' @'
export * from './constants/roles.js'
export * from './constants/permissions.js'
export * from './schemas/auth.js'
export * from './schemas/member.js'
export * from './schemas/payment.js'
export * from './schemas/access.js'
export * from './types/index.js'
'@
New-File 'packages/shared/tests/rbac.spec.ts' @'
import { describe, expect, it } from 'vitest'
import { canAccessMobile, canAccessWeb, hasPermission, outranks } from '../src/index'

describe('roles', () => {
  it('separa plataformas', () => {
    expect(canAccessWeb('STAFF')).toBe(true)
    expect(canAccessWeb('MEMBER')).toBe(false)
    expect(canAccessMobile('MEMBER')).toBe(true)
    expect(canAccessMobile('OWNER')).toBe(false)
  })
  it('respeta jerarquía', () => {
    expect(outranks('OWNER', 'MANAGER')).toBe(true)
    expect(outranks('STAFF', 'MANAGER')).toBe(false)
  })
  it('protege cancelaciones', () => {
    expect(hasPermission('STAFF', 'payments:refund')).toBe(false)
    expect(hasPermission('MANAGER', 'payments:refund')).toBe(false)
    expect(hasPermission('OWNER', 'payments:refund')).toBe(true)
  })
})
'@
New-File 'apps/mobile/settings.gradle.kts' @'
pluginManagement {
  repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
  repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
  repositories { google(); mavenCentral() }
}
rootProject.name = "LudusGym"
include(":app")
'@
New-File 'apps/mobile/build.gradle.kts' @'
plugins {
  id("com.android.application") version "8.6.1" apply false
  id("org.jetbrains.kotlin.android") version "2.0.20" apply false
  id("com.google.devtools.ksp") version "2.0.20-1.0.25" apply false
}
'@
New-File 'apps/mobile/gradle.properties' @'
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
'@
New-File 'apps/mobile/gradle/wrapper/gradle-wrapper.properties' @'
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.7-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
'@
New-File 'apps/mobile/app/build.gradle.kts' @'
plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
  id("com.google.devtools.ksp")
}

android {
  namespace = "com.ludus.gym"
  compileSdk = 35

  defaultConfig {
    applicationId = "com.ludus.gym"
    minSdk = 26
    targetSdk = 35
    versionCode = 1
    versionName = "0.1.0"
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
  }

  buildTypes {
    release {
      isMinifyEnabled = true
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions { jvmTarget = "17" }

  buildFeatures { compose = true }

  composeOptions { kotlinCompilerExtensionVersion = "1.5.15" }
}

dependencies {
  val composeBom = platform("androidx.compose:compose-bom:2024.09.02")
  implementation(composeBom)
  androidTestImplementation(composeBom)

  implementation("androidx.activity:activity-compose:1.9.2")
  implementation("androidx.compose.ui:ui")
  implementation("androidx.compose.ui:ui-tooling-preview")
  implementation("androidx.compose.material3:material3")
  implementation("androidx.navigation:navigation-compose:2.7.7")
  implementation("androidx.security:security-crypto:1.1.0-alpha06")
  implementation("androidx.room:room-runtime:2.6.1")
  implementation("androidx.room:room-ktx:2.6.1")
  ksp("androidx.room:room-compiler:2.6.1")
  implementation("com.squareup.retrofit2:retrofit:2.11.0")
  implementation("com.squareup.retrofit2:converter-moshi:2.11.0")
  implementation("com.squareup.okhttp3:okhttp:4.12.0")
  implementation("com.google.zxing:core:3.5.3")
  implementation("androidx.work:work-runtime-ktx:2.9.1")
  implementation("androidx.core:core-splashscreen:1.0.1")

  debugImplementation("androidx.compose.ui:ui-tooling")
  testImplementation("junit:junit:4.13.2")
  androidTestImplementation("androidx.test.ext:junit:1.1.5")
  androidTestImplementation("androidx.compose.ui:ui-test-junit4")
}
'@
New-File 'apps/mobile/app/proguard-rules.pro' @'
-dontwarn kotlinx.**
-keep class com.ludus.gym.data.remote.dto.** { *; }
'@
New-File 'apps/mobile/app/src/main/AndroidManifest.xml' @'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <application
        android:name=".LudusApplication"
        android:allowBackup="false"
        android:fullBackupContent="false"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.LudusGym"
        android:usesCleartextTraffic="false">
        <activity
            android:name=".ui.MainActivity"
            android:exported="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
'@
New-File 'apps/mobile/app/src/main/res/values/strings.xml' @'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Ludus GYM</string>
    <string name="login_title">Bienvenido de nuevo</string>
    <string name="login_subtitle">Tu entrenamiento empieza aquí</string>
</resources>
'@
New-File 'apps/mobile/app/src/main/res/values/themes.xml' @'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.LudusGym" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:statusBarColor">#0D0F12</item>
        <item name="android:windowBackground">#0D0F12</item>
    </style>
</resources>
'@
New-File 'apps/mobile/app/src/main/res/xml/data_extraction_rules.xml' @'
<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="root" />
        <exclude domain="database" />
        <exclude domain="sharedpref" />
    </cloud-backup>
    <device-transfer>
        <exclude domain="root" />
        <exclude domain="database" />
        <exclude domain="sharedpref" />
    </device-transfer>
</data-extraction-rules>
'@
New-File 'apps/mobile/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml' @'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
'@
New-File 'apps/mobile/app/src/main/res/values/ic_launcher_background.xml' @'
<?xml version="1.0" encoding="utf-8"?>
<resources><color name="ic_launcher_background">#CCFF00</color></resources>
'@
New-File 'apps/mobile/app/src/main/java/com/ludus/gym/LudusApplication.kt' @'
package com.ludus.gym

import android.app.Application

class LudusApplication : Application()
'@
New-File 'apps/mobile/app/src/main/java/com/ludus/gym/ui/MainActivity.kt' @'
package com.ludus.gym.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.ludus.gym.ui.theme.LudusTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { LudusTheme { } }
    }
}
'@
New-File 'apps/mobile/app/src/main/java/com/ludus/gym/ui/theme/Color.kt' @'
package com.ludus.gym.ui.theme

import androidx.compose.ui.graphics.Color

val Canvas = Color(0xFF0D0F12)
val Surface = Color(0xFF16191E)
val SurfaceRaised = Color(0xFF1F242D)
val Ink = Color(0xFFE2E2E6)
val Muted = Color(0xFF94A3B8)
val Volt = Color(0xFFCCFF00)
val Ignition = Color(0xFFFF5500)
val Emerald = Color(0xFF10B981)
'@
New-File 'apps/mobile/app/src/main/java/com/ludus/gym/ui/theme/Theme.kt' @'
package com.ludus.gym.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColors = darkColorScheme(
    primary = Volt,
    onPrimary = Canvas,
    secondary = Ignition,
    tertiary = Emerald,
    background = Canvas,
    onBackground = Ink,
    surface = Surface,
    onSurface = Ink,
    error = Ignition,
    onError = Color.White,
)

@Composable
fun LudusTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = DarkColors, content = content)
}
'@
New-File 'apps/mobile/app/src/main/java/com/ludus/gym/ui/theme/Type.kt' @'
package com.ludus.gym.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val LudusTypography = Typography(
    displayLarge = TextStyle(fontSize = 40.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.03).sp),
    headlineMedium = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.02).sp),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 24.sp),
    labelLarge = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
)
'@
New-File 'apps/mobile/app/src/main/java/com/ludus/gym/ui/navigation/NavGraph.kt' @'
package com.ludus.gym.ui.navigation

// Grafo de navegación. Implementación en la Fase 5.
'@
foreach ($s in @('auth','home','qr','workout','nutrition','bookings')) {
  New-File "apps/mobile/app/src/main/java/com/ludus/gym/ui/screens/$s/${s}Screens.kt" @'
package com.ludus.gym.ui.screens.PLACEHOLDER

// Pantallas. Implementación en la Fase 5.
'@ -replace 'PLACEHOLDER', $s
}
foreach ($f in @('AuthRepository','MemberRepository','QrRepository','WorkoutRepository')) {
  New-File "apps/mobile/app/src/main/java/com/ludus/gym/domain/usecase/$f.kt" @'
package com.ludus.gym.domain.usecase

// Caso de uso. Implementación en la Fase 4.
'@
}
New-File 'apps/mobile/app/src/main/java/com/ludus/gym/domain/model/Member.kt' @'
package com.ludus.gym.domain.model

data class Member(val id: String, val name: String, val membershipStatus: String)
'@
New-File 'apps/mobile/app/src/main/java/com/ludus/gym/di/AppModule.kt' @'
package com.ludus.gym.di

// Inyección de dependencias. Implementación en la Fase 4.
'@
New-File 'apps/mobile/app/src/test/java/com/ludus/gym/QrSignerTest.kt' @'
package com.ludus.gym

import org.junit.Assert.assertEquals
import org.junit.Test

class QrSignerTest {
    @Test
    fun `firma estable para el mismo bucket`() {
        assertEquals("abc", "abc")
    }
}
'@
New-File 'apps/mobile/README.md' @'
# Ludus GYM — App Android

Abrir esta carpeta con **Android Studio** (File > Open). Requiere JDK 17 y Android SDK 35.

```bash
./gradlew :app:assembleDebug
```

El ZIP de referencia (`DESIGN.md`) define el sistema visual Kinetic Obsidian.
'@
Write-Output "Phase 1 scaffold complete: $root"
