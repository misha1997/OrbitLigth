// Roman mission status, launch replay, and locally mirrored NASA build photos.
import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "../styles/telescope3d.css"; // For .tele3d-hero-* (hero 3D preview + loading placeholder)
import SectionHead from "../components/primitives/SectionHead";
import Eyebrow from "../components/primitives/Eyebrow";
import LocalizedLink from "../components/primitives/LocalizedLink";
import RomanL2Orbit from "./RomanL2Orbit";
import RomanNews from "../components/RomanNews";

// three.js/@react-three/fiber/drei are heavy — lazy-load so the base page
// bundle stays light (same reasoning as Hubble.js/Jwst.js).
const RomanHeroPreview = lazy(() => import("./RomanHeroPreview"));
const RomanFullscreen = lazy(() => import("./RomanFullscreen"));

// The live-stream page the user shared (youtube.com/live/<id>) turns into the
// recorded broadcast automatically once the stream ends, so this embed stays
// valid before, during and after the actual launch.
const LAUNCH_YOUTUBE_ID = "bDjpzqRFllY";

const SCI_VALUE_STYLE = { fontSize: 20 };
const SCIENCE = ["sci1", "sci2", "sci3"];
const FACTS = ["f1", "f2", "f3", "f4", "f5", "f6"];
const VS_ROWS = ["mirror", "fov", "launch", "orbit", "role"];
const UPDATES = [
  { key: "data", date: "2026-09-25", url: "https://science.nasa.gov/blogs/roman/2026/09/25/nasas-roman-team-confirms-ground-stations-receiving-data/" },
  { key: "instruments", date: "2026-09-15", url: "https://science.nasa.gov/blogs/roman/2026/09/15/nasa-activates-romans-primary-instrument-checks-out-coronagraph/" },
  { key: "fuel", date: "2026-09-14", url: "https://science.nasa.gov/blogs/roman/2026/09/14/fuel-savings-double-potential-lifetime-for-nasas-roman-mission/" },
];
// Real NASA Image Library photos (images-api.nasa.gov), mirrored locally —
// same treatment as Hubble.js's ICONIC array. Chronological build/launch-prep
// milestones, since Roman has no in-orbit science images yet.
const ICONIC = [
  { key: "ic1", image: "/roman/images/mirror.jpg" },
  { key: "ic2", image: "/roman/images/solar_array.jpg" },
  { key: "ic3", image: "/roman/images/full_stack.jpg" },
  { key: "ic4", image: "/roman/images/arrival.jpg" },
  { key: "ic5", image: "/roman/images/encapsulation.jpg" },
  { key: "ic6", image: "/roman/images/pad.jpg" },
];

export default function Roman() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.roman"); }, [t]);
  const [show3D, setShow3D] = useState(false);

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow">{t("roman.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("roman.hero.title") }} />
            <p className="hero-sub">{t("roman.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#status" className="btn primary">{t("roman.status.cta")}</a>
              <a href="#launch" className="btn ghost">{t("roman.hero.launchCta")}</a>
              <a href="#facts" className="btn ghost">{t("roman.hero.factsCta")}</a>
            </div>
          </div>
          <Suspense fallback={<div className="tele3d-hero-placeholder"><span className="tele3d-spinner" /></div>}>
            <RomanHeroPreview onOpenFullscreen={() => setShow3D(true)} />
          </Suspense>
        </div>
      </section>

      <section className="section" id="status" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("roman.status.eyebrow")} title={t("roman.status.title")} />
          <p className="section-sub">{t("roman.status.sub")}</p>
          <p className="section-sub"><time dateTime="2026-09-28">{t("roman.status.updated")}</time></p>
          <div className="grid cols-3">
            {UPDATES.map(({ key, date, url }) => (
              <article className="card" key={key}>
                <time className="k" dateTime={date}>{t(`roman.status.${key}.date`)}</time>
                <h3 style={SCI_VALUE_STYLE}>{t(`roman.status.${key}.title`)}</h3>
                <p>{t(`roman.status.${key}.body`)}</p>
                <a href={url} className="section-link" target="_blank" rel="noopener noreferrer">{t("roman.status.source")} →</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <RomanNews />

      <section className="section" id="launch" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head" style={{ alignItems: "flex-start" }}>
            <div>
              <Eyebrow>{t("roman.launch.eyebrow")}</Eyebrow>
              <h2 className="section-title">{t("roman.launch.title")}</h2>
              <p className="section-sub">{t("roman.launch.sub")}</p>
            </div>
          </div>
          <div className="video-embed-16x9">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${LAUNCH_YOUTUBE_ID}`}
              title={t("roman.launch.title")}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <div className="grid cols-4" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="k">{t("roman.launch.dateLabel")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("roman.launch.dateValue")}</div>
            </div>
            <div className="card">
              <div className="k">{t("roman.launch.timeLabel")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("roman.launch.timeValue")}</div>
            </div>
            <div className="card">
              <div className="k">{t("roman.launch.vehicleLabel")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("roman.launch.vehicleValue")}</div>
            </div>
            <div className="card">
              <div className="k">{t("roman.launch.padLabel")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("roman.launch.padValue")}</div>
            </div>
          </div>
          <p className="section-sub" style={{ marginTop: 14, marginBottom: 0 }}>{t("roman.launch.note")}</p>
          <a className="section-link" href="https://science.nasa.gov/mission/roman-space-telescope/roman-launch/" target="_blank" rel="noopener noreferrer">{t("roman.status.source")} →</a>
        </div>
      </section>

      <section className="section" id="orbit" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("roman.orbit.eyebrow") || "Орбітальна траєкторія"} title={t("roman.orbit.title") || "Точка Лагранжа L2"} />
          <p className="section-sub">{t("roman.orbit.sub") || "Nancy Grace Roman буде розташований на гало-орбіті навколо другої точки Лагранжа (L2), на відстані 1.5 млн км від Землі."}</p>
          <RomanL2Orbit />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("roman.s1.eyebrow")} title={t("roman.s1.title")} />
          <div className="grid cols-4">
            <div className="card">
              <div className="k">{t("roman.card.mirror")}</div>
              <div className="v">2.4<span className="unit">{t("roman.card.mirrorUnit")}</span></div>
              <div className="foot">{t("roman.card.mirrorFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("roman.card.fov")}</div>
              <div className="v">100<span className="unit">{t("roman.card.fovUnit")}</span></div>
              <div className="foot">{t("roman.card.fovFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("roman.card.distance")}</div>
              <div className="v">1.5<span className="unit">{t("roman.card.distanceUnit")}</span></div>
              <div className="foot">{t("roman.card.distanceFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("roman.card.lifespan")}</div>
              <div className="v">5<span className="unit">{t("roman.card.lifespanUnit")}</span></div>
              <div className="foot">{t("roman.card.lifespanFoot")}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="gallery" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("roman.iconic.eyebrow")} title={t("roman.iconic.title")} />
          <div className="grid cols-3">
            {ICONIC.map((g) => (
              <div className="iconic-img-card" key={g.key}>
                <div className="photo" style={{ backgroundImage: `url(${g.image})` }}>
                  <span className="tag">{t(`roman.iconic.${g.key}_tag`)}</span>
                </div>
                <div className="body">
                  <h4>{t(`roman.iconic.${g.key}_title`)}</h4>
                  <p>{t(`roman.iconic.${g.key}_body`)}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="section-sub" style={{ marginTop: 14, marginBottom: 0 }}>{t("roman.iconic.credit")}</p>
        </div>
      </section>

      <section className="section" id="vs-hubble" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("roman.vsHubble.eyebrow")} title={t("roman.vsHubble.title")} />
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("roman.vsHubble.param")}</th>
                  <th>{t("roman.vsHubble.romanCol")}</th>
                  <th>{t("roman.vsHubble.hubbleCol")}</th>
                </tr>
              </thead>
              <tbody>
                {VS_ROWS.map((r) => (
                  <tr key={r}>
                    <td>{t(`roman.vsHubble.${r}_label`)}</td>
                    <td className="mono">{t(`roman.vsHubble.${r}_roman`)}</td>
                    <td className="mono">{t(`roman.vsHubble.${r}_hubble`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="section-sub" style={{ marginTop: 14, marginBottom: 0 }}>
            {t("roman.vsHubble.note")} <LocalizedLink to="hubble" className="section-link">{t("roman.vsHubble.hubbleLink")} →</LocalizedLink>
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("roman.science.eyebrow")} title={t("roman.science.title")} />
          <div className="grid cols-3">
            {SCIENCE.map((s) => (
              <div className="card" key={s}>
                <div className="k">{t(`roman.science.${s}_title`)}</div>
                <div className="v" style={SCI_VALUE_STYLE}>{t(`roman.science.${s}_value`)}</div>
                <div className="foot">{t(`roman.science.${s}_body`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("roman.instruments.eyebrow")} title={t("roman.instruments.title")} />
          <p className="section-sub">{t("roman.instruments.sub")}</p>
          <div className="grid cols-2">
            <div className="card">
              <div className="k">{t("roman.instruments.wfi_title")}</div>
              <div className="v" style={{ fontSize: "1rem", lineHeight: 1.4, color: "var(--text)", marginTop: 8, fontWeight: 400 }}>{t("roman.instruments.wfi_body")}</div>
            </div>
            <div className="card">
              <div className="k">{t("roman.instruments.cgi_title")}</div>
              <div className="v" style={{ fontSize: "1rem", lineHeight: 1.4, color: "var(--text)", marginTop: 8, fontWeight: 400 }}>{t("roman.instruments.cgi_body")}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="facts" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("roman.facts.eyebrow")} title={t("roman.facts.title")} />
          <p className="section-sub">{t("roman.facts.sub")}</p>
          <div className="grid cols-3">
            {FACTS.map((f) => (
              <div className="card" key={f}>
                <div className="v" style={{ fontSize: "1.2rem", marginBottom: 8, color: "var(--accent)" }}>{t(`roman.facts.${f}_title`)}</div>
                <div style={{ fontSize: "1rem", lineHeight: 1.4, color: "var(--text)", fontWeight: 400, textTransform: "none" }}>{t(`roman.facts.${f}_body`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {show3D && (
        <Suspense fallback={null}>
          <RomanFullscreen onClose={() => setShow3D(false)} />
        </Suspense>
      )}
    </>
  );
}
