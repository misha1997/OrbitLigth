import { useTranslation } from "react-i18next";
import { useLang } from "../../context/LanguageContext";
import { useApi } from "../../hooks/useApi";
import { getHistoryToday } from "../../lib/api";
import Eyebrow from "../primitives/Eyebrow";

export default function HistoryWidget() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { data: historyEvent, loading } = useApi(() => getHistoryToday(lang), { deps: [lang] });

  if (loading || !historyEvent) return null;

  const date = new Date(Date.UTC(historyEvent.year, historyEvent.m - 1, historyEvent.d));
  const dateText = date.toLocaleDateString(lang === "en" ? "en-GB" : "uk-UA", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="card history-card">
      <div className="history-icon-wrap">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)"
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15.5 14" />
        </svg>
      </div>
      <div>
        <Eyebrow gold>{historyEvent.isToday ? t("home.history.today") : t("home.history.thisMonth")}</Eyebrow>
        <h3 className="history-title">{dateText}</h3>
        <p className="history-text">{historyEvent.text}</p>
      </div>
    </div>
  );
}
