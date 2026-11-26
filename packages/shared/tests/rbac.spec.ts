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
    expect(outranks('ADMIN', 'OWNER')).toBe(true)
    expect(outranks('OWNER', 'MANAGER')).toBe(true)
    expect(outranks('STAFF', 'MANAGER')).toBe(false)
  })
  it('reserva la autorización de gimnasios al ADMIN global', () => {
    expect(canAccessWeb('ADMIN')).toBe(true)
    expect(canAccessMobile('ADMIN')).toBe(false)
    expect(hasPermission('ADMIN', 'gyms:approve')).toBe(true)
    expect(hasPermission('OWNER', 'gyms:approve')).toBe(false)
  })
  it('protege cancelaciones', () => {
    expect(hasPermission('STAFF', 'payments:refund')).toBe(false)
    expect(hasPermission('MANAGER', 'payments:refund')).toBe(false)
    expect(hasPermission('OWNER', 'payments:refund')).toBe(true)
  })
})
