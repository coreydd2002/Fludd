import { describe, expect, it } from "vitest";

import { directionsUrl } from "./maps";

describe("directionsUrl", () => {
  it("defaults to Google Maps and encodes the address", () => {
    expect(directionsUrl(" 12 Main St, Provo UT ")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=12%20Main%20St%2C%20Provo%20UT",
    );
  });

  it("uses Apple Maps when that is the tech's preference", () => {
    expect(directionsUrl("12 Main St", "apple")).toBe(
      "https://maps.apple.com/?daddr=12%20Main%20St",
    );
  });
});
