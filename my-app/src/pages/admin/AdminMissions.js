// /admin/missions — set/replace/reset the card photo shown on the public
// Missions hub (/missions) for each entry in lib/missions.js MISSIONS. The
// registry itself (name, year, type, static default `img`, …) is a
// hardcoded frontend list — same as the read-only galaxy catalog fields in
// AdminGalaxies.js — so there's nothing to edit there; this page only
// manages the one DB-backed override each mission can have (see
// database/schema.py's mission_previews table). See Missions.js for how the
// public page layers `previews[key]` over the static default.
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MISSIONS } from "../../lib/missions";
import {
  listMissionPreviews, setMissionPreview, uploadMissionPreview, deleteMissionPreview,
} from "../../lib/adminApi";
import { UploadIcon, TrashIcon } from "../../lib/adminIcons";
import "../../styles/admin.css";

function MissionCard({ mission, override, onChange }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const img = override?.image_url || mission.img;

  const saveUrl = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const data = await setMissionPreview(mission.key, { url: url.trim() });
      onChange(mission.key, data.preview);
      setUrl("");
    } catch (err) {
      setError(err.code === "download_failed" ? "Не вдалося завантажити зображення за цим URL" : "Помилка: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const data = await uploadMissionPreview(mission.key, file);
      onChange(mission.key, data.preview);
    } catch (err) {
      setError("Помилка завантаження: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm("Повернути стандартне зображення для цієї місії?")) return;
    setBusy(true);
    setError(null);
    try {
      await deleteMissionPreview(mission.key);
      onChange(mission.key, null);
    } catch (err) {
      setError("Помилка: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-mission-card">
      <div className="adm-mission-thumb-wrap">
        {img
          ? <img src={img} alt="" />
          : <span className="adm-mission-thumb-icon">{mission.icon}</span>}
        {override && <span className="adm-mission-badge override">адмін-фото</span>}
      </div>
      <div>
        <div className="adm-mission-title">{t(mission.labelKey)}</div>
        <div className="adm-mission-meta">{mission.type} · {mission.year}</div>
      </div>

      <form className="adm-mission-form" onSubmit={saveUrl}>
        <input
          type="text" placeholder="URL зображення…" value={url}
          onChange={(e) => setUrl(e.target.value)} disabled={busy}
        />
        <button type="submit" className="btn ghost" disabled={busy || !url.trim()}>OK</button>
      </form>

      <div className="adm-mission-actions">
        <label className="btn ghost adm-mission-upload-label">
          <UploadIcon size={13} /> Завантажити файл
          <input type="file" accept="image/*" onChange={upload} disabled={busy} />
        </label>
        {override && (
          <button type="button" className="btn danger" onClick={reset} disabled={busy} title="Скинути до стандартного">
            <TrashIcon size={13} />
          </button>
        )}
      </div>

      {error && <p className="adm-error" style={{ fontSize: 12 }}>{error}</p>}
    </div>
  );
}

export default function AdminMissions() {
  const [previews, setPreviews] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    listMissionPreviews()
      .then((data) => setPreviews(data.previews))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleChange = (key, preview) => {
    setPreviews((prev) => {
      const next = { ...(prev || {}) };
      if (preview) next[key] = preview;
      else delete next[key];
      return next;
    });
  };

  return (
    <div className="adm-page">
      <div className="adm-head">
        <h1>Місії</h1>
      </div>

      <div className="adm-info-banner">
        Фото на картках сторінки <code>/missions</code>. Список місій (назва, рік,
        іконка) редагується в коді (<code>my-app/src/lib/missions.js</code>) — тут
        можна лише підмінити або скинути фото кожної картки: вставте URL зображення
        або завантажте файл зі свого пристрою.
      </div>

      {error && <p className="adm-error">{error}</p>}
      {!previews && !error && <p className="adm-hint">Завантаження…</p>}

      {previews && (
        <div className="adm-mission-grid">
          {MISSIONS.map((m) => (
            <MissionCard key={m.key} mission={m} override={previews[m.key]} onChange={handleChange} />
          ))}
        </div>
      )}
    </div>
  );
}
