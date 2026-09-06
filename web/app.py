"""FastAPI application that serves the NEOwatch website and runs the Telegram
bot in the same process.

Why one process: the bot's ``services/*`` modules and MySQL pool are shared
with the site, and a single event loop lets FastAPI and ``python-telegram-bot``
coexist without a second runtime. Uvicorn owns the loop; the bot is started
manually via PTB's async lifecycle (``initialize`` → ``start`` → either
``updater.start_polling`` or, when ``WEBHOOK_URL`` is set, ``bot.set_webhook``)
inside the FastAPI lifespan, and torn down in reverse on shutdown.

Webhook vs polling: with a real domain + TLS in front (nginx), webhook is the
more correct production setup — no long-poll traffic to Telegram, lower
latency. We don't use PTB's ``Application.run_webhook``/``Updater.start_webhook``
(that spins up its own aiohttp server, a second listener we don't want).
Instead, when ``WEBHOOK_URL`` is set, Telegram is told to POST updates to this
same FastAPI app's ``/webhook/telegram`` route (below), which pushes each
update onto ``application.update_queue`` — the exact queue PTB's own
``start_polling`` feeds, so ``Application.start()``'s update-processing task
handles both paths identically. Set ``WEBHOOK_SECRET`` too (Telegram's
``secret_token`` mechanism) so the endpoint isn't a bare unauthenticated
update-injection point. Without ``WEBHOOK_URL`` (local dev with no public
HTTPS URL), the bot falls back to polling.

Run with::

    uvicorn web.app:app --host 0.0.0.0 --port 8000

If ``BOT_TOKEN`` is unset (local site-only dev) the bot is skipped and only
the site + API are served.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles

from database import init_db
from web.admin_api import router as admin_router
from web.api import router as api_router
from web.auth_api import router as auth_router
from web.seo import (
    DEFAULT_LANG,
    SITE_URL,
    build_robots_txt,
    build_sitemap_images_xml,
    build_sitemap_index_xml,
    build_sitemap_news_xml,
    build_sitemap_pages_xml,
    name_for_slug,
    prefix_for,
    render_html,
    render_head,
    slug_for_name,
)
from web.seo import _render_news_jsonld, _render_faq_jsonld, render_admin_html, render_embed_html

logger = logging.getLogger(__name__)

# Make scheduler/service INFO logs visible in the journal. Uvicorn's default
# LOGGING_CONFIG only configures the `uvicorn*` loggers (each with
# propagate=False and its own handler) and leaves the ROOT logger with NO
# handler. As a result every app-level logger.info(...) — the scheduler's
# "Scheduler started" / "Checking…" / "Sent …" / "No subscribers", plus
# "Database initialized" and "Telegram bot polling started" — is silently
# dropped; only WARNING/ERROR leak out via Python's `lastResort` handler (which
# is why DeepL/APOD *errors* showed but no scheduler *progress* ever did). That
# left us blind to whether the scheduler was even running. Attach a stdout
# StreamHandler to root at INFO so these reach the journal alongside uvicorn's
# own logs. Uvicorn's loggers keep propagate=False, so nothing double-prints.
_root = logging.getLogger()
if not _root.handlers:
    _h = logging.StreamHandler()
    _h.setLevel(logging.INFO)
    _h.setFormatter(logging.Formatter("%(name)s: %(levelname)s: %(message)s"))
    _root.addHandler(_h)
_root.setLevel(logging.INFO)

# React SPA build (production). The SPA is the only served frontend; build it
# first with `npm run build` in my-app/ before starting the server.
REACT_BUILD_DIR = Path(__file__).resolve().parent.parent / "my-app" / "build"


def _build_bot_application():
    """Build the Telegram Application, or return None if no token is configured."""
    token = os.getenv("BOT_TOKEN")
    if not token:
        logger.warning("BOT_TOKEN not set — running site without the Telegram bot.")
        return None

    # Imported lazily so the site can boot without telegram deps in the env.
    from telegram.ext import Application

    from handlers import CommandHandlers, CallbackHandlers, MessageHandlers
    from telegram import Update
    from telegram.ext import (
        CallbackQueryHandler, CommandHandler, MessageHandler, filters,
    )

    application = (
        Application.builder()
        .token(token)
        .build()
    )
    application.add_handler(CommandHandler("start", CommandHandlers.start))
    application.add_handler(CommandHandler("help", CommandHandlers.help))
    application.add_handler(CommandHandler("fact", CommandHandlers.fact))
    application.add_handler(CallbackQueryHandler(CallbackHandlers.handle))
    application.add_handler(MessageHandler(filters.LOCATION, MessageHandlers.handle_location))
    application.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, MessageHandlers.handle)
    )
    return application


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the bot alongside the site, then shut both down cleanly.

    The public dashboard endpoints (weather, sky, launches …) don't touch the
    database, so a DB failure must not take the whole site down: we log it and
    skip the bot (which is useless without its tables) but keep serving the
    site and API.
    """
    db_ok = False
    try:
        init_db()
        db_ok = True
        logger.info("Database initialized")
    except Exception as exc:  # noqa: BLE001 — boot must not crash the site
        logger.error("Database init failed, running site without bot: %s", exc)

    ptb = None
    webhook_mode = False
    if db_ok:
        ptb = _build_bot_application()
        if ptb is not None:
            from telegram import Update
            from services.scheduler import NotificationScheduler
            try:
                await ptb.initialize()
                await ptb.start()
                webhook_url = os.getenv("WEBHOOK_URL", "").rstrip("/")
                if webhook_url:
                    webhook_secret = os.getenv("WEBHOOK_SECRET", "")
                    if not webhook_secret:
                        logger.warning(
                            "WEBHOOK_URL set without WEBHOOK_SECRET — the webhook "
                            "endpoint will accept unauthenticated updates from "
                            "anyone who finds the URL. Set WEBHOOK_SECRET (e.g. "
                            "`python3 -c \"import secrets; print(secrets.token_urlsafe(32))\"`)."
                        )
                    await ptb.bot.set_webhook(
                        url=f"{webhook_url}{_WEBHOOK_PATH}",
                        allowed_updates=Update.ALL_TYPES,
                        secret_token=webhook_secret or None,
                    )
                    webhook_mode = True
                    logger.info("Telegram bot webhook set to %s%s", webhook_url, _WEBHOOK_PATH)
                else:
                    await ptb.updater.start_polling(allowed_updates=Update.ALL_TYPES)
                    logger.info("Telegram bot polling started")
                # Start the notification scheduler as a background task on the
                # same loop. This used to live in `post_init`, but PTB only
                # invokes `post_init` from `run_polling`/`run_webhook` — and we
                # drive the lifecycle manually here (initialize → start →
                # start_polling), so `post_init` never ran and the scheduler
                # never started. No scheduled notifications were ever sent in
                # production. Start it explicitly now that the app is running
                # (create_task tracks it via __create_task_tasks so stop() can
                # await it). The legacy `bot.py` entrypoint uses run_polling,
                # so its post_init path still works.
                scheduler = NotificationScheduler()
                app.state.scheduler_task = ptb.create_task(
                    scheduler.run_scheduled_tasks()
                )
                logger.info("Scheduler started")
                app.state.bot = ptb
            except Exception as exc:  # noqa: BLE001
                logger.error("Bot startup failed, continuing site-only: %s", exc)
                ptb = None

    # Optional headless-Chrome prerendering for SEO bots (Phase C). Default
    # off; launch only when PRERENDER_ENABLED=1 and Playwright is installed.
    # The browser lives on app.state.prerender_browser and is closed below.
    if os.getenv("PRERENDER_ENABLED", "0") == "1":
        try:
            from web.prerender import launch_browser
            await launch_browser(app)
        except Exception as exc:  # noqa: BLE001 — must not break the site
            logger.error("Prerender startup failed: %s", exc)

    try:
        yield
    finally:
        # Cancel the scheduler loop first — it's an infinite `while True`, so
        # leaving it running would make ptb.stop() hang awaiting it.
        sched_task = getattr(app.state, "scheduler_task", None)
        if sched_task is not None and not sched_task.done():
            sched_task.cancel()
            try:
                await sched_task
            except BaseException:  # noqa: BLE001 — CancelledError/any loop error
                pass
        if ptb is not None:
            if not webhook_mode:
                await ptb.updater.stop()
            await ptb.stop()
            await ptb.shutdown()
            logger.info("Telegram bot stopped")
        # Close the prerender headless browser if it was started.
        if os.getenv("PRERENDER_ENABLED", "0") == "1":
            try:
                from web.prerender import close_browser
                await close_browser(app)
            except Exception:  # noqa: BLE001
                pass


app = FastAPI(title="NEOwatch", lifespan=lifespan)
app.include_router(api_router)
app.include_router(auth_router)
app.include_router(admin_router)

if not os.getenv("SESSION_SECRET"):
    logger.warning(
        "SESSION_SECRET not set — website account sessions are signed with an "
        "insecure dev-only default. Set SESSION_SECRET in .env before deploying "
        "(python3 -c \"import secrets; print(secrets.token_hex(32))\")."
    )

# Telegram webhook (see lifespan above for the WEBHOOK_URL/WEBHOOK_SECRET
# branch that decides polling vs webhook). The route is always mounted; it
# 503s if the bot isn't running and 401s on a missing/wrong secret token, so
# it's inert unless both BOT_TOKEN and WEBHOOK_URL are configured.
_WEBHOOK_PATH = "/webhook/telegram"


@app.post(_WEBHOOK_PATH, include_in_schema=False)
async def _telegram_webhook(request: Request):
    ptb = getattr(app.state, "bot", None)
    if ptb is None:
        return Response(status_code=503)
    secret = os.getenv("WEBHOOK_SECRET", "")
    if secret and request.headers.get("x-telegram-bot-api-secret-token") != secret:
        return Response(status_code=401)
    from telegram import Update  # lazy: site can boot without telegram deps
    data = await request.json()
    await ptb.update_queue.put(Update.de_json(data, ptb.bot))
    return Response(status_code=200)


@app.middleware("http")
async def _cache_headers(request, call_next):
    """Cache policy:
    - /api/* — no-store (live map/dashboard must not show stale JSON).
    - /static/* — CRA build assets with hashed filenames → immutable, 1y
      (Phase D Core Web Vitals: instant repeat loads, safe because a new
      build produces new hashes).
    Everything else (SPA shell, sitemap, robots) keeps the handler's own
    Cache-Control.
    """
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, max-age=0"
    elif path.startswith("/static/"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return response

# Static site: serve the React SPA build with a SPA fallback (any unknown path
# returns index.html so client-side routing works). The build must exist —
# run `npm run build` in my-app/ before starting the server.
if not (REACT_BUILD_DIR.is_dir() and (REACT_BUILD_DIR / "index.html").exists()):
    raise RuntimeError(
        f"React build not found at {REACT_BUILD_DIR}. "
        "Run `npm run build` in my-app/ first."
    )

_SPA_INDEX = REACT_BUILD_DIR / "index.html"
_SPA_STATIC = REACT_BUILD_DIR / "static"
if _SPA_STATIC.is_dir():
    app.mount("/static", StaticFiles(directory=_SPA_STATIC), name="react-static")

# Extensions of static assets the SPA build actually ships. A request whose
# last segment has an extension NOT in this set (e.g. /wp-login.php, /.env,
# /xmlrpc.php) is a scanner/exploit probe, not a client route or asset —
# return 404 instead of handing it the SPA shell (which previously made
# /wp-admin/install.php answer 200).
_SPA_ASSET_EXTS = {
    ".js", ".css", ".json", ".map", ".txt", ".xml",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".avif",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
}

# Locally-mirrored APOD images (data/apod/YYYY/MM/DD-<full|thumb>.<ext>),
# populated by the scheduler's poll_apod_archive + the one-shot backfill.
# Served at /apod-img/<rel> so the gallery loads cards from our own server
# instead of hotlinking apod.nasa.gov. Created on demand; the dir may not
# exist on a fresh deploy until the first APOD ingest runs.
_APOD_IMG_DIR = Path(__file__).resolve().parent.parent / "data" / "apod"
_APOD_IMG_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/apod-img", StaticFiles(directory=_APOD_IMG_DIR), name="apod-img")

# Locally-mirrored galaxy photos (data/galaxies/<key>/<nasa_id>-<full|thumb>.<ext>),
# populated by the scheduler's poll_galaxies + the one-shot backfill_galaxies.
# Served at /galaxy-img/<rel> so the gallery loads from our own server instead
# of hotlinking images-assets.nasa.gov. Created on demand.
_GAL_IMG_DIR = Path(__file__).resolve().parent.parent / "data" / "galaxies"
_GAL_IMG_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/galaxy-img", StaticFiles(directory=_GAL_IMG_DIR), name="galaxy-img")

# Locally-mirrored inline news-article body images (data/news/<slug>/<n>-
# <full|thumb>.<ext>), populated by database.ingest_news_articles /
# set_news_article_images. Served at /news-img/<rel> instead of hotlinking
# whichever of the 5 source sites the image came from. Created on demand.
_NEWS_IMG_DIR = Path(__file__).resolve().parent.parent / "data" / "news"
_NEWS_IMG_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/news-img", StaticFiles(directory=_NEWS_IMG_DIR), name="news-img")

# User-uploaded account avatars (data/avatars/<web_user_id>.jpg), written by
# web/auth_api.py's POST /api/auth/avatar (center-cropped + resized via
# Pillow). Fixed filename per user, overwritten on re-upload — the DB's
# avatar_url carries a `?v=<timestamp>` cache-buster so the browser refetches.
_AVATAR_IMG_DIR = Path(__file__).resolve().parent.parent / "data" / "avatars"
_AVATAR_IMG_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/avatar-img", StaticFiles(directory=_AVATAR_IMG_DIR), name="avatar-img")

# Admin-uploaded news cover images (data/news_covers/<article_id>.jpg),
# written by web/admin_api.py's POST /api/admin/news/{id}/cover. Deliberately
# a separate directory from /news-img (data/news/<slug>/, the inline
# body-image mirror) rather than data/news/<slug>/cover.jpg — the "Refresh
# from source" button (database.refresh_news_article_from_source) rmtree's
# that whole slug directory on every re-scrape, which would silently delete
# a manually-uploaded cover along with the stale inline images. Fixed
# filename per article, overwritten on re-upload — the DB's `image` column
# carries a `?v=<timestamp>` cache-buster so the browser refetches.
_NEWS_COVER_DIR = Path(__file__).resolve().parent.parent / "data" / "news_covers"
_NEWS_COVER_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/news-cover-img", StaticFiles(directory=_NEWS_COVER_DIR), name="news-cover-img")


def _spa_html(name: str, lang: str, status_code: int = 200,
              extra_jsonld: str = "", overrides: dict | None = None) -> HTMLResponse:
    """Serve the SPA shell with per-route SEO meta injected server-side.

    Crawlers that don't run JavaScript (FB/Twitter/Telegram scrapers, Bing) get
    a correct, unique <title>/description/canonical/OG/JSON-LD for the requested
    URL instead of the homepage's. See web/seo.py. ``name`` is the i18n route
    name; ``status_code`` lets unknown routes return HTTP 404 (real 404, not a
    soft SPA 404) while still showing the React NotFound page to humans.
    """
    body = render_html(_SPA_INDEX.read_text(encoding="utf-8"), name, lang,
                       extra_jsonld=extra_jsonld, overrides=overrides)
    return HTMLResponse(content=body, status_code=status_code,
                        headers={"Cache-Control": "public, max-age=300"})


@app.api_route("/sitemap.xml", methods=["GET", "HEAD"], include_in_schema=False)
async def _sitemap():
    return Response(build_sitemap_index_xml(), media_type="application/xml; charset=utf-8",
                    headers={"Cache-Control": "public, max-age=3600"})


@app.api_route("/sitemap-pages.xml", methods=["GET", "HEAD"], include_in_schema=False)
async def _sitemap_pages():
    return Response(build_sitemap_pages_xml(), media_type="application/xml; charset=utf-8",
                    headers={"Cache-Control": "public, max-age=3600"})


@app.api_route("/sitemap-news.xml", methods=["GET", "HEAD"], include_in_schema=False)
async def _sitemap_news():
    return Response(build_sitemap_news_xml(), media_type="application/xml; charset=utf-8",
                    headers={"Cache-Control": "public, max-age=3600"})


@app.api_route("/sitemap-images.xml", methods=["GET", "HEAD"], include_in_schema=False)
async def _sitemap_images():
    return Response(build_sitemap_images_xml(), media_type="application/xml; charset=utf-8",
                    headers={"Cache-Control": "public, max-age=3600"})


@app.api_route("/robots.txt", methods=["GET", "HEAD"], include_in_schema=False)
async def _robots():
    return Response(build_robots_txt(), media_type="text/plain; charset=utf-8",
                    headers={"Cache-Control": "public, max-age=3600"})


# --- Language detection for the root redirect ---------------------------------

_LANG_COOKIE = "neowatch.lang"


def _pick_lang_from_headers(accept_language: str | None) -> str:
    """Accept-Language → uk|en. uk/ru → uk, everything else → en."""
    if not accept_language:
        return DEFAULT_LANG
    al = accept_language.lower()
    for part in al.split(","):
        tag = part.split(";")[0].strip()
        if tag.startswith("uk") or tag.startswith("ru"):
            return "uk"
    return "en"


def _lang_for_request(request) -> str:
    cookie = request.cookies.get(_LANG_COOKIE)
    if cookie in ("uk", "en"):
        return cookie
    return _pick_lang_from_headers(request.headers.get("accept-language"))


def _lang_redirect(lang: str, set_cookie: bool = False) -> RedirectResponse:
    """301 to /<prefix>/ (uk→/ua/, en→/en/). Optionally set the lang cookie
    on first visit."""
    resp = RedirectResponse(url=f"/{prefix_for(lang)}/", status_code=301)
    if set_cookie:
        resp.set_cookie(_LANG_COOKIE, lang, max_age=60 * 60 * 24 * 365,
                        samesite="lax", httponly=False)
    return resp


def _serve_static_asset(full_path: str):
    """Return a FileResponse for a built SPA asset, or None if it isn't one.

    A request whose last segment has an extension NOT in ``_SPA_ASSET_EXTS``
    (e.g. /wp-login.php, /.env, /xmlrpc.php) is a scanner/exploit probe, not a
    client route or asset — return a 404 Response instead of handing it the SPA
    shell (which previously made /wp-admin/install.php answer 200).
    """
    target = (REACT_BUILD_DIR / full_path).resolve()
    try:
        target.relative_to(REACT_BUILD_DIR.resolve())
    except ValueError:
        return None
    if target.is_file():
        return FileResponse(target)
    _, ext = os.path.splitext(full_path.lower())
    if ext and ext not in _SPA_ASSET_EXTS:
        return Response(status_code=404)
    return None


def _try_news_article(slug: str):
    """Fetch a news article by slug for JSON-LD; None if DB unavailable / missing.

    Imported lazily so a DB outage never breaks the site shell; the news page
    still renders, just without per-article JSON-LD.
    """
    if not slug:
        return None
    try:
        from database import get_news_article_by_slug
        return get_news_article_by_slug(slug)
    except Exception:  # noqa: BLE001
        return None


def _try_galaxy(slug: str):
    """Fetch a galaxy by slug for per-galaxy SEO meta; None if DB unavailable /
    unknown slug. Lazy import so a DB outage never breaks the site shell."""
    if not slug:
        return None
    try:
        from database import get_galaxy_by_slug
        return get_galaxy_by_slug(slug)
    except Exception:  # noqa: BLE001
        return None


async def _spa_lang(lang: str, rest: str, request: Request):
    """Serve the SPA shell (or redirect / 404) for a /<lang>/<rest> URL.

    - Home (rest == "") → home meta.
    - News list (rest == news slug) → news meta.
    - News article (rest == <news slug>/<slug>) → per-article meta + NewsArticle
      JSON-LD; HTTP 404 if the article slug doesn't resolve in the DB (real 404,
      not a soft SPA 404). If the DB is unreachable we can't verify, so we serve
      the shell (200) and let the client decide.
    - Other rest → resolved via the slug map; unknown → HTTP 404.
    """
    rest = (rest or "").strip("/")
    # Trailing-slash canonicalization: the language home keeps its slash
    # (``/ua/``), every subpage must not (``/ua/mks``). A request with a
    # trailing slash on a subpage 301-redirects to the slash-less form so
    # there's no duplicate-content URL (canonical is slash-less).
    path = request.url.path
    pfx = prefix_for(lang)
    if path not in (f"/{pfx}/", f"/{pfx}") and path.endswith("/"):
        return RedirectResponse(url=path.rstrip("/") or f"/{pfx}", status_code=301)
    news_slug = slug_for_name("news", lang)
    galaxies_slug = slug_for_name("galaxies", lang)
    name = "home"
    status = 200
    extra_jsonld = ""
    overrides: dict | None = None

    if rest == "" or rest == "/":
        name = "home"
    elif rest == news_slug:
        name = "news"
    elif rest.startswith(news_slug + "/"):
        tail = rest[len(news_slug) + 1:]
        article_slug = tail.split("/")[0]
        if not article_slug or "/" in tail:
            name = "404"
            status = 404
        else:
            article = _try_news_article(article_slug)
            if article is None:
                name = "404"
                status = 404
            else:
                name = "news"
                headline = (article.get("title_uk") or article.get("title")) if lang == "uk" else article.get("title")
                excerpt = (article.get("excerpt_uk") or article.get("excerpt")) if lang == "uk" else article.get("excerpt")
                overrides = {
                    "title": headline or None,
                    "desc": (excerpt or "")[:160] or None,
                    "image": article.get("image") or None,
                    "canonical": f"{SITE_URL}/{prefix_for(lang)}/{news_slug}/{article_slug}",
                    "uk_alt": f"{SITE_URL}/ua/{slug_for_name('news','uk')}/{article_slug}",
                    "en_alt": f"{SITE_URL}/en/{slug_for_name('news','en')}/{article_slug}",
                }
                extra_jsonld = _render_news_jsonld(article, lang)
    elif rest.startswith(galaxies_slug + "/"):
        tail = rest[len(galaxies_slug) + 1:]
        galaxy_slug = tail.split("/")[0]
        if not galaxy_slug or "/" in tail:
            name = "404"
            status = 404
        else:
            galaxy = _try_galaxy(galaxy_slug)
            if galaxy is None:
                # Unknown slug (or DB unreachable — can't verify). If the DB is
                # down we can't tell, so serve the shell (200) and let the
                # client decide; a real unknown slug 404s here.
                from services.galaxies import GALAXY_BY_SLUG
                if galaxy_slug not in GALAXY_BY_SLUG:
                    name = "404"
                    status = 404
                else:
                    name = "galaxies"
            else:
                name = "galaxies"
                gname = (galaxy.get("name_uk") if lang == "uk" else galaxy.get("name_en")) \
                    or galaxy.get("name_uk") or galaxy.get("name_en") or ""
                gdesc = (galaxy.get("description_uk") if lang == "uk"
                         else galaxy.get("description_en")) or galaxy.get("description_uk") or ""
                overrides = {
                    "title": (gname + " — " + ("Галактики" if lang == "uk" else "Galaxies")) or None,
                    "desc": (gdesc or "")[:160] or None,
                    "canonical": f"{SITE_URL}/{prefix_for(lang)}/{galaxies_slug}/{galaxy_slug}",
                    "uk_alt": f"{SITE_URL}/ua/{slug_for_name('galaxies','uk')}/{galaxy_slug}",
                    "en_alt": f"{SITE_URL}/en/{slug_for_name('galaxies','en')}/{galaxy_slug}",
                }
    else:
        name = name_for_slug(lang, rest)
        if name == "404":
            status = 404
        elif name == "darksky":
            extra_jsonld = _render_faq_jsonld(lang)

    # Prerendering hook (Phase C): render full HTML for bots when enabled.
    if _PRERENDER_ENABLED and _is_bot(request.headers.get("user-agent", "")) \
            and request.headers.get("x-prerender-internal") != "1" and status == 200:
        rendered = await _maybe_prerender(lang, rest, name)
        if rendered is not None:
            return HTMLResponse(content=rendered, status_code=status,
                                headers={"Cache-Control": "public, max-age=600"})

    return _spa_html(name, lang, status_code=status,
                     extra_jsonld=extra_jsonld, overrides=overrides)


# --- Routes ------------------------------------------------------------------

@app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
async def _root(request: Request):
    """301 / → /<lang>/ by cookie (if set) else Accept-Language. Sets the
    cookie on the first visit so subsequent root hits are stable."""
    lang = _lang_for_request(request)
    has_cookie = request.cookies.get(_LANG_COOKIE) in ("uk", "en")
    return _lang_redirect(lang, set_cookie=not has_cookie)


@app.api_route("/ua", methods=["GET", "HEAD"], include_in_schema=False)
async def _spa_ua_root():
    return RedirectResponse(url="/ua/", status_code=301)


@app.api_route("/ua/{rest:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def _spa_ua(rest: str, request: Request):
    # /ua/  (rest == "")  → home. /ua/<slug> → _spa_lang.
    return await _spa_lang("uk", rest, request)


@app.api_route("/en", methods=["GET", "HEAD"], include_in_schema=False)
async def _spa_en_root():
    return RedirectResponse(url="/en/", status_code=301)


@app.api_route("/en/{rest:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def _spa_en(rest: str, request: Request):
    return await _spa_lang("en", rest, request)


@app.api_route("/admin", methods=["GET", "HEAD"], include_in_schema=False)
@app.api_route("/admin/{rest:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def _admin_dashboard(request: Request, rest: str = ""):
    """Admin dashboard shell — my-app/src/pages/admin/*, a top-level React
    route tree (/admin, /admin/news, /admin/users, /admin/photos,
    /admin/galaxies) outside the /:lang/* tree (an internal tool, not
    bilingual content). One shell for every sub-route since it's all one SPA;
    registered before the generic unprefixed catch-all below so it isn't
    mistaken for a legacy slug and 404'd. The actual admin check happens
    client-side against /api/auth/me and again server-side on every
    /api/admin/* call (web.auth.get_current_admin) — this route just serves
    the SPA shell, it doesn't gate anything itself."""
    body = render_admin_html(_SPA_INDEX.read_text(encoding="utf-8"))
    return HTMLResponse(content=body, headers={"Cache-Control": "no-store"})


@app.api_route("/embed/dark-sky", methods=["GET", "HEAD"], include_in_schema=False)
async def _embed_dark_sky(request: Request):
    """Bare (no header/nav/footer) embeddable Dark Sky map — see
    my-app/src/pages/EmbedDarkSky.js + EmbedLayout.js, a top-level React route
    outside the normal /:lang/* tree. Registered before the generic unprefixed
    catch-all below so /embed/dark-sky isn't mistaken for a legacy slug and
    redirected/404'd. Language-neutral URL by design (one stable `src` for
    embedders); optional ?lang=uk only affects the SSR'd <head> language/meta,
    the client-side i18n context reads its own default the same as any page."""
    lang = "uk" if request.query_params.get("lang") == "uk" else "en"
    body = render_embed_html(_SPA_INDEX.read_text(encoding="utf-8"), lang)
    return HTMLResponse(content=body, headers={"Cache-Control": "public, max-age=300"})


@app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def _spa_legacy(full_path: str, request: Request):
    """Catch-all for unprefixed URLs.

    - Built SPA assets (under the build dir) → FileResponse.
    - Scanner-noise extensions (.php, .env, …) → 404.
    - Legacy English-slug URLs without a language prefix (old inbound links to
      ``/iss``, ``/meteors``, …) → 301 to ``/en/<en-slug>`` to preserve link
      equity (the old site used English slugs, so they map to the EN version).
    - Legacy news article URLs ``/news/<slug>`` → ``/en/news/<slug>``.
    - Anything else → 404 (no duplicate unprefixed content).
    """
    if not full_path:
        return _lang_redirect(_lang_for_request(request), set_cookie=False)
    asset = _serve_static_asset(full_path)
    if asset is not None:
        return asset

    rest = full_path.strip("/")
    news_en = slug_for_name("news", "en")
    if rest == news_en or rest.startswith(news_en + "/"):
        return RedirectResponse(url=f"/en/{rest}", status_code=301)
    name = name_for_slug("en", rest)
    if name not in ("404", "home"):
        slug = slug_for_name(name, "en")
        target = "/en/" if not slug else f"/en/{slug}"
        return RedirectResponse(url=target, status_code=301)
    return Response(status_code=404)


# --- Prerendering (Phase C, env-gated) ----------------------------------------

_PRERENDER_ENABLED = os.getenv("PRERENDER_ENABLED", "0") == "1"


def _is_bot(user_agent: str) -> bool:
    ua = (user_agent or "").lower()
    return any(b in ua for b in (
        "googlebot", "bingbot", "yandex", "duckduckbot", "baiduspider",
        "slurp", "facebookexternalhit", "twitterbot", "linkedinbot",
        "applebot", "whatsapp", "telegrambot", "discordbot", "petalbot",
        "bytespider", "sogou", "exabot", "ia_archiver",
    ))


async def _maybe_prerender(lang: str, rest: str, name: str) -> str | None:
    """Render the page via headless Chrome for bots. Implemented in Phase C
    (web/prerender.py); returns None when disabled so the caller falls back to
    the meta-injected shell."""
    try:
        from web.prerender import get_rendered  # local import; optional dep
    except Exception:  # noqa: BLE001 — playwright may be absent
        return None
    try:
        return await get_rendered(lang, rest, name)
    except Exception as exc:  # noqa: BLE001
        logger.warning("prerender failed (%s/%s): %s — serving shell", lang, rest, exc)
        return None


logger.info("Serving React build from %s", REACT_BUILD_DIR)