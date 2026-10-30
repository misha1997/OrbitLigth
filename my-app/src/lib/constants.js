// Shared constants: nav links, status-label maps, satellite-group color map,
// and the status texts ported from app.js / space-weather.js. Status labels go
// through i18next so they follow the active UI language.
import i18next from "../i18n";

// Shared by the header and footer. Detail pages stay discoverable through
// their hubs; activeNames also highlights the group on standalone mission URLs.
export const NAV_GROUPS = [
  { name: "home", labelKey: "nav.home", end: true },
  { id: "observe", labelKey: "navigation.observe", items: [
    { name: "events", labelKey: "navigation.events" },
    { name: "constellations", labelKey: "nav.constellations" },
    { name: "meteors", labelKey: "nav.meteors" },
    { name: "darksky", labelKey: "nav.darksky" },
    { name: "weather", labelKey: "nav.weather" },
  ]},
  { id: "solar", labelKey: "navigation.solar", activeNames: ["solarsystem3d"], items: [
    { name: "planetarium", labelKey: "navigation.planets" },
    { name: "asteroids", labelKey: "nav.asteroids" },
    { name: "comets", labelKey: "nav.comets" },
  ]},
  { id: "missions", labelKey: "navigation.missions",
    activeNames: ["hubble", "jwst", "roman", "parker", "newhorizons", "juno", "chandra", "tess", "europaclipper", "perseverance", "cassini", "osirisrex", "gaia", "kepler", "spitzer", "pioneer10", "pioneer11", "galileo", "curiosity", "rosetta", "dawn"], items: [
    { name: "missions", labelKey: "nav.missionsHub" },
    { name: "iss", labelKey: "navigation.iss" },
    { name: "satellites", labelKey: "nav.satellites" },
    { name: "launches", labelKey: "navigation.launches" },
    { name: "voyager", labelKey: "nav.voyager" },
  ]},
  { id: "universe", labelKey: "navigation.universe", items: [
    { name: "galaxies", labelKey: "nav.galaxies" },
    { name: "exoplanets", labelKey: "nav.exoplanets" },
    { name: "deep", labelKey: "nav.deep" },
    { name: "mast", labelKey: "navigation.mast" },
    { name: "gallery", labelKey: "navigation.gallery" },
  ]},
  { name: "news", labelKey: "navigation.news" },
];

export const BOT_URL = "https://t.me/neo_watch_bot";

// CARTO's free raster basemap tiles (basemaps.cartocdn.com, used by
// SatMap/DarkSkyMap/EarthTerminatorMap) now watermark unauthenticated
// requests with "API KEY REQUIRED" — this key ships client-side by design
// (CARTO rate-limits it by referrer, not a secret), baked in at CRA build
// time from my-app/.env's REACT_APP_CARTO_KEY. Get one at
// https://carto.com/basemaps/apikey/
export const CARTO_KEY = process.env.REACT_APP_CARTO_KEY || "";

// Launch Library 2 status id → (label, pillClass). Mirrors web/data.py _LAUNCH_STATUS.
export const LAUNCH_STATUS_BY_CLASS = {
  gold: "Go", teal: "Success", coral: "Failure",
};
export function launchPillClass(l) {
  return l.status_class ? "pill " + l.status_class : "pill";
}

// Space-weather status texts (space-weather.js). Keys match the backend's
// xray_status_key / aurora.status_key; labels resolve via i18next.
export const xrayStatus = (key) =>
  key ? i18next.t("weather.xray." + key, { defaultValue: "—" }) : "—";

export const auroraStatus = (key) =>
  key ? i18next.t("weather.aurora." + key, { defaultValue: "—" }) : "—";

// Homepage weather card footers (app.js fillWeather).
export const solarWindFoot = (s) =>
  i18next.t(s < 400 ? "weather.windFoot.calm"
    : s < 500 ? "weather.windFoot.moderate"
    : "weather.windFoot.fast");

export const bzFoot = (bz) =>
  i18next.t(bz > -5 ? "weather.bzFoot.calm"
    : bz > -10 ? "weather.bzFoot.south"
    : "weather.bzFoot.open");

// Back-compat aliases (legacy object form) for any caller still indexing by key.
export const XRAY_STATUS = new Proxy({}, { get: (_, k) => xrayStatus(k) });
export const AURORA_STATUS = new Proxy({}, { get: (_, k) => auroraStatus(k) });
export const SOLAR_WIND_FOOT = solarWindFoot;
export const BZ_FOOT = bzFoot;

// Planet dot colours for the sky-dome (dome.js COLORS).
export const PLANET_COLORS = {
  mercury: "var(--gold)", venus: "var(--gold)", mars: "var(--coral)",
  jupiter: "var(--teal)", saturn: "var(--gold)",
  uranus: "var(--text-dim)", neptune: "var(--text-dim)",
};

// X-ray class → display color (space-weather.js fillCurrent).
export function xrayColor(cls) {
  return cls === "X" ? "#FF6B4A" : cls === "M" ? "#FFA94D"
    : cls === "C" ? "#E8B94D" : "#4FD1C5";
}
