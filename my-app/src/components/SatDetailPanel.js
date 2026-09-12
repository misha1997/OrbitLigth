// Detail panel shown when a satellite marker on SatMap is clicked — orbital
// elements come straight from the TLE via satrec (see lib/satOrbit.js);
// operator name and radar cross-section aren't derivable from a bare TLE, so
// unlike orbitalradar.com's panel this shows the Celestrak group instead of a
// named operator and omits RCS entirely rather than guessing.
import { useTranslation } from "react-i18next";
import i18next from "../i18n";

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
  if (!data) return null;

  const km = t("common.units.km");
  const kms = t("common.units.km_s");
  const locale = i18next.language === "en" ? "en-US" : "uk-UA";

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
      </div>

      {eclipseText && (
        <div className={"sat-detail-eclipse" + (data.eclipseShadowedNow ? " in-shadow" : " in-sun")}>
          <span className="sat-detail-eclipse-dot" />
          <span>{eclipseText}{eclipseSubText ? ` — ${eclipseSubText}` : ""}</span>
        </div>
      )}

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
        <Stat label={t("sat.panel.yearsInOrbit")} value={data.yearsInOrbit != null ? data.yearsInOrbit.toFixed(1) : t("sat.panel.unknown")} />
      </div>

      <div className="sat-detail-panel-updated">
        {t("sat.panel.updated", { time: data.updatedAt.toLocaleTimeString(locale) })}
      </div>
    </div>
  );
}
