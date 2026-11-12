import { describe, expect, it } from "vitest";

import { scrubDeep, scrubUrl } from "./scrub";

describe("scrubUrl", () => {
  it("removes the token from a report link", () => {
    expect(scrubUrl("https://app.fludd.work/r/abc123XYZ")).toBe("https://app.fludd.work/r/[token]");
  });

  it("removes it from a bare path too", () => {
    expect(scrubUrl("/r/abc123XYZ")).toBe("/r/[token]");
  });

  it("keeps the rest of the URL intact", () => {
    expect(scrubUrl("https://app.fludd.work/r/secret?from=email#notes")).toBe(
      "https://app.fludd.work/r/[token]?from=email#notes",
    );
  });

  it("scrubs every occurrence, not just the first", () => {
    const text = "failed /r/aaa then retried /r/bbb";
    expect(scrubUrl(text)).toBe("failed /r/[token] then retried /r/[token]");
  });

  it("redacts token query parameters wherever they appear", () => {
    expect(scrubUrl("/auth/callback?token_hash=abc&type=signup")).toBe(
      "/auth/callback?token_hash=[redacted]&type=signup",
    );
    expect(scrubUrl("/x?access_token=abc")).toBe("/x?access_token=[redacted]");
  });

  it("leaves URLs without tokens alone", () => {
    // /routes must not be mistaken for the /r/ prefix.
    for (const safe of ["/customers/123", "/visits/9/done", "/routes", "/reports"]) {
      expect(scrubUrl(safe)).toBe(safe);
    }
  });
});

describe("scrubDeep", () => {
  it("reaches strings nested in objects and arrays", () => {
    const event = {
      request: { url: "https://app.fludd.work/r/secret" },
      breadcrumbs: [{ data: { to: "/r/other" } }],
      level: "error",
    };

    expect(scrubDeep(event)).toEqual({
      request: { url: "https://app.fludd.work/r/[token]" },
      breadcrumbs: [{ data: { to: "/r/[token]" } }],
      level: "error",
    });
  });

  it("passes non-strings through untouched", () => {
    expect(scrubDeep({ n: 1, b: true, nil: null })).toEqual({ n: 1, b: true, nil: null });
  });

  it("does not hang on a cycle", () => {
    // An error path that hangs is worse than one that reports a little less.
    const cyclic: Record<string, unknown> = { url: "/r/abc" };
    cyclic.self = cyclic;
    expect(() => scrubDeep(cyclic)).not.toThrow();
  });
});
