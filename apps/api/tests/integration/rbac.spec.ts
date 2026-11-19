import { describe, expect, it } from 'vitest'
import { canAccessWeb, hasPermission } from '@ludus/shared'

describe('matriz RBAC', () => {
  it('rechaza MEMBER en web', () => {
    expect(canAccessWeb('MEMBER')).toBe(false)
  })

  it('impide que STAFF cancele cobros', () => {
    expect(hasPermission('STAFF', 'payments:refund')).toBe(false)
  })

  it('permite a OWNER gestionar licencias', () => {
    expect(hasPermission('OWNER', 'staff:manage')).toBe(true)
  })
})