import { useLang } from "../context/LanguageContext";
import { useSeo } from "../hooks/useSeo";
import pages from "../data/constellationGuidePages.json";

export default function ConstellationGuide({ slug }) {
  const { lang } = useLang();
  useSeo();
  return <>
    <link rel="stylesheet" href="/constellations/guides.css" precedence="default" />
    <div dangerouslySetInnerHTML={{ __html: pages[lang === "en" ? "en" : "uk"][slug] }} />
  </>;
}
