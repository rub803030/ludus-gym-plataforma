# Runbook — Rotación de secretos

Afecta a `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `QR_HMAC_SECRET`, `FIELD_ENCRYPTION_KEY`, `CSRF_SECRET`, credenciales de Supabase y `LUDUS_RELEASE_*`.

## Generar valores nuevos

```powershell
node -e "const c=require('crypto'); console.log('JWT_ACCESS_SECRET='+c.randomBytes(32).toString('hex')); console.log('JWT_REFRESH_SECRET='+c.randomBytes(32).toString('hex')); console.log('QR_HMAC_SECRET='+c.randomBytes(32).toString('hex')); console.log('CSRF_SECRET='+c.randomBytes(32).toString('hex')); console.log('FIELD_ENCRYPTION_KEY=base64:'+c.randomBytes(32).toString('base64'))"
```

## Procedimiento

1. Notificar la ventana de mantenimiento: rotar `FIELD_ENCRYPTION_KEY` **invalida el acceso** a notas médicas ya cifradas.
2. Actualizar los secretos en el proveedor de hosting (Vercel/Fly/Railway) y en `.env` local.
3. Para `FIELD_ENCRYPTION_KEY`, primero descifrar y re-cifrar los campos con la clave nueva mediante un job de migración; nunca cambiarla en caliente.
4. Rotar `JWT_*` cierra todas las sesiones: los usuarios deben iniciar sesión de nuevo.
5. Rotar `QR_HMAC_SECRET` invalida los pases QR y la credencial offline; avisar a los socios.
6. Reiniciar API y verificar `/health`, login web, login móvil y cobro de prueba.
7. Si la rotación es por incidente, revisar `audit_logs` en busca de accesos con el secreto comprometido.

## Registro

Anotar fecha, secretos rotados, responsable y resultado. Nunca pegar los valores en el ticket.
