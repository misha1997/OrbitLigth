// Deep space page (deep.html): orbital debris stats + GRB alerts, plus a
// Voyager teaser grid. Port of app.js loadDebris / loadGRB.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import LocalizedLink from "../components/primitives/LocalizedLink";
import Eyebrow from "../components/primitives/Eyebrow";

export default function Deep() {
  const { t } = useTranslation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { document.title = t("title.deep"); }, [t]);
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow">{t("deep.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("deep.hero.title") }} />
            <p className="hero-sub">{t("deep.hero.sub")}</p>
          </div>
        </div>
      </section>

      <section className="section" id="voyager" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <Eyebrow gold>{t("deep.s3.eyebrow")}</Eyebrow>
              <h2 className="section-title">{t("deep.s3.title")}</h2>
            </div>
            <LocalizedLink to="voyager" className="section-link">{t("deep.s3.link")}</LocalizedLink>
          </div>
          <div className="grid cols-2">
            <div className="card">
              <div className="k">{t("deep.v1.title")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 12, lineHeight: 1.6 }}>{t("deep.v1.body")}</p>
              <LocalizedLink to="voyager" className="btn ghost" style={{ marginTop: 14 }}>{t("deep.v1.link")}</LocalizedLink>
            </div>
            <div className="card">
              <div className="k">{t("deep.v2.title")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 12, lineHeight: 1.6 }}>{t("deep.v2.body")}</p>
              <LocalizedLink to="voyager" className="btn ghost" style={{ marginTop: 14 }}>{t("deep.v2.link")}</LocalizedLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}