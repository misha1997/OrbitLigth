// Recently decayed/re-entered objects (deep.html) — CelesTrak SATCAT,
// retrospective ("what came down"), not predictive. See services/reentries.py
// for why: Aerospace Corp's CORDS has no public feed for predictions.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { getReentries } from "../../lib/api";
import "../../styles/reentries.css";

const TYPE_ICON = { PAY: "🛰️", "R/B": "🚀", DEB: "💥", UNK: "❓" };

export default function ReentryList() {
  const { t, i18n } = useTranslation();
  const { data, loading, error, refetch } = useApi(() => getReentries(60, 10));
  const [expanded, setExpanded] = useState(false);
  const items = (data && data.items) || [];

  return (
    <div className="sat-reentries" aria-busy={loading}>
      {loading ? (
        <p role="status">{t("deep.reentries.loading")}</p>
      ) : error || data?.available === false || !Array.isArray(data?.items) ? (
        <div className="sat-reentries-state" role="status"><span>{t("orbital.reentriesError")}</span>
          <button type="button" className="btn ghost" onClick={refetch}>{t("orbital.retry")}</button></div>
      ) : items.length === 0 ? (
        <p role="status">{t("deep.reentries.empty")}</p>
      ) : <>
      <div className="event-list">{items.slice(0, expanded ? items.length : 5).map((r, i) => {
        const type = (r.object_type || "UNK").replace("R B", "R/B");
        const date = r.decay_date ? new Date(r.decay_date + "T00:00:00Z") : null;
        return <div className="event" key={r.norad_id || i}>
          <div className="ic" aria-hidden="true">{TYPE_ICON[type] || TYPE_ICON.UNK}</div>
          <div>
            <div className="top"><h4>{r.name || t("orbital.types.unknown")}</h4><time className="t" dateTime={r.decay_date}>
              {date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(i18n.resolvedLanguage, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date) : "—"}
            </time></div>
            <p>{t("deep.reentries.type." + (TYPE_ICON[type] ? type : "UNK"))} · {r.owner || "—"}
              {r.norad_id && <> · <a href={`https://celestrak.org/satcat/records.php?CATNR=${encodeURIComponent(r.norad_id)}`} target="_blank" rel="noopener noreferrer">NORAD {r.norad_id} ↗</a></>}</p>
          </div>
        </div>;
      })}</div>
      {items.length > 5 && <button type="button" className="btn ghost sat-reentries-more" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
        {t(expanded ? "orbital.reentriesLess" : "orbital.reentriesMore", { count: items.length - 5 })}</button>}
      </>}
      {!loading && data?.available && <p className="sat-source-note">{t("orbital.reentriesWindow", { count: items.length, days: data.window_days || 60 })}
        {data.updated_at && <span> · {t("orbital.checked")} <time dateTime={data.updated_at}>{new Intl.DateTimeFormat(i18n.resolvedLanguage, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(data.updated_at))}</time></span>}</p>}
    </div>
  );
}
