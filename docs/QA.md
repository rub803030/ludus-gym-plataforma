================================================================================
QA - LUDUS GYM / RESCATE release-ready
================================================================================

Fecha: 2026-11-27
Rama: rescue/release-ready
Estado: NO APTO PARA PRODUCCION. Las columnas "Ejecutado" son evidencia real;
        las columnas "Pendiente" NO se han corrido y no cuentan como aprobadas.

Regla: un escenario solo pasa a "Ejecutado" con comando + resultado observable.
       No se usa "PENDIENTE" para ocultar un fallo ni se marca verde por inferencia.

--------------------------------------------------------------------------------
1. VALIDACION LOCAL EJECUTADA (evidencia real)
--------------------------------------------------------------------------------

ID      Comando                                   Resultado
------  ----------------------------------------  --------------------------------
L-01    pnpm --filter @ludus/api db:generate      OK - Prisma Client 5.22.0 generado
L-02    pnpm typecheck                            OK - 4 tareas, 3 paquetes
L-03    pnpm lint                                 OK - 3 paquetes
L-04    pnpm test                                 OK - 53 pruebas (40 API + 13 shared)
L-05    pnpm build                                OK - 21 rutas web + API compila
L-06    git diff --check                          OK - sin whitespace roto
L-07    git log -1 --format='%an <%ae>%n%b'       OK - autor rub803030 + 2 trailers

Nota: el conteo incluye 4 pruebas nuevas de readiness; las 3 del contrato monetario
ya estaban en el ciclo anterior. Los avisos LF -> CRLF de Git en Windows no son
errores de contenido.

--------------------------------------------------------------------------------
2. MATRIZ FUNCIONAL
--------------------------------------------------------------------------------

ID      Escenario                                 Esperado                              Estado
------  ----------------------------------------  ------------------------------------  ------------------
F-01    QR de otro gimnasio                       CROSS_GYM_PASS, sin registro          Pendiente staging
F-02    Socio sin afiliacion local                NO_GYM, sin acceso                    Pendiente staging
F-03    Gimnasio inactivo                         GYM_NOT_ACTIVE                        Pendiente staging
F-04    Cuenta sin verificar                      EMAIL_NOT_VERIFIED                    Pendiente staging
F-05    Socio activo en dos gimnasios             Membresia propia por plan.gymId       Pendiente staging
F-06    Aforo concurrente QR vs manual            Un solo pase por encima del limite    Pendiente staging
F-07    Check-in manual sin afiliacion            Rechazado, sin usar Member.gymId      Pendiente staging
F-08    Cobro en pesos con 2 decimales            200.00 -> 20000 centavos              Ejecutado (unitario)
F-09    Cobro con importe distinto del plan       400 VALIDATION_ERROR                  Ejecutado (unitario)
F-10    Cobro duplicado con misma Idempotency-Key Misma respuesta, un solo cargo       Pendiente staging
F-11    Fallo ambiguo de cobro                    Misma clave reutilizable              Ejecutado (codigo)
F-12    Folios concurrentes por gym/anio          Consecutivos, sin duplicado          Pendiente staging
F-13    Reembolso                                  Afecta solo el gym correcto          Pendiente staging
F-14    Token de verificacion reutilizado         400 VERIFICATION_TOKEN_INVALID       Pendiente staging
F-15    Token de aprobacion concurrente            Solo un ADMIN lo consume            Pendiente staging
F-16    Enlace completo pegado en /verify-email   Extrae token y verifica              Ejecutado (typecheck)
F-17    Sincronizacion offline POST /events       JWT + HMAC + gym, dedupe por bucket   Pendiente staging
F-18    Evento offline de otro gimnasio           CROSS_GYM_PASS                       Pendiente staging
F-19    Login MEMBER en app movil                 OK; STAFF/OWNER/MANAGER -> 401       Pendiente staging
F-20    Credenciales demo en release              No presentes                         Ejecutado (codigo)
F-21    Cabecera Idempotency-Key corta            400 VALIDATION_ERROR                  Ejecutado (codigo)
F-22    Presign sin sha256/magicBytes             400 VALIDATION_ERROR                  Ejecutado (codigo)

--------------------------------------------------------------------------------
3. SEGURIDAD
--------------------------------------------------------------------------------

ID      Escenario                                 Estado
------  ----------------------------------------  ----------------------------
S-01    WS sin token no conecta                   Pendiente staging
S-02    WS suscrito a otro gym es rechazado       Pendiente staging
S-03    access:granted solo en sala del gym       Pendiente staging
S-04    X-Forwarded-For falsificado no evada      Pendiente staging
S-05    S3 HTTP o claves iguales en produccion    Falla cerrado - Ejecutado (4 tests)
S-06    Secretos verificados por nombre/digest    Pendiente rotacion del responsable
S-07    /admin/gyms solo ADMIN                    Ejecutado (gate servidor + requireAdmin)
S-08    Matriz RBAC unica (@ludus/shared)         Ejecutado (typecheck + build)
S-09    /health/ready degrada sin BD/Redis        Ejecutado (4 tests); falta en vivo

--------------------------------------------------------------------------------
4. MIGRACIONES (archivos listos, NO aplicados)
--------------------------------------------------------------------------------

0010_backfill_gym_memberships.sql     Aplicada en staging - OK
0011_payment_stability.sql            Aplicada en staging - OK (GROUP BY corregido)
0012_security_hardening.sql           Aplicada en staging - OK
0013_access_events_tenant.sql         Aplicada en staging - OK

Evidencia de verificacion en staging (2026-11-27, proyecto nwewdakwdrmiffrbvwuj):
  - Backup logico previo: 28 tablas / 283 filas en %TEMP%
  - socios sin afiliacion = 0
  - receipt_counters = 1 fila, ultimo folio 8 (8 recibos validos)
  - politica RLS tenant_isolation presente en receipt_counters
  - audit_logs_default con bound DEFAULT presente
  - constraint access_event_dedupe = 0, indice ux_access_event_dedupe_tenant = 1

PENDIENTE: aplicarlas en produccion con snapshot previo antes del deploy.

Prohibido: scripts/apply-all-migrations.py en BD real (reaplica seeds y
sobrescribe verificaciones). No ejecutar en produccion sin snapshot previo.

--------------------------------------------------------------------------------
5. DESPLIEGUE
--------------------------------------------------------------------------------

D-01    Workflow Deploy web con vercel@67.0.0     Codigo listo, pendiente ejecutar
D-02    /privacidad, /approve-gym, /admin/gyms    Hoy 404 en vivo; verificar tras deploy
D-03    Commit desplegado == HEAD de la rama      Pendiente
D-04    fly deploy explicito + /health con codigo Pendiente (no hay job automatico)
D-05    /health/ready responde 200 en staging     Pendiente

--------------------------------------------------------------------------------
6. MOVIL
--------------------------------------------------------------------------------

M-01    Android testDebugUnitTest                 Bloqueado: no hay JDK en la maquina
M-02    Android lintDebug                          Bloqueado: no hay JDK en la maquina
M-03    APK firmada versionCode=5                  Pendiente: requiere keystore y JDK
M-04    SHA-256 documentado                        Pendiente tras regenerar
M-05    iOS xcodebuild test/archive                 Bloqueado: sin macOS/Xcode;
                                                    LudusGYM.xcodeproj danado (exit 74)
                                                    iOS queda en espera por decision.

APK servida actualmente NO coincide con la local: no se toma como evidencia de release.

--------------------------------------------------------------------------------
7. CRITERIOS DE SALIDA (todos deben cumplirse para APTO)
--------------------------------------------------------------------------------

[ ] G1 migraciones aplicadas y verificadas en staging
[ ] G2 secretos rotados por el responsable (verificacion por digest)
[ ] G3 web y API desplegadas con el commit de esta rama
[ ] G4 matriz F-01..F-22 ejecutada en staging con PostgreSQL/Redis reales
[ ] G5 Android compilado y APK firmada con hash documentado
[ ] iOS queda fuera del gate por decision explicita

Hasta que todos esten marcados, el veredicto es NO APTO PARA MERGE/RELEASE.
