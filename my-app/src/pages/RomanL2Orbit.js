import { Component, lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "../styles/mission-editorial.css";

const RomanL2Scene = lazy(() => import("./RomanL2Scene"));
class SceneBoundary extends Component {
  state = { failed: false, resetKey: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error("Roman orbit failed to render", error); }
  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null;
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function RomanL2Orbit() {
  const { t } = useTranslation();
  const ui = t("roman.l2", { returnObjects: true });
  const frame = useRef(null);
  const [entered, setEntered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tabVisible, setTabVisible] = useState(() => !document.hidden);
  const [playing, setPlaying] = useState(() => !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") { setEntered(true); setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) setEntered(true);
    }, { rootMargin: "160px" });
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const reduce = () => { if (media.matches) setPlaying(false); };
    media?.addEventListener("change", reduce);
    return () => { document.removeEventListener("visibilitychange", update); media?.removeEventListener("change", reduce); };
  }, []);

  const running = playing && visible && tabVisible;
  return <figure className="roman-orbit-diagram" aria-label={ui.description}>
    <div className="roman-orbit-toolbar">
      <span className="roman-orbit-badge">{ui.modelLabel}</span>
      <div className="roman-orbit-buttons">
        <button type="button" className="btn ghost" aria-pressed={playing} onClick={() => setPlaying(value => !value)}>{playing ? ui.pause : ui.play}</button>
        <button type="button" className="btn ghost" onClick={() => setResetKey(value => value + 1)}>{ui.reset}</button>
      </div>
    </div>
    <ul className="roman-orbit-legend" aria-label={ui.legend}>
      {[["earth", ui.diagram_earth], ["roman", ui.marker], ["point", "L2"], ["sun", ui.sunDirection]].map(([key, label]) => <li key={key}><span className={"roman-orbit-dot is-" + key} aria-hidden="true" />{label}</li>)}
    </ul>
    <div className="roman-orbit-canvas" ref={frame}>
      {entered ? <SceneBoundary resetKey={resetKey} fallback={<p className="roman-orbit-feedback" role="status">{ui.unavailable}</p>}>
        <Suspense fallback={<p className="roman-orbit-feedback" role="status">{ui.loading}</p>}>
          <RomanL2Scene running={running} resetKey={resetKey} unavailable={ui.unavailable} />
        </Suspense>
      </SceneBoundary> : <p className="roman-orbit-feedback" role="status">{ui.loading}</p>}
    </div>
    <p className="roman-orbit-hint">{ui.hint}</p>
    <figcaption>{ui.note}</figcaption>
  </figure>;
}
