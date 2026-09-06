// /admin/users — website accounts (web_users) + role management. See
// AdminLayout.js for the shell this renders inside.
//
// "Роль" is the DB-backed replacement for the old ADMIN_EMAILS allowlist
// (see web/auth.py, database.py's web_users.role migration) — only 'user'
// and 'admin' exist today, but it's a free column so more roles are just
// new <option>s + a backend allow-list entry, not a schema change.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { listUsers, updateUserRole } from "../../lib/adminApi";
import { SearchIcon, UserCircleIcon, ChevronLeftIcon, ChevronRightIcon } from "../../lib/adminIcons";
import "../../styles/admin.css";

const PAGE_SIZE = 30;
const ROLES = ["user", "admin"];

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    listUsers({ page, pageSize: PAGE_SIZE, q })
      .then((data) => { setRows(data.users); setTotal(data.total); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, q]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const id = setTimeout(() => { setPage(1); setQ(qInput.trim()); }, 350);
    return () => clearTimeout(id);
  }, [qInput]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const changeRole = async (id, role) => {
    setBusyId(id);
    setError(null);
    try {
      await updateUserRole(id, role);
      refresh();
    } catch (e) {
      setError(
        e.code === "self_role_change" ? "Не можна змінити власну роль"
        : "Помилка: " + e.message
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-head">
        <h1>Користувачі</h1>
      </div>

      <div className="adm-card adm-card-stack">
        <div className="adm-toolbar">
          <div className="adm-search-wrap">
            <SearchIcon />
            <input
              className="adm-search"
              placeholder="Пошук за email/іменем…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="adm-error">{error}</p>}

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th></th>
                <th>Акаунт</th>
                <th>Роль</th>
                <th>Telegram</th>
                <th>Реєстрація</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="adm-hint">Завантаження…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="adm-hint">Нічого не знайдено.</td></tr>
              )}
              {rows.map((u) => {
                const isSelf = me && me.id === u.id;
                return (
                  <tr key={u.id}>
                    <td>
                      {u.avatar_url
                        ? <img className="adm-avatar" src={u.avatar_url} alt="" />
                        : <div className="adm-avatar adm-avatar-ph"><UserCircleIcon size={16} /></div>}
                    </td>
                    <td>
                      <div className="adm-row-title">{u.username || "—"}</div>
                      <div className="adm-row-meta"><span>{u.email || "без email"}</span></div>
                    </td>
                    <td>
                      <select
                        value={u.role}
                        disabled={isSelf || busyId === u.id}
                        title={isSelf ? "Не можна змінити власну роль" : undefined}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td>{u.telegram_linked ? (u.telegram_username ? `@${u.telegram_username}` : "підключено") : "—"}</td>
                    <td className="adm-hint">{u.created_at ? u.created_at.slice(0, 10) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="adm-pager">
            <button className="adm-icon-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeftIcon /></button>
            <span>Сторінка {page} з {totalPages} ({total})</span>
            <button className="adm-icon-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRightIcon /></button>
          </div>
        )}
      </div>
    </div>
  );
}
