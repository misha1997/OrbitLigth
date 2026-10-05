import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSeo } from "../../hooks/useSeo";
import SectionHead from "../primitives/SectionHead";
import LocalizedLink from "../primitives/LocalizedLink";
import { MISSION_DETAILS } from "../../lib/missionDetails";
import { useApi } from "../../hooks/useApi";
import MissionOrbitExplorer from "./MissionOrbitExplorer";
import { MissionTelemetry, MissionContact, SignalCalculator } from "./MissionLiveData";
import MissionNews from "./MissionNews";
import "../../styles/mission-detail.css";
import "../../styles/telescope3d.css";

const MissionModelViewer = lazy(() => import("./MissionModelViewer"));

export default function MissionDetail({ mission }) {
  const { t } = useTranslation();
  useSeo();
  const data = MISSION_DETAILS[mission];
  const content = t(`missionDetail.${mission}`, { returnObjects: true });
  const ui = t("missionDetail.ui", { returnObjects: true });
  const ephemeris = useApi(`/api/missions/${mission}/ephemeris`, { deps: [mission], interval: 3600000 });
  const [photoIndex, setPhotoIndex] = useState(null);
  const dialog = useRef(null);
  const isPhotoOpen = photoIndex !== null;

  useEffect(() => {
    if (!isPhotoOpen) return;
    const modal = dialog.current;
    const previousOverflow = document.body.style.overflow;
    modal.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      modal.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isPhotoOpen]);

  const changePhoto = (direction) => setPhotoIndex((index) =>
    index === null ? null : (index + direction + data.gallery.length) % data.gallery.length
  );

  return (
    <div className={`mission-detail mission-detail--${mission}`} style={{ "--mission-accent": data.accent }}>
      <section className="hero">
        <div className="wrap">
          <LocalizedLink to="missions" className="section-link mission-back">← {ui.back}</LocalizedLink>
          <div className="hero-grid">
            <div>
              <div className="eyebrow">{content.eyebrow}</div>
              <h1 className="hero-title">{content.name}<br /><span className="accent">{content.tagline}</span></h1>
              <p className="hero-sub">{content.intro}</p>
              <div className="hero-actions">
                <a href="#facts" className="btn primary">{ui.facts}</a>
                <a href="#gallery" className="btn ghost">{ui.gallery}</a>
              </div>
            </div>
            <Suspense fallback={<div className="tele3d-hero-placeholder" role="status" aria-label={ui.model.loading}><span className="tele3d-spinner" /></div>}>
              <MissionModelViewer key={mission} model={data.model} name={content.name} stats={content.stats} ui={ui.model} fallbackImage={data.hero} fallbackAlt={content.heroAlt} />
            </Suspense>
          </div>
        </div>
      </section>

      <nav className="wrap mission-section-nav" aria-label={ui.sections}>
        {[["live", ui.live.title], ["trajectory", ui.trajectory], ["science", content.scienceTitle || ui.science], ["instruments", ui.instruments], ["communication", ui.communication], ["news", ui.news.title]].map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
      </nav>

      <section className="section" id="facts">
        <div className="wrap">
          <SectionHead eyebrow={ui.overview} title={ui.facts} />
          <div className="grid cols-4">
            {content.stats.map((stat) => (
              <div className="card" key={stat.label}>
                <div className="k">{stat.label}</div>
                <div className="v mission-stat">{stat.value}</div>
                <div className="foot">{stat.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MissionTelemetry mission={mission} {...ephemeris} />

      <section className="section" id="trajectory">
        <div className="wrap">
          <SectionHead eyebrow={ui.trajectory} title={content.orbit.title} sub={content.orbit.body} />
          <MissionOrbitExplorer mission={mission} {...ephemeris} content={content} accent={data.accent} />
        </div>
      </section>

      <section className="section" id="timeline">
        <div className="wrap">
          <SectionHead eyebrow={ui.history} title={ui.timeline} />
          <ol className="mission-timeline">
            {content.timeline.map((event) => (
              <li key={event.date}>
                <time dateTime={event.date}>{event.displayDate}</time>
                <h3>{event.title}</h3>
                <p>{event.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" id="science"><div className="wrap">
        <SectionHead eyebrow={content.scienceEyebrow || ui.discoveries} title={content.scienceTitle || ui.science} sub={content.scienceIntro} />
        <div className="grid cols-3">{content.science.map((item, index) => <article className="card mission-science" key={item.title}><span className="mission-science-number">0{index + 1}</span><h3>{item.title}</h3><p>{item.body}</p><a href={item.source} target="_blank" rel="noopener noreferrer" className="section-link">{ui.readResearch} ↗</a></article>)}</div>
      </div></section>

      <section className="section" id="instruments">
        <div className="wrap">
          <SectionHead eyebrow={ui.technology} title={ui.instruments} sub={content.instrumentIntro} />
          <div className="grid cols-4">
            {content.instruments.map((instrument, index) => (
              <article className="card mission-instrument" key={instrument.name}>
                <h3>{instrument.name}</h3>
                <p>{instrument.body}</p>
                <details><summary>{ui.howItWorks}</summary><p>{content.instrumentDetails[index]}</p></details>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="communication"><div className="wrap">
        <SectionHead eyebrow={ui.contact.eyebrow} title={ui.communication} />
        <div className="mission-two-columns"><MissionContact mission={mission} /><SignalCalculator mission={mission} data={ephemeris.data} /></div>
      </div></section>

      <section className="section" id="questions"><div className="wrap">
        <SectionHead title={ui.questions} />
        <div className="mission-faq">{content.faq.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
      </div></section>

      <section className="section" id="gallery">
        <div className="wrap">
          <SectionHead eyebrow={ui.discoveries} title={content.galleryTitle} sub={content.galleryIntro} />
          <div className="grid cols-3">
            {data.gallery.map((photo, index) => (
              <article className="iconic-img-card mission-gallery-card" key={photo.image}>
                <button type="button" className="photo mission-photo-button" onClick={() => setPhotoIndex(index)} aria-label={`${ui.enlarge}: ${content.gallery[index].title}`}>
                  <img src={photo.image} alt={content.gallery[index].alt} width="640" height="480" loading="lazy" decoding="async" />
                  <span className="tag">{photo.year}</span>
                </button>
                <div className="body">
                  <h4>{content.gallery[index].title}</h4>
                  <p>{content.gallery[index].body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <MissionNews mission={mission} />

      <section className="section mission-sources" id="sources">
        <div className="wrap">
          <SectionHead title={ui.sources} sub={ui.sourceNote} />
          <ul>
            {data.sources.map((source) => <li key={source.url}><a className="section-link" href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a></li>)}
          </ul>
          <LocalizedLink to="missions" className="btn ghost">← {ui.back}</LocalizedLink>
        </div>
      </section>

      {photoIndex !== null && (
        <dialog ref={dialog} className="mission-lightbox" aria-label={content.gallery[photoIndex].title}
          onCancel={() => setPhotoIndex(null)} onClose={() => setPhotoIndex(null)}
          onClick={(event) => { if (event.target === event.currentTarget) setPhotoIndex(null); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              changePhoto(event.key === "ArrowLeft" ? -1 : 1);
            }
          }}>
          <div className="mission-lightbox-content">
            <button type="button" className="btn ghost mission-lightbox-close" onClick={() => setPhotoIndex(null)} aria-label={ui.close}>✕</button>
            <img src={data.gallery[photoIndex].image} alt={content.gallery[photoIndex].alt} />
            <h2>{content.gallery[photoIndex].title}</h2>
            <p className="mission-lightbox-description">{content.gallery[photoIndex].body}</p>
            <p className="mission-credit">{data.gallery[photoIndex].credit}</p>
            <a href={data.gallery[photoIndex].source} className="section-link" target="_blank" rel="noopener noreferrer">{ui.imageSource} ↗</a>
            <div className="mission-lightbox-nav">
              <button type="button" className="btn ghost" onClick={() => changePhoto(-1)} aria-label={ui.previous}>←</button>
              <span aria-live="polite">{photoIndex + 1} / {data.gallery.length}</span>
              <button type="button" className="btn ghost" onClick={() => changePhoto(1)} aria-label={ui.next}>→</button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
