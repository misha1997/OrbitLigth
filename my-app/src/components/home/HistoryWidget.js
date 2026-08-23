import { useLang } from "../../context/LanguageContext";
import { useApi } from "../../hooks/useApi";
import { getHistoryToday } from "../../lib/api";

export default function HistoryWidget() {
  const { lang } = useLang();
  const { data: historyEvent, loading } = useApi(() => getHistoryToday(lang), { deps: [lang] });

  if (loading || !historyEvent) return null;

  return (
    <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", padding: 24, borderRadius: 12, marginBottom: 32 }}>
      <div className="cat-tag" style={{ color: "var(--text-bright)", marginBottom: 8 }}>
        {lang === "uk" ? (historyEvent.isToday ? "Цього дня в історії" : "У цей місяць в історії") : (historyEvent.isToday ? "On This Day in History" : "This Month in History")}
      </div>
      <h3 style={{ margin: "0 0 8px 0", fontSize: "1.2rem", color: "var(--text-bright)" }}>
        {historyEvent.d} {lang === "uk" ? [
          "січня", "лютого", "березня", "квітня", "травня", "червня", 
          "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"
        ][historyEvent.m - 1] : [
          "January", "February", "March", "April", "May", "June", 
          "July", "August", "September", "October", "November", "December"
        ][historyEvent.m - 1]} {historyEvent.year}
      </h3>
      <p style={{ margin: 0, color: "var(--text-dim)", lineHeight: 1.5 }}>
        {historyEvent.text}
      </p>
    </div>
  );
}
