// /admin/news — news list section of the admin dashboard (see
// AdminLayout.js for the shell/nav/gate this renders inside). Editing
// happens on its own full-page route (AdminNewsEditor.js) rather than a
// modal, so the body-text editors have room to breathe. A maintainer tool,
// not site content, so it's single-language (Ukrainian, matching the
// maintainer) rather than wired into i18n/seo.js.
//
// Gated twice: AdminLayout hides the UI client-side, and every /api/admin/*
// call is gated again server-side (web.auth.get_current_admin) — the client
// check is only ergonomics, never treat it as the real gate.
//
// Edits write directly to news_articles, the same table the public site
// reads from — there is no draft/preview step, a save is live immediately.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listNews, deleteNewsArticle } from "../../lib/adminApi";
import { SearchIcon, PencilIcon, TrashIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon, ImageIcon } from "../../lib/adminIcons";
import "../../styles/admin.css";

const CATEGORIES = ["launches", "missions", "discoveries", "tech"];
const CATEGORY_LABELS = {
  launches: "Запуски", missions: "Місії", discoveries: "Відкриття", tech: "Технології",
};
const PAGE_SIZE = 30;

export default function AdminNews() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [category, setCategory] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(() => {
    setListLoading(true);
    setListError(null);
    listNews({ page, pageSize: PAGE_SIZE, q, category })
      .then((data) => { setRows(data.articles); setTotal(data.total); })
      .catch((e) => setListError(e.message))
      .finally(() => setListLoading(false));
  }, [page, q, category]);

  useEffect(() => { refresh(); }, [refresh]);

  // Debounce the search box into `q` (which drives the actual fetch).
  useEffect(() => {
    const id = setTimeout(() => { setPage(1); setQ(qInput.trim()); }, 350);
    return () => clearTimeout(id);
  }, [qInput]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const remove = async (id) => {
    if (!window.confirm("Видалити цю статтю назавжди?")) return;
    setBusyId(id);
    try {
      await deleteNewsArticle(id);
      refresh();
    } catch (e) {
      setListError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-card adm-card-stack">
        <div className="adm-head">
          <h1>Новини</h1>
          <button className="btn primary" onClick={() => navigate("/admin/news/new")}>
            <PlusIcon size={15} /> Нова стаття
          </button>
        </div>

        <div className="adm-toolbar">
          <div className="adm-search-wrap">
            <SearchIcon />
            <input
              className="adm-search"
              placeholder="Пошук за заголовком/описом…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
            />
          </div>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
            <option value="">Усі категорії</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>

        {listError && <p className="adm-error">{listError}</p>}

        <div className="adm-list">
          {listLoading && <p className="adm-hint">Завантаження…</p>}
          {!listLoading && rows.length === 0 && <p className="adm-hint">Нічого не знайдено.</p>}
          {rows.map((a) => (
            <div className="adm-row" key={a.id}>
              {a.image
                ? <img className="adm-thumb" src={a.image} alt="" />
                : <div className="adm-thumb adm-thumb-ph adm-thumb-empty"><ImageIcon size={16} /></div>}
              <div className="adm-row-info">
                <div className="adm-row-title">{a.title_uk || a.title}</div>
                <div className="adm-row-meta">
                  <span className={"adm-pill adm-cat-" + a.category}>{CATEGORY_LABELS[a.category] || a.category}</span>
                  <span>{a.source}</span>
                  {a.published_date && <span>{a.published_date}</span>}
                  <span className="adm-slug">/{a.slug}</span>
                </div>
              </div>
              <div className="adm-row-actions">
                <button className="adm-icon-btn" title="Редагувати" disabled={busyId === a.id} onClick={() => navigate(`/admin/news/${a.id}`)}>
                  <PencilIcon />
                </button>
                <button className="adm-icon-btn adm-danger" title="Видалити" disabled={busyId === a.id} onClick={() => remove(a.id)}>
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
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
