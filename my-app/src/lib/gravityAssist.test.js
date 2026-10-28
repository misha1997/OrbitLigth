import { gravityAssist } from "./gravityAssist";

test("no turn leaves the heliocentric speed unchanged", () => {
  const result = gravityAssist(0);
  expect(result.before).toBe(3);
  expect(result.after).toBe(result.before);
});

test.each([0, 45, 90, 140])("an unpowered %s degree turn conserves far-field planet-relative speed", angle => {
  const result = gravityAssist(angle);
  expect(Math.hypot(...result.incoming)).toBeCloseTo(10, 12);
  expect(Math.hypot(...result.outgoing)).toBeCloseTo(10, 12);
});

test("a moving planet changes the Sun-relative vector sum", () => {
  const result = gravityAssist(90);
  expect(result.after).toBeCloseTo(Math.sqrt(269), 12);
  expect(result.after).toBeGreaterThan(result.before);
  expect(gravityAssist(140).after).toBeGreaterThan(result.after);
});

test.each([0, 45, 90, 140])("a stationary planet gives no net speed gain at %s degrees", angle => {
  const result = gravityAssist(angle, 0);
  expect(result.before).toBe(10);
  expect(result.after).toBeCloseTo(10, 12);
});
