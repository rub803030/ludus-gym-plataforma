# Plan y registro de estabilización

## Alcance

- Rama de trabajo: `hotfix/stabilization-membership-flow`.
- Base de trabajo original: `db6dd47`; `origin/master` avanzó después con tres cambios del workflow de despliegue web. Se revisó que el workflow solo se ejecuta en `main`/`master` o manualmente; esta rama no se ha publicado ni desplegado.
- Objetivo: alinear afiliaciones, pagos, acceso QR y consultas con el flujo propietario → gimnasio aprobado → socio afiliado → recepción.
- Límite: no modificar `main`/`master`, no ejecutar migraciones contra servicios compartidos, no publicar APK, no crear tags, no desplegar ni solicitar merge.

## Causa raíz e impacto

1. El alta de recepción creaba `Member` sin `GymMembership`; consultas y acceso dependían en algunos lugares de `Member.gymId`. Un socio podía quedar huérfano o habilitado bajo el gimnasio equivocado.
2. Cobros, renovaciones, reportes y datos de rutina/nutrición no aplicaban una política consistente de tenant. Una renovación no siempre se asociaba a la membresía local.
3. La elegibilidad de acceso se verificaba de forma distinta entre emisión de QR y check-in; no siempre se exigían cuenta global activa, afiliación local activa y plan pagado vigente.
4. El QR de afiliación debía depender del estado real de aprobación y del código público, no de un marcador. Los errores de afiliación debían conservar el detalle HTTP y permitir reintentar.
5. El enlace de aprobación de gimnasio necesitaba autenticación y rol ADMIN; la autorización no debía adelantarse a la verificación del propietario.

## Decisiones de arquitectura

- `GymMembership` es la fuente de verdad para afiliación y alcance por gimnasio.
- `Member.gymId` queda como campo legado/contexto de compatibilidad; no autoriza listados, cobros ni accesos.
- `Member.status` representa la cuenta global. Suspender una afiliación o vencer un plan afecta solo ese gimnasio; suspender la cuenta bloquea todos.
- El registro móvil crea una cuenta global; la afiliación explícita posterior establece el gimnasio activo en la sesión.
- Acceso requiere: cuenta global no suspendida, GymMembership activa y no eliminada, gimnasio activo y plan pagado vigente perteneciente al mismo gimnasio.
- El QR de afiliación identifica un gimnasio aprobado; no sustituye al QR temporal de acceso.
- El precio configurado del plan en el servidor es la fuente de verdad; no se aceptan importes arbitrarios ni descuentos no modelados.
- Un reembolso total revoca en la misma transacción la membresía asociada. Un pago legacy ambiguo se bloquea para revisión en vez de dejar acceso habilitado.
- La misma verificación de aforo se aplica al check-in QR y manual, con bloqueo de gimnasio dentro de la transacción.
- La idempotencia se apoya en el pago persistido y su clave única por gimnasio; el replay idéntico devuelve el mismo pago, un payload distinto entra en conflicto y una transacción fallida no reserva la clave en Redis.
- Los folios usan un contador por gimnasio/año mediante la migración `0011_payment_stability.sql`.

## Cambios realizados

### API y datos

- Alta de recepción: crea `Member` y `GymMembership` dentro de una transacción.
- Afiliación móvil: crea/reactiva la relación por gimnasio dentro de transacción; rechaza cuenta o gimnasio inactivos y afiliación suspendida.
- Alcance de listados, detalles, pagos, reportes, rutinas y nutrición: usa relaciones GymMembership o filtros explícitos por `gymId`.
- Cobros: asocian el pago con la membresía local y calculan el período de renovación sin quitar suspensiones globales.
- Cobros: calculan importe desde el plan del servidor, impiden replay con payload distinto, permiten replay seguro y usan un folio atómico por gimnasio/año.
- Reembolsos: revocan la membresía asociada en la transacción del reembolso; detectan pagos legacy sin vínculo seguro.
- Acceso: emisión de QR y check-in QR/manual comparten la política de cuenta, afiliación y plan; se elimina el fallback de autorización por `Member.gymId`.
- Aforo: check-in QR y manual comparten el límite y la transacción de bloqueo de gimnasio.
- Autenticación: no inventa un gimnasio activo para cuentas globales sin afiliación; `/api/auth/me` evita consultar con UUID vacío; la emisión de sesión verifica una afiliación activa cuando recibe gimnasio.
- Verificación y aprobación: se activa la cuenta del socio tras verificar el correo; aprobación protegida por sesión ADMIN y sujeta a verificación del propietario; token de aprobación consumido condicionalmente.
- Errores QR: distingue credencial de afiliación inválida de errores de consulta a base de datos; no convierte fallos de infraestructura en “gimnasio inexistente”.
- Migración `0010_backfill_gym_memberships.sql`: inserta relaciones faltantes de miembros legados sin reemplazar relaciones existentes. Es idempotente y permanece sin ejecutar.
- Migración `0011_payment_stability.sql`: crea y backfillea el contador de folios por gimnasio/año; permanece sin ejecutar.

### Web y Android

- Web: muestra QR/código de afiliación real solo para gimnasio activo y deja iniciar sesión antes de volver a la aprobación administrativa.
- Android: conserva el detalle de errores HTTP de afiliación y permite reintentar la misma lectura.
- APK actual del repositorio: `versionCode 4`, `versionName 0.2.0`. No se generó una APK nueva durante esta estabilización.

### Archivos principales

- API: `apps/api/src/modules/{members,access,billing,auth,gyms,admin,analytics-audit,workouts-nutrition}/`.
- API compartida: `apps/api/src/shared/{gym-membership.ts,member-access.ts,gym-qr.ts,errors/domain-error.ts,http.ts}`.
- Pruebas: `apps/api/tests/unit/{member-access.spec.ts,membership-period.spec.ts}` y `apps/api/tests/integration/member-creation.spec.ts`.
- Pagos y aforo: `apps/api/tests/integration/billing-flow.spec.ts` y `apps/api/tests/unit/access-capacity.spec.ts`.
- Web: `apps/web/src/app/(console)/settings/page.tsx`, `apps/web/src/features/auth/{VerifyGym,ApproveGym,LoginForm}/` y `apps/web/src/lib/normalize.ts`.
- Android: `apps/mobile/app/src/main/java/com/ludus/gym/data/repository/QrRepository.kt` y pruebas del repositorio.
- SQL: `infra/supabase/migrations/0010_backfill_gym_memberships.sql` y `infra/supabase/migrations/0011_payment_stability.sql`.
- Contrato compartido y prueba de flujo de API: `packages/shared/src/schemas/payment.ts` y `scripts/test-api-flows.py`.

## Pruebas ejecutadas

- `corepack pnpm --filter @ludus/shared build`: PASS.
- `corepack pnpm --filter @ludus/api db:generate`: PASS; cliente generado desde el esquema local.
- `corepack pnpm --filter @ludus/api typecheck`: PASS.
- `corepack pnpm --filter @ludus/api test`: PASS; 47 pruebas automatizadas en 12 archivos, incluyendo Prisma simulado para alta, cobro, reembolso e idempotencia.
- `corepack pnpm --filter @ludus/web lint`: PASS.
- `corepack pnpm --filter @ludus/web build`: PASS; bundle Next.js compilado y tipos validados.
- `corepack pnpm --filter @ludus/shared typecheck`: PASS.
- `scripts/test-api-flows.py`: actualizado para aceptar replay idempotente; no ejecutado porque Python no está disponible en este entorno.
- `corepack pnpm typecheck` (Turbo): BLOCKED por resolución del binario del package manager en esta sesión; API, shared y web se verificaron directamente.
- Prettier: PASS para los archivos nuevos de test/documentación. No se aplicó formateo masivo a archivos heredados para evitar diffs ajenos a la estabilización.
- Pruebas Android y build de APK: NO EJECUTADOS; no se encontró Java/Gradle utilizable en esta sesión.
- Flujos end-to-end con PostgreSQL/Redis y navegador: NO EJECUTADOS; requieren entorno de staging y usuarios de prueba. Las pruebas automatizadas actuales no demuestran transacciones, RLS ni concurrencia reales.
- Migraciones 0010 y 0011: NO EJECUTADAS. No existe `.env.local` en el workspace para comprobar el destino; requieren configuración local explícitamente dirigida a staging, respaldo y validación del esquema antes de ejecutarlas.

## Estrategia de despliegue y rollback

1. Configurar y confirmar localmente el destino PostgreSQL de staging sin compartir credenciales; respaldar/verificar la base y comprobar qué migraciones ya se aplicaron.
2. Ensayar y aplicar únicamente `0010_backfill_gym_memberships.sql` y `0011_payment_stability.sql` en staging; verificar relaciones, conteos, constraints y contadores. No ejecutar el script general `scripts/apply-all-migrations.py` sin aislar el destino: lee `.env.local`, aplica todas las migraciones y semillas.
3. Ejecutar contra staging pruebas reales de transacción, RLS/aislamiento, reembolso, idempotencia, folios concurrentes y aforo concurrente; después desplegar API y web a staging y completar la matriz de [QA.md](./QA.md).
4. Generar y probar APK firmada en entorno con JDK/Android SDK compatibles; comprobar `versionCode` incrementado antes de publicar.
5. Si hay regresión, revertir el despliegue de aplicación. La migración es aditiva/idempotente; no borrar relaciones creadas automáticamente. Para datos incorrectos, preparar reparación revisada a partir del respaldo, nunca una reversión masiva automática.
6. No crear tag ni activar el workflow de release hasta aprobar la auditoría final y el checklist de QA.

## Riesgos residuales

- Las migraciones 0010/0011 no se han ejecutado ni validado sobre una copia real; no hay `.env.local` configurado en este workspace.
- No se ha demostrado con PostgreSQL real la transacción, RLS, idempotencia concurrente, folios ni aforo.
- No se ha demostrado el flujo completo API + PostgreSQL + Redis + web + APK en staging.
- El build Android está bloqueado por la falta de toolchain compatible en este entorno; el código de APK no se ha incrementado y no existe APK corregida.
- `infra/supabase/migrations/0009_admin_accounts.sql` contiene aprovisionamiento global de administradores; se mantiene intacta porque se desconoce si ya fue aplicada en entornos compartidos. Revisar aprovisionamiento seguro antes del release.
- `origin/master` ahora contiene un workflow de despliegue web a producción activado por pushes a `main`/`master` o ejecución manual. No se ha incorporado a esta rama ni se debe activar durante la estabilización; revisar el flujo de release antes de cualquier merge.
- `Member.gymId` permanece como dato legado. Evitar reintroducirlo como fuente de autorización y conservar una revisión de consultas que aún lo usen para compatibilidad.

## Estado de salida

- Rama de estabilización creada; `main`/`master` no se modificaron.
- Cambios todavía requieren validación end-to-end y de migraciones en staging, concurrencia PostgreSQL y build Android.
- No solicitar merge ni publicar release hasta cerrar los casos pendientes de [QA.md](./QA.md).
