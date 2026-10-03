import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import "../../styles/telescope3d.css";
import "../../styles/mission-model.css";

class ModelBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Model({ url, direction, interactive, resetKey, onLoaded, reducedMotion }) {
  const { scene: cached } = useGLTF(url);
  // Clone the hierarchy but keep the cached geometry/textures shared. The
  // preview and fullscreen scene must never reparent or dispose one another.
  const scene = useMemo(() => {
    const clone = cached.clone(true);
    const bounds = new THREE.Box3().setFromObject(clone);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const centered = new THREE.Group();
    centered.position.copy(sphere.center).negate();
    centered.add(clone);
    const normalized = new THREE.Group();
    normalized.scale.setScalar(1 / Math.max(sphere.radius, 0.0001));
    normalized.add(centered);
    return normalized;
  }, [cached]);
  const { camera, size } = useThree();
  const controls = useRef(null);
  const orbit = useRef(null);

  useLayoutEffect(() => {
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * size.width / size.height);
    const distance = 1.12 / Math.sin(Math.min(verticalFov, horizontalFov) / 2);
    const view = new THREE.Vector3(...direction).normalize();
    camera.position.copy(view).multiplyScalar(distance);
    camera.near = 0.01;
    camera.far = 100;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    orbit.current = { angle: Math.atan2(view.z, view.x), height: view.y * distance, radius: Math.hypot(view.x, view.z) * distance };
    if (controls.current) {
      controls.current.target.set(0, 0, 0);
      controls.current.update();
    }
    onLoaded();
  }, [camera, direction, size.width, size.height, resetKey, onLoaded]);

  useFrame((_, delta) => {
    if (interactive || reducedMotion || !orbit.current) return;
    const view = orbit.current;
    view.angle += Math.min(delta, 0.1) * 0.15;
    camera.position.set(Math.cos(view.angle) * view.radius, view.height, Math.sin(view.angle) * view.radius);
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <primitive object={scene} dispose={null} />
      {interactive && <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={1.25} maxDistance={20} />}
    </>
  );
}

function ModelCanvas({ model, interactive = false, resetKey = 0, onLoaded, ui, reducedMotion }) {
  return (
    <Canvas camera={{ fov: 42, position: [3, 2, 3], near: 0.01, far: 100 }} dpr={[1, 1.5]}
      frameloop={reducedMotion && !interactive ? "demand" : "always"}
      fallback={<span>{ui.unavailable}</span>}>
      {interactive && <color attach="background" args={["#05060d"]} />}
      <ambientLight intensity={0.85} />
      <directionalLight position={[6, 8, 4]} intensity={2.2} />
      <directionalLight position={[-6, -3, -5]} intensity={0.65} />
      {interactive && <Stars radius={35} depth={30} count={1800} factor={2} saturation={0} fade speed={reducedMotion ? 0 : 0.3} />}
      <Suspense fallback={null}>
        <Model url={model.url} direction={model.direction} interactive={interactive} resetKey={resetKey}
          onLoaded={onLoaded} reducedMotion={reducedMotion} />
      </Suspense>
    </Canvas>
  );
}

function ModelCredit({ credit }) {
  return credit ? <small className="mission-model-credit"><a href={credit.source} target="_blank" rel="noopener noreferrer">{credit.author}</a> · <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer">{credit.license}</a></small> : null;
}

function Fullscreen({ model, name, stats, ui, onClose, reducedMotion }) {
  const modal = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const onLoaded = useCallback(() => setLoaded(true), []);
  useEffect(() => {
    const element = modal.current;
    const focused = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (focused?.isConnected) focused.focus();
    };
  }, []);
  return createPortal(
    <dialog ref={modal} className="tele3d-wrap mission-model-fullscreen" aria-label={`${name} · 3D`}
      onCancel={onClose} onClose={onClose}>
      <ModelBoundary fallback={<div className="mission-model-error" role="alert">{ui.unavailable}</div>}>
        <div className="tele3d-canvas-wrap">
          <ModelCanvas model={model} interactive resetKey={resetKey} onLoaded={onLoaded} ui={ui} reducedMotion={reducedMotion} />
        </div>
        {!loaded && <div className="tele3d-loading" role="status">{ui.loading}</div>}
      </ModelBoundary>
      <div className="tele3d-top-bar">
        <div><div className="tele3d-title">{name} · 3D</div><div className="tele3d-sub">{ui.subtitle}</div><ModelCredit credit={model.credit} /></div>
        <button type="button" className="tele3d-btn" onClick={onClose} aria-label={ui.close}>✕</button>
      </div>
      <div className="tele3d-facts">
        <h3>{ui.facts}</h3>
        {stats.map((stat) => <div className="row" key={stat.label}><span>{stat.label}</span><span>{stat.value}</span></div>)}
      </div>
      <div className="tele3d-hint">{ui.hint}</div>
      <button type="button" className="tele3d-btn mission-model-reset" onClick={() => setResetKey(key => key + 1)}>↺ {ui.reset}</button>
    </dialog>, document.body
  );
}

export default function MissionModelViewer({ model, name, stats, ui, fallbackImage, fallbackAlt }) {
  const [loaded, setLoaded] = useState(false);
  const onLoaded = useCallback(() => setLoaded(true), []);
  const [fullscreen, setFullscreen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const change = () => setReducedMotion(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return (
    <div className="mission-model">
      <ModelBoundary fallback={<figure className="mission-hero-image"><img src={fallbackImage} alt={fallbackAlt} /><figcaption role="status">{ui.unavailable}</figcaption></figure>}>
        <div className="tele3d-hero-wrap" aria-label={`${name} · 3D`}>
          <ModelCanvas model={model} onLoaded={onLoaded} ui={ui} reducedMotion={reducedMotion} />
          {!loaded && <div className="tele3d-hero-loading" role="status" aria-label={ui.loading}><span className="tele3d-spinner" /></div>}
          <button type="button" className="tele3d-hero-cta" onClick={() => setFullscreen(true)} aria-label={`${ui.open}: ${name}`}>
            <span className="tele3d-hero-cta-ico" aria-hidden="true">⛶</span><span>{ui.open}</span>
          </button>
        </div>
      </ModelBoundary>
      <ModelCredit credit={model.credit} />
      {fullscreen && <Fullscreen model={model} name={name} stats={stats} ui={ui} onClose={() => setFullscreen(false)} reducedMotion={reducedMotion} />}
    </div>
  );
}
