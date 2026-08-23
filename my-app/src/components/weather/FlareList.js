// Explicit solar-flare events list (weather.html, next to the X-ray flux
// chart): begin/max/end time + class per event, newest first. A richer
// sibling of the aggregated flux series already charted — that shows the
// continuous curve, this shows the discrete events NOAA itself detected in it.
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { getFlares } from "../../lib/api";
import { fmtTime } from "../../lib/format";

function flareIconClass(cls) {
  const letter = (cls || "")[0];
  if (letter === "X") return "coral";
  if (letter === "C" || letter === "B" || letter === "A") return "teal";
  return ""; // M-class: base gold
}

export default function FlareList() {
  const { t } = useTranslation();
  const { data } = useApi(() => getFlares(15));
  const items = (data && data.items) || [];

  return (
    <div className="chart-card">
      <div className="ch-head">
        <h4>{t("weather.flares.title")}</h4>
        <span className="sub">{t("weather.flares.sub")}</span>
      </div>
      <div className="event-list" style={{ marginTop: 6 }}>
        {!data ? (
          <div style={{ color: "var(--text-dim)", fontSize: 13 }}>{t("weather.flares.loading")}</div>
        ) : items.length === 0 ? (
          <div style={{ color: "var(--text-dim)", fontSize: 13, padding: "6px 0" }}>{t("weather.flares.empty")}</div>
        ) : items.map((f, i) => (
          <div className="event" key={i}>
            <div className={"ic " + flareIconClass(f.max_class)}>☀️</div>
            <div>
              <div className="top">
                <h4>{f.max_class || "—"}</h4>
                <span className="t">{f.max_time ? fmtTime(Date.parse(f.max_time), true) : "—"}</span>
              </div>
              <p>
                {t("weather.flares.entry", {
                  begin: f.begin_time ? fmtTime(Date.parse(f.begin_time)) : "—",
                  end: f.end_time ? fmtTime(Date.parse(f.end_time)) : "—",
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
