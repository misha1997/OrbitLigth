// Orbital-element math for the satellite-detail panel (SatDetailPanel.js).
// Apogee/perigee/period fall straight out of satellite.js's SGP4 satrec
// (sgp4init already computes satrec.alta/altp/no from the TLE), so no
// separate two-body computation is needed for those — only inclination/
// eccentricity need a unit conversion, and the international designator /
// eclipse status are derived here from the raw TLE + a low-precision solar
// position.
import * as satellite from "satellite.js";

const RE_KM = satellite.constants.earthRadius; // 6378.135 km (WGS72)
const RAD2DEG = 180 / Math.PI;
const TWO_PI = 2 * Math.PI;

// LEO/MEO/GEO/HEO from mean altitude — GEO band is generous (±200km) since
// station-keeping drift and TLE staleness both nudge the fitted altitude.
export function orbitClass(meanAltKm) {
  if (meanAltKm >= 35586 && meanAltKm <= 35986) return "GEO";
  if (meanAltKm < 2000) return "LEO";
  if (meanAltKm < 35586) return "MEO";
  return "HEO";
}

export function orbitalElements(satrec) {
  const apogeeKm = satrec.alta * RE_KM;
  const perigeeKm = satrec.altp * RE_KM;
  return {
    inclinationDeg: satrec.inclo * RAD2DEG,
    eccentricity: satrec.ecco,
    apogeeKm,
    perigeeKm,
    periodMin: TWO_PI / satrec.no,
    meanAltKm: (apogeeKm + perigeeKm) / 2,
  };
}

// TLE line 1, columns 10-17 (1-indexed): international designator, e.g.
// "98067A  " -> {year: 1998, launchNum: "067", piece: "A"}.
export function parseIntlDesignator(tle1) {
  if (!tle1) return null;
  const raw = tle1.slice(9, 17).trim();
  const m = raw.match(/^(\d{2})(\d{3})([A-Z]*)$/);
  if (!m) return null;
  const yy = parseInt(m[1], 10);
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  return { year, launchNum: m[2], piece: m[3], text: `${year}-${m[2]}${m[3]}` };
}

export function yearsInOrbit(launchYear, now = new Date()) {
  if (!launchYear) return null;
  return (now.getFullYear() - launchYear) + now.getMonth() / 12;
}

// Fraction (0..1) of the current orbit completed, from the mean anomaly at
// epoch advanced at the constant rate `no` (rad/min) — exact for "time until
// mean-anomaly wraps to 0", which is precisely what "orbit completes in..."
// means, even though real (true-anomaly) position phase differs with e.
export function orbitProgress(satrec, date) {
  const epochMs = (satrec.jdsatepoch - 2440587.5) * 86400000;
  const elapsedMin = (date.getTime() - epochMs) / 60000;
  let m = (satrec.mo + satrec.no * elapsedMin) % TWO_PI;
  if (m < 0) m += TWO_PI;
  return m / TWO_PI;
}

// Low-precision solar position (Astronomical Almanac approximate formulas,
// accurate to ~0.01deg) — plenty for a cylindrical eclipse test, not for
// precise eclipse timing to the second.
export function sunEciUnit(date) {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const n = JD - 2451545.0;
  let L = (280.46 + 0.9856474 * n) % 360; if (L < 0) L += 360;
  let g = (357.528 + 0.9856003 * n) % 360; if (g < 0) g += 360;
  const gr = (g * Math.PI) / 180;
  const lambda = ((L + 1.915 * Math.sin(gr) + 0.02 * Math.sin(2 * gr)) * Math.PI) / 180;
  const eps = ((23.439 - 0.0000004 * n) * Math.PI) / 180;
  return { x: Math.cos(lambda), y: Math.cos(eps) * Math.sin(lambda), z: Math.sin(eps) * Math.sin(lambda) };
}

// Cylindrical Earth-shadow model (ignores penumbra/umbra cone and
// refraction) — good enough for a UI "in shadow now" hint.
export function isEclipsed(posEci, sunHat) {
  const dot = posEci.x * sunHat.x + posEci.y * sunHat.y + posEci.z * sunHat.z;
  if (dot > 0) return false;
  const px = posEci.x - dot * sunHat.x;
  const py = posEci.y - dot * sunHat.y;
  const pz = posEci.z - dot * sunHat.z;
  return Math.sqrt(px * px + py * py + pz * pz) < RE_KM;
}

// Scans forward from `date` in `stepSec` steps to find when the eclipse
// state next flips (up to `maxMinutes` ahead — one LEO orbit has two
// crossings, so the default comfortably covers longer periods too).
export function nextEclipseChange(satrec, date, maxMinutes = 130, stepSec = 20) {
  const sunHat = sunEciUnit(date);
  const pv0 = satellite.propagate(satrec, date);
  if (!pv0 || !pv0.position || typeof pv0.position === "boolean") return null;
  const shadowedNow = isEclipsed(pv0.position, sunHat);
  const steps = Math.floor((maxMinutes * 60) / stepSec);
  for (let i = 1; i <= steps; i++) {
    const t = new Date(date.getTime() + i * stepSec * 1000);
    const pv = satellite.propagate(satrec, t);
    if (!pv || !pv.position || typeof pv.position === "boolean") continue;
    if (isEclipsed(pv.position, sunHat) !== shadowedNow) {
      return { shadowedNow, minutesToChange: (i * stepSec) / 60 };
    }
  }
  return { shadowedNow, minutesToChange: null };
}
