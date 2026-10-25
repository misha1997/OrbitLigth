import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import L from "leaflet";
import { CARTO_KEY } from "../lib/constants";

// Canvas circle markers keep the entire public catalog usable without tens
// of thousands of DOM/SVG satellite icons. ISS's existing SatMap is preserved.
export default function SatCatalogMap({ objects, frame, selectedId, onSelect, paused = false, onFullscreen, on3D }) {
  const { t } = useTranslation();
  const [controls, setControls] = useState(null);
  const showControls = !!(onFullscreen || on3D);
  const container = useRef(null), map = useRef(null), markers = useRef(new Map());
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    const m = L.map(container.current, { preferCanvas: true, minZoom: 1, maxZoom: 10, worldCopyJump: true }).setView([20, 25], 2);
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
      { attribution: "© OpenStreetMap © CARTO · Orbits: CelesTrak", subdomains: "abcd" }).addTo(m);
    map.current = m;
    if (showControls) {
      const views = new L.Control({ position: "topleft" });
      views.onAdd = () => {
        const bar = L.DomUtil.create("div", "leaflet-bar sat-map-view-controls");
        L.DomEvent.disableClickPropagation(bar);
        L.DomEvent.disableScrollPropagation(bar);
        setControls(bar);
        return bar;
      };
      views.addTo(m);
    }
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(container.current);
    const layerMarkers = markers.current;
    return () => { resize.disconnect(); m.remove(); map.current = null; layerMarkers.clear(); };
  }, [showControls]);
  useEffect(() => {
    if (!map.current || !frame || paused) return;
    const keep = new Set();
    objects.forEach((o, i) => {
      const lat = frame.geographic[i * 4], lon = frame.geographic[i * 4 + 1];
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      keep.add(o.norad_id);
      let marker = markers.current.get(o.norad_id);
      if (!marker) {
        marker = L.circleMarker([lat, lon], { radius: o.category === "station" ? 6 : 3,
          color: o.color, weight: 0, fillColor: o.color, fillOpacity: .85 }).addTo(map.current);
        marker.bindTooltip(() => { const el = document.createElement("span"); el.textContent = `${o.name} · ${o.norad_id}`; return el; });
        marker.on("click", () => select.current(o.norad_id));
        markers.current.set(o.norad_id, marker);
      } else marker.setLatLng([lat, lon]);
      marker.setStyle({ color: o.color, fillColor: o.color, weight: selectedId === o.norad_id ? 2 : 0 });
      marker.setRadius(selectedId === o.norad_id ? 7 : o.category === "station" ? 6 : 3);
    });
    markers.current.forEach((m, id) => { if (!keep.has(id)) { map.current.removeLayer(m); markers.current.delete(id); } });
  }, [objects, frame, selectedId, paused]);
  return <><div ref={container} className="sat-catalog-map" />
    {controls && createPortal(<>
      {onFullscreen && <button type="button" onClick={onFullscreen} title={t("orbital.openFullscreen")} aria-label={t("orbital.openFullscreen")}>
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M7 2H2v5M13 2h5v5M18 13v5h-5M7 18H2v-5" /></svg>
      </button>}
      {on3D && <button type="button" onClick={on3D} title={t("orbital.open3d")} aria-label={t("orbital.open3d")}>3D</button>}
    </>, controls)}
  </>;
}
