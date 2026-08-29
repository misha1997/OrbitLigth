// Fullscreen free-orbit 3D view of Roman, opened from the hero preview
// (RomanHeroPreview.js) on Roman.js. Same shell as HubbleFullscreen.js /
// JwstFullscreen.js — see RomanHeroPreview.js's docstring for why this is a
// free rotate/zoom/pan explorer with a static facts panel rather than
// per-part click labels.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Canvas, useThree } from "@react-three/fiber";
import { useGLTF, OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import "../styles/telescope3d.css";

const MODEL_URL = "/roman/roman.glb";

function Model({ onLoaded }) {
  const { scene: cached } = useGLTF(MODEL_URL);
  const scene = useMemo(() => cached.clone(), [cached]);
  const { camera } = useThree();
  const controlsRef = useRef(null);

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const dist = sphere.radius * 2.4;
    camera.position.set(sphere.center.x + dist * 0.55, sphere.center.y + dist * 0.35, sphere.center.z + dist * 0.7);
    camera.near = Math.max(sphere.radius / 200, 0.01);
    camera.far = sphere.radius * 60;
    camera.updateProjectionMatrix();
    if (controlsRef.current) {
      controlsRef.current.target.copy(sphere.center);
      controlsRef.current.update();
    }
    onLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  return (
    <>
      <primitive object={scene} />
      <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.08} minDistance={0.001} maxDistance={100000} />
    </>
  );
}

export default function RomanFullscreen({ onClose }) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  const [resetTick, setResetTick] = useState(0);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  return createPortal(
    <div className="tele3d-wrap" role="dialog" aria-modal="true" aria-label={t("roman.station3d.title")}>
      <div className="tele3d-canvas-wrap">
        <Canvas key={resetTick} camera={{ fov: 45, position: [10, 6, 12] }}>
          <color attach="background" args={["#05060d"]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[8, 12, 6]} intensity={2.2} />
          <directionalLight position={[-10, -4, -8]} intensity={0.4} />
          <Stars radius={200} depth={80} count={4000} factor={4} saturation={0} fade speed={0.4} />
          <Suspense fallback={null}>
            <Model onLoaded={() => setLoaded(true)} />
          </Suspense>
        </Canvas>
      </div>

      {!loaded && <div className="tele3d-loading">{t("roman.station3d.loading")}</div>}

      <div className="tele3d-top-bar">
        <div>
          <div className="tele3d-title">{t("roman.station3d.title")}</div>
          <div className="tele3d-sub">{t("roman.station3d.eyebrow")}</div>
        </div>
        <button className="tele3d-btn" onClick={onClose} aria-label={t("roman.station3d.close")}>✕</button>
      </div>

      <div className="tele3d-facts">
        <h3>{t("roman.station3d.factsTitle")}</h3>
        <div className="row"><span>{t("roman.station3d.launchLabel")}</span><span>{t("roman.station3d.launchValue")}</span></div>
        <div className="row"><span>{t("roman.station3d.mirrorLabel")}</span><span>{t("roman.station3d.mirrorValue")}</span></div>
        <div className="row"><span>{t("roman.station3d.orbitLabel")}</span><span>{t("roman.station3d.orbitValue")}</span></div>
        <div className="row"><span>{t("roman.station3d.instrumentsLabel")}</span><span>{t("roman.station3d.instrumentsValue")}</span></div>
      </div>

      <div className="tele3d-hint">{t("roman.station3d.hint")}</div>

      <button
        type="button"
        className="tele3d-btn"
        style={{ position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)", width: "auto", borderRadius: 10, padding: "0 14px", fontFamily: "var(--font-mono)", fontSize: 13 }}
        onClick={() => setResetTick((n) => n + 1)}
      >
        ↺ {t("roman.station3d.resetView")}
      </button>
    </div>,
    document.body
  );
}

useGLTF.preload(MODEL_URL);
