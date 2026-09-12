import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { getMastJwstRecent } from "../../lib/api";

export default function RecentlyObservedJwst() {
  const { t } = useTranslation();
  const { data } = useApi(getMastJwstRecent);
  const [idx, setIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!data || data.length <= 1 || isHovered) return;
    const timer = setInterval(() => {
      setIdx((i) => (i + 1) % data.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [data, isHovered]);

  const current = data && data.length > 0 ? data[idx] : null;

  return (
    <div 
      className="card" 
      style={{ 
        padding: 0, 
        overflow: "hidden", 
        width: "100%", 
        display: "flex",
        flexWrap: "wrap",
        position: "relative" 
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!data && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, width: "100%", color: "var(--text-dim)" }}>
          {t("jwst.recentlyObserved.loading", "Завантаження...")}
        </div>
      )}
      {data && !current && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, width: "100%" }}>
          <p className="section-sub">{t("jwst.recentlyObserved.empty", "Немає нещодавніх спостережень.")}</p>
        </div>
      )}
      
      {current && (
        <>
          {/* Image Area - Left Side */}
          <div style={{ 
            flex: "1 1 55%", 
            minWidth: 320,
            position: "relative",
            backgroundColor: "#000",
            minHeight: 380
          }}>
            {data.map((item, i) => (
              <img 
                key={i} 
                src={item.jpeg_url} 
                alt={item.target} 
                loading="lazy"
                style={{ 
                  width: "100%", 
                  height: "100%", 
                  objectFit: "cover", 
                  position: "absolute", 
                  top: 0, left: 0,
                  opacity: i === idx ? 1 : 0,
                  transition: "opacity 0.6s ease-in-out"
                }} 
              />
            ))}
            
            {/* Arrows */}
            {data.length > 1 && (
              <>
                <button 
                  onClick={(e) => { e.preventDefault(); setIdx((i) => (i - 1 + data.length) % data.length); }}
                  style={{ 
                    position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", 
                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", border: "none", color: "#fff", 
                    width: 40, height: 40, borderRadius: "50%", cursor: "pointer", zIndex: 10, 
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
                    opacity: isHovered ? 1 : 0.5, transition: "opacity 0.3s"
                  }}
                >
                  ‹
                </button>
                <button 
                  onClick={(e) => { e.preventDefault(); setIdx((i) => (i + 1) % data.length); }}
                  style={{ 
                    position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", 
                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", border: "none", color: "#fff", 
                    width: 40, height: 40, borderRadius: "50%", cursor: "pointer", zIndex: 10, 
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
                    opacity: isHovered ? 1 : 0.5, transition: "opacity 0.3s"
                  }}
                >
                  ›
                </button>
                
                {/* Dots indicator inside image */}
                <div style={{ 
                  position: "absolute", bottom: 0, left: 0, width: "100%", 
                  display: "flex", justifyContent: "center", gap: 8, zIndex: 10,
                  padding: "40px 0 16px 0",
                  background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)"
                }}>
                  {data.map((_, i) => (
                    <div 
                      key={i} 
                      onClick={() => setIdx(i)}
                      style={{ 
                        width: i === idx ? 20 : 8, height: 8, borderRadius: 4, 
                        background: i === idx ? "var(--gold)" : "rgba(255,255,255,0.7)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.8)",
                        cursor: "pointer", transition: "all 0.3s" 
                      }} 
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Text Info Area - Right Side */}
          <div style={{ 
            flex: "1 1 45%", 
            minWidth: 320,
            padding: "40px", 
            display: "flex", 
            flexDirection: "column",
            justifyContent: "center",
            borderLeft: "1px solid var(--border)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
               <span style={{ background: "var(--gold)", color: "#000", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>JWST</span>
               <span style={{ color: "var(--text-dim)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
                 {current.instrument.replace("JWST · ", "")}
               </span>
            </div>
            
            <div className="foot" style={{ marginBottom: 4 }}>{t("jwst.recentlyObserved.targetLabel", "Ціль спостереження")}</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 32, lineHeight: 1.2, color: "var(--text)" }}>
              {current.target}
            </div>
            
            <div style={{ marginTop: 24 }}>
              <div className="foot">{t("jwst.recentlyObserved.dateLabel", "Дата публікації")}</div>
              <div style={{ fontSize: 16, marginTop: 2 }}>{current.date}</div>
            </div>
            
            <div style={{ marginTop: 16 }}>
              <div className="foot">{t("jwst.recentlyObserved.coordsLabel", "Координати")}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, marginTop: 4, color: "var(--text)" }}>{current.coords}</div>
            </div>

            <div style={{ marginTop: "auto", paddingTop: 32 }}>
              <a 
                href={`https://mast.stsci.edu/portal/Mashup/Clients/Mast/Portal.html?searchQuery=${encodeURIComponent(current.target)}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="btn ghost"
                style={{ width: "100%", justifyContent: "center" }}
              >
                {t("jwst.recentlyObserved.viewOnMast", "Переглянути в архіві MAST")} ↗
              </a>
              <p className="foot" style={{ marginTop: 16, fontSize: 12, textAlign: "center" }}>
                {t("jwst.recentlyObserved.disclaimer", "Показано 5 останніх загальнодоступних наукових зображень з архіву (без врахування калібрувальних кадрів).")}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
