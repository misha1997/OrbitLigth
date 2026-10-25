import { json2satrec, propagate, gstime, eciToEcf, eciToGeodetic, degreesLat, degreesLong } from "satellite.js";
import { orbitalElements, orbitClass, orbitProgress, nextEclipseChange, yearsInOrbit } from "./satOrbit";

export const EARTH_KM = 6378.135;
export const OBJECT_COLORS = { satellite: "#2dd4bf", station: "#f9d976", debris: "#fb7185", rocket: "#fb923c", unknown: "#a8b2c8" };

export function mergeCatalog(payloads, active, groups) {
  const objects = new Map();
  const stationIds = new Set([25544, ...(payloads.stations?.items || []).map(o => o.norad_id)]);
  const meta = new Map(groups.map(g => [g.key, g]));
  for (const key of Object.keys(active).filter(k => active[k])) {
    for (const item of payloads[key]?.items || []) {
      const group = meta.get(key);
      const existing = objects.get(item.norad_id);
      if (existing) {
        if (!existing.groupLabels.includes(group?.label || key)) existing.groupLabels.push(group?.label || key);
        if (item.category === "station") existing.category = "station";
        if (item.omm.EPOCH > existing.omm.EPOCH) {
          existing.omm = item.omm; existing.name = item.name;
          existing.stale = payloads[key].stale; existing.fetchedAt = payloads[key].fetched_at;
        } else if (item.omm.EPOCH === existing.omm.EPOCH && !payloads[key].stale) existing.stale = false;
        continue;
      }
      objects.set(item.norad_id, { ...item, group: key, groupLabel: group?.label || key,
        groupLabels: [group?.label || key], stale: payloads[key].stale,
        fetchedAt: payloads[key].fetched_at });
    }
  }
  return [...objects.values()].map(o => {
    const category = stationIds.has(o.norad_id) ? "station" : o.category;
    return { ...o, category, color: OBJECT_COLORS[category] || OBJECT_COLORS.unknown };
  });
}

// Earth-fixed right-handed scene: +Y north, +X at Greenwich, -Z east.
// The sphere's equirectangular texture uses the same longitude convention.
export function propagateObject(satrec, date, gmst = gstime(date)) {
  try {
    const pv = propagate(satrec, date);
    if (!pv?.position || !pv.velocity) return null;
    const geo = eciToGeodetic(pv.position, gmst);
    const ecf = eciToEcf(pv.position, gmst);
    const values = [ecf.x, ecf.y, ecf.z, geo.height, geo.latitude, geo.longitude, pv.velocity.x, pv.velocity.y, pv.velocity.z];
    if (!values.every(Number.isFinite) || geo.height < 0) return null;
    return { position: [ecf.x / EARTH_KM, ecf.z / EARTH_KM, -ecf.y / EARTH_KM],
      lat: degreesLat(geo.latitude), lon: degreesLong(geo.longitude), alt: geo.height,
      vel: Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z) };
  } catch { return null; }
}

export function panelData(object, date = new Date()) {
  try {
    const satrec = json2satrec(object.omm);
    const p = propagateObject(satrec, date);
    if (!p) return null;
    const elements = orbitalElements(satrec);
    const eclipse = nextEclipseChange(satrec, date);
    const year = Number(object.omm.OBJECT_ID?.slice(0, 4));
    return { ...object, ...p, ...elements, norad: object.norad_id,
      intlDesignator: object.omm.OBJECT_ID, yearsInOrbit: year ? yearsInOrbit(year, date) : null,
      orbitClass: orbitClass(elements.meanAltKm),
      minutesToOrbitComplete: elements.periodMin * (1 - orbitProgress(satrec, date)),
      eclipseShadowedNow: eclipse?.shadowedNow, eclipseMinutesToChange: eclipse?.minutesToChange,
      updatedAt: date, epoch: object.omm.EPOCH, raan: Number(object.omm.RA_OF_ASC_NODE),
      argumentPerigee: Number(object.omm.ARG_OF_PERICENTER), meanAnomaly: Number(object.omm.MEAN_ANOMALY),
      meanMotion: Number(object.omm.MEAN_MOTION), bstar: Number(object.omm.BSTAR) };
  } catch { return null; }
}

export function orbitPath(object, date = new Date()) {
  try {
    const rec = json2satrec(object.omm);
    const period = 86400000 / Number(object.omm.MEAN_MOTION);
    // One osculating orbit in the current Earth-fixed orientation.
    const gmst = gstime(date);
    return Array.from({ length: 181 }, (_, i) =>
      propagateObject(rec, new Date(date.getTime() + period * i / 180), gmst)?.position).filter(Boolean);
  } catch { return []; }
}
