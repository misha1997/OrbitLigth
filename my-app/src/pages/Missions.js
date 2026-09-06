// Missions hub (/missions): a gallery of space probes and telescopes. Voyager,
// Hubble, JWST and Roman already have dedicated pages so their cards link
// through; the rest render as disabled "coming soon" tiles (see lib/missions.js
// for the full registry and what's built vs. not). Ports the Planetarium
// hub's card-grid pattern (see Planetarium.js) since the "some pages exist,
// some don't yet" shape is identical.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import LocalizedLink from "../components/primitives/LocalizedLink";
import { MISSIONS } from "../lib/missions";
import { useSeo } from "../hooks/useSeo";
import "../styles/missions.css";

export default function Missions() {
  const { t } = useTranslation();
  useSeo();
  useEffect(() => { document.title = t("title.missions"); }, [t]);

  return (
    <>
      <section className="hero missions-hero">
        <div className="wrap">
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow gold">{t("missions.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("missions.hero.title") }} />
            <p className="hero-sub">{t("missions.hero.sub")}</p>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="mission-grid">
            {MISSIONS.map((m) => {
              const body = (
                <>
                  <div className="mission-visual-wrap">
                    {m.img ? (
                      <img className="mission-photo" src={m.img} alt={t(m.labelKey)} loading="lazy" decoding="async" />
                    ) : (
                      <span className="mission-icon" style={{ color: m.accent }}>{m.icon}</span>
                    )}
                  </div>
                  <div>
                    <div className="mission-card-head">
                      <h3>{t(m.labelKey)}</h3>
                      <span className={"mission-badge status-" + m.status}>{t("missions.status." + m.status)}</span>
                    </div>
                    <div className="mission-meta">{t("missions.type." + m.type)} · {m.year}</div>
                  </div>
                  <p className="mission-blurb">{t(m.blurbKey)}</p>
                </>
              );
              return m.disabled ? (
                <div key={m.key} className="mission-card disabled" aria-disabled="true">
                  {body}
                  <div className="mission-soon-note">{t("missions.comingSoon")}</div>
                </div>
              ) : (
                <LocalizedLink key={m.key} to={m.to} className="mission-card">
                  {body}
                  <div className="mission-cta">{t("missions.open")} →</div>
                </LocalizedLink>
              );
            })}
          </div>
          <p className="missions-foot-note">{t("missions.footNote")}</p>
        </div>
      </section>
    </>
  );
}
