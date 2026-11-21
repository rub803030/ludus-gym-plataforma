# Guía de uso — Ludus GYM

## Para el equipo (consola web)

### Ingreso
Abrir la web e iniciar sesión con una cuenta de **OWNER**, **MANAGER** o **STAFF**.
Los socios no pueden ingresar aquí; la app rechaza explícitamente sus credenciales.
Al crear una cuenta se envía un correo de confirmación: hay que abrir el enlace antes
de poder entrar. Si no llegó, usa **Reenviar correo** en la pantalla de acceso.

### Operación diaria

| Pantalla | Qué hace | Quién puede usarla |
| --- | --- | --- |
| Dashboard | Aforo en vivo, ingresos del día, vencimientos | Todos |
| Socios | Buscar, alta, editar, ver historial y notas médicas | STAFF (lectura) / MANAGER+ (edición) |
| Caja | Cobrar mensualidades, generar recibo, evitar doble cobro | Todos |
| Acceso | Check-in manual y verificación de QR | Todos |
| Rutinas | Asignar entrenamiento y plan nutricional | MANAGER+ |
| Tarifas | Crear/editar planes | OWNER |
| Equipo | Alta, suspensión y permisos del personal | OWNER |
| Reportes | Cortes de caja, auditoría y métricas | OWNER |

### Cobros
1. Buscar al socio por nombre, código o documento.
2. Elegir plan, monto y método de pago.
3. Confirmar. El sistema bloquea el botón durante el cobro y usa una llave de idempotencia para que un doble clic nunca genere dos cargos.
4. Se muestra el recibo con folio y un QR escaneable del comprobante.

### Check-in
- Escannear el QR dinámico del socio (rota cada 30 s), o buscarlo manualmente y marcar **Check-in**.
- Si la membresía está vencida, el sistema indica desde cuándo y ofrece renovar en el mismo flujo.
- Si el gimnasio está lleno, el acceso se deniega con el motivo.

## Para socios (app Android)

1. Confirmar el correo enviado al dar de alta la cuenta (en demo: `rubnlira2+socio@gmail.com` / `Ludus2026!`). Si el enlace no abre en la app, se puede pegar el código en la pantalla de verificación o abrir la web.
2. **Inicio**: estado de membresía y días restantes.
3. **QR**: pase dinámico con cuenta regresiva. Si no hay red, se muestra una credencial firmada válida por 10 minutos.
4. **Rutina**: series del día, peso y RPE. Funciona sin conexión; sincroniza después.
5. **Nutrición**: macros y comidas del plan.
6. **Reservas**: clases Hyrox, cupo y cancelación.

## Solución de problemas rápida

| Síntoma | Acción |
| --- | --- |
| "Tu correo aún no está verificado" | Abre el enlace del correo, revisa spam o pulsa **Reenviar correo** / **Reenviar** en la app. |
| "La licencia fue revocada" | El OWNER suspendió la cuenta; vuelve a iniciar sesión tras reactivarla. |
| "Token CSRF inválido" | Recarga la página y vuelve a intentar. |
| "Esta operación ya fue procesada" | El cobro ya se registró; revisa el recibo antes de repetir. |
| QR en rojo | El código rotó; actualiza la pantalla del socio. |
| App sin datos | Revisa conexión; la rutina y la credencial offline siguen disponibles. |
