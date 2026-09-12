import { useTranslation } from "react-i18next";

export default function MissionTimeline({ events }) {
  const { t } = useTranslation();
  
  return (
    <div style={{ marginTop: 40, width: "100%" }}>
      {events.map((k, i) => (
        <div key={k} style={{ 
          position: "relative", 
          display: "flex",
          gap: 80,
          paddingBottom: i === events.length - 1 ? 0 : 48
        }}>
          
          {/* Vertical Connecting Line */}
          {i !== events.length - 1 && (
            <div style={{
              position: "absolute", left: "200px", top: "32px", bottom: "-16px", width: 2,
              background: "linear-gradient(to bottom, var(--gold) 0%, var(--border) 15%, var(--border) 100%)",
              transform: "translateX(-50%)",
              opacity: 0.6
            }} />
          )}
          
          {/* Glowing Node Dot */}
          <div style={{
            position: "absolute", left: "200px", top: "24px", width: 12, height: 12,
            borderRadius: "50%", background: "var(--gold)",
            boxShadow: "0 0 14px var(--gold)", zIndex: 2,
            transform: "translate(-50%, -50%)"
          }} />
          
          {/* Left Side: Tag/Date */}
          <div style={{ 
            flex: "0 0 160px", textAlign: "right", paddingTop: 16,
            fontFamily: "var(--font-mono)", fontSize: "0.95rem", color: "var(--gold)", 
            textTransform: "uppercase", letterSpacing: ".05em"
          }}>
            {t(`parker.timeline.${k}_tag`)}
          </div>

          {/* Right Side: Timeline Card */}
          <div style={{ 
            flex: "1 1 0",
            background: "var(--panel-solid)", padding: "24px 32px", 
            borderRadius: 16, border: "1px solid var(--border)",
            transition: "transform 0.2s ease",
            cursor: "default"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateX(8px)"; e.currentTarget.style.borderColor = "var(--gold)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            <h3 style={{ fontSize: "1.45rem", margin: "0 0 12px 0", color: "var(--text)" }}>
              {t(`parker.timeline.${k}_title`)}
            </h3>
            <p style={{ margin: 0, color: "var(--text-dim)", lineHeight: 1.65, fontSize: "1.05rem" }}>
              {t(`parker.timeline.${k}_body`)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
