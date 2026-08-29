// Small always-on 3D preview shown in the JWST page hero — same pattern as
// HubbleHeroPreview.js / IssStationHeroPreview.js. JWST's model is a single
// merged mesh (36 material-tagged primitives, no node hierarchy at all), so
// there's even less structure to hang click labels on than Hubble's —
// JwstFullscreen.js is a free-orbit explorer with a static facts panel too.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import "../styles/telescope3d.css";

const MODEL_URL = "/jwst/jwst.glb";
const ORBIT_SPEED = 0.15; // rad/s

function Scene({ onLoaded }) {
  const { scene: cached } = useGLTF(MODEL_URL);
  const scene = useMemo(() => cached.clone(), [cached]);
  const { camera } = useThree();
  const boundsRef = useRef(null);
  const angleRef = useRef(0);

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    boundsRef.current = { center: sphere.center.clone(), dist: sphere.radius * 2.6 };
    camera.near = Math.max(sphere.radius / 200, 0.01);
    camera.far = sphere.radius * 60;
    camera.updateProjectionMatrix();
    onLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useFrame((_, delta) => {
    const b = boundsRef.current;
    if (!b) return;
    angleRef.current += delta * ORBIT_SPEED;
    camera.position.set(
      b.center.x + Math.cos(angleRef.current) * b.dist,
      b.center.y + b.dist * 0.22,
      b.center.z + Math.sin(angleRef.current) * b.dist
    );
    camera.lookAt(b.center.x, b.center.y, b.center.z);
  });

  return <primitive object={scene} />;
}

export default function JwstHeroPreview({ onOpenFullscreen }) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="tele3d-hero-wrap">
      <Canvas camera={{ fov: 42 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[6, 8, 4]} intensity={2} />
        <Suspense fallback={null}>
          <Scene onLoaded={() => setLoaded(true)} />
        </Suspense>
      </Canvas>
      {!loaded && (
        <div className="tele3d-hero-loading"><span className="tele3d-spinner" /></div>
      )}
      <button type="button" className="tele3d-hero-cta" onClick={onOpenFullscreen} aria-label={t("jwst.hero.open3dLabel")}>
        <span className="tele3d-hero-cta-ico">⛶</span>
        <span>{t("jwst.hero.open3d")}</span>
      </button>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
