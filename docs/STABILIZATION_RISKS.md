# Riesgos de estabilización

## Alcance y estado

Una revisión de pagos y acceso detectó riesgos funcionales relevantes. El propietario del proyecto definió las políticas de producto y la implementación local ya incorpora las correcciones descritas abajo. Las pruebas actuales usan Prisma simulado: no demuestran transacciones, RLS ni concurrencia con PostgreSQL real.

No se han aplicado migraciones, no se ha conectado a staging, no se ha publicado la rama y no se ha desplegado. En el workspace no existe `.env.local`; por lo tanto, todavía no se puede confirmar ningún destino de base de datos. No compartir credenciales en el chat.

## Hallazgos y mitigación

### R-01 — El cobro no valida el importe contra el plan

- **Severidad:** Alta.
- **Impacto:** un cliente interno o integración autorizada podría cobrar un importe diferente y otorgar el período completo.
- **Decisión:** el precio configurado del plan en servidor es la fuente de verdad; los descuentos no modelados no se aceptan.
- **Mitigación:** API deriva el importe de `plan.priceCents`; el importe no es editable en POS. Hay cobertura de ruta con Prisma simulado.
- **Estado:** implementado; falta validar el flujo con PostgreSQL y UI en staging.

### R-02 — Un reembolso conserva el acceso de la membresía asociada

- **Severidad:** Alta.
- **Impacto:** un socio podría seguir accediendo tras recibir un reembolso total.
- **Decisión:** reembolso total revoca inmediatamente la membresía vinculada; el sistema no modela reembolsos parciales.
- **Mitigación:** pago, movimiento de caja y revocación se procesan en una transacción. Los pagos legacy sin vínculo seguro con una membresía activa se bloquean para revisión.
- **Estado:** implementado y cubierto con Prisma simulado; falta validación PostgreSQL.

### R-03 — El control de aforo no es atómico ni común a ambas vías

- **Severidad:** Media.
- **Impacto:** check-ins simultáneos o manuales podrían exceder el límite.
- **Decisión:** el mismo límite aplica a accesos QR y manual; no se añade una excepción administrativa.
- **Mitigación:** ambas vías verifican el aforo y bloquean la fila del gimnasio dentro de la transacción.
- **Estado:** implementado y cubierto a nivel unitario; falta prueba concurrente en PostgreSQL.

### R-04 — Una clave idempotente queda bloqueada después de un fallo

- **Severidad:** Media.
- **Impacto:** un error transitorio podría impedir reintentar un cobro que no se guardó.
- **Decisión:** un reintento idéntico devuelve el resultado persistido; una clave con payload diferente se rechaza; un fallo sin efectos no reserva permanentemente la clave.
- **Mitigación:** idempotencia ligada al pago persistido y a su clave única por gimnasio; el middleware no conserva una reserva Redis que impida reintentar.
- **Estado:** implementado y cubierto con Prisma simulado; falta prueba de carrera/concurrencia en PostgreSQL.

### R-05 — El folio de recibo colisiona con cobros concurrentes

- **Severidad:** Media.
- **Impacto:** cobros simultáneos podrían calcular el mismo folio y uno fallaría.
- **Decisión:** contador atómico por gimnasio/año.
- **Mitigación:** `0011_payment_stability.sql` crea y backfillea el contador; la API lo incrementa dentro de la transacción.
- **Estado:** código implementado; migración y concurrencia no validadas en staging.

### R-06 — No hay validación de integración PostgreSQL

- **Severidad:** Alta para release.
- **Impacto:** siguen sin demostrarse la semántica real de transacciones, RLS, migraciones, aislamiento multi-tenant, reembolsos y exclusión mutua.
- **Mitigación requerida:** configurar el destino local exclusivamente a staging; respaldar y comprobar historial de migraciones; aplicar solo las migraciones 0010/0011; ejecutar pruebas de integración y regresión con datos de prueba.
- **Estado:** bloquea la aprobación de release. No hay `.env.local` configurado en este workspace.

### R-07 — Android y recorrido end-to-end sin validar

- **Severidad:** Alta para release.
- **Impacto:** la corrección del escaneo QR no está verificada en una APK construida ni en un recorrido completo móvil/API/web.
- **Mitigación requerida:** usar JDK/Android SDK compatibles; ejecutar tests y lint Android; compilar e instalar una APK de prueba; completar los casos de [QA.md](./QA.md) en staging.
- **Estado:** pendiente; no se publicó APK.

## Riesgos operativos

- `scripts/apply-all-migrations.py` aplica todas las migraciones y semillas usando `.env.local`; no usarlo como atajo. Revisar y ejecutar únicamente migraciones autorizadas en staging.
- `origin/master` contiene un workflow de Vercel que despliega a producción al hacer push a `main`/`master`, o manualmente. Esta estabilización no debe fusionarse ni activar ese workflow antes de completar la aprobación de release.
- `Member.gymId` continúa existiendo por compatibilidad; no debe reintroducirse como fuente de autorización.
- `infra/supabase/migrations/0009_admin_accounts.sql` permanece sin cambios porque no se conoce su estado en entornos compartidos.

## Decisiones registradas

1. Precio del plan definido en servidor como fuente de verdad; descuentos no modelados no admitidos.
2. Reembolso total revoca la membresía asociada.
3. Aforo atómico compartido por check-in QR y manual.
4. Reintento idempotente seguro: mismo payload devuelve el mismo pago; distinto payload entra en conflicto; fallos sin efectos permiten reintentar.
5. Folio atómico por gimnasio y año.
6. Staging disponible, pero hace falta configurar y verificar localmente su destino antes de cualquier migración o prueba de base de datos.
