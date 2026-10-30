import { describe, expect, it } from "vitest";

import {
  describeSchedule,
  dueOn,
  isDueOn,
  localDateISO,
  weekdayName,
  weekdayOf,
  weekParityOf,
  type SchedulablePool,
} from "./schedule";

const pool = (over: Partial<SchedulablePool> = {}): SchedulablePool => ({
  service_weekday: 2,
  service_cadence: "weekly",
  service_week_parity: null,
  ...over,
});

describe("localDateISO", () => {
  it("reports the date in the company's zone, not the server's", () => {
    // 03:30 UTC on the 4th is still 20:30 on the 3rd in Phoenix. A company
    // there must not be shown tomorrow's route all evening.
    const instant = new Date("2026-11-04T03:30:00Z");
    expect(localDateISO(instant, "America/Phoenix")).toBe("2026-11-03");
    expect(localDateISO(instant, "UTC")).toBe("2026-11-04");
  });

  it("handles a zone ahead of UTC", () => {
    const instant = new Date("2026-11-03T22:00:00Z");
    expect(localDateISO(instant, "Asia/Tokyo")).toBe("2026-11-04");
  });

  it("zero-pads months and days", () => {
    expect(localDateISO(new Date("2026-01-05T12:00:00Z"), "UTC")).toBe("2026-01-05");
  });
});

describe("weekdayOf", () => {
  it("uses 0 for Sunday, matching the column", () => {
    expect(weekdayOf("2026-11-01")).toBe(0); // Sunday
    expect(weekdayOf("2026-11-03")).toBe(2); // Tuesday
    expect(weekdayOf("2026-11-07")).toBe(6); // Saturday
  });
});

describe("weekParityOf", () => {
  it("is stable within a Sunday-to-Saturday week", () => {
    const week = ["2026-11-01", "2026-11-03", "2026-11-07"];
    const parities = new Set(week.map(weekParityOf));
    expect(parities.size).toBe(1);
  });

  it("alternates between adjacent weeks", () => {
    expect(weekParityOf("2026-11-03")).not.toBe(weekParityOf("2026-11-10"));
    expect(weekParityOf("2026-11-03")).toBe(weekParityOf("2026-11-17"));
  });

  it("is never negative for dates before the epoch", () => {
    expect([0, 1]).toContain(weekParityOf("1969-05-20"));
  });
});

describe("isDueOn", () => {
  it("matches a weekly pool on its weekday only", () => {
    expect(isDueOn(pool(), "2026-11-03")).toBe(true); // Tuesday
    expect(isDueOn(pool(), "2026-11-04")).toBe(false); // Wednesday
  });

  it("is never due when unscheduled", () => {
    const unscheduled = pool({ service_weekday: null });
    for (const d of ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"]) {
      expect(isDueOn(unscheduled, d)).toBe(false);
    }
  });

  it("serves a biweekly pool every other week, not every week", () => {
    const parity = weekParityOf("2026-11-03");
    const biweekly = pool({ service_cadence: "biweekly", service_week_parity: parity });

    expect(isDueOn(biweekly, "2026-11-03")).toBe(true);
    expect(isDueOn(biweekly, "2026-11-10")).toBe(false); // the off week
    expect(isDueOn(biweekly, "2026-11-17")).toBe(true);
  });

  it("treats a biweekly pool with no parity as not due, rather than weekly", () => {
    // The database forbids this combination; if one ever existed, servicing it
    // every week would be the worse failure.
    const broken = pool({ service_cadence: "biweekly", service_week_parity: null });
    expect(isDueOn(broken, "2026-11-03")).toBe(false);
  });
});

describe("dueOn", () => {
  it("filters without reordering", () => {
    const pools = [
      { id: "a", ...pool({ service_weekday: 2 }) },
      { id: "b", ...pool({ service_weekday: 4 }) },
      { id: "c", ...pool({ service_weekday: 2 }) },
    ];
    expect(dueOn(pools, "2026-11-03").map((p) => p.id)).toEqual(["a", "c"]);
  });
});

describe("labels", () => {
  it("names weekdays and rejects out-of-range values", () => {
    expect(weekdayName(0)).toBe("Sunday");
    expect(weekdayName(6)).toBe("Saturday");
    expect(weekdayName(null)).toBeNull();
    expect(weekdayName(7)).toBeNull();
  });

  it("describes a schedule the way a tech would say it", () => {
    expect(describeSchedule(pool())).toBe("Every Tuesday");
    expect(describeSchedule(pool({ service_cadence: "biweekly", service_week_parity: 0 }))).toBe(
      "Every other Tuesday",
    );
    expect(describeSchedule(pool({ service_weekday: null }))).toBe("Not scheduled");
  });
});
