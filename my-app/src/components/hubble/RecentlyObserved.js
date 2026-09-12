// "What Hubble recently observed" card for the Hubble page — the most
// recent public science image in the MAST archive, sky-wide (not the 6
// famous targets the gallery below cones-searches). Deliberately NOT a
// live "what it's pointed at right now" feed — see
// services/mast.py: MastService.get_hst_recent_observation's docstring for
// why (that would need spacetelescopelive.org's undocumented, session-gated
// API, which this project has already ruled out — see CLAUDE.md).
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { getMastHstRecent } from "../../lib/api";

export default function RecentlyObserved() {
  const { t } = useTranslation();
  const { data } = useApi(getMastHstRecent);
  const latest = data && data.length > 0 ? data[0] : null;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", maxWidth: 420 }}>
      {!data && <p className="section-sub" style={{ padding: 22 }}>{t("hubble.recentlyObserved.loading")}</p>}
      {data && !latest && <p className="section-sub" style={{ padding: 22 }}>{t("hubble.recentlyObserved.empty")}</p>}
      {latest && (
        <>
          <img src={latest.jpeg_url} alt={latest.target} loading="lazy"
            style={{ width: "100%", height: 260, objectFit: "cover", display: "block" }} />
          <div style={{ padding: 18 }}>
            <div className="foot">{t("hubble.recentlyObserved.targetLabel")}</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginTop: 2 }}>
              {latest.target}
            </div>
            <div className="foot" style={{ marginTop: 4 }}>{latest.instrument} · {latest.coords}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
              {latest.date}
            </div>
            <a className="section-link" style={{ display: "inline-block", marginTop: 12 }}
              href={`https://mast.stsci.edu/portal/Mashup/Clients/Mast/Portal.html?searchQuery=${encodeURIComponent(latest.target)}`}
              target="_blank" rel="noopener noreferrer">
              {t("hubble.recentlyObserved.viewOnMast")}
            </a>
            <p className="foot" style={{ marginTop: 10, fontSize: 11 }}>
              {t("hubble.recentlyObserved.disclaimer")}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
