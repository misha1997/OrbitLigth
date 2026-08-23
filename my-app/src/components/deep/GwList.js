// Gravitational-wave alerts card (deep.html), mirrors GrbList's shape.
// `configured:false` means the site owner hasn't set up a GCN Kafka client
// yet (GCN_CLIENT_ID/SECRET) — see CLAUDE.md — so we show a plain hint
// instead of a permanently-empty list.
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { getGw } from "../../lib/api";

export default function GwList() {
  const { t } = useTranslation();
  const { data } = useApi(() => getGw(6));
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
