import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Line, OrbitControls, Stars, useTexture } from "@react-three/drei";
import * as THREE from "three";

function FittedControls({ positions, velocity }) {
  const controls = useRef(null);
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const bounds = new THREE.Box3().setFromPoints([new THREE.Vector3(), ...positions.map(position => new THREE.Vector3(...position))]);
    bounds.expandByScalar(0.8);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const radial = new THREE.Vector3(...positions[0]).normalize();
    const normal = radial.clone().cross(new THREE.Vector3(velocity[0], velocity[2], -velocity[1])).normalize();
    const direction = normal.addScaledVector(radial, 0.35).normalize();
    const vertical = THREE.MathUtils.degToRad(camera.fov);
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * size.width / size.height);
    const distance = sphere.radius * 1.08 / Math.sin(Math.min(vertical, horizontal) / 2);
    camera.position.copy(sphere.center).addScaledVector(direction, distance);
    camera.lookAt(sphere.center);
    camera.updateProjectionMatrix();
    controls.current.target.copy(sphere.center);
    controls.current.update();
  }, [camera, positions, velocity, size.width, size.height]);
  return <OrbitControls ref={controls} makeDefault enablePan enableDamping minDistance={2} maxDistance={100} />;
}

function Planet({ mission }) {
  const sun = mission === "newhorizons" || mission === "europaclipper";
  const texture = useTexture(`/textures/${mission === "juno" ? "jupiter" : sun ? "sun" : "earth"}.jpg`);
  return <mesh><sphereGeometry args={[0.7, 48, 48]} />{sun ? <meshBasicMaterial map={texture} /> : <meshStandardMaterial map={texture} roughness={0.9} />}</mesh>;
}

export default function MissionOrbitScene({ mission, points, selected, accent, resetKey }) {
  const positions = useMemo(() => {
    const scale = 13 / Math.max(...points.map(point => Math.hypot(...point.position)), 1);
    // Horizons' ecliptic Z is north. Three.js uses Y as the vertical axis.
    return points.map(point => [point.position[0] * scale, point.position[2] * scale, -point.position[1] * scale]);
  }, [points]);
  return (
    <Canvas key={resetKey} camera={{ position: [18, 16, 24], fov: 45 }} dpr={[1, 1.5]} frameloop="demand">
      <color attach="background" args={["#06070a"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[15, 10, 12]} intensity={2.4} />
      <Stars radius={65} depth={40} count={1500} factor={2.5} saturation={0} fade speed={0} />
      <FittedControls positions={positions} velocity={points[0].velocity} />
      <Suspense fallback={null}><Planet mission={mission} /></Suspense>
      <Line points={positions} color={accent} lineWidth={1.5} transparent opacity={0.65} />
      <mesh position={positions[selected]}><sphereGeometry args={[0.2, 16, 16]} /><meshBasicMaterial color={accent} /></mesh>
      <Line points={[[0, 0, 0], positions[selected]]} color="#ffffff" transparent opacity={0.25} dashed dashSize={0.25} gapSize={0.2} />
    </Canvas>
  );
}
