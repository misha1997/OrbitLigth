// Shell for every /admin/* section: sidebar nav + topbar + <Outlet/>. Owns
// the single admin gate (loading / not-signed-in / not-admin) so individual
// pages (AdminNews.js etc.) can assume they're only ever rendered for a
// signed-in admin — the real gate is still server-side, on every
// /api/admin/* call (web.auth.get_current_admin); this is ergonomics only.
//
// Deliberately its own neutral dark palette (see admin.css's `.adm-root`
// tokens) rather than the public site's cosmic navy/gold/teal theme — this
// is an internal tool, styled like one.
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { GridIcon, NewspaperIcon, UsersIcon, ImageIcon, SparkleIcon, LogOutIcon, ExternalLinkIcon, UserCircleIcon } from "../../lib/adminIcons";
import "../../styles/admin.css";

const NAV = [
  { to: "/admin", label: "Дашборд", end: true, icon: GridIcon },
  { to: "/admin/news", label: "Новини", icon: NewspaperIcon },
  { to: "/admin/users", label: "Користувачі", icon: UsersIcon },
  { to: "/admin/photos", label: "Фотоархів", icon: ImageIcon },
  { to: "/admin/galaxies", label: "Галактики", icon: SparkleIcon },
];

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="adm-root">
        <div className="adm-shell"><p className="adm-hint">Завантаження…</p></div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="adm-root">
        <div className="adm-shell">
          <div className="adm-card adm-gate">
            <h1>Адмін-панель</h1>
            <p>Увійдіть у свій акаунт на сайті (з правами адміністратора), потім оновіть цю сторінку.</p>
            <a className="btn primary" href="/en/login">Увійти</a>
          </div>
        </div>
      </div>
    );
  }
  if (!user.is_admin) {
    return (
      <div className="adm-root">
        <div className="adm-shell">
          <div className="adm-card adm-gate">
            <h1>Немає доступу</h1>
            <p>Акаунт {user.email || user.username} не має прав адміністратора.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="adm-root">
      <div className="adm-dash">
        <aside className="adm-sidebar">
          <div className="adm-brand">
            <span className="adm-brand-mark">O</span>
            <span>OrbitLight</span>
          </div>
          <nav className="adm-nav">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => "adm-nav-link" + (isActive ? " active" : "")}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>
        <div className="adm-main">
          <header className="adm-topbar">
            <a className="adm-topbar-site" href="/">
              <ExternalLinkIcon size={13} />
              <span>На сайт</span>
            </a>
            <div className="adm-topbar-user">
              <span className="adm-pill adm-role-admin">{user.role}</span>
              {user.avatar_url
                ? <img className="adm-avatar" src={user.avatar_url} alt="" />
                : <div className="adm-avatar adm-avatar-ph"><UserCircleIcon size={18} /></div>}
              <span className="adm-topbar-username">{user.username || user.email}</span>
              <button className="adm-icon-btn" title="Вийти" onClick={logout}>
                <LogOutIcon size={16} />
              </button>
            </div>
          </header>
          <div className="adm-content">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
