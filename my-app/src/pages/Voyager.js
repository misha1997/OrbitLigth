// Voyager page (voyager.html): trajectory diagram, live distance cards,
// mission timeline, comparison table, RTG power bars, Golden Record.
// Port of app.js loadVoyager / setVoyager.
import { useTranslation } from "react-i18next";
import { useSeo } from "../hooks/useSeo";
import { useApi } from "../hooks/useApi";
import { getVoyager } from "../lib/api";
import SectionHead from "../components/primitives/SectionHead";
import FeatureRow from "../components/primitives/FeatureRow";
import OrbitMap from "../components/voyager/OrbitMap";
import DsnNow from "../components/voyager/DsnNow";

function VoyagerCards({ t, data }) {
  const d = data || {};
  const v1 = d["1"] || {};
  const v2 = d["2"] || {};
  const cards = [
    { k: t("voyager.cards.v1"), val: v1.au ?? "—", unit: t("common.units.ao"), foot: v1.light_hours != null ? t("voyager.cards.lightHours", { n: v1.light_hours }) : "—" },
    { k: t("voyager.cards.v2"), val: v2.au ?? "—", unit: t("common.units.ao"), foot: v2.light_hours != null ? t("voyager.cards.lightHours", { n: v2.light_hours }) : "—" },
    { k: t("voyager.cards.speedV1"), val: Number.isFinite(v1.speed_kms) ? v1.speed_kms.toFixed(1) : "—", unit: t("common.units.km_s"), foot: v1.au_per_year != null ? t("voyager.cards.auPerYear", { n: v1.au_per_year }) : "—" },
    { k: t("voyager.cards.speedV2"), val: Number.isFinite(v2.speed_kms) ? v2.speed_kms.toFixed(1) : "—", unit: t("common.units.km_s"), foot: v2.au_per_year != null ? t("voyager.cards.auPerYear", { n: v2.au_per_year }) : "—" },
  ];
  return (
    <div className="grid cols-4" id="voyager-cards">
      {cards.map((c, i) => (
        <div className="card" key={i}>
          <div className="k">{c.k}{c.dot && <span className={"dot " + c.dot} />}</div>
          <div className="v">{c.val}{c.unit && <span className="unit">{c.unit}</span>}</div>
          <div className="foot">{c.foot}</div>
        </div>
      ))}
    </div>
  );
}

function CompareTable({ t }) {
  const rows = [
    { p: t("voyager.row.launch"), a: t("voyager.row.launchV1"), b: t("voyager.row.launchV2") },
    { p: t("voyager.row.helio"), a: "25.08.2012", b: "05.11.2018" },
    { p: t("voyager.row.planets"), a: t("voyager.row.planetsV1"), b: t("voyager.row.planetsV2") },
    { p: t("voyager.row.dir"), a: t("voyager.row.north"), b: t("voyager.row.south") },
  ];
  return (
    <table className="data">
      <thead>
        <tr><th>{t("voyager.compare.col")}</th><th>{t("voyager.compare.v1")}</th><th>{t("voyager.compare.v2")}</th></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r.p}</td>
            <td className="hl">{r.a}</td>
            <td className="hl2">{r.b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Voyager() {
  const { t } = useTranslation();
  useSeo();
  const { data, loading, error } = useApi(getVoyager);
  const available = Number.isFinite(data?.["1"]?.au) && Number.isFinite(data?.["2"]?.au);
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid" style={{ marginBottom: 20 }}>
          <div>
            <div className="eyebrow">{t("voyager.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("voyager.hero.title") }} />
            <p className="hero-sub">{t("voyager.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#timeline" className="btn primary">{t("voyager.hero.timeline")}</a>
              <a href="#compare" className="btn ghost">{t("voyager.hero.compare")}</a>
            </div>
          </div>
          <div className="orbit-wrap">
            <OrbitMap />
          </div>
        </div>
        <div className="wrap" style={{ marginTop: 8 }}>
          <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
            <div className="legend-row"><span className="legend-swatch" style={{ background: "var(--gold)" }} /> {t("voyager.legend.v1")}</div>
            <div className="legend-row"><span className="legend-swatch" style={{ background: "var(--teal)" }} /> {t("voyager.legend.v2")}</div>
            <div className="legend-row"><span className="legend-swatch" style={{ background: "var(--coral)", opacity: 0.6 }} /> {t("voyager.legend.helio")}</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow={t("voyager.s1.eyebrow")} title={t("voyager.s1.title")} />
          {available ? <VoyagerCards t={t} data={data} /> : <p role="status">{t(loading ? "voyager.dataLoading" : "voyager.dataUnavailable")}</p>}
          {error && available && <p className="mission-editorial-note">{t("missionDetail.ui.live.stale")}</p>}
        </div>
      </section>

      <DsnNow />

      <section className="section" id="timeline">
        <div className="wrap">
          <SectionHead eyebrow={t("voyager.s2.eyebrow")} title={t("voyager.s2.title")} />
          <FeatureRow tag={t("voyager.tl.t1_tag")} title={t("voyager.tl.t1_title")} num={t("voyager.tl.t1_num")}>{t("voyager.tl.t1_body")}</FeatureRow>
          <FeatureRow tag={t("voyager.tl.t2_tag")} title={t("voyager.tl.t2_title")} num={t("voyager.tl.t2_num")}>{t("voyager.tl.t2_body")}</FeatureRow>
          <FeatureRow tag={t("voyager.tl.t3_tag")} title={t("voyager.tl.t3_title")} num={t("voyager.tl.t3_num")}>{t("voyager.tl.t3_body")}</FeatureRow>
          <FeatureRow tag={t("voyager.tl.t4_tag")} title={t("voyager.tl.t4_title")} num={t("voyager.tl.t4_num")}>{t("voyager.tl.t4_body")}</FeatureRow>
          <FeatureRow tag={t("voyager.tl.t5_tag")} title={t("voyager.tl.t5_title")} num={t("voyager.tl.t5_num")}>{t("voyager.tl.t5_body")}</FeatureRow>
          <FeatureRow tag={t("voyager.tl.t6_tag")} title={t("voyager.tl.t6_title")} num={t("voyager.tl.t6_num")}>{t("voyager.tl.t6_body")}</FeatureRow>
        </div>
      </section>

      <section className="section" id="compare">
        <div className="wrap">
          <SectionHead eyebrow={t("voyager.s3.eyebrow")} title={t("voyager.s3.title")} />
          <CompareTable t={t} />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow={t("voyager.s4.eyebrow")} title={t("voyager.s4.title")} />
          <div className="grid cols-2">
            <div className="card">
              <div className="k">{t("voyager.rtg.v1")}</div>
              <div className="foot" style={{ marginTop: 12 }}>{t("voyager.rtg.v1Body")}</div>
            </div>
            <div className="card">
              <div className="k">{t("voyager.rtg.v2")}</div>
              <div className="foot" style={{ marginTop: 12 }}>{t("voyager.rtg.v2Body")}</div>
            </div>
          </div>
          <p className="mission-editorial-note">{t("voyager.powerNote")} <a className="section-link" href="https://science.nasa.gov/blogs/voyager/2025/03/05/nasa-turns-off-2-voyager-science-instruments-to-extend-mission/" target="_blank" rel="noopener noreferrer">{t("voyager.powerSource")} ↗</a></p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow={t("voyager.s5.eyebrow")} title={t("voyager.s5.title")} />
          <FeatureRow tag={t("voyager.gold.tag")} title={t("voyager.gold.title")} num={t("voyager.gold.num")}>{t("voyager.gold.body")}</FeatureRow>
        </div>
      </section>
    </>
  );
}
