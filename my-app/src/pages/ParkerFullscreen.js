import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Canvas, useThree } from "@react-three/fiber";
import { useGLTF, OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import "../styles/telescope3d.css";

const MODEL_URL = "/parker/models/parker.glb";

function Model({ onLoaded }) {
  const { scene: cached } = useGLTF(MODEL_URL);
  
  const scene = useMemo(() => {
    const s = cached.clone();
    s.rotation.x = Math.PI / 4;
    // Normalize scale
    const box = new THREE.Box3().setFromObject(s);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    if (sphere.radius > 0) {
      const scale = 5 / sphere.radius;
      s.scale.setScalar(scale);
    }
    return s;
  }, [cached]);
  const { camera } = useThree();
  const controlsRef = useRef(null);

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const dist = sphere.radius * 2.4;
    camera.position.set(sphere.center.x + dist * 0.55, sphere.center.y + dist * 0.35, sphere.center.z + dist * 0.7);
    camera.near = Math.max(sphere.radius / 200, 0.01);
    camera.far = Math.max(sphere.radius * 60, 1000);
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

export default function ParkerFullscreen({ onClose }) {
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
    <div className="tele3d-wrap" role="dialog" aria-modal="true" aria-label={t("parker.station3d.title") || "Parker Solar Probe 3D"}>
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

      {!loaded && <div className="tele3d-loading">{t("hubble.station3d.loading") || "Завантаження..."}</div>}

      <div className="tele3d-top-bar">
        <div>
          <div className="tele3d-title">{t("parker.station3d.title") || "Parker Solar Probe"}</div>
          <div className="tele3d-sub">{t("parker.station3d.eyebrow") || "Інтерактивна модель"}</div>
        </div>
        <button className="tele3d-btn" onClick={onClose} aria-label={t("hubble.station3d.close") || "Закрити"}>✕</button>
      </div>

      <div className="tele3d-facts">
        <h3>{t("parker.station3d.factsTitle") || "Швидкі факти"}</h3>
        <div className="row"><span>Запуск</span><span>2018</span></div>
        <div className="row"><span>Швидкість</span><span>~692 000 км/год</span></div>
        <div className="row"><span>Маса</span><span>~685 кг</span></div>
      </div>

      <div className="tele3d-hint">{t("hubble.station3d.hint") || "Обертайте та наближуйте"}</div>

      <button
        type="button"
        className="tele3d-btn"
        style={{ position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)", width: "auto", borderRadius: 10, padding: "0 14px", fontFamily: "var(--font-mono)", fontSize: 13 }}
        onClick={() => setResetTick((n) => n + 1)}
      >
        ↺ {t("hubble.station3d.resetView") || "Скинути"}
      </button>
    </div>,
    document.body
  );
}

useGLTF.preload(MODEL_URL);
