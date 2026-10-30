import { lazy, Suspense, useMemo } from "react";
import { useLang } from "../context/LanguageContext";
import { useSeo } from "../hooks/useSeo";
import { getConstellationBootstrap } from "../lib/constellationGuides";

export default function ConstellationGuide({ slug }) {
  const { lang } = useLang();
  useSeo();
  const language = lang === "en" ? "en" : "uk";
  const Body = useMemo(() => lazy(() => import(`../data/constellationPages/${slug}.json`).then(module => ({
    default: function GuideBody({ language }) {
      return <div dangerouslySetInnerHTML={{ __html: module.default[language] }} />;
    },
  }))), [slug]);
  const initial = getConstellationBootstrap();
  const fallback = initial ? <div dangerouslySetInnerHTML={{ __html: initial.html }} />
    : <p className="wrap cg-page" role="status">{language === "en" ? "Loading guide…" : "Завантаження довідника…"}</p>;
  return <>
    <link rel="stylesheet" href="/constellations/guides.css" precedence="default" />
    <Suspense fallback={fallback}><Body language={language} /></Suspense>
  </>;
}
