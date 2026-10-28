import { useState } from "react";
import { useTranslation } from "react-i18next";
import SectionHead from "../primitives/SectionHead";
import { gravityAssist } from "../../lib/gravityAssist";
import "../../styles/pioneer-flyby.css";

export default function PioneerFlybyLab({ mission, content }) {
  const [angle, setAngle] = useState(90);
  const [moving, setMoving] = useState(true);
  const { i18n } = useTranslation();
  const format = value => value.toLocaleString(i18n.language === "en" ? "en-GB" : "uk-UA", { maximumFractionDigits: 1 });
  const result = gravityAssist(angle, moving ? 13 : 0);
  const colors = ["#d9b778", "#8fafd9", "#78d4c4"];
  const vectors = (origin, relative, label) => {
    const planetEnd = [origin[0] + result.planetSpeed * 8, origin[1]];
    const end = [planetEnd[0] + relative[0] * 8, planetEnd[1] - relative[1] * 8];
    return <g>
      <text x={origin[0]} y="75" fill="#e2d6c3" fontSize="17">{label}</text>
      <path d={`M${origin[0]} 110V285M${origin[0] - 90} ${origin[1]}H${origin[0] + 180}`} fill="none" stroke="#ffffff18" />
      {moving && <line x1={origin[0]} y1={origin[1]} x2={planetEnd[0]} y2={planetEnd[1]} stroke={colors[0]} strokeWidth="3" markerEnd={`url(#${mission}-vector-0)`} />}
      <line x1={planetEnd[0]} y1={planetEnd[1]} x2={end[0]} y2={end[1]} stroke={colors[1]} strokeWidth="3" markerEnd={`url(#${mission}-vector-1)`} />
      <line x1={origin[0]} y1={origin[1] + 8} x2={end[0]} y2={end[1] + 8} stroke={colors[2]} strokeWidth="3" strokeDasharray="6 4" markerEnd={`url(#${mission}-vector-2)`} />
      <circle cx={origin[0]} cy={origin[1]} r="4" fill="#e2d6c3" />
    </g>;
  };
  return <section className="section" id="flyby"><div className="wrap">
    <SectionHead eyebrow={content.eyebrow} title={content.title} sub={content.intro} />
    <div className="mission-two-columns">
      <figure className="pioneer-flyby-figure">
        <svg viewBox="0 0 700 340" role="img" aria-label={content.diagram}>
          <defs>{colors.map((color, index) => <marker key={color} id={`${mission}-vector-${index}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 10 5 0 10Z" fill={color} /></marker>)}</defs>
          {vectors([150, 220], result.incoming, content.before)}
          {vectors([440, 220], result.outgoing, content.after)}
          <text x="350" y="315" textAnchor="middle" fill="#b9afbc" fontSize="13">{content.vectorRule}</text>
        </svg>
        <ul className="pioneer-vector-legend">{[content.planetVector, content.relativeVector, content.sunVector].map((label, index) => <li key={label}><span style={{ background: colors[index] }} />{label}</li>)}</ul>
        <figcaption>{content.note}</figcaption>
      </figure>
      <article className="card pioneer-flyby-controls">
        <label htmlFor={`${mission}-turn`}>{content.angle}: <strong>{angle}°</strong></label>
        <input id={`${mission}-turn`} type="range" min="0" max="140" step="5" value={angle} onChange={event => setAngle(Number(event.target.value))} />
        <div className="mission-orbit-range"><span>0°</span><span>140°</span></div>
        <div className="mission-destination-buttons" role="group" aria-label={content.scenario}>
          {[true, false].map(value => <button key={String(value)} type="button" aria-pressed={moving === value} onClick={() => setMoving(value)}>{value ? content.moving : content.stationary}</button>)}
        </div>
        <div className="pioneer-flyby-results" aria-live="polite">
          <div><span>{content.sunBefore}</span><strong>{format(result.before)} {content.kms}</strong></div>
          <div><span>{content.sunAfter}</span><strong>{format(result.after)} {content.kms}</strong></div>
          <div><span>{content.planetBoth}</span><strong>{format(result.relativeSpeed)} {content.kms}</strong></div>
        </div>
        <p role="status">{moving ? content.movingExplanation : content.stationaryExplanation}</p>
        <p>{content.context}</p>
        <button className="btn ghost" type="button" onClick={() => { setAngle(90); setMoving(true); }}>{content.reset}</button>
      </article>
    </div>
  </div></section>;
}
