import {
  format,
  startOfWeek,
  addDays,
  parseISO,
  isSameDay,
  differenceInCalendarDays,
} from 'date-fns'

export const ISO = 'yyyy-MM-dd'

export function todayISO(): string {
  return format(new Date(), ISO)
}

export function toISO(date: Date): string {
  return format(date, ISO)
}

export function fromISO(iso: string): Date {
  return parseISO(iso)
}

/** Monday-based week start for a given date. */
export function weekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function weekStartISO(date: Date): string {
  return toISO(weekStart(date))
}

/** Seven ISO dates for the week containing `date` (Mon→Sun). */
export function weekDates(date: Date): string[] {
  const start = weekStart(date)
  return Array.from({ length: 7 }, (_, i) => toISO(addDays(start, i)))
}

export function isToday(iso: string): boolean {
  return isSameDay(parseISO(iso), new Date())
}

export function daysBetween(aISO: string, bISO: string): number {
  return differenceInCalendarDays(parseISO(bISO), parseISO(aISO))
}

export function formatDayLabel(iso: string): string {
  return format(parseISO(iso), 'EEE d')
}

export function formatLongDate(iso: string): string {
  return format(parseISO(iso), 'EEEE, MMM d')
}

export function formatMonthLabel(iso: string): string {
  return format(parseISO(iso), 'MMMM yyyy')
}

export { addDays, format, parseISO, isSameDay }
