// Live disk of the Sun (weather.html): three NASA SDO "latest frame" images —
// no backend needed, these are plain public image URLs NASA refreshes
// server-side every ~15 min (the same ones feeding sdo.gsfc.nasa.gov itself).
// We cache-bust with a 15-min time bucket so the browser actually re-fetches
// instead of serving a stale copy from its HTTP cache indefinitely.
import { useTranslation } from "react-i18next";

const BUCKET_MS = 15 * 60 * 1000;

const CHANNELS = [
  { key: "0171", labelKey: "corona" },
  { key: "HMIIC", labelKey: "visible" },
  { key: "0304", labelKey: "chromosphere" },
];

function sdoUrl(channel, bucket) {
  return `https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_${channel}.jpg?t=${bucket}`;
}

export default function SunNow() {
  const { t } = useTranslation();
  const bucket = Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS;

  return (
    <section className="section" id="sun-now" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow"><span className="dot live" /> {t("weather.sun.eyebrow")}</div>
            <h2 className="section-title">{t("weather.sun.title")}</h2>
          </div>
        </div>
        <p className="section-sub">{t("weather.sun.sub")}</p>
        <div className="grid cols-3">
          {CHANNELS.map((ch) => (
            <a
              key={ch.key}
              className="card"
              href={sdoUrl(ch.key, bucket).replace("latest_512_", "latest_1024_")}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: 0, overflow: "hidden", display: "block" }}
            >
              <img
                src={sdoUrl(ch.key, bucket)}
                alt={t("weather.sun." + ch.labelKey)}
                loading="lazy"
                decoding="async"
                style={{ width: "100%", display: "block", aspectRatio: "1 / 1", objectFit: "cover" }}
              />
              <div className="foot" style={{ padding: "10px 14px" }}>{t("weather.sun." + ch.labelKey)}</div>
            </a>
          ))}
        </div>
        <p className="foot" style={{ marginTop: 12 }}>{t("weather.sun.source")}</p>
      </div>
    </section>
  );
}
