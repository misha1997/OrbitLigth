// Keeps the document head in sync with the active SPA route + language.
//
// The server (web/seo.py) injects correct per-route meta into the initial
// HTML for non-JS crawlers. This hook handles the *live* case: when a user
// navigates client-side (or Googlebot's JS pass re-renders), it updates
// <title>, meta description, canonical, hreflang alternates, og:* and
// twitter:* to match the new route, so the browser tab and any second-pass
// indexing stay correct.
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { readNewsQuery, newsQueryString } from "../lib/news";
import { nameFromPath, locFor, SITE_URL, pathFor } from "../lib/seo";

function upsertMeta(selector, attrKey, attrVal, content) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attrKey, attrVal);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

// hreflang alternates: one link[rel=alternate] per hreflang value. Because
// the server already injects these for the initial load, we update existing
// ones in place (matched by hreflang attr) and add any missing.
function upsertHreflang(hreflang, href) {
  let el = document.head.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "alternate");
    el.setAttribute("hreflang", hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSeo(article = null, noindex = false) {
  const { pathname, search } = useLocation();
  const { t } = useTranslation();
  const resolved = nameFromPath(pathname);
  const { name, lang } = resolved;

  useEffect(() => {
    // Preserve the server's article metadata while its API request is pending.
    if (resolved.articleSlug && !article && !noindex) return;
    const filters = readNewsQuery(new URLSearchParams(search));
    const isNewsList = name === "news" && !resolved.articleSlug;
    const page = isNewsList ? filters.page : 0;
    const suffix = resolved.articleSlug ? `/${resolved.articleSlug}` : isNewsList ? newsQueryString(filters) : "";
    const title = article?.title || (t(`title.${name}`) + (page ? ` — ${lang === "uk" ? "Сторінка" : "Page"} ${page + 1}` : ""));
    const desc = article?.excerpt?.slice(0, 160) || t(`seo.desc.${name}`);
    const canonical = locFor(name, lang) + suffix;
    const ukAlt = locFor(name, "uk") + suffix;
    const enAlt = locFor(name, "en") + suffix;

    const image = article?.image ? new URL(article.image, SITE_URL).href : `${SITE_URL}/og-image.png`;
    upsertMeta('meta[property="og:type"]', "property", "og:type", resolved.articleSlug ? "article" : "website");
    upsertMeta('meta[property="og:image"]', "property", "og:image", image);
    upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", image);
    upsertMeta('meta[name="robots"]', "name", "robots", ["404", "login", "register", "account"].includes(name) ? "noindex,nofollow" : noindex ? "noindex,follow" : isNewsList && (filters.q || filters.category !== "all") ? "noindex,follow" : "index,follow,max-image-preview:large");
    // Replace initial server markup when navigating between news pages.
    if (name === "news") {
      document.head.querySelectorAll('script[type="application/ld+json"]').forEach(el => el.remove());
      if (article) {
        const el = document.createElement("script");
        el.type = "application/ld+json";
        const parts = (article.date || "").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        el.textContent = JSON.stringify({
          "@context": "https://schema.org", "@type": "NewsArticle",
          headline: article.title, description: desc, url: canonical,
          mainEntityOfPage: canonical, inLanguage: lang, image,
          ...(parts ? { datePublished: `${parts[3]}-${parts[2]}-${parts[1]}` } : {}),
          author: { "@type": "Organization", name: article.source || "OrbitLight" },
          publisher: { "@type": "Organization", name: "OrbitLight" },
          breadcrumb: { "@type": "BreadcrumbList", itemListElement: [
            { "@type": "ListItem", position: 1, name: "OrbitLight", item: locFor("home", lang) },
            { "@type": "ListItem", position: 2, name: t("nav.news"), item: SITE_URL + pathFor("news", lang) },
            { "@type": "ListItem", position: 3, name: article.title, item: canonical },
          ] },
        });
        el.dataset.newsSeo = "true";
        document.head.appendChild(el);
      }
    }
    if (title) document.title = title;
    if (desc) upsertMeta('meta[name="description"]', "name", "description", desc);
    upsertLink("canonical", canonical);
    upsertHreflang("uk", ukAlt);
    upsertHreflang("en", enAlt);
    upsertHreflang("x-default", enAlt);
    upsertMeta('meta[property="og:title"]', "property", "og:title", title || "");
    upsertMeta('meta[property="og:description"]', "property", "og:description", desc || "");
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonical);
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title || "");
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", desc || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => document.head.querySelectorAll('script[data-news-seo]').forEach(el => el.remove());
  }, [pathname, search, name, lang, t, article, resolved.articleSlug, noindex]);
}
