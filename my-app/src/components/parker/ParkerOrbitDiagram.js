// Illustrative, scaled model of Parker Solar Probe's final mission orbit:
// Sun-centered ellipse (perihelion ~8.8 solar radii, aphelion near Venus's
// orbit, eccentricity ~0.89 — derived below, not hardcoded, and it matches
// the mission's real eccentricity as a sanity check) with a marker that
// sweeps faster near the Sun and slower near aphelion per Kepler's second
// law. The on-screen "current speed" is computed live via the vis-viva
// equation for the marker's own simulated position — explicitly not real
// spacecraft telemetry (there's no public live-position feed for Parker),
// see parker.orbit.diagramNote. Animation pacing (T_SCENE_S) is a decorative
// choice, decoupled from the real ~91-day repeat cadence quoted in the
// "next perihelion" chip, so the two never contradict each other.
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Stars } from "@react-three/drei";
import * as THREE from "three";

const AU_KM = 149597870.7;
const GM_SUN = 1.32712440018e11; // km^3/s^2
const PERI_KM = 6.16e6; // matches parker.facts.dist_val
const VENUS_AU = 0.723332;
const APO_KM = VENUS_AU * AU_KM;
const A_KM = (PERI_KM + APO_KM) / 2;
const ECC = (APO_KM - PERI_KM) / (APO_KM + PERI_KM);
const P_KM = A_KM * (1 - ECC * ECC);
const H_KM2S = Math.sqrt(GM_SUN * P_KM); // specific angular momentum
const T_REAL_S = 2 * Math.PI * Math.sqrt(A_KM ** 3 / GM_SUN); // Kepler's third law
const T_SCENE_S = 18; // decorative: seconds per lap in the animation
const UNIT_PER_AU = 18;

const PERIHELION_ANCHOR_MS = Date.UTC(2024, 11, 24); // Dec 24, 2024 record close approach
const PERIHELION_PERIOD_DAYS = 91.3; // NASA-reported repeat cadence of the final orbit

function nextPerihelion(now) {
  const periodMs = PERIHELION_PERIOD_DAYS * 86400000;
  const nowMs = now.getTime();
  if (PERIHELION_ANCHOR_MS > nowMs) return new Date(PERIHELION_ANCHOR_MS);
  const cycles = Math.ceil((nowMs - PERIHELION_ANCHOR_MS) / periodMs);
  return new Date(PERIHELION_ANCHOR_MS + cycles * periodMs);
}

function radiusKm(theta) {
  return P_KM / (1 + ECC * Math.cos(theta));
}

function orbitPoints(segments = 220) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const r = (radiusKm(theta) / AU_KM) * UNIT_PER_AU;
    pts.push(new THREE.Vector3(r * Math.cos(theta), 0, r * Math.sin(theta)));
  }
  return pts;
}

function ringPoints(radiusAu, segments = 96) {
  const pts = [];
  const r = radiusAu * UNIT_PER_AU;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a)));
  }
  return pts;
}

function ParkerMarker({ onFrame }) {
  const ref = useRef();
  const thetaRef = useRef(0.001);

  useFrame((_, delta) => {
    const theta = thetaRef.current;
    const rKm = radiusKm(theta);
    const omega = (H_KM2S / (rKm * rKm)) * (T_REAL_S / T_SCENE_S);
    thetaRef.current = theta + delta * omega;

    const rScene = (rKm / AU_KM) * UNIT_PER_AU;
    const x = rScene * Math.cos(theta);
    const z = rScene * Math.sin(theta);
    if (ref.current) ref.current.position.set(x, 0, z);

    if (onFrame) {
      const vKms = Math.sqrt(GM_SUN * (2 / rKm - 1 / A_KM));
      onFrame(vKms * 3600);
    }
  });

  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshBasicMaterial color="#E8834D" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.42, 8, 8]} />
        <meshBasicMaterial color="#E8834D" transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default function ParkerOrbitDiagram() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-GB" : "uk-UA";
  const speedElRef = useRef(null);

  const orbitPath = useMemo(() => orbitPoints(), []);
  const venusRing = useMemo(() => ringPoints(VENUS_AU), []);
  const earthRing = useMemo(() => ringPoints(1), []);
  const nextPeri = useMemo(() => nextPerihelion(new Date()), []);
  const daysLeft = Math.max(0, Math.ceil((nextPeri.getTime() - Date.now()) / 86400000));

  const speedUnit = t("parker.orbit.speedUnit");
  const handleFrame = (kmh) => {
    if (speedElRef.current) {
      speedElRef.current.textContent = `${Math.round(kmh).toLocaleString(locale)} ${speedUnit}`;
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", background: "#06070a", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)", margin: "32px 0" }}>
      <div style={{ position: "absolute", top: 20, left: 20, zIndex: 10, color: "#fff", fontSize: 13, fontFamily: "var(--font-mono)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#E8B94D", display: "inline-block" }} />
          {t("parker.orbit.legend_sun")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#E8834D", display: "inline-block" }} />
          {t("parker.orbit.legend_parker")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 10, height: 2, background: "#d9a066", display: "inline-block" }} />
          {t("parker.orbit.legend_venus")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 10, height: 2, background: "#4dabf7", display: "inline-block" }} />
          {t("parker.orbit.legend_earth")}
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 16, right: 20, zIndex: 10, color: "rgba(255,255,255,.4)", fontSize: 11, fontFamily: "var(--font-mono)", userSelect: "none" }}>
        {t("hubble.station3d.hint")}
      </div>

      <div style={{ height: 420 }}>
        <Canvas camera={{ position: [0, 15, 21], fov: 45 }}>
          <color attach="background" args={["#06070a"]} />
          <ambientLight intensity={0.4} />
          <pointLight position={[0, 0, 0]} intensity={3} color="#E8B94D" distance={60} decay={1.2} />
          <Stars radius={140} depth={60} count={2500} factor={3.5} saturation={0} fade speed={0.4} />
          <OrbitControls enablePan={false} minDistance={6} maxDistance={45} target={[0, 0, 0]} />

          <mesh>
            <sphereGeometry args={[0.6, 24, 24]} />
            <meshBasicMaterial color="#E8B94D" />
          </mesh>

          <Line points={venusRing} color="#d9a066" transparent opacity={0.35} dashed dashSize={0.6} dashScale={0.5} dashOffset={0} />
          <Line points={earthRing} color="#4dabf7" transparent opacity={0.3} dashed dashSize={0.6} dashScale={0.5} dashOffset={0} />
          <Line points={orbitPath} color="#E8834D" lineWidth={1.4} transparent opacity={0.85} />

          <ParkerMarker onFrame={handleFrame} />
        </Canvas>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", borderTop: "1px solid var(--border)" }}>
        <div style={{ flex: "1 1 220px", padding: "16px 20px", borderRight: "1px solid var(--border)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: ".08em" }}>
            {t("parker.orbit.perihelion_label")}
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--gold)", marginTop: 6 }}>
            {nextPeri.toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" })}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{t("parker.orbit.daysLeft", { days: daysLeft })}</div>
        </div>
        <div style={{ flex: "1 1 220px", padding: "16px 20px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: ".08em" }}>
            {t("parker.orbit.speed_label")}
          </div>
          <div ref={speedElRef} style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--coral)", marginTop: 6 }}>—</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{t("parker.orbit.speed_note")}</div>
        </div>
      </div>

      <p style={{ padding: "12px 20px 18px", margin: 0, fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.5, borderTop: "1px solid var(--border)" }}>
        {t("parker.orbit.diagramNote")}
      </p>
    </div>
  );
}
