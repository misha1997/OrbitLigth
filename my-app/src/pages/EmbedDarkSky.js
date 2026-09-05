// The actual <iframe src="/embed/dark-sky"> content — reuses DarkSkyMap.js
// wholesale (search, locate, layers, year/opacity, POI, sky-brightening
// popup, nearest-dark-sky finder, My Places) rather than a stripped-down
// hand-written map, so the embed never drifts out of sync with the real page.
// `loc={null}` deliberately: an embedder's visitor has no "site location" of
// their own here (no LocationPill in this bare layout to set one), so the map
// just opens on its own default view (Kyiv) like a fresh visit would.
import DarkSkyMap from "../components/DarkSkyMap";

export default function EmbedDarkSky() {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <DarkSkyMap loc={null} />
      <a
        href="https://orbitlight.space/en/dark-sky"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "absolute", bottom: 8, left: 8, zIndex: 1000,
          background: "rgba(10,12,20,0.8)", color: "#E8B94D",
          fontFamily: "var(--font-mono, monospace)", fontSize: 11,
          padding: "4px 8px", borderRadius: 6, textDecoration: "none",
          border: "1px solid rgba(232,185,77,0.3)",
        }}
      >
        via OrbitLight
      </a>
    </div>
  );
}
