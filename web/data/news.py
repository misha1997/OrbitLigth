"""Space news archive (DB-first, live-parser fallback) + trending keywords + article pages."""
import logging
import asyncio
import re

from parsers import NewsParser
from utils.i18n import DEFAULT_LANG
from utils.translator import Translator
from web.cache import get_or_fetch

from database import (
    get_news_articles,
    count_news_articles,
    get_news_article_by_slug,
    get_related_news_articles,
    set_news_article_body,
    ingest_news_articles,
    get_news_article_images,
    set_news_article_images,
    get_news_article_videos,
    set_news_article_videos,
)

logger = logging.getLogger(__name__)

NEWS_TTL = 1800  # 30 min
NEWS_SEARCH_TTL = 300  # 5 min — search/filter results cached shorter (more cache keys)
NEWS_ARTICLE_TTL = 6 * 3600  # bodies don't change once fetched
NEWS_LIST_LIMIT = 60
NEWS_PAGE_SIZE_DEFAULT = 6
NEWS_PAGE_SIZE_MAX = 24
NEWS_CATEGORIES = {"launches", "missions", "discoveries", "tech"}


def _news_localize(items, lang):
    """Pick the title/excerpt in the requested language (fall back to EN)."""
    out = []
    for it in items:
        title = (it.get("title_uk") if lang == "uk" and it.get("title_uk") else it.get("title")) or ""
        excerpt = (it.get("excerpt_uk") if lang == "uk" and it.get("excerpt_uk") else it.get("excerpt")) or ""
        out.append({
            "id": it.get("id"),
            "slug": it.get("slug") or "",
            "url": it.get("url") or "",
            "title": title,
            "excerpt": excerpt,
            "category": it.get("category") or "missions",
            "date": it.get("published_date") or "",
            "source": it.get("source") or "SpaceflightNow",
            "image": it.get("image") or "",
        })
    return out


def _news_live(lang):
    """Live SpaceflightNow fetch used when the DB archive is empty/unavailable.
    Best-effort stores into the archive, then reads back; if the DB is off,
    returns the freshly-parsed list with id=null (cards link out to source)."""
    arts = NewsParser.get_news() or []
    if not arts:
        return []
    try:
        ingest_news_articles(arts)
    except Exception as e:
        logger.error("news live ingest: %s", e)
    stored = get_news_articles(NEWS_LIST_LIMIT)
    if stored:
        return _news_localize(stored, lang)
    return [{
        "id": None, "slug": "", "url": a.get("url", ""), "title": a.get("title", ""),
        "excerpt": a.get("excerpt", ""), "category": a.get("category_bucket", "missions"),
        "date": a.get("date", ""), "source": a.get("source", "SpaceflightNow"), "image": "",
    } for a in arts]


def _news_raw(lang, page=0, page_size=NEWS_PAGE_SIZE_DEFAULT, q="", category=""):
    """One page of the news archive, optionally filtered by `category` and/or
    a `q` search term (title/excerpt substring, either language) — both
    applied at the DB level. Falls back to a live unpaginated fetch only for
    the plain, unfiltered first page when the archive is empty/unavailable."""
    q = (q or "").strip()[:100]
    category = category if category in NEWS_CATEGORIES else ""
    page = max(0, page)
    page_size = max(1, min(NEWS_PAGE_SIZE_MAX, page_size))
    offset = page * page_size

    total = count_news_articles(search=q or None, category=category or None)
    if total == 0 and not q and not category and page == 0:
        live = _news_live(lang)
        return {
            "available": bool(live), "items": live, "total": len(live),
            "page": 0, "page_size": page_size, "total_pages": 1, "has_more": False,
        }

    rows = get_news_articles(page_size, offset=offset, search=q or None, category=category or None)
    total_pages = max(1, -(-total // page_size))  # ceil division
    return {
        "available": total > 0,
        "items": _news_localize(rows, lang),
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "has_more": (page + 1) < total_pages,
    }


async def get_news(lang: str = DEFAULT_LANG, page: int = 0, page_size: int = NEWS_PAGE_SIZE_DEFAULT,
                    q: str = "", category: str = "") -> dict:
    q = (q or "").strip()
    ttl = NEWS_TTL if not q and not category and page == 0 else NEWS_SEARCH_TTL
    key = f"news:{lang}:{page}:{page_size}:{q.lower()}:{category}"
    return await asyncio.to_thread(get_or_fetch, key, ttl, lambda: _news_raw(lang, page, page_size, q, category))


# ---------------------------------------------------------------------------
# Trending keywords for the "🔥 Популярні теми" chips — mined from recent
# article titles instead of a hardcoded list, so they track what's actually
# in the archive.
# ---------------------------------------------------------------------------

NEWS_KEYWORDS_TTL = 3600  # 1h — cheap to recompute, doesn't need to be fresher
NEWS_KEYWORDS_SAMPLE = 200  # most recent titles to mine
NEWS_KEYWORDS_TOP_N = 6

_KEYWORD_WORD_RE = re.compile(r"[A-Za-zА-ЯЁа-яёІіЇїЄєҐґ0-9'-]{3,}")

# Function words + generic space-news vocabulary that would otherwise dominate
# every headline (source names, "launch", "mission", …) and crowd out actually
# distinctive topics (mission/rocket/telescope names, planets, phenomena).
_KEYWORD_STOP_EN = {
    "the", "and", "for", "are", "was", "were", "with", "from", "this", "that",
    "these", "those", "its", "their", "his", "her", "our", "your", "not",
    "will", "would", "can", "could", "may", "might", "has", "have", "had",
    "does", "did", "into", "about", "after", "before", "during", "between",
    "through", "over", "under", "again", "more", "most", "than", "then",
    "news", "space", "launch", "launches", "launched", "launching",
    "mission", "missions", "rocket", "today", "update", "updates", "says",
    "said", "new", "first", "live", "coverage", "nasa", "esa", "the", "sfn",
    "will", "how", "why", "what", "amid", "set", "eyes", "plans", "plan",
    "year", "years", "week", "month", "set",
}
_KEYWORD_STOP_UK = {
    "та", "і", "й", "у", "в", "на", "з", "із", "зі", "для", "до", "від",
    "про", "як", "що", "це", "цей", "ця", "ці", "він", "вона", "воно",
    "вони", "його", "її", "їх", "ми", "ви", "не", "ні", "або", "чи", "але",
    "а", "коли", "де", "після", "перед", "між", "через", "над", "під",
    "за", "без", "ще", "вже", "буде", "було", "були", "бути", "новий",
    "нова", "нове", "нові", "перший", "перша", "перше", "перші", "космічний",
    "космічна", "космічне", "космічні", "космос", "новини", "запуск",
    "запуску", "запуски", "місія", "місії", "місію", "ракета", "ракети",
    "сьогодні", "може", "можуть", "стане", "стали", "рік", "року", "днів",
}


def _extract_trending_keywords(lang: str, top_n: int = NEWS_KEYWORDS_TOP_N) -> list:
    """Rank words appearing in the most recent article titles by how many
    distinct articles mention them (not raw word count, so one repetitive
    headline can't dominate). Stopwords filter out function words and
    space-news boilerplate ("launch", "mission", source names, …)."""
    rows = get_news_articles(NEWS_KEYWORDS_SAMPLE)
    if not rows:
        return []
    stop = _KEYWORD_STOP_UK if lang == "uk" else _KEYWORD_STOP_EN
    counts: dict[str, int] = {}
    display: dict[str, str] = {}
    for r in rows:
        title = (r.get("title_uk") if lang == "uk" and r.get("title_uk") else r.get("title")) or ""
        seen = set()
        for w in _KEYWORD_WORD_RE.findall(title):
            lw = w.lower()
            if lw in stop or lw.isdigit() or lw in seen:
                continue
            seen.add(lw)
            counts[lw] = counts.get(lw, 0) + 1
            display.setdefault(lw, w if w[:1].isupper() else w.capitalize())
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return [display[w] for w, _ in ranked[:top_n]]


async def get_news_keywords(lang: str = DEFAULT_LANG) -> dict:
    keywords = await asyncio.to_thread(
        get_or_fetch, f"news_kw:{lang}", NEWS_KEYWORDS_TTL, lambda: _extract_trending_keywords(lang)
    )
    return {"keywords": keywords}


def _news_article_raw(slug, lang):
    """Article page data keyed by slug. The body (English) is stored at ingest
    time (from the RSS ``content:encoded``), so this only translates it to UK
    on first view (lazily, persisted — never retranslated). For legacy rows with
    no stored body, falls back to a lazy HTML fetch via ``get_article_content``.
    Returns 3 related articles in the same category."""
    it = get_news_article_by_slug(slug)
    if not it:
        return {"available": False}
    article_id = it.get("id")
    # Legacy row without a stored body → lazy HTML fetch (RSS gap / pre-RSS
    # ingest). New rows already carry the body from the feed — no HTTP fetch.
    if not it.get("body"):
        try:
            content = NewsParser.get_article_content(it["url"])
            body = content.get("body", "")
            image = content.get("image") or it.get("image")
            body_uk = ""
            if lang == "uk" and body:
                translated = Translator.translate_body(body)
                # Unchanged output means DeepL failed (quota/outage/no key) —
                # leave body_uk blank so it's retried on a later view instead
                # of permanently storing English text as the UK translation.
                body_uk = translated if translated != body else ""
            if body:
                set_news_article_body(article_id, body, body_uk, image)
                it["body"] = body
                it["body_uk"] = body_uk
                it["image"] = image
            if content.get("body_images"):
                set_news_article_images(article_id, it.get("slug") or slug, content["body_images"])
            if content.get("body_videos"):
                set_news_article_videos(article_id, content["body_videos"])
        except Exception as e:
            logger.error("news article body fetch: %s", e)
    # Lazy UK translation of the stored EN body — persisted so it's only done
    # once per article (DeepL quota: translating every new article's full body
    # at ingest would exceed the 500k/month free limit).
    if lang == "uk" and it.get("body") and not it.get("body_uk"):
        try:
            body_uk = Translator.translate_body(it["body"])
            if body_uk and body_uk != it["body"]:
                set_news_article_body(article_id, it["body"], body_uk, it.get("image"))
                it["body_uk"] = body_uk
        except Exception as e:
            logger.error("news article body translate: %s", e)
    body = (it.get("body_uk") if lang == "uk" and it.get("body_uk") else it.get("body")) or it.get("excerpt") or ""
    title = (it.get("title_uk") if lang == "uk" and it.get("title_uk") else it.get("title")) or ""
    related = _news_localize(
        get_related_news_articles(it.get("category") or "missions", slug, 3), lang
    )
    body_images = []
    if "[IMG:" in body:
        for row in get_news_article_images(article_id):
            full_rel = row.get("full_path")
            thumb_rel = row.get("thumb_path")
            src = f"/news-img/{full_rel}" if full_rel else row.get("source_url") or ""
            thumb = f"/news-img/{thumb_rel}" if thumb_rel else src
            body_images.append({"position": row.get("position"), "src": src, "thumb": thumb})
    body_videos = []
    if "[VIDEO:" in body:
        for row in get_news_article_videos(article_id):
            body_videos.append({"position": row.get("position"), "src": row.get("video_url") or ""})
    return {
        "available": True,
        "id": article_id,
        "slug": it.get("slug") or slug,
        "url": it.get("url") or "",
        "title": title,
        "body": body,
        "body_images": body_images,
        "body_videos": body_videos,
        "image": it.get("image") or "",
        "category": it.get("category") or "missions",
        "date": it.get("published_date") or "",
        "source": it.get("source") or "SpaceflightNow",
        "related": related,
    }


async def get_news_article_api(slug: str, lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(
        get_or_fetch, f"news_art:{slug}:{lang}", NEWS_ARTICLE_TTL,
        lambda: _news_article_raw(slug, lang)
    )


