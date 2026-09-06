// /admin/galaxies — read-only overview of the curated catalog, with a link
// per row into /admin/galaxies/:key (AdminGalaxyPhotos.js) for photo
// gallery management. See AdminLayout.js for the shell this renders inside.
//
// The catalog fields themselves have no edit/delete here: `galaxies` rows
// are re-derived every Monday 03:00 from the hardcoded catalog in
// services/galaxies.py (database.ingest_galaxies unconditionally overwrites
// curated fields on every sync) — a DB edit here would just be silently
// overwritten on the next sync. Curated text (name, description, distance,
// facts) is edited in services/galaxies.py itself. The mirrored
// `galaxy_photos` gallery is a different table that sync doesn't touch,
// which is why photos (unlike the catalog fields) are fully manageable.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listGalaxiesAdmin } from "../../lib/adminApi";
import { ImageIcon } from "../../lib/adminIcons";
import "../../styles/admin.css";

export default function AdminGalaxies() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    listGalaxiesAdmin()
      .then((data) => setRows(data.galaxies))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="adm-page">
      <div className="adm-head">
        <h1>Галактики</h1>
      </div>

      <div className="adm-info-banner">
        Список лише для перегляду: куратор редагується у коді
        (<code>services/galaxies.py</code>) і щотижня (пн 03:00) синхронізується
        в базу — правки тут не збережуться.
      </div>

      {error && <p className="adm-error">{error}</p>}

      <div className="adm-card">
        {!rows && !error && <p className="adm-hint">Завантаження…</p>}
        {rows && (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Назва</th>
                  <th>Категорія</th>
                  <th>Відстань</th>
                  <th>Зор. величина</th>
                  <th>NED тип</th>
                  <th>Фото</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="adm-hint">Каталог порожній.</td></tr>
                )}
                {rows.map((g) => (
                  <tr key={g.key}>
                    <td>
                      {g.preview_thumb
                        ? <img className="adm-thumb" src={g.preview_thumb} alt="" />
                        : <div className="adm-thumb adm-thumb-ph adm-thumb-empty"><ImageIcon size={16} /></div>}
                    </td>
                    <td>
                      <div className="adm-row-title">{g.name_uk || g.name_en}</div>
                      <div className="adm-row-meta"><span>{g.designation}</span></div>
                    </td>
                    <td>{g.category}</td>
                    <td>{g.dist_text_uk || g.dist_text_en || "—"}</td>
                    <td>{g.magnitude || "—"}</td>
                    <td>{g.ned_type || "—"}</td>
                    <td>{g.photo_count}</td>
                    <td>
                      <button type="button" className="btn ghost" onClick={() => navigate(`/admin/galaxies/${g.key}`)}>
                        <ImageIcon size={14} /> Фото
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
