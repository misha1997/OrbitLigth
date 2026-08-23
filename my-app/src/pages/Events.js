// Events page (events.html): next eclipse, eclipses & conjunctions lists,
// and the 7-day weekly digest. Port of app.js loadEvents.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { useApi } from "../hooks/useApi";
import { getEvents, getGrb } from "../lib/api";
import { daysUntilTxt } from "../lib/format";
import SectionHead from "../components/primitives/SectionHead";
import EventList from "../components/primitives/EventList";
import GwList from "../components/deep/GwList";

function NextEclipse({ ne, t }) {
  if (!ne) {
    return (
      <div className="card" id="next-eclipse">
        <div className="k">{t("events.next.label")}</div>
        <p style={{ color: "var(--text-dim)", marginTop: 12 }}>{t("events.next.fallback")}</p>
      </div>
    );
  }
  return (
    <div className="card" id="next-eclipse">
      <div className="k">{t("events.next.title")} <span className="dot live" /></div>
      <h3 style={{ fontSize: 20, marginTop: 14, fontWeight: 600 }}>{ne.name}</h3>
      <div className="approach" style={{ marginTop: 8 }}>{ne.date} · {daysUntilTxt(ne.days_until)}</div>
      <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 12, lineHeight: 1.5 }}>
        {t("events.next.visibility")} {ne.visibility || "—"}
      </p>
    </div>
  );
}

function GrbList({ t }) {
  const { data } = useApi(() => getGrb(12));
  const items = (data && data.items) || [];
  return (
    <div className="event-list" id="grb-list" style={{ marginTop: 14 }}>
      {!data ? (
        <div style={{ color: "var(--text-dim)", fontSize: 13 }}>{t("deep.grb.loading")}</div>
      ) : items.length === 0 ? (
        <div style={{ color: "var(--text-dim)", fontSize: 13, padding: "6px 0" }}>{t("deep.grb.empty")}</div>
      ) : items.map((g, i) => (
        <div className="event" key={i}>
          <div className="ic coral">💥</div>
          <div>
            <div className="top"><h4>{g.grb_name}</h4><span className="t">#{g.circular_id}</span></div>
            <p>{g.title || ""}</p>
            <a href={g.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--teal)" }}>{t("deep.grb.link")}</a>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Events() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.events"); }, [t]);
  const { lang } = useLang();
  const { data } = useApi(() => getEvents(lang), { deps: [lang] });
  const d = data || {};
  const eclipses = (d.eclipses || []).map((e) => ({
    emoji: "🌑", title: e.name, time: e.date,
    detail: daysUntilTxt(e.days_until) + " · " + (e.visibility || ""),
  }));
  const conjunctions = (d.conjunctions || []).map((c) => ({
    emoji: "✨", iconClass: "teal", title: c.name, time: c.date,
    detail: daysUntilTxt(c.days_until) + " · " + t("events.conjunctionSep", { sep: c.separation != null ? c.separation + "°" : "—" }),
  }));
  const weekly = (d.weekly || []).map((w) => ({
    emoji: w.icon || "•", title: w.text, time: w.date,
    detail: w.days === 0 ? t("common.days.today") : w.days === 1 ? t("common.days.tomorrow") : t("common.days.in_n", { n: w.days }),
  }));
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow">{t("events.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("events.hero.title") }} />
            <p className="hero-sub">{t("events.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#next" className="btn primary">{t("events.hero.next")}</a>
              <a href="#weekly" className="btn ghost">{t("events.hero.weekly")}</a>
            </div>
          </div>
        </div>
      </section>

      <div id="events-root">
        <section className="section" id="next" style={{ paddingTop: 8 }}>
          <div className="wrap">
            <div className="grid cols-2 split">
              {!data ? (
                <div className="card" id="next-eclipse">
                  <div className="k">{t("events.next.title")}</div>
                  <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 12 }}>{t("common.loading")}</p>
                </div>
              ) : <NextEclipse ne={d.next_eclipse} t={t} />}
              <div className="card">
                <div className="k">{t("events.what.title")}</div>
                <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 12, lineHeight: 1.6 }}>{t("events.what.body")}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <SectionHead eyebrow={t("events.s1.eyebrow")} title={t("events.s1.title")} />
            <p className="section-sub">{t("events.s1.sub")}</p>
            <div className="grid cols-2">
              <div className="card">
                <div className="k">{t("events.eclipses")}</div>
                <div style={{ marginTop: 14 }}>
                  <EventList items={eclipses} empty={data ? t("common.notFound") : t("common.loading")} />
                </div>
              </div>
              <div className="card">
                <div className="k">{t("events.conjunctions")}</div>
                <div style={{ marginTop: 14 }}>
                  <EventList items={conjunctions} empty={data ? t("common.notFound") : t("common.loading")} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="weekly" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <SectionHead gold eyebrow={t("events.s2.eyebrow")} title={t("events.s2.title")} />
            <p className="section-sub">{t("events.s2.sub")}</p>
            <div className="grid cols-2 split">
              <div className="card">
                <div className="k">{t("events.weekly")}</div>
                <div style={{ marginTop: 14 }}>
                  <EventList items={weekly} empty={data ? t("common.notFound") : t("common.loading")} />
                </div>
              </div>
              <div className="card">
                <div className="k">{t("events.supermoon")}</div>
                <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 12, lineHeight: 1.6 }}><b style={{ color: "var(--gold)" }}>{t("events.supermoonTitle")}</b>{t("events.supermoonBody")}</p>
                <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 12, lineHeight: 1.6 }}><b style={{ color: "var(--teal)" }}>{t("events.retroTitle")}</b>{t("events.retroBody")}</p>
              </div>
            </div>
          </div>
        </section>
        <section className="section" id="grb" style={{ paddingTop: 8 }}>
          <div className="wrap">
            <SectionHead eyebrow={t("deep.s2.eyebrow")} title={t("deep.s2.title")}
              linkHref="https://gcn.gsfc.nasa.gov/gcn3_archive.html" linkLabel={t("deep.s2.link")} />
            <p className="section-sub">{t("deep.s2.sub")}</p>
            <div className="grid cols-2 split">
              <div className="card">
                <div className="k">{t("deep.grb.fresh")} <span className="dot live" /></div>
                <GrbList t={t} />
              </div>
              <div className="card">
                <div className="k">{t("deep.grb.what")}</div>
                <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 12, lineHeight: 1.6 }}>{t("deep.grb.whatBody1")}</p>
                <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 12, lineHeight: 1.6 }}>{t("deep.grb.whatBody2")}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="gw" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <SectionHead eyebrow={t("deep.gw.eyebrow")} title={t("deep.gw.title")}
              linkHref="https://gcn.nasa.gov/missions/lvk" linkLabel={t("deep.gw.link_out")} />
            <p className="section-sub">{t("deep.gw.sub")}</p>
            <div className="grid cols-2 split">
              <div className="card">
                <div className="k">{t("deep.gw.fresh")} <span className="dot live" /></div>
                <GwList />
              </div>
              <div className="card">
                <div className="k">{t("deep.gw.what")}</div>
                <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 12, lineHeight: 1.6 }}>{t("deep.gw.whatBody1")}</p>
                <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 12, lineHeight: 1.6 }}>{t("deep.gw.whatBody2")}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}