import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Line, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useTranslation } from "react-i18next";

function Earth() {
  const colorMap = useTexture("/textures/earth.jpg");
  
  return (
    <group position={[-10, 0, 0]}>
      <mesh>
        <sphereGeometry args={[3, 32, 32]} />
        <meshStandardMaterial map={colorMap} roughness={0.6} metalness={0.1} />
      </mesh>
      <mesh>
        <sphereGeometry args={[3.2, 32, 32]} />
        <meshStandardMaterial color="#4dabf7" transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function HaloOrbit() {
  const points = useMemo(() => {
    const pts = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      // Realistic proportions:
      // Earth to L2 = 1.5 million km -> 25 units (1 unit = 60,000 km)
      // Halo orbit Y-amplitude ≈ 800,000 km -> ~13.3 units
      // Halo orbit Z-amplitude ≈ 400,000 km -> ~6.6 units
      // Halo orbit X-amplitude ≈ 250,000 km -> ~4.1 units
      
      // Viewed from Earth (X-axis), Y and Z form an ellipse.
      const y = Math.sin(theta) * 13.3;
      const z = Math.cos(theta) * 6.6;
      
      // X adds a 2nd harmonic (cos(2*theta)) to create the classic 
      // non-planar "kidney/Pringles" shape characteristic of real Halo orbits
      const x = 15 - Math.cos(theta) * 4.1 + Math.cos(theta * 2) * 1.8;
      
      pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  }, []);

  return (
    <Line
      points={points}
      color="#ffffff"
      lineWidth={1}
      transparent
      opacity={0.3}
    />
  );
}

function JwstMarker() {
  const ref = useRef();
  
  useFrame((state) => {
    const t = state.clock.getElapsedTime() * 0.3; // speed
    const theta = -t; // animate along orbit
    
    const y = Math.sin(theta) * 13.3;
    const z = Math.cos(theta) * 6.6;
    const x = 15 - Math.cos(theta) * 4.1 + Math.cos(theta * 2) * 1.8;
    
    ref.current.position.set(x, y, z);
    
    // Slight rotation of the marker itself
    ref.current.rotation.x += 0.01;
    ref.current.rotation.y += 0.02;
  });

  return (
    <group ref={ref}>
      <mesh>
        <octahedronGeometry args={[0.5, 0]} />
        <meshBasicMaterial color="#e0aaff" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.8, 8, 8]} />
        <meshBasicMaterial color="#e0aaff" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default function JwstL2Orbit() {
  const { t } = useTranslation();

  return (
    <div style={{ position: "relative", width: "100%", height: "450px", background: "#06070a", borderRadius: "16px", overflow: "hidden", border: "1px solid var(--border)", margin: "40px 0" }}>
      
      {/* Legend Overlay */}
      <div style={{ position: "absolute", top: 20, left: 20, zIndex: 10, color: "#fff", fontSize: "13px", fontFamily: "var(--font-mono)", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4dabf7" }} />
          <span>{t("jwst.l2.diagram_earth", "Earth")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#e0aaff" }} />
          <span>JWST</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#8b7355" }} />
          <span>L2 point</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffd700" }} />
          <span>{t("jwst.l2.diagram_sun", "Sun")} direction &larr;</span>
        </div>
      </div>
      
      {/* Controls Hint */}
      <div style={{ position: "absolute", bottom: 16, right: 20, zIndex: 10, color: "rgba(255,255,255,0.4)", fontSize: "11px", fontFamily: "var(--font-mono)", userSelect: "none" }}>
        Click & drag to rotate &middot; Scroll to zoom
      </div>

      <Canvas camera={{ position: [0, 20, 40], fov: 45 }}>
        <color attach="background" args={["#06070a"]} />
        <ambientLight intensity={0.05} />
        {/* Sun comes from left (negative X) */}
        <directionalLight position={[-50, 0, 0]} intensity={3} color="#fffcf2" />
        
        <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
        
        <OrbitControls 
          enablePan={false} 
          maxDistance={80} 
          minDistance={15}
          target={[5, 0, 0]} 
        />

        <Earth />
        
        {/* L2 Point */}
        <mesh position={[15, 0, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshBasicMaterial color="#8b7355" />
        </mesh>

        {/* Sun to L2 dashed line */}
        <Line
          points={[[-20, 0, 0], [25, 0, 0]]}
          color="#ffffff"
          lineWidth={1}
          dashed={true}
          dashSize={1}
          dashScale={0.5}
          dashOffset={0}
          transparent
          opacity={0.15}
        />

        <HaloOrbit />
        <JwstMarker />
      </Canvas>
    </div>
  );
}
