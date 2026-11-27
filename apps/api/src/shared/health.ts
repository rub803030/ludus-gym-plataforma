export type ProbeDetail = 'ok' | 'timeout' | 'unavailable' | 'memory'

export interface HealthProbe {
  ok: boolean
  detail: ProbeDetail
}

/**
 * Ejecuta una sonda con límite de tiempo. Nunca devuelve el mensaje de error
 * original: una excepción de Prisma/ioredis puede incluir host o credenciales.
 */
export async function probeDependency(
  work: () => Promise<unknown>,
  timeoutMs = 3000,
): Promise<HealthProbe> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs)
      }),
    ])
    return { ok: true, detail: 'ok' }
  } catch (error) {
    const timedOut = error instanceof Error && error.message === 'timeout'
    return { ok: false, detail: timedOut ? 'timeout' : 'unavailable' }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function healthSnapshot(database: HealthProbe, cache: HealthProbe) {
  const ready = database.ok && cache.ok
  return {
    status: ready ? 'ok' : 'degraded',
    service: 'ludus-api',
    at: new Date().toISOString(),
    checks: { database, cache },
  }
}
