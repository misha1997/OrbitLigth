// Nancy Grace Roman Space Telescope page: hero with a live auto-rotating 3D
// preview (fullscreen free-orbit viewer on click), an embedded launch
// livestream, mission stats, real build/launch-prep photos (Roman hasn't
// launched yet, so there's no MAST science-imagery gallery like
// Hubble.js/Jwst.js — these are curated NASA Image Library photos instead,
// mirrored locally the same way Hubble.js's ICONIC images are), a vs-Hubble
// comparison table, science goals, instruments, and facts.
import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "../styles/telescope3d.css"; // For .tele3d-hero-* (hero 3D preview + loading placeholder)
import SectionHead from "../components/primitives/SectionHead";
import Eyebrow from "../components/primitives/Eyebrow";
import LocalizedLink from "../components/primitives/LocalizedLink";
import RomanCountdown from "../components/RomanCountdown";

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
            <div className="eyebrow"><span className="dot live" /> {t("roman.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("roman.hero.title") }} />
            <p className="hero-sub">{t("roman.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#launch" className="btn primary">{t("roman.hero.launchCta")}</a>
              <a href="#facts" className="btn ghost">{t("roman.hero.factsCta")}</a>
            </div>
          </div>
          <Suspense fallback={<div className="tele3d-hero-placeholder"><span className="tele3d-spinner" /></div>}>
            <RomanHeroPreview onOpenFullscreen={() => setShow3D(true)} />
          </Suspense>
        </div>
      </section>

      <section className="section" id="launch" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <div className="section-head" style={{ alignItems: "flex-start" }}>
            <div>
              <Eyebrow>{t("roman.launch.eyebrow")}</Eyebrow>
              <h2 className="section-title">{t("roman.launch.title")}</h2>
              <p className="section-sub">{t("roman.launch.sub")}</p>
            </div>
            <RomanCountdown />
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
