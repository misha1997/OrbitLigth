// Recently decayed/re-entered objects (deep.html) — CelesTrak SATCAT,
// retrospective ("what came down"), not predictive. See services/reentries.py
// for why: Aerospace Corp's CORDS has no public feed for predictions.
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { getReentries } from "../../lib/api";

const TYPE_ICON = { PAY: "🛰️", "R/B": "🚀", DEB: "💥", UNK: "❓" };

export default function ReentryList() {
  const { t } = useTranslation();
  const { data } = useApi(() => getReentries(60, 10));
  const items = (data && data.items) || [];

  return (
    <div className="event-list" style={{ marginTop: 14 }}>
      {!data ? (
        <div style={{ color: "var(--text-dim)", fontSize: 13 }}>{t("deep.reentries.loading")}</div>
      ) : items.length === 0 ? (
        <div style={{ color: "var(--text-dim)", fontSize: 13, padding: "6px 0" }}>{t("deep.reentries.empty")}</div>
      ) : items.map((r, i) => (
        <div className="event" key={i}>
          <div className="ic">{TYPE_ICON[r.object_type] || "🛰️"}</div>
          <div>
            <div className="top"><h4>{r.name}</h4><span className="t">{r.decay_date}</span></div>
            <p>{t("deep.reentries.type." + (r.object_type || "UNK"))} · {r.owner || "—"}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
