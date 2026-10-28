// Ideal, unpowered flyby: far-field planet-relative speeds are equal.
// Synthetic coplanar geometry, not a fit to either Pioneer encounter.
export function gravityAssist(turnDegrees, planetSpeed = 13, relativeSpeed = 10) {
  const turn = turnDegrees * Math.PI / 180;
  const incoming = [-relativeSpeed, 0];
  const outgoing = [-relativeSpeed * Math.cos(turn), relativeSpeed * Math.sin(turn)];
  return {
    incoming, outgoing, planetSpeed, relativeSpeed,
    before: Math.abs(planetSpeed - relativeSpeed),
    after: Math.hypot(planetSpeed + outgoing[0], outgoing[1]),
  };
}
