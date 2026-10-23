import { useState } from "react";
import { useTranslation } from "react-i18next";
import SectionHead from "../primitives/SectionHead";
import { EARTH_RADII_PER_SUN, periodicTransitFlux, transitFlux } from "../../lib/transitModel";
import "../../styles/kepler-transit.css";

export default function KeplerTransitLab({ content }) {
  const [radius, setRadius] = useState(2);
  const [period, setPeriod] = useState(10);
  const [phase, setPhase] = useState(50);
  const { i18n } = useTranslation();
  const format = (value, digits = 2) => value.toLocaleString(i18n.language === "en" ? "en-GB" : "uk-UA", { maximumFractionDigits: digits });
  const ratio = radius / EARTH_RADII_PER_SUN;
  const depth = ratio * ratio;
  const separation = (phase - 50) / 50 * (1.25 + ratio);
  const flux = transitFlux(separation, ratio);
  const scale = Math.max(0.0005, depth * 1.4);
  const y = value => 270 + (1 - value) / scale * 140;
  const curve = Array.from({ length: 2401 }, (_, index) => {
    const day = index / 60;
    return `${index ? "L" : "M"}${(70 + day / 40 * 560).toFixed(2)},${y(periodicTransitFlux(day, period, ratio)).toFixed(2)}`;
  }).join(" ");
  const selectedDay = period / 2 + separation / 2.5;
  return <section className="section" id="transit"><div className="wrap">
    <SectionHead eyebrow={content.eyebrow} title={content.title} sub={content.intro} />
    <div className="mission-two-columns">
      <figure className="kepler-transit-figure">
        <svg viewBox="0 0 700 465" role="img" aria-label={content.diagram}>
          <defs><radialGradient id="kepler-lab-star"><stop stopColor="#fff4ce" /><stop offset="1" stopColor="#e9b66b" /></radialGradient></defs>
          <path d="M170 117H530" stroke="#d0c2ee50" strokeDasharray="5 8" />
          <circle cx="350" cy="117" r="76" fill="url(#kepler-lab-star)" />
          <circle cx={350 + separation * 76} cy="117" r={Math.max(3, ratio * 76)} fill="#101525" stroke="#c9b9ed" strokeWidth="1.5" />
          <text x="350" y="224" textAnchor="middle" fill="#bdb5d1" fontSize="14">{content.star}</text>
          {[0, 0.5, 1].map(fraction => <line key={fraction} x1="70" x2="630" y1={270 + fraction * 140} y2={270 + fraction * 140} stroke="#b2a2de25" />)}
          <path d="M70 260V410H630" stroke="#b2a2de60" fill="none" />
          <path d={curve} stroke="#b2a2de" strokeWidth="2.5" fill="none" />
          <line x1={70 + selectedDay / 40 * 560} x2={70 + selectedDay / 40 * 560} y1="260" y2="410" stroke="#f0d5a970" strokeDasharray="4 5" />
          <circle cx={70 + selectedDay / 40 * 560} cy={y(flux)} r="4" fill="#f0d5a9" />
          <g fill="#bdb5d1" fontSize="12"><text x="12" y="274">100%</text><text x="12" y="413">{format((1 - scale) * 100, 3)}%</text>
            {[0, 10, 20, 30, 40].map(day => <text key={day} x={70 + day / 40 * 560} y="433" textAnchor="middle">{day}</text>)}
            <text x="350" y="456" textAnchor="middle">{content.daysAxis}</text>
          </g>
        </svg>
        <figcaption>{content.note}</figcaption>
      </figure>
      <article className="card kepler-transit-controls">
        <label htmlFor="kepler-radius">{content.radius}: <strong>{format(radius)} {content.earthRadii}</strong></label>
        <input id="kepler-radius" type="range" min="0.5" max="12" step="0.5" value={radius} onChange={event => setRadius(Number(event.target.value))} />
        <label htmlFor="kepler-period">{content.period}: <strong>{period} {content.days}</strong></label>
        <input id="kepler-period" type="range" min="3" max="30" step="1" value={period} onChange={event => setPeriod(Number(event.target.value))} />
        <label htmlFor="kepler-phase">{content.phase}</label>
        <input id="kepler-phase" type="range" min="0" max="100" step="1" value={phase} onChange={event => setPhase(Number(event.target.value))} />
        <div className="mission-orbit-range"><span>{content.before}</span><span>{content.middle}</span><span>{content.after}</span></div>
        <div className="kepler-transit-results" aria-live="polite">
          <div><span>{content.depth}</span><strong>{format(depth * 1e6, 1)} ppm</strong></div>
          <div><span>{content.brightness}</span><strong>{format(flux * 100, 4)}%</strong></div>
        </div>
        <p>{content.formula}</p><p>{content.explanation}</p>
        <button className="btn ghost" type="button" onClick={() => { setRadius(2); setPeriod(10); setPhase(50); }}>{content.reset}</button>
      </article>
    </div>
  </div></section>;
}
