// Email/password login + "Continue with Google" + "Continue with Telegram".
// Google Identity Services and the Telegram Login Widget are both loaded as
// external scripts on demand (only on Login/Register), not bundled — see
// web/auth.py for how each is verified server-side.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSeo } from "../hooks/useSeo";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useGoogleButton, useTelegramWidget } from "../hooks/useOAuthWidgets";
import { getAuthConfig, loginAccount, loginWithGoogle, loginWithTelegram } from "../lib/authApi";
import { pathFor } from "../lib/seo";
import LocalizedLink from "../components/primitives/LocalizedLink";
import "../styles/account.css";

export default function Login() {
  useSeo();
  const { t } = useTranslation();
  const { lang } = useLang();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState(null);
  const googleRef = useRef(null);
  const telegramRef = useRef(null);

  useEffect(() => { getAuthConfig().then(setConfig).catch(() => setConfig({})); }, []);

  const afterLogin = async () => {
    await refresh();
    navigate(pathFor("account", lang));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginAccount(email, password);
      await afterLogin();
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
      await afterLogin();
    } catch {
      setError(t("auth.errors.generic"));
    }
  };

  const onTelegramAuth = async (tgUser) => {
    setError(null);
    try {
      await loginWithTelegram(tgUser);
      await afterLogin();
    } catch {
      setError(t("auth.errors.generic"));
    }
  };

  useGoogleButton(googleRef, config?.google_client_id, onGoogleCredential, lang);
  useTelegramWidget(telegramRef, config?.telegram_bot_username, onTelegramAuth, lang);

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1 className="page-title" style={{ fontSize: "24px", marginBottom: "22px" }}>
          {t("auth.loginTitle")}
        </h1>

        <form onSubmit={onSubmit}>
          <div className="form-row">
            <label>{t("auth.emailLabel")}</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-row">
            <label>{t("auth.passwordLabel")}</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={submitting}>
            {t("auth.loginButton")}
          </button>
        </form>

        {(config?.telegram_bot_username || config?.google_client_id) && (
          <div className="auth-divider">{t("auth.orDivider")}</div>
        )}
        {config?.telegram_bot_username && <div ref={telegramRef} id="nw-telegram-login-widget" />}
        {config?.google_client_id && <div ref={googleRef} className="auth-oauth-btn" />}

        <p className="form-hint">{t("auth.noResetNotice")}</p>
        <div className="auth-switch">
          {t("auth.noAccount")}{" "}
          <LocalizedLink to="register">{t("auth.toRegister")}</LocalizedLink>
        </div>
      </div>
    </div>
  );
}
