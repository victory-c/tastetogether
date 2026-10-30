import type { QlooHours } from "../qloo/types";
import type { Occasion, OpenStatus } from "./types";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function minutesOf(t: string | null): number | null {
  if (!t) return null;
  const m = /T?(\d{2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function formatClock(mins: number): string {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return m ? `${h}:${String(m).padStart(2, "0")} ${suffix}` : `${h} ${suffix}`;
}

/** Local wall-clock time in the venue's time zone (all launch areas are in the Bay Area). */
export function localNow(now = new Date(), timeZone = "America/Los_Angeles") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    day: get("weekday").toLowerCase(),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

const TARGET_MINUTES: Record<Occasion, number> = {
  date: 19 * 60,
  friends: 19 * 60,
  business: 12 * 60 + 30,
  coffee: 15 * 60,
};

export interface PlanTime {
  day: string;
  minutes: number;
  /** e.g. "Tonight · 7 PM", "Tomorrow · 12:30 PM" */
  label: string;
}

/**
 * The moment we plan for: the occasion's usual time today, or tomorrow if that time has (nearly) passed.
 * Judges may open the app late at night, so hours are never checked against "now".
 */
export function planTime(occasion: Occasion, now = new Date()): PlanTime {
  const { day, minutes } = localNow(now);
  const target = TARGET_MINUTES[occasion];
  const idx = Math.max(0, DAYS.indexOf(day as (typeof DAYS)[number]));
  const today = minutes <= target - 30;
  const planDay = today ? DAYS[idx]! : DAYS[(idx + 1) % 7]!;
  const evening = target >= 17 * 60;
  const when = today ? (evening ? "Tonight" : "Today") : "Tomorrow";
  return { day: planDay, minutes: target, label: `${when} · ${formatClock(target)}` };
}

export function openStatus(hours: QlooHours | undefined, at: PlanTime): OpenStatus {
  if (!hours) return { kind: "unknown" };
  const slots = hours[at.day];
  if (!slots || slots.length === 0) return { kind: "unknown" };
  if (slots.every((s) => s.closed)) return { kind: "closed_today" };

  let nextOpen: number | null = null;
  let anyValid = false;
  for (const s of slots) {
    if (s.closed) continue;
    const o = minutesOf(s.opens);
    let c = minutesOf(s.closes);
    if (o === null || c === null) continue;
    anyValid = true;
    if (c <= o) c += 24 * 60; // closes after midnight
    if (at.minutes >= o && at.minutes < c) return { kind: "open", until: formatClock(c) };
    if (o > at.minutes && (nextOpen === null || o < nextOpen)) nextOpen = o;
  }
  if (nextOpen !== null) return { kind: "opens_later", at: formatClock(nextOpen) };
  return anyValid ? { kind: "closed_by_then" } : { kind: "unknown" };
}

export { DAYS };
