import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSeo } from "../../hooks/useSeo";
import SectionHead from "../primitives/SectionHead";
import LocalizedLink from "../primitives/LocalizedLink";
import { MISSION_DETAILS } from "../../lib/missionDetails";
import MissionDiagram from "./MissionDiagram";
import "../../styles/mission-detail.css";
import "../../styles/telescope3d.css";

const MissionModelViewer = lazy(() => import("./MissionModelViewer"));

export default function MissionDetail({ mission }) {
  const { t } = useTranslation();
  useSeo();
  const data = MISSION_DETAILS[mission];
  const content = t(`missionDetail.${mission}`, { returnObjects: true });
  const ui = t("missionDetail.ui", { returnObjects: true });
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

      <section className="section" id="trajectory">
        <div className="wrap">
          <SectionHead eyebrow={ui.trajectory} title={content.orbit.title} sub={content.orbit.body} />
          <MissionDiagram mission={mission} labels={content.orbit.labels} note={ui.schematic} />
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

      <section className="section" id="instruments">
        <div className="wrap">
          <SectionHead eyebrow={ui.technology} title={ui.instruments} sub={content.instrumentIntro} />
          <div className="grid cols-4">
            {content.instruments.map((instrument) => (
              <article className="card mission-instrument" key={instrument.name}>
                <h3>{instrument.name}</h3>
                <p>{instrument.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="gallery">
        <div className="wrap">
          <SectionHead eyebrow={ui.discoveries} title={content.galleryTitle} sub={content.galleryIntro} />
          <div className="grid cols-3">
            {data.gallery.map((photo, index) => (
              <article className="iconic-img-card mission-gallery-card" key={photo.image}>
                <button type="button" className="mission-photo-button" onClick={() => setPhotoIndex(index)} aria-label={`${ui.enlarge}: ${content.gallery[index].title}`}>
                  <img src={photo.image} alt={content.gallery[index].alt} width="640" height="480" loading="lazy" decoding="async" />
                  <span aria-hidden="true">↗</span>
                </button>
                <div className="body">
                  <h3>{content.gallery[index].title}</h3>
                  <p>{content.gallery[index].body}</p>
                  <small className="mission-credit">{photo.credit}</small>
                  <a href={photo.source} className="section-link" target="_blank" rel="noopener noreferrer">{ui.imageSource} ↗</a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

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
            <p className="mission-credit">{data.gallery[photoIndex].credit}</p>
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
