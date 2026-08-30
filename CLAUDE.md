# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NEOwatch is a bilingual (UK/EN) space-tracking platform with two faces on one FastAPI process:
a **Telegram bot** and a **React SPA website** — asteroids, ISS, rocket launches, aurora forecasts,
meteor showers, exoplanets, comets, galaxies, Mars/planet data, deep-space news, and more. Both the
bot (`utils/i18n.py`, emoji-button inline keyboards) and the site (`my-app/src/i18n/`, translated
URL slugs) are UK/EN; a user's language choice on one doesn't carry over to the other.

## Development Commands

```bash
# Build the React site (required before the website will boot — web/app.py
# raises at import time if my-app/build/ is missing)
cd my-app && npm install && npm run build

# Run website + bot in one process (production entrypoint)
python3 -m uvicorn web.app:app --host 0.0.0.0 --port 8000
# Site-only dev (no bot/DB needed): BOT_TOKEN= python3 -m uvicorn web.app:app --port 8000

# React dev server (hot reload, proxies /api to :8000 — see my-app/package.json "proxy")
cd my-app && npm start

# Run bot only (legacy, no website)
python3 bot.py

# Or use the startup script (legacy: venv + bot.py only, doesn't build/serve the site)
./start.sh

# Install Python dependencies
pip install -r requirements.txt

# Production deployment uses systemd (see DEPLOY.md, incl. §7b React build,
# §7c prerendering, §7d nginx compression)
sudo systemctl restart neowatch
sudo journalctl -u neowatch -f
```

## Architecture

### Website + Bot (`web/`, one process)
FastAPI serves the public site and runs the Telegram bot on a single event loop
(uvicorn owns the loop; the bot is started via PTB's async lifecycle inside the
FastAPI `lifespan`). If the DB or bot token is unavailable, the site keeps
serving the public dashboard (weather/sky/launches don't need the DB).

- `web/app.py` — FastAPI app. `lifespan` boots MySQL (`init_db()`); if that
  succeeds it builds the PTB `Application`, starts polling, and starts
  `NotificationScheduler` as a background task — DB failure just skips the bot,
  the site still serves. Mounts the **built** React SPA from `my-app/build/`
  (`REACT_BUILD_DIR`); raises at import time if that build doesn't exist, so
  `npm run build` is a hard prerequisite, including in dev. `/static` serves
  CRA's hashed JS/CSS (immutable cache); `/apod-img`, `/galaxy-img`, `/news-img`
  serve locally-mirrored images from `data/` (gitignored). `_spa_lang` handles
  the `/{lang}/*` catch-all: 301-redirects legacy unprefixed URLs, injects
  per-route SEO `<head>` server-side via `web/seo.py`, serves a real 404 for
  unknown slugs. Optional headless-Chrome prerendering for SEO/social bots
  behind `PRERENDER_ENABLED=1` (see `web/prerender.py`).
- `web/api.py` — all `/api/*` JSON routes (thin; consumed by the React pages
  via `fetch`). See the endpoint list below.
- `web/data.py` — structured data layer. The bot's `services/*` return
  Telegram-formatted *text*; this module reuses their internal raw-data helpers
  (e.g. `SpaceWeatherAPI._get_kp_index`) to produce JSON for the site. Sync
  `requests` calls are wrapped in `asyncio.to_thread` by the API layer. Also
  owns the Celestrak TLE stash/fallback (`_TLE_STASH`, persisted to
  `data/tle_stash/`) and shells out to `services/mast.py` as an isolated CLI
  subprocess for lightcurve/Hubble-JWST lookups (see below).
- `web/cache.py` — in-memory TTL cache shared with the bot (NOAA/N2YO/NASA are
  rate-limited). Module-level dict; repopulates on restart.
- `web/seo.py` — the SEO engine and single source of truth for site URLs: the
  `SLUGS` map (route name → translated UK/EN slug), sitemap builders (index,
  pages, news, images), `robots.txt`, `render_html`/`render_head` (server-side
  meta/JSON-LD injection into the SPA shell for bots and social scrapers).
  Mirrored client-side by `my-app/src/lib/seo.js` for in-app `<title>`/meta
  updates on navigation.
- `web/prerender.py` — headless-Chrome (Playwright) prerendering for non-JS
  crawlers (Bing, social-card scrapers); off by default
  (`PRERENDER_ENABLED=1` + `playwright install chromium` to enable). Self-fetches
  its own rendered HTML with an `X-Prerender-Internal` header to avoid
  recursing into itself; cached to disk + memory.
- `web/online.py` — in-process "online now" visitor counter (90 s heartbeat
  window) plus day/week unique-visitor counts backed by the `site_visits`
  table. IPs are stored only as a truncated SHA-256 hash, deduped, 7-day
  retention.
- `web/feedback.py` — footer feedback form → forwards the message to Telegram
  via the bot (`FEEDBACK_CHAT_ID`). No SMTP path; returns 503 if unconfigured.
- `web/auth.py` / `web/auth_api.py` — website account system (registration,
  login, Google/Telegram sign-in, account page). See "Website accounts"
  below.

### Website accounts (`web/auth.py`, `web/auth_api.py`)
Email/password + Google + Telegram registration and login, an account page
(profile, Telegram connect/verify, notification toggles, danger zone), and
a `web_users` table (see Database below) — **decoupled from the bot's
`users` table**, the same way `push_subscriptions` is: a site visitor isn't
necessarily a Telegram user. `web_users.telegram_user_id` optionally links a
web account to an existing bot `users` row once verified through the
Telegram Login Widget; once linked, the account page's notification toggles
read/write that bot row's `subscribed_*` columns directly
(`database.set_subscription`) rather than keeping a second copy — one set of
subscriptions for the site and the bot, matching the account page's own
copy. Before that link exists, the notification section is shown disabled
with a "connect Telegram" prompt, since delivery is exclusively via the bot.

- **Sessions**: a JWT (`pyjwt`) in an httpOnly, `SameSite=Lax` cookie
  (`nw_session`) — no server-side session table. `SameSite=Lax` already
  keeps the cookie off cross-site POST/fetch, so the JSON API doesn't need a
  separate CSRF token. `web_users.token_version`, bumped on password change,
  invalidates every previously-issued token for that account without a
  revocation list.
- **No email verification, no password reset.** The project has no SMTP —
  only the Telegram bot and translation APIs send anything externally.
  Accounts are trusted at signup; a forgotten password with no linked
  Google/Telegram is currently unrecoverable. Documented gap, not an
  oversight.
- **Google Sign-In** is verified by calling Google's own
  `https://oauth2.googleapis.com/tokeninfo` REST endpoint and checking
  `aud` against `GOOGLE_CLIENT_ID`, rather than pulling in the `google-auth`
  package — consistent with this codebase's preference for thin
  `requests`-based wrappers over heavy SDKs (see MAST subprocess isolation
  below, or the GW-alerts Kafka rationale).
- **Telegram Login Widget** verification is local HMAC-SHA256 over the
  widget's payload (stdlib `hashlib`/`hmac`, no HTTP call), per Telegram's
  own spec, plus an `auth_date` freshness check to block replay. The
  frontend loads Telegram's and Google's own `<script>` widgets on demand
  (`my-app/src/hooks/useOAuthWidgets.js`, used by `Login.js`/`Register.js`/
  `Account.js`) — neither is an npm dependency. The **same** `/api/auth/telegram`
  endpoint both logs in/registers a fresh visitor and links Telegram to an
  already-signed-in email/Google account, depending on whether a session
  cookie is already present when it's called.
- Requires a one-time `/setdomain` on @BotFather (site's real domain) before
  Telegram will render the login widget on it at all, and a Google Cloud
  OAuth Web-application client ID with the site's origin as an authorized
  JavaScript origin. See `DEPLOY.md` §5 for both.
- Account/auth routes (`login`/`register`/`account`) are real SPA routes
  (in `web/seo.py` `SLUGS`, mirrored in `my-app/src/lib/seo.js`) but marked
  noindex and excluded from the sitemap (`web/seo.py` `_NOINDEX_NAMES`) —
  utility pages, not content.

### Website frontend (`my-app/`, React SPA)
Create React App (react-scripts 5, React 19) — **replaced the old static
`site/` templates**. Key deps: `react-router-dom` v7, `react-i18next`,
`zustand`, `chart.js`, `leaflet` + `satellite.js` (satellite maps), `pixi.js`
(planet moon-system viewers), `three` + `@react-three/fiber`/`drei`
(3D solar system). `npm start` proxies `/api/*` to `:8000` in dev
(`"proxy"` in `package.json`); production serves the static `npm run build`
output from FastAPI (see `web/app.py` above).

- **Routing**: everything lives under `/ua/*` or `/en/*`. `App.js` routes a
  single `/:lang/*` catch-all through a language router that maps each
  translated slug (from `web/seo.py`'s `SLUGS`, mirrored in `src/lib/seo.js`)
  to a page component.
- **i18n**: `src/i18n/{uk,en}.json` + `context/LanguageContext`, via
  `react-i18next`.
- **Pages** (`src/pages/*.js`, ~34 files): home (`orbit-light` redesign —
  Tonight/Weather/ISS/Launches panels), iss, satellites (Celestrak group
  chip-bar map), weather (space weather + Mars card), constellations, mast,
  meteors, asteroids, events, darksky (observing conditions/light pollution),
  launches, news + news article, deep (debris/GRB hub), voyager, comets,
  exoplanets, gallery (APOD archive), galaxies + galaxy detail, planetarium
  hub + one page per planet (Mercury, Venus, Earth, Mars, Jupiter, Saturn,
  Uranus, Neptune — Jupiter/Saturn/Uranus/Neptune each also have a fullscreen
  PixiJS moon-system viewer), solarsystem3d (three.js), login/register/account
  (website account system — see "Website accounts" above). `RtlSdr.js` and
  `Community.js` exist as page components but are intentionally unlinked (no
  nav entry, excluded from the sitemap in `web/seo.py`) — treat as
  work-in-progress/hidden, not dead code to delete without checking first.
- **Web Push**: browser push notifications (VAPID), decoupled from Telegram
  `users` — see `services/webpush.py` and the `push_subscriptions` table.
  Independent of the website account system above (`web_users`) — a browser
  can be push-subscribed with no account at all.

`templates/radio.html` is a standalone, hand-built HTML prototype ("Космічне
радіо наживо") for a live space-radio-streams concept page — **not currently
wired into `web/app.py`**; nothing serves it. Treat it as a design reference,
not a live route, unless/until it's actually mounted.

### API endpoints (`web/api.py`)
All GET unless noted, most cached via `web/cache.py`:

**Weather / sky**
- `/api/weather` — Kp, solar wind, Bz, X-ray, aurora chance (NOAA SWPC)
- `/api/weather/series` — chart time-series (Kp history/forecast, solar wind,
  GOES X-ray) for `weather.html`'s Chart.js panels; storm banner at Kp ≥ 5
- `/api/sky?lat&lon` — tonight digest: ISS pass + top planet + meteor + Moon
- `/api/observing-conditions?lat&lon` — cloud cover/seeing-style forecast for
  the darksky page
- `/api/moon` — phase, illumination, days to full/new

**ISS**
- `/api/iss/passes?lat&lon` — next visible passes (N2YO; defaults to Kyiv)
- `/api/iss/now` — current ground position (N2YO)
- `/api/iss/crew` — crew count + expedition (corquaid API)

**Objects / events**
- `/api/neo` — upcoming asteroid close approaches, LD distances (NASA NEO)
- `/api/planets?lat&lon` — naked-eye planets, altitude/azimuth (skyfield)
- `/api/meteors` — full meteor-shower calendar (peak dates, ZHR, radiant, best
  time, status; reuses `MeteorShower.get_upcoming_showers`)
- `/api/events` — eclipses, conjunctions, weekly digest (retrogrades,
  supermoons, meteor maxima) — see `services/astronomy.py`
- `/api/comets` — currently-visible comets
- `/api/exoplanets` — confirmed-exoplanet data
- `/api/galaxies`, `/api/galaxies/{slug}` — curated galaxy catalog + detail
  (NED redshift/type, mirrored photos)
- `/api/grb?limit=` — recent gamma-ray burst alerts (NASA GCN Circulars)
- `/api/gw?limit=` — recent LIGO/Virgo/KAGRA gravitational-wave alerts, read
  from the bot's notification cache, not Kafka directly (`services/gw_alerts.py`,
  see "Alert feeds" below)
- `/api/sentry?limit=` — asteroids with a non-zero modeled impact probability
  (NASA/JPL Sentry), distinct from `/api/neo`'s plain close-approach list
- `/api/reentries?days=&limit=` — recently decayed/re-entered objects
  (CelesTrak SATCAT) — retrospective, not predictive
- `/api/flares?limit=` — discrete solar-flare events (begin/max/end + class),
  a richer sibling of `/api/weather/series`'s aggregated X-ray flux curve
- `/api/debris` — curated space-debris stats (ESA Space Environment Report)
- `/api/voyager` — Voyager 1/2 propagated distance/speed/light-time
- `/api/dsn` — NASA Deep Space Network Now: live antenna/spacecraft contact
  status (`services/dsn.py`, see "Live status" below)

**Per-planet pages**
- `/api/jupiter`, `/api/mercury`, `/api/saturn`, `/api/neptune`,
  `/api/uranus`, `/api/venus`, `/api/earth`, `/api/earth/quakes`,
  `/api/earth/day` — live distance/opposition/fact data feeding the
  planetarium per-planet pages

**Launches / Mars**
- `/api/launches` — upcoming launches (Launch Library 2)
- `/api/mars` — Mars weather from the (now-frozen, mission-ended) NASA InSight
  feed; `available:false` handled
- `/api/mars/rovers` — Mars rover photos (Mars Vista API, see
  `services/mars_rover.py`)

**News / APOD**
- `/api/news`, `/api/news/keywords`, `/api/news/{slug}` — news archive (DB
  table `news_articles`, ingested by `parsers/news.py` + the scheduler's RSS
  poll; bot and site both read from the DB, not live-scraping per request)
- `/api/apod` — today's APOD
- `/api/apod/archive` — mirrored APOD gallery archive (`apod_entries` table)

**Satellites / location**
- `/api/tle?group=&limit=`, `/api/tle/groups` — Celestrak TLE for
  client-side SGP4 propagation (see the satellite map below)
- `/api/geocode?q=`, `/api/geocode/reverse`, `/api/geo/ip` — location lookup
  (Nominatim proxy / reverse geocode / IP-based fallback)

**Site meta**
- `/api/online` — live/day/week visitor counts (`web/online.py`)
- `POST /api/feedback` — footer feedback form → Telegram (`web/feedback.py`)

**MAST (subprocess-isolated — see below)**
- `/api/mast/lightcurve`, `/api/mast/hubble-jwst`

**Web Push**
- `/api/push/vapid-public-key`, `POST /api/push/subscribe`,
  `POST /api/push/unsubscribe`

**Website accounts** (`web/auth_api.py`, prefix `/api/auth`, see "Website
accounts" above)
- `GET /api/auth/config` — public `{google_client_id, telegram_bot_username}`
  for rendering the sign-in buttons
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- `POST /api/auth/google`, `POST /api/auth/telegram` — find-or-create/login;
  `/telegram` also links to the current session if one exists
- `POST /api/auth/telegram/unlink`, `POST /api/auth/change-password`
- `GET /api/auth/me`, `PATCH /api/auth/me`, `DELETE /api/auth/me`
- `PATCH /api/auth/notifications` — 409 if Telegram isn't linked yet

Interactive satellite maps (Leaflet + `satellite.js`, client-side SGP4): the
browser propagates each satellite's TLE itself every second so markers move in
real time with no per-frame API calls. ISS page shows the station only
(follow + ground track + visibility footprint); the satellites page has a
group-selector chip bar toggling Celestrak groups (Starlink, visual, stations,
weather, GPS, geo, amateur, …) on/off.

### MAST subprocess isolation (`services/mast.py`)
`lightkurve` + `astropy` + `astroquery` are heavy enough (hundreds of MB
resident) that importing them in the main FastAPI process risked OOM-killing
the whole site under the unit's memory limit. `services/mast.py` is invoked as
a standalone CLI by `web.data._run_mast_subprocess`, so the heavy imports live
and die in a disposable child process; results are cacheable and requests that
outlive the subprocess (past a proxy's own timeout) don't take the main
process down with them.

### Alert feeds (Deep + Weather pages)
Four "alert feed" style additions, each sourced differently based on what
survived a feasibility check — see each service module's docstring for the
sources that were *rejected* and why, not just the one that was picked:

- **Gravitational-wave alerts** (`services/gw_alerts.py`, `GWAlertAPI`) — the
  only exception to "services/\* = one-shot HTTP request/response" in this
  codebase. LIGO/Virgo/KAGRA public alerts are distributed over a **Kafka**
  topic (`igwn.gwalert`) via NASA's GCN, not REST — GraceDB's own REST API
  needs a SciToken and isn't meant for polling, and the classic GCN Circulars
  archive already scraped for GRBs (`grb_alerts.py`) barely carries LVK
  content. We do **not** run a persistent streaming consumer inside the
  FastAPI process (that needs its own reconnect/health-check lifecycle this
  codebase doesn't otherwise have) — instead
  `services/scheduler.py: check_gw_alerts` does a short connect →
  consume(timeout=8s) → commit → close cycle every 15 minutes, using a
  **stable Kafka `group.id`** so the broker remembers our read position
  between runs (`gcn_kafka`'s wrapper defaults to a random UUID per
  connection otherwise — see `services/gw_alerts.py`'s module docstring).
  Fully optional: without `GCN_CLIENT_ID`/`GCN_CLIENT_SECRET` (free, from
  https://gcn.nasa.gov's "Client Credentials" quickstart) it silently no-ops
  everywhere — bot notifications, `/api/gw`, and the deep-space page section
  all just show nothing/a "not configured" hint. The bot side otherwise
  mirrors `check_grb_alerts`/`grb_notifications` exactly (dedup table,
  `subscribed_gw` column on `users`/`push_subscriptions`, settings toggle),
  per the same reasoning as GRB alerts. One deliberate deviation: the
  `gw_notifications` table doubles as the **display cache** for both
  `/api/gw` and the bot's on-demand "recent alerts" command
  (`get_recent_gw_alerts`) — re-polling Kafka for an on-demand read would
  consume and commit the same offsets the scheduled notifier relies on,
  silently stealing alerts from it. Retention is 180 days (not GRB's 30) —
  LVK observing runs have multi-month gaps, and a shorter window could leave
  the display empty for the whole length of one.
- **Sentry** (`services/sentry.py`, `SentryAPI`) — NASA/JPL's public,
  documented, no-key risk-table API (`ssd-api.jpl.nasa.gov/sentry.api`),
  ranked by cumulative Palermo Scale. A normal one-shot fetch, no surprises.
- **Reentries** (`services/reentries.py`, `ReentryAPI`) — deliberately
  **retrospective** ("what came down"), not predictive ("what's about to").
  The Aerospace Corporation's CORDS program (the usual source for predicted
  reentries) has no public API/feed — their site is a static marketing page.
  Instead this downloads CelesTrak's full SATCAT CSV
  (`celestrak.org/pub/satcat.csv`, ~5.5 MB, all objects since Sputnik) and
  filters client-side to `DECAY_DATE` within the last N days — CelesTrak's
  `satcat/records.php` query-by-date-range syntax isn't documented well
  enough to rely on (returned "Invalid query" for every form tried).
- **Solar flares** (`services/space_weather.py: SpaceWeatherAPI.
  get_recent_flare_events`) — NOAA's discrete per-event flare product
  (`xray-flares-7-day.json`: begin/max/end time + class), as opposed to the
  continuous flux series `/api/weather/series` already charts. Distinct from
  `check_significant_flare` (used for bot alerting, works off the raw flux
  series to detect a threshold crossing) — the events endpoint is richer but
  doesn't itself signal "this is new," so it isn't used for dedup/alerting.

### "Live status" widgets (Voyager + Weather pages)
Three small features surfacing what's happening in space *right now*, each
sourced differently based on what's actually publicly/reliably available:

- **DSN Now** (`services/dsn.py` → `/api/dsn`, rendered by
  `my-app/src/components/voyager/DsnNow.js` on the Voyager page) — parses
  NASA's public DSN Now XML feed (`eyes.nasa.gov/dsn/data/dsn.xml`, no key)
  to show which Deep Space Network antenna is currently in contact with
  Voyager 1/2 (and a table of every other active spacecraft contact). The
  feed's `<station>` and `<dish>` elements are **siblings** under `<dsn>`,
  not nested — a dish belongs to whichever station most recently preceded it
  in document order; `DSNService.get_status()` reconstructs the grouping
  while walking the tree once. 30s cache TTL (`DSN_TTL` in `web/data.py`) —
  short because this is genuinely live, unlike the hour-scale TTLs elsewhere.
  Voyager 1/2 frequently show "no active contact" — DSN doesn't track them
  continuously, only during scheduled passes — the frontend treats that as a
  normal state, not an error.
- **Sun disk now** (`my-app/src/components/weather/SunNow.js` on the Weather
  page, **no backend involved**) — embeds NASA SDO's public "latest frame"
  image URLs directly (`sdo.gsfc.nasa.gov/assets/img/latest/latest_512_*.jpg`,
  refreshed server-side by NASA every ~15 min); the component just
  cache-busts with a 15-minute time bucket so the browser re-fetches instead
  of serving a stale copy. Deliberately has no `/api/*` endpoint — there's
  nothing for our backend to add by proxying static images.
- **Hubble/JWST "what they're observing"** — deliberately **not** built as a
  live feed. The only tool that shows literal current targets
  (spacetelescopelive.org, run by STScI) calls an undocumented, session
  (ULID)-gated internal API not meant for third-party use — reverse-engineering
  it was ruled out as fragile/inappropriate. The existing
  `/api/mast/hubble-jwst` (see MAST subsection above) already covers this
  space honestly: recent *publicly released* HST/JWST science images for a
  fixed list of famous targets, shown on the MAST page's "Latest Space
  Telescope Targets" section — framed as "recent", not "live now".

### Entry Point (`bot.py`)
- Creates `Application` with `BOT_TOKEN`
- Registers handlers from `handlers/` module
- Initializes database via `init_db()`
- Starts `NotificationScheduler` as background task in `post_init`
- Legacy bot-only entrypoint; production uses `uvicorn web.app:app` (see
  above). `start.sh` still only sets up a venv and runs this legacy path — it
  does not build or serve the website.

### Handler Structure (`handlers/`)
- `commands.py` - `/start`, `/help` command handlers
- `callbacks.py` - Inline keyboard button handlers (main UI router)
- `messages.py` - Text message handlers (city input)

Keyboards live in `utils/keyboards.py` (single source of truth), built per-call
from the user's language via `utils/i18n.py`'s `t(key, lang)`. Menu is nested:
`get_main_menu` (ISS/supутники, Launches, NEO, APOD, Weather, Sky events,
Settings) → `get_iss_menu`, `get_weather_menu` (space weather, aurora, Mars),
`get_sky_menu` (meteors, astronomy events, moon, planets, rovers, weekly
digest, facts, deep-space submenu) → `get_deep_menu` (Voyager, debris, GRB,
gravitational-wave alerts).
`callbacks.py` routes `callback_data` to handler methods; `get_language_picker`
drives the `/language` UK↔EN switch.

### Services (`services/`)
External API wrapper classes/modules, mostly static methods. Grouped roughly
by what they back:

- Bot-era core: `nasa_api.py` (`NasaAPI` — NEO, APOD), `n2yo_api.py`
  (`N2YOAPI` — ISS position/passes, Starlink), `launch_api.py` (`LaunchAPI` —
  Launch Library 2), `space_weather.py` (`SpaceWeatherAPI` — Kp/aurora),
  `iss_map.py` (ISS crew, ground-track helpers), `scheduler.py`
  (`NotificationScheduler`)
- Solar system / planets: `planets.py`, `astronomy.py` (retrogrades,
  supermoons, weekly calendar), `jupiter.py`, `mercury.py`, `saturn.py`,
  `neptune.py`, `uranus.py`, `venus.py`, `moon_mars.py` (Mars weather),
  `mars_rover.py` (Mars Vista API rover photos)
- Deep space: `comets.py`, `exoplanets.py`, `voyager.py`, `debris.py`
  (space-debris stats), `grb_alerts.py` (GCN circulars), `gw_alerts.py`
  (gravitational-wave alerts, GCN Kafka), `sentry.py` (JPL asteroid
  impact-risk table), `reentries.py` (CelesTrak recent decays), `dsn.py`
  (DSN Now live status), `galaxies.py` + `galaxy_commons.py` +
  `galaxy_images.py` (NED + image mirroring), `mast.py` (MAST/lightkurve,
  subprocess-isolated — see above)
- Media/content: `apod_images.py` (APOD archive mirroring), `news_images.py`
  (news image mirroring), `facts.py`
- `webpush.py` — Web Push (VAPID) fan-out to `push_subscriptions`

### Parsers (`parsers/`)
- `spaceflightnow.py` (`SpaceflightNowParser`) — legacy scraper for
  spaceflightnow.com's launch schedule/news
- `news.py` — the current multi-source RSS/scrape parser feeding the
  `news_articles` archive (ESA, Universe Today, SpaceNews, etc.), polled by
  the scheduler every 2 hours

### Database (`database.py`)
MySQL with connection pooling. Tables:

- `users` — profiles, locations, subscription flags, quiet hours, ISS
  brightness filter
- `iss_passes` — pass history
- `launch_notifications`, `neo_notifications`, `news_notifications`,
  `meteor_notifications` — per-notification-type dedup tracking
- `flare_notifications`, `storm_notifications`, `grb_notifications` — dedup
  tracking for the newer alert types (solar flares, geomagnetic storms, GRBs)
- `gw_notifications` — dedup tracking for gravitational-wave alerts, unique
  on (superevent_id, alert_type); also doubles as the display cache for
  `/api/gw` and the bot's on-demand "recent alerts" command — see "Alert
  feeds" above
- `news_articles`, `news_article_images`, `news_article_videos` — the news
  archive backing both the bot's daily digest and `/api/news*`
- `apod_entries` — mirrored APOD gallery archive (`/api/apod/archive`)
- `galaxies`, `galaxy_photos` — curated galaxy catalog + mirrored images
- `site_visits` — online-visitor tracking for `web/online.py` (hashed IPs,
  7-day retention)
- `push_subscriptions` — Web Push subscriptions (lat/lon/lang, not tied to a
  Telegram user)
- `web_users` — website account identities (email/password, Google, and/or
  linked Telegram), decoupled from `users` the same way `push_subscriptions`
  is; `telegram_user_id` optionally FKs to `users.user_id` once verified —
  see "Website accounts" above

Connection pool initialized lazily in `get_db_connection()`. All functions
handle connection cleanup in `finally` blocks.

### Scheduler (`services/scheduler.py`)
`NotificationScheduler.run_scheduled_tasks()` loops once a minute, anchored to
the wall clock (sleeps to the next exact minute rather than a flat 60 s, so
drift can't skip an exact-minute trigger):

- **09:00** — APOD to subscribers, then mirrors the last ~7 days into the
  APOD photo archive (idempotent)
- **10:00** — daily news digest (translated) + astronomy-events check
- **22:00** — meteor shower reminders (1 day before peak and on peak day)
- Every 10 min — ISS pass notifications (5–15 min before a visible pass)
- Every 5 min — launch notifications (single alert, -10 to +5 min around
  actual liftoff — not staged 24h/2h/30min reminders, since Launch Library
  `net` times slip often enough that advance reminders would frequently be
  stale)
- Every hour — hazardous asteroid check, solar flare check, geomagnetic storm
  check
- Every 30 min — GRB alert check
- Every 15 min — gravitational-wave alert check (no-ops without
  `GCN_CLIENT_ID`/`GCN_CLIENT_SECRET`)
- Every 2 hours (00:00, 02:00, …) — poll the news RSS feed into `news_articles`
  (placed before the 10:00 digest so the archive is fresh)
- Weekly, Monday 03:00 — re-fetch NED galaxy redshift/type, retry failed photo
  mirrors

Duplicate prevention uses database tracking for all notification types. Web
Push fan-out (`services/webpush.py`) rides alongside the Telegram sends in
several of these checks (at minimum `check_iss_passes`) for subscribed browser
clients.

### Translation (`utils/translator.py`)
- `Translator.translate()` - Uses MyMemory API (free, 1000 words/day)
- `Translator.translate_apod()` - Translates APOD descriptions to Ukrainian
- `Translator.translate_news()` - Translates news titles and excerpts
- `DEEPL_API_KEY` (config.py) exists alongside MyMemory — check
  `utils/translator.py` before assuming which path a given call takes if
  you're touching translation.

### i18n / keyboards (`utils/`)
- `keyboards.py` — bot inline-keyboard builders
- `i18n.py` — bot-side UK/EN string helper (site-side i18n lives in
  `my-app/src/i18n/`, unrelated code path)

## Configuration

Environment variables in `.env`:
```
NASA_API_KEY=          # From api.nasa.gov
N2YO_API_KEY=          # From n2yo.com
BOT_TOKEN=              # From @BotFather
MARS_VISTA_API_KEY=     # Optional. Free key from marsvista.dev/signin (Mars rover photos)
GEOAPIFY_KEY=           # Optional. Geoapify key for maps/geocoding
DEEPL_API_KEY=          # Optional. DeepL translation, alongside MyMemory
FEEDBACK_CHAT_ID=       # Telegram chat id the footer feedback form forwards to (needs BOT_TOKEN)
VAPID_PUBLIC_KEY=       # Web Push — generate via `python3 scripts/gen_vapid_keys.py`
VAPID_PRIVATE_KEY=
VAPID_CLAIM_EMAIL=
PRERENDER_ENABLED=      # Optional. 1 to enable headless-Chrome SEO prerendering (needs Playwright)
GCN_CLIENT_ID=          # Optional. Gravitational-wave alerts — free client at gcn.nasa.gov
GCN_CLIENT_SECRET=      # Optional. Paired with GCN_CLIENT_ID above
SESSION_SECRET=         # Website account sessions — generate with `python3 -c "import secrets; print(secrets.token_hex(32))"`, never rotate casually
GOOGLE_CLIENT_ID=       # Optional. Google Sign-In — OAuth Web-application client at console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_SECRET=   # Optional. Paired with GOOGLE_CLIENT_ID above (not actually used server-side, kept for parity)
TELEGRAM_BOT_USERNAME=  # Optional. Telegram Login Widget — needs @BotFather /setdomain on the site's domain too
DEFAULT_LAT/LON/ALT     # Default location (Kyiv)
DB_HOST/PORT/NAME/USER/PASSWORD  # MySQL credentials
```

## Key Implementation Details

- **User location**: Users set city via text message, geocoded via OpenStreetMap Nominatim
- **ISS tracking**: N2YO API returns pass data with UTC timestamps converted to local time
- **Country detection**: `COUNTRY_BBOXES` in `utils/constants.py` maps coordinates to country names
- **APOD handling**: Videos sent via `send_video`, images via `send_photo`; long captions split across two messages
- **Starlink tracking**: Checks multiple NORAD IDs from `STARLINK_NORAD_IDS` in config
- **News translation**: Automatic translation of news articles to Ukrainian (`parsers/news.py` + `utils/translator.py`)
- **Meteor showers**: Notifications at 22:00 (10 PM) - 1 day before peak and on peak day
- **Quiet hours**: Per-user, cycled via a settings button through `database.QUIET_HOURS_PRESETS`
  (`00:00-06:00` / `22:00-06:00` / `23:00-07:00` / off). Evaluated in the user's own local time via
  `utils.constants.local_hour_for_coords` (Kyiv zone inside Ukraine's bbox, solar-longitude estimate
  elsewhere — no timezone-database dependency), not a single Kyiv-wide window. Only applied to
  recurring, per-instance checks (`check_iss_passes`, launch "now" alerts) where missing one
  instance during quiet hours is fine because there's a next one; **not** applied to one-shot
  globally-deduped alerts (hazardous asteroids, flares, storms, GRB) or fixed-time daily broadcasts
  (APOD, daily news, meteor reminders), since those would be silently lost forever for a user rather
  than just delayed. See `NotificationScheduler._is_quiet_hours_for`.
- **ISS brightness filter**: Per-user, cycled via a settings button through `database.ISS_FILTER_PRESETS`
  (all passes / brighter than -1.5m / brighter than -3.0m). Applied in `check_iss_passes`; passes with
  unknown magnitude are still sent even with a filter set.
- **Skyfield ephemeris**: `services/planets.py` and `services/astronomy.py` use the `skyfield` library for offline ephemeris (visible planets, retrogrades, supermoon). JPL `de440s.bsp` (~32 MB) downloads on first use into `data/` (gitignored); pre-fetch on deploy via `python3 -c "from skyfield.api import Loader; load=Loader('data'); load('de440s.bsp'); load.timescale()"`. See DEPLOY.md §7a.
- **Mars rover photos**: `services/mars_rover.py` uses the community **Mars Vista API** (`api.marsvista.dev`, `X-API-Key` header). The former NASA Mars Rover Photos API at `api.nasa.gov/mars-photos` was retired (404 "No such app"). Requires `MARS_VISTA_API_KEY`; without it the 🚀 Марсоходи button shows a "key not configured" hint.
- **Constellations page**: backed by `data/hygdata_v40.csv.gz` (HYG star catalog, committed).
- **React build is a hard dependency**: `web/app.py` raises at import time if `my-app/build/index.html` is missing — always run `npm run build` (or have it already built) before starting `web.app`, including for local site-only dev.

## Notification Schedule

| Time | Event | Type |
|------|-------|------|
| 09:00 | APOD (+ archive mirror) | Daily |
| 10:00 | Space news digest + astronomy events | Daily |
| 22:00 | Meteor showers | Before peak |
| Every 10 min | ISS passes | Real-time |
| Every 5 min | Launches | Real-time |
| Every hour | Hazardous asteroids, solar flares, geomagnetic storms | Real-time |
| Every 30 min | GRB alerts | Real-time |
| Every 15 min | Gravitational-wave alerts (no-ops if `GCN_CLIENT_ID`/`SECRET` unset) | Real-time |
| Every 2 hours | News RSS poll (ingest, not user-facing) | Background |
| Weekly (Mon 03:00) | Galaxy catalog refresh (NED, background) | Background |

## Dependencies

Key packages from `requirements.txt`:
- `python-telegram-bot[job-queue]` - Bot framework with async support
- `mysql-connector-python` - MySQL connection pooling
- `fastapi` + `uvicorn[standard]` - Website + shared event loop with the bot
- `skyfield` - Offline ephemeris (planets, retrogrades, supermoons)
- `lightkurve` + `astroquery` - MAST light-curve/imagery lookups (subprocess-isolated, see above)
- `Pillow` - Image processing for mirrored APOD/galaxy/news images
- `pywebpush` - Web Push (VAPID) notifications
- `gcn-kafka` - Gravitational-wave alerts (Kafka consumer, wraps `confluent-kafka`); no-ops without GCN credentials
- `requests` - HTTP for external APIs
- `fuzzywuzzy` + `python-Levenshtein` - String matching for city search
- `playwright` (optional) - Headless-Chrome SEO prerendering, gated by `PRERENDER_ENABLED=1`

Frontend (`my-app/package.json`): React 19, `react-router-dom` v7, `react-i18next`, `zustand`, `chart.js`, `leaflet` + `satellite.js`, `pixi.js`, `three` + `@react-three/fiber`/`drei`/`postprocessing`.
