// Loads the Telegram Login Widget / Google Identity Services button on
// demand (Login.js + Register.js only) and wires their callbacks. Both are
// external scripts, not npm packages — see web/auth.py for how each result
// is verified server-side.
import { useEffect } from "react";

export function useTelegramWidget(containerRef, botUsername, onAuth, lang) {
  useEffect(() => {
    if (!botUsername || !containerRef.current) return;
    window.nwTelegramAuth = onAuth;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "9");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-lang", lang === "uk" ? "uk" : "en");
    script.setAttribute("data-onauth", "nwTelegramAuth(user)");
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(script);
    return () => { delete window.nwTelegramAuth; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botUsername, lang]);
}

export function useGoogleButton(containerRef, clientId, onCredential, lang) {
  useEffect(() => {
    if (!clientId || !containerRef.current) return;
    let cancelled = false;
    const init = () => {
      if (cancelled || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => onCredential(resp.credential),
      });
      // filled_black had near-zero contrast against this site's near-black
      // --bg (#090A14) — outline is Google's own high-contrast default and
      // reads as a real button rather than a barely-visible box.
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        shape: "rectangular",
        text: "continue_with",
        logo_alignment: "left",
        width: Math.min((containerRef.current.clientWidth || 360) - 2, 400),
      });
    };
    if (window.google?.accounts?.id) {
      init();
    } else {
      const script = document.createElement("script");
      // hl pins the button's own label to the site's UK/EN language instead
      // of following the browser locale (was rendering Russian on a site
      // that is deliberately UK/EN-only — see CLAUDE.md).
      script.src = `https://accounts.google.com/gsi/client?hl=${lang === "uk" ? "uk" : "en"}`;
      script.async = true;
      script.defer = true;
      script.onload = init;
      document.head.appendChild(script);
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, lang]);
}
