# Runbook — Incidente de cobros y caja

## Reglas críticas

- Todo cobro envía `Idempotency-Key`. Un reintento con la misma llave devuelve `409` y **nunca** genera un cargo doble.
- Nunca borrar un `payment`. Usar reembolso y dejar auditoría.
- Un `cash_session` debe cerrarse con cuadre; si hay diferencia, documentarla en `notes`.

## Síntomas

| Síntoma | Acción |
| --- | --- |
| Cliente cobrado dos veces | Buscar por `receiptNumber` en **Caja → Pagos**. Si hay dos llaves distintas, se hicieron dos cobros reales: reembolsar el segundo. |
| `409 CONFLICT` al cobrar | Es idempotencia funcionando. Verificar el recibo existente antes de reintentar con llave nueva. |
| Diferencia al cerrar caja | Revisar `cash_movements` del turno y comparar con pagos. Registrar la diferencia en `notes`. |
| Recibo no generado | Revisar la cola BullMQ/Redis y reintentar el envío; el `payment` ya quedó registrado. |

## Pasos

1. Identificar `paymentId`, `memberId` e `idempotencyKey`.
2. Consultar `GET /api/members/:id/payments` y `GET /api/reports/cash`.
3. Si Redis cayó, la idempotencia pasó a memoria: **no reintentar cobros hasta restaurarlo** (puede haber duplicados entre réplicas).
4. Aplicar reembolso desde la consola y verificar el asiento en `cash_movements`.
5. Escalar a soporte con los identificadores y la hora exacta.

## Prevención

Verificar en el dashboard que `REDIS_URL` esté configurado y que no haya errores de conexión en los logs de la API.
