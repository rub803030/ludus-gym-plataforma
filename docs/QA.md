# QA funcional y de integración

## Alcance y criterio de ejecución

Esta guía valida el flujo prioritario de Ludus GYM: alta y aprobación del gimnasio, afiliación del socio, membresía pagada y acceso diario por recepción. Ejecutar los casos end-to-end en un entorno de staging con base de datos y cuentas de prueba; no usar datos ni servicios de producción.

Cada caso registra objetivo, precondiciones, pasos, resultado esperado, resultado real y estado. Usar `PASS`, `FAIL` o `PENDIENTE`; no marcar como PASS un caso no ejecutado. Los casos con resultado pendiente requieren completar el campo de resultado real durante la prueba.

## Flujo propietario

### Registro de gimnasio

#### P-01 — Crear gimnasio y cuenta de propietario

- **Objetivo:** comprobar que el alta crea propietario y gimnasio asociado, inicialmente pendiente.
- **Precondiciones:** correo de prueba no registrado; API disponible.
- **Pasos:** abrir “Registrar gimnasio” desde login; completar datos válidos; enviar.
- **Resultado esperado:** se crean propietario y gimnasio; el propietario pertenece al gimnasio y este queda pendiente de verificación/aprobación.
- **Resultado real:** No ejecutado en staging.
- **Estado:** PENDIENTE.

#### P-02 — Verificar correo del propietario

- **Objetivo:** activar la verificación del propietario sin aprobar automáticamente el gimnasio.
- **Precondiciones:** P-01 completado; correo de verificación disponible.
- **Pasos:** abrir el enlace; volver a consultar el estado del propietario y del gimnasio.
- **Resultado esperado:** `emailVerified` queda confirmado; el gimnasio conserva estado pendiente hasta aprobación administrativa.
- **Resultado real:** No ejecutado en staging.
- **Estado:** PENDIENTE.

#### P-03 — Aprobar gimnasio con autorización administrativa

- **Objetivo:** asegurar que solo un administrador autenticado pueda aprobar y que el propietario haya verificado su correo.
- **Precondiciones:** gimnasio pendiente; probar sesión ADMIN, OWNER sin privilegios y sesión anónima.
- **Pasos:** intentar aprobar con cada sesión; repetir con propietario verificado y no verificado.
- **Resultado esperado:** anónimo y OWNER reciben rechazo; ADMIN puede aprobar únicamente después de verificar al propietario; el token de aprobación no puede reutilizarse.
- **Resultado real:** No ejecutado end-to-end. La ruta ahora exige sesión y rol ADMIN; la aprobación comprueba la verificación del propietario.
- **Estado:** PENDIENTE.

### Verificación

#### P-04 — Generar QR y código de afiliación reales

- **Objetivo:** comprobar que la consola presenta credenciales utilizables del gimnasio activo.
- **Precondiciones:** gimnasio aprobado; sesión de propietario autenticada.
- **Pasos:** abrir Configuración; copiar el código; mostrar y descargar el QR; escanearlo desde la app.
- **Resultado esperado:** código público y QR corresponden al gimnasio aprobado; no aparece un QR de marcador como `LUDUS-GYM`; gimnasios pendientes no muestran credenciales activas.
- **Resultado real:** No ejecutado end-to-end; lint web exitoso.
- **Estado:** PENDIENTE.

### Configuración

#### P-05 — Mantener consistencia de configuración

- **Objetivo:** confirmar que los datos y las credenciales mostradas corresponden al mismo gimnasio.
- **Precondiciones:** propietario con acceso a un gimnasio activo.
- **Pasos:** abrir Configuración, actualizar datos permitidos y volver a cargar la vista.
- **Resultado esperado:** los datos persisten y el QR/código permanecen vinculados al gimnasio actual.
- **Resultado real:** No ejecutado en staging.
- **Estado:** PENDIENTE.

### Gestión de staff

#### P-06 — Invitar y limitar al staff al gimnasio

- **Objetivo:** verificar que el personal operativo queda asociado al tenant correcto.
- **Precondiciones:** propietario autenticado en gimnasio activo.
- **Pasos:** crear un usuario de recepción; iniciar sesión con su cuenta; intentar consultar socios y pagos de otro gimnasio.
- **Resultado esperado:** el staff accede solo a funciones autorizadas y a datos del gimnasio asignado.
- **Resultado real:** No ejecutado en staging.
- **Estado:** PENDIENTE.

## Flujo socio

### Registro

#### S-01 — Crear cuenta global

- **Objetivo:** permitir registro móvil antes de elegir gimnasio.
- **Precondiciones:** correo de prueba no registrado.
- **Pasos:** registrarse desde la app; consultar la cuenta antes de afiliarse.
- **Resultado esperado:** se crea una cuenta global pendiente de verificación; no se inventa una afiliación ni se usa `Member.gymId` como sustituto.
- **Resultado real:** No ejecutado end-to-end.
- **Estado:** PENDIENTE.

### Verificación

#### S-02 — Verificar correo del socio

- **Objetivo:** activar la cuenta global después de confirmar el correo.
- **Precondiciones:** S-01 completado.
- **Pasos:** abrir el enlace de verificación; iniciar sesión nuevamente.
- **Resultado esperado:** la cuenta queda verificada/activa y puede continuar sin quedar afiliada automáticamente.
- **Resultado real:** No ejecutado end-to-end.
- **Estado:** PENDIENTE.

### Vinculación

#### S-03 — Afiliar socio mediante código o QR

- **Objetivo:** crear o reactivar la relación GymMembership y establecer el contexto activo.
- **Precondiciones:** cuenta de socio activa; gimnasio aprobado; código/QR válido.
- **Pasos:** escanear QR o introducir código; confirmar la afiliación; revisar gimnasios disponibles.
- **Resultado esperado:** afiliación activa para el gimnasio correcto; contexto de sesión apunta a ese gimnasio; segunda solicitud no duplica la relación.
- **Resultado real:** Prueba automatizada del endpoint ejecutada con Prisma simulado: alta transaccional y emisión de sesión aprobadas. Falta validar contra staging.
- **Estado:** PASS (automatizada; no end-to-end).

#### S-04 — Rechazar afiliación inválida o duplicada

- **Objetivo:** dar feedback claro y conservar la afiliación previa.
- **Precondiciones:** cuenta activa; probar código inexistente, QR malformado y relación previamente suspendida.
- **Pasos:** enviar cada credencial; revisar respuesta y relaciones almacenadas.
- **Resultado esperado:** código inexistente y QR inválido producen error explícito; no se crean filas; una afiliación suspendida no se reactiva silenciosamente.
- **Resultado real:** No ejecutado end-to-end.
- **Estado:** PENDIENTE.

### Membresía

#### S-05 — Cobrar y asociar el plan al gimnasio correcto

- **Objetivo:** registrar una membresía pagada local al tenant.
- **Precondiciones:** socio afiliado; plan activo del gimnasio; usuario de recepción autorizado.
- **Pasos:** registrar pago; consultar la membresía, el pago y el estado del socio.
- **Resultado esperado:** pago y membresía pertenecen al mismo gimnasio; el pago apunta al registro de membresía; el cobro no reactiva una cuenta global suspendida.
- **Resultado real:** No ejecutado contra base de datos.
- **Estado:** PENDIENTE.

### QR de acceso

#### S-06 — Emitir QR de acceso

- **Objetivo:** permitir QR de acceso solo para una cuenta activa, afiliación local activa y plan vigente.
- **Precondiciones:** socio afiliado con membresía pagada y vigente.
- **Pasos:** solicitar QR; verificarlo desde recepción; intentar emitirlo sin plan vigente.
- **Resultado esperado:** QR emitido para el gimnasio activo; sin afiliación o plan vigente, API devuelve error específico y no un QR de éxito.
- **Resultado real:** Pruebas unitarias de política de acceso pasan; flujo QR end-to-end pendiente.
- **Estado:** PENDIENTE.

## Flujo recepción

#### R-01 — Alta presencial desde recepción

- **Objetivo:** evitar Member huérfano sin GymMembership.
- **Precondiciones:** recepción autenticada en gimnasio activo; correo nuevo.
- **Pasos:** crear socio desde la consola; consultar socio y afiliación dentro del mismo gimnasio.
- **Resultado esperado:** Member y GymMembership activa se crean en una transacción; si falla cualquiera, no queda un alta parcial.
- **Resultado real:** Prueba automatizada del endpoint ejecutada con Prisma simulado: ambas escrituras usan una sola transacción.
- **Estado:** PASS (automatizada; no end-to-end).

#### R-02 — Cobro y renovación

- **Objetivo:** mantener plan, pago y fechas dentro del mismo gimnasio.
- **Precondiciones:** socio afiliado; plan vigente o vencido del gimnasio.
- **Pasos:** realizar cobro con importe distinto al precio del plan; repetir con el importe correcto; renovar antes y después del vencimiento; consultar el historial.
- **Resultado esperado:** el servidor calcula el cobro desde el precio del plan; pago y membresía pertenecen al mismo gimnasio; fechas coherentes; una cuenta global suspendida no se reactiva.
- **Resultado real:** pruebas automatizadas con Prisma simulado cubren cálculo de precio y período; flujo con PostgreSQL pendiente.
- **Estado:** PASS (automatizada; no end-to-end).

#### R-03 — Check-in QR y manual

- **Objetivo:** aplicar la misma autorización a los dos métodos de acceso.
- **Precondiciones:** recepción autenticada en el tenant activo; socio con estados conocidos.
- **Pasos:** validar QR y registrar check-in manual; repetir con cuenta, afiliación y plan no vigentes.
- **Resultado esperado:** ambos métodos permiten únicamente cuenta activa + afiliación local activa + plan vigente del gimnasio; el rechazo incluye motivo real.
- **Resultado real:** Pruebas unitarias de la política pasan; check-in end-to-end pendiente.
- **Estado:** PENDIENTE.

#### R-04 — Reembolso total

- **Objetivo:** evitar que un pago reembolsado conserve acceso vigente.
- **Precondiciones:** socio afiliado con pago y membresía asociados.
- **Pasos:** reembolsar el pago; consultar el pago, movimiento de caja y membresía; volver a solicitar acceso.
- **Resultado esperado:** reembolso y revocación de la membresía asociada se confirman en una transacción; el acceso se deniega. Un reembolso legacy ambiguo no se completa silenciosamente.
- **Resultado real:** cubierto por pruebas automatizadas con Prisma simulado; flujo PostgreSQL pendiente.
- **Estado:** PASS (automatizada; no end-to-end).

#### R-05 — Reintento idempotente de cobro

- **Objetivo:** evitar cobros duplicados y permitir reintentar después de una transacción fallida.
- **Precondiciones:** socio afiliado y plan activo.
- **Pasos:** enviar dos veces la misma solicitud con la misma clave; repetir la clave con payload diferente; simular un fallo transaccional y reintentar.
- **Resultado esperado:** el mismo payload devuelve el mismo pago; payload diferente produce conflicto; una transacción fallida no reserva permanentemente la clave.
- **Resultado real:** cubierto por pruebas automatizadas con Prisma simulado; concurrencia real pendiente.
- **Estado:** PASS (automatizada; no end-to-end).

#### R-06 — Folio de recibo concurrente

- **Objetivo:** emitir folios únicos por gimnasio y año aun con cobros simultáneos.
- **Precondiciones:** esquema actualizado en PostgreSQL de staging y dos solicitudes de cobro concurrentes.
- **Pasos:** emitir cobros concurrentes; revisar folios, pagos y contador por gimnasio/año.
- **Resultado esperado:** no hay colisiones ni pérdida de folios; cada pago tiene un recibo único del gimnasio correcto.
- **Resultado real:** no ejecutado; migración y concurrencia PostgreSQL pendientes.
- **Estado:** PENDIENTE.

#### R-07 — Límite de aforo concurrente

- **Objetivo:** impedir que check-in QR y manual excedan el aforo configurado.
- **Precondiciones:** gimnasio con aforo cercano al límite; PostgreSQL de staging.
- **Pasos:** enviar en paralelo accesos QR y manual hasta superar el límite; revisar accesos aceptados y ocupación.
- **Resultado esperado:** ambas vías comparten bloqueo transaccional; no se acepta acceso por encima del límite.
- **Resultado real:** la política unitaria pasa; concurrencia PostgreSQL pendiente.
- **Estado:** PENDIENTE.

## Flujo multi gimnasio

#### MT-01 — Cambiar gimnasio activo

- **Objetivo:** cambiar contexto sin mezclar membresías ni datos.
- **Precondiciones:** socio afiliado a dos gimnasios activos.
- **Pasos:** cambiar al segundo gimnasio; consultar perfil, QR y pagos.
- **Resultado esperado:** token/contexto y datos reflejan el segundo gimnasio; el gimnasio anterior permanece intacto.
- **Resultado real:** No ejecutado en staging.
- **Estado:** PENDIENTE.

#### MT-02 — Vinculación múltiple

- **Objetivo:** permitir afiliaciones distintas por gimnasio para una misma cuenta global.
- **Precondiciones:** socio global activo y dos gimnasios activos.
- **Pasos:** afiliar al socio a ambos; suspender solo la relación del primero.
- **Resultado esperado:** relación suspendida en un gimnasio no suspende la cuenta ni la afiliación del otro.
- **Resultado real:** No ejecutado end-to-end.
- **Estado:** PENDIENTE.

#### MT-03 — Cobros aislados

- **Objetivo:** impedir que planes y pagos de otro tenant habiliten acceso.
- **Precondiciones:** socio afiliado a dos gimnasios; plan pagado solo en uno.
- **Pasos:** consultar pagos y solicitar QR en ambos gimnasios.
- **Resultado esperado:** solo el gimnasio con plan vigente acepta el acceso; cada reporte muestra únicamente los pagos de su tenant.
- **Resultado real:** No ejecutado contra base de datos.
- **Estado:** PENDIENTE.

#### MT-04 — Consultas aisladas

- **Objetivo:** evitar que el legado `Member.gymId` exponga datos entre gimnasios.
- **Precondiciones:** socio con relación GymMembership en un gimnasio y `Member.gymId` apuntando a otro.
- **Pasos:** listar, consultar detalle, rutina, nutrición, pagos y métricas desde ambos tenants.
- **Resultado esperado:** la relación GymMembership gobierna el alcance; no hay acceso por coincidencia de `Member.gymId`.
- **Resultado real:** No ejecutado end-to-end.
- **Estado:** PENDIENTE.

## Casos negativos

#### N-01 — QR de afiliación inválido

- **Objetivo:** rechazar una firma o contenido inválido sin ocultar fallos de infraestructura.
- **Precondiciones:** app en línea.
- **Pasos:** escanear un QR alterado; repetir con una credencial válida mientras la API devuelve un error interno.
- **Resultado esperado:** QR inválido devuelve error de validación; errores de API no se convierten en “gimnasio no encontrado”.
- **Resultado real:** No ejecutado end-to-end.
- **Estado:** PENDIENTE.

#### N-02 — QR de acceso expirado/reutilizado

- **Objetivo:** denegar QR de acceso vencido o ya utilizado cuando aplique.
- **Precondiciones:** QR de acceso vencido o con nonce usado.
- **Pasos:** validar desde recepción.
- **Resultado esperado:** acceso denegado con motivo de expiración/replay; no se registra check-in aprobado.
- **Resultado real:** Pruebas unitarias existentes de QR/replay pasan; validación física pendiente.
- **Estado:** PENDIENTE.

#### N-03 — Socio sin membresía pagada

- **Objetivo:** impedir acceso por tener solo afiliación.
- **Precondiciones:** afiliación activa y ningún plan pagado vigente.
- **Pasos:** solicitar QR y probar check-in manual y por QR.
- **Resultado esperado:** ambas vías deniegan el acceso como `NO_MEMBERSHIP`.
- **Resultado real:** Política unitaria cubierta; flujo real pendiente.
- **Estado:** PENDIENTE.

#### N-04 — Socio sin afiliación

- **Objetivo:** impedir acceso heredado por `Member.gymId`.
- **Precondiciones:** socio con `Member.gymId` configurado pero sin fila GymMembership.
- **Pasos:** solicitar QR y probar check-in.
- **Resultado esperado:** no se emite QR ni se permite el acceso; la API solicita afiliación válida.
- **Resultado real:** Política unitaria cubierta; caso de datos reales pendiente.
- **Estado:** PENDIENTE.

#### N-05 — Gimnasio inactivo

- **Objetivo:** bloquear afiliación y acceso en gimnasio pendiente, suspendido o eliminado.
- **Precondiciones:** gimnasio en cada estado no activo.
- **Pasos:** intentar afiliar socio, emitir QR y registrar acceso.
- **Resultado esperado:** operación denegada con error explícito; no se crea afiliación activa.
- **Resultado real:** No ejecutado end-to-end.
- **Estado:** PENDIENTE.

#### N-06 — Usuario global o afiliación local suspendidos

- **Objetivo:** distinguir suspensión de cuenta y suspensión específica de gimnasio.
- **Precondiciones:** probar `Member.status=SUSPENDED` y `GymMembership.status=SUSPENDED`.
- **Pasos:** solicitar sesión, QR y check-in en uno o más gimnasios.
- **Resultado esperado:** suspensión global bloquea todos; suspensión GymMembership bloquea solo ese gimnasio.
- **Resultado real:** La política unitaria cubre cuenta y afiliación suspendidas; pruebas con datos reales pendientes.
- **Estado:** PENDIENTE.

## Casos de regresión

#### RG-01 — Flujos existentes de autenticación, permisos y QR

- **Objetivo:** detectar regresiones en CSRF, RBAC, QR de acceso y verificación de correo.
- **Precondiciones:** dependencias instaladas.
- **Pasos:** ejecutar `corepack pnpm --filter @ludus/shared build`, los tests y typechecks de API/shared, `corepack pnpm --filter @ludus/web lint` y `corepack pnpm --filter @ludus/web build`.
- **Resultado esperado:** suites y comprobaciones completan correctamente.
- **Resultado real:** API: 47 pruebas en 12 archivos aprobadas; build/typecheck shared, typecheck API, lint web y build web aprobados. No son pruebas contra PostgreSQL.
- **Estado:** PASS (automatizado; repetir después de cada cambio).

#### RG-02 — Android

- **Objetivo:** comprobar build y pruebas del flujo de QR en Android.
- **Precondiciones:** JDK compatible con Gradle, Android SDK y dependencias disponibles.
- **Pasos:** ejecutar `:app:testDebugUnitTest` y `:app:lintDebug`; compilar APK de prueba y validar instalación.
- **Resultado esperado:** pruebas, lint y APK completan con la versión de código esperada.
- **Resultado real:** No ejecutado en esta sesión; Java/Gradle no disponibles localmente.
- **Estado:** PENDIENTE.
