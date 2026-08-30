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
      if (cancelled || !window.google?.accounts?.id || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => onCredential(resp.credential),
      });
      containerRef.current.innerHTML = "";
      // "outline" is Google's white-card default — a stark white rectangle
      // on this site's near-black --bg (#090A14). "filled_black" goes the
      // other way and nearly disappears against that same background.
      // filled_blue is the one official theme with real color of its own,
      // so it reads as a normal button in either direction. No `width`
      // override: an iframe wider than Google's own button left a visible
      // canvas around a smaller centered button — .auth-oauth-btn's flex
      // centering handles placement instead.
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "filled_blue",
        size: "large",
        shape: "rectangular",
        text: "continue_with",
        logo_alignment: "left",
      });
    };
    // hl pins the button's own label to the site's UK/EN language instead of
    // following the browser locale (was rendering Russian on a site that is
    // deliberately UK/EN-only — see CLAUDE.md). It only takes effect on the
    // script's *first* load per page, so always reload it here — reusing an
    // already-loaded window.google from a previous mount (e.g. Login <->
    // Register nav, or a language switch) would silently keep whatever
    // locale that first load happened to use.
    const scriptId = "nw-google-gsi-script";
    document.getElementById(scriptId)?.remove();
    delete window.google;
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://accounts.google.com/gsi/client?hl=${lang === "uk" ? "uk" : "en"}`;
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.head.appendChild(script);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, lang]);
}
