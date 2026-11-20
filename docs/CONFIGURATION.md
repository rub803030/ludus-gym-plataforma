# Configuración centralizada

Toda la configuración del sistema se lee desde un único lugar por aplicación:

| Ámbito | Archivo | Uso |
| --- | --- | --- |
| API | `apps/api/src/config/env.ts` | Base de datos, Redis, secretos, CORS, S3, rate limit |
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

El navegador siempre llama a rutas relativas `/api/*`. Next.js las redirige al
upstream configurado en `API_UPSTREAM_URL` (la URL de Fly.io). Esto mantiene
las cookies de sesión en el mismo sitio y evita problemas de `SameSite=Strict`
entre dominios distintos.

| Variable | Dónde se configura | Valor en producción |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Vercel | vacío (mismo origen) |
| `API_UPSTREAM_URL` | Vercel | `https://<app>.fly.dev` |
| `CORS_ORIGIN` | Fly.io | `https://ludus-gym-plataforma.vercel.app` |
| `REDIS_URL` | Fly.io | Redis compartido (nunca localhost) |
| `S3_*` | Fly.io | Proyecto R2/S3 real (nunca `minioadmin`) |

Si más adelante compras un dominio propio, solo cambia `CORS_ORIGIN` en Fly.io
y añade el dominio en Vercel. El código no se modifica.

## Seguridad aplicada

- La API rechaza el arranque si `CORS_ORIGIN` no es HTTPS o es localhost.
- La API exige `DIRECT_URL`, Redis compartido y credenciales S3 reales en producción.
- `FIELD_ENCRYPTION_KEY` debe decodificar exactamente 32 bytes.
- La web añade HSTS, CSP, `X-Frame-Options: DENY` y `Referrer-Policy: no-referrer` en producción.
- Los secretos nunca se versionan: `.env.local`, keystores y builds están ignorados.
