// Bare full-viewport layout for /embed/* routes — no Header/Footer/Starfield/
// CookieBanner. Every other route in the app goes through Layout.js, which
// renders that chrome unconditionally; an iframe-embedded widget needs none
// of it, just the page's own content filling the frame.
import { Outlet } from "react-router-dom";

export default function EmbedLayout() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#090A14" }}>
      <Outlet />
    </div>
  );
}
