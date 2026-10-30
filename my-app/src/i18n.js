// i18next init (synchronous, before first render so there is no language flash).
// The active language is owned by LanguageContext, which calls
// i18next.changeLanguage() on switch. Importing this module has the side effect
// of initialising i18next with the stored/detected language.
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import uk from "./i18n/uk.json";
import en from "./i18n/en.json";
import orbitalUk from "./i18n/orbital.uk.json";
import orbitalEn from "./i18n/orbital.en.json";
import missionDetailUk from "./i18n/mission-detail.uk.json";
import missionDetailEn from "./i18n/mission-detail.en.json";
import missionEnrichmentUk from "./i18n/mission-enrichment.uk.json";
import missionEnrichmentEn from "./i18n/mission-enrichment.en.json";
import missionAdditionsUk from "./i18n/mission-additions.uk.json";
import missionAdditionsEn from "./i18n/mission-additions.en.json";
import missionExplorersUk from "./i18n/mission-explorers.uk.json";
import missionExplorersEn from "./i18n/mission-explorers.en.json";
import missionSurveysUk from "./i18n/mission-surveys.uk.json";
import missionSurveysEn from "./i18n/mission-surveys.en.json";
import missionKeplerUk from "./i18n/mission-kepler.uk.json";
import missionKeplerEn from "./i18n/mission-kepler.en.json";
import missionSpitzerUk from "./i18n/mission-spitzer.uk.json";
import missionSpitzerEn from "./i18n/mission-spitzer.en.json";
import missionPioneersUk from "./i18n/mission-pioneers.uk.json";
import missionPioneersEn from "./i18n/mission-pioneers.en.json";
import missionWorldsUk from "./i18n/mission-worlds.uk.json";
import missionWorldsEn from "./i18n/mission-worlds.en.json";

const missionTranslations = (base, extra) => Object.fromEntries(Object.entries(base).map(([key, value]) => [key, { ...value, ...extra[key] }]));

const KEY = "neowatch.lang";
export const DEFAULT_LANG = "uk";
export const LANGS = ["uk", "en"];

// First-visit detection: browser language. uk/ru → Ukrainian, else English.
export function detectLang() {
  try {
    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("uk") || nav.startsWith("ru")) return "uk";
  } catch { /* navigator unavailable */ }
  return "en";
}

// The URL language prefix is authoritative (the server sets <html lang> from
// it). Prefer it so the first client render matches the server-rendered shell
// — no language flash. Only fall back to localStorage / browser detection
// when there is no prefix (e.g. an unprefixed dev hit the server didn't
// redirect).
function langFromUrl() {
  try {
    const m = window.location.pathname.match(/^\/(ua|en)(\/|$)/);
    if (m) return m[1] === "ua" ? "uk" : "en";
  } catch { /* window unavailable (SSR) */ }
  return null;
}

export function readLang() {
  const fromUrl = langFromUrl();
  if (fromUrl) return fromUrl;
  try {
    const v = localStorage.getItem(KEY);
    if (v === "uk" || v === "en") return v;
  } catch { /* localStorage unavailable */ }
  return detectLang();
}

let initialised = false;
export function initI18n(initialLang) {
  if (initialised) return i18next;
  i18next.use(initReactI18next).init({
    resources: {
      uk: { translation: { ...uk, orbital: orbitalUk, missionDetail: missionTranslations({ ...missionDetailUk, ...missionAdditionsUk, ...missionExplorersUk, ...missionSurveysUk, ...missionKeplerUk, ...missionSpitzerUk, ...missionPioneersUk, ...missionWorldsUk }, missionEnrichmentUk) } },
      en: { translation: { ...en, orbital: orbitalEn, missionDetail: missionTranslations({ ...missionDetailEn, ...missionAdditionsEn, ...missionExplorersEn, ...missionSurveysEn, ...missionKeplerEn, ...missionSpitzerEn, ...missionPioneersEn, ...missionWorldsEn }, missionEnrichmentEn) } },
    },
    lng: initialLang || readLang(),
    fallbackLng: DEFAULT_LANG,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  initialised = true;
  return i18next;
}

// Initialise eagerly at module load so the very first render uses the right lang.
initI18n(readLang());

export default i18next;
