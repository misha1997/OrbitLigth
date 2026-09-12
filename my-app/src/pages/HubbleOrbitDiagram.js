import React, { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Line, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useTranslation } from "react-i18next";

function Earth() {
  const colorMap = useTexture("/textures/earth.jpg");
  return (
    <group position={[0, 0, 0]}>
      <mesh>
        <sphereGeometry args={[5, 64, 64]} />
        <meshStandardMaterial map={colorMap} roughness={0.6} metalness={0.1} />
      </mesh>
      <mesh>
        <sphereGeometry args={[5.2, 64, 64]} />
        <meshStandardMaterial color="#4dabf7" transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function HubbleMarker() {
  const ref = useRef();
  
  // Hubble orbit: altitude ~540km. 
  // Earth radius ~6371km. 
  // Ratio: 540 / 6371 = 0.084.
  // Radius in scene: 5 + (5 * 0.084) = 5.42
  const r = 5.6;

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * 0.8; // speed
    const x = Math.cos(t) * r;
    const z = Math.sin(t) * r;
    // Hubble orbit inclination is 28.5 degrees
    const inc = 28.5 * (Math.PI / 180);
    const y = z * Math.sin(inc);
    const trueZ = z * Math.cos(inc);

    ref.current.position.set(x, y, trueZ);
    ref.current.rotation.x += 0.01;
    ref.current.rotation.y += 0.02;
  });

  return (
    <group ref={ref}>
      <mesh>
        <cylinderGeometry args={[0.2, 0.2, 0.6, 12]} rotation={[Math.PI/2, 0, 0]} />
        <meshBasicMaterial color="#d0ebff" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial color="#d0ebff" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function HubbleOrbitPath() {
  const pts = [];
  const r = 5.6;
  const inc = 28.5 * (Math.PI / 180);
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    const x = Math.cos(t) * r;
    const z = Math.sin(t) * r;
    const y = z * Math.sin(inc);
    const trueZ = z * Math.cos(inc);
    pts.push(new THREE.Vector3(x, y, trueZ));
  }
  return <Line points={pts} color="#4dabf7" lineWidth={1.5} transparent opacity={0.4} />;
}

export default function HubbleOrbitDiagram() {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState("local");

  return (
    <div style={{ position: "relative", width: "100%", height: viewMode === "nasa" ? "650px" : "450px", background: "#06070a", borderRadius: "16px", overflow: "hidden", border: "1px solid var(--border)", margin: "40px 0", transition: "height 0.3s ease" }}>
      
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
          {t("hubble.orbit.view_local", "3D Модель")}
        </button>
        <button 
          onClick={() => setViewMode("nasa")}
          style={{ 
            background: viewMode === "nasa" ? "var(--gold)" : "transparent",
            color: viewMode === "nasa" ? "#000" : "var(--text)",
            border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", 
            fontSize: "0.85rem", fontWeight: 600, transition: "0.2s"
          }}>
          {t("hubble.orbit.view_nasa", "NASA Eyes")}
        </button>
      </div>

      {viewMode === "local" && (
        <div style={{ position: "absolute", top: 20, left: 20, zIndex: 10, color: "#fff", fontSize: "13px", fontFamily: "var(--font-mono)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4dabf7" }} />
            <span>{t("hubble.orbit.diagram_earth", "Earth")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#d0ebff" }} />
            <span>Hubble Space Telescope</span>
          </div>
        </div>
      )}

      {viewMode === "local" && (
        <div style={{ position: "absolute", bottom: 16, right: 20, zIndex: 10, color: "rgba(255,255,255,0.4)", fontSize: "11px", fontFamily: "var(--font-mono)", userSelect: "none" }}>
          Click & drag to rotate &middot; Scroll to zoom
        </div>
      )}

      <div style={{ width: "100%", height: "100%" }}>
        {viewMode === "local" ? (
          <Canvas camera={{ position: [10, 5, 12], fov: 45 }}>
            <color attach="background" args={["#06070a"]} />
            <ambientLight intensity={0.1} />
            <directionalLight position={[50, 0, 50]} intensity={2.5} color="#fffcf2" />
            <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
            <OrbitControls enablePan={false} maxDistance={40} minDistance={7} target={[0, 0, 0]} />
            <Earth />
            <HubbleOrbitPath />
            <HubbleMarker />
          </Canvas>
        ) : (
          <iframe 
            src="https://eyes.nasa.gov/apps/solar-system/#/sc_hubble_space_telescope?search=false&shareButton=false&menu=false&collapseSettingsOptions=true" 
            title="NASA Eyes Hubble"
            style={{ width: "100%", height: "100%", border: "none" }}
            allowFullScreen
          />
        )}
      </div>
    </div>
  );
}
