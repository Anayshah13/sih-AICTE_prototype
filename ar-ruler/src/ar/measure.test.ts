import { describe, expect, it } from "vitest";
import { formatArea, formatDistance, polygonAreaXZ, worldDistanceMeters } from "./measure";
import { estimateRoom, orientedFloorCorners, sampleKind, type PlaneSample } from "./room";

describe("worldDistanceMeters", () => {
  it("returns Euclidean distance from 3D world coordinates", () => {
    expect(worldDistanceMeters(0, 0, 0, 3, 4, 0)).toBe(5);
    expect(worldDistanceMeters(1, 1, 1, 1, 1, 1)).toBe(0);
    expect(worldDistanceMeters(0, 0, 0, 1, 0, 0)).toBe(1);
  });
});

describe("formatDistance", () => {
  it("uses centimeters below 100 cm", () => {
    expect(formatDistance(0.42)).toBe("42 cm");
  });

  it("uses meters at 100 cm and above", () => {
    expect(formatDistance(1.24)).toBe("1.24 m");
  });
});

describe("formatArea", () => {
  it("formats square meters", () => {
    expect(formatArea(18.4)).toBe("18.40 m²");
  });
});

describe("polygonAreaXZ", () => {
  it("returns area of a 4 x 5 rectangle on the floor plane", () => {
    const area = polygonAreaXZ([
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 5 },
      { x: 0, z: 5 },
    ]);
    expect(area).toBe(20);
  });
});

describe("sampleKind", () => {
  it("classifies floor, wall, and ceiling normals", () => {
    expect(sampleKind(0.98)).toBe("floor");
    expect(sampleKind(-0.96)).toBe("ceiling");
    expect(sampleKind(0.02)).toBe("wall");
  });
});

describe("orientedFloorCorners", () => {
  it("recovers the furthermost corners of a rectangular room footprint", () => {
    const points = [];
    for (let x = 0; x <= 6; x += 0.4) {
      for (let z = 0; z <= 4; z += 0.4) {
        points.push({ x, y: 0.02, z });
      }
    }
    const obb = orientedFloorCorners(points);
    expect(obb).not.toBeNull();
    expect(obb!.area).toBeGreaterThan(22);
    expect(obb!.area).toBeLessThan(26);
    expect(obb!.width).toBeGreaterThan(5.5);
    expect(obb!.depth).toBeGreaterThan(3.5);
  });
});

describe("estimateRoom", () => {
  it("locks 8 corners once floor, walls, and ceiling are scanned", () => {
    const samples: PlaneSample[] = [];
    for (let x = 0; x <= 5; x += 0.25) {
      for (let z = 0; z <= 4; z += 0.25) {
        samples.push({ x, y: 0, z, nx: 0, ny: 1, nz: 0 });
      }
    }
    for (let y = 0.2; y <= 2.8; y += 0.2) {
      samples.push({ x: 0, y, z: 2, nx: -1, ny: 0, nz: 0 });
      samples.push({ x: 5, y, z: 2, nx: 1, ny: 0, nz: 0 });
      samples.push({ x: 2.5, y, z: 0, nx: 0, ny: 0, nz: -1 });
      samples.push({ x: 2.5, y, z: 4, nx: 0, ny: 0, nz: 1 });
    }
    for (let x = 0.5; x <= 4.5; x += 0.4) {
      for (let z = 0.5; z <= 3.5; z += 0.4) {
        samples.push({ x, y: 2.7, z, nx: 0, ny: -1, nz: 0 });
      }
    }

    const room = estimateRoom(samples);
    expect(room).not.toBeNull();
    expect(room!.hasCeiling).toBe(true);
    expect(room!.confident).toBe(true);
    expect(room!.corners8).toHaveLength(8);
    expect(room!.areaM2).toBeGreaterThan(18);
    expect(room!.heightM).toBeGreaterThan(2.3);
    expect(room!.heightM).toBeLessThan(3.1);
  });
});
