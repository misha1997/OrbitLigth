// /admin/galaxies/:key — photo gallery management for one galaxy. See
// AdminLayout.js for the shell this renders inside, AdminGalaxies.js for the
// overview this is linked from.
//
// Unlike the galaxies catalog itself (curated fields are read-only — see
// AdminGalaxies.js), the mirrored `galaxy_photos` gallery is a different
// table the weekly NED/NASA re-sync doesn't touch, so add/remove here is
// durable. Adding mirrors the URL server-side (services/galaxy_images);
// there's no drag-and-drop file upload here since a galaxy photo is always
// sourced from an external URL (NASA Image Library / Wikimedia Commons),
// not something an admin has a local file for.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listGalaxyPhotos, addGalaxyPhoto, deleteGalaxyPhoto, listGalaxiesAdmin } from "../../lib/adminApi";
import { ChevronLeftIcon, PlusIcon, TrashIcon } from "../../lib/adminIcons";
import "../../styles/admin.css";

export default function AdminGalaxyPhotos() {
  const { key } = useParams();
  const navigate = useNavigate();

  const [galaxyName, setGalaxyName] = useState(key);
  const [photos, setPhotos] = useState(null);
  const [url, setUrl] = useState("");
  const [credit, setCredit] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    listGalaxyPhotos(key)
      .then((data) => setPhotos(data.photos))
      .catch((e) => setError(e.message));
  }, [key]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    listGalaxiesAdmin()
      .then((data) => {
        const g = (data.galaxies || []).find((x) => x.key === key);
        if (g) setGalaxyName(g.name_uk || g.name_en || key);
      })
      .catch(() => {});
  }, [key]);

  const addPhoto = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addGalaxyPhoto(key, { url: url.trim(), credit: credit.trim() || null });
      setUrl("");
      setCredit("");
      refresh();
    } catch (err) {
      setError(err.code === "download_failed" ? "Не вдалося завантажити зображення за цим URL" : "Помилка: " + err.message);
    } finally {
      setAdding(false);
    }
  };

  const remove = async (nasaId) => {
    if (!window.confirm("Видалити це фото з галереї?")) return;
    setBusyId(nasaId);
    try {
      await deleteGalaxyPhoto(key, nasaId);
      refresh();
    } catch (err) {
      setError("Помилка: " + err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-head">
        <button type="button" className="adm-editor-back" onClick={() => navigate("/admin/galaxies")}>
          <ChevronLeftIcon size={15} /> Галактики
        </button>
        <h1>{galaxyName}</h1>
      </div>

      <form className="adm-card" onSubmit={addPhoto}>
        <div className="adm-card-title">Додати фото</div>
        <div className="adm-editor-meta-row">
          <label className="adm-field" style={{ flex: "2 1 300px" }}>
            <span>URL зображення</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" required />
          </label>
          <label className="adm-field adm-field-flex">
            <span>Автор/копірайт (необов'язково)</span>
            <input value={credit} onChange={(e) => setCredit(e.target.value)} />
          </label>
          <label className="adm-field" style={{ flex: "0 0 auto", justifyContent: "flex-end" }}>
            <span>&nbsp;</span>
            <button type="submit" className="btn primary" disabled={adding}>
              <PlusIcon size={14} /> {adding ? "Додавання…" : "Додати"}
            </button>
          </label>
        </div>
      </form>

      {error && <p className="adm-error">{error}</p>}

      <div className="adm-card">
        <div className="adm-card-title">Фото ({photos ? photos.length : "…"})</div>
        {!photos && <p className="adm-hint">Завантаження…</p>}
        {photos && photos.length === 0 && <p className="adm-hint">Немає фото.</p>}
        {photos && photos.length > 0 && (
          <div className="adm-photo-grid">
            {photos.map((p) => (
              <div className="adm-photo-grid-item" key={p.nasa_id}>
                <img src={p.thumb_url || p.full_url} alt="" />
                <div className="adm-photo-grid-overlay">
                  <button
                    type="button"
                    className="btn danger"
                    disabled={busyId === p.nasa_id}
                    onClick={() => remove(p.nasa_id)}
                  >
                    <TrashIcon size={14} /> Видалити
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
