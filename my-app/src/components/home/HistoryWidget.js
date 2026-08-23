import { useLang } from "../../context/LanguageContext";
import { useApi } from "../../hooks/useApi";
import { getHistoryToday } from "../../lib/api";

export default function HistoryWidget() {
  const { lang } = useLang();
  const { data: historyEvent, loading } = useApi(() => getHistoryToday(lang), { deps: [lang] });

  if (loading || !historyEvent) return null;

  return (
    <div style={{
      position: "relative",
      overflow: "hidden",
      background: "linear-gradient(135deg, rgba(20, 24, 40, 0.95) 0%, rgba(10, 12, 20, 0.95) 100%)",
      border: "1px solid rgba(100, 150, 255, 0.2)",
      borderRadius: "16px",
      padding: "24px",
      marginBottom: "32px",
      display: "flex",
      alignItems: "flex-start",
      gap: "20px",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(100, 150, 255, 0.05)"
    }}>
      {/* Decorative accent line */}
      <div style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: "4px",
        background: "linear-gradient(to bottom, #4facfe 0%, #00f2fe 100%)"
      }} />

      {/* Icon */}
      <div style={{
        flexShrink: 0,
        width: "48px",
        height: "48px",
        borderRadius: "12px",
        background: "rgba(100, 150, 255, 0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid rgba(100, 150, 255, 0.2)"
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4facfe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      </div>

      <div style={{ flex: 1, zIndex: 2 }}>
        <div style={{ 
          fontSize: "0.85rem", 
          textTransform: "uppercase", 
          letterSpacing: "1px", 
          color: "#4facfe", 
          fontWeight: 600,
          marginBottom: "8px" 
        }}>
          {lang === "uk" ? (historyEvent.isToday ? "🗓 Цього дня в історії" : "🗓 У цей місяць в історії") : (historyEvent.isToday ? "🗓 On This Day in History" : "🗓 This Month in History")}
        </div>
        
        <h3 style={{ 
          margin: "0 0 10px 0", 
          fontSize: "1.4rem", 
          color: "#fff",
          textShadow: "0 2px 10px rgba(255, 255, 255, 0.1)"
        }}>
          {historyEvent.d} {lang === "uk" ? [
            "січня", "лютого", "березня", "квітня", "травня", "червня", 
            "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"
          ][historyEvent.m - 1] : [
            "January", "February", "March", "April", "May", "June", 
            "July", "August", "September", "October", "November", "December"
          ][historyEvent.m - 1]} {historyEvent.year}
        </h3>
        
        <p style={{ 
          margin: 0, 
          color: "rgba(255, 255, 255, 0.8)", 
          lineHeight: 1.6,
          fontSize: "1.05rem" 
        }}>
          {historyEvent.text}
        </p>
      </div>

      {/* Decorative stars */}
      <div style={{
        position: "absolute",
        top: "-20px",
        right: "-20px",
        opacity: 0.05,
        pointerEvents: "none",
        zIndex: 1
      }}>
        <svg width="150" height="150" viewBox="0 0 24 24" fill="white">
          <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" />
        </svg>
      </div>
    </div>
  );
}
