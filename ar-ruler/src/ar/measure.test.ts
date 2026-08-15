import { describe, expect, it } from "vitest";
import { formatDistance, worldDistanceMeters } from "./measure";

describe("worldDistanceMeters", () => {
  it("returns Euclidean distance from 3D world coordinates", () => {
    expect(worldDistanceMeters(0, 0, 0, 3, 4, 0)).toBe(5);
    expect(worldDistanceMeters(1, 1, 1, 1, 1, 1)).toBe(0);
    expect(worldDistanceMeters(0, 0, 0, 1, 0, 0)).toBe(1);
  });

  it("does not use screen or pixel units", () => {
    const meters = worldDistanceMeters(0.2, 0.0, -1.4, 1.62, 0.01, -1.41);
    expect(meters).toBeGreaterThan(1.4);
    expect(meters).toBeLessThan(1.5);
  });
});

describe("formatDistance", () => {
  it("uses centimeters below 100 cm", () => {
    expect(formatDistance(0.42)).toBe("42 cm");
    expect(formatDistance(0.87)).toBe("87 cm");
    expect(formatDistance(0.994)).toBe("99 cm");
  });

  it("uses meters at 100 cm and above", () => {
    expect(formatDistance(1)).toBe("1.00 m");
    expect(formatDistance(1.24)).toBe("1.24 m");
    expect(formatDistance(2.73)).toBe("2.73 m");
  });
});
