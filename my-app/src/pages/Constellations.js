import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { useSeo } from "../hooks/useSeo";
import ConstellationMap from "../components/ConstellationMap";
import "../styles/constellations.css";

export default function Constellations() {
  const { t } = useTranslation();
  const { lang } = useLang();
  useSeo();

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
              ? "Explore 88 constellations on an interactive star map. Choose your observing location and season, zoom in to discover stars, or start with one of the eight popular constellations below."
              : "Досліджуй 88 сузір'їв на інтерактивній карті зоряного неба. Обери місце спостереження й сезон, наближай карту для перегляду зір або почни з восьми популярних сузір'їв унизу."}
          </p>
        </div>
      </section>

      {/* Interactive Map Section */}
      <section className="section" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <ConstellationMap />
        </div>
      </section>
    </>
  );
}
