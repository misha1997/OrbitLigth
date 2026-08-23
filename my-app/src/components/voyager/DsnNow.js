// Live NASA Deep Space Network status for the Voyager page: which antenna
// (Goldstone/Madrid/Canberra) is currently in contact with Voyager 1/2, plus
// a compact list of every other active spacecraft contact right now. Polls
// /api/dsn every 30s — matches the backend TTL (web/data.py DSN_TTL) so a
// poll always sees fresh data rather than the same cached value twice.
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { getDsnNow } from "../../lib/api";
import { fmtInt, fmtTime } from "../../lib/format";

const VOYAGER_CODES = { VGR1: "v1", VGR2: "v2" };

function flattenContacts(dsn) {
  if (!dsn || !Array.isArray(dsn.stations)) return [];
  const rows = [];
  for (const st of dsn.stations) {
    for (const dish of st.dishes || []) {
      const codes = new Set();
      for (const sig of [...(dish.down_signals || []), ...(dish.up_signals || [])]) {
        if (sig.active && sig.spacecraft_code && sig.spacecraft_code !== "DSN") codes.add(sig.spacecraft_code);
      }
      for (const code of codes) {
        const down = (dish.down_signals || []).find((s) => s.active && s.spacecraft_code === code);
        const up = (dish.up_signals || []).find((s) => s.active && s.spacecraft_code === code);
        const ref = down || up;
        rows.push({
          station: st.friendly_name,
          dish: dish.name,
          code,
          spacecraft: ref.spacecraft,
          down,
          up,
        });
      }
    }
  }
  return rows;
}

function VoyagerContactCard({ n, contact, t }) {
  return (
    <div className="card">
      <div className="k">
        {t("voyager.dsn.cards.title", { n })}
        {contact && <span className="dot live" />}
      </div>
      {contact ? (
        <>
          <div className="v accent" style={{ fontSize: 20 }}>{contact.station}</div>
          <div className="foot">{t("voyager.dsn.cards.dish", { dish: contact.dish })}</div>
          {contact.down && (
            <div className="foot">
              {t("voyager.dsn.cards.rate", { rate: fmtInt(contact.down.data_rate), band: contact.down.band })}
            </div>
          )}
        </>
      ) : (
        <div className="foot">{t("voyager.dsn.cards.noContact")}</div>
      )}
    </div>
  );
}

export default function DsnNow() {
  const { t } = useTranslation();
  const { data: dsn, loading } = useApi(getDsnNow, { interval: 30000 });
  const contacts = flattenContacts(dsn);
  const byCode = {};
  for (const c of contacts) if (VOYAGER_CODES[c.code]) byCode[c.code] = c;
  const others = contacts.filter((c) => !VOYAGER_CODES[c.code]);

  return (
    <section className="section" id="dsn">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow"><span className="dot live" /> {t("voyager.dsn.eyebrow")}</div>
            <h2 className="section-title">{t("voyager.dsn.title")}</h2>
          </div>
        </div>
        <p className="section-sub">{t("voyager.dsn.sub")}</p>

        {loading && !dsn ? (
          <div className="spinner-wrap" style={{ padding: "40px 0" }}><div className="spinner" /></div>
        ) : !dsn ? (
          <div className="chart-subtitle" style={{ textAlign: "center", padding: "20px 0" }}>
            {t("voyager.dsn.unavailable")}
          </div>
        ) : (
          <>
            <div className="grid cols-2">
              <VoyagerContactCard n={1} contact={byCode.VGR1} t={t} />
              <VoyagerContactCard n={2} contact={byCode.VGR2} t={t} />
            </div>

            {others.length > 0 && (
              <div className="table-wrap" style={{ marginTop: 20 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t("voyager.dsn.table.station")}</th>
                      <th>{t("voyager.dsn.table.dish")}</th>
                      <th>{t("voyager.dsn.table.spacecraft")}</th>
                      <th>{t("voyager.dsn.table.rate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {others.map((c, i) => (
                      <tr key={i}>
                        <td>{c.station}</td>
                        <td className="mono">{c.dish}</td>
                        <td>{c.spacecraft}</td>
                        <td className="mono">
                          {c.down ? `${fmtInt(c.down.data_rate)} b/s · ${c.down.band}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="foot" style={{ marginTop: 12 }}>
              {t("voyager.dsn.updated", { time: fmtTime(dsn.timestamp_ms, true) })}
              {" · "}
              <a href="https://eyes.nasa.gov/dsn/dsn.html" target="_blank" rel="noopener noreferrer">
                {t("voyager.dsn.source")}
              </a>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
