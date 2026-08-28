// Small always-on 3D preview shown to the right of the hero title on Iss.js —
// a lighter sibling of IssStationFullscreen.js: same model, but no labels, no
// click-to-select, and no OrbitControls (so no user zoom/pan at all — the
// camera just auto-orbits the station at a fixed distance). The fullscreen
// button hands off to the full interactive viewer for anyone who wants to
// explore individual modules.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import "../styles/iss3d.css";

const MODEL_URL = "/iss/iss-station.glb";
const ORBIT_SPEED = 0.15; // rad/s

function Scene({ onLoaded }) {
  // useGLTF caches by URL, so this and IssStationFullscreen's Model() get the
  // *same* scene object back when both are mounted (fullscreen opened from
  // here). A THREE.Object3D can only have one parent — attaching it in the
  // fullscreen viewer silently steals it out of this canvas, and it never
  // comes back when the fullscreen closes. Cloning gives each consumer its
  // own scene-graph nodes (geometries/materials/textures stay shared, so
  // this doesn't cost extra memory or another download).
  const { scene: cached } = useGLTF(MODEL_URL);
  const scene = useMemo(() => cached.clone(), [cached]);
  const { camera } = useThree();
  const boundsRef = useRef(null);
  const angleRef = useRef(0);

  // One-time framing once the model (already resolved past the suspending
  // useGLTF call) is in hand — no click/labels here, so no need to walk the
  // node names at all.
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

export default function IssStationHeroPreview({ onOpenFullscreen }) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="iss3d-hero-wrap">
      <Canvas camera={{ fov: 42 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[6, 8, 4]} intensity={2} />
        {/* fallback stays null — a plain DOM node can't be a Suspense
            fallback inside <Canvas> (different renderer); the spinner below
            is a normal HTML sibling instead, shown until onLoaded() fires. */}
        <Suspense fallback={null}>
          <Scene onLoaded={() => setLoaded(true)} />
        </Suspense>
      </Canvas>
      {!loaded && (
        <div className="iss3d-hero-loading"><span className="iss3d-spinner" /></div>
      )}
      <button type="button" className="iss3d-hero-cta" onClick={onOpenFullscreen} aria-label={t("iss.hero.open3dLabel")}>
        <span className="iss3d-hero-cta-ico">⛶</span>
        <span>{t("iss.hero.open3d")}</span>
      </button>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
