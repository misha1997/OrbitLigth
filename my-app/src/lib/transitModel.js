// Uniform-brightness star of radius 1, with an opaque circular planet.
// position is the projected centre separation in stellar radii.
export const EARTH_RADII_PER_SUN = 109.1;

export function transitFlux(position, radiusRatio) {
  const d = Math.abs(position);
  const r = radiusRatio;
  if (d >= 1 + r) return 1;
  if (d <= Math.abs(1 - r)) return 1 - Math.min(1, r * r);
  const clamp = value => Math.max(-1, Math.min(1, value));
  const starSector = Math.acos(clamp((d * d + 1 - r * r) / (2 * d)));
  const planetSector = r * r * Math.acos(clamp((d * d + r * r - 1) / (2 * d * r)));
  const triangle = 0.5 * Math.sqrt(Math.max(0, (-d + 1 + r) * (d + 1 - r) * (d - 1 + r) * (d + 1 + r)));
  return Math.max(0, Math.min(1, 1 - (starSector + planetSector - triangle) / Math.PI));
}

// Forty-day teaching example: central transits with a fixed illustrative
// crossing timescale. The period sets recurrence, not a fitted orbital model.
export function periodicTransitFlux(day, period, radiusRatio) {
  const offset = (day % period) - period / 2;
  return transitFlux(offset * 2.5, radiusRatio);
}
