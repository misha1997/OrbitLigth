// Thin fetch wrappers for /api/auth/* — separate from lib/api.js because every
// call here needs `credentials: "include"` (the session lives in an httpOnly
// cookie) while the ~40 existing api.js calls are all unauthenticated and
// deliberately don't send cookies.
const API = "/api/auth";

async function authFetch(path, options = {}) {
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

export const getAuthConfig = () => authFetch("/config");
export const getMe = () => authFetch("/me");
export const registerAccount = (email, password, username) =>
  authFetch("/register", { method: "POST", body: JSON.stringify({ email, password, username }) });
export const loginAccount = (email, password) =>
  authFetch("/login", { method: "POST", body: JSON.stringify({ email, password }) });
export const logoutAccount = () => authFetch("/logout", { method: "POST" });
export const loginWithGoogle = (idToken) =>
  authFetch("/google", { method: "POST", body: JSON.stringify({ id_token: idToken }) });
export const loginWithTelegram = (telegramUser) =>
  authFetch("/telegram", { method: "POST", body: JSON.stringify(telegramUser) });
export const unlinkTelegram = () => authFetch("/telegram/unlink", { method: "POST" });
export const updateProfile = (fields) =>
  authFetch("/me", { method: "PATCH", body: JSON.stringify(fields) });
export const updateNotifications = (fields) =>
  authFetch("/notifications", { method: "PATCH", body: JSON.stringify(fields) });
export const changePassword = (currentPassword, newPassword) =>
  authFetch("/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
export const deleteAccount = () => authFetch("/me", { method: "DELETE" });

// Saved locations (Dark Sky map "My places" panel).
export const getSavedLocations = () => authFetch("/locations");
export const addSavedLocation = (label, lat, lon) =>
  authFetch("/locations", { method: "POST", body: JSON.stringify({ label, lat, lon }) });
export const deleteSavedLocation = (id) =>
  authFetch("/locations/" + id, { method: "DELETE" });

// Multipart upload — deliberately bypasses authFetch, which always sets
// Content-Type: application/json; the browser needs to set its own
// multipart boundary here instead.
export async function uploadAvatar(file) {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(API + "/avatar", { method: "POST", credentials: "include", body: form });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || "request_failed");
    err.code = data.error;
    err.status = r.status;
    throw err;
  }
  return data;
}
