/** Euclidean distance in meters from WebXR world-space coordinates. */
export function worldDistanceMeters(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Display helper. Underlying value stays in meters.
 * < 100 cm → centimeters, otherwise meters.
 */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) {
    return "—";
  }

  const centimeters = meters * 100;

  if (centimeters < 100) {
    return `${centimeters.toFixed(2)} cm`;
  }

  return `${meters.toFixed(2)} m`;
}

export function formatArea(squareMeters: number): string {
  if (!Number.isFinite(squareMeters) || squareMeters < 0) {
    return "—";
  }
  if (squareMeters < 1) {
    return `${Math.round(squareMeters * 10_000)} cm²`;
  }
  return `${squareMeters.toFixed(2)} m²`;
}

export function polygonAreaXZ(points: Array<{ x: number; z: number }>): number {
  if (points.length < 3) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.z - b.x * a.z;
  }
  return Math.abs(sum) * 0.5;
}
