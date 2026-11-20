# Runbook — Incidente de acceso / QR

## Síntomas y primera acción

| Síntoma | Primera acción |
| --- | --- |
| El lector no acepta QR vigente | Comparar hora del servidor y del teléfono (el QR rota cada 30 s). |
| Rechazo `409` en `verify-qr` | Es anti-replay: el mismo bucket ya se usó. Pedir un pase nuevo. |
| Socios sin acceso masivo | Revisar estado del socio (`ACTIVE`, `EXPIRED`, `SUSPENDED`) y `membership_period`. |
| La app queda sin conexión | La credencial offline dura 10 min; al volver la señal se sincroniza sola. |

## Pasos

1. Confirmar que `GET /health` devuelve 200 y que la API está conectada a Supabase.
2. Revisar los últimos eventos en **Acceso → Eventos** y el `audit_logs` correspondiente.
3. Verificar que el reloj del servidor esté sincronizado (NTP). Un desfase > 30 s rompe el QR.
4. Si hay `FIELD_ENCRYPTION_KEY` rotada recientemente, revisar el runbook de secretos.
5. Para un socio puntual, usar **Check-in manual** desde la consola y dejar constancia en `notes`.
6. Si persistiera, escalar a soporte con: hora exacta, `memberId`, `deviceId` y código de error.

## Contactos y escalado

- Nivel 1: staff del gimnasio (check-in manual).
- Nivel 2: MANAGER del gimnasio (revisión de membresía).
- Nivel 3: soporte de la plataforma (logs de API y Supabase).

Tiempo objetivo de respuesta: 15 min en horario de operación.
