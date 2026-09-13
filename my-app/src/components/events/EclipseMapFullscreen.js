import { useEffect } from "react";
import { createPortal } from "react-dom";
import EclipseMap from "./EclipseMap";
import "../../styles/constellations.css";

export default function EclipseMapFullscreen({ events, lang, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 60);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, [onClose]);

  const content = (
    <div
      className="cfm-fullscreen-wrap eclipse-fs-wrap"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        display: "flex",
        flexDirection: "column",
        background: "#05060d",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={lang === "en" ? "Eclipse Map" : "Карта затемнень"}
    >
      <div className="cfm-top-bar">
        <div className="cfm-top-bar-left">
          <div className="cfm-title">
            {lang === "en" ? "Eclipse & Observation Map" : "Карта затемнень та спостережень"}
          </div>
        </div>
        <button
          className="cfm-btn cfm-btn-close"
          onClick={onClose}
          aria-label={lang === "en" ? "Close" : "Закрити"}
          title="Esc"
        >
          ✕
        </button>
      </div>

      <div
        className="sat-map-fs-body"
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <EclipseMap events={events} />
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
