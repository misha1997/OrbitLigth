import { useTranslation } from "react-i18next";

// Explain the target orbit without inventing a live spacecraft position.
export default function RomanL2Orbit() {
  const { t } = useTranslation();
  return <figure className="roman-orbit-diagram">
    <svg viewBox="0 0 900 310" role="img" aria-label={t("roman.l2.description")}>
      <path d="M125 155H800" stroke="#71849b" strokeDasharray="5 8" />
      <circle cx="100" cy="155" r="44" fill="#efbd5a" /><circle cx="430" cy="155" r="23" fill="#527ea3" />
      <ellipse cx="745" cy="155" rx="62" ry="95" stroke="#b5a2e4" fill="#b5a2e408" strokeWidth="2" /><circle cx="745" cy="155" r="5" fill="#b5a2e4" />
      <path d="M460 265H720m-12-7 12 7-12 7m-236-14-12 7 12 7" fill="none" stroke="#8aa2bd" strokeWidth="2" />
      <g textAnchor="middle" fill="#dbe4ef" fontFamily="sans-serif" fontSize="26"><text x="100" y="90">{t("roman.l2.diagram_sun")}</text><text x="430" y="104">{t("roman.l2.diagram_earth")}</text><text x="770" y="160">L2</text><text x="590" y="297">{t("roman.l2.diagram_dist")}</text><text x="745" y="35">{t("roman.l2.diagram_halo")}</text></g>
    </svg>
    <figcaption>{t("roman.l2.note")}</figcaption>
  </figure>;
}
