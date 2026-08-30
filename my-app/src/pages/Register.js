// Email/password registration + "Continue with Google" + "Continue with
// Telegram" — the same three sign-up paths as Login.js, since a Google/
// Telegram click on either page finds-or-creates the account server-side
// (web/auth_api.py's /google and /telegram handlers).
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSeo } from "../hooks/useSeo";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useGoogleButton, useTelegramWidget } from "../hooks/useOAuthWidgets";
import { getAuthConfig, registerAccount, loginWithGoogle, loginWithTelegram } from "../lib/authApi";
import { pathFor } from "../lib/seo";
import LocalizedLink from "../components/primitives/LocalizedLink";
import { GoogleIcon, TelegramShareIcon } from "../lib/icons";
import "../styles/account.css";

export default function Register() {
  useSeo();
  const { t } = useTranslation();
  const { lang } = useLang();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState(null);
  const googleFallbackRef = useRef(null);
  const telegramRef = useRef(null);

  useEffect(() => { getAuthConfig().then(setConfig).catch(() => setConfig({})); }, []);

  const afterAuth = async () => {
    await refresh();
    navigate(pathFor("account", lang));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await registerAccount(email, password, username || undefined);
      await afterAuth();
    } catch (err) {
      setError(t(`auth.errors.${err.code}`, { defaultValue: t("auth.errors.generic") }));
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogleCredential = async (idToken) => {
    setError(null);
    try {
      await loginWithGoogle(idToken);
      await afterAuth();
    } catch {
      setError(t("auth.errors.generic"));
    }
  };

  const onTelegramAuth = async (tgUser) => {
    setError(null);
    try {
      await loginWithTelegram(tgUser);
      await afterAuth();
    } catch {
      setError(t("auth.errors.generic"));
    }
  };

  const { signIn: googleSignIn, fallback: googleFallback } =
    useGoogleButton(googleFallbackRef, config?.google_client_id, onGoogleCredential, lang);
  useTelegramWidget(telegramRef, config?.telegram_bot_username, onTelegramAuth, lang);

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1 className="page-title" style={{ fontSize: "24px", marginBottom: "22px" }}>
          {t("auth.registerTitle")}
        </h1>

        <form onSubmit={onSubmit}>
          <div className="form-row">
            <label>{t("auth.usernameLabel")}</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="form-row">
            <label>{t("auth.emailLabel")}</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-row">
            <label>{t("auth.passwordLabel")}</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={submitting}>
            {t("auth.registerButton")}
          </button>
        </form>

        {(config?.telegram_bot_username || config?.google_client_id) && (
          <div className="auth-divider">{t("auth.orDivider")}</div>
        )}
        {config?.telegram_bot_username && (
          <div className="oauth-custom-wrap">
            <div className="oauth-custom-btn" aria-hidden="true">
              <span className="oauth-custom-icon telegram"><TelegramShareIcon size={14} /></span>
              <span>{t("auth.telegramButton")}</span>
            </div>
            <div ref={telegramRef} className="oauth-real-overlay" />
          </div>
        )}
        {config?.google_client_id && (
          <div className="oauth-custom-wrap">
            {!googleFallback ? (
              <button type="button" className="oauth-custom-btn" onClick={googleSignIn}>
                <span className="oauth-custom-icon google"><GoogleIcon size={14} /></span>
                <span>{t("auth.googleButton")}</span>
              </button>
            ) : (
              <div ref={googleFallbackRef} className="oauth-fallback" />
            )}
          </div>
        )}

        <div className="auth-switch">
          {t("auth.haveAccount")}{" "}
          <LocalizedLink to="login">{t("auth.toLogin")}</LocalizedLink>
        </div>
      </div>
    </div>
  );
}
