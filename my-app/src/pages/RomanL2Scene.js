import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls, Stars, useTexture } from "@react-three/drei";
import { AdditiveBlending } from "three";
import { romanHaloPosition } from "../lib/romanOrbitModel";

const CAMERA = { position: [25, 35, 70], fov: 45, near: 0.1, far: 500 };
const GL_OPTIONS = { powerPreference: "low-power" };

function Earth() {
  const texture = useTexture("/textures/earth.jpg");
  return <group position={[-10, 0, 0]}>
    <mesh><sphereGeometry args={[3, 32, 32]} /><meshStandardMaterial map={texture} roughness={0.7} /></mesh>
    <mesh><sphereGeometry args={[3.15, 24, 24]} /><meshBasicMaterial color="#4dabf7" transparent opacity={0.1} blending={AdditiveBlending} depthWrite={false} /></mesh>
  </group>;
}

function Marker({ running }) {
  const marker = useRef();
  const phase = useRef(0);
  useFrame((_, delta) => {
    if (!running || !marker.current) return;
    const step = Math.min(delta, 0.05);
    phase.current -= step * 0.3;
    marker.current.position.set(...romanHaloPosition(phase.current));
    marker.current.rotation.y += step * 0.5;
  });
  return <group ref={marker} position={romanHaloPosition(0)}>
    <mesh><octahedronGeometry args={[0.6, 0]} /><meshBasicMaterial color="#ff922b" /></mesh>
    <mesh><sphereGeometry args={[1, 12, 12]} /><meshBasicMaterial color="#ff922b" transparent opacity={0.15} blending={AdditiveBlending} depthWrite={false} /></mesh>
  </group>;
}

function CameraControls({ resetKey }) {
  const controls = useRef();
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    const vertical = camera.fov * Math.PI / 180;
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * size.width / size.height);
    const distance = 29 / Math.sin(Math.min(vertical, horizontal) / 2);
    const length = Math.hypot(0.35, 0.55, 1);
    camera.position.set(4 + distance * 0.35 / length, distance * 0.55 / length, distance / length);
    camera.lookAt(4, 0, 0);
    if (controls.current) {
      controls.current.target.set(4, 0, 0);
      controls.current.update();
    }
    invalidate();
  }, [camera, size.width, size.height, resetKey, invalidate]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={0.08} minDistance={20} maxDistance={180} />;
}

export default function RomanL2Scene({ running, resetKey, unavailable }) {
  const points = useMemo(() => Array.from({ length: 129 }, (_, index) => romanHaloPosition(index / 128 * Math.PI * 2)), []);
  return <Canvas camera={CAMERA}
    dpr={[1, 1.5]} frameloop={running ? "always" : "demand"} gl={GL_OPTIONS}
    fallback={<p className="roman-orbit-feedback">{unavailable}</p>}>
    <color attach="background" args={["#06070a"]} />
    <ambientLight intensity={0.3} /><directionalLight position={[-50, 10, 0]} intensity={3} color="#fffcf2" />
    <Stars radius={150} depth={50} count={900} factor={2} saturation={0} fade speed={0} />
    <Suspense fallback={null}><Earth /></Suspense>
    <Line points={points} color="#c1b4e8" lineWidth={1.5} />
    <Line points={[[-18, 0, 0], [25, 0, 0]]} color="#71849b" lineWidth={1} dashed dashSize={0.5} gapSize={0.5} />
    <Line points={[[-17, 0, 0], [-25, 0, 0]]} color="#efbd5a" lineWidth={2} />
    <mesh position={[-25, 0, 0]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[0.65, 1.7, 12]} /><meshBasicMaterial color="#efbd5a" /></mesh>
    <mesh position={[15, 0, 0]}><sphereGeometry args={[0.35, 16, 16]} /><meshBasicMaterial color="#a6967d" /></mesh>
    <Marker running={running} /><CameraControls resetKey={resetKey} />
  </Canvas>;
}
