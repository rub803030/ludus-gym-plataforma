import { describe, expect, it } from 'vitest'
import { activeMembershipWhere } from '../../src/shared/membership-scope.js'

describe('alcance de membresías por gimnasio', () => {
  it('limita la membresía activa al plan del gimnasio solicitado', () => {
    expect(activeMembershipWhere('gym-a')).toEqual({
      status: 'ACTIVE',
      plan: { gymId: 'gym-a' },
    })
  })

  it('no reutiliza la membresía de otro gimnasio', () => {
    const scope = activeMembershipWhere('gym-a')
    expect(scope).not.toEqual(activeMembershipWhere('gym-b'))
  })
})
