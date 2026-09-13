// Gravitational-wave alerts card (deep.html), mirrors GrbList's shape.
// `configured:false` means the site owner hasn't set up a GCN Kafka client
// yet (GCN_CLIENT_ID/SECRET) — see CLAUDE.md — so we show a plain hint
// instead of a permanently-empty list.
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { getGw } from "../../lib/api";

function farLabel(far, t) {
  if (!far || Number(far) <= 0) return "—";
  const years = 1 / (Number(far) * 31557600);
  return years >= 1
    ? `${years.toLocaleString(undefined, { maximumFractionDigits: years >= 100 ? 0 : 1 })} ${t("events.gw.years")}`
    : t("events.gw.lessThanYear");
}

export default function GwList({ data: suppliedData }) {
  const { t } = useTranslation();
  const { data: fetchedData } = useApi(() => getGw(6), { deps: [suppliedData] });
  const data = suppliedData || fetchedData;
  const items = (data && data.items) || [];

  if (data && data.configured === false) {
    return (
      <div style={{ color: "var(--text-dim)", fontSize: 13, padding: "6px 0" }}>
        {t("deep.gw.notConfigured")}
      </div>
    );
  }

  return (
    <div className="event-list" style={{ marginTop: 14 }}>
      {!data ? (
        <div style={{ color: "var(--text-dim)", fontSize: 13 }}>{t("deep.gw.loading")}</div>
      ) : items.length === 0 ? (
        <div style={{ color: "var(--text-dim)", fontSize: 13, padding: "6px 0" }}>{t("deep.gw.empty")}</div>
      ) : items.map((a, i) => (
        <div className="event" key={i}>
          <div className="ic teal">🌊</div>
          <div>
            <div className="top">
              <h4>{a.superevent_id}</h4>
              <span className="t">{t("deep.gw.type." + (a.alert_type || "UPDATE"))}</span>
            </div>
            <p>{a.top_class ? t("deep.gw.class." + a.top_class) : t("deep.gw.class.Terrestrial")}</p>
            <div className="gw-meta">
              <span>{a.event_time || "—"}</span>
              <span>{a.instruments?.join(" · ") || "—"}</span>
              <span>{a.significant ? t("deep.gw.significant") : t("deep.gw.notSignificant")}</span>
              <span>{t("deep.gw.far")}: {farLabel(a.far, t)}</span>
            </div>
            {a.classification && Object.keys(a.classification).length > 0 && (
              <div className="gw-classification">
                {Object.entries(a.classification)
                  .sort(([, first], [, second]) => Number(second) - Number(first))
                  .slice(0, 3)
                  .map(([key, value]) => (
                    <span key={key}>{t("deep.gw.class." + key, { defaultValue: key })} {Math.round(Number(value) * 100)}%</span>
                  ))}
              </div>
            )}
            {a.gracedb_url && (
              <a href={a.gracedb_url} target="_blank" rel="noopener noreferrer"
                 style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--teal)" }}>
                {t("deep.gw.link")}
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
