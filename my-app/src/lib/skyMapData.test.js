import { indexSkyPoints, querySkyPoints, loadSkyCatalog, indexSkyStars, querySkyStars, SKY_MAGNITUDES } from "./skyMapData";

test("star queries include exactly the enabled magnitude bins", () => {
  const points = [-1, 5, 5.1, 6.5, 7.5, 8.5, 10.5, 11].map(mag => ({ x: 0, y: 0, star: [mag, 0, 0, mag] }));
  const index = indexSkyStars(points);
  const bounds = { left: -1, top: -1, right: 1, bottom: 1 };
  for (const cutoff of SKY_MAGNITUDES) {
    expect(querySkyStars(index, bounds, cutoff)).toEqual(points.filter(p => p.star[3] <= cutoff));
  }
});

test("spatial queries match a full scan across negative coordinates and cell edges", () => {
  const points = Array.from({ length: 10000 }, (_, id) => ({
    id, x: (id * 37 % 2000) - 1000, y: (id * 83 % 1400) - 700
  }));
  const index = indexSkyPoints(points);
  for (const bounds of [
    { left: -64, top: -128, right: 64, bottom: 0 },
    { left: 0, top: 0, right: 0, bottom: 0 },
    { left: -500, top: -300, right: 400, bottom: 700 },
    { left: 5000, top: 5000, right: 5100, bottom: 5100 }
  ]) {
    const expected = points.filter(p => p.x >= bounds.left && p.x <= bounds.right && p.y >= bounds.top && p.y <= bounds.bottom);
    expect(querySkyPoints(index, bounds).map(p => p.id).sort((a, b) => a - b))
      .toEqual(expected.map(p => p.id).sort((a, b) => a - b));
  }
});

test("catalog requests share one parsed response and retry after HTTP failures", async () => {
  const previous = global.fetch;
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValueOnce({ ok: true, json: async () => [1, 2, 3] });
  try {
    await expect(loadSkyCatalog("/test-catalog")).rejects.toThrow("503");
    const first = loadSkyCatalog("/test-catalog");
    const second = loadSkyCatalog("/test-catalog");
    expect(first).toBe(second);
    await expect(second).resolves.toEqual([1, 2, 3]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  } finally {
    global.fetch = previous;
  }
});
