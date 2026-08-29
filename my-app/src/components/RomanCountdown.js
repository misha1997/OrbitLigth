// Shared countdown clock for the Nancy Grace Roman Space Telescope launch —
// used by RomanLaunchWidget.js (homepage) and Roman.js's launch section head.
// Ticks its own clock (doesn't reuse Countdown.js) so callers can check
// `useRomanLaunched()` and swap in a post-launch state instead of leaving a
// dead 00:00:00:00 clock on the page after liftoff.
import { useTranslation } from "react-i18next";
import { useCountdown } from "../hooks/useCountdown";

// 2026-08-30T11:26:00Z (07:26 EDT) — Falcon Heavy, LC-39A. Kept in sync with
// roman.launch.* copy on Roman.js; both note the date is NASA's "no earlier
// than" target.
export const ROMAN_LAUNCH_TS = 1788089160;

export function useRomanLaunched() {
  // Re-evaluated on every render; a mounted <RomanCountdown> nearby keeps this
  // ticking via its own useCountdown interval, so this flips promptly at T-0
  // rather than only on the next unrelated re-render.
  return Date.now() / 1000 >= ROMAN_LAUNCH_TS;
}

function Seg({ n, u }) {
  return (
    <div className="seg">
      <div className="n">{n}</div>
      <span className="u">{u}</span>
    </div>
  );
}

// `compact` shrinks the segments for inline placement next to a heading
// (see .clock-compact in neowatch.css) instead of the full-size hero clock.
export default function RomanCountdown({ compact }) {
  const { t } = useTranslation();
  const { d, h, m, s, pad2 } = useCountdown(ROMAN_LAUNCH_TS);
  if (Date.now() / 1000 >= ROMAN_LAUNCH_TS) return null;
  return (
    <div className={"clock" + (compact ? " clock-compact" : "")} data-units="dhms">
      <Seg n={pad2(d)} u={t("common.units.days")} />
      <Seg n={pad2(h)} u={t("common.units.hrs")} />
      <Seg n={pad2(m)} u={t("common.units.min")} />
      <Seg n={pad2(s)} u={t("common.units.sec")} />
    </div>
  );
}
