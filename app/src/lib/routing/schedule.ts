/**
 * Which pools are due on a given day.
 *
 * Every date decision here is made in the *company's* timezone, never the
 * server's. A company in Phoenix would otherwise flip to tomorrow's route at
 * 5pm local time, because the server's UTC clock has already rolled over —
 * the kind of bug that only appears in the evening and only for some customers.
 *
 * Pure and dependency-free, like `readings.ts` and `checklist.ts`: no database,
 * no I/O, no `new Date()` without an explicit instant passed in.
 */

export type ServiceCadence = "weekly" | "biweekly";

/** The scheduling fields of a pool, as stored on `customers`. */
export type SchedulablePool = {
  service_weekday: number | null;
  service_cadence: ServiceCadence;
  service_week_parity: number | null;
};

/**
 * 1970-01-04 was a Sunday, so counting whole weeks from it lines the week index
 * up with a Sunday-start week — the same convention as `service_weekday`, where
 * 0 is Sunday.
 */
const WEEK_EPOCH_DAYS = 3;
const MS_PER_DAY = 86_400_000;

/**
 * The calendar date in a timezone, as `YYYY-MM-DD`.
 *
 * Built from `Intl` parts rather than string-formatting a Date, because the
 * only reliable way to ask "what day is it *there*" is to let Intl do the zone
 * arithmetic and read the fields back.
 */
export function localDateISO(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Day of the week for a `YYYY-MM-DD` date. 0 = Sunday, matching the column. */
export function weekdayOf(localDate: string): number {
  // Parsed as UTC midnight on purpose: the date string already *is* local, so
  // applying a second zone offset would shift it back off the day.
  return new Date(`${localDate}T00:00:00Z`).getUTCDay();
}

/**
 * Which of the two alternating weeks a date falls in, 0 or 1.
 *
 * Derived from the date itself rather than stored as a counter, so it can never
 * drift: any two dates in the same Sunday-to-Saturday week always agree, and
 * adjacent weeks always differ.
 */
export function weekParityOf(localDate: string): 0 | 1 {
  const days = Math.floor(Date.parse(`${localDate}T00:00:00Z`) / MS_PER_DAY);
  const weekIndex = Math.floor((days - WEEK_EPOCH_DAYS) / 7);
  // `%` keeps the sign of the dividend in JS, so dates before the epoch would
  // otherwise return -1.
  return (((weekIndex % 2) + 2) % 2) as 0 | 1;
}

/** Whether a pool is serviced on the given local date. */
export function isDueOn(pool: SchedulablePool, localDate: string): boolean {
  // An unscheduled pool is never due. It still exists and is still visible on
  // the customer list — it simply has no place in anyone's day yet.
  if (pool.service_weekday === null) return false;
  if (pool.service_weekday !== weekdayOf(localDate)) return false;
  if (pool.service_cadence === "weekly") return true;

  // The database forbids a biweekly pool without a parity, but a null here
  // would silently make it due every week rather than every other.
  if (pool.service_week_parity === null) return false;
  return pool.service_week_parity === weekParityOf(localDate);
}

/** The pools from a list that are due on a date, order untouched. */
export function dueOn<T extends SchedulablePool>(pools: T[], localDate: string): T[] {
  return pools.filter((pool) => isDueOn(pool, localDate));
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** For labels and dropdowns. Returns null for an unscheduled pool. */
export function weekdayName(weekday: number | null): string | null {
  if (weekday === null || weekday < 0 || weekday > 6) return null;
  return WEEKDAY_NAMES[weekday];
}

/** Human description of a pool's schedule, e.g. "Every other Tuesday". */
export function describeSchedule(pool: SchedulablePool): string {
  const day = weekdayName(pool.service_weekday);
  if (!day) return "Not scheduled";
  return pool.service_cadence === "biweekly" ? `Every other ${day}` : `Every ${day}`;
}

/** The weekday options a form offers, in week order. */
export const WEEKDAYS = WEEKDAY_NAMES.map((name, value) => ({ value, name }));
