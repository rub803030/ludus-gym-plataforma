/**
 * Configuración centralizada de la consola web.
 *
 * Todas las variables de la web se leen aquí. El navegador llama siempre a
 * `/api/*` (mismo origen) y Next.js redirige ese tráfico al upstream definido
 * en `API_UPSTREAM_URL`. Así las cookies de sesión siguen siendo del mismo
 * sitio aunque la API esté en otro proveedor.
 */

function clean(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '')
}

function assertSecure(value: string, name: string): void {
  if (!value) return
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} debe ser una URL válida`)
  }
  if (url.protocol !== 'https:') {
    throw new Error(`${name} debe usar HTTPS en producción`)
  }
  if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error(`${name} no puede apuntar a localhost en producción`)
  }
}

const isProduction = process.env.NODE_ENV === 'production'
// Next.js usa NODE_ENV=production también al compilar en local. Solo exigimos
// HTTPS cuando el proceso está realmente desplegado en Vercel o Fly.io.
const isDeployed = isProduction && Boolean(process.env.VERCEL || process.env.FLY)
const publicApiUrl = clean(process.env.NEXT_PUBLIC_API_URL)
const upstreamUrl = clean(process.env.API_UPSTREAM_URL) || 'http://localhost:4000'

if (isDeployed) {
  assertSecure(publicApiUrl, 'NEXT_PUBLIC_API_URL')
  assertSecure(upstreamUrl, 'API_UPSTREAM_URL')
}

/**
 * @param path Ruta de la API, por ejemplo `/api/auth/me`.
 * @param target `browser` usa la URL pública (vacía = mismo origen);
 *               `server` usa el upstream privado (Fly.io en producción).
 */
export function apiUrl(path: string, target: 'browser' | 'server' = 'browser'): string {
  const base = target === 'server' ? upstreamUrl : publicApiUrl
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export const webConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'Ludus GYM',
  isProduction,
  api: {
    publicBaseUrl: publicApiUrl,
    upstreamUrl,
  },
} as const
