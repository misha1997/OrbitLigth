import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getOrbits, getTleGroups } from "../lib/api";
import { mergeCatalog, OBJECT_COLORS } from "../lib/orbitalCatalog";

// A few hundred varied objects without the mass constellations and debris.
export const DEFAULT_ORBIT_GROUPS = { stations: true, visual: true, science: true, weather: true, gnss: true };
const defaultTypes = () => Object.fromEntries(Object.keys(OBJECT_COLORS).map(k => [k, k === "satellite" || k === "station"]));

export default function useOrbitalCatalog(lang) {
  const [groups, setGroups] = useState([]);
  const [groupError, setGroupError] = useState(false);
  const [active, setActive] = useState(DEFAULT_ORBIT_GROUPS);
  const [types, setTypes] = useState(defaultTypes);
  const [payloads, setPayloads] = useState({});
  const [status, setStatus] = useState({});
  const [frame, setFrame] = useState(null);
  const [workerError, setWorkerError] = useState(false);
  const worker = useRef(null), version = useRef(0), inFlight = useRef(new Set());
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let alive = true;
    setGroupError(false);
    getTleGroups(lang).then(g => { if (alive) setGroups(g); }).catch(() => { if (alive) setGroupError(true); });
    return () => { alive = false; };
  }, [lang]);

  // At most three upstream groups at a time. Requests are retained when a
  // checkbox is switched off, but the result never re-enables that layer.
  useEffect(() => {
    const keys = Object.keys(active).filter(k => active[k] && !payloads[k] && !status[k] && !inFlight.current.has(k));
    const slots = Math.max(0, 3 - inFlight.current.size);
    keys.slice(0, slots).forEach(key => {
      inFlight.current.add(key);
      setStatus(s => ({ ...s, [key]: "loading" }));
      getOrbits(key).then(data => {
        if (!mounted.current) return;
        setPayloads(p => ({ ...p, [key]: data }));
        setStatus(s => ({ ...s, [key]: !data.available ? "error" : data.stale ? "stale" : "ready" }));
      }).catch(() => { if (mounted.current) setStatus(s => ({ ...s, [key]: "error" })); })
        .finally(() => { inFlight.current.delete(key); if (mounted.current) setStatus(s => ({ ...s })); });
    });
  }, [active, payloads, status]);

  const objects = useMemo(() => mergeCatalog(payloads, active, groups).filter(o => types[o.category]), [payloads, active, groups, types]);
  useEffect(() => {
    try {
      const w = new Worker(new URL("../workers/orbital.worker.js", import.meta.url));
      worker.current = w;
      w.onerror = () => setWorkerError(true);
      w.onmessage = ({ data }) => { if (data.version === version.current) setFrame(data); };
      return () => { w.terminate(); worker.current = null; };
    } catch { setWorkerError(true); }
  }, []);
  useEffect(() => {
    const current = ++version.current;
    setFrame(null);
    const send = () => worker.current?.postMessage(document.hidden ? { pause: true } : { version: current, objects });
    send();
    document.addEventListener("visibilitychange", send);
    return () => document.removeEventListener("visibilitychange", send);
  }, [objects]);

  const toggle = useCallback(key => {
    // An explicitly enabled catalog must be visible even when its object type
    // (e.g. debris) was hidden by the initial observing selection.
    if (!active[key]) {
      const category = groups.find(g => g.key === key)?.category;
      if (category) setTypes(types => ({ ...types, [category]: true }));
    }
    setActive(a => ({ ...a, [key]: !a[key] }));
  }, [active, groups]);
  const toggleType = useCallback(key => setTypes(a => ({ ...a, [key]: !a[key] })), []);
  const selectAll = useCallback(value => {
    setActive(Object.fromEntries(groups.map(g => [g.key, value])));
    if (value) setTypes(Object.fromEntries(Object.keys(OBJECT_COLORS).map(k => [k, true])));
  }, [groups]);
  const recommended = useCallback(() => { setActive({ ...DEFAULT_ORBIT_GROUPS }); setTypes(defaultTypes()); }, []);
  const retry = useCallback(() => {
    const failed = Object.keys(status).filter(k => status[k] === "error" || status[k] === "stale");
    setPayloads(p => Object.fromEntries(Object.entries(p).filter(([k]) => !failed.includes(k))));
    setStatus(s => Object.fromEntries(Object.entries(s).filter(([k]) => !failed.includes(k))));
    if (groupError) getTleGroups(lang).then(g => { setGroups(g); setGroupError(false); }).catch(() => {});
  }, [status, groupError, lang]);
  const loading = Object.keys(active).some(k => active[k] && (!status[k] || status[k] === "loading"));
  const failed = Object.keys(active).filter(k => active[k] && ["error", "stale"].includes(status[k]));
  return { groups, active, toggle, selectAll, recommended, types, toggleType, objects, frame, status, loading, failed, retry, groupError, workerError };
}
