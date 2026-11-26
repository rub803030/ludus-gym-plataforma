# Configuración centralizada

Toda la configuración del sistema se lee desde un único lugar por aplicación:

| Ámbito | Archivo | Uso |
| --- | --- | --- |
| API | `apps/api/src/config/env.ts` | Base de datos, Redis, secretos, CORS, S3, rate limit y correo transaccional |
| Web | `apps/web/src/config/env.ts` | URL de la API, nombre de la app, entorno |
| Plantilla | `.env.example` | Lista completa de variables con comentarios |
| Despliegue | `.env.local`, Vercel y Fly.io | Valores reales por entorno |

## Cambiar un valor

1. Edita la variable en `.env.example` si es una nueva configuración.
2. Añade la validación en el `envSchema` correspondiente.
3. Configura el valor real en el panel de Vercel (web) o Fly.io (API).
4. Reinicia el servicio. No hace falta tocar el código de los módulos.

Las variables de la web que empiezan con `NEXT_PUBLIC_` se incluyen en el bundle del navegador. **Nunca** pongas secretos ahí.

## URL pública y proxy de la API

La web se publica en una URL HTTPS gratuita de Vercel, por ejemplo:

```text
https://ludus-gym-plataforma.vercel.app
```

La API correspondiente está en:

```text
https://ludus-gym-plataforma-api.fly.dev
```

El navegador siempre llama a rutas relativas `/api/*`. Next.js las redirige al
upstream configurado en `API_UPSTREAM_URL` (la URL de Fly.io). Esto mantiene
las cookies de sesión en el mismo sitio y evita problemas de `SameSite=Strict`
entre dominios distintos.

| Variable | Dónde se configura | Valor en producción |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Vercel | vacío (mismo origen) |
| `API_UPSTREAM_URL` | Vercel | `https://ludus-gym-plataforma-api.fly.dev` |
| `CORS_ORIGIN` | Fly.io | `https://ludus-gym-plataforma.vercel.app` |
| `REDIS_URL` | Fly.io | vacío con una sola instancia; Redis compartido al escalar |
| `S3_*` | Fly.io | Proveedor S3/R2 real configurado en secretos |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Fly.io | Servidor SMTP por defecto para la rotación (por ejemplo `smtp.gmail.com`, `587`, `false`). Sin dominio ni DNS |
| `SMTP_USER`, `SMTP_PASSWORD` | Fly.io (secretos) | Cuenta única alternativa a la rotación. `EMAIL_FROM` debe usar la misma dirección |
| `SMTP_ACCOUNTS` | Fly.io (secreto JSON) | Cuentas `{user,password,from?,host?,port?,secure?}` que se rotan por cupo diario |
| `SMTP_MAX_ACCOUNTS` | Fly.io | Límite de cuentas aceptadas (10 por defecto, máximo 100). Súbelo antes de añadir más |
| `SMTP_DAILY_LIMIT` | Fly.io | Cupo por cuenta y día (300 por defecto). Al agotarse se pasa a la siguiente; al cambiar de día vuelve a la primera |
| `EMAIL_FROM` | Fly.io | Solo se exige que coincida con `SMTP_USER` cuando se usa una cuenta única. Con Resend, remitente verificado (`onboarding@resend.dev` en pruebas) |
| `RESEND_API_KEY` | Fly.io (secreto) | Alternativa a SMTP: clave privada de Resend. En producción se requiere SMTP o Resend |
| `RESEND_TEST_RECIPIENT` | Solo mientras `EMAIL_FROM` use `@resend.dev` | Bandeja del dueño de Resend para probar con cuentas demo. Se ignora con SMTP o remitente verificado |
| `WEB_APP_URL` | Fly.io | URL pública de Vercel usada para construir los enlaces de verificación y autorización |
| `EMAIL_VERIFICATION_TTL_MINUTES` | Fly.io | Vigencia de los enlaces de un solo uso (30 min por defecto) |
| `ADMIN_APPROVAL_EMAILS` | Fly.io | Correos extra que reciben el enlace de autorización de gimnasios (separados por coma). También se envía a las cuentas con rol `ADMIN` |

Si más adelante compras un dominio propio, solo cambia `CORS_ORIGIN` en Fly.io
y añade el dominio en Vercel. El código no se modifica.

## Seguridad aplicada

- La API rechaza el arranque si `CORS_ORIGIN` no es HTTPS o es localhost.
- La API exige `DIRECT_URL` y `CORS_ORIGIN` HTTPS en producción. Sin `REDIS_URL`, el rate limit usa el store local: ello es válido solo con una instancia de la API.
- `FIELD_ENCRYPTION_KEY` debe decodificar exactamente 32 bytes.
- La web añade HSTS, CSP, `X-Frame-Options: DENY` y `Referrer-Policy: no-referrer` en producción.
- Los secretos nunca se versionan: `.env.local`, keystores y builds están ignorados.
- STAFF y SOCIOS deben verificar su correo antes de iniciar sesión: enlace de un solo uso, TTL de 30 minutos, cooldown de reenvío y hash SHA-256 del token en base de datos (nunca el token en claro).
- Con SMTP configurado, el correo de verificación se envía **siempre al correo real del socio**; `RESEND_TEST_RECIPIENT` no se aplica. No requiere dominio propio, verificación DNS ni cambios en Vercel.
- Con `SMTP_ACCOUNTS`, la API reserva cada envío en `email_send_quotas` (migración `0007_email_send_quota.sql`), respeta 300 correos por cuenta y día, salta las cuentas en enfriamiento y devuelve el cupo si el envío falla. Si todas agotaron el cupo, el registro falla con un error claro en vez de enviar a destinos equivocados.
- Para añadir más cuentas solo se actualiza el secreto `SMTP_ACCOUNTS`. Si se pasa del límite actual, sube también `SMTP_MAX_ACCOUNTS` (máximo 100); no hace falta cambiar código ni reprogramar la app.
- Sin SMTP y con `onboarding@resend.dev`, Resend solo entrega a la dirección propietaria de la cuenta (403 para cualquier otro destinatario); `RESEND_TEST_RECIPIENT` redirige allí los correos mientras se use ese remitente de prueba (el asunto identifica la cuenta). En cuanto `EMAIL_FROM` usa un dominio verificado, la redirección se ignora.
- Rotar cuentas Gmail reduce el volumen por cuenta, pero Gmail puede bloquearlas si detecta automatización. Para volumen real, cambia `SMTP_ACCOUNTS` por un proveedor transaccional; la aplicación no cambia.
