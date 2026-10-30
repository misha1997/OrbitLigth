// Illustrative geometry in arbitrary scene units, not a trajectory solution.
export function romanHaloPosition(phase) {
  return [
    15 - Math.cos(phase) * 4.1 + Math.cos(phase * 2) * 1.8,
    Math.sin(phase) * 13.3,
    Math.cos(phase) * 6.6,
  ];
}
