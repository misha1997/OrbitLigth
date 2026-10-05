import { Component, lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import MissionDiagram from "./MissionDiagram";

const MissionOrbitScene = lazy(() => import("./MissionOrbitScene"));
class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function MissionOrbitExplorer({ mission, data, loading, error, refetch, content, accent }) {
  const { t, i18n } = useTranslation();
  const ui = t("missionDetail.ui.explorer", { returnObjects: true });
  const [view, setView] = useState("local");
  const [selected, setSelected] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const points = data?.available && data.trajectory?.length > 1 ? data.trajectory : [];
  const index = selected === null ? Math.max(0, points.length - 1) : Math.min(selected, points.length - 1);
  const point = points[index];
  const locale = i18n.language === "en" ? "en-GB" : "uk-UA";
  const date = time => new Date(time * 1000).toLocaleString(locale, { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });

  useEffect(() => {
    if (!playing || points.length < 2 || view !== "local") return;
    const timer = setInterval(() => setSelected(current => ((current ?? points.length - 1) + Math.max(1, Math.ceil(points.length / 240))) % points.length), 120);
    return () => clearInterval(timer);
  }, [playing, points.length, view]);

  const fallback = <MissionDiagram mission={mission} labels={content.orbit.labels} note={ui.fallback} />;
  return (
    <div className="mission-orbit-panel">
      <div className="mission-orbit-toolbar">
        <div className="mission-orbit-legend"><span style={{ background: accent }} />{content.name}<span className="center-dot" />{ui.centers[mission]}</div>
        <div className="mission-segmented" role="group" aria-label={ui.view}>
          <button type="button" aria-pressed={view === "local"} onClick={() => setView("local")}>{ui.local}</button>
          <button type="button" aria-pressed={view === "nasa"} onClick={() => { setView("nasa"); setPlaying(false); }}>NASA Eyes</button>
        </div>
      </div>
      {view === "nasa" ? <>
        <iframe className="mission-eyes" src="https://eyes.nasa.gov/apps/solar-system/" title={`NASA Eyes · ${content.name}`} allowFullScreen loading="lazy" />
        <p className="mission-orbit-note">{ui.eyesNote} <a href="https://eyes.nasa.gov/apps/solar-system/" className="section-link" target="_blank" rel="noopener noreferrer">{ui.external} ↗</a></p>
      </> : <>
        {points.length > 1 ? <SceneBoundary key={mission} fallback={fallback}>
          <div className="mission-orbit-canvas">
            <Suspense fallback={<div className="mission-data-feedback" role="status">{ui.loading}</div>}>
              <MissionOrbitScene mission={mission} points={points} selected={index} accent={accent} resetKey={resetKey} />
            </Suspense>
            <div className="mission-orbit-hint">{ui.hint}</div>
          </div>
        </SceneBoundary> : fallback}
        {points.length > 1 && <div className="mission-time-controls">
          <div className="mission-time-buttons">
            <button type="button" className="btn ghost" aria-pressed={playing} onClick={() => setPlaying(value => !value)}>{playing ? ui.pause : ui.play}</button>
            <button type="button" className="btn ghost" onClick={() => { setSelected(null); setPlaying(false); }}>{ui.latest}</button>
            <button type="button" className="btn ghost" onClick={() => setResetKey(value => value + 1)}>{ui.reset}</button>
          </div>
          <label htmlFor={`${mission}-time`}>{ui.selected}: <time dateTime={new Date(point.time * 1000).toISOString()}>{date(point.time)} UTC</time></label>
          <input id={`${mission}-time`} type="range" min="0" max={points.length - 1} step="1" value={index} onChange={event => { setSelected(Number(event.target.value)); setPlaying(false); }} />
          <div className="mission-orbit-range"><span>{date(points[0].time)}</span><span>{date(points[points.length - 1].time)}</span></div>
          <p>{ui.selectedRange}: {Math.hypot(...point.position).toLocaleString(locale, { maximumFractionDigits: 0 })} {ui.km} · {ui.selectedSpeed}: {Math.hypot(...point.velocity).toLocaleString(locale, { maximumFractionDigits: 2 })} {ui.kms}</p>
        </div>}
        <p className="mission-orbit-note">{points.length ? ui.geometryNote : loading ? ui.loading : ui.unavailable} {data?.stale && ui.stale} {error && ui.unavailable}</p>
        {!points.length && !loading && <button type="button" className="btn ghost mission-data-retry" onClick={refetch}>{ui.retry}</button>}
      </>}
    </div>
  );
}
