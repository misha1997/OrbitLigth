import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

// Keep tooltips in the dialog's top layer when fullscreen is open, and out
// of the scrolling sidebar so its overflow cannot crop the description.
export default function OrbitalCategory({ label, description, color, checked, onChange, children }) {
  const { t } = useTranslation();
  const id = useId(), row = useRef(null), tip = useRef(null), timer = useRef(null);
  const [position, setPosition] = useState(null);
  const close = () => { clearTimeout(timer.current); setPosition(null); };
  const show = () => {
    clearTimeout(timer.current);
    const rect = row.current.getBoundingClientRect();
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 292)),
      ...(rect.bottom + 200 < window.innerHeight ? { top: rect.bottom + 8 } : { bottom: window.innerHeight - rect.top + 8 }) });
  };
  const leave = () => { timer.current = setTimeout(() => setPosition(null), 150); };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!position) return;
    const dismiss = event => {
      if (!row.current?.contains(event.target) && !tip.current?.contains(event.target)) setPosition(null);
    };
    const escape = event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setPosition(null); }
    };
    const hide = () => setPosition(null);
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [position]);
  return <div ref={row} className={`sat-layer-item ${checked ? "is-active" : ""}`}
    onMouseEnter={show} onMouseLeave={leave} onFocus={show}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
    <label className="sat-layer">
      <input type="checkbox" checked={checked} onChange={onChange} aria-describedby={position ? id : undefined} />
      <span className="sat-layer-dot" style={{ background: color }} /><span>{label}</span>{children}
    </label>
    <button type="button" className="sat-category-info" onClick={show}
      aria-label={t("orbital.categoryInfo", { name: label })} aria-describedby={position ? id : undefined}>i</button>
    {position && createPortal(<div ref={tip} id={id} role="tooltip" className="sat-category-tooltip" style={position}
      onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={leave}>
      <strong>{label}</strong><span>{description}</span>
    </div>, row.current.closest("dialog") || document.body)}
  </div>;
}
