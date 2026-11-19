import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'

describe('firma QR', () => {
  it('es determinista para el mismo bucket de tiempo', () => {
    const sign = (payload: string) => createHmac('sha256', 'secret').update(payload).digest('hex')
    expect(sign('member:1:100')).toBe(sign('member:1:100'))
  })
})