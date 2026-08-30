// Loads the Telegram Login Widget / Google Identity Services button on
// demand (Login.js + Register.js only) and wires their callbacks. Both are
// external scripts, not npm packages — see web/auth.py for how each result
// is verified server-side.
//
// Neither vendor's own rendered button can be restyled to match this site's
// dark theme (Telegram's is a fixed-color iframe; Google's official themes
// are either a stark white card or near-invisible on a near-black page —
// see git history on this file for the attempts). Both hooks instead back a
// custom-styled button rendered by the page (see .oauth-custom-btn in
// account.css): Google via its documented google.accounts.id.prompt() call,
// which can be triggered from any real click handler with no vendor iframe
// on screen at all; Telegram via its real (but invisible) iframe stacked
// under the custom button, since Telegram has no prompt()-style equivalent
// and its popup must originate from a genuine click landing on its own
// iframe.
import { useEffect, useRef, useState } from "react";

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

// Returns { signIn, fallback }: call signIn() from a button's onClick;
// fallback flips true if Google's One Tap prompt couldn't be shown (e.g.
// browser third-party-cookie/FedCM restrictions, or the user dismissed it
// too many times) — render the official renderButton() into fallbackRef
// when that happens, since prompt() alone isn't guaranteed to work.
export function useGoogleButton(fallbackRef, clientId, onCredential, lang) {
  const [fallback, setFallback] = useState(false);
  // onCredential is a fresh inline function on every render of Login/Register;
  // reading it via a ref (instead of listing it as an effect dependency)
  // keeps this effect from tearing down and reloading the GSI script on
  // every render — it only needs to run once per clientId/lang change.
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    setFallback(false);
    if (!clientId) return;
    let cancelled = false;
    const init = () => {
      if (cancelled || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => onCredentialRef.current(resp.credential),
      });
    };
    // hl pins the label to the site's UK/EN language instead of following
    // the browser/account locale (was rendering Russian on a site that is
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
  }, [clientId, lang]);

  useEffect(() => {
    if (!fallback || !fallbackRef.current || !window.google?.accounts?.id) return;
    fallbackRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(fallbackRef.current, {
      theme: "filled_blue",
      size: "large",
      shape: "rectangular",
      text: "continue_with",
      logo_alignment: "left",
    });
  }, [fallback, fallbackRef]);

  const signIn = () => {
    if (!window.google?.accounts?.id) return;
    // A FedCM-disabled browser (Chrome's own cooldown after repeated
    // dismissals, or a user turning off third-party sign-in) makes the
    // underlying navigator.credentials.get() reject — and Google's library
    // just logs that rejection to the console and never calls this callback
    // at all, so isNotDisplayed() below never runs either. A button that
    // silently does nothing is worse than an unnecessary fallback, so a
    // timer backstops the callback: no response within ~1.8s (a real prompt
    // renders near-instantly) is treated the same as isNotDisplayed().
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setFallback(true);
      }
    }, 1800);
    window.google.accounts.id.prompt((notification) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // isNotDisplayed() = a real failure (browser/FedCM couldn't render the
      // prompt at all) — that's when the fallback button is warranted.
      // isSkippedMoment() just means the user dismissed/declined it (Esc,
      // clicked outside, "Cancel") — a normal outcome, not a failure; falling
      // back to Google's own button on every decline was the bug here.
      if (notification.isNotDisplayed?.()) {
        setFallback(true);
      }
    });
  };

  return { signIn, fallback };
}
