// /admin/photos/:date — full-page APOD photo-archive entry editor (replaces
// the old cramped modal form). See AdminLayout.js for the shell this renders
// inside, AdminPhotos.js for the list this is linked from.
//
// Single stacked column, full width — see admin.css's comment near
// .adm-editor-page for why (an earlier sidebar+split-pane layout hit real,
// confirmed rendering bugs). An Edit/Preview tab switch stands in for a
// permanent side-by-side preview.
//
// One global EN/UA switch drives the description + preview together, same
// pattern as AdminNewsEditor.js. Unlike news, apod_entries.explanation has
// no [IMG:n]/[VIDEO:n] placeholder system — the public gallery renders it
// as a single plain-text block (see pages/Gallery.js) — so there's no
// media-insert palette here.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getApodEntry, updateApodEntry } from "../../lib/adminApi";
import { ChevronLeftIcon } from "../../lib/adminIcons";
import "../../styles/admin.css";

function counts(text) {
  const trimmed = (text || "").trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  return `${words} слів · ${text.length} символів`;
}

export default function AdminPhotoEditor() {
  const { date } = useParams();
  const navigate = useNavigate();

  const [entry, setEntry] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lang, setLang] = useState("en");
  const [tab, setTab] = useState("write");

  const suffix = lang === "uk" ? "_uk" : "";
  const explanationKey = "explanation" + suffix;

  useEffect(() => {
    setLoading(true);
    getApodEntry(date)
      .then((data) => {
        const e = data.entry;
        setEntry(e);
        setForm({
          title: e.title || "", explanation: e.explanation || "",
          explanation_uk: e.explanation_uk || "", credit: e.credit || "",
          video_url: e.video_url || "",
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [date]);

  const set = useCallback((k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value })), []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateApodEntry(date, form);
      navigate("/admin/photos");
    } catch (err) {
      setError("Помилка: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="adm-page"><p className="adm-hint">Завантаження…</p></div>;
  if (!entry) return <div className="adm-page"><p className="adm-error">{error || "Не знайдено"}</p></div>;

  return (
    <form className="adm-page adm-editor-page" onSubmit={save}>
      <div className="adm-editor-toprow">
        <button type="button" className="adm-editor-back" onClick={() => navigate("/admin/photos")}>
          <ChevronLeftIcon size={15} /> Фотоархів
        </button>
        <div className="adm-editor-toprow-actions">
          <div className="adm-lang-toggle">
            <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
            <button type="button" className={lang === "uk" ? "active" : ""} onClick={() => setLang("uk")}>UA</button>
          </div>
          <button type="button" className="btn ghost" onClick={() => navigate("/admin/photos")} disabled={saving}>
            Скасувати
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "Збереження…" : "Зберегти"}
          </button>
        </div>
      </div>

      {error && <p className="adm-error">{error}</p>}

      <input
        className="adm-editor-title-input"
        value={form.title}
        onChange={set("title")}
        placeholder="Заголовок"
      />

      <div className="adm-card">
        <div className="adm-editor-meta-row">
          <label className="adm-field adm-field-flex">
            <span>Дата</span>
            <input value={entry.date} disabled />
          </label>
          <label className="adm-field adm-field-flex">
            <span>Тип медіа</span>
            <input value={entry.media_type} disabled />
          </label>
          <label className="adm-field adm-field-flex">
            <span>Автор/копірайт</span>
            <input value={form.credit} onChange={set("credit")} />
          </label>
          {entry.media_type === "video" && (
            <label className="adm-field adm-field-flex">
              <span>URL відео</span>
              <input value={form.video_url} onChange={set("video_url")} />
            </label>
          )}
        </div>
      </div>

      {entry.thumb_url && (
        <div className="adm-card">
          <img className="adm-preview" src={entry.thumb_url} alt="" />
        </div>
      )}

      <div className="adm-card">
        <div className="adm-editor-tabs">
          <button type="button" className={tab === "write" ? "active" : ""} onClick={() => setTab("write")}>Редагувати</button>
          <button type="button" className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")}>Прев'ю</button>
          <span className="adm-hint">{counts(form[explanationKey])}</span>
        </div>

        {tab === "write" ? (
          <textarea
            className="adm-editor-textarea-lg"
            value={form[explanationKey]}
            onChange={set(explanationKey)}
          />
        ) : (
          <div className="adm-preview-body">
            {form.title ? <h3 className="adm-preview-title">{form.title}</h3> : null}
            <p>{form[explanationKey] || "Немає тексту для перегляду."}</p>
          </div>
        )}
      </div>
    </form>
  );
}
