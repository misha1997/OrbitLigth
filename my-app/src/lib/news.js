// Capture the server content before createRoot replaces the initial DOM.
let bootstrap = null;
try {
  const node = document.getElementById("news-bootstrap");
  if (node) bootstrap = { ...JSON.parse(node.textContent), html: document.getElementById("server-news")?.outerHTML || "" };
} catch { /* An absent/invalid payload falls back to the normal API request. */ }

export function getNewsBootstrap() {
  return bootstrap?.path === window.location.pathname + window.location.search ? bootstrap : null;
}

export const NEWS_CATEGORIES = ["all", "launches", "missions", "discoveries", "tech"];

export function readNewsQuery(params) {
  const raw = params.get("page") || "0";
  return {
    page: /^[0-9]{1,7}$/.test(raw) ? Math.min(Number(raw), 1000000) : 0,
    q: (params.get("q") || "").trim().slice(0, 100),
    category: NEWS_CATEGORIES.includes(params.get("category")) ? params.get("category") : "all",
  };
}

export function newsQueryString({ page = 0, q = "", category = "all" }) {
  const params = new URLSearchParams();
  if (page) params.set("page", page);
  if (q) params.set("q", q);
  if (category && category !== "all") params.set("category", category);
  const query = params.toString();
  return query ? `?${query}` : "";
}
