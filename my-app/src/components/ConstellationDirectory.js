import directory from "../data/constellationDirectory.json";

export default function ConstellationDirectory({ lang }) {
  return <>
    <link rel="stylesheet" href="/constellations/guides.css" precedence="default" />
    <div dangerouslySetInnerHTML={{ __html: directory[lang === "en" ? "en" : "uk"] }} />
  </>;
}
