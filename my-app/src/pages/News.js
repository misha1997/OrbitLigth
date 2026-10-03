// Space news page (news.html template): featured article + stat cards +
// keyword search + category filter + cards/rows view toggle + paginated feed.
// Wired to /api/news — a SpaceflightNow archive stored in MySQL with a live
// parser fallback. Pagination, category filtering and search all run on the
// backend (DB LIKE query + LIMIT/OFFSET) — the client only holds the current
// page's items. Items with an `id` link to the on-site article page
// (/news/:slug); live-without-DB items (id === null) link out to the source.
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { useApi } from "../hooks/useApi";
import { useSeo } from "../hooks/useSeo";
import { getNews, getNewsKeywords } from "../lib/api";
import { pathFor } from "../lib/seo";
import LocalizedLink from "../components/primitives/LocalizedLink";
import NewsSkeleton from "../components/NewsSkeleton";
import NewsCard from "../components/NewsCard";
import { getNewsBootstrap, readNewsQuery, newsQueryString, NEWS_CATEGORIES as CATS } from "../lib/news";
import HistoryWidget from "../components/home/HistoryWidget";
import "../styles/news.css";
import "../styles/gallery.css"; // .pagination / .pg-btn

const PAGE_SIZE = 12;

const SEARCH_DEBOUNCE_MS = 350;

export default function News() {
  const { t } = useTranslation();
  const { lang } = useLang();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.body.classList.add("p-news");
    return () => document.body.classList.remove("p-news");
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const { page, q: query, category: filter } = readNewsQuery(searchParams);
  const [rawQuery, setRawQuery] = useState(query);
  const [view, setView] = useState("cards");
  const searchTimer = useRef(null);
  useEffect(() => {
    clearTimeout(searchTimer.current);
    setRawQuery(query);
  }, [query, searchParams]);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const updateFilters = (next, replace = false) => {
    clearTimeout(searchTimer.current);
    const values = { page: 0, q: query, category: filter, ...next };
    setRawQuery(values.q);
    setSearchParams(newsQueryString(values).slice(1), { replace });
  };
  const search = (value) => {
    setRawQuery(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => updateFilters({ q: value.trim().slice(0, 100) }, true), SEARCH_DEBOUNCE_MS);
  };

  const isDefaultView = filter === "all" && !query;

  const { data, loading, error, refetch } = useApi(
    () => getNews(lang, { page, pageSize: PAGE_SIZE, q: query, category: filter }),
    { deps: [lang, page, query, filter], initialData: getNewsBootstrap()?.data || null, revalidate: false }
  );
  const items = (data && data.items) || [];
  useSeo(null, !loading && !error && page > 0 && items.length === 0);

  // Trending keywords mined server-side from recent article titles (not a
  // hardcoded list) — refetch only when the language changes.
  const { data: kwData } = useApi(() => getNewsKeywords(lang), { deps: [lang] });
  const keywords = (kwData && kwData.keywords) || [];
  const total = (data && data.total) || 0;
  const totalPages = (data && data.total_pages) || 1;
  const safePage = (data && data.page) || 0;
  const pageItems = items;
  // The featured hero only makes sense on the plain, unfiltered first page.
  const featured = isDefaultView && safePage === 0 ? items[0] : null;

  const pageHref = (n) => pathFor("news", lang) + newsQueryString({ page: n, q: query, category: filter });
  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const setKeyword = (kw) => updateFilters({ q: kw, category: "all" });

  // Compact pagination: first, last, current ±1, with ellipses.
  const pageBtns = [];
  if (totalPages <= 7) {
    for (let i = 0; i < totalPages; i++) pageBtns.push(i);
  } else {
    pageBtns.push(0);
    if (safePage > 2) pageBtns.push("…");
    for (let i = Math.max(1, safePage - 1); i <= Math.min(totalPages - 2, safePage + 1); i++) pageBtns.push(i);
    if (safePage < totalPages - 3) pageBtns.push("…");
    pageBtns.push(totalPages - 1);
  }

  const catLabel = (c) => t(`news.cat.${c}`, { defaultValue: c });

  return (
    <div className="wrap" style={{ position: "relative", zIndex: 1 }}>
      <section className="page-head">
        <span className="icon-badge">{t("news.badge")}</span>
        <h1 className="page-title">{t("news.title")}</h1>
        <p className="page-desc">{t("news.desc")}</p>

        {loading ? null : error ? null : featured ? (
          <div className="news-featured">
            <div className="cat-tag" style={{ color: "var(--teal)" }}>
              {catLabel(featured.category)}
            </div>
            <h2>{featured.title}</h2>
            <div className="meta">
              {featured.source} · {featured.date}
            </div>
            <p>{featured.excerpt}</p>
            {featured.id && featured.slug ? (
              <LocalizedLink className="read-more" to={`${pathFor("news", lang)}/${featured.slug}`}>
                {t("news.readFull")}
              </LocalizedLink>
            ) : (
              <a
                className="read-more"
                href={featured.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("news.readFull")}
              </a>
            )}
          </div>
        ) : null}
      </section>

      <section className="section" style={{ paddingTop: 0, paddingBottom: 16 }}>
        <HistoryWidget />
      </section>

      <section className="section" style={{ paddingTop: 8 }}>
        <div className="section-head">
          <div>
            <div className="eyebrow">{t("news.feed.eyebrow")}</div>
            <h2 className="section-title">{t("news.feed.title")}</h2>
          </div>
        </div>

        <div className="news-search">
          <input
            type="search"
            maxLength={100}
            placeholder={t("news.search.placeholder")}
            aria-label={t("news.search.placeholder")}
            value={rawQuery}
            onChange={(e) => search(e.target.value)}
          />
        </div>
        {keywords.length ? (
          <div className="kw-row">
            <span className="lbl">{t("news.kw.label")}</span>
            {keywords.map((kw) => (
              <button
                key={kw}
                className={"kw-chip" + (query.toLowerCase() === kw.toLowerCase() ? " on" : "")}
                type="button"
                onClick={() => setKeyword(kw)}
              >
                {kw}
              </button>
            ))}
          </div>
        ) : null}

        <div className="news-cat-filters">
          {CATS.map((c) => (
            <button
              key={c}
              className={"filter-pill" + (filter === c ? " on" : "")}
              type="button"
              aria-pressed={filter === c}
              onClick={() => updateFilters({ category: c, q: rawQuery.trim().slice(0, 100) })}
            >
              {catLabel(c)}
            </button>
          ))}
        </div>

        {(query || filter !== "all") && <button className="filter-pill" type="button" onClick={() => updateFilters({ q: "", category: "all" })}>{t("news.reset")}</button>}
        <div className="news-count">
          <span aria-live="polite">
            {!loading && !error && <Trans i18nKey="news.count" values={{ n: total, q: query }} components={{ b: <b /> }} />}
          </span>
          <div className="view-toggle">
            <button
              className={"vt-btn" + (view === "cards" ? " active" : "")}
              type="button"
              title={t("news.view.cards")}
              aria-label={t("news.view.cards")}
              onClick={() => setView("cards")}
            >
              ▦
            </button>
            <button
              className={"vt-btn" + (view === "rows" ? " active" : "")}
              type="button"
              title={t("news.view.rows")}
              aria-label={t("news.view.rows")}
              onClick={() => setView("rows")}
            >
              ☰
            </button>
          </div>
        </div>

        {loading ? (
          <NewsSkeleton view={view} />
        ) : error ? (
          <div className="news-feedback" role="alert">
            <h3>{t("news.loadError")}</h3>
            <p>{t("news.loadErrorSub")}</p>
            <button className="filter-pill" type="button" onClick={refetch}>{t("news.retry")}</button>
          </div>
        ) : pageItems.length === 0 ? (
          <div className="news-feedback" role="status">
            <p>{t(query || filter !== "all" ? "news.noMatch" : page > 0 ? "news.pageEmpty" : "news.emptyArchive")}</p>
            {(query || filter !== "all" || page > 0) && <button className="filter-pill" type="button" onClick={() => updateFilters({ q: "", category: "all" })}>{t("news.reset")}</button>}
          </div>
        ) : (
          <>
            <div className={"news-list view-" + view}>
              {pageItems.map((item, i) => <NewsCard key={item.id || item.url || i} item={item} />)}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                {safePage === 0 ? (
                  <span className="pg-btn arrow disabled" aria-hidden="true">‹</span>
                ) : (
                  <LocalizedLink
                    className="pg-btn arrow"
                    to={pageHref(safePage - 1)}
                    onClick={scrollTop}
                    aria-label={t("gallery.prev", "Попередня")}
                  >‹</LocalizedLink>
                )}
                {pageBtns.map((n, i) =>
                  n === "…" ? (
                    <span className="pg-dots" key={"d" + i}>…</span>
                  ) : n === safePage ? (
                    <span className="pg-btn active" key={n} aria-current="page">{n + 1}</span>
                  ) : (
                    <LocalizedLink
                      key={n}
                      className="pg-btn"
                      to={pageHref(n)}
                      onClick={scrollTop}
                    >{n + 1}</LocalizedLink>
                  )
                )}
                {safePage === totalPages - 1 ? (
                  <span className="pg-btn arrow disabled" aria-hidden="true">›</span>
                ) : (
                  <LocalizedLink
                    className="pg-btn arrow"
                    to={pageHref(safePage + 1)}
                    onClick={scrollTop}
                    aria-label={t("gallery.next", "Наступна")}
                  >›</LocalizedLink>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
