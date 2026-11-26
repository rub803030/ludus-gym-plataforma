import { describe, expect, it } from 'vitest'
import { membershipPeriod } from '../../src/modules/billing/membership-period.js'

describe('membershipPeriod', () => {
  it('starts on today when there is no future active end date', () => {
    const period = membershipPeriod(
      new Date('2026-11-26T14:00:00.000Z'),
      new Date('2026-11-20T00:00:00.000Z'),
      30,
    )

    expect(period.startDate.toISOString()).toBe('2026-11-26T00:00:00.000Z')
    expect(period.endDate.toISOString()).toBe('2026-12-26T00:00:00.000Z')
  })

  it('extends from the day after the active gym membership ends', () => {
    const period = membershipPeriod(
      new Date('2026-11-26T14:00:00.000Z'),
      new Date('2026-12-10T00:00:00.000Z'),
      30,
    )

    expect(period.startDate.toISOString()).toBe('2026-12-11T00:00:00.000Z')
    expect(period.endDate.toISOString()).toBe('2027-01-10T00:00:00.000Z')
  })
})
