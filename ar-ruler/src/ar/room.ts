export type Vec3 = { x: number; y: number; z: number };

export type PlaneSample = Vec3 & {
  nx: number;
  ny: number;
  nz: number;
};

export type RoomEstimate = {
  floorCorners: [Vec3, Vec3, Vec3, Vec3];
  corners8: Vec3[];
  areaM2: number;
  heightM: number;
  floorY: number;
  ceilingY: number;
  confident: boolean;
  hasCeiling: boolean;
  coverage: number;
};

const FLOOR_NY = 0.72;
const CEILING_NY = -0.72;
const WALL_NY = 0.38;
const MIN_SAMPLES = 28;
const MIN_AREA = 3.5;
const MIN_HEIGHT = 1.7;
const MIN_SPAN = 1.4;

export function sampleKind(ny: number): "floor" | "ceiling" | "wall" | "other" {
  if (ny >= FLOOR_NY) {
    return "floor";
  }
  if (ny <= CEILING_NY) {
    return "ceiling";
  }
  if (Math.abs(ny) <= WALL_NY) {
    return "wall";
  }
  return "other";
}

export function cellKey(x: number, y: number, z: number, size = 0.16): string {
  return `${Math.round(x / size)}:${Math.round(y / size)}:${Math.round(z / size)}`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function percentile(values: number[], p: number): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[i];
}

/** Axis-aligned-in-principal-axes bounding rectangle of floor (and wall-foot) points. */
export function orientedFloorCorners(points: Vec3[]): {
  corners: [Vec3, Vec3, Vec3, Vec3];
  area: number;
  floorY: number;
  width: number;
  depth: number;
} | null {
  if (points.length < 8) {
    return null;
  }

  const floorY = median(points.map((p) => p.y));
  const mx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const mz = points.reduce((s, p) => s + p.z, 0) / points.length;

  let xx = 0;
  let xz = 0;
  let zz = 0;
  for (const p of points) {
    const dx = p.x - mx;
    const dz = p.z - mz;
    xx += dx * dx;
    xz += dx * dz;
    zz += dz * dz;
  }

  const angle = 0.5 * Math.atan2(2 * xz, xx - zz);
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const p of points) {
    const dx = p.x - mx;
    const dz = p.z - mz;
    const u = dx * c + dz * s;
    const v = -dx * s + dz * c;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }

  const width = maxU - minU;
  const depth = maxV - minV;
  if (width < 0.4 || depth < 0.4) {
    return null;
  }

  const corner = (u: number, v: number): Vec3 => ({
    x: mx + c * u - s * v,
    y: floorY,
    z: mz + s * u + c * v,
  });

  const corners: [Vec3, Vec3, Vec3, Vec3] = [
    corner(minU, minV),
    corner(maxU, minV),
    corner(maxU, maxV),
    corner(minU, maxV),
  ];

  return { corners, area: width * depth, floorY, width, depth };
}

export function liftCorners(floor: [Vec3, Vec3, Vec3, Vec3], ceilingY: number): Vec3[] {
  return [
    ...floor,
    ...floor.map((p) => ({ x: p.x, y: ceilingY, z: p.z })),
  ];
}

export function estimateRoom(samples: PlaneSample[]): RoomEstimate | null {
  const floor: Vec3[] = [];
  const walls: PlaneSample[] = [];
  const ceilingYs: number[] = [];
  const wallYs: number[] = [];

  for (const s of samples) {
    const kind = sampleKind(s.ny);
    if (kind === "floor") {
      floor.push(s);
    } else if (kind === "ceiling") {
      ceilingYs.push(s.y);
    } else if (kind === "wall") {
      walls.push(s);
      wallYs.push(s.y);
    }
  }

  const floorYs = floor.map((p) => p.y);
  const floorYHint =
    floorYs.length > 0
      ? [...floorYs].sort((a, b) => a - b)[Math.floor(floorYs.length / 2)]
      : 0;

  const boundary: Vec3[] = [
    ...floor,
    ...walls.map((w) => ({ x: w.x, y: floorYHint, z: w.z })),
  ];

  const obb = orientedFloorCorners(boundary.length >= 8 ? boundary : floor);
  if (!obb) {
    return null;
  }

  const floorY = obb.floorY;
  let ceilingY = floorY;
  if (ceilingYs.length >= 6) {
    ceilingY = median(ceilingYs);
  } else if (wallYs.length >= 10) {
    ceilingY = percentile(wallYs, 0.92);
  }

  const heightM = Math.max(0, ceilingY - floorY);
  const coverage = Math.min(1, (obb.area / 12) * (boundary.length / 80));
  const spanOk = obb.width >= MIN_SPAN && obb.depth >= MIN_SPAN;
  const samplesOk = boundary.length >= MIN_SAMPLES;
  const areaOk = obb.area >= MIN_AREA;
  const heightOk = heightM >= MIN_HEIGHT;
  const confident = samplesOk && spanOk && areaOk && heightOk && coverage >= 0.28;

  return {
    floorCorners: obb.corners,
    corners8: heightOk ? liftCorners(obb.corners, ceilingY) : liftCorners(obb.corners, floorY),
    areaM2: obb.area,
    heightM,
    floorY,
    ceilingY: heightOk ? ceilingY : floorY,
    confident,
    hasCeiling: heightOk,
    coverage,
  };
}

export function estimatesClose(a: RoomEstimate, b: RoomEstimate, slack = 0.12): boolean {
  if (Math.abs(a.areaM2 - b.areaM2) / Math.max(a.areaM2, 0.01) > slack) {
    return false;
  }
  if (Math.abs(a.heightM - b.heightM) > 0.25) {
    return false;
  }
  for (let i = 0; i < 4; i += 1) {
    const p = a.floorCorners[i];
    const q = b.floorCorners[i];
    const d = Math.hypot(p.x - q.x, p.z - q.z);
    if (d > 0.35) {
      return false;
    }
  }
  return true;
}
