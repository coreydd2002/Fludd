import { describe, expect, it } from "vitest";

import { parseChecklist } from "./checklist";

describe("parseChecklist", () => {
  it("returns trimmed, non-empty strings", () => {
    expect(parseChecklist(JSON.stringify([" Skim ", "", "Brush", 4, null]))).toEqual([
      "Skim",
      "Brush",
    ]);
  });

  it("treats missing, malformed or non-array input as empty", () => {
    expect(parseChecklist(null)).toEqual([]);
    expect(parseChecklist("")).toEqual([]);
    expect(parseChecklist("{not json")).toEqual([]);
    expect(parseChecklist(JSON.stringify({ a: 1 }))).toEqual([]);
  });

  it("caps the list at 50 items", () => {
    const many = Array.from({ length: 80 }, (_, i) => `Task ${i}`);
    expect(parseChecklist(JSON.stringify(many))).toHaveLength(50);
  });
});
