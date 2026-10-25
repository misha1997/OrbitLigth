import { json2satrec, twoline2satrec } from "satellite.js";
import { mergeCatalog, propagateObject, panelData, orbitPath } from "./orbitalCatalog";

const omm = { OBJECT_NAME: "TEST", OBJECT_ID: "2024-049A", NORAD_CAT_ID: 100123,
  EPOCH: "2026-10-25T12:00:00", MEAN_MOTION: 15.5, ECCENTRICITY: .0005, INCLINATION: 51.6,
  RA_OF_ASC_NODE: 90, ARG_OF_PERICENTER: 20, MEAN_ANOMALY: 30, BSTAR: .00002,
  MEAN_MOTION_DOT: .000001, MEAN_MOTION_DDOT: 0 };
const date = new Date("2026-10-25T12:00:00Z");
test("six-digit NORAD IDs propagate from OMM and supply full details", () => {
  const rec = json2satrec(omm), p = propagateObject(rec, date);
  expect(rec.satnum).toBe("100123");
  expect(p.alt).toBeGreaterThan(300); expect(p.alt).toBeLessThan(500);
  expect(p.vel).toBeGreaterThan(7);
  const data = panelData({ omm, norad_id: 100123, name: "TEST" }, date);
  expect(data.norad).toBe(100123); expect(data.intlDesignator).toBe("2024-049A");
  expect(data.orbitClass).toBe("LEO"); expect(orbitPath({ omm }, date)).toHaveLength(181);
});
test("OMM and legacy TLE parsing preserve the same orbital geometry", () => {
  const tle1 = "1 25544U 98067A   26298.50000000  .00000100  00000-0  20000-4 0  9991";
  const tle2 = "2 25544  51.6000  90.0000 0005000  20.0000  30.0000 15.50000000100000";
  const a = propagateObject(json2satrec(omm), date), b = propagateObject(twoline2satrec(tle1, tle2), date);
  expect(a.lat).toBeCloseTo(b.lat, 3); expect(a.lon).toBeCloseTo(b.lon, 3); expect(a.alt).toBeCloseTo(b.alt, 2);
});
test("deduplication preserves station type, memberships, and disabled source removal", () => {
  const satellite = { norad_id: 25544, omm, category: "satellite" };
  const payloads = { active: { items: [satellite] }, stations: { items: [{ ...satellite, category: "station" }] } };
  const groups = [{ key: "active", label: "Active" }, { key: "stations", label: "Stations" }];
  const objects = mergeCatalog(payloads, { active: true, stations: true }, groups);
  expect(objects).toHaveLength(1); expect(objects[0].category).toBe("station");
  expect(objects[0].groupLabels).toEqual(["Active", "Stations"]);
  expect(mergeCatalog(payloads, { active: false, stations: false }, groups)).toEqual([]);
});
test("bad or decayed propagation never creates a visible marker", () => {
  expect(propagateObject({}, date)).toBeNull();
  expect(panelData({ omm: {} }, date)).toBeNull();
});
test("newer elements replace duplicates while station identity survives disabling the station source", () => {
  const row = { norad_id: 48274, name: "CSS", category: "satellite", omm };
  const newer = { ...row, omm: { ...omm, EPOCH: "2026-10-26T12:00:00" } };
  const payloads = { active: { items: [row] }, science: { items: [newer] }, stations: { items: [row] } };
  const result = mergeCatalog(payloads, { active: true, science: true, stations: false }, []);
  expect(result).toHaveLength(1); expect(result[0].omm.EPOCH).toBe("2026-10-26T12:00:00");
  expect(result[0].category).toBe("station");
});
