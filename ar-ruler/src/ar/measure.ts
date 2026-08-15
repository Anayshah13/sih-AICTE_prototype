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
    const rounded = Math.round(centimeters);
    return `${rounded} cm`;
  }

  return `${meters.toFixed(2)} m`;
}
