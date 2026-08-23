// NASA/JPL Sentry impact-risk table (deep.html) — top objects by cumulative
// Palermo Scale. Distinct from the /neo close-approach page: every object
// here has a non-zero *modeled* impact probability, however tiny.
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { getSentry } from "../../lib/api";

// Impact probabilities are astronomically small (e.g. 0.000377) — "1 in N"
// reads far more intuitively than a raw decimal or percentage.
function oneInN(p) {
  if (!p || p <= 0) return "—";
  const n = Math.round(1 / p);
  return "1 / " + n.toLocaleString("en-US");
}

export default function SentryList() {
  const { t } = useTranslation();
  const { data } = useApi(() => getSentry(10));
  const items = (data && data.items) || [];

  return (
    <div className="table-wrap" style={{ marginTop: 14 }}>
      {!data ? (
        <div style={{ color: "var(--text-dim)", fontSize: 13 }}>{t("deep.sentry.loading")}</div>
      ) : items.length === 0 ? (
        <div style={{ color: "var(--text-dim)", fontSize: 13, padding: "6px 0" }}>{t("deep.sentry.empty")}</div>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>{t("deep.sentry.col.object")}</th>
              <th>{t("deep.sentry.col.diameter")}</th>
              <th>{t("deep.sentry.col.ip")}</th>
              <th>{t("deep.sentry.col.ps")}</th>
              <th>{t("deep.sentry.col.range")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={i}>
                <td>{r.fullname || r.designation}</td>
                <td className="mono">{r.diameter_km != null ? r.diameter_km + " km" : "—"}</td>
                <td className="mono">{oneInN(r.impact_probability)}</td>
                <td className="mono">{r.palermo_scale_cum != null ? r.palermo_scale_cum.toFixed(2) : "—"}</td>
                <td className="mono">{r.year_range || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
