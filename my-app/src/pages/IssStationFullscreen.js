// Fullscreen interactive 3D view of the ISS, opened from the "Як влаштована
// МКС" section on Iss.js (mirrors how JupiterMoonSystemFullscreen.js opens
// from Jupiter.js — same createPortal/Escape/body-scroll-lock shell, own
// iss3d-* CSS namespace since this isn't a moon system).
//
// Model: my-app/public/iss/iss-station.glb — NASA's official public-domain
// ISS model (science.nasa.gov, credited to NASA VTAD), Draco+WebP compressed
// from the original 42 MB down to ~2.4 MB via @gltf-transform. Its 132 scene
// nodes are already named with NASA's own module numbering ("01 Zarya...",
// "09 Destiny Space Laboratory", ...) — the exact scheme on the "ISS
// Configuration" diagram already shown in the page's gallery — so *which*
// module a mesh belongs to and *where* to anchor its label both come
// straight from the model. Only the display text is hand-translated
// (MODULE_NAMES below) — the model itself only carries English names.
//
// Some modules (Canadarm2, DEXTRE, the truss segments) are built from many
// small nodes that share one leading number (e.g. eight "11 Canadarm2_0N"
// arm segments) — buildModules() groups nodes by that number and averages
// their world positions into one label per real-world module instead of one
// per mesh.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { Canvas, useThree } from "@react-three/fiber";
import { useGLTF, OrbitControls, Stars, Html } from "@react-three/drei";
import * as THREE from "three";
import "../styles/iss3d.css";

const MODEL_URL = "/iss/iss-station.glb";

// NASA's model names its 132 scene nodes in English only ("13 Pirs Docking
// Compartment (DC) and Airlock") — translated + tidied here (NASA's own data
// has a couple of typos, e.g. "Funtional" for Zarya, fixed in the EN column
// too) so the label follows the site's language, not the model file.
const MODULE_NAMES = {
  "01": { uk: "Заря (ФГБ) — функціонально-вантажний блок", en: "Zarya (FGB) — Functional Cargo Block" },
  "02": { uk: "Юніті (Вузол 1)", en: "Unity (Node 1)" },
  "03": { uk: "Стикувальний перехідник (PMA) 1", en: "Pressurized Mating Adapter (PMA) 1" },
  "04": { uk: "Стикувальний перехідник (PMA) 2", en: "Pressurized Mating Adapter (PMA) 2" },
  "05": { uk: "Звєзда (СМ) — службовий модуль", en: "Zvezda (SM) — Service Module" },
  "06": { uk: "Ферма Z1", en: "Z1 Truss" },
  "07": { uk: "Стикувальний перехідник (PMA) 3", en: "Pressurized Mating Adapter (PMA) 3" },
  "08": { uk: "Ферма P6", en: "P6 Truss" },
  "09": { uk: "Лабораторія «Дестіні»", en: "Destiny Laboratory" },
  "10": { uk: "Зовнішня платформа зберігання (ESP) 1", en: "External Stowage Platform (ESP) 1" },
  "11": { uk: "Канадарм2", en: "Canadarm2" },
  "12": { uk: "Шлюзова камера «Квест»", en: "Quest Airlock" },
  "13": { uk: "«Пірс» — стикувальний відсік і шлюз", en: "Pirs — Docking Compartment and Airlock" },
  "14": { uk: "Ферма S0", en: "S0 Truss" },
  "15": { uk: "Мобільна базова система (MBS)", en: "Mobile Base System (MBS)" },
  "16": { uk: "Ферма S1", en: "S1 Truss" },
  "17": { uk: "Ферма P1", en: "P1 Truss" },
  "18": { uk: "Зовнішня платформа зберігання (ESP) 2", en: "External Stowage Platform (ESP) 2" },
  "19": { uk: "Ферма P3", en: "P3 Truss" },
  "20": { uk: "Ферма P4", en: "P4 Truss" },
  "21": { uk: "Ферма P5", en: "P5 Truss" },
  "22": { uk: "Ферма S3", en: "S3 Truss" },
  "23": { uk: "Ферма S4", en: "S4 Truss" },
  "24": { uk: "Ферма S5", en: "S5 Truss" },
  "25": { uk: "Зовнішня платформа зберігання (ESP) 3", en: "External Stowage Platform (ESP) 3" },
  "26": { uk: "Гармоні (Вузол 2)", en: "Harmony (Node 2)" },
  "27": { uk: "Лабораторія «Коламбус»", en: "Columbus Laboratory" },
  "28": { uk: "«Кібо» — герметичний модуль зберігання", en: "Kibo — Pressurized Stowage Module" },
  "29": { uk: "ДЕКСТР (DEXTRE)", en: "Dextre (SPDM)" },
  "30": { uk: "«Кібо» — герметичний модуль", en: "Kibo — Pressurized Module" },
  "31": { uk: "Роборука «Кібо» (JEMRMS)", en: "Robotic Arm (JEMRMS)" },
  "32": { uk: "Ферма S6", en: "S6 Truss" },
  "33": { uk: "«Кібо» — відкрита платформа", en: "Kibo — Exposed Facility" },
  "34": { uk: "«Пошук» (МДМ-2) — малий дослідницький модуль", en: "Poisk (MRM-2)" },
  "35": { uk: "Вантажна платформа (ELC) 1", en: "Express Logistics Carrier (ELC) 1" },
  "36": { uk: "Вантажна платформа (ELC) 2", en: "Express Logistics Carrier (ELC) 2" },
  "37": { uk: "Транквіліті (Вузол 3)", en: "Tranquility (Node 3)" },
  "38": { uk: "Купол (Cupola)", en: "Cupola" },
  "39": { uk: "«Світанок» (МДМ-1) — малий дослідницький модуль", en: "Rassvet (MRM-1)" },
  "40": { uk: "«Леонардо» — багатоцільовий логістичний модуль", en: "Leonardo — Permanent Multipurpose Module" },
  "41": { uk: "Вантажна платформа (ELC) 4", en: "Express Logistics Carrier (ELC) 4" },
  "42": { uk: "Альфа-магнітний спектрометр (AMS-02)", en: "Alpha Magnetic Spectrometer (AMS-02)" },
  "43": { uk: "Вантажна платформа (ELC) 3", en: "Express Logistics Carrier (ELC) 3" },
  "44": { uk: "Виносна стріла-маніпулятор (EIBA)", en: "Enhanced ISS Boom Assembly (EIBA)" },
  "45": { uk: "RapidScat", en: "RapidScat" },
};

// Structure section (Iss.js "iss.structure") already carries hand-written
// descriptions for the six modules most visitors care about — reuse that
// copy in the info card instead of just repeating the raw node name.
const STRUCTURE_KEY_BY_NUM = {
  "01": "m1", // Zarya
  "02": "m2", // Unity Node 1
  "09": "m3", // Destiny
  "27": "m4", // Columbus
  "30": "m5", // Kibo (Pressurized Module)
  "38": "m6", // Cupola
};

// three.js's GLTFLoader sanitizes node names on load — spaces become
// underscores and duplicate siblings get "_2"/"_3" suffixes (the source glTF
// has "13 Pirs Docking Compartment (DC) and Airlock", but at runtime
// `object.name` is "13_Pirs_Docking_Compartment_(DC)_and_Airlock"). Match
// both the raw and sanitized separator.
function parseNodeName(raw) {
  const m = /^(\d{1,2})[\s_]+(.+)$/.exec(raw || "");
  if (!m) return null;
  return { num: m[1], label: m[2].replace(/_/g, " ").trim() };
}

function findLabeledAncestor(obj) {
  let cur = obj;
  while (cur) {
    const parsed = parseNodeName(cur.name);
    if (parsed) return parsed;
    cur = cur.parent;
  }
  return null;
}

function Model({ lang, onModulesReady, selectedNum, onSelect, showAllLabels }) {
  // useGLTF caches by URL — IssStationHeroPreview.js's mini viz requests the
  // same URL, so without cloning, opening this fullscreen viewer would steal
  // the shared THREE.Object3D out of the hero preview's scene graph (an
  // Object3D can only have one parent) and it would stay empty after
  // closing. Cloning gives each consumer its own nodes while still sharing
  // geometries/materials/textures (no extra memory or download).
  const { scene: cached } = useGLTF(MODEL_URL);
  const scene = useMemo(() => cached.clone(), [cached]);
  const { camera } = useThree();
  const controlsRef = useRef(null);

  const modules = useMemo(() => {
    const byNum = new Map();
    scene.traverse((obj) => {
      const parsed = parseNodeName(obj.name);
      if (!parsed) return;
      const world = new THREE.Vector3();
      obj.getWorldPosition(world);
      if (!byNum.has(parsed.num)) byNum.set(parsed.num, { num: parsed.num, label: parsed.label, points: [] });
      const entry = byNum.get(parsed.num);
      entry.points.push(world);
      // Sub-part nodes get loader-added disambiguation suffixes (e.g. the
      // canonical "38 Cupola" node sits alongside "38 Cupola.001".."007" for
      // its individual windows) — the shortest label per group is the
      // canonical, unsuffixed one.
      if (parsed.label.length < entry.label.length) entry.label = parsed.label;
    });
    return [...byNum.values()]
      .map((m) => {
        const center = m.points.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(m.points.length);
        // Prefer the translated, tidied module name over the raw (English,
        // occasionally typo'd) name parsed straight off the model.
        const translated = MODULE_NAMES[m.num];
        const label = translated ? translated[lang] || translated.en : m.label;
        return { num: m.num, label, position: [center.x, center.y, center.z] };
      })
      .sort((a, b) => Number(a.num) - Number(b.num));
  }, [scene, lang]);

  useEffect(() => { onModulesReady(modules); }, [modules, onModulesReady]);

  // Frame the whole station once — `scene` is already resolved here (this
  // component only renders past the suspending useGLTF() call once loaded).
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  const handlePointerDown = (e) => {
    const hit = findLabeledAncestor(e.object);
    if (!hit) return;
    e.stopPropagation();
    onSelect(hit.num);
  };

  const selected = modules.find((m) => m.num === selectedNum);

  return (
    <>
      <primitive object={scene} onPointerDown={handlePointerDown} />
      <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.08} minDistance={0.001} maxDistance={100000} />
      {(showAllLabels ? modules : selected ? [selected] : []).map((m) => (
        <Html key={m.num} position={m.position} zIndexRange={[10, 0]}>
          <div className={"iss3d-label" + (m.num === selectedNum ? " selected" : "")}>{m.num} · {m.label}</div>
        </Html>
      ))}
    </>
  );
}

export default function IssStationFullscreen({ onClose }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const wrapRef = useRef(null);
  const [modules, setModules] = useState([]);
  const [selectedNum, setSelectedNum] = useState(null);
  const [showAllLabels, setShowAllLabels] = useState(false);
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

  const selected = modules.find((m) => m.num === selectedNum);
  const structureKey = selected ? STRUCTURE_KEY_BY_NUM[selected.num] : null;

  return createPortal(
    <div ref={wrapRef} className="iss3d-wrap" role="dialog" aria-modal="true" aria-label={t("iss.station3d.title")}>
      <div className="iss3d-canvas-wrap">
        <Canvas key={resetTick} camera={{ fov: 45, position: [10, 6, 12] }} onPointerMissed={() => setSelectedNum(null)}>
          <color attach="background" args={["#05060d"]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[8, 12, 6]} intensity={2.2} />
          <directionalLight position={[-10, -4, -8]} intensity={0.4} />
          <Stars radius={200} depth={80} count={4000} factor={4} saturation={0} fade speed={0.4} />
          {/* fallback stays null — a plain DOM node can't be a Suspense
              fallback inside <Canvas> (different renderer); the loading
              message below is a normal HTML sibling instead. */}
          <Suspense fallback={null}>
            <Model lang={lang} onModulesReady={setModules} selectedNum={selectedNum} onSelect={setSelectedNum} showAllLabels={showAllLabels} />
          </Suspense>
        </Canvas>
      </div>

      {modules.length === 0 && <div className="iss3d-loading">{t("iss.station3d.loading")}</div>}

      <div className="iss3d-top-bar">
        <div>
          <div className="iss3d-title">{t("iss.station3d.title")}</div>
          <div className="iss3d-sub">{t("iss.station3d.eyebrow", { count: modules.length || 0 })}</div>
        </div>
        <button className="iss3d-btn iss3d-btn-close" onClick={onClose} aria-label={t("iss.station3d.close")}>✕</button>
      </div>

      {selected && (
        <div className="iss3d-card" onClick={(e) => e.stopPropagation()}>
          <button className="iss3d-card-close" onClick={() => setSelectedNum(null)} aria-label={t("iss.station3d.close")}>✕</button>
          <div className="iss3d-card-num">{selected.num}</div>
          <h3>{selected.label}</h3>
          <p>{structureKey ? t(`iss.structure.${structureKey}_body`) : t("iss.station3d.genericNote")}</p>
        </div>
      )}

      <div className="iss3d-hint">{t("iss.station3d.hint")}</div>

      <div className="iss3d-controls">
        <button className="iss3d-btn" onClick={() => { setSelectedNum(null); setResetTick((n) => n + 1); }}>
          ↺ {t("iss.station3d.resetView")}
        </button>
        <button className={"iss3d-btn" + (showAllLabels ? " on" : "")} onClick={() => setShowAllLabels((v) => !v)}>
          {showAllLabels ? t("iss.station3d.hideLabels") : t("iss.station3d.showLabels")}
        </button>
      </div>
    </div>,
    document.body
  );
}

useGLTF.preload(MODEL_URL);
