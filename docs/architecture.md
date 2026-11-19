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
