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
| `RESEND_API_KEY` | Fly.io (secreto) | Clave privada de Resend; nunca en Vercel ni en el repo |
| `EMAIL_FROM` | Fly.io | Remitente verificado en Resend (`onboarding@resend.dev` en pruebas) |
| `RESEND_TEST_RECIPIENT` | Local y Fly | Bandeja del dueño de Resend; mientras se usen cuentas demo con `+`, redirige aquí los correos. Se retira al verificar un dominio propio |
| `WEB_APP_URL` | Fly.io | URL pública de Vercel usada para construir el enlace de verificación |
| `EMAIL_VERIFICATION_TTL_MINUTES` | Fly.io | Vigencia del enlace de un solo uso (30 min por defecto) |

Si más adelante compras un dominio propio, solo cambia `CORS_ORIGIN` en Fly.io
y añade el dominio en Vercel. El código no se modifica.

## Seguridad aplicada

- La API rechaza el arranque si `CORS_ORIGIN` no es HTTPS o es localhost.
- La API exige `DIRECT_URL` y `CORS_ORIGIN` HTTPS en producción. Sin `REDIS_URL`, el rate limit usa el store local: ello es válido solo con una instancia de la API.
- `FIELD_ENCRYPTION_KEY` debe decodificar exactamente 32 bytes.
- La web añade HSTS, CSP, `X-Frame-Options: DENY` y `Referrer-Policy: no-referrer` en producción.
- Los secretos nunca se versionan: `.env.local`, keystores y builds están ignorados.
- STAFF y SOCIOS deben verificar su correo antes de iniciar sesión: enlace de un solo uso, TTL de 30 minutos, cooldown de reenvío y hash SHA-256 del token en base de datos (nunca el token en claro).
- Con `onboarding@resend.dev`, Resend solo entrega a la dirección propietaria de la cuenta; `RESEND_TEST_RECIPIENT` redirige allí los correos de las cuentas demo (el asunto identifica la cuenta) tanto en local como en Fly. Para entregar a otros destinatarios hay que verificar un dominio propio y retirar esa variable.
