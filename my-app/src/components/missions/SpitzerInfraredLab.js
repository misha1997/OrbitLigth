import { useState } from "react";
import { useTranslation } from "react-i18next";
import SectionHead from "../primitives/SectionHead";
import { normalizedPlanck, spitzerChannelAvailable, SPITZER_IMAGING_CHANNELS, wienPeakMicrons } from "../../lib/blackbodyModel";
import "../../styles/spitzer-infrared.css";

const x = wavelength => 65 + Math.log(wavelength / 0.3) / Math.log(200 / 0.3) * 560;

export default function SpitzerInfraredLab({ content }) {
  const [temperature, setTemperature] = useState(300);
  const [mode, setMode] = useState("cold");
  const { i18n } = useTranslation();
  const format = (value, digits = 2) => value.toLocaleString(i18n.language === "en" ? "en-GB" : "uk-UA", { maximumFractionDigits: digits });
  const peak = wienPeakMicrons(temperature);
  const curve = Array.from({ length: 481 }, (_, index) => {
    const wavelength = 0.3 * (200 / 0.3) ** (index / 480);
    return `${index ? "L" : "M"}${x(wavelength).toFixed(2)},${(280 - normalizedPlanck(wavelength, temperature) * 205).toFixed(2)}`;
  }).join(" ");
  return <section className="section" id="infrared"><div className="wrap">
    <SectionHead eyebrow={content.eyebrow} title={content.title} sub={content.intro} />
    <div className="mission-two-columns">
      <figure className="spitzer-spectrum-figure">
        <svg viewBox="0 0 700 430" role="img" aria-label={content.diagram}>
          <rect x={x(0.38)} y="55" width={x(0.75) - x(0.38)} height="225" fill="#b1b4d91c" />
          <text x="65" y="30" fill="#c5bfd0" fontSize="14">{content.radiance}</text>
          {[0, 0.5, 1].map(value => <g key={value}><line x1="65" x2="625" y1={280 - value * 205} y2={280 - value * 205} stroke="#e6a17b25" /><text x="48" y={284 - value * 205} textAnchor="end" fontSize="12" fill="#bdb4c2">{format(value)}</text></g>)}
          {SPITZER_IMAGING_CHANNELS.map(wavelength => <g key={wavelength} opacity={spitzerChannelAvailable(wavelength, mode) ? 0.85 : 0.18}>
            <line x1={x(wavelength)} x2={x(wavelength)} y1="55" y2="280" stroke={wavelength <= 8 ? "#e6a17b" : "#a8a3ec"} strokeDasharray="3 5" />
            <circle cx={x(wavelength)} cy="318" r="4" fill={wavelength <= 8 ? "#e6a17b" : "#a8a3ec"} />
          </g>)}
          <path d={curve} fill="none" stroke="#f3c28c" strokeWidth="3" />
          <line x1={x(peak)} x2={x(peak)} y1="61" y2="280" stroke="#f7e1b5" strokeDasharray="5 5" />
          <circle cx={x(peak)} cy="75" r="5" fill="#f7e1b5" />
          <path d="M65 55V280H625" stroke="#b6a8ba90" fill="none" />
          {[0.3, 1, 3.6, 8, 24, 70, 160].map(wavelength => <text key={wavelength} x={x(wavelength)} y="299" textAnchor="middle" fill="#c5bfd0" fontSize="12">{format(wavelength)}</text>)}
          <text x="350" y="352" textAnchor="middle" fill="#c5bfd0" fontSize="14">{content.wavelength}</text>
          <text x={x(0.54)} y="390" textAnchor="middle" fill="#b1b4d9" fontSize="12">{content.visible}</text>
          <text x={x(8)} y="390" textAnchor="middle" fill="#e6a17b" fontSize="12">{content.infrared}</text>
        </svg>
        <figcaption>{content.note}</figcaption>
      </figure>
      <article className="card spitzer-spectrum-controls">
        <label htmlFor="spitzer-temperature">{content.temperature}: <strong>{format(temperature, 0)} K</strong></label>
        <input id="spitzer-temperature" type="range" min="50" max="1500" step="10" value={temperature} onChange={event => setTemperature(Number(event.target.value))} />
        <div className="mission-orbit-range"><span>50 K</span><span>1 500 K</span></div>
        <div className="spitzer-spectrum-results" aria-live="polite"><span>{content.peak}</span><strong>{format(peak)} {content.microns}</strong></div>
        <div className="mission-destination-buttons" role="group" aria-label={content.mode}>
          {["cold", "warm"].map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{content[value]}</button>)}
        </div>
        <p className="spitzer-spectrum-availability" role="status">{mode === "cold" ? content.coldAvailability : content.warmAvailability}</p>
        <ul className="spitzer-spectrum-channels" aria-label={content.channels}>
          {SPITZER_IMAGING_CHANNELS.map(wavelength => <li key={wavelength} className={spitzerChannelAvailable(wavelength, mode) ? "is-available" : "is-unavailable"}>
            <span>{wavelength <= 8 ? "IRAC" : "MIPS"} · {format(wavelength)} {content.microns}</span><span>{spitzerChannelAvailable(wavelength, mode) ? content.available : content.unavailable}</span>
          </li>)}
        </ul>
        <p>{content.formula}</p><p>{content.explanation}</p>
        <button type="button" className="btn ghost" onClick={() => { setTemperature(300); setMode("cold"); }}>{content.reset}</button>
      </article>
    </div>
  </div></section>;
}
