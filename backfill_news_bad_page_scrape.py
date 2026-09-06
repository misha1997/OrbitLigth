#!/usr/bin/env python3
"""One-off backfill for articles poisoned by junk-image bugs fixed in
``parsers/news.py`` (see ``_is_junk_image`` / ``_MAX_BODY_IMAGES``):

1. Page-scrape flood (``get_article_content``, the live-page fetch used for
   excerpt-only sources — ESA and Universe Today have no ``content:encoded``
   in their RSS, so every one of their stored bodies came from this path).
   Sites whose site-chrome wasn't wrapped in a real ``<header>``/``<nav>``
   tag (esa.int uses a plain ``<section id="esa-header">``) leaked into the
   scrape: the hero `image` could end up being a nav-bar icon
   (``ESA_Menu.svg``) instead of a real photo, and `news_article_images`
   could balloon to 40+ rows — an entire "Related Links" widget and/or full
   photo gallery harvested as if it were inline article content, no cap.

2. CMS/theme filler baked into the article's own HTML container (NASA's
   Gravatar byline + "related topics" cards in ``content:encoded``,
   universetoday.com's byline avatar + Patreon CTA thumbnail, and a
   duplicated hero image when a featured-image <figure> sits inside
   <article> unwrapped by a <p>) — no page-chrome boundary to scope around,
   they just look like more inline photos.

Unlike the first version of this script, this one does NOT reset `image`
to NULL and wait for a visitor: the news-list page reads `image` straight
from the DB for its preview cards, so blanking it was itself a regression
(cards went from "wrong photo" to "no photo" for every row until someone
happened to open that exact article). Instead it re-fetches each candidate
right here and writes the corrected body/image/inline media immediately —
same one step, no visible gap. `--limit` paces it since each row is a live
HTTP fetch.

Some junk (e.g. nasa.gov falling back to a generic NASA-insignia image as an
author's byline photo when they have no headshot uploaded) is only
recognizable from the ``class="avatar"`` attribute on the live ``<img>`` tag
— once mirrored down to a bare URL in the DB it's indistinguishable from a
real photo, so the SQL candidate search below can't find it by pattern.
Every NASA article is re-fetched unconditionally for that reason (still
capped/paced by ``--limit``); everything else only gets fixed if it matches
a known junk signal. Use ``--slug`` to force-refresh one specific article
regardless of the heuristics, e.g. right after spotting a bad photo on it.

Usage:
  python3 backfill_news_bad_page_scrape.py               # report + apply
  python3 backfill_news_bad_page_scrape.py --dry-run      # report counts only
  python3 backfill_news_bad_page_scrape.py --limit 50     # cap rows fetched this run
  python3 backfill_news_bad_page_scrape.py --slug some-article-slug

For a single known-bad article, the admin dashboard's news editor
(/admin/news/<id>) has a "Refresh from source" button that does the same
per-row refresh interactively — see database.refresh_news_article_from_source,
which this script's apply loop calls too. This script remains for the bulk
heuristic scan (`_find_candidates` below) across the whole archive.
"""
import argparse
import logging
import time

import config  # noqa: F401 — side effect: load_dotenv()
from database import get_db_connection, refresh_news_article_from_source

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backfill_news_bad_page_scrape")

IMAGE_CAP = 8  # matches parsers.news._MAX_BODY_IMAGES
FETCH_DELAY = 1.0  # seconds between live HTTP fetches — polite to source sites


def _find_candidates(cursor, slug=None):
    if slug:
        cursor.execute(
            "SELECT id, slug, url, image FROM news_articles WHERE slug = %s", (slug,)
        )
        return cursor.fetchall()
    cursor.execute(
        """
        SELECT DISTINCT a.id, a.slug, a.url, a.image
        FROM news_articles a
        LEFT JOIN news_article_images i ON i.article_id = a.id
        WHERE a.source = 'NASA'
           OR a.image IS NULL
           OR a.image = ''
           OR a.image LIKE '%.svg'
           OR i.source_url LIKE '%.svg%'
           OR i.source_url LIKE '%gravatar.com%'
           OR i.source_url LIKE '%/wp-content/plugins/%'
           OR i.source_url LIKE '%/wp-content/themes/%'
           OR i.source_url LIKE '%avatar%'
           OR i.source_url LIKE '%patreon%'
           OR i.source_url = a.image
           OR a.id IN (
                SELECT article_id FROM news_article_images
                GROUP BY article_id
                HAVING COUNT(*) > %s
           )
        """,
        (IMAGE_CAP,),
    )
    return cursor.fetchall()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="only report counts, write nothing")
    parser.add_argument("--limit", type=int, default=None, help="max rows to actually re-fetch this run")
    parser.add_argument("--slug", type=str, default=None, help="force-refresh one article by slug, ignoring the heuristics")
    args = parser.parse_args()

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        rows = _find_candidates(cursor, args.slug)
    finally:
        cursor.close()
        conn.close()

    if args.slug and not rows:
        logger.warning(f"no article with slug={args.slug!r}")
        return

    logger.info(f"found {len(rows)} candidate row(s) with a bad page scrape")
    for row in rows:
        logger.info(f"  id={row['id']} slug={row['slug']} image={row['image']!r}")

    if args.dry_run or not rows:
        return

    if args.limit:
        rows = rows[:args.limit]

    fixed = failed = 0
    for row in rows:
        result = refresh_news_article_from_source(row["id"])
        if not result.get("ok"):
            logger.warning(f"id={row['id']} slug={row['slug']}: refresh failed ({result.get('error')})")
            failed += 1
        else:
            fixed += 1
            logger.info(f"id={row['id']} slug={row['slug']}: refreshed "
                        f"({result['image_count']} photo(s), {result['video_count']} video(s))")
        time.sleep(FETCH_DELAY)

    logger.info(f"done: {fixed} row(s) refreshed, {failed} fetch failure(s)")


if __name__ == "__main__":
    main()
