import { normalizedPlanck, spitzerChannelAvailable, SPITZER_IMAGING_CHANNELS, wienPeakMicrons } from "./blackbodyModel";

test("Wien's law places a 300 K body's peak near 9.66 microns and doubles temperature halve it", () => {
  expect(wienPeakMicrons(300)).toBeCloseTo(9.65924, 4);
  expect(wienPeakMicrons(600)).toBeCloseTo(wienPeakMicrons(300) / 2, 12);
});

test.each([50, 300, 1500])("the normalized wavelength spectrum peaks at one and remains finite at %s K", temperature => {
  const peak = wienPeakMicrons(temperature);
  expect(normalizedPlanck(peak, temperature)).toBeCloseTo(1, 12);
  expect(normalizedPlanck(peak / 2, temperature)).toBeLessThan(1);
  expect(normalizedPlanck(peak * 2, temperature)).toBeLessThan(1);
  for (const wavelength of [0.3, 0.5, 3.6, 8, 24, 70, 160, 200]) {
    const value = normalizedPlanck(wavelength, temperature);
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  }
});

test("the warm mission retains only IRAC 3.6 and 4.5 micron imaging channels", () => {
  expect(SPITZER_IMAGING_CHANNELS.filter(w => spitzerChannelAvailable(w, "cold"))).toHaveLength(7);
  expect(SPITZER_IMAGING_CHANNELS.filter(w => spitzerChannelAvailable(w, "warm"))).toEqual([3.6, 4.5]);
  expect(spitzerChannelAvailable(10, "cold")).toBe(false);
});
