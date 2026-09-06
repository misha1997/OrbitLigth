// Thin fetch wrappers for /api/admin/* (the /admin dashboard).
// Same shape as lib/authApi.js: every call needs the session cookie, so
// `credentials: "include"` throughout (unlike the unauthenticated lib/api.js
// calls the rest of the site uses).
const API = "/api/admin";

async function adminFetch(path, options = {}) {
  const r = await fetch(API + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || "request_failed");
    err.code = data.error;
    err.status = r.status;
    throw err;
  }
  return data;
}

export const listNews = ({ page = 1, pageSize = 30, q = "", category = "" } = {}) => {
  const p = new URLSearchParams({ page, page_size: pageSize });
  if (q) p.set("q", q);
  if (category) p.set("category", category);
  return adminFetch("/news?" + p.toString());
};

export const getNewsArticle = (id) => adminFetch(`/news/${id}`);

export const createNewsArticle = (fields) =>
  adminFetch("/news", { method: "POST", body: JSON.stringify(fields) });

export const updateNewsArticle = (id, fields) =>
  adminFetch(`/news/${id}`, { method: "PATCH", body: JSON.stringify(fields) });

export const deleteNewsArticle = (id) =>
  adminFetch(`/news/${id}`, { method: "DELETE" });

export const refreshNewsArticle = (id) =>
  adminFetch(`/news/${id}/refresh`, { method: "POST" });

// Bypasses adminFetch: a FormData body needs the browser to set its own
// multipart Content-Type (with boundary), not adminFetch's fixed
// application/json — same reason lib/authApi.js's uploadAvatar does its own
// fetch instead of going through authFetch.
export async function uploadNewsCover(id, file) {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(`${API}/news/${id}/cover`, { method: "POST", credentials: "include", body: form });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || "request_failed");
    err.code = data.error;
    err.status = r.status;
    throw err;
  }
  return data;
}

export const getStats = () => adminFetch("/stats");

export const listUsers = ({ page = 1, pageSize = 30, q = "" } = {}) => {
  const p = new URLSearchParams({ page, page_size: pageSize });
  if (q) p.set("q", q);
  return adminFetch("/users?" + p.toString());
};

export const updateUserRole = (id, role) =>
  adminFetch(`/users/${id}`, { method: "PATCH", body: JSON.stringify({ role }) });

export const listApod = ({ page = 1, pageSize = 30, q = "" } = {}) => {
  const p = new URLSearchParams({ page, page_size: pageSize });
  if (q) p.set("q", q);
  return adminFetch("/apod?" + p.toString());
};

export const getApodEntry = (date) => adminFetch(`/apod/${date}`);

export const updateApodEntry = (date, fields) =>
  adminFetch(`/apod/${date}`, { method: "PATCH", body: JSON.stringify(fields) });

export const deleteApodEntry = (date) =>
  adminFetch(`/apod/${date}`, { method: "DELETE" });

export const listGalaxiesAdmin = () => adminFetch("/galaxies");

export const listGalaxyPhotos = (key) => adminFetch(`/galaxies/${key}/photos`);

export const addGalaxyPhoto = (key, fields) =>
  adminFetch(`/galaxies/${key}/photos`, { method: "POST", body: JSON.stringify(fields) });

export const deleteGalaxyPhoto = (key, nasaId) =>
  adminFetch(`/galaxies/${key}/photos/${encodeURIComponent(nasaId)}`, { method: "DELETE" });
