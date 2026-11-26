# Procedimiento de rotación de credenciales

## Alcance

Este runbook es para el responsable autorizado del entorno. No contiene
credenciales ni ejecuta cambios. La rotación de cuentas de producción debe
realizarla su responsable desde un entorno seguro; no compartir secretos por
chat, tickets, logs ni commits.

La API actual no implementa una pantalla ni un endpoint de cambio/restablecimiento
de contraseña. Las rutas de autenticación están en
`apps/api/src/modules/auth/routes.ts`. Las contraseñas se almacenan con scrypt
mediante `hashPassword()` en `apps/api/src/shared/password.ts`; no escribir
contraseñas en texto plano en la base de datos.

## Preparación

1. Identificar las cuentas afectadas a partir del commit/documento que expuso
   credenciales, sin copiar sus valores a este runbook.
2. Separar cuentas de producción, staging y demo. No reutilizar contraseñas
   entre ambientes. Desactivar las cuentas demo que no sean necesarias.
3. Generar para cada cuenta una contraseña única con un gestor de contraseñas.
   No pasarla en argumentos de shell, variables de entorno, historial de
   comandos o logs.
4. Confirmar con el responsable el entorno y la base de datos destino. Probar
   primero en staging con cuentas de prueba; nunca ejecutar un procedimiento
   sin verificar el destino.

## Restablecimiento controlado

Como no existe flujo de reset en la aplicación, un mantenedor debe preparar y
revisar un procedimiento temporal que:

1. Identifique la cuenta de forma inequívoca y actualice solo su `passwordHash`
   usando `hashPassword()` del proyecto.
2. Persista la actualización mediante Prisma y una transacción. No aceptar una
   contraseña vacía ni incluirla en mensajes de error o auditoría.
3. Revoque todos los refresh tokens/sesiones de esa cuenta. Para socios, revisar
   también las filas `MemberSession`; para staff, las filas `RefreshToken`.
   Mantener la invalidación de usuario/token compatible con el middleware de
   autenticación.
4. Registre actor, cuenta objetivo de forma no sensible, fecha, entorno y
   resultado, pero nunca el secreto nuevo ni su hash.
5. Si el procedimiento falla, no restaurar la contraseña expuesta. Generar otra
   contraseña nueva y repetir el proceso después de revisar el error.

No ejecutar SQL manual con la contraseña, no editar el hash directamente a mano
y no guardar el script temporal en Git con valores reales. Si no se puede
garantizar la revocación de sesiones, suspender la cuenta y escalar antes de
reactivarla.

## Verificación posterior

- Confirmar que la contraseña anterior ya no permite iniciar sesión.
- Confirmar que la contraseña nueva permite el inicio de sesión autorizado.
- Confirmar que los refresh tokens y sesiones anteriores son rechazados.
- Revisar los registros de acceso por actividad no reconocida.
- Actualizar el gestor de contraseñas del responsable; no enviar el secreto al
  usuario por un canal no aprobado.
- Si una contraseña fue reutilizada fuera del sistema, cambiarla también en
  cada servicio afectado.

## Tokens de infraestructura

Este proceso aplica a contraseñas de cuentas de la aplicación. Para tokens de
Vercel, base de datos u otros proveedores:

1. Rotar únicamente si se confirma que el valor real fue expuesto.
2. Revocar primero el token/credencial anterior en el proveedor.
3. Crear un reemplazo con alcance mínimo y expiración cuando sea posible.
4. Guardarlo solo en el gestor de secretos correspondiente y comprobar el
   servicio sin imprimir su valor.

## Estado de esta tarea

- No se ha restablecido ninguna cuenta.
- No se ha ejecutado código ni migración contra producción o staging.
- La redacción del documento operativo no elimina el commit sensible anterior
  del historial remoto. Rotar los valores no sustituye la limpieza coordinada
  del historial.
