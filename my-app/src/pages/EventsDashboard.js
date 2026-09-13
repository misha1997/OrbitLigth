import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { useApi } from "../hooks/useApi";
import { getEvents, getGrb, getGw } from "../lib/api";
import { daysUntilTxt } from "../lib/format";
import SectionHead from "../components/primitives/SectionHead";
import EclipseMap from "../components/events/EclipseMap";
import EclipseMapFullscreen from "../components/events/EclipseMapFullscreen";
import EclipseGraphic from "../components/events/EclipseGraphic";
import { GrbStatsChart, GwClassificationChart } from "../components/events/AlertCharts";

function Metric({ label, value, detail, tone = "teal" }) {
  return (
    <div className={`events-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function GrbTable({ data, error, t }) {
  const items = data?.items || [];
  if (error) return <div className="events-empty">{t("events.charts.error")}</div>;
  if (!data) return <div className="events-empty">{t("deep.grb.loading")}</div>;
  if (!items.length) return <div className="events-empty">{t("deep.grb.empty")}</div>;

  return (
    <div className="events-data-table" role="table" aria-label={t("events.table.grbLabel")}>
      <div className="events-table-head" role="row">
        <span>{t("events.table.event")}</span>
        <span>{t("events.table.notice")}</span>
        <span>{t("events.table.source")}</span>
      </div>
      {items.map((item) => (
        <div className="events-table-row" role="row" key={item.circular_id}>
          <div>
            <strong>{item.grb_name}</strong>
            <span>{item.title || t("events.table.noTitle")}</span>
          </div>
          <code>GCN {item.circular_id}</code>
          <a href={item.url} target="_blank" rel="noopener noreferrer">{t("deep.grb.link")}</a>
        </div>
      ))}
    </div>
  );
}

function farLabel(far, t) {
  if (!far || Number(far) <= 0) return "—";
  const years = 1 / (Number(far) * 31557600);
  return years >= 1
    ? `${years.toLocaleString(undefined, { maximumFractionDigits: years >= 100 ? 0 : 1 })} ${t("events.gw.years")}`
    : t("events.gw.lessThanYear");
}

function GwTable({ data, t }) {
  const items = data?.items || [];
  if (data?.configured === false) return <div className="events-empty">{t("deep.gw.notConfigured")}</div>;
  if (!data) return <div className="events-empty">{t("deep.gw.loading")}</div>;
  if (!items.length) return <div className="events-empty">{t("deep.gw.empty")}</div>;

  return (
    <div className="events-data-table" role="table" aria-label={t("events.table.gwLabel")}>
      <div className="events-table-head" role="row">
        <span>{t("events.table.event")}</span>
        <span>{t("events.table.signal")}</span>
        <span>{t("events.table.detectors")}</span>
      </div>
      {items.map((item) => (
        <div className="events-table-row gw-row" role="row" key={`${item.superevent_id}-${item.alert_type}`}>
          <div>
            <strong>{item.superevent_id}</strong>
            <span>{item.event_time || "—"} · {t(`deep.gw.type.${item.alert_type || "UPDATE"}`)}</span>
          </div>
          <div>
            <strong>{item.top_class ? t(`deep.gw.class.${item.top_class}`, { defaultValue: item.top_class }) : "—"}</strong>
            <span>{t("deep.gw.far")}: {farLabel(item.far, t)}</span>
          </div>
          <span>{item.instruments?.join(" · ") || "—"}</span>
        </div>
      ))}
    </div>
  );
}

function NextEvent({ event, t }) {
  if (!event) return <div className="events-next-empty">{t("events.next.fallback")}</div>;
  return (
    <div className="events-next-event">
      <div className="events-next-graphic">
        <EclipseGraphic type={event.type} size={84} />
      </div>
      <div className="events-next-date"><span>{event.date}</span><b>{daysUntilTxt(event.days_until)}</b></div>
      <div className="events-next-info">
        <span className="events-label">{t("events.next.title")}</span>
        <h2>{event.name}</h2>
        <p>{t("events.next.visibility")} {event.visibility || "—"}</p>
      </div>
    </div>
  );
}

export default function EventsDashboard() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { data: events } = useApi(() => getEvents(lang), { deps: [lang] });
  const { data: grbData, error: grbError } = useApi(() => getGrb(12));
  const { data: gwData } = useApi(() => getGw(12));
  const d = events || {};
  useEffect(() => { document.title = t("title.events"); }, [t]);

  const allEvents = [
    ...(d.eclipses || []).map((e) => ({ ...e, kind: "eclipse", detail: e.visibility || "—", emoji: "🌑" })),
    ...(d.conjunctions || []).map((e) => ({ ...e, kind: "conjunction", detail: t("events.conjunctionSep", { sep: e.separation != null ? `${e.separation}°` : "—" }), emoji: "✨" })),
    ...(d.weekly || []).map((e) => ({
      ...e,
      kind: "weekly",
      name: e.text,
      emoji: e.icon || "•",
      detail: e.days === 0 ? t("common.days.today") : e.days === 1 ? t("common.days.tomorrow") : t("common.days.in_n", { n: e.days }),
      days_until: e.days
    })),
  ].sort((a, b) => (a.days_until || 0) - (b.days_until || 0));
  
  const calendarCount = allEvents.length;
  const [showFsMap, setShowFsMap] = useState(false);

  return (
    <>
      <section className="hero events-hero">
        <div className="wrap">
          <div className="events-hero-copy">
            <div className="eyebrow">{t("events.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("events.hero.title") }} />
            <p className="hero-sub">{t("events.hero.sub")}</p>
          </div>
          <div className="events-hero-index"><span>{t("events.dashboard.index")}</span><strong>09·13</strong><small>{t("events.dashboard.updated")}</small></div>
        </div>
      </section>

      <main id="events-root" className="events-dashboard">
        <section className="section events-overview" id="next">
          <div className="wrap">
            <div className="events-overview-grid">
              <div className="events-next-panel">
                <div className="events-panel-kicker"><span className="status-mark" />{t("events.dashboard.nextSignal")}</div>
                <NextEvent event={d.next_eclipse} t={t} />
              </div>
              <div className="events-metrics">
                <Metric label={t("events.dashboard.calendar")} value={calendarCount || "—"} detail={t("events.dashboard.calendarDetail")} />
                <Metric label={t("events.dashboard.grb")} value={grbData?.count ?? "—"} detail={t("events.dashboard.grbDetail")} tone="coral" />
                <Metric label={t("events.dashboard.gw")} value={gwData?.count ?? "—"} detail={t("events.dashboard.gwDetail")} tone="gold" />
              </div>
            </div>
          </div>
        </section>

        <section className="section events-calendar-section">
          <div className="wrap">
            <SectionHead eyebrow={t("events.s1.eyebrow")} title={t("events.s1.title")} />
            
            <div className="events-agenda-layout">
              {allEvents.length > 0 ? (
                allEvents.map((event, i) => (
                  <div key={i} className={`agenda-row ${event.kind}`}>
                    <div className="agenda-date-col">
                      <span className="agenda-day">{event.date.split('.')[0]}</span>
                      <span className="agenda-month">{event.date.split('.')[1]}</span>
                    </div>
                    <div className="agenda-divider" />
                    <div className="agenda-main-col">
                       <div className="agenda-head">
                          <span className="agenda-emoji">{event.emoji || '✨'}</span>
                          <span className="agenda-kicker">{t(`events.timeline.${event.kind}`)}</span>
                       </div>
                       <h3>{event.title || event.name}</h3>
                       <p>{event.detail}</p>
                    </div>
                    <div className="agenda-time-col">
                       <strong>{event.days_until !== undefined ? daysUntilTxt(event.days_until) : event.time}</strong>
                    </div>
                  </div>
                ))
              ) : (
                <div className="events-empty-state">
                  {events ? t("common.notFound") : t("common.loading")}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="section events-map-section" id="eclipse-map" style={{ paddingTop: 8 }}>
          <div className="wrap">
            <SectionHead
              eyebrow={lang === "en" ? "Interactive Map" : "Інтерактивна мапа"}
              title={lang === "en" ? "Eclipse Corridors & Observation" : "Географія затемнень та смуги повної фази"}
            />
            <div className="map-card">
              <EclipseMap events={allEvents} onTriggerFullscreen={() => setShowFsMap(true)} />
            </div>
          </div>
        </section>

        {showFsMap && (
          <EclipseMapFullscreen
            events={allEvents}
            lang={lang}
            onClose={() => setShowFsMap(false)}
          />
        )}

        <section className="section events-alert-section" id="grb">
          <div className="wrap">
            <SectionHead eyebrow={t("deep.s2.eyebrow")} title={t("deep.s2.title")} linkHref="https://gcn.nasa.gov/circulars" linkLabel={t("deep.s2.link")} />
            <div className="events-alert-layout">
              <div className="events-alert-panel">
                <div className="events-card-head"><div><span className="events-label">{t("deep.grb.fresh")}</span><h3>{t("events.table.grbTitle")}</h3></div><span className="events-live-chip">LIVE</span></div>
                <GrbTable data={grbData} error={grbError} t={t} />
              </div>
              <aside className="events-insight-panel">
                <div className="k">{t("events.charts.grbTitle")}</div>
                <GrbStatsChart stats={grbData?.stats} />
                <div className="events-info-card">
                  <div className="events-info-title">
                    <span className="icon">ℹ️</span>
                    <strong>GRB (Гамма-сплески)</strong>
                  </div>
                  <p>{t("deep.grb.whatBody2")}</p>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="section events-alert-section" id="gw">
          <div className="wrap">
            <SectionHead eyebrow={t("deep.gw.eyebrow")} title={t("deep.gw.title")} linkHref="https://gcn.nasa.gov/" linkLabel={t("deep.gw.link_out")} />
            <div className="events-alert-layout gw-layout">
              <div className="events-alert-panel">
                <div className="events-card-head"><div><span className="events-label">{t("deep.gw.fresh")}</span><h3>{t("events.table.gwTitle")}</h3></div><span className="events-live-chip teal">GCN</span></div>
                <GwTable data={gwData} t={t} />
              </div>
              <aside className="events-insight-panel">
                <div className="k">{t("events.charts.gwTitle")}</div>
                <GwClassificationChart items={gwData?.items} />
                <div className="events-info-card">
                  <div className="events-info-title">
                    <span className="icon">🌊</span>
                    <strong>GW (Гравітаційні хвилі)</strong>
                  </div>
                  <p>{t("deep.gw.whatBody2")}</p>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
