export function membershipPeriod(
  now: Date,
  existingEndDate: Date | null,
  durationDays: number,
): { startDate: Date; endDate: Date } {
  const today = new Date(now.getTime())
  today.setUTCHours(0, 0, 0, 0)
  const startDate = existingEndDate && existingEndDate.getTime() >= today.getTime()
    ? new Date(existingEndDate.getTime() + 86_400_000)
    : today
  const endDate = new Date(startDate)
  endDate.setUTCDate(endDate.getUTCDate() + durationDays)
  return { startDate, endDate }
}
