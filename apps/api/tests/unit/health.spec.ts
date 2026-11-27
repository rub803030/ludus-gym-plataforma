import { describe, expect, it } from 'vitest'
import { healthSnapshot, probeDependency } from '../../src/shared/health.js'

describe('sondas de readiness', () => {
  it('marca una dependencia disponible', async () => {
    expect(await probeDependency(async () => 1)).toEqual({ ok: true, detail: 'ok' })
  })

  it('clasifica un timeout sin filtrar mensajes', async () => {
    const probe = await probeDependency(() => new Promise(() => undefined), 10)
    expect(probe).toEqual({ ok: false, detail: 'timeout' })
  })

  it('clasifica un fallo sin devolver credenciales del error', async () => {
    const probe = await probeDependency(async () => {
      throw new Error('postgres://usuario:secreto@host/base')
    }, 50)
    expect(probe).toEqual({ ok: false, detail: 'unavailable' })
    expect(JSON.stringify(probe)).not.toContain('secreto')
  })

  it('degrada el estado si falla alguna dependencia', () => {
    const ok = { ok: true, detail: 'ok' as const }
    const bad = { ok: false, detail: 'unavailable' as const }
    expect(healthSnapshot(ok, ok).status).toBe('ok')
    expect(healthSnapshot(bad, ok).status).toBe('degraded')
    expect(healthSnapshot(ok, bad).checks.cache.ok).toBe(false)
  })
})
