import { periodicTransitFlux, transitFlux } from "./transitModel";

test("an Earth-size planet across a Sun-size star has roughly 84 ppm depth", () => {
  const earthToSunRadius = 6371 / 695700;
  expect((1 - transitFlux(0, earthToSunRadius)) * 1e6).toBeCloseTo(84, 0);
});

test("a planet with one tenth the star's radius blocks one percent at full transit", () => {
  expect(transitFlux(0, 0.1)).toBeCloseTo(0.99, 12);
  expect(transitFlux(0.8, 0.1)).toBeCloseTo(0.99, 12);
});

test("ingress is partial, symmetric and continuous at contact", () => {
  expect(transitFlux(1, 0.1)).toBeGreaterThan(0.99);
  expect(transitFlux(1, 0.1)).toBeLessThan(1);
  expect(transitFlux(-1, 0.1)).toBeCloseTo(transitFlux(1, 0.1), 12);
  expect(transitFlux(1.1, 0.1)).toBe(1);
  expect(transitFlux(1.099999, 0.1)).toBeCloseTo(1, 8);
});

test("there is no dimming off the star and a larger opaque disk can fully eclipse it", () => {
  expect(transitFlux(2, 0.1)).toBe(1);
  expect(transitFlux(0, 1.2)).toBe(0);
});

test("transits repeat at the chosen period without dimming between passages", () => {
  expect(periodicTransitFlux(5, 10, 0.1)).toBeCloseTo(0.99, 12);
  expect(periodicTransitFlux(15, 10, 0.1)).toBeCloseTo(0.99, 12);
  expect(periodicTransitFlux(10, 10, 0.1)).toBe(1);
  expect(periodicTransitFlux(10, 20, 0.1)).toBeCloseTo(0.99, 12);
});
