import { useState, useEffect, useRef } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NAV_GROUPS } from "../../lib/constants";
import { useLang } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import Avatar from "../Avatar";
import { nameFromPath, pathFor, switchLangPath } from "../../lib/seo";
import "../../styles/navigation.css";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const headerRef = useRef(null);
  const burgerRef = useRef(null);
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { lang } = useLang();
  const { user } = useAuth();
  const currentPage = nameFromPath(pathname).name;
  const to = (name) => pathFor(name, lang);
  const close = () => { setOpen(false); setOpenGroup(null); };
  const groupActive = (group) => group.activeNames?.includes(currentPage) || group.items.some((item) => {
    const path = to(item.name);
    return pathname === path || pathname.startsWith(path + "/");
  });

  useEffect(() => { setOpen(false); setOpenGroup(null); }, [pathname, search, hash]);

  useEffect(() => {
    if (!open && !openGroup) return;
    const onPointer = (event) => {
      if (!headerRef.current?.contains(event.target)) close();
    };
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      if (openGroup) {
        headerRef.current?.querySelector(`[aria-controls="nav-${openGroup}"]`)?.focus();
        setOpenGroup(null);
      } else {
        close();
        burgerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, openGroup]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1201px)");
    const onResize = () => { setOpen(false); setOpenGroup(null); };
    desktop.addEventListener("change", onResize);
    return () => desktop.removeEventListener("change", onResize);
  }, []);

  return (
    <header className="site site-header" ref={headerRef} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) close();
    }}>
      <div className="wrap site-header-inner">
        <Link to={to("home")} className="logo" onClick={close}>
          <img className="logo-img" src="/web-app-manifest-192x192.png" alt="" aria-hidden="true" />
          <span>OrbitLight<small>{t("header.tagline")}</small></span>
        </Link>
        <button ref={burgerRef} type="button" className="site-menu-toggle" aria-controls="site-navigation"
          aria-expanded={open} aria-label={open ? t("navigation.closeMenu") : t("header.menu")}
          onClick={() => { setOpen((current) => !current); setOpenGroup(null); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d={open ? "m6 6 12 12M6 18 18 6" : "M4 6h16M4 12h16M4 18h16"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg><span>{t("header.menu")}</span>
        </button>
        <div id="site-navigation" className={"site-navigation" + (open ? " is-open" : "")}>
          <nav className="primary-nav" aria-label={t("navigation.primary")}>
            {NAV_GROUPS.map((group) => group.items ? (
              <div key={group.id} className={"site-nav-group" + (groupActive(group) ? " is-active" : "")}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setOpenGroup((current) => current === group.id ? null : current);
                  }
                }}>
                <button type="button" className="site-nav-trigger" aria-expanded={openGroup === group.id}
                  aria-controls={`nav-${group.id}`} onClick={() => setOpenGroup((current) => current === group.id ? null : group.id)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setOpenGroup(group.id);
                      requestAnimationFrame(() => document.getElementById(`nav-${group.id}`)?.querySelector("a")?.focus());
                    }
                  }}>
                  {t(group.labelKey)}<svg className="site-nav-chevron" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" /></svg>
                </button>
                <div id={`nav-${group.id}`} className="site-nav-panel" hidden={openGroup !== group.id}>
                  {group.items.map((item) => <NavLink key={item.name} to={to(item.name)} end={item.end} onClick={close}>
                    {t(item.labelKey)}
                  </NavLink>)}
                </div>
              </div>
            ) : <NavLink key={group.name} to={to(group.name)} end={group.end} onClick={close}>{t(group.labelKey)}</NavLink>)}
          </nav>
          <div className="site-nav-tools">
            <span className="lang-switch" role="group" aria-label={t("navigation.language")}>
              {["uk", "en"].map((code) => <button key={code} type="button"
                className={"lang-btn " + code + (lang === code ? " active" : "")}
                onClick={() => navigate(switchLangPath(pathname, code) + search + hash)} aria-pressed={lang === code}
                aria-label={code === "uk" ? "Українська" : "English"} lang={code}>
                {code === "uk" ? "UA" : "EN"}
              </button>)}
            </span>
            {user ? <NavLink to={to("account")} className="site-account-link" onClick={close}
              title={user.username || t("header.myAccount")} aria-label={t("header.myAccount")}>
              <Avatar user={user} size={32} />
            </NavLink> : <div className="site-auth-links">
              <NavLink to={to("login")} onClick={close}>{t("header.login")}</NavLink>
              <NavLink to={to("register")} className="site-signup" onClick={close}>{t("header.register")}</NavLink>
            </div>}
          </div>
        </div>
      </div>
    </header>
  );
}
