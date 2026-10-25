import { Component, Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { orbitPath } from "../lib/orbitalCatalog";

class GlobeBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
function Earth({ grid, occluderRef }) {
  const texture = useTexture("/textures/earth.jpg");
  texture.colorSpace = THREE.SRGBColorSpace;
  return <>
    <mesh ref={occluderRef}><sphereGeometry args={[1, 64, 48]} /><meshStandardMaterial map={texture} roughness={.95} /></mesh>
    <mesh><sphereGeometry args={[1.018, 48, 32]} /><meshBasicMaterial color="#46b9dd" transparent opacity={.065} side={THREE.BackSide} /></mesh>
    {grid && <mesh><sphereGeometry args={[1.002, 36, 18]} /><meshBasicMaterial wireframe color="#8ddfff" transparent opacity={.075} /></mesh>}
  </>;
}
function Stars() {
  const positions = useMemo(() => {
    const points = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      const y = 1 - 2 * (i + .5) / 1500, a = i * 2.399963, r = Math.sqrt(1 - y * y);
      points.set([100 * r * Math.cos(a), 100 * y, 100 * r * Math.sin(a)], i * 3);
    }
    return points;
  }, []);
  return <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <pointsMaterial size={1.2} sizeAttenuation={false} color="#8eabc4" transparent opacity={.65} depthWrite={false} /></points>;
}
function SelectedObjectMarker({ object, position, earthRef }) {
  return <Html position={position} center occlude={earthRef.current ? [earthRef] : undefined}
    zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
    <div className="sat-selected-object" style={{ "--marker-color": object.color }} aria-hidden="true">
      <span className="sat-selected-object-symbol">
        <svg viewBox="0 0 40 32" width="28" height="24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          {object.category === "debris" ? <path d="m14 7 10 3 4 12-13 6-8-9Z" /> :
            object.category === "rocket" ? <><path d="M16 22V12l4-7 4 7v10Zm0-4-4 6h4m8-6 4 6h-4M18 26h4" /></> : <>
              <path d="M12 16h16M20 10V5m-3 0h6" />
              <rect x="16" y={object.category === "station" ? 7 : 11} width="8" height={object.category === "station" ? 21 : 11} rx="1.5" fill="#d8e6ef" stroke="#d8e6ef" />
              <rect x="3" y="10" width="9" height="14" rx="1" fill="#164971" />
              <rect x="28" y="10" width="9" height="14" rx="1" fill="#164971" />
              <path d="M7.5 10v14m25-14v14M3 17h9m16 0h9" stroke="#6ba8d3" />
            </>}
        </svg>
      </span>
      <span className="sat-selected-object-label"><strong>{object.name}</strong><small>NORAD {object.norad_id}</small></span>
    </div>
  </Html>;
}
function CatalogPoints({ objects, frame, selectedId, onSelect, earthRef }) {
  const colors = useMemo(() => {
    const data = new Float32Array(objects.length * 3), c = new THREE.Color();
    objects.forEach((o, i) => { c.set(o.color); data.set([c.r, c.g, c.b], i * 3); });
    return data;
  }, [objects]);
  if (!frame || frame.positions.length !== objects.length * 3) return null;
  const index = objects.findIndex(o => o.norad_id === selectedId);
  const selectedPosition = index >= 0 ? Array.from(frame.positions.slice(index * 3, index * 3 + 3)) : null;
  return <>
    <points frustumCulled={false} onClick={event => {
      if (event.index == null) return;
      event.stopPropagation(); onSelect?.(objects[event.index].norad_id);
    }}>
      <bufferGeometry key={`${objects.length}-${frame.version}`}>
        <bufferAttribute attach="attributes-position" args={[frame.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={4} sizeAttenuation={false} vertexColors transparent opacity={.9} />
    </points>
    {selectedPosition && selectedPosition.every(Number.isFinite) &&
      <SelectedObjectMarker object={objects[index]} position={selectedPosition} earthRef={earthRef} />}
  </>;
}
function Path({ object }) {
  const points = useMemo(() => object ? orbitPath(object) : [], [object]);
  const vertices = useMemo(() => new Float32Array(points.flat()), [points]);
  if (points.length < 2) return null;
  return <line><bufferGeometry><bufferAttribute attach="attributes-position" args={[vertices, 3]} /></bufferGeometry>
    <lineBasicMaterial color={object.color} transparent opacity={.75} /></line>;
}
function SchematicRings() {
  return [0, 1, 2].map((n) => <mesh key={n} rotation={[Math.PI / 2 + n * .48, n * .7, .2]}>
    <torusGeometry args={[1.22 + n * .16, .002, 4, 160]} />
    <meshBasicMaterial color={n === 1 ? "#c8a566" : "#43b6aa"} transparent opacity={.3} />
  </mesh>);
}
function CameraActions({ controls, action, frame, objects, selectedId }) {
  const { camera } = useThree();
  const latest = useRef({ frame, objects, selectedId });
  latest.current = { frame, objects, selectedId };
  useEffect(() => {
    if (!action || !controls.current) return;
    const control = controls.current;
    control.target.set(0, 0, 0);
    if (action.type === "reset") camera.position.set(3.6, 1.9, 3.6);
    if (action.type === "in") camera.position.multiplyScalar(.75).clampLength(1.08, 65);
    if (action.type === "out") camera.position.multiplyScalar(1.33).clampLength(1.08, 65);
    if (action.type === "focus") {
      const { frame: f, objects: list, selectedId: id } = latest.current;
      const i = list.findIndex(o => o.norad_id === id);
      if (f && i >= 0) {
        const p = new THREE.Vector3().fromArray(f.positions, i * 3);
        if (p.length() > 1) camera.position.copy(p).multiplyScalar(1.35);
      }
    }
    control.update();
  }, [action, camera, controls]);
  return null;
}
export default function SatelliteGlobe({ objects, frame, selectedId, onSelect, miniature = false, grid = true, showOrbit = true, action, unavailable }) {
  const controls = useRef(null);
  const earth = useRef(null);
  const selected = useMemo(() => objects.find(o => o.norad_id === selectedId), [objects, selectedId]);
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const fallback = miniature ? <div className="sat-schematic-fallback" aria-hidden="true"><div className="sat-schematic-earth" style={{ backgroundImage: "radial-gradient(circle at 28% 28%, transparent 25%, #071220aa 70%, #020810 100%), url('/textures/earth.jpg')" }} />
    <i /><i /><i /></div> : <div className="sat-globe-fallback" role="status">{unavailable}</div>;
  return <GlobeBoundary fallback={fallback}>
    <Canvas camera={{ position: miniature ? [2.6, 1.5, 2.6] : [3.6, 1.9, 3.6], fov: miniature ? 43 : 48, near: .005, far: 400 }}
      dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }} fallback={fallback}
      raycaster={{ params: { Points: { threshold: .025 } } }} onPointerMissed={() => onSelect?.(null)}>
      <ambientLight intensity={.65} /><directionalLight position={[4, 2, 5]} intensity={2.4} /><Stars />
      <Suspense fallback={<mesh><sphereGeometry args={[1, 32, 24]} /><meshStandardMaterial color="#16465f" wireframe /></mesh>}>
        <group onClick={e => e.stopPropagation()}><Earth grid={grid} occluderRef={earth} /></group>
      </Suspense>
      {miniature && <SchematicRings />}
      <CatalogPoints objects={objects} frame={frame} selectedId={selectedId} onSelect={onSelect} earthRef={earth} />
      {!miniature && showOrbit && selected && <Path object={selected} />}
      <OrbitControls ref={controls} enablePan={false} enableZoom={!miniature} enableRotate={!miniature}
        minDistance={1.08} maxDistance={65} autoRotate={miniature && !reducedMotion} autoRotateSpeed={.25} />
      {!miniature && <CameraActions controls={controls} action={action} frame={frame} objects={objects} selectedId={selectedId} />}
    </Canvas>
  </GlobeBoundary>;
}
