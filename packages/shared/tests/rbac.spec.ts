import { describe, expect, it } from 'vitest'
import { canAccessMobile, canAccessWeb, hasPermission, outranks } from '../src/index'

describe('roles', () => {
  it('separa plataformas', () => {
    expect(canAccessWeb('STAFF')).toBe(true)
    expect(canAccessWeb('MEMBER')).toBe(false)
    expect(canAccessMobile('MEMBER')).toBe(true)
    expect(canAccessMobile('OWNER')).toBe(false)
  })
  it('respeta jerarquía', () => {
    expect(outranks('OWNER', 'MANAGER')).toBe(true)
    expect(outranks('STAFF', 'MANAGER')).toBe(false)
  })
  it('protege cancelaciones', () => {
    expect(hasPermission('STAFF', 'payments:refund')).toBe(false)
    expect(hasPermission('MANAGER', 'payments:refund')).toBe(false)
    expect(hasPermission('OWNER', 'payments:refund')).toBe(true)
  })
})
