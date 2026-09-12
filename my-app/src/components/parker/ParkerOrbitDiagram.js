import { useMemo, useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Stars } from "@react-three/drei";
import * as THREE from "three";
import { useApi } from "../../hooks/useApi";

const AU_KM = 149597870.7;
const GM_SUN = 1.32712440018e11;
const PERI_KM = 6.16e6;
const VENUS_AU = 0.723332;
const APO_KM = VENUS_AU * AU_KM;
const A_KM = (PERI_KM + APO_KM) / 2;
const ECC = (APO_KM - PERI_KM) / (APO_KM + PERI_KM);
const P_KM = A_KM * (1 - ECC * ECC);
const H_KM2S = Math.sqrt(GM_SUN * P_KM);
const T_REAL_S = 2 * Math.PI * Math.sqrt(A_KM ** 3 / GM_SUN);
const T_SCENE_S = 18;
const UNIT_PER_AU = 18;

const PERIHELION_ANCHOR_MS = Date.UTC(2024, 11, 24);
const PERIHELION_PERIOD_DAYS = 91.3;

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

function ParkerMarker({ current }) {
  const ref = useRef();

  useFrame(() => {
    if (!current || !current.dist_sun) return;
    const rKm = current.dist_sun;
    const cosTheta = (P_KM / rKm - 1) / ECC;
    const clamped = Math.max(-1, Math.min(1, cosTheta));
    let theta = Math.acos(clamped);
    if (!current.is_receding) {
      theta = Math.PI * 2 - theta;
    }

    const rScene = (rKm / AU_KM) * UNIT_PER_AU;
    const x = rScene * Math.cos(theta);
    const z = rScene * Math.sin(theta);
    if (ref.current) ref.current.position.set(x, 0, z);
  });

  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshBasicMaterial color="#E8834D" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.6, 8, 8]} />
        <meshBasicMaterial color="#E8834D" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default function ParkerOrbitDiagram() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-GB" : "uk-UA";

  const orbitPath = useMemo(() => orbitPoints(), []);
  const venusRing = useMemo(() => ringPoints(VENUS_AU), []);
  const earthRing = useMemo(() => ringPoints(1), []);
  const nextPeri = useMemo(() => nextPerihelion(new Date()), []);
  const daysLeft = Math.max(0, Math.ceil((nextPeri.getTime() - Date.now()) / 86400000));

  const { data } = useApi("/api/parker/live", { refreshInterval: 3600000 });
  const [current, setCurrent] = useState({ dist_sun: 0, speed_sun: 0, dist_earth: 0 });

  useEffect(() => {
    if (!data || !data.trajectory || data.trajectory.length < 2) return;
    
    let raf;
    const update = () => {
      const now = Date.now() / 1000;
      const traj = data.trajectory;
      
      let p1 = traj[0], p2 = traj[1];
      for (let i = 0; i < traj.length - 1; i++) {
        if (now >= traj[i].time && now <= traj[i+1].time) {
          p1 = traj[i];
          p2 = traj[i+1];
          break;
        }
      }
      
      if (now > traj[traj.length-1].time) {
        p1 = traj[traj.length-2];
        p2 = traj[traj.length-1];
      }
      if (now < traj[0].time) {
        p1 = traj[0];
        p2 = traj[1];
      }
      
      const tDelta = p2.time - p1.time;
      const progress = tDelta === 0 ? 0 : (now - p1.time) / tDelta;
      
      const dist_sun = p1.dist_sun + (p2.dist_sun - p1.dist_sun) * progress;
      const speed_sun = p1.speed_sun + (p2.speed_sun - p1.speed_sun) * progress;
      const dist_earth = p1.dist_earth + (p2.dist_earth - p1.dist_earth) * progress;
      const is_receding = p2.dist_sun > p1.dist_sun;
      
      setCurrent({ dist_sun, speed_sun, dist_earth, is_receding });
      raf = requestAnimationFrame(update);
    };
    
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [data]);

  const speedUnit = t("parker.telemetry.kms") || "км/с";
  const distUnit = t("parker.telemetry.mln_km") || "млн км";
  const fmtDist = (val) => val > 0 ? (val / 1e6).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
  const fmtSpeed = (val) => val > 0 ? val.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

  const [viewMode, setViewMode] = useState("local");

  return (
    <div style={{ position: "relative", width: "100%", background: "#06070a", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)", margin: "16px 0" }}>
      
      {/* View Toggle */}
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 20, display: "flex", background: "var(--panel)", borderRadius: 6, padding: 4, border: "1px solid var(--border)" }}>
        <button 
          onClick={() => setViewMode("local")}
          style={{ 
            background: viewMode === "local" ? "var(--gold)" : "transparent",
            color: viewMode === "local" ? "#000" : "var(--text)",
            border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", 
            fontSize: "0.85rem", fontWeight: 600, transition: "0.2s"
          }}>
          {t("parker.orbit.view_local") || "3D Модель"}
        </button>
        <button 
          onClick={() => setViewMode("nasa")}
          style={{ 
            background: viewMode === "nasa" ? "var(--gold)" : "transparent",
            color: viewMode === "nasa" ? "#000" : "var(--text)",
            border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", 
            fontSize: "0.85rem", fontWeight: 600, transition: "0.2s"
          }}>
          {t("parker.orbit.view_nasa") || "NASA Eyes"}
        </button>
      </div>

      {viewMode === "local" && (
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
      )}

      {viewMode === "local" && (
        <div style={{ position: "absolute", bottom: 16, right: 20, zIndex: 10, color: "rgba(255,255,255,.4)", fontSize: 11, fontFamily: "var(--font-mono)", userSelect: "none" }}>
          {t("hubble.station3d.hint")}
        </div>
      )}

      <div style={{ height: viewMode === "nasa" ? 650 : 420, transition: "height 0.3s ease" }}>
        {viewMode === "local" ? (
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

            <ParkerMarker current={current} />
          </Canvas>
        ) : (
          <iframe 
            src="https://eyes.nasa.gov/apps/solar-system/#/sc_parker_solar_probe?search=false&shareButton=false&menu=false&collapseSettingsOptions=true&heliosphere=true" 
            title="NASA Eyes Parker Solar Probe"
            style={{ width: "100%", height: "100%", border: "none" }}
            allowFullScreen
          />
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", borderTop: "1px solid var(--border)", background: "var(--panel-solid)" }}>
        <div style={{ flex: "1 1 200px", padding: "20px 24px", borderRight: "1px solid var(--border)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: ".08em" }}>
            {t("parker.orbit.perihelion_label")}
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--gold)", marginTop: 8 }}>
            {nextPeri.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginTop: 4 }}>
            {t("parker.orbit.daysLeft", { days: daysLeft })}
          </div>
        </div>

        <div style={{ flex: "1 1 200px", padding: "20px 24px", borderRight: "1px solid var(--border)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: ".08em" }}>
            {t("parker.telemetry.speed_sun")}
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--coral)", marginTop: 8, fontFamily: "var(--font-mono)" }}>
            {fmtSpeed(current.speed_sun)} <span style={{fontSize: "0.95rem", color: "var(--text-dim)"}}>{speedUnit}</span>
          </div>
        </div>

        <div style={{ flex: "1 1 200px", padding: "20px 24px", borderRight: "1px solid var(--border)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: ".08em" }}>
            {t("parker.telemetry.dist_sun")}
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text)", marginTop: 8, fontFamily: "var(--font-mono)" }}>
            {fmtDist(current.dist_sun)} <span style={{fontSize: "0.95rem", color: "var(--text-dim)"}}>{distUnit}</span>
          </div>
        </div>

        <div style={{ flex: "1 1 200px", padding: "20px 24px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: ".08em" }}>
            {t("parker.telemetry.dist_earth")}
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--teal)", marginTop: 8, fontFamily: "var(--font-mono)" }}>
            {fmtDist(current.dist_earth)} <span style={{fontSize: "0.95rem", color: "var(--text-dim)"}}>{distUnit}</span>
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 24px", background: "var(--panel-solid)", fontSize: 12.5, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--border)" }}>
        <span className="dot live" /> 
        {t("parker.orbit.telemetry_note")}
      </div>
    </div>
  );
}
