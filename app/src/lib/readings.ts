/**
 * Pool chemistry ranges, and how a reading is described to a pool owner.
 *
 * These are the standard residential targets the landing page's customer
 * portal mockup shows (chlorine 3.0, pH 7.4, alkalinity 90 — all mid-range).
 * They are guidance for a report, not a dosing recommendation.
 */

export type ReadingKey = "chlorine_ppm" | "ph" | "alkalinity_ppm";

export type ReadingSpec = {
  key: ReadingKey;
  label: string;
  short: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** Values outside this are almost certainly a typo, not a real pool. */
  hardMax: number;
  decimals: number;
};

export const READINGS: ReadingSpec[] = [
  {
    key: "chlorine_ppm",
    label: "Free chlorine",
    short: "Chlorine",
    unit: "ppm",
    min: 1,
    max: 4,
    step: 0.1,
    hardMax: 100,
    decimals: 1,
  },
  {
    key: "ph",
    label: "pH",
    short: "pH",
    unit: "",
    min: 7.2,
    max: 7.8,
    step: 0.1,
    hardMax: 14,
    decimals: 1,
  },
  {
    key: "alkalinity_ppm",
    label: "Total alkalinity",
    short: "Alkalinity",
    unit: "ppm",
    min: 80,
    max: 120,
    step: 10,
    hardMax: 1000,
    decimals: 0,
  },
];

export type ReadingStatus = "ok" | "low" | "high" | "empty";

export function statusOf(spec: ReadingSpec, value: number | null | undefined): ReadingStatus {
  if (value === null || value === undefined || Number.isNaN(value)) return "empty";
  if (value < spec.min) return "low";
  if (value > spec.max) return "high";
  return "ok";
}

export function formatReading(spec: ReadingSpec, value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(spec.decimals);
}

/**
 * True only when every reading was actually recorded and every one is in range.
 * A visit with no readings is not "healthy" — it is unmeasured, and the report
 * must not claim otherwise.
 */
export function allReadingsHealthy(values: Partial<Record<ReadingKey, number | null>>): boolean {
  return READINGS.every((spec) => statusOf(spec, values[spec.key]) === "ok");
}

/** One-line summary for the finish email subject area. */
export function readingsSummary(
  values: Partial<Record<ReadingKey, number | null>>,
): string | null {
  const recorded = READINGS.filter(
    (spec) => statusOf(spec, values[spec.key]) !== "empty",
  );
  if (recorded.length === 0) return null;
  if (allReadingsHealthy(values)) return "All readings in the healthy range";

  const off = recorded.filter((spec) => statusOf(spec, values[spec.key]) !== "ok");
  if (off.length === 0) return "Readings recorded";
  return off
    .map((spec) => {
      const status = statusOf(spec, values[spec.key]);
      return `${spec.short} ${status === "low" ? "low" : "high"} at ${formatReading(spec, values[spec.key])}`;
    })
    .join(", ");
}

/** Parses a text input into a stored value, rejecting nonsense. */
export function parseReading(spec: ReadingSpec, raw: unknown): number | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > spec.hardMax) return null;
  return Number(n.toFixed(spec.decimals));
}
