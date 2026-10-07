import { describe, expect, it } from "vitest";

import {
  READINGS,
  allReadingsHealthy,
  formatReading,
  parseReading,
  readingsSummary,
  statusOf,
} from "./readings";

const spec = (key: string) => READINGS.find((s) => s.key === key)!;
const chlorine = spec("chlorine_ppm");
const ph = spec("ph");

describe("statusOf", () => {
  it("treats a missing value as empty, not low", () => {
    expect(statusOf(chlorine, null)).toBe("empty");
    expect(statusOf(chlorine, undefined)).toBe("empty");
    expect(statusOf(chlorine, Number.NaN)).toBe("empty");
  });

  it("classifies against the spec range, inclusive", () => {
    expect(statusOf(chlorine, chlorine.min - 0.1)).toBe("low");
    expect(statusOf(chlorine, chlorine.min)).toBe("ok");
    expect(statusOf(chlorine, chlorine.max)).toBe("ok");
    expect(statusOf(chlorine, chlorine.max + 0.1)).toBe("high");
  });
});

describe("formatReading", () => {
  it("uses the spec's decimals and a dash for empty", () => {
    expect(formatReading(chlorine, 3)).toBe("3.0");
    expect(formatReading(chlorine, null)).toBe("—");
  });
});

describe("parseReading", () => {
  it("accepts a normal reading and rounds to the spec's precision", () => {
    expect(parseReading(chlorine, " 3.04 ")).toBe(3);
  });

  it("rejects blanks, non-numbers, negatives and impossible values", () => {
    expect(parseReading(chlorine, "")).toBeNull();
    expect(parseReading(chlorine, "abc")).toBeNull();
    expect(parseReading(chlorine, "-1")).toBeNull();
    expect(parseReading(chlorine, String(chlorine.hardMax + 1))).toBeNull();
    expect(parseReading(chlorine, 3)).toBeNull();
  });
});

describe("allReadingsHealthy / readingsSummary", () => {
  const healthy = { chlorine_ppm: 3, ph: 7.4, alkalinity_ppm: 90 };

  it("is healthy only when every reading is recorded and in range", () => {
    expect(allReadingsHealthy(healthy)).toBe(true);
    expect(allReadingsHealthy({ chlorine_ppm: 3, ph: 7.4 })).toBe(false);
    expect(allReadingsHealthy({})).toBe(false);
  });

  it("summarises nothing when no readings were taken", () => {
    expect(readingsSummary({})).toBeNull();
  });

  it("names the out-of-range readings", () => {
    expect(readingsSummary(healthy)).toBe("All readings in the healthy range");
    expect(readingsSummary({ ...healthy, ph: ph.max + 0.5 })).toBe(
      `pH high at ${formatReading(ph, ph.max + 0.5)}`,
    );
  });
});
