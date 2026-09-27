"""Stored news rendered for every visitor, with the same data bootstrapping React."""
import asyncio
import html
import json
import logging
import re
from urllib.parse import urlencode, urlsplit

from fastapi.responses import HTMLResponse
from web.seo import SITE_URL, slug_for_name, prefix_for, render_html, _render_news_jsonld, _t

CATEGORIES = {"launches", "missions", "discoveries", "tech"}


def news_query(params):
    raw_page = params.get("page", "0")
    page = min(int(raw_page), 1_000_000) if re.fullmatch(r"[0-9]{1,7}", raw_page) else 0
    return page, params.get("q", "").strip()[:100], params.get("category", "") if params.get("category", "") in CATEGORIES else ""


def query_suffix(page=0, q="", category=""):
    pairs = {}
    if page:
        pairs["page"] = page
    if q:
        pairs["q"] = q
    if category:
        pairs["category"] = category
    return "?" + urlencode(pairs) if pairs else ""


def safe_url(value):
    value = str(value or "").strip()
    try:
        parsed = urlsplit(value)
    except ValueError:
        return ""
    return value if parsed.scheme in ("http", "https") or (value.startswith("/") and not value.startswith("//")) else ""


def render_news_content(data, lang, *, article=False, page=0, q="", category="", failed=False):
    e = html.escape
    base = f"/{prefix_for(lang)}/{slug_for_name('news', lang)}"
    tr = lambda *keys: _t(lang, *keys)
    out = [f'<main id="server-news" class="wrap p-news"><nav class="article-breadcrumb"><a href="/{prefix_for(lang)}/">OrbitLight</a> / <a href="{base}">{e(tr("nav", "news"))}</a></nav>']
    if failed:
        out.append(f'<h1>{e(tr("news", "loadError"))}</h1><p>{e(tr("news", "loadErrorSub"))}</p>')
    elif article:
        if not data.get("available"):
            out.append(f'<h1>{e(tr("news", "article", "unavailable"))}</h1>')
        else:
            out.append(f'<article><h1 class="page-title">{e(data["title"])}</h1><p>{e(data.get("source", ""))} · {e(data.get("date", ""))}</p>')
            image = safe_url(data.get("image"))
            if image:
                out.append(f'<img class="article-hero" src="{e(image, quote=True)}" alt="{e(data["title"], quote=True)}" fetchpriority="high">')
            out.append('<div class="article-body">')
            images = {str(im["position"]): im for im in data.get("body_images", [])}
            videos = {str(v["position"]): v for v in data.get("body_videos", [])}
            for paragraph in (data.get("body") or data.get("excerpt") or "").split("\n\n"):
                paragraph = paragraph.strip()
                media = re.fullmatch(r"\[(IMG|VIDEO):(\d+)\]", paragraph)
                if media:
                    item = (images if media[1] == "IMG" else videos).get(media[2], {})
                    src = safe_url(item.get("src"))
                    if src and media[1] == "IMG":
                        out.append(f'<img class="article-inline-img" src="{e(src, quote=True)}" alt="" loading="lazy">')
                    elif src:
                        out.append(f'<p><a href="{e(src, quote=True)}">{e(tr("news", "video"))}</a></p>')
                elif paragraph:
                    out.append(f'<p>{e(paragraph)}</p>')
            out.append('</div>')
            source = safe_url(data.get("url"))
            if source:
                out.append(f'<p><a href="{e(source, quote=True)}" rel="noopener noreferrer">{e(tr("news", "article", "readSource"))}</a></p>')
            out.append('</article>')
            if data.get("related"):
                out.append(f'<h2>{e(tr("news", "article", "relatedTitle"))}</h2><ul>')
                for item in data["related"]:
                    if item.get("slug"):
                        out.append(f'<li><a href="{base}/{e(item["slug"], quote=True)}">{e(item["title"])}</a></li>')
                out.append('</ul>')
    else:
        out.append(f'<h1 class="page-title">{e(tr("news", "title"))}</h1>')
        out.append(f'<form action="{base}" method="get" class="news-search"><input type="search" name="q" maxlength="100" value="{e(q, quote=True)}" aria-label="{e(tr("news", "search", "placeholder"), quote=True)}">')
        out.append('<select name="category">')
        for cat in ("", "launches", "missions", "discoveries", "tech"):
            selected = ' selected' if cat == category else ''
            out.append(f'<option value="{cat}"{selected}>{e(tr("news", "cat", cat or "all"))}</option>')
        out.append(f'</select><button type="submit">{e(tr("news", "searchButton"))}</button></form>')
        out.append('<div class="news-list view-cards">')
        for item in data.get("items", []):
            if not item.get("slug"):
                continue
            out.append(f'<a class="news-card" href="{base}/{e(item["slug"], quote=True)}"><div class="news-card-body"><h2>{e(item["title"])}</h2><p>{e(item.get("excerpt", ""))}</p><p>{e(item.get("source", ""))} · {e(item.get("date", ""))}</p></div></a>')
        out.append('</div>')
        if not data.get("items"):
            out.append(f'<p>{e(tr("news", "noMatch") if q or category else tr("news", "emptyArchive"))}</p>')
        out.append('<nav class="pagination" aria-label="Pagination">')
        for target, label in ((page - 1, tr("gallery", "prev")), (page + 1, tr("gallery", "next"))):
            if 0 <= target < data.get("total_pages", 1):
                out.append(f'<a class="pg-btn" href="{base}{e(query_suffix(target, q, category), quote=True)}">{e(label)}</a>')
        out.append('</nav>')
    out.append('</main>')
    return "".join(out)


def inject_news(index_html, content, path, data):
    payload = json.dumps({"path": path, "data": data}, ensure_ascii=False).replace("<", "\\u003c")
    result = index_html.replace('<div id="root"></div>', f'<div id="root">{content}</div>', 1)
    result = re.sub(r'<noscript>.*?</noscript>', '', result, flags=re.DOTALL)
    return result.replace('</body>', f'<script id="news-bootstrap" type="application/json">{payload}</script></body>', 1)


async def news_response(index_html, lang, slug, path, params):
    from web.data.news import _news_raw, _news_article_raw
    article = slug is not None
    page, q, category = news_query(params)
    base = f"{SITE_URL}/{prefix_for(lang)}/{slug_for_name('news', lang)}"
    suffix = '/' + slug if article else query_suffix(page, q, category)
    overrides = {"canonical": base + suffix,
                 "uk_alt": f"{SITE_URL}/ua/{slug_for_name('news', 'uk')}{suffix}",
                 "en_alt": f"{SITE_URL}/en/{slug_for_name('news', 'en')}{suffix}",
                 "noindex": bool(q or category) and not article}
    status, failed, schema = 200, False, ""
    try:
        if article:
            data = await asyncio.to_thread(_news_article_raw, slug, lang, enrich=False)
        else:
            data = await asyncio.to_thread(_news_raw, lang, page, 12, q, category, allow_live=False)
        if (article and not data.get("available")) or (not article and page > 0 and not data.get("items")):
            status = 404
            overrides["noindex"] = True
        if article and data.get("available"):
            overrides.update(title=data["title"], desc=(data.get("excerpt") or data.get("body", ""))[:160], image=data.get("image"), og_type="article")
            row = dict(data, published_date=data.get("date"))
            schema = _render_news_jsonld(row, lang)
        elif page:
            overrides["title"] = _t(lang, "title", "news") + f" — {'Сторінка' if lang == 'uk' else 'Page'} {page + 1}"
    except Exception:
        logging.getLogger(__name__).exception("Unable to render stored news")
        data, status, failed = None, 503, True
        overrides["noindex"] = True
    content = render_news_content(data or {}, lang, article=article, page=page, q=q, category=category, failed=failed)
    output = render_html(index_html, "news", lang, extra_jsonld=schema, overrides=overrides)
    output = inject_news(output, content, path, data)
    headers = {"Cache-Control": "no-store" if status != 200 else "public, max-age=60"}
    if status == 503:
        headers["Retry-After"] = "60"
    return HTMLResponse(output, status_code=status, headers=headers)
