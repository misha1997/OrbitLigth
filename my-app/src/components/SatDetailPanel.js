// Orbital calculations and lazily loaded GCAT launch provenance remain
// separate: launch organizations and payload owners cannot be inferred from OMM.
import { useTranslation } from "react-i18next";
import { useState } from "react";
import i18next from "../i18n";
import SatelliteLaunchInfo from "./SatelliteLaunchInfo";

function fmtDuration(minutes) {
  if (minutes == null || !isFinite(minutes) || minutes < 0) return "—";
  const totalSec = Math.round(minutes * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function fmtDeg(value, posKey, negKey, t) {
  return Math.abs(value).toFixed(2) + "°" + t(value >= 0 ? posKey : negKey);
}

function Stat({ label, value, unit }) {
  return (
    <div className="sat-panel-stat">
      <div className="sat-panel-stat-k">{label}</div>
      <div className="sat-panel-stat-v">{value}{unit ? <span className="sat-panel-unit">{unit}</span> : null}</div>
    </div>
  );
}

export default function SatDetailPanel({ data, onClose }) {
  const { t } = useTranslation();
  const [launch, setLaunch] = useState(null);
  if (!data) return null;

  const km = t("common.units.km");
  const kms = t("common.units.km_s");
  const locale = i18next.language === "en" ? "en-US" : "uk-UA";
  const launchDate = launch?.norad_id === Number(data.norad) && launch.launch_date;
  const years = launchDate ? Math.max(0, (data.updatedAt - new Date(launchDate + "T00:00:00Z")) / (365.25 * 86400000)) : data.yearsInOrbit;

  const eclipseKnown = data.eclipseShadowedNow != null;
  const eclipseText = eclipseKnown
    ? t(data.eclipseShadowedNow ? "sat.panel.eclipseShadowed" : "sat.panel.eclipseSunlit")
    : null;
  const eclipseSubText = eclipseKnown && data.eclipseMinutesToChange != null
    ? t(data.eclipseShadowedNow ? "sat.panel.entersSunlightIn" : "sat.panel.entersShadowIn",
        { time: fmtDuration(data.eclipseMinutesToChange) })
    : null;

  return (
    <div className="sat-detail-panel" role="dialog" aria-label={data.name}>
      <div className="sat-detail-panel-head">
        <div>
          <div className="sat-detail-panel-name" style={{ color: data.color }}>{data.name}</div>
          <div className="sat-detail-panel-norad">NORAD {data.norad}</div>
        </div>
        <button type="button" className="sat-detail-panel-close" onClick={onClose} aria-label={t("sat.panel.close")}>✕</button>
      </div>

      <div className="sat-detail-panel-badges">
        <span className="sat-detail-badge" style={{ borderColor: data.color, color: data.color }}>
          {data.orbitClass ? t(`sat.panel.orbitClass.${data.orbitClass}`) : t("sat.panel.unknown")}
        </span>
        <span className="sat-detail-badge">{data.groupLabel}</span>
        {data.category && <span className="sat-detail-badge">{t(`orbital.types.${data.category}`)}</span>}
      </div>

      {eclipseText && (
        <div className={"sat-detail-eclipse" + (data.eclipseShadowedNow ? " in-shadow" : " in-sun")}>
          <span className="sat-detail-eclipse-dot" />
          <span>{eclipseText}{eclipseSubText ? ` — ${eclipseSubText}` : ""}</span>
        </div>
      )}

      <SatelliteLaunchInfo norad={data.norad} cospar={data.intlDesignator || ""} category={data.category} onLoaded={setLaunch} />

      <div className="sat-detail-panel-grid">
        <Stat label={t("sat.panel.latitude")} value={fmtDeg(data.lat, "common.compass.N", "common.compass.S", t)} />
        <Stat label={t("sat.panel.longitude")} value={fmtDeg(data.lon, "common.compass.E", "common.compass.W", t)} />
        <Stat label={t("sat.panel.altitude")} value={data.alt.toFixed(1)} unit={` ${km}`} />
        <Stat label={t("sat.panel.speed")} value={data.vel.toFixed(2)} unit={` ${kms}`} />
        <Stat label={t("sat.panel.inclination")} value={`${data.inclinationDeg.toFixed(2)}°`} />
        <Stat label={t("sat.panel.eccentricity")} value={data.eccentricity.toFixed(6)} />
        <Stat label={t("sat.panel.apogee")} value={data.apogeeKm.toFixed(0)} unit={` ${km}`} />
        <Stat label={t("sat.panel.perigee")} value={data.perigeeKm.toFixed(0)} unit={` ${km}`} />
        <Stat label={t("sat.panel.period")} value={fmtDuration(data.periodMin)} />
        <Stat label={t("sat.panel.completesIn")} value={fmtDuration(data.minutesToOrbitComplete)} />
        <Stat label={t("sat.panel.intlDesignator")} value={data.intlDesignator || t("sat.panel.unknown")} />
        <Stat label={t("sat.panel.yearsInOrbit")} value={years != null ? `${launchDate ? "" : "≈ "}${years.toFixed(1)}` : t("sat.panel.unknown")} />
      </div>

      {data.epoch && <div className="sat-orbit-metadata">
        {data.stale && <p className="sat-warning">{t("orbital.stale")}</p>}
        <dl>
          <dt>{t("orbital.epoch")}</dt><dd>{data.epoch} UTC</dd>
          <dt>{t("orbital.raan")}</dt><dd>{data.raan.toFixed(4)}°</dd>
          <dt>{t("orbital.argumentPerigee")}</dt><dd>{data.argumentPerigee.toFixed(4)}°</dd>
          <dt>{t("orbital.meanAnomaly")}</dt><dd>{data.meanAnomaly.toFixed(4)}°</dd>
          <dt>{t("orbital.meanMotion")}</dt><dd>{data.meanMotion.toFixed(8)} {t("orbital.revDay")}</dd>
          <dt>B*</dt><dd>{Number.isFinite(data.bstar) ? data.bstar.toExponential(4) : "—"}</dd>
          <dt>{t("orbital.groups")}</dt><dd>{data.groupLabels?.join(", ")}</dd>
          <dt>{t("orbital.fetched")}</dt><dd>{data.fetchedAt ? new Date(data.fetchedAt).toLocaleString(locale) : "—"}</dd>
        </dl>
        <details><summary>{t("orbital.rawElements")}</summary><pre>{JSON.stringify(data.omm, null, 2)}</pre></details>
        <a href={`https://celestrak.org/satcat/table-satcat.php?CATNR=${data.norad}`} target="_blank" rel="noopener noreferrer">CelesTrak / SATCAT ↗</a>
      </div>}

      <div className="sat-detail-panel-updated">
        {t("sat.panel.updated", { time: data.updatedAt.toLocaleTimeString(locale) })}
      </div>
    </div>
  );
}
