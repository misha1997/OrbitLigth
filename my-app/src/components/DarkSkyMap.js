// Light-pollution map — Leaflet + the free David Lorenz Light Pollution Atlas
// tile overlay (djlorenz.github.io/astronomy/lp), on the same CARTO dark
// basemap used by SatMap.js. Base layer (dark/satellite), the light-pollution
// overlay (year + opacity adjustable), a marker for the observer's saved
// location, a curated Dark Sky Places POI layer, and a click-anywhere popup:
// reads the zone at the clicked point (lib/lightPollution.js, client-side, no
// backend) and draws a small inline-SVG bar chart of that point's light
// pollution across every year the atlas publishes (2016-2025), styled with a
// single-hue ordinal ramp validated for this dark surface (see TIER_COLORS).
//
// All controls (search, locate, base layer, year/opacity, POI toggle, share
// link) live inside this component as a single custom Leaflet control, so
// both the embedded card (DarkSky.js) and the fullscreen modal
// (DarkSkyMapFullscreen.js) get every feature for free without themselves
// changing — same idiom as Leaflet's own zoom/attribution controls, which
// this stacks alongside rather than manually absolute-positioning over.
import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import L from "leaflet";
import i18next from "../i18n";
import {
  getZoneAtPoint, getTrendAtPoint, TIER_COLORS, LP_YEARS, LATEST_YEAR,
  deltaMagAtLpi, TIER_NELM_RANGE, findNearestGoodSky,
} from "../lib/lightPollution";
import { DARK_SKY_PLACES, distanceKm, nearestPlaces, directionsUrl } from "../lib/darkSkyPlaces";
import { getGeocode, getElevation, getObservingConditions } from "../lib/api";
import { getSavedLocations, addSavedLocation, deleteSavedLocation } from "../lib/authApi";
import { useAuth } from "../context/AuthContext";
import { CARTO_KEY } from "../lib/constants";

const DARK_TILE_URL = `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`;
const DARK_TILE_ATTR = "© OpenStreetMap © CARTO";

// Free, no-key satellite imagery — the analogs (lightpollutionmap.info,
// darksitefinder.com) both offer a satellite base layer so a dark site can be
// cross-checked against the actual terrain (mountains, tree cover, roads).
const SAT_TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SAT_TILE_ATTR = "Imagery © Esri, Maxar, Earthstar Geographics";

// Same tile grid as lib/lightPollution.js (native zoom 6 — the atlas's own
// config claims 8, but z=7/8 404 everywhere; see that file's note — tileSize
// 1024, zoomOffset -2) so the visual overlay and the click-to-read pixel
// sample always agree, and so this layer doesn't request tiles that don't
// exist (Leaflet would otherwise silently paint the 404s as black patches).
function lpTileUrl(year) {
  return `https://djlorenz.github.io/astronomy/image_tiles/tiles${year}/tile_{z}_{x}_{y}.png`;
}
function lpErrorTileUrl(year) {
  return `https://djlorenz.github.io/astronomy/image_tiles/tiles${year}/black.png`;
}
const LP_ATTR =
  'Light pollution: <a href="https://djlorenz.github.io/astronomy/lp/" target="_blank" rel="noopener">David Lorenz — Light Pollution Atlas</a>';

const KYIV = [50.45, 30.52];
const DEFAULT_OPACITY = 0.55;

// ---- permalink (?llz=lat,lon,zoom) -----------------------------------------
// A query param, not the URL hash: the page already uses `#dark-sky-map` as an
// anchor-scroll target (DarkSky.js hero button), so the hash is taken.
function readPermalink() {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("llz");
    if (!raw) return null;
    const parts = raw.split(",").map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    const [lat, lon, zoom] = parts;
    return { lat, lon, zoom };
  } catch {
    return null;
  }
}

function writePermalink(lat, lon, zoom) {
  try {
    const params = new URLSearchParams(window.location.search);
    params.set("llz", lat.toFixed(5) + "," + lon.toFixed(5) + "," + zoom);
    const url = window.location.pathname + "?" + params.toString() + window.location.hash;
    window.history.replaceState(null, "", url);
  } catch {
    // ignore — permalink is a convenience, never fatal
  }
}

// Small inline-SVG line chart (not Chart.js — the popup content is raw HTML
// Leaflet drops into the DOM, so a chart-library canvas would need awkward
// manual lifecycle management there; SVG markup just works). One series, no
// legend needed (the tier badge above names it). The line itself stays a
// single neutral color — only the entity ("light pollution here") — while
// each point is filled by its own tier, reusing the exact same encoding as
// the page legend. X spacing is proportional to the actual year, not evenly
// indexed, since the atlas's years aren't evenly spaced (2016, 2020, then
// yearly) — an evenly-spaced line would misrepresent the real gaps. Native
// <title> elements give a per-point hover tooltip for free.
function trendSvg(trend) {
  const W = 224, H = 66, PAD_L = 8, PAD_R = 8, PAD_B = 14, PAD_T = 8;
  const years = trend.map((d) => d.year);
  const yLo = years[0], yHi = years[years.length - 1];
  const ySpan = Math.max(yHi - yLo, 1);
  const logs = trend.filter((d) => d.lpi != null).map((d) => Math.log10(Math.max(d.lpi, 0.005)));
  const lo = logs.length ? Math.min(...logs) : 0;
  const hi = logs.length ? Math.max(...logs) : 1;
  const span = Math.max(hi - lo, 0.15); // keep a near-flat trend from dividing by ~0
  const plotH = H - PAD_T - PAD_B;
  const plotW = W - PAD_L - PAD_R;

  const pts = trend.map((d) => {
    const x = PAD_L + ((d.year - yLo) / ySpan) * plotW;
    if (d.lpi == null) return { x, y: null, d };
    const lg = Math.log10(Math.max(d.lpi, 0.005));
    const frac = Math.max(0, Math.min(1, (lg - lo) / span));
    const y = PAD_T + (1 - frac) * plotH;
    return { x, y, d };
  });

  const known = pts.filter((p) => p.y != null);
  const line = known.length > 1
    ? '<polyline points="' + known.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ") +
      '" fill="none" stroke="#D6AC34" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
    : "";

  let dots = "";
  pts.forEach((p) => {
    const labelY = H - 3;
    dots += '<text x="' + p.x.toFixed(1) + '" y="' + labelY +
      '" font-size="8.5" fill="#8B90AC" text-anchor="middle">\'' + String(p.d.year).slice(2) + "</text>";
    if (p.y == null) return;
    const color = TIER_COLORS[p.d.tier] || "#8B90AC";
    const tip = p.d.year + ": " + p.d.zone + " (LPI ≈ " + p.d.lpi.toFixed(2) + ")";
    dots += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) +
      '" r="3.5" fill="' + color + '" stroke="#0a0c14" stroke-width="1.5"><title>' + tip + "</title></circle>";
  });

  return (
    '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H +
    '" style="display:block;font-family:var(--font-mono,monospace)">' +
    '<line x1="' + PAD_L + '" y1="' + (H - PAD_B) + '" x2="' + (W - PAD_R) + '" y2="' + (H - PAD_B) +
    '" stroke="#2c2c2a" stroke-width="1"/>' +
    line + dots +
    "</svg>"
  );
}

function loadingHtml() {
  return '<div style="font-family:var(--font-mono,monospace);font-size:12px;min-width:180px">' +
    i18next.t("darksky.popup.loading") + "</div>";
}

// Shared action-button markup for a popup about a specific point: "use this
// point for tonight's verdict" (wired in wirePopupButtons), an optional
// "get directions" deep link (a plain <a>, needs no JS), and "copy
// coordinates". Reused by the LP click-point popup and the nearest-finder
// result popup.
function pointActionsHtml(lat, lon, { directions } = {}) {
  const t = i18next.t.bind(i18next);
  let html =
    '<button type="button" class="dsm-use-point dsm-locate-btn" data-lat="' + lat + '" data-lon="' + lon +
    '" style="margin-top:8px;width:100%">🎯 ' + t("darksky.map.usePoint") + "</button>";
  if (directions) {
    html +=
      '<a class="dsm-locate-btn" style="margin-top:6px;width:100%;text-align:center;text-decoration:none;' +
      'display:block;box-sizing:border-box" href="' + directionsUrl(lat, lon) +
      '" target="_blank" rel="noopener noreferrer">🚗 ' + t("darksky.map.getDirections") + "</a>";
  }
  html +=
    '<button type="button" class="dsm-copy-coords dsm-locate-btn" data-lat="' + lat + '" data-lon="' + lon +
    '" style="margin-top:6px;width:100%">📋 ' + lat.toFixed(4) + ", " + lon.toFixed(4) + "</button>";
  return html;
}

// Wires the "use this point"/"copy coordinates" buttons inside an already
// open popup's DOM (event delegation — the buttons are raw HTML Leaflet drops
// into the DOM, not React). `onUsePoint(lat, lon)` fires the caller's
// onSelectPoint callback; safe to call even if the popup has no such buttons.
function wirePopupButtons(popup, onUsePoint) {
  const t = i18next.t.bind(i18next);
  const el = popup.getElement ? popup.getElement() : popup;
  if (!el) return;
  const copyBtn = el.querySelector(".dsm-copy-coords");
  if (copyBtn) {
    L.DomEvent.on(copyBtn, "click", () => {
      const text = copyBtn.dataset.lat + ", " + copyBtn.dataset.lon;
      if (!navigator.clipboard || !navigator.clipboard.writeText) return;
      navigator.clipboard.writeText(text).then(() => {
        const original = copyBtn.innerHTML;
        copyBtn.innerHTML = "✓ " + t("darksky.map.linkCopied");
        setTimeout(() => { copyBtn.innerHTML = original; }, 1800);
      }).catch(() => {});
    });
  }
  const useBtn = el.querySelector(".dsm-use-point");
  if (useBtn && onUsePoint) {
    L.DomEvent.on(useBtn, "click", () => {
      onUsePoint(parseFloat(useBtn.dataset.lat), parseFloat(useBtn.dataset.lon));
      const original = useBtn.innerHTML;
      useBtn.innerHTML = "✓ " + t("darksky.map.usePointDone");
      setTimeout(() => { useBtn.innerHTML = original; }, 1800);
    });
  }
}

function pointPopupHtml(zoneNow, trend, year, lat, lon, elevationM, cond) {
  const t = i18next.t.bind(i18next);
  if (!zoneNow) {
    return '<div style="font-family:var(--font-mono,monospace);font-size:12px;min-width:180px">' +
      t("darksky.card.zoneUnknown") + "</div>";
  }
  const color = TIER_COLORS[zoneNow.tier] || "#8B90AC";
  const nelmRange = TIER_NELM_RANGE[zoneNow.tier] || "—";
  const elevationLine = elevationM != null
    ? t("darksky.popup.elevation", { n: Math.round(elevationM) })
    : t("darksky.popup.elevationUnknown");
  const cloudLine = cond && cond.cloud_cover_pct != null
    ? t("darksky.popup.cloud", { n: cond.cloud_cover_pct })
    : t("darksky.popup.cloudUnknown");
  const moonLine = cond && cond.moon_illumination_pct != null
    ? t("darksky.popup.moon", { n: cond.moon_illumination_pct })
    : t("darksky.popup.moonUnknown");
  return (
    '<div style="font-family:var(--font-mono,monospace);min-width:236px">' +
    '<div style="font-weight:600;color:' + color + ';margin-bottom:2px">' + t("darksky.tier." + zoneNow.tier) + "</div>" +
    '<div style="font-size:11px;color:#8B90AC;margin-bottom:8px">Zone ' + zoneNow.zone + " · " + t("darksky.popup.lpi", { n: zoneNow.lpi.toFixed(2) }) +
    " · " + t("darksky.popup.asOfYear", { year }) + "</div>" +
    trendSvg(trend) +
    '<div style="font-size:10px;color:#8B90AC;margin-top:4px">' +
    t("darksky.popup.trend", { from: LP_YEARS[0], to: LP_YEARS[LP_YEARS.length - 1] }) +
    "</div>" +
    '<div style="font-size:11px;color:#c9cad6;margin-top:8px;padding-top:8px;border-top:1px solid #2c2c2a">' +
    t("darksky.popup.deltaMag", { n: deltaMagAtLpi(zoneNow.lpi).toFixed(1) }) + "<br/>" +
    t("darksky.popup.nelmRange", { range: nelmRange }) + "<br/>" +
    elevationLine + "<br/>" +
    cloudLine + "<br/>" +
    moonLine +
    "</div>" +
    pointActionsHtml(lat, lon) +
    "</div>"
  );
}

function poiPopupHtml(place, loc) {
  const t = i18next.t.bind(i18next);
  const dist = loc && loc.lat != null
    ? '<div style="font-size:11px;color:#8B90AC;margin-top:4px">' +
      t("darksky.map.distanceFromYou", { km: Math.round(distanceKm(loc.lat, loc.lon, place.lat, place.lon)) }) +
      "</div>"
    : "";
  return (
    '<div style="font-family:var(--font-mono,monospace);min-width:200px">' +
    '<div style="font-weight:600;color:#E8B94D;margin-bottom:2px">' + place.name + "</div>" +
    '<div style="font-size:11px;color:#8B90AC">' + place.country + " · " + t("darksky.map.poiType." + place.type) + "</div>" +
    dist +
    '<a class="dsm-locate-btn" style="margin-top:8px;width:100%;text-align:center;text-decoration:none;' +
    'display:block;box-sizing:border-box" href="' + directionsUrl(place.lat, place.lon) +
    '" target="_blank" rel="noopener noreferrer">🚗 ' + t("darksky.map.getDirections") + "</a>" +
    "</div>"
  );
}

function poiDivIcon() {
  return L.divIcon({
    className: "dsm-poi-marker",
    html: '<span>★</span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

const DarkSkyMap = forwardRef(function DarkSkyMap({ loc, onSelectPoint }, ref) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const poiMarkersRef = useRef([]);
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;
  const myPlacesApiRef = useRef(null);
  // This effect only runs once (mount), so callbacks it needs to stay fresh
  // are read through a ref rather than captured by value — same pattern as
  // userRef above.
  const onSelectPointRef = useRef(onSelectPoint);
  onSelectPointRef.current = onSelectPoint;

  useImperativeHandle(ref, () => ({
    invalidateSize: () => { if (mapRef.current) mapRef.current.invalidateSize(); },
  }), []);

  useEffect(() => {
    const container = elRef.current;
    if (!container) return;
    let alive = true;
    const t = i18next.t.bind(i18next);
    const permalink = readPermalink();
    const start = permalink
      ? [permalink.lat, permalink.lon]
      : (loc && loc.lat != null ? [loc.lat, loc.lon] : KYIV);
    const startZoom = permalink ? permalink.zoom : 6;

    const map = L.map(container, {
      // worldCopyJump was tried here for seamless antimeridian panning, but
      // it has a known bad interaction with a single very large setView (a
      // search result or nearest-finder jump halfway around the world): the
      // tile pane's transform can desync from the map pane's — tiles report
      // as loaded but render far outside the viewport (blank map) until the
      // next zoom change forces a full reset. A distant jump is exactly what
      // this map's search/locate/nearest-finder features do routinely, so
      // the seamless-wrap nicety isn't worth this failure mode.
      zoomControl: true,
      minZoom: 2,
      maxZoom: 10,
      zoomSnap: 0.5,
    }).setView(start, startZoom);

    const darkLayer = L.tileLayer(DARK_TILE_URL, { attribution: DARK_TILE_ATTR, subdomains: "abcd", maxZoom: 10 });
    const satLayer = L.tileLayer(SAT_TILE_URL, { attribution: SAT_TILE_ATTR, maxZoom: 10 });
    darkLayer.addTo(map);
    let activeBase = darkLayer;

    let currentYear = LATEST_YEAR;
    let currentOpacity = DEFAULT_OPACITY;
    let lpLayer = L.tileLayer(lpTileUrl(currentYear), {
      minZoom: 2,
      // The atlas's own config says 8; real deepest zoom with actual tiles
      // is 6 (z=7/8 404 everywhere — see lib/lightPollution.js). Keeping
      // this in sync with that file's TILE_ZOOM avoids black 404 patches.
      maxNativeZoom: 6,
      maxZoom: 19,
      tileSize: 1024,
      zoomOffset: -2,
      opacity: DEFAULT_OPACITY,
      errorTileUrl: lpErrorTileUrl(currentYear),
      attribution: LP_ATTR,
    }).addTo(map);

    // Shared by every programmatic "jump to a point" action (search, locate,
    // nearest-finder, saved-location). `invalidateSize()` after the jump is a
    // defensive belt-and-suspenders measure alongside dropping
    // worldCopyJump above — cheap, and forces Leaflet to fully re-resolve
    // tile positions even if some other large-jump edge case still slips
    // through.
    //
    // `jumpGeneration` guards against the one jump that isn't instant: the
    // nearest-finder's search takes real time (a ring of tile reads), so if
    // the user fires a *different* jump (search, locate, a saved place) while
    // it's still running, its eventual result must not clobber that newer
    // jump when it finally resolves. The nearest-finder click handler claims
    // the current generation before starting its async work and checks it's
    // still current before acting on the result (see below).
    let jumpGeneration = 0;
    function jumpTo(lat, lon, minZoom) {
      jumpGeneration++;
      map.setView([lat, lon], Math.max(map.getZoom(), minZoom), { animate: true });
      map.invalidateSize();
    }

    // Shared by the year <select> and the play/pause animation button below —
    // swaps in a freshly built tile layer for `year` (Leaflet tile layers
    // don't support changing their URL template's baked-in year in place).
    function setOverlayYear(year) {
      currentYear = year;
      const nextLayer = L.tileLayer(lpTileUrl(year), {
        minZoom: 2, maxNativeZoom: 6, maxZoom: 19, tileSize: 1024, zoomOffset: -2,
        opacity: currentOpacity, errorTileUrl: lpErrorTileUrl(year), attribution: LP_ATTR,
      });
      map.removeLayer(lpLayer);
      nextLayer.addTo(map);
      lpLayer = nextLayer;
    }

    // Markers keep their source place on `_place` so a later `loc` change
    // (LocationContext resolving after mount, or the user picking a new city)
    // can refresh each popup's "distance from you" line via setPopupContent —
    // this effect only runs once, so `loc` here is whatever was available at
    // first mount.
    const poiMarkers = DARK_SKY_PLACES.map((p) => {
      const m = L.marker([p.lat, p.lon], { icon: poiDivIcon() }).bindPopup(poiPopupHtml(p, loc), { maxWidth: 240 });
      m._place = p;
      return m;
    });
    poiMarkersRef.current = poiMarkers;
    const poiLayer = L.layerGroup(poiMarkers);

    function onUsePoint(lat, lon, label) {
      if (onSelectPointRef.current) onSelectPointRef.current({ lat, lon, label: label || null });
    }

    function showPointInfo(lat, lon, latlng) {
      const popup = L.popup({ maxWidth: 260, className: "darksky-popup" })
        .setLatLng(latlng)
        .setContent(loadingHtml())
        .openOn(map);
      Promise.all([
        getZoneAtPoint(lat, lon, currentYear),
        getTrendAtPoint(lat, lon),
        getElevation(lat, lon).catch(() => null),
        getObservingConditions({ lat, lon }).catch(() => null),
      ]).then(([zoneNow, trend, elevation, cond]) => {
        if (!alive || map.hasLayer(popup) === false) return;
        const elevationM = elevation && elevation.elevation_m;
        popup.setContent(pointPopupHtml(zoneNow, trend, currentYear, lat, lon, elevationM, cond));
        wirePopupButtons(popup, onUsePoint);
      });
    }

    map.on("click", (e) => showPointInfo(e.latlng.lat, e.latlng.lng, e.latlng));

    markerRef.current = L.circleMarker(start, {
      radius: 7, weight: 2, color: "#fff", fillColor: "#E8B94D", fillOpacity: 1,
    }).addTo(map);
    markerRef.current.on("click", () => {
      const p = markerRef.current.getLatLng();
      showPointInfo(p.lat, p.lng, p);
    });

    // ---- permalink: debounced write on every pan/zoom ----------------------
    let permalinkTimer = null;
    let playTimer = null;
    map.on("moveend zoomend", () => {
      clearTimeout(permalinkTimer);
      permalinkTimer = setTimeout(() => {
        const c = map.getCenter();
        writePermalink(c.lat, c.lng, map.getZoom());
      }, 400);
    });

    // ---- custom control: search / locate / layers / year / opacity / POI ---
    const PanelControl = L.Control.extend({
      options: { position: "topleft" },
      onAdd() {
        const wrap = L.DomUtil.create("div", "leaflet-bar dsm-panel-control");
        L.DomEvent.disableClickPropagation(wrap);
        L.DomEvent.disableScrollPropagation(wrap);

        const toggleBtn = L.DomUtil.create("button", "dsm-toggle-btn", wrap);
        toggleBtn.type = "button";
        toggleBtn.title = t("darksky.map.settingsTitle");
        toggleBtn.setAttribute("aria-label", t("darksky.map.settingsTitle"));
        toggleBtn.innerHTML = "⚙";

        const panel = L.DomUtil.create("div", "dsm-panel", wrap);
        panel.style.display = "none";
        panel.innerHTML = `
          <div class="dsm-row dsm-search-row">
            <input type="text" class="dsm-search-input" placeholder="${esc(t("darksky.map.searchPlaceholder"))}" autocomplete="off" />
            <div class="dsm-search-results"></div>
          </div>
          <button type="button" class="dsm-locate-btn">📍 ${esc(t("darksky.map.locate"))}</button>
          <div class="dsm-status" style="display:none"></div>
          <div class="dsm-row dsm-baselayer-row">
            <button type="button" class="dsm-base-btn on" data-base="dark">${esc(t("darksky.map.layerDark"))}</button>
            <button type="button" class="dsm-base-btn" data-base="sat">${esc(t("darksky.map.layerSatellite"))}</button>
          </div>
          <div class="dsm-row dsm-field-row">
            <span>${esc(t("darksky.map.yearLabel"))}</span>
            <span class="dsm-row" style="gap:4px">
              <select class="dsm-year-select">
                ${LP_YEARS.map((y) => `<option value="${y}"${y === currentYear ? " selected" : ""}>${y}</option>`).join("")}
              </select>
              <button type="button" class="dsm-play-btn" title="${esc(t("darksky.map.playYears"))}" aria-label="${esc(t("darksky.map.playYears"))}">▶</button>
            </span>
          </div>
          <label class="dsm-row dsm-field-row">
            <span>${esc(t("darksky.map.opacityLabel"))}</span>
            <input type="range" class="dsm-opacity-range" min="10" max="100" value="${Math.round(DEFAULT_OPACITY * 100)}" />
          </label>
          <label class="dsm-row dsm-poi-row">
            <input type="checkbox" class="dsm-poi-check" />
            <span>${esc(t("darksky.map.poiLabel"))}</span>
          </label>
          <div class="dsm-poi-caption">${esc(t("darksky.map.poiCaption"))}</div>
          <button type="button" class="dsm-locate-btn dsm-nearest-btn">🧭 ${esc(t("darksky.map.findNearest"))}</button>
          <button type="button" class="dsm-share-btn">🔗 ${esc(t("darksky.map.copyLink"))}</button>
          <div class="dsm-myplaces"></div>
        `;

        let open = false;
        L.DomEvent.on(toggleBtn, "click", (e) => {
          L.DomEvent.stop(e);
          open = !open;
          panel.style.display = open ? "flex" : "none";
        });

        const statusEl = panel.querySelector(".dsm-status");
        function showStatus(msg, isError) {
          statusEl.textContent = msg;
          statusEl.style.display = "block";
          statusEl.style.color = isError ? "#e07a5f" : "#8B90AC";
          clearTimeout(showStatus._id);
          showStatus._id = setTimeout(() => { statusEl.style.display = "none"; }, 3000);
        }

        // -- search --
        const searchInput = panel.querySelector(".dsm-search-input");
        const resultsEl = panel.querySelector(".dsm-search-results");
        let searchTimer = null;
        L.DomEvent.on(searchInput, "input", () => {
          const q = searchInput.value.trim();
          clearTimeout(searchTimer);
          resultsEl.innerHTML = "";
          if (q.length < 2) return;
          searchTimer = setTimeout(() => {
            getGeocode(q).then((list) => {
              if (!alive) return;
              resultsEl.innerHTML = "";
              (list || []).slice(0, 6).forEach((it) => {
                const row = document.createElement("div");
                row.className = "dsm-search-result";
                const name = document.createElement("span");
                name.className = "dsm-sr-name";
                name.textContent = it.short_name || "";
                const sub = document.createElement("span");
                sub.className = "dsm-sr-sub";
                sub.textContent = [it.state, it.country].filter(Boolean).join(", ");
                row.appendChild(name);
                row.appendChild(sub);
                L.DomEvent.on(row, "click", () => {
                  const lat = parseFloat(it.lat), lon = parseFloat(it.lon);
                  jumpTo(lat, lon, 7);
                  resultsEl.innerHTML = "";
                  searchInput.value = it.short_name || "";
                  onUsePoint(lat, lon, it.short_name);
                });
                resultsEl.appendChild(row);
              });
            }).catch(() => {});
          }, 350);
        });

        // -- locate (local to the map — does not touch the site's saved loc) --
        const locateBtn = panel.querySelector(".dsm-locate-btn");
        L.DomEvent.on(locateBtn, "click", () => {
          if (!navigator.geolocation) { showStatus(t("darksky.map.locateFail"), true); return; }
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords;
              jumpTo(latitude, longitude, 8);
              onUsePoint(latitude, longitude);
            },
            () => { showStatus(t("darksky.map.locateFail"), true); },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
          );
        });

        // -- base layer toggle --
        const baseBtns = panel.querySelectorAll(".dsm-base-btn");
        baseBtns.forEach((btn) => {
          L.DomEvent.on(btn, "click", () => {
            const wantSat = btn.dataset.base === "sat";
            const next = wantSat ? satLayer : darkLayer;
            if (next === activeBase) return;
            map.removeLayer(activeBase);
            next.addTo(map);
            if (lpLayer) lpLayer.bringToFront();
            activeBase = next;
            baseBtns.forEach((b) => b.classList.toggle("on", b === btn));
          });
        });

        // -- year selector + play/pause animation --
        const yearSelect = panel.querySelector(".dsm-year-select");
        const opacityRange = panel.querySelector(".dsm-opacity-range");
        const playBtn = panel.querySelector(".dsm-play-btn");
        L.DomEvent.on(yearSelect, "change", () => {
          setOverlayYear(parseInt(yearSelect.value, 10));
        });

        function stopPlaying() {
          if (!playTimer) return;
          clearInterval(playTimer);
          playTimer = null;
          playBtn.textContent = "▶";
        }
        L.DomEvent.on(playBtn, "click", () => {
          if (playTimer) { stopPlaying(); return; }
          playBtn.textContent = "⏸";
          playTimer = setInterval(() => {
            const idx = LP_YEARS.indexOf(currentYear);
            const nextYear = LP_YEARS[(idx + 1) % LP_YEARS.length];
            setOverlayYear(nextYear);
            yearSelect.value = nextYear;
          }, 1200);
        });

        // -- opacity slider --
        L.DomEvent.on(opacityRange, "input", () => {
          currentOpacity = parseInt(opacityRange.value, 10) / 100;
          if (lpLayer) lpLayer.setOpacity(currentOpacity);
        });

        // -- Dark Sky Places toggle --
        const poiCheck = panel.querySelector(".dsm-poi-check");
        L.DomEvent.on(poiCheck, "change", () => {
          if (poiCheck.checked) poiLayer.addTo(map);
          else map.removeLayer(poiLayer);
        });

        // -- nearest-dark-sky finder --
        // Prefers an actual named, reachable certified place (within 400 km)
        // over a raw atlas pixel — a pixel-only result can land in an ocean
        // or trackless forest. Falls back to the pixel search when no named
        // place is nearby, and still mentions the pixel point as a secondary
        // line when it's a meaningfully darker tier than the named place.
        const TIER_RANK = { excellent: 0, good: 1, moderate: 2, bright: 3, poor: 4 };
        const nearestBtn = panel.querySelector(".dsm-nearest-btn");
        let nearestMarker = null;
        L.DomEvent.on(nearestBtn, "click", () => {
          const c = map.getCenter();
          const original = nearestBtn.innerHTML;
          nearestBtn.disabled = true;
          nearestBtn.innerHTML = "🧭 " + t("darksky.map.searching");
          // Claim the current generation before the async search starts — if
          // the user fires a different jump (search/locate/saved place)
          // before this resolves, jumpGeneration will have moved on and the
          // check below discards this result instead of clobbering theirs.
          const myGeneration = jumpGeneration;
          const namedCandidate = nearestPlaces(c.lat, c.lng, 1)[0] || null;
          Promise.all([
            findNearestGoodSky(c.lat, c.lng),
            namedCandidate ? getZoneAtPoint(namedCandidate.lat, namedCandidate.lon) : Promise.resolve(null),
          ]).then(([pixelResult, namedZone]) => {
            nearestBtn.disabled = false;
            nearestBtn.innerHTML = original;
            if (!alive || jumpGeneration !== myGeneration) return;
            const namedNearby = namedCandidate && namedCandidate.distanceKm <= 400 ? namedCandidate : null;
            if (!namedNearby && !pixelResult) { showStatus(t("darksky.map.nearestNotFound"), true); return; }

            const namedRank = namedZone ? TIER_RANK[namedZone.tier] : null;
            const pixelRank = pixelResult ? TIER_RANK[pixelResult.tier] : null;
            const showPixelToo = namedNearby && pixelResult && namedRank != null && pixelRank < namedRank;
            const primary = namedNearby
              ? { lat: namedNearby.lat, lon: namedNearby.lon }
              : { lat: pixelResult.lat, lon: pixelResult.lon };

            if (nearestMarker) map.removeLayer(nearestMarker);
            nearestMarker = L.circleMarker([primary.lat, primary.lon], {
              radius: 8, weight: 2, color: "#fff", fillColor: "#4FD1C5", fillOpacity: 1,
            }).addTo(map);

            let html = '<div style="font-family:var(--font-mono,monospace);min-width:200px">';
            if (namedNearby) {
              html +=
                '<div style="font-weight:600;color:#E8B94D;margin-bottom:2px">' + namedNearby.name + "</div>" +
                '<div style="font-size:11px;color:#8B90AC">' + namedNearby.country + " · " +
                t("darksky.map.poiType." + namedNearby.type) + "</div>" +
                '<div style="font-size:11px;color:#8B90AC;margin-top:2px">' +
                t("darksky.map.nearestDistance", { km: Math.round(namedNearby.distanceKm) }) + "</div>";
              if (namedZone) {
                html += '<div style="font-size:11px;color:' + (TIER_COLORS[namedZone.tier] || "#8B90AC") +
                  ';margin-top:2px">' + t("darksky.tier." + namedZone.tier) + "</div>";
              }
              if (showPixelToo) {
                html += '<div style="font-size:10.5px;color:#8B90AC;margin-top:6px;padding-top:6px;' +
                  'border-top:1px solid #2c2c2a">' +
                  t("darksky.map.nearestDarkerNearby", {
                    tier: t("darksky.tier." + pixelResult.tier), km: Math.round(pixelResult.distanceKm),
                  }) + "</div>";
              }
            } else {
              html +=
                '<div style="font-weight:600;color:' + (TIER_COLORS[pixelResult.tier] || "#4FD1C5") + '">' +
                t("darksky.tier." + pixelResult.tier) + "</div>" +
                '<div style="font-size:11px;color:#8B90AC;margin-top:2px">' +
                t("darksky.map.nearestDistance", { km: Math.round(pixelResult.distanceKm) }) + "</div>";
            }
            html += pointActionsHtml(primary.lat, primary.lon, { directions: true }) + "</div>";

            nearestMarker.bindPopup(html, { maxWidth: 260 });
            jumpTo(primary.lat, primary.lon, 9);
            nearestMarker.openPopup();
            wirePopupButtons(nearestMarker.getPopup(), onUsePoint);
          }).catch(() => {
            nearestBtn.disabled = false;
            nearestBtn.innerHTML = original;
            if (alive) showStatus(t("darksky.map.nearestNotFound"), true);
          });
        });

        // -- My places (saved locations, website account) --
        const myPlacesEl = panel.querySelector(".dsm-myplaces");
        function renderMyPlaces() {
          if (!alive) return;
          if (!userRef.current) {
            myPlacesEl.innerHTML =
              '<div class="dsm-poi-caption">' + t("darksky.map.myPlacesLoginHint") +
              ' <a class="dsm-login-link" href="/' + (i18next.language === "en" ? "en/login" : "ua/uviyty") + '">' +
              t("darksky.map.myPlacesLogin") + "</a></div>";
            return;
          }
          myPlacesEl.innerHTML = '<div class="dsm-status" style="display:block">' + t("darksky.map.myPlacesLoading") + "</div>";
          getSavedLocations().then((data) => {
            if (!alive) return;
            const locations = (data && data.locations) || [];
            myPlacesEl.innerHTML = "";
            const addRow = document.createElement("div");
            addRow.className = "dsm-row dsm-myplaces-add";
            addRow.innerHTML =
              '<input type="text" class="dsm-myplaces-input" placeholder="' +
              esc(t("darksky.map.myPlacesLabelPlaceholder")) + '" autocomplete="off" />' +
              '<button type="button" class="dsm-myplaces-add-btn">+</button>';
            myPlacesEl.appendChild(addRow);
            const labelInput = addRow.querySelector(".dsm-myplaces-input");
            const addBtn = addRow.querySelector(".dsm-myplaces-add-btn");
            L.DomEvent.on(addBtn, "click", () => {
              const c = map.getCenter();
              const label = labelInput.value.trim() || (c.lat.toFixed(2) + ", " + c.lng.toFixed(2));
              addSavedLocation(label, c.lat, c.lng).then(() => renderMyPlaces()).catch(() => showStatus(t("darksky.map.locateFail"), true));
            });
            locations.forEach((loc0) => {
              const row = document.createElement("div");
              row.className = "dsm-myplaces-row";
              const name = document.createElement("span");
              name.className = "dsm-myplaces-name";
              name.textContent = loc0.label;
              L.DomEvent.on(name, "click", () => {
                jumpTo(loc0.lat, loc0.lon, 9);
                onUsePoint(loc0.lat, loc0.lon, loc0.label);
              });
              const del = document.createElement("button");
              del.type = "button";
              del.className = "dsm-myplaces-del";
              del.textContent = "×";
              del.title = t("darksky.map.myPlacesDelete");
              L.DomEvent.on(del, "click", () => {
                deleteSavedLocation(loc0.id).then(() => renderMyPlaces()).catch(() => showStatus(t("darksky.map.locateFail"), true));
              });
              row.appendChild(name);
              row.appendChild(del);
              myPlacesEl.appendChild(row);
            });
          }).catch(() => { if (alive) myPlacesEl.innerHTML = ""; });
        }
        myPlacesApiRef.current = { refresh: renderMyPlaces };
        renderMyPlaces();

        // -- copy permalink --
        const shareBtn = panel.querySelector(".dsm-share-btn");
        L.DomEvent.on(shareBtn, "click", () => {
          const c = map.getCenter();
          writePermalink(c.lat, c.lng, map.getZoom());
          const done = () => {
            const original = shareBtn.innerHTML;
            shareBtn.innerHTML = "✓ " + esc(t("darksky.map.linkCopied"));
            setTimeout(() => { shareBtn.innerHTML = original; }, 1800);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(window.location.href).then(done).catch(() => showStatus(t("darksky.map.locateFail"), true));
          }
        });

        return wrap;
      },
    });
    const panelControl = new PanelControl();
    panelControl.addTo(map);

    mapRef.current = map;
    return () => {
      alive = false;
      clearTimeout(permalinkTimer);
      clearInterval(playTimer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loc || loc.lat == null) return;
    map.setView([loc.lat, loc.lon], Math.max(map.getZoom(), 6), { animate: true });
    map.invalidateSize();
    if (markerRef.current) markerRef.current.setLatLng([loc.lat, loc.lon]);
    poiMarkersRef.current.forEach((m) => m.setPopupContent(poiPopupHtml(m._place, loc)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc && loc.lat, loc && loc.lon]);

  useEffect(() => {
    if (myPlacesApiRef.current) myPlacesApiRef.current.refresh();
  }, [user]);

  return <div ref={elRef} className="dark-sky-map" style={{ width: "100%", height: "100%" }} />;
});

export default DarkSkyMap;
