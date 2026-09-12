// Live satellite map — Leaflet + satellite.js (TLE propagation in the
// browser). Port of site/assets/sat-map.js. The browser propagates each
// satellite's TLE itself every second, so markers move in real time with no
// per-frame API calls. Click a marker to select it — the parent renders a
// SatDetailPanel from the `onSelect` payload (name, NORAD id, live position,
// TLE-derived orbital elements, eclipse status; see lib/satOrbit.js).
//
// Imperative by design: Leaflet mutates the DOM directly, so the map is built
// once in a mount effect and exposed to the parent through a ref handle
// (addGroup/removeGroup/setFollow/redrawTrack/clearSelection + the live
// `sats` array). This faithfully reproduces the legacy NEOwatch.SatMap.create()
// API, extended with selection.
import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import L from "leaflet";
import * as satellite from "satellite.js";
import { getTle, getTleGroups } from "../lib/api";
import { CARTO_KEY } from "../lib/constants";
import { orbitalElements, orbitClass, parseIntlDesignator, yearsInOrbit, orbitProgress, nextEclipseChange } from "../lib/satOrbit";

const ECLIPSE_REFRESH_MS = 20000;

const TILE_URL = `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`;
const TILE_ATTR = "© OpenStreetMap © CARTO · TLE: Celestrak";

function propagate(satrec, date) {
  const pv = satellite.propagate(satrec, date);
  if (!pv || !pv.position || typeof pv.position === "boolean") return null;
  const gmst = satellite.gstime(date);
  const geo = satellite.eciToGeodetic(pv.position, gmst);
  if (!geo) return null;
  const v = pv.velocity || {};
  const vel = Math.sqrt((v.x || 0) ** 2 + (v.y || 0) ** 2 + (v.z || 0) ** 2);
  return {
    lat: satellite.degreesLat(geo.latitude),
    lon: satellite.degreesLong(geo.longitude),
    alt: geo.height, // km
    vel, // km/s
  };
}

// Static (TLE-derived, don't change tick-to-tick) info for the selected-sat
// detail panel — computed once per selection and cached on the sat entry.
function computeStaticInfo(sat) {
  if (sat._static) return sat._static;
  const elems = orbitalElements(sat.satrec);
  const desig = parseIntlDesignator(sat.tle1);
  sat._static = {
    ...elems,
    orbitClass: orbitClass(elems.meanAltKm),
    intlDesignator: desig ? desig.text : null,
    yearsInOrbit: desig ? yearsInOrbit(desig.year) : null,
  };
  return sat._static;
}

// Full panel payload for the selected satellite: static orbital elements +
// this tick's live position, refreshing the (relatively expensive) eclipse
// forecast only every ECLIPSE_REFRESH_MS rather than every 1s tick.
function buildPanelData(sat, p, date) {
  const staticInfo = computeStaticInfo(sat);
  const progress = orbitProgress(sat.satrec, date);
  let eclipse = sat._eclipse;
  if (!eclipse || date.getTime() - eclipse.at >= ECLIPSE_REFRESH_MS) {
    const next = nextEclipseChange(sat.satrec, date);
    eclipse = { at: date.getTime(), ...(next || { shadowedNow: null, minutesToChange: null }) };
    sat._eclipse = eclipse;
  }
  return {
    name: sat.name,
    norad: sat.norad,
    group: sat.group,
    groupLabel: sat.groupLabel,
    color: sat.color,
    lat: p.lat,
    lon: p.lon,
    alt: p.alt,
    vel: p.vel,
    ...staticInfo,
    minutesToOrbitComplete: staticInfo.periodMin * (1 - progress),
    eclipseShadowedNow: eclipse.shadowedNow,
    eclipseMinutesToChange: eclipse.minutesToChange,
    updatedAt: date,
  };
}

function splitAntimeridian(pts) {
  const segs = [];
  let cur = [];
  for (let i = 0; i < pts.length; i++) {
    if (cur.length && Math.abs(pts[i][1] - cur[cur.length - 1][1]) > 180) {
      segs.push(cur); cur = [];
    }
    cur.push(pts[i]);
  }
  if (cur.length) segs.push(cur);
  return segs;
}

const SatMap = forwardRef(function SatMap(
  { groups = ["iss"], limit = 300, follow = false, track = false, lang, onReady, onCount, onTick, onSelect },
  ref
) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const satsRef = useRef([]);
  const groupMetaRef = useRef({});
  const trackLayerRef = useRef(null);
  const footprintRef = useRef(null);
  const followRef = useRef(follow);
  const followTickRef = useRef(0);
  const tickIdRef = useRef(null);
  const trackIdRef = useRef(null);
  const readyRef = useRef(false);
  const selectedRef = useRef(null);
  // Latest callbacks/flags kept in refs so the mount effect sees fresh values.
  const cbRef = useRef({ onReady, onCount, onTick, onSelect, track });
  cbRef.current = { onReady, onCount, onTick, onSelect, track };
  const methodsRef = useRef({});

  useImperativeHandle(ref, () => ({
    get sats() { return satsRef.current; },
    addGroup: (k) => methodsRef.current.addGroup ? methodsRef.current.addGroup(k) : Promise.resolve(),
    removeGroup: (k) => methodsRef.current.removeGroup && methodsRef.current.removeGroup(k),
    setFollow: (v) => { followRef.current = !!v; },
    redrawTrack: () => methodsRef.current.redrawTrack && methodsRef.current.redrawTrack(),
    invalidateSize: () => methodsRef.current.invalidateSize && methodsRef.current.invalidateSize(),
    clearSelection: () => methodsRef.current.clearSelection && methodsRef.current.clearSelection(),
  }), []);

  useEffect(() => {
    const container = elRef.current;
    if (!container) return;
    const map = L.map(container, {
      preferCanvas: true,
      worldCopyJump: true,
      zoomControl: true,
      minZoom: 2,
      maxZoom: 8,
      zoomSnap: 0.5,
    }).setView([30, 30], 3);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, subdomains: "abcd", maxZoom: 8 }).addTo(map);
    mapRef.current = map;
    let alive = true; // flipped false on cleanup so late async callbacks bail

    map.on("dragstart zoomstart", () => { followRef.current = false; });

    const sats = satsRef.current;

    getTleGroups(lang).then((list) => {
      if (!alive) return;
      list.forEach((g) => { groupMetaRef.current[g.key] = g; });
    }).catch(() => {});

    function emitCount() {
      if (cbRef.current.onCount) cbRef.current.onCount(sats.length);
    }

    function markSelected(sat, on) {
      const el = sat.marker && sat.marker.getElement && sat.marker.getElement();
      if (el) el.classList.toggle("sat-selected-marker", on);
    }

    function selectSat(sat) {
      if (selectedRef.current === sat) return;
      if (selectedRef.current) markSelected(selectedRef.current, false);
      selectedRef.current = sat;
      markSelected(sat, true);
      const p = sat._last || propagate(sat.satrec, new Date());
      if (p && cbRef.current.onSelect) cbRef.current.onSelect(buildPanelData(sat, p, new Date()));
    }

    function clearSelection() {
      if (selectedRef.current) markSelected(selectedRef.current, false);
      selectedRef.current = null;
      if (cbRef.current.onSelect) cbRef.current.onSelect(null);
    }

    function loadGroup(key) {
      return getTle(key, limit, lang).then((data) => {
        if (!alive) return; // map may have been torn down (StrictMode remount / unmount)
        const color = (data.color || (groupMetaRef.current[key] || {}).color) || "#E8B94D";
        
        // Define high-quality SVG shapes based on the group
        let svgIcon = "";
        if (key === "iss") {
          svgIcon = `<svg viewBox="0 0 32 32" width="32" height="32" stroke="${color}" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="8" height="10" rx="1" fill="${color}" fill-opacity="0.25"/>
            <rect x="21" y="11" width="8" height="10" rx="1" fill="${color}" fill-opacity="0.25"/>
            <line x1="7" y1="11" x2="7" y2="21" />
            <line x1="25" y1="11" x2="25" y2="21" />
            <line x1="11" y1="16" x2="21" y2="16" stroke-width="2" />
            <rect x="14" y="6" width="4" height="20" rx="1" fill="${color}" />
          </svg>`;
        } else {
          svgIcon = `<svg viewBox="0 0 32 32" width="24" height="24" stroke="${color}" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="12" y="12" width="8" height="8" rx="1" fill="${color}" fill-opacity="0.75" />
            <rect x="4" y="13" width="6" height="6" rx="0.5" fill="${color}" fill-opacity="0.2"/>
            <line x1="10" y1="16" x2="12" y2="16" stroke-width="2"/>
            <rect x="22" y="13" width="6" height="6" rx="0.5" fill="${color}" fill-opacity="0.2"/>
            <line x1="20" y1="16" x2="22" y2="16" stroke-width="2"/>
            <path d="M16 12L16 6 M14 8h4" />
          </svg>`;
        }

        (data.items || []).forEach((it) => {
          let satrec;
          try { satrec = satellite.twoline2satrec(it.tle1, it.tle2); } catch (e) { return; }
          if (!satrec) return;
          const marker = L.marker([0, 0], {
            icon: L.divIcon({
              className: "sat-miniature",
              html: `<div style="display:flex; align-items:center; justify-content:center;">${svgIcon}</div>`,
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            }),
            interactive: true,
          });
          marker.addTo(map);
          const satEntry = {
            satrec, name: it.name, norad: it.norad_id, tle1: it.tle1,
            group: key, groupLabel: data.label, marker, color,
          };
          marker.on("click", () => { selectSat(satEntry); });
          sats.push(satEntry);
        });
        if (!readyRef.current && sats.length) {
          readyRef.current = true;
          if (cbRef.current.onReady) cbRef.current.onReady(sats.length);
        }
        emitCount();
        return data;
      });
    }

    function drawTrack() {
      if (!alive || !cbRef.current.track || !sats.length) return;
      const sat = sats[0];
      if (trackLayerRef.current) { map.removeLayer(trackLayerRef.current); trackLayerRef.current = null; }
      if (footprintRef.current) { map.removeLayer(footprintRef.current); footprintRef.current = null; }
      const pts = [];
      const start = new Date();
      for (let off = 0; off <= 95 * 60; off += 90) {
        const p = propagate(sat.satrec, new Date(start.getTime() + off * 1000));
        if (p) pts.push([p.lat, p.lon]);
      }
      const segments = splitAntimeridian(pts);
      trackLayerRef.current = L.polyline(segments.length > 1 ? segments : pts, {
        color: sat.color, weight: 1, opacity: 0.5, dashArray: "4 4",
      }).addTo(map);
      const now = propagate(sat.satrec, new Date());
      if (now) {
        const radiusKm = Math.max(900, Math.sqrt(now.alt) * 950);
        footprintRef.current = L.circle([now.lat, now.lon], {
          radius: radiusKm * 1000, color: sat.color, weight: 1,
          opacity: 0.35, fillOpacity: 0.06,
        }).addTo(map);
      }
    }

    function tick() {
      if (!alive) return;
      const date = new Date();
      let firstMoved = null;
      for (const s of sats) {
        const p = propagate(s.satrec, date);
        if (!p) continue;
        s.marker.setLatLng([p.lat, p.lon]);
        s._last = p;
        if (!firstMoved) firstMoved = s;
      }
      if (followRef.current && firstMoved && firstMoved._last && (++followTickRef.current % 3 === 0)) {
        map.panTo([firstMoved._last.lat, firstMoved._last.lon], { animate: true, duration: 1.2 });
      }
      if (cbRef.current.onTick && firstMoved) {
        cbRef.current.onTick(firstMoved._last, sats);
      }
      const sel = selectedRef.current;
      if (sel && sel._last && cbRef.current.onSelect) {
        cbRef.current.onSelect(buildPanelData(sel, sel._last, date));
      }
    }

    // Expose imperative methods to the parent (via the methodsRef the handle reads).
    methodsRef.current = {
      addGroup: (key) => { if (!alive) return Promise.resolve(); return loadGroup(key).then(() => { tick(); }); },
      removeGroup: (key) => {
        if (!alive) return;
        for (let i = sats.length - 1; i >= 0; i--) {
          if (sats[i].group === key) {
            if (selectedRef.current === sats[i]) clearSelection();
            map.removeLayer(sats[i].marker);
            sats.splice(i, 1);
          }
        }
        emitCount();
      },
      redrawTrack: drawTrack,
      invalidateSize: () => {
        if (alive && map) {
          map.invalidateSize();
        }
      },
      clearSelection,
    };

    // Kick off: load all requested groups, then animate.
    Promise.all(groups.map(loadGroup)).then(() => {
      if (!alive) return;
      tick();
      tickIdRef.current = setInterval(tick, 1000);
      if (cbRef.current.track) { drawTrack(); trackIdRef.current = setInterval(drawTrack, 60000); }
      if (cbRef.current.onReady && !readyRef.current) cbRef.current.onReady(sats.length);
    }).catch((e) => { console.warn("sat-map load:", e); });

    return () => {
      alive = false;
      if (tickIdRef.current) clearInterval(tickIdRef.current);
      if (trackIdRef.current) clearInterval(trackIdRef.current);
      tickIdRef.current = null;
      trackIdRef.current = null;
      map.remove();
      mapRef.current = null;
      sats.length = 0;
      readyRef.current = false;
      selectedRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={elRef} className="sat-map" style={{ width: "100%", height: "100%" }} />;
});

export default SatMap;