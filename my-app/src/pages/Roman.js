import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSeo } from "../hooks/useSeo";
import SectionHead from "../components/primitives/SectionHead";
import LocalizedLink from "../components/primitives/LocalizedLink";
import RomanL2Orbit from "./RomanL2Orbit";
import RomanNews from "../components/RomanNews";
import MissionReadingGuide from "../components/missions/MissionReadingGuide";
import "../styles/telescope3d.css";
import "../styles/mission-editorial.css";

const RomanHeroPreview = lazy(() => import("./RomanHeroPreview"));
const RomanFullscreen = lazy(() => import("./RomanFullscreen"));
const UPDATES = [
  { key: "commissioning", date: "2026-10-22", url: "https://science.nasa.gov/blogs/roman/2026/10/22/nasas-roman-space-telescope-enters-final-commissioning-phase/" },
  { key: "focus", date: "2026-10-14", url: "https://science.nasa.gov/blogs/roman/2026/10/14/nasa-roman-team-checks-out-main-instrument-sharpens-telescopes-focus/" },
  { key: "data", date: "2026-09-25", url: "https://science.nasa.gov/blogs/roman/2026/09/25/nasas-roman-team-confirms-ground-stations-receiving-data/" },
];
const ICONIC = [{ key: "ic1", image: "mirror.jpg" }, { key: "ic3", image: "full_stack.jpg" }, { key: "ic6", image: "pad.jpg" }];
const SOURCES = [
  ["NASA · Roman", "https://science.nasa.gov/mission/roman-space-telescope/"],
  ["NASA · Commissioning", UPDATES[0].url],
  ["NASA · Core Community Surveys", "https://science.nasa.gov/mission/roman-space-telescope/core-community-surveys/"],
  ["NASA · Observatory technical details", "https://science.nasa.gov/mission/roman-space-telescope/observatory-technical/"],
  ["NASA · Fuel and transfer trajectory", "https://science.nasa.gov/blogs/roman/2026/09/14/fuel-savings-double-potential-lifetime-for-nasas-roman-mission/"],
];

export default function Roman() {
  const { t } = useTranslation();
  useSeo();
  const [show3D, setShow3D] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const surveys = t("roman.surveys.items", { returnObjects: true });
  return <>
    <section className="hero"><div className="wrap hero-grid">
      <div style={{ maxWidth: 680 }}>
        <LocalizedLink to="missions" className="section-link">← {t("missionDetail.ui.back")}</LocalizedLink>
        <p className="eyebrow">{t("roman.hero.eyebrow")}</p>
        <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("roman.hero.title") }} />
        <p className="hero-sub">{t("roman.hero.sub")}</p>
        <div className="hero-actions"><a href="#status" className="btn primary">{t("roman.status.cta")}</a><a href="#science" className="btn ghost">{t("roman.surveys.cta")}</a></div>
      </div>
      <Suspense fallback={<div className="tele3d-hero-placeholder"><span className="tele3d-spinner" /></div>}><RomanHeroPreview onOpenFullscreen={() => setShow3D(true)} /></Suspense>
    </div></section>
    <nav className="wrap mission-editorial-nav" aria-label={t("missionDetail.ui.sections")}>
      {[["facts", t("roman.hero.factsCta")], ["status", t("roman.status.cta")], ["science", t("roman.surveys.cta")], ["instruments", t("roman.instruments.title")], ["orbit", "L2"], ["gallery", t("missionDetail.ui.gallery")], ["sources", t("missionDetail.ui.sources")]].map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}
    </nav>
    <section className="section" id="facts"><div className="wrap"><SectionHead eyebrow={t("roman.s1.eyebrow")} title={t("roman.s1.title")} />
      <div className="grid cols-4">{[["mirror", "2.4"], ["fov", "100"], ["distance", "1.5"], ["lifespan", "5"]].map(([key, value]) => <div className="card" key={key}><div className="k">{t(`roman.card.${key}`)}</div><div className="v">{value}<span className="unit">{t(`roman.card.${key}Unit`)}</span></div><p className="foot">{t(`roman.card.${key}Foot`)}</p></div>)}</div>
    </div></section>
    <section className="section" id="status"><div className="wrap">
      <SectionHead eyebrow={t("roman.status.eyebrow")} title={t("roman.status.title")} sub={t("roman.status.sub")} />
      <p className="mission-editorial-note"><time dateTime="2026-10-30">{t("roman.status.updated")}</time></p>
      <div className="grid cols-3">{UPDATES.map(({ key, date, url }) => <article className="card" key={key}><time className="k" dateTime={date}>{t(`roman.status.${key}.date`)}</time><h3>{t(`roman.status.${key}.title`)}</h3><p>{t(`roman.status.${key}.body`)}</p><a href={url} className="section-link" target="_blank" rel="noopener noreferrer">{t("roman.status.source")} ↗</a></article>)}</div>
    </div></section>
    <section className="section" id="science"><div className="wrap">
      <SectionHead eyebrow={t("roman.science.eyebrow")} title={t("roman.surveys.title")} sub={t("roman.surveys.intro")} />
      <div className="grid cols-3">{surveys.map(item => <article className="card" key={item.title}><h3>{item.title}</h3><p className="mission-editorial-highlight">{item.method}</p><p>{item.body}</p></article>)}</div>
      <p className="mission-editorial-note">{t("roman.surveys.note")} <a className="section-link" href={SOURCES[2][1]} target="_blank" rel="noopener noreferrer">NASA ↗</a></p>
    </div></section>
    <section className="section" id="instruments"><div className="wrap"><SectionHead eyebrow={t("roman.instruments.eyebrow")} title={t("roman.instruments.title")} sub={t("roman.instruments.sub")} />
      <div className="grid cols-2">{["wfi", "cgi"].map(key => <article className="card" key={key}><h3>{t(`roman.instruments.${key}_title`)}</h3><p>{t(`roman.instruments.${key}_body`)}</p></article>)}</div>
    </div></section>
    <section className="section" id="orbit"><div className="wrap"><SectionHead eyebrow={t("roman.orbit.eyebrow")} title={t("roman.orbit.title")} sub={t("roman.orbit.sub")} /><RomanL2Orbit /></div></section>
    <MissionReadingGuide mission="roman" />
    <section className="section" id="gallery"><div className="wrap"><SectionHead eyebrow={t("roman.iconic.eyebrow")} title={t("roman.iconic.title")} />
      <div className="grid cols-3">{ICONIC.map(g => <figure className="iconic-img-card" key={g.key}><img className="mission-editorial-photo" src={`/roman/images/${g.image}`} width="640" height="420" loading="lazy" decoding="async" alt={t(`roman.iconic.${g.key}_title`)} /><figcaption className="body"><p className="k">{t(`roman.iconic.${g.key}_tag`)}</p><h3>{t(`roman.iconic.${g.key}_title`)}</h3><p>{t(`roman.iconic.${g.key}_body`)}</p></figcaption></figure>)}</div>
      <p className="mission-editorial-note">{t("roman.iconic.note")} · {t("roman.iconic.credit")}</p>
    </div></section>
    <section className="section" id="launch"><div className="wrap">
      <details className="mission-editorial-disclosure card" onToggle={event => setShowReplay(event.currentTarget.open)}><summary>{t("roman.launch.title")} · {t("roman.launch.dateValue")}</summary>
        <p>{t("roman.launch.sub")}</p><p className="mission-editorial-note">{t("roman.launch.note")}</p>
        {showReplay && <div className="video-embed-16x9"><iframe src="https://www.youtube-nocookie.com/embed/bDjpzqRFllY" title={t("roman.launch.title")} loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>}
        <a className="section-link" href="https://science.nasa.gov/mission/roman-space-telescope/roman-launch/" target="_blank" rel="noopener noreferrer">NASA · {t("roman.launch.eyebrow")} ↗</a>
      </details>
    </div></section>
    <RomanNews />
    <section className="section" id="sources"><div className="wrap"><SectionHead title={t("missionDetail.ui.sources")} /><ul className="mission-editorial-sources">{SOURCES.map(([label, url]) => <li key={url}><a className="section-link" href={url} target="_blank" rel="noopener noreferrer">{label} ↗</a></li>)}</ul><LocalizedLink to="hubble" className="btn ghost">{t("roman.vsHubble.hubbleLink")} →</LocalizedLink></div></section>
    {show3D && <Suspense fallback={null}><RomanFullscreen onClose={() => setShow3D(false)} /></Suspense>}
  </>;
}
