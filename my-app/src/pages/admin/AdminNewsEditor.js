// /admin/news/new and /admin/news/:id — full-page news article editor
// (replaces the old cramped modal form). See AdminLayout.js for the shell
// this renders inside, AdminNews.js for the list this is linked from.
//
// Single stacked column, full width — see admin.css's comment on this
// block for why (a two-column sidebar+split-pane layout hit real,
// confirmed rendering bugs). An Edit/Preview tab switch stands in for a
// permanent side-by-side preview.
//
// One global EN/UA switch drives title, excerpt, body, and the preview
// together — editing "the Ukrainian version" means everything on the page
// shows Ukrainian, rather than two stacked EN+UA textareas fighting for
// space.
//
// Body text is plain text (paragraphs separated by a blank line), with
// [IMG:n]/[VIDEO:n] placeholder lines for inline media already mirrored by
// the RSS ingest pipeline (parsers/news.py) — this editor does not attach
// new images/videos, it only lets an admin reference ones that exist. The
// preview renders via lib/articleBody.js's parseArticleBody, the same
// parser pages/NewsArticle.js uses, so what's shown here is exactly what
// the public page will render.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getNewsArticle, createNewsArticle, updateNewsArticle, refreshNewsArticle, uploadNewsCover } from "../../lib/adminApi";
import { parseArticleBody, isVideoFile } from "../../lib/articleBody";
import { ChevronLeftIcon, RefreshIcon, UploadIcon, ImageIcon, TrashIcon } from "../../lib/adminIcons";
import "../../styles/admin.css";

const CATEGORIES = ["launches", "missions", "discoveries", "tech"];
const CATEGORY_LABELS = {
  launches: "Запуски", missions: "Місії", discoveries: "Відкриття", tech: "Технології",
};

const EMPTY_FORM = {
  title: "", title_uk: "", excerpt: "", excerpt_uk: "", body: "", body_uk: "",
  image: "", category: "missions", source: "", published_date: "", slug: "",
};

function counts(text) {
  const trimmed = (text || "").trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  return `${words} слів · ${text.length} символів`;
}

function insertToken(ref, value, onChange, token) {
  const el = ref.current;
  if (!el) { onChange(value + (value ? "\n\n" : "") + token); return; }
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const next = value.slice(0, start) + token + value.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + token.length;
    el.setSelectionRange(pos, pos);
  });
}

function MediaPalette({ images, videos, onInsert }) {
  if (images.length === 0 && videos.length === 0) return null;
  return (
    <div className="adm-media-palette">
      {images.map((img) => (
        <button
          type="button"
          key={"img" + img.position}
          className="adm-media-chip"
          title={`Вставити [IMG:${img.position}]`}
          onClick={() => onInsert(`\n\n[IMG:${img.position}]\n\n`)}
        >
          <img src={img.thumb || img.src} alt="" />
          <span>[IMG:{img.position}]</span>
        </button>
      ))}
      {videos.map((v) => (
        <button
          type="button"
          key={"vid" + v.position}
          className="adm-media-chip adm-media-chip-video"
          title={`Вставити [VIDEO:${v.position}]`}
          onClick={() => onInsert(`\n\n[VIDEO:${v.position}]\n\n`)}
        >
          <span>▶ [VIDEO:{v.position}]</span>
        </button>
      ))}
    </div>
  );
}

function CoverField({ image, isNew, uploading, onFile, onUrlChange, onRemove }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const openPicker = () => { if (!isNew) inputRef.current && inputRef.current.click(); };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (isNew) return;
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div className="adm-card">
      <div className="adm-card-title">Обкладинка</div>
      <div
        className={
          "adm-cover-drop"
          + (image ? " has-image" : "")
          + (dragOver ? " drag-over" : "")
          + (isNew ? " disabled" : "")
          + (uploading ? " uploading" : "")
        }
        onClick={openPicker}
        onDragOver={(e) => { e.preventDefault(); if (!isNew) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {image ? <img className="adm-cover-preview-lg" src={image} alt="" /> : null}
        <div className="adm-cover-overlay">
          {uploading ? (
            <span className="adm-cover-overlay-text">Завантаження…</span>
          ) : isNew ? (
            <span className="adm-cover-overlay-text">Спочатку збережіть статтю</span>
          ) : image ? (
            <>
              <button type="button" className="btn ghost" onClick={(e) => { e.stopPropagation(); openPicker(); }}>
                <UploadIcon size={14} /> Змінити
              </button>
              <button type="button" className="btn danger" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
                <TrashIcon size={14} /> Видалити
              </button>
            </>
          ) : (
            <div className="adm-cover-empty">
              <ImageIcon size={26} />
              <p>Перетягніть зображення сюди<br />або натисніть, щоб вибрати файл</p>
            </div>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files && e.target.files[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <label className="adm-field adm-cover-url-field">
        <span>або URL зображення</span>
        <input value={image} onChange={onUrlChange} placeholder="https://…" />
      </label>
    </div>
  );
}

function BodyPreview({ title, text, images, videos }) {
  const blocks = parseArticleBody(text);
  return (
    <div className="adm-preview-body">
      {title ? <h3 className="adm-preview-title">{title}</h3> : null}
      {blocks.length === 0 && <p className="adm-hint">Немає тексту для перегляду.</p>}
      {blocks.map((b, i) => {
        if (b.type === "img") {
          const img = images.find((im) => String(im.position) === b.position);
          if (!img) return <p key={i} className="adm-preview-missing">[IMG:{b.position}] — немає такого зображення</p>;
          return <img key={i} className="adm-preview-img" src={img.src} alt="" />;
        }
        if (b.type === "video") {
          const vid = videos.find((v) => String(v.position) === b.position);
          if (!vid) return <p key={i} className="adm-preview-missing">[VIDEO:{b.position}] — немає такого відео</p>;
          return isVideoFile(vid.src)
            ? <video key={i} className="adm-preview-video" src={vid.src} controls preload="metadata" />
            : <iframe key={i} className="adm-preview-video" src={vid.src} title="video" allowFullScreen />;
        }
        return <p key={i}>{b.text}</p>;
      })}
    </div>
  );
}

export default function AdminNewsEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [media, setMedia] = useState({ body_images: [], body_videos: [] });
  const [sourceUrl, setSourceUrl] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [error, setError] = useState(null);
  const [lang, setLang] = useState("en"); // drives title/excerpt/body + preview together
  const [tab, setTab] = useState("write"); // "write" | "preview"

  const bodyRef = useRef(null);
  const suffix = lang === "uk" ? "_uk" : "";
  const bodyKey = "body" + suffix;
  const titleKey = "title" + suffix;
  const excerptKey = "excerpt" + suffix;

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getNewsArticle(id)
      .then((data) => {
        const a = data.article;
        setForm({
          title: a.title || "", title_uk: a.title_uk || "",
          excerpt: a.excerpt || "", excerpt_uk: a.excerpt_uk || "",
          body: a.body || "", body_uk: a.body_uk || "",
          image: a.image || "", category: a.category || "missions",
          source: a.source || "", published_date: a.published_date || "",
          slug: a.slug || "",
        });
        setMedia({ body_images: a.body_images || [], body_videos: a.body_videos || [] });
        setSourceUrl(a.url || "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const set = useCallback((k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value })), []);

  const canRefresh = !isNew && sourceUrl && !sourceUrl.startsWith("manual:");

  const refreshFromSource = async () => {
    if (!window.confirm(
      "Оновити текст, обкладинку та вбудовані медіа з першоджерела? " +
      "Поточний текст статті та зображення буде замінено — незбережені зміни в цих полях зникнуть."
    )) return;
    setRefreshing(true);
    setError(null);
    setRefreshMsg(null);
    try {
      const data = await refreshNewsArticle(id);
      const a = data.article;
      setForm((f) => ({
        ...f,
        body: a.body || "", body_uk: a.body_uk || "",
        image: a.image || "",
      }));
      setMedia({ body_images: a.body_images || [], body_videos: a.body_videos || [] });
      setRefreshMsg(`Оновлено: ${data.image_count} фото, ${data.video_count} відео`);
    } catch (err) {
      setError(
        err.code === "no_source_url" ? "У цієї статті немає першоджерела для оновлення"
        : err.code === "fetch_failed" ? "Не вдалося завантажити сторінку першоджерела"
        : err.code === "empty_body" ? "Першоджерело не повернуло текст статті"
        : "Помилка: " + err.message
      );
    } finally {
      setRefreshing(false);
    }
  };

  const uploadCover = async (file) => {
    setCoverUploading(true);
    setError(null);
    try {
      const data = await uploadNewsCover(id, file);
      setForm((f) => ({ ...f, image: data.article.image || "" }));
    } catch (err) {
      setError(
        err.code === "invalid_file_type" ? "Файл має бути зображенням"
        : err.code === "file_too_large" ? "Файл завеликий (максимум 8 МБ)"
        : err.code === "invalid_image" ? "Не вдалося розпізнати зображення"
        : "Помилка: " + err.message
      );
    } finally {
      setCoverUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        await createNewsArticle(form);
      } else {
        await updateNewsArticle(id, form);
      }
      navigate("/admin/news");
    } catch (err) {
      setError(
        err.code === "invalid_category" ? "Невідома категорія"
        : err.code === "title_required" ? "Заголовок обов'язковий"
        : err.code === "update_failed" ? "Не вдалося зберегти (можливо, такий slug уже зайнятий)"
        : "Помилка: " + err.message
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="adm-page"><p className="adm-hint">Завантаження…</p></div>;

  return (
    <form className="adm-page adm-editor-page" onSubmit={save}>
      <div className="adm-editor-toprow">
        <button type="button" className="adm-editor-back" onClick={() => navigate("/admin/news")}>
          <ChevronLeftIcon size={15} /> Новини
        </button>
        <div className="adm-editor-toprow-actions">
          <div className="adm-lang-toggle">
            <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
            <button type="button" className={lang === "uk" ? "active" : ""} onClick={() => setLang("uk")}>UA</button>
          </div>
          {canRefresh && (
            <button
              type="button"
              className="btn ghost"
              title={sourceUrl}
              onClick={refreshFromSource}
              disabled={refreshing || saving}
            >
              <RefreshIcon size={14} /> {refreshing ? "Оновлення…" : "Оновити з джерела"}
            </button>
          )}
          <button type="button" className="btn ghost" onClick={() => navigate("/admin/news")} disabled={saving}>
            Скасувати
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "Збереження…" : "Зберегти"}
          </button>
        </div>
      </div>

      {error && <p className="adm-error">{error}</p>}
      {refreshMsg && <p className="adm-hint">{refreshMsg}</p>}

      <input
        className="adm-editor-title-input"
        value={form[titleKey]}
        onChange={set(titleKey)}
        placeholder={`Заголовок (${lang.toUpperCase()})`}
        required={lang === "en"}
      />

      <div className="adm-card">
        <div className="adm-editor-meta-row">
          <label className="adm-field adm-field-flex">
            <span>Категорія</span>
            <select value={form.category} onChange={set("category")}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </label>
          <label className="adm-field adm-field-flex">
            <span>Джерело</span>
            <input value={form.source} onChange={set("source")} />
          </label>
          <label className="adm-field adm-field-flex">
            <span>Дата публікації</span>
            <input value={form.published_date} onChange={set("published_date")} placeholder="2026-09-06" />
          </label>
          <label className="adm-field adm-field-flex">
            <span>Slug</span>
            <input value={form.slug} onChange={set("slug")} disabled={isNew} placeholder={isNew ? "авто" : ""} />
          </label>
        </div>
      </div>

      <CoverField
        image={form.image}
        isNew={isNew}
        uploading={coverUploading}
        onFile={uploadCover}
        onUrlChange={set("image")}
        onRemove={() => setForm((f) => ({ ...f, image: "" }))}
      />

      <div className="adm-card">
        <label className="adm-field">
          <span>Короткий опис ({lang.toUpperCase()})</span>
          <textarea rows={3} value={form[excerptKey]} onChange={set(excerptKey)} />
        </label>
      </div>

      <div className="adm-card">
        <div className="adm-editor-tabs">
          <button type="button" className={tab === "write" ? "active" : ""} onClick={() => setTab("write")}>Редагувати</button>
          <button type="button" className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")}>Прев'ю</button>
          <span className="adm-hint">{counts(form[bodyKey])}</span>
        </div>

        {tab === "write" ? (
          <>
            <MediaPalette
              images={media.body_images}
              videos={media.body_videos}
              onInsert={(token) => insertToken(bodyRef, form[bodyKey], (v) => setForm((f) => ({ ...f, [bodyKey]: v })), token)}
            />
            <textarea
              ref={bodyRef}
              className="adm-editor-textarea-lg"
              value={form[bodyKey]}
              onChange={set(bodyKey)}
              placeholder="Абзаци розділяйте порожнім рядком…"
            />
          </>
        ) : (
          <BodyPreview
            title={form[titleKey]}
            text={form[bodyKey]}
            images={media.body_images}
            videos={media.body_videos}
          />
        )}
      </div>
    </form>
  );
}
