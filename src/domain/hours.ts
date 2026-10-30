import { WEEKDAYS, type HoursStatus, type OpenInterval, type TimeWindow, type Weekday, type WeeklyHours } from './types';

export const VENUE_TIME_ZONE = 'America/Los_Angeles';

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Weekday of a calendar date. The date is already in the venue's zone, so use UTC math on it. */
export function weekdayOf(date: string): Weekday {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return WEEKDAYS[day]!;
}

function previousWeekday(day: Weekday): Weekday {
  return WEEKDAYS[(WEEKDAYS.indexOf(day) + 6) % 7]!;
}

function intervalContains(interval: OpenInterval, minute: number): boolean {
  const open = toMinutes(interval.opens);
  let close = toMinutes(interval.closes);
  if (close <= open) close += 24 * 60; // closes after midnight
  return minute >= open && minute < close;
}

/**
 * Whether the venue is open at the start of the window.
 * Unknown hours for that day (or the previous day's overnight spill) yield 'unverified', never 'open'.
 */
export function hoursStatusAt(hours: WeeklyHours | null, window: TimeWindow | null): HoursStatus {
  if (!window) return 'no_time_given';
  if (!hours) return 'unverified';
  const day = weekdayOf(window.date);
  const today = hours[day];
  if (today === undefined) return 'unverified';
  const start = toMinutes(window.start);
  if (today.some((iv) => intervalContains(iv, start))) return 'open_at_start';
  const yesterday = hours[previousWeekday(day)];
  if (yesterday === undefined) return 'unverified';
  const spill = yesterday.some((iv) => {
    const open = toMinutes(iv.opens);
    const close = toMinutes(iv.closes);
    return close <= open && start < close;
  });
  return spill ? 'open_at_start' : 'closed_at_start';
}

function fmt(hhmm: string): string {
  const total = toMinutes(hhmm);
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** English display text for one day's hours, or null when unknown. */
export function hoursTextFor(hours: WeeklyHours | null, day: Weekday): string | null {
  const intervals = hours?.[day];
  if (intervals === undefined) return null;
  if (intervals.length === 0) return 'Closed';
  return intervals.map((iv) => `${fmt(iv.opens)}–${fmt(iv.closes)}`).join(', ');
}
