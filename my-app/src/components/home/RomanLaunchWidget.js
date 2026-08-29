// Homepage countdown widget for the Nancy Grace Roman Space Telescope launch —
// reuses the launches page's .next-launch markup (see NextLaunch.js) so it
// looks like a real "next launch" card without pulling in the Launch Library
// API for a one-off, hardcoded event. Clock + launched-state logic live in
// RomanCountdown.js, shared with the launch-section head on Roman.js.
import { useTranslation } from "react-i18next";
import LocalizedLink from "../primitives/LocalizedLink";
import RomanCountdown, { ROMAN_LAUNCH_TS, useRomanLaunched } from "../RomanCountdown";
import { formatLaunchDt } from "../../lib/format";

export default function RomanLaunchWidget() {
  const { t } = useTranslation();
  const launched = useRomanLaunched();
  const dt = formatLaunchDt(ROMAN_LAUNCH_TS);

  return (
    <div className="next-launch">
      <span className="badge-live">
        <span className="dot" />
        {t(launched ? "home.romanLaunch.liveBadge" : "home.romanLaunch.badge")}
      </span>
      <div className="next-launch-grid">
        <div>
          <h2>{t("home.romanLaunch.title")}</h2>
          <p style={{ color: "var(--text-dim)", fontSize: 14, marginTop: 5 }}>{t("home.romanLaunch.sub")}</p>
          <div className="launch-datetime">{dt}</div>
          <LocalizedLink to="roman" className="btn primary launch-watch" style={{ marginTop: 16 }}>
            ▶ {t(launched ? "home.romanLaunch.watchReplay" : "home.romanLaunch.watch")}
          </LocalizedLink>
        </div>
        <RomanCountdown />
      </div>
    </div>
  );
}
