import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "../hooks/useApi";
import { getSatelliteLaunch } from "../lib/api";
import "../styles/satellite-launch.css";

// The embedded and fullscreen panels may coexist. Share one request per
// selection, independent of the two-second position updates.
const requests = new Map();
function load(norad, cospar) {
  const key = `${norad}:${cospar}`;
  const existing = requests.get(key);
  if (existing && existing.until > Date.now()) return existing.promise;
  const entry = { until: Infinity };
  entry.promise = getSatelliteLaunch(norad, cospar).then(result => {
    entry.until = Date.now() + (result.available && !result.stale ? 86400000 : 300000);
    return result;
  }).catch(error => { if (requests.get(key) === entry) requests.delete(key); throw error; });
  requests.set(key, entry);
  if (requests.size > 200) requests.delete(requests.keys().next().value);
  return entry.promise;
}

function Organization({ org }) {
  const [broken, setBroken] = useState(false);
  return <div className="sat-launch-organization">
    {org.logo_url && !broken && <img src={org.logo_url} alt="" width="64" height="32" onError={() => setBroken(true)} />}
    <span>{org.name}</span>
  </div>;
}

export default function SatelliteLaunchInfo({ norad, cospar = "", category, onLoaded }) {
  const { t, i18n } = useTranslation();
  const { data, loading, error, refetch } = useApi(() => load(norad, cospar), { deps: [norad, cospar] });
  const retry = () => { requests.delete(`${norad}:${cospar}`); refetch(); };
  const current = data?.norad_id === Number(norad) ? data : null;
  useEffect(() => { if (current) onLoaded?.(current); }, [current, onLoaded]);
  const unknown = t("orbital.launchUnknown");
  const date = current?.launch_date ? new Intl.DateTimeFormat(i18n.resolvedLanguage, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(current.launch_date + "T00:00:00Z")) : current?.launch_date_text;
  return <section className="sat-launch-info" aria-label={t("orbital.launchTitle")} aria-busy={loading}>
    <h4>{t("orbital.launchTitle")}</h4>
    {loading || (!current && !error) ? <p role="status">{t("orbital.launchLoading")}</p>
      : error || !current?.available ? <div role="status"><p>{t("orbital.launchError")}</p><button type="button" onClick={retry}>{t("orbital.retry")}</button></div>
      : !current.found ? <p>{t("orbital.launchNotFound")}</p>
      : <>
        {current.stale && <p className="sat-warning">{t("orbital.launchStale")}</p>}
        <dl>
          <div className="sat-launch-provider"><dt>{t("orbital.launchProvider")}</dt><dd>
            {current.providers?.length ? current.providers.map(org => <Organization key={org.code} org={org} />) : unknown}
          </dd></div>
          <div><dt>{t("orbital.launchDate")}</dt><dd>{date || unknown}{current.launch_date && <small> UTC</small>}</dd></div>
          <div><dt>{t("orbital.launchRocket")}</dt><dd>{current.rocket || unknown}</dd></div>
          {current.owners?.length > 0 && <div className="sat-launch-owner"><dt>{t("orbital.launchOwner")}</dt><dd>{current.owners.map(org => org.name).join(" / ")}</dd></div>}
        </dl>
        {(current.match === "launch" || category === "station") && <p className="sat-launch-note">{t(category === "station" ? "orbital.launchStationNote" : "orbital.launchOriginNote")}</p>}
      </>}
    {current?.source_url && <a className="sat-launch-source" href={current.source_url} target="_blank" rel="noopener noreferrer">GCAT · Jonathan McDowell ↗</a>}
  </section>;
}
