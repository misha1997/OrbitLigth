// Account page — ported from templates/account.html's body: profile form,
// Telegram connect/disconnect, notification toggles, danger zone. Notification
// toggles are a thin passthrough to the bot's own `users` row once Telegram is
// linked (web/auth_api.py) — disabled here until then, matching the mockup's
// own "one set of subscriptions for the site and the bot" copy.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSeo } from "../hooks/useSeo";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useLoc } from "../context/LocationContext";
import { usePicker } from "../components/LocationPickerModal";
import { useTelegramWidget } from "../hooks/useOAuthWidgets";
import {
  getAuthConfig, updateProfile, updateNotifications, loginWithTelegram,
  unlinkTelegram, deleteAccount, uploadAvatar,
} from "../lib/authApi";
import { pathFor } from "../lib/seo";
import Avatar from "../components/Avatar";
import "../styles/account.css";

const SUB_TYPES = ["iss", "launches", "neo", "apod", "news", "meteors", "flares", "grb", "gw"];

function Toggle({ on, disabled, onClick }) {
  return (
    <div
      className={"toggle" + (on ? " on" : "") + (disabled ? " disabled" : "")}
      onClick={disabled ? undefined : onClick}
      role="switch"
      aria-checked={on}
    >
      <div className="knob" />
    </div>
  );
}

export default function Account() {
  useSeo();
  const { t } = useTranslation();
  const { lang } = useLang();
  const navigate = useNavigate();
  const { user, notifications, loading, refresh, logout } = useAuth();
  const { loc } = useLoc();
  const { openPicker } = usePicker();

  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState(false);
  const [config, setConfig] = useState(null);
  const [subs, setSubs] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const telegramRef = useRef(null);
  const avatarInputRef = useRef(null);

  useEffect(() => { getAuthConfig().then(setConfig).catch(() => setConfig({})); }, []);
  useEffect(() => { if (user) setUsername(user.username || ""); }, [user]);
  useEffect(() => { if (notifications?.subscriptions) setSubs(notifications.subscriptions); }, [notifications]);

  useEffect(() => {
    if (!loading && !user) navigate(pathFor("login", lang));
  }, [loading, user, navigate, lang]);

  const onTelegramAuth = async (tgUser) => {
    try {
      await loginWithTelegram(tgUser);
      await refresh();
    } catch { /* backend already surfaces a generic failure via non-2xx */ }
  };
  useTelegramWidget(telegramRef, !user?.telegram?.linked ? config?.telegram_bot_username : null, onTelegramAuth);

  if (loading || !user) return null;

  const onSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        username,
        city: loc?.label,
        lat: loc?.lat,
        lon: loc?.lon,
      });
      await refresh();
      setSavedHint(true);
      setTimeout(() => setSavedHint(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const onAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      await uploadAvatar(file);
      await refresh();
    } catch (err) {
      setAvatarError(t(`account.avatarErrors.${err.code}`, { defaultValue: t("account.avatarErrors.generic") }));
    } finally {
      setAvatarUploading(false);
    }
  };

  const onUnlinkTelegram = async () => {
    await unlinkTelegram();
    await refresh();
  };

  const onToggle = async (type) => {
    const next = { ...subs, [type]: !subs[type] };
    setSubs(next); // optimistic
    try {
      await updateNotifications({ [type]: next[type] });
    } catch {
      setSubs(subs); // revert on failure
    }
  };

  const onDelete = async () => {
    if (!window.confirm(t("account.deleteTitle") + "?")) return;
    await deleteAccount();
    await logout();
    navigate(pathFor("home", lang));
  };

  const telegramLinked = user.telegram.linked;

  return (
    <>
      <section className="page-head" style={{ marginBottom: 20}}>
        <div className="wrap">
          <div className="acc-head">
            <div
              className={"avatar-upload" + (avatarUploading ? " uploading" : "")}
              onClick={() => !avatarUploading && avatarInputRef.current?.click()}
              title={t("account.changeAvatar")}
              role="button"
              tabIndex={0}
            >
              <Avatar user={user} size={76} />
              <div className="avatar-upload-overlay">{avatarUploading ? "…" : "✎"}</div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={onAvatarChange}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="page-title" style={{ fontSize: "clamp(22px,3vw,28px)" }}>
                {user.username || user.email || "—"}
              </h1>
              <p style={{ color: "var(--text-dim)", fontSize: "13.5px", marginTop: "4px" }}>
                {user.email || "—"}
              </p>
              {avatarError && <p className="form-error" style={{ marginTop: "6px" }}>{avatarError}</p>}
              <div className="acc-badges">
                <span className="badge-chip">
                  <span className="ic">✈️</span>
                  {telegramLinked ? t("account.telegramConnected") : t("account.telegramConnectButton")}
                </span>
                {loc?.label && (
                  <span className="badge-chip"><span className="ic">📍</span>{loc.label}</span>
                )}
              </div>
            </div>
            <button type="button" className="btn ghost" onClick={() => logout().then(() => navigate(pathFor("home", lang)))}>
              {t("account.logoutButton")}
            </button>
          </div>
        </div>
      </section>

      <div className="wrap acc-grid">
        <div>
          <section className="section" style={{ paddingTop: 0 }}>
            <div className="section-head">
              <div>
                <div className="eyebrow">{t("account.profileEyebrow")}</div>
                <h2 className="section-title">{t("account.profileTitle")}</h2>
              </div>
            </div>
            <div className="card acc-card-profile">
              <form onSubmit={onSaveProfile}>
                <div className="form-grid">
                  <div className="form-row">
                    <label>{t("account.usernameLabel")}</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
                  </div>
                  <div className="form-row">
                    <label>{t("account.emailLabel")}</label>
                    <input type="email" value={user.email || ""} disabled />
                  </div>
                  <div className="form-row">
                    <label>{t("account.cityLabel")}</label>
                    <input type="text" readOnly value={loc?.label || ""} onClick={openPicker} style={{ cursor: "pointer" }} />
                  </div>
                </div>
                <button type="submit" className="btn primary" style={{ marginTop: "6px" }} disabled={saving}>
                  {t("account.saveButton")}
                </button>
                {savedHint && <span style={{ marginLeft: "12px", color: "var(--teal)", fontSize: "13px" }}>{t("account.savedHint")}</span>}
              </form>
            </div>
          </section>

          <section className="section" style={{ paddingTop: 0 }}>
            <div className="section-head">
              <div>
                <div className="eyebrow">{t("account.telegramEyebrow")}</div>
                <h2 className="section-title">{t("account.telegramTitle")}</h2>
              </div>
            </div>
            {telegramLinked ? (
              <div className="telegram-card">
                <div className="ic">✈️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "14.5px" }}>
                    {user.telegram.username ? "@" + user.telegram.username : user.telegram.first_name}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", color: "var(--text-dim)", marginTop: "3px" }}>
                    {t("account.telegramConnected")}
                  </div>
                </div>
                <button type="button" className="btn ghost" onClick={onUnlinkTelegram}>
                  {t("account.telegramDisconnectButton")}
                </button>
              </div>
            ) : (
              <div className="telegram-card not-linked">
                <div className="ic">✈️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "14.5px" }}>
                    {t("account.telegramNotConnectedTitle")}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", color: "var(--text-dim)", marginTop: "3px" }}>
                    {t("account.telegramNotConnectedDesc")}
                  </div>
                  {config?.telegram_bot_username ? (
                    <div ref={telegramRef} id="nw-telegram-login-widget" className="telegram-widget-inline" />
                  ) : config && (
                    <div className="form-hint" style={{ marginTop: "10px" }}>
                      {t("account.telegramNotConfigured")}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="section-head">
            <div>
              <div className="eyebrow">{t("account.notificationsEyebrow")}</div>
              <h2 className="section-title">{t("account.notificationsTitle")}</h2>
            </div>
          </div>
          <div className="card acc-card-notifications">
            {SUB_TYPES.map((type) => (
              <div className="settings-row" key={type}>
                <div className="si">
                  <div>
                    <h4>{t(`account.rows.${type}.title`)}</h4>
                    <p>{t(`account.rows.${type}.desc`)}</p>
                  </div>
                </div>
                <Toggle
                  on={!!(subs && subs[type])}
                  disabled={!telegramLinked || !subs}
                  onClick={() => onToggle(type)}
                />
              </div>
            ))}
          </div>
          <p className="form-hint">
            {telegramLinked ? t("account.notificationsHint") : t("account.notificationsLockedHint")}
          </p>
        </section>
      </div>

      <section className="section" id="danger">
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow">{t("account.dangerEyebrow")}</div>
              <h2 className="section-title">{t("account.dangerTitle")}</h2>
            </div>
          </div>
          <div className="danger-zone acc-danger-zone">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>{t("account.deleteTitle")}</div>
                <p style={{ color: "var(--text-dim)", fontSize: "12.5px", marginTop: "4px" }}>{t("account.deleteDesc")}</p>
              </div>
              <button type="button" className="btn-danger" onClick={onDelete}>{t("account.deleteButton")}</button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
