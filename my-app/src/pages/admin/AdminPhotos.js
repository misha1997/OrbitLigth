// /admin/photos — APOD photo-archive list section (apod_entries table). See
// AdminLayout.js for the shell this renders inside. Editing happens on its
// own full-page route (AdminPhotoEditor.js) rather than a modal, so the
// description editors have room to breathe.
//
// Keyed by `date` (the table's PK), not an id. Editing is safe against the
// daily 09:00 mirror job clobbering it: database.ingest_apod_entries skips a
// row entirely once it already has both thumb_path and full_path mirrored,
// which is true for essentially every real entry — see
// database.update_apod_entry's docstring.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listApod, deleteApodEntry } from "../../lib/adminApi";
import { SearchIcon, PencilIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon, ImageIcon } from "../../lib/adminIcons";
import "../../styles/admin.css";

const PAGE_SIZE = 30;

export default function AdminPhotos() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [busyDate, setBusyDate] = useState(null);

  const refresh = useCallback(() => {
    setListLoading(true);
    setListError(null);
    listApod({ page, pageSize: PAGE_SIZE, q })
      .then((data) => { setRows(data.entries); setTotal(data.total); })
      .catch((e) => setListError(e.message))
      .finally(() => setListLoading(false));
  }, [page, q]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const id = setTimeout(() => { setPage(1); setQ(qInput.trim()); }, 350);
    return () => clearTimeout(id);
  }, [qInput]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const remove = async (date) => {
    if (!window.confirm("Видалити цей запис фотоархіву назавжди?")) return;
    setBusyDate(date);
    try {
      await deleteApodEntry(date);
      refresh();
    } catch (e) {
      setListError(e.message);
    } finally {
      setBusyDate(null);
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-card adm-card-stack">
        <div className="adm-head">
          <h1>Фотоархів</h1>
        </div>

        <div className="adm-toolbar">
          <div className="adm-search-wrap">
            <SearchIcon />
            <input
              className="adm-search"
              placeholder="Пошук за заголовком/автором…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
            />
          </div>
        </div>

        {listError && <p className="adm-error">{listError}</p>}

        <div className="adm-list">
          {listLoading && <p className="adm-hint">Завантаження…</p>}
          {!listLoading && rows.length === 0 && <p className="adm-hint">Нічого не знайдено.</p>}
          {rows.map((e) => (
            <div className="adm-row" key={e.date}>
              {e.thumb_url
                ? <img className="adm-thumb" src={e.thumb_url} alt="" />
                : <div className="adm-thumb adm-thumb-ph adm-thumb-empty"><ImageIcon size={16} /></div>}
              <div className="adm-row-info">
                <div className="adm-row-title">{e.title || "(без назви)"}</div>
                <div className="adm-row-meta">
                  <span className="adm-pill">{e.media_type}</span>
                  {e.credit && <span>{e.credit}</span>}
                  <span>{e.date}</span>
                </div>
              </div>
              <div className="adm-row-actions">
                <button className="adm-icon-btn" title="Редагувати" disabled={busyDate === e.date} onClick={() => navigate(`/admin/photos/${e.date}`)}>
                  <PencilIcon />
                </button>
                <button className="adm-icon-btn adm-danger" title="Видалити" disabled={busyDate === e.date} onClick={() => remove(e.date)}>
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
