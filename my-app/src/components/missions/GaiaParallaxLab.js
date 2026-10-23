import { useState } from "react";
import { useTranslation } from "react-i18next";
import SectionHead from "../primitives/SectionHead";

export default function GaiaParallaxLab({ content }) {
  const [distance, setDistance] = useState(100);
  const [phase, setPhase] = useState(-1);
  const { i18n } = useTranslation();
  const format = value => value.toLocaleString(i18n.language === "en" ? "en-GB" : "uk-UA", { maximumFractionDigits: 2 });
  const parallax = 1000 / distance;
  const shift = 700 / distance;
  return <section className="section" id="parallax"><div className="wrap">
    <SectionHead eyebrow={content.eyebrow} title={content.title} sub={content.intro} />
    <div className="mission-two-columns">
      <figure className="mission-parallax-figure">
        <svg viewBox="0 0 700 400" role="img" aria-label={content.diagram}>
          <g fill="#d4c7ed70">{[[85, 60], [175, 45], [525, 60], [610, 45], [120, 105], [565, 112]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2" />)}</g>
          <path d="M80 145H620" stroke="#b4a0ed25" strokeDasharray="4 8" />
          <ellipse cx="350" cy="310" rx="165" ry="43" fill="none" stroke="#b4a0ed70" strokeWidth="2" />
          <path d={`M${350 + phase * 165} 310 350 145 ${350 - phase * shift} 62`} fill="none" stroke="#b4a0ed" strokeWidth="2" />
          <path d={`M${350 - phase * 165} 310 350 145 ${350 + phase * shift} 62`} fill="none" stroke="#b4a0ed45" strokeWidth="2" strokeDasharray="5 7" />
          <circle cx="350" cy="310" r="19" fill="#e5bd6d" />
          <circle cx={350 + phase * 165} cy="310" r="11" fill="#8bbde0" stroke="#fff" strokeWidth="2" />
          <circle cx={350 - phase * 165} cy="310" r="11" fill="none" stroke="#8bbde050" strokeWidth="2" />
          <circle cx="350" cy="145" r="8" fill="#dfc4fc" />
          <circle cx={350 - phase * shift} cy="62" r="6" fill="#eee3ff" />
          <circle cx={350 + phase * shift} cy="62" r="6" fill="none" stroke="#eee3ff70" />
          <g fill="#c9c4d5" fontSize="14" textAnchor="middle"><text x="350" y="355">{content.sun}</text><text x="350" y="176">{content.star}</text><text x="350" y="25">{content.background}</text></g>
        </svg>
        <figcaption>{content.note}</figcaption>
      </figure>
      <article className="card mission-parallax-controls">
        <label htmlFor="gaia-distance">{content.distance}: <strong>{format(distance)} {content.pc}</strong></label>
        <input id="gaia-distance" type="range" min="10" max="1000" step="10" value={distance} onChange={event => setDistance(Number(event.target.value))} />
        <div className="mission-orbit-range"><span>10 {content.pc}</span><span>1 000 {content.pc}</span></div>
        <div className="mission-destination-buttons" role="group" aria-label={content.epoch}>
          {[-1, 1].map((value, index) => <button type="button" key={value} aria-pressed={phase === value} onClick={() => setPhase(value)}>{content.epochs[index]}</button>)}
        </div>
        <div className="mission-parallax-results" aria-live="polite">
          <div><span>{content.parallax}</span><strong>{format(parallax)} {content.mas}</strong></div>
          <div><span>{content.lightyears}</span><strong>{format(distance * 3.26156)} {content.ly}</strong></div>
        </div>
        <p>{content.formula}</p><p>{content.explanation}</p>
      </article>
    </div>
  </div></section>;
}
