import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import SectionHead from "../primitives/SectionHead";

const DSN_CODES = { newhorizons: "NHPC", juno: "JNO", chandra: "CHDR", tess: "TESS", europaclipper: "EURC" };
const DEFAULT_RANGE = { newhorizons: 9.8e9, juno: 8e8, chandra: 100000, tess: 250000, europaclipper: 1e8, perseverance: 225e6, cassini: 1.4e9, osirisrex: 300e6, gaia: 1.5e6, kepler: 150e6, spitzer: 200e6, pioneer10: 12.23e9, pioneer11: 6.4e9 };

export function MissionTelemetry({ mission, data, loading, error, refetch }) {
  const { t, i18n } = useTranslation();
  const ui = t("missionDetail.ui.live", { returnObjects: true });
  const locale = i18n.language === "en" ? "en-GB" : "uk-UA";
  const [unit, setUnit] = useState("km");
  const valid = data?.available;
  const format = (value, digits = 2) => Number.isFinite(value) ? value.toLocaleString(locale, { maximumFractionDigits: digits }) : "—";
  const distance = value => format(Number.isFinite(value) ? value / (unit === "au" ? 149597870.7 : 1) : null, unit === "au" ? 4 : 0);
  return <section className="section" id="live"><div className="wrap">
    <SectionHead eyebrow="NASA JPL Horizons" title={ui.title} sub={ui.note} />
    <div className="mission-live-header">
      <span className={`mission-data-state ${valid && !data.stale && !error ? "available" : ""}`} role="status">{loading ? ui.loading : valid ? data.stale || error ? ui.stale : ui.ready : ui.unavailable}</span>
      <div className="mission-segmented" role="group" aria-label={ui.units}>{["km", "au"].map(value => <button key={value} type="button" aria-pressed={unit === value} onClick={() => setUnit(value)}>{ui[value]}</button>)}</div>
      <button className="btn ghost" type="button" onClick={refetch} disabled={loading}>{ui.refresh}</button>
    </div>
    <div className="grid cols-4 mission-live-stats" aria-busy={loading}>
      {[
        [ui.earth, valid ? distance(data.distance_earth_km) : "—", ui[unit]],
        [ui.center[mission], valid ? distance(data.distance_center_km) : "—", ui[unit]],
        [ui.speed[mission], valid ? format(data.speed_center_kms) : "—", ui.kms],
        [ui.delay, valid ? format(data.light_time_seconds) : "—", ui.seconds],
      ].map(([label, value, suffix]) => <div className="card" key={label}><div className="k">{label}</div><div className="v mission-stat">{value}</div><div className="foot">{suffix}</div></div>)}
    </div>
    {valid && <p className="mission-orbit-note">{ui.updated}: <time dateTime={data.updated_at}>{new Date(data.updated_at).toLocaleString(locale, { timeZone: "UTC" })} UTC</time> · {ui.cache}</p>}
    {error && <p role="alert">{ui.unavailable}</p>}
    <a href="https://ssd.jpl.nasa.gov/horizons/" className="section-link" target="_blank" rel="noopener noreferrer">NASA JPL Horizons ↗</a>
  </div></section>;
}

export function MissionContact({ mission }) {
  const { t, i18n } = useTranslation();
  const ui = t("missionDetail.ui.contact", { returnObjects: true });
  const { data, loading, error, refetch } = useApi("/api/dsn", { interval: 60000 });
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const available = Array.isArray(data?.stations) && Number.isFinite(data?.timestamp_ms);
  const fresh = available && Math.abs(now - data.timestamp_ms) < 300000;
  const contacts = (data?.stations || []).flatMap(station => (station.dishes || []).flatMap(dish =>
    ["up_signals", "down_signals"].flatMap(direction => (dish[direction] || [])
      .filter(signal => signal.active && signal.spacecraft_code?.toUpperCase() === DSN_CODES[mission])
      .map(signal => ({ ...signal, station: station.friendly_name, dish: dish.name, direction })))
  ));
  return <article className="card mission-contact">
    <div className="eyebrow">NASA Deep Space Network</div><h3>{ui.title}</h3>
    <p role="status">{loading ? ui.loading : error || !available ? ui.unavailable : !fresh ? ui.stale : contacts.length ? ui.active : ui.quiet}</p>
    {fresh && contacts.map((contact, index) => <div className="mission-contact-row" key={`${contact.dish}-${contact.direction}-${index}`}><strong>{contact.station} · {contact.dish}</strong><span>{contact.direction === "up_signals" ? ui.uplink : ui.downlink} · {contact.band || "—"}{Number.isFinite(contact.data_rate) ? ` · ${contact.data_rate.toLocaleString(i18n.language)} bit/s` : ""}</span></div>)}
    <p className="mission-orbit-note">{ui.note}</p>
    {available && <p className="mission-credit">{ui.updated}: {new Date(data.timestamp_ms).toLocaleString(i18n.language === "en" ? "en-GB" : "uk-UA")}</p>}
    <div className="mission-time-buttons"><a href="https://eyes.nasa.gov/dsn/" className="section-link" target="_blank" rel="noopener noreferrer">DSN Now ↗</a>{(error || !available) && !loading && <button type="button" className="btn ghost" onClick={refetch}>{ui.retry}</button>}</div>
  </article>;
}

export function SignalCalculator({ mission, data }) {
  const { t, i18n } = useTranslation();
  const ui = t("missionDetail.ui.signal", { returnObjects: true });
  const [manualDistance, setManualDistance] = useState(null);
  const measured = data?.available && Number.isFinite(data.distance_earth_km);
  const distance = manualDistance ?? (measured ? data.distance_earth_km : DEFAULT_RANGE[mission]);
  const max = Math.max(DEFAULT_RANGE[mission] * 1.5, measured ? data.distance_earth_km : 0);
  const locale = i18n.language === "en" ? "en-GB" : "uk-UA";
  const duration = value => value < 60 ? `${value.toLocaleString(locale, { maximumFractionDigits: 2 })} ${ui.seconds}` : `${(value / 60).toLocaleString(locale, { maximumFractionDigits: 1 })} ${ui.minutes}`;
  return <article className="card mission-signal">
    <div className="eyebrow">{ui.eyebrow}</div><h3>{ui.title}</h3><p>{ui.intro}</p>
    <label htmlFor={`${mission}-signal`}>{ui.distance}: <strong>{distance.toLocaleString(locale, { maximumFractionDigits: 0 })} {ui.km}</strong></label>
    <input id={`${mission}-signal`} type="range" min="0" max={max} step={mission === "gaia" ? 10000 : mission === "chandra" || mission === "tess" ? 100 : 1000000} value={distance} onChange={event => setManualDistance(Number(event.target.value))} />
    <div className="mission-signal-results"><div><span>{ui.oneway}</span><strong>{duration(distance / 299792.458)}</strong></div><div><span>{ui.return}</span><strong>{duration(2 * distance / 299792.458)}</strong></div></div>
    <p className="mission-orbit-note">{manualDistance === null && measured ? ui.fromApi : ui.example} {ui.note}</p>
    <button type="button" className="btn ghost" onClick={() => setManualDistance(null)}>{measured ? ui.useCurrent : ui.reset}</button>
  </article>;
}
