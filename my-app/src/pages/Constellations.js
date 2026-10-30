import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { useSeo } from "../hooks/useSeo";
import { useLocation } from "react-router-dom";
import { constellationGuides, guideUi } from "../lib/constellationGuides";
import ConstellationMap from "../components/ConstellationMap";
import ConstellationDirectory from "../components/ConstellationDirectory";
import "../styles/constellations.css";

export default function Constellations() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { search, hash } = useLocation();
  const focused = constellationGuides.find(item => item.id === new URLSearchParams(search).get("focus"));
  useSeo();
  useEffect(() => {
    if (!focused || hash !== "#sky-map") return;
    // Run after the layout's route scroll reset and the lazy page mount.
    const frame = requestAnimationFrame(() => document.getElementById("sky-map")?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [focused, hash]);

  return (
    <>
      {/* Hero section */}
      <section className="hero">
        <div className="wrap">
          <div className="eyebrow">{t("constellations.hero.eyebrow", {
            defaultValue: lang === "en" ? "Interactive · click on any constellation" : "Інтерактивно · клікни на будь-яке сузір'я"
          })}</div>
          <h1 className="hero-title">
            {lang === "en" ? (
              <>Find <span className="accent">constellations</span><br />in the night sky</>
            ) : (
              <>Впізнай <span className="accent">сузір'я</span><br />на нічному небі</>
            )}
          </h1>
          <p className="hero-sub" style={{ maxWidth: 640 }}>
            {lang === "en"
              ? guideUi.en.heroIntro : guideUi.uk.heroIntro}
          </p>
          <a href="#field-guides" className="btn ghost">{guideUi[lang === "en" ? "en" : "uk"].directory} ↓</a>
        </div>
      </section>

      {/* Interactive Map Section */}
      <section className="section" id="sky-map" style={{ paddingTop: 8, scrollMarginTop: 90 }}>
        <div className="wrap">
          <ConstellationMap key={focused?.id || "default"} focusConst={focused?.id} initialSeason={focused?.seasonKey} />
          <ConstellationDirectory lang={lang} />
        </div>
      </section>
    </>
  );
}
