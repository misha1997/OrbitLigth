// ISS page (iss.html): live map (SatMap follow+track) with the header coords
// line + speed/altitude cards fed from the in-browser TLE propagation, the
// orbit-numbers grid (incl. crew from /api/iss/crew), the visible-passes table
// (/api/iss/passes), and observing tips. Port of the iss.html inline script.
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import "../styles/gallery.css"; // For .photo-modal
import "../styles/iss3d.css"; // For .iss3d-hero-* (hero 3D preview + loading placeholder)
import SatMap from "../components/SatMap";
import SectionHead from "../components/primitives/SectionHead";
import FeatureRow from "../components/primitives/FeatureRow";
import { useApi } from "../hooks/useApi";
import { useLoc, locCity } from "../context/LocationContext";
import { getIssPasses, getIssCrew, getIssNow } from "../lib/api";
import { fmtInt } from "../lib/format";

const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// three.js/@react-three/fiber/drei are heavy and otherwise only loaded by
// /solarsystem3d — lazy-import so visiting /mks doesn't pull them in unless
// the 3D viewer is actually opened.
const IssStationFullscreen = lazy(() => import("./IssStationFullscreen"));
const IssStationHeroPreview = lazy(() => import("./IssStationHeroPreview"));

// Real orbital elements read straight off the TLE-derived satrec (satellite.js
// v5, sgp4init) — no propagation needed, these are the fixed elements for the
// current TLE epoch. WGS72 Earth radius (6378.135 km) matches the constant
// satellite.js itself uses internally, so satrec.a/alta/altp convert cleanly.
const EARTH_RADIUS_KM = 6378.135;
function issOrbitalElements(satrec) {
  if (!satrec) return null;
  return {
    incDeg: satrec.inclo * (180 / Math.PI),
    ecc: satrec.ecco,
    periodMin: (2 * Math.PI) / satrec.no,
    revPerDay: 1440 / ((2 * Math.PI) / satrec.no),
    semiMajorKm: satrec.a * EARTH_RADIUS_KM,
    apogeeKm: satrec.alta * EARTH_RADIUS_KM,
    perigeeKm: satrec.altp * EARTH_RADIUS_KM,
    raanDeg: satrec.nodeo * (180 / Math.PI),
    argpDeg: satrec.argpo * (180 / Math.PI),
  };
}

function PassRow({ p, t }) {
  const parts = (p.start || "").split("· ");
  const date = parts[0] ? parts[0].trim() : "—";
  const time = parts[1] ? parts[1].trim() : "—";
  const mins = Math.round((p.duration_sec || 0) / 60);
  const pillCls = p.mag !== null && p.mag !== undefined && p.mag < -3 ? "pill gold" : "pill teal";
  return (
    <tr>
      <td>{date}</td>
      <td className="mono-accent">{time}</td>
      <td>{mins} {t("common.units.min")}</td>
      <td>{p.max_el || "—"}°</td>
      <td style={{ color: "var(--text-dim)" }}>{p.from_dir} → {p.to_dir}</td>
      <td style={{ textAlign: "right" }}>
        <span className={pillCls}>{p.mag !== null && p.mag !== undefined ? p.mag : "—"}</span>
      </td>
    </tr>
  );
}

// Expedition start timestamp (unix seconds or ms) → "5 лип 2026".
function fmtExpeditionStart(ts, t) {
  if (!ts) return "";
  const ms = ts > 1e12 ? ts : ts * 1000;
  const d = new Date(ms);
  return d.getDate() + " " + t("common.months." + MONTH_KEYS[d.getMonth()]) + " " + d.getFullYear();
}

function CrewSection({ crewD, t }) {
  const groups = (crewD && crewD.by_spacecraft) || null;
  const crew = (crewD && crewD.crew) || null;

  // No data yet — the request is still in flight or failed.
  if (!crewD) {
    return (
      <section className="section" id="crew" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("iss.crew.eyebrow")} title={t("iss.crew.title")} />
          <p className="section-sub">{t("iss.crew.loading")}</p>
        </div>
      </section>
    );
  }
  if (!crew || !crew.length) {
    return (
      <section className="section" id="crew" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("iss.crew.eyebrow")} title={t("iss.crew.title")} />
          <p className="section-sub">{t("iss.crew.unavailable")}</p>
        </div>
      </section>
    );
  }

  const patch = crewD.expedition_patch;
  const expUrl = crewD.expedition_url;
  const expedition = crewD.expedition;
  const since = fmtExpeditionStart(crewD.expedition_start_date, t);
  const groupEntries = Object.entries(groups || { "": crew });

  return (
    <section className="section" id="crew" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <SectionHead eyebrow={t("iss.crew.eyebrow")} title={t("iss.crew.title")} />
        <p className="section-sub">{t("iss.crew.sub")}</p>

        <div className="crew-layout">
          <aside className="crew-exp-card">
            {patch ? (
              <img className="crew-patch" src={patch} alt="" loading="lazy" />
            ) : (
              <div className="crew-patch ph">🛰️</div>
            )}
            <div className="crew-exp-name">
              {expedition ? t("iss.expedition", { n: expedition }) : t("iss.hero.eyebrow")}
            </div>
            {since && <div className="crew-since">{t("iss.crew.since", { date: since })}</div>}
            {expUrl && expedition && (
              <a className="crew-link" href={expUrl} target="_blank" rel="noreferrer">
                {t("iss.crew.expeditionLink", { n: expedition })}
              </a>
            )}
          </aside>

          <div className="crew-groups">
            {groupEntries.map(([craft, members]) => (
              <div className="crew-group" key={craft || "_"}>
                <div className="crew-craft">🚀 {craft || t("iss.crew.unknownCraft")}</div>
                <div className="crew-list">
                  {members.map((p, i) => (
                    <div className="crew-person" key={i}>
                      <span className="cp-flag" aria-hidden="true">{p.flag || "🏳️"}</span>
                      <div className="cp-body">
                        <div className="cp-name">{p.name || "—"}</div>
                        <div className="cp-pos">{p.position}</div>
                        <div className="cp-meta">
                          {p.agency && <span>{p.agency}</span>}
                          {p.days_in_space != null && (
                            <span>{t("iss.crew.daysInSpace", { n: p.days_in_space })}</span>
                          )}
                          {p.country && <span>{p.country}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Official NASA module-configuration diagram — also used as the "simplified
// visualization" preview card for the 3D viewer CTA (iss.structure section).
const ISS_DIAGRAM_URL = "https://upload.wikimedia.org/wikipedia/commons/1/1c/ISS_configuration_2021-07_en.svg";

const GALLERY = [
  {
    // Mirrored locally (same NASA photo as Wikimedia's
    // International_Space_Station_after_undocking_of_STS-132.jpg) — no
    // external hotlink for this one.
    src: "/iss/iss-photo.jpg",
    captionKey: "iss.gallery.img1_caption",
    title: "ISS",
  },
  {
    src: ISS_DIAGRAM_URL,
    captionKey: "iss.gallery.img2_caption",
    title: "ISS Diagram",
    contain: true,
    bg: "#fff"
  },
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/9/95/Tracy_Caldwell_Dyson_in_Cupola_ISS.jpg",
    captionKey: "iss.gallery.img3_caption",
    title: "Cupola",
  }
];

// Fact card bodies share one style each — defined once instead of repeating
// the same inline object literal on every card.
const FACT_TITLE_STYLE = { fontSize: "1.2rem", marginBottom: 8, color: "var(--accent)" };
const FACT_BODY_STYLE = { fontSize: "1rem", lineHeight: 1.4, color: "var(--text)", fontWeight: 400, textTransform: "none" };
const FACTS = ["f1", "f2", "f3"];

export default function Iss() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.iss"); }, [t]);
  const { lang } = useLang();
  const mapRef = useRef(null);
  const { loc } = useLoc();
  const city = locCity(loc) || t("common.kyiv");
  const [note, setNote] = useState(t("iss.loadingPos"));
  const [pos, setPos] = useState(null); // {lat,lon,alt,vel} from onTick
  const [elements, setElements] = useState(null); // orbital elements from the live TLE
  const elementsSetRef = useRef(false);
  const [modalIdx, setModalIdx] = useState(null);
  const [show3D, setShow3D] = useState(false);

  // Lightbox keyboard nav + scroll lock (same pattern as Galaxy.js / RoverPhotos.js).
  useEffect(() => {
    if (modalIdx === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") setModalIdx(null);
      else if (e.key === "ArrowLeft") setModalIdx((i) => (i === null ? null : (i - 1 + GALLERY.length) % GALLERY.length));
      else if (e.key === "ArrowRight") setModalIdx((i) => (i === null ? null : (i + 1) % GALLERY.length));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [modalIdx]);

  const { data: crewD } = useApi(() => getIssCrew(lang), { deps: [lang] });
  const { data: passD } = useApi(() => getIssPasses(loc, lang), { deps: [loc && loc.lat, loc && loc.lon, lang] });
  // Keep the live ISS position payload fetched with the active language (so
  // any localized fields follow the language switch).
  useApi(() => getIssNow(lang), { deps: [lang] });

  // Placeholder pass rows shown until /api/iss/passes resolves. Built inside
  // the component so they can use t(...).
  const PASS_PH = [
    { start: "5 " + t("common.months.jul") + " · 22:14", max_el: 78, from_dir: t("common.compass.NW"), to_dir: t("common.compass.SE"), duration_sec: 360, mag: -3.8 },
    { start: "6 " + t("common.months.jul") + " · 21:26", max_el: 54, from_dir: t("common.compass.W"), to_dir: t("common.compass.S"), duration_sec: 300, mag: -3.1 },
    { start: "7 " + t("common.months.jul") + " · 22:01", max_el: 32, from_dir: t("common.compass.NW"), to_dir: t("common.compass.S"), duration_sec: 240, mag: -2.4 },
    { start: "8 " + t("common.months.jul") + " · 21:13", max_el: 65, from_dir: t("common.compass.W"), to_dir: t("common.compass.SE"), duration_sec: 360, mag: -3.5 },
  ];

  const passes = (passD && passD.items) || PASS_PH;
  const crewCount = crewD && crewD.count != null ? crewD.count : 7;
  const expedition = crewD && crewD.expedition ? t("iss.expedition", { n: crewD.expedition }) : t("iss.expedition", { n: 72 });

  const coords = pos
    ? t("iss.coords", {
        lat: Math.abs(pos.lat).toFixed(2) + "°" + (pos.lat >= 0 ? t("common.compass.N") : t("common.compass.S")),
        lon: Math.abs(pos.lon).toFixed(2) + "°" + (pos.lon >= 0 ? t("common.compass.E") : t("common.compass.W")),
        alt: pos.alt.toFixed(0),
      })
    : t("iss.coords", { lat: "50.45°" + t("common.compass.N"), lon: "30.52°" + t("common.compass.E"), alt: "417" });

  const kmh = pos ? fmtInt(Math.round(pos.vel * 3600)) : "27 600";
  const kms = pos ? "~" + pos.vel.toFixed(2) + " " + t("common.units.km_s") : "~7.66 " + t("common.units.km_s");
  const altKm = pos ? pos.alt.toFixed(0) : "417";

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow"><span className="dot live" /> {t("iss.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("iss.hero.title") }} />
            <p className="hero-sub">{t("iss.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#live-map" className="btn primary">{t("iss.hero.whereNow")}</a>
              <a href="#crew" className="btn ghost">{t("iss.hero.crewCta")}</a>
            </div>
          </div>
          <Suspense fallback={<div className="iss3d-hero-placeholder"><span className="iss3d-spinner" /></div>}>
            <IssStationHeroPreview onOpenFullscreen={() => setShow3D(true)} />
          </Suspense>
        </div>
      </section>

      <section className="section" id="live-map" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="map-card">
            <div className="map-head">
              <div className="live"><span className="dot live" /> {t("iss.map.live")}</div>
              <span className="coords">{coords}</span>
            </div>
            <div className="map-body map-live">
              <SatMap ref={mapRef} groups={["iss"]} limit={5} follow track lang={lang}
                onReady={() => setNote(t("iss.map.note"))}
                onTick={(p, sats) => {
                  setPos(p);
                  if (!elementsSetRef.current && sats && sats[0] && sats[0].satrec) {
                    elementsSetRef.current = true;
                    setElements(issOrbitalElements(sats[0].satrec));
                  }
                }} />
              <div className="note">{note}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("iss.s1.eyebrow")} title={t("iss.s1.title")} />
          <div className="grid cols-4">
            <div className="card">
              <div className="k">{t("iss.card.speed")}</div>
              <div className="v">{kmh}<span className="unit">{t("common.units.km_h")}</span></div>
              <div className="foot">{kms}</div>
            </div>
            <div className="card">
              <div className="k">{t("iss.card.alt")}</div>
              <div className="v">{altKm}<span className="unit">{t("common.units.km")}</span></div>
              <div className="foot">{t("iss.card.leo")}</div>
            </div>
            <div className="card">
              <div className="k">{t("iss.card.orbit")}</div>
              <div className="v">{elements ? elements.periodMin.toFixed(1) : "92"}<span className="unit">{t("common.units.min")}</span></div>
              <div className="foot">{elements ? t("iss.card.orbitFootLive", { n: elements.revPerDay.toFixed(2) }) : t("iss.card.orbitFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("iss.card.crew")}</div>
              <div className="v accent">{crewCount}<span className="unit">{t("iss.card.crewUnit")}</span></div>
              <div className="foot">{expedition}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("iss.elements.eyebrow")} title={t("iss.elements.title")} />
          <p className="section-sub">{t("iss.elements.sub")}</p>
          <div className="grid cols-4">
            <div className="card">
              <div className="k">{t("iss.elements.inclination")}</div>
              <div className="v">{elements ? elements.incDeg.toFixed(2) : "51.64"}<span className="unit">°</span></div>
              <div className="foot">{t("iss.elements.inclinationFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("iss.elements.eccentricity")}</div>
              <div className="v">{elements ? elements.ecc.toFixed(4) : "0.0004"}</div>
              <div className="foot">{t("iss.elements.eccentricityFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("iss.elements.apogee")}</div>
              <div className="v">{elements ? fmtInt(Math.round(elements.apogeeKm)) : "421"}<span className="unit">{t("common.units.km")}</span></div>
              <div className="foot">{t("iss.elements.apogeeFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("iss.elements.perigee")}</div>
              <div className="v">{elements ? fmtInt(Math.round(elements.perigeeKm)) : "413"}<span className="unit">{t("common.units.km")}</span></div>
              <div className="foot">{t("iss.elements.perigeeFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("iss.elements.semiMajor")}</div>
              <div className="v">{elements ? fmtInt(Math.round(elements.semiMajorKm)) : "6 796"}<span className="unit">{t("common.units.km")}</span></div>
              <div className="foot">{t("iss.elements.semiMajorFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("iss.elements.raan")}</div>
              <div className="v">{elements ? elements.raanDeg.toFixed(1) : "—"}<span className="unit">°</span></div>
              <div className="foot">{t("iss.elements.raanFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("iss.elements.argp")}</div>
              <div className="v">{elements ? elements.argpDeg.toFixed(1) : "—"}<span className="unit">°</span></div>
              <div className="foot">{t("iss.elements.argpFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("iss.elements.revPerDay")}</div>
              <div className="v">{elements ? elements.revPerDay.toFixed(2) : "15.50"}</div>
              <div className="foot">{t("iss.elements.revPerDayFoot")}</div>
            </div>
          </div>
        </div>
      </section>

      <CrewSection crewD={crewD} t={t} />

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("iss.gallery.eyebrow")} title={t("iss.gallery.title")} />
          <p className="section-sub">{t("iss.gallery.sub")}</p>
          <div className="grid cols-3">
            {GALLERY.map((g, i) => (
              <div key={i} className="card" onClick={() => setModalIdx(i)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setModalIdx(i); } }}
                style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "zoom-in", background: g.bg || "var(--bg-card)" }}>
                <img src={g.src} alt={g.title} style={{ width: "100%", height: "200px", objectFit: g.contain ? "contain" : "cover", display: "block", background: g.bg || "transparent" }} loading="lazy" />
                <div style={{ padding: "16px", fontSize: "0.9rem", color: g.bg ? "#666" : "var(--text-dim)", background: g.bg || "transparent" }}>
                  {t(g.captionKey)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("iss.facts.eyebrow")} title={t("iss.facts.title")} />
          <p className="section-sub">{t("iss.facts.sub")}</p>
          <div className="grid cols-3">
            {FACTS.map((f) => (
              <div className="card" key={f}>
                <div className="v" style={FACT_TITLE_STYLE}>{t(`iss.facts.${f}_title`)}</div>
                <div style={FACT_BODY_STYLE}>{t(`iss.facts.${f}_body`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="passes" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead gold eyebrow={t("iss.s2.eyebrow", { city })} title={t("iss.s2.title")} linkTo="home" linkLabel={t("iss.s2.link")} />
          <p className="section-sub">{t("iss.s2.sub")}</p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("iss.col.date")}</th>
                  <th>{t("iss.col.time")}</th>
                  <th>{t("iss.col.duration")}</th>
                  <th>{t("iss.col.maxAlt")}</th>
                  <th>{t("iss.col.dir")}</th>
                  <th style={{ textAlign: "right" }}>{t("iss.col.bright")}</th>
                </tr>
              </thead>
              <tbody>
                {passes.map((p, i) => <PassRow key={i} p={p} t={t} />)}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("iss.s3.eyebrow")} title={t("iss.s3.title")} />
          <FeatureRow tag={t("iss.tips.t1_tag")} title={t("iss.tips.t1_title")} num={t("iss.tips.t1_num")}>{t("iss.tips.t1_body")}</FeatureRow>
          <FeatureRow tag={t("iss.tips.t2_tag")} title={t("iss.tips.t2_title")} num={t("iss.tips.t2_num")}>{t("iss.tips.t2_body")}</FeatureRow>
          <FeatureRow tag={t("iss.tips.t3_tag")} title={t("iss.tips.t3_title")} num={t("iss.tips.t3_num")}>{t("iss.tips.t3_body")}</FeatureRow>
        </div>
      </section>

      {show3D && (
        <Suspense fallback={null}>
          <IssStationFullscreen onClose={() => setShow3D(false)} />
        </Suspense>
      )}

      {modalIdx !== null && (
        <div className="photo-modal open" onClick={() => setModalIdx(null)}>
          <div className="photo-modal-inner" onClick={(e) => e.stopPropagation()}>
            <div className="photo-modal-img"
              style={{
                backgroundImage: `url("${GALLERY[modalIdx].src}")`,
                backgroundSize: GALLERY[modalIdx].contain ? "contain" : "cover",
                backgroundColor: GALLERY[modalIdx].bg || "transparent"
              }}>
              <button className="photo-modal-close" onClick={() => setModalIdx(null)} aria-label={t("iss.gallery.close")}>✕</button>
              <button className="photo-modal-nav prev" aria-label={t("iss.gallery.prev")}
                onClick={() => setModalIdx((i) => (i - 1 + GALLERY.length) % GALLERY.length)}>‹</button>
              <button className="photo-modal-nav next" aria-label={t("iss.gallery.next")}
                onClick={() => setModalIdx((i) => (i + 1) % GALLERY.length)}>›</button>
            </div>
            <div className="photo-modal-info">
              <h3>{GALLERY[modalIdx].title}</h3>
              <p>{t(GALLERY[modalIdx].captionKey)}</p>
              <a className="section-link" style={{ marginTop: "auto", paddingTop: 18 }}
                href={GALLERY[modalIdx].src} target="_blank" rel="noopener noreferrer">
                {t("iss.gallery.openFull")} ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
