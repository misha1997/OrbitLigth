"""Table creation — see database/__init__.py for the package overview."""
import logging

from mysql.connector import Error

from .pool import get_db_connection

logger = logging.getLogger(__name__)


def init_db():
    """Initialize database with tables"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id BIGINT PRIMARY KEY,
                chat_id BIGINT NOT NULL,
                username VARCHAR(255),
                first_name VARCHAR(255),
                last_name VARCHAR(255),
                city VARCHAR(255),
                lat DECIMAL(10, 8),
                lon DECIMAL(11, 8),
                subscribed_iss BOOLEAN DEFAULT TRUE,
                subscribed_apod BOOLEAN DEFAULT TRUE,
                subscribed_launches BOOLEAN DEFAULT TRUE,
                subscribed_neo BOOLEAN DEFAULT TRUE,
                subscribed_news BOOLEAN DEFAULT TRUE,
                subscribed_meteors BOOLEAN DEFAULT TRUE,
                subscribed_flares BOOLEAN DEFAULT TRUE,
                subscribed_grb BOOLEAN DEFAULT TRUE,
                subscribed_gw BOOLEAN DEFAULT TRUE,
                lang VARCHAR(5) NOT NULL DEFAULT 'uk',
                quiet_hours_enabled BOOLEAN DEFAULT TRUE,
                quiet_start TINYINT DEFAULT 0,
                quiet_end TINYINT DEFAULT 6,
                iss_min_magnitude DECIMAL(3,1) DEFAULT NULL,
                last_iss_pass INT,
                last_apod_date VARCHAR(10),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_subscribed_iss (subscribed_iss),
                INDEX idx_subscribed_apod (subscribed_apod),
                INDEX idx_subscribed_launches (subscribed_launches),
                INDEX idx_subscribed_neo (subscribed_neo),
                INDEX idx_subscribed_news (subscribed_news),
                INDEX idx_subscribed_meteors (subscribed_meteors),
                INDEX idx_subscribed_flares (subscribed_flares),
                INDEX idx_subscribed_grb (subscribed_grb),
                INDEX idx_subscribed_gw (subscribed_gw)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Meteor shower notifications tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS meteor_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shower_name VARCHAR(100) NOT NULL,
                peak_date DATE NOT NULL,
                notification_type VARCHAR(20) NOT NULL,
                notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_shower_notification (shower_name, peak_date, notification_type),
                INDEX idx_notified_at (notified_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # News notifications tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS news_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                article_url VARCHAR(500) NOT NULL,
                article_title VARCHAR(500) NOT NULL,
                notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_article_url (article_url),
                INDEX idx_notified_at (notified_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Space history events
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS space_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                month INT NOT NULL,
                day INT NOT NULL,
                year INT,
                text_en TEXT NOT NULL,
                text_uk TEXT NOT NULL,
                INDEX idx_month_day (month, day)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # News article archive for the website (full articles + UK translation).
        # Body columns are nullable — filled lazily when an article page is opened.
        # `slug` (derived from the source URL) is the public article page key:
        # /news/<slug>. UNIQUE so two articles can't share a slug.
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS news_articles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                url VARCHAR(500) NOT NULL,
                slug VARCHAR(200) NOT NULL DEFAULT '',
                title VARCHAR(500) NOT NULL,
                title_uk VARCHAR(500),
                excerpt TEXT,
                excerpt_uk TEXT,
                body MEDIUMTEXT,
                body_uk MEDIUMTEXT,
                image VARCHAR(500),
                category VARCHAR(40) NOT NULL DEFAULT 'missions',
                category_raw VARCHAR(120),
                source VARCHAR(120) NOT NULL DEFAULT 'SpaceflightNow',
                published_date VARCHAR(60),
                fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_news_url (url),
                UNIQUE KEY idx_news_slug (slug),
                INDEX idx_news_cat (category),
                INDEX idx_news_fetched (fetched_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Inline images found inside a news article's body (in addition to the
        # single hero `news_articles.image`). `position` is the `n` in the
        # body text's `[IMG:n]` placeholder (see parsers/news.py). Mirrored
        # locally to data/news/<slug>/<n>-<full|thumb>.<ext>, same pattern as
        # galaxy_photos / services/news_images.py.
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS news_article_images (
                id INT AUTO_INCREMENT PRIMARY KEY,
                article_id INT NOT NULL,
                position INT NOT NULL,
                source_url VARCHAR(500) NOT NULL,
                full_path VARCHAR(300),
                thumb_path VARCHAR(300),
                UNIQUE KEY idx_news_img_pos (article_id, position),
                INDEX idx_nia_article (article_id),
                FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Inline embedded videos (YouTube/Vimeo <iframe> players) found inside
        # a news article's body. `position` is the `n` in the body text's
        # `[VIDEO:n]` placeholder (see parsers/news.py). Unlike
        # news_article_images, nothing is mirrored locally — the frontend
        # embeds the provider's player directly via <iframe>, same as APOD
        # video entries.
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS news_article_videos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                article_id INT NOT NULL,
                position INT NOT NULL,
                video_url VARCHAR(500) NOT NULL,
                UNIQUE KEY idx_news_vid_pos (article_id, position),
                INDEX idx_niv_article (article_id),
                FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # APOD photo archive for the website gallery (NASA APOD, one entry/day).
        # `date` is the PK (APOD = 1/day, idempotent UPSERT). Images are mirrored
        # locally to data/apod/YYYY/MM/DD-<full|thumb>.<ext>; thumb_path/full_path
        # are relative paths served via /apod-img. Video APODs keep their YouTube
        # link in video_url and only mirror the thumbnail. explanation_uk is
        # translated eagerly at ingest (DeepL quota-safe: ~1.5k chars/day).
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS apod_entries (
                date DATE PRIMARY KEY,
                title VARCHAR(500) NOT NULL,
                explanation TEXT,
                explanation_uk MEDIUMTEXT,
                media_type VARCHAR(20) NOT NULL DEFAULT 'image',
                thumb_path VARCHAR(300),
                full_path VARCHAR(300),
                video_url VARCHAR(500),
                credit VARCHAR(300),
                fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_apod_date (date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Famous-galaxies catalog for the website /galaxies hub + per-galaxy
        # pages. `key` is the PK (curated, stable). Curated fields (names,
        # distances, descriptions, facts) are authored in services/galaxies.py
        # GALAXIES and seeded here at ingest; `redshift`/`ned_type`/`ned_prefname`
        # come live from NED TAP; photos are mirrored to data/galaxies/<key>/ by
        # services/galaxy_images and served via /galaxy-img. `slug` drives the
        # per-galaxy URL (/galaxies/<slug>, language-neutral). preview_* point at
        # the first photo for the hub card.
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS galaxies (
                `key` VARCHAR(40) PRIMARY KEY,
                slug VARCHAR(60) NOT NULL UNIQUE,
                category VARCHAR(20) NOT NULL,
                designation VARCHAR(40),
                name_uk VARCHAR(120), name_en VARCHAR(120),
                dist_text_uk VARCHAR(60), dist_text_en VARCHAR(60),
                dist_ly FLOAT,
                diameter_ly VARCHAR(40),
                magnitude VARCHAR(20),
                ra DOUBLE, `dec` DOUBLE,
                redshift DOUBLE, ned_type VARCHAR(20), ned_prefname VARCHAR(60),
                description_uk MEDIUMTEXT, description_en MEDIUMTEXT,
                fact_uk VARCHAR(600), fact_en VARCHAR(600),
                nasa_query VARCHAR(120),
                preview_nasa_id VARCHAR(180),
                preview_thumb VARCHAR(300),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_gal_slug (slug),
                INDEX idx_gal_cat (category)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # One row per NASA Image Library photo per galaxy. (galaxy_key, nasa_id)
        # is unique (idempotent UPSERT). thumb_path/full_path are relative to
        # data/galaxies/ served via /galaxy-img. title/description stay English
        # (NASA captions, as-is — no translator quota spent).
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS galaxy_photos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                galaxy_key VARCHAR(40) NOT NULL,
                nasa_id VARCHAR(180) NOT NULL,
                title VARCHAR(300),
                description TEXT,
                thumb_path VARCHAR(300),
                full_path VARCHAR(300),
                credit VARCHAR(300),
                date_created VARCHAR(40),
                source_url VARCHAR(300),
                sort_order INT DEFAULT 0,
                UNIQUE KEY idx_gal_photo (galaxy_key, nasa_id),
                INDEX idx_gp_galaxy (galaxy_key),
                FOREIGN KEY (galaxy_key) REFERENCES galaxies(`key`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Admin-set override for one mission's card photo on the Missions hub
        # (/missions, my-app/src/lib/missions.js MISSIONS[].img). The registry
        # itself stays a hardcoded frontend list (like `galaxies` curated
        # fields — see admin_list_galaxies' docstring for why), but its
        # per-mission image can be swapped from /admin/missions without a
        # deploy: mission_key isn't a foreign key to anything (the registry
        # has no DB table), just validated against the same key list
        # server-side (web/admin_api.py _MISSION_KEYS). image_path is
        # relative to data/missions/ (mirrored via services/mission_images.py
        # or uploaded directly), served through /mission-img.
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS mission_previews (
                mission_key VARCHAR(40) PRIMARY KEY,
                image_path VARCHAR(300) NOT NULL,
                credit VARCHAR(300),
                source_url VARCHAR(500),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Hazardous asteroids notifications tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS neo_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                asteroid_id VARCHAR(255) NOT NULL,
                approach_date DATE NOT NULL,
                notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_asteroid_date (asteroid_id, approach_date),
                INDEX idx_notified_at (notified_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Site visitor tally for the footer's day/week stats (see web/online.py).
        # One row per (visit_date, client_hash); client_hash is a truncated
        # SHA-256 of the caller's IP, not the raw address. Rows older than a
        # week are pruned by web/online.py, so this table stays small.
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS site_visits (
                visit_date DATE NOT NULL,
                client_hash VARCHAR(32) NOT NULL,
                first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (visit_date, client_hash),
                INDEX idx_site_visits_date (visit_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # ISS passes history
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS iss_passes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT,
                pass_time TIMESTAMP,
                duration INT,
                max_elevation DECIMAL(5, 2),
                notified BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                INDEX idx_user_pass (user_id, pass_time)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Solar flare notifications tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS flare_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                flare_class VARCHAR(10) NOT NULL,
                flare_time VARCHAR(50) NOT NULL,
                flux_value DECIMAL(12, 10) NOT NULL,
                notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_flare_time (flare_class, flare_time),
                INDEX idx_notified_at (notified_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Geomagnetic storm notifications tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS storm_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kp_value DECIMAL(3,1) NOT NULL,
                observation_time VARCHAR(50) NOT NULL,
                g_scale VARCHAR(5) NOT NULL,
                notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_storm_obs (kp_value, observation_time),
                INDEX idx_notified_at (notified_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # GRB notifications tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS grb_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                grb_name VARCHAR(50) NOT NULL,
                circular_id VARCHAR(20) NOT NULL,
                notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_grb_notification (grb_name),
                INDEX idx_notified_at (notified_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Gravitational-wave (LIGO/Virgo/KAGRA) alert notifications tracking.
        # Doubles as the display cache for the site/bot "recent alerts" views
        # (see database.get_recent_gw_alerts) — the Kafka topic itself can't
        # be "peeked" without consuming from it, so we store enough fields
        # here to redisplay without re-polling Kafka. Dedup key is
        # (superevent_id, alert_type): the SAME superevent gets multiple
        # alert_type messages over time (PRELIMINARY -> INITIAL -> UPDATE ->
        # possibly RETRACTION) and each one is genuinely new information worth
        # a fresh notification.
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS gw_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                superevent_id VARCHAR(30) NOT NULL,
                alert_type VARCHAR(20) NOT NULL,
                event_time VARCHAR(40),
                far DOUBLE,
                significant BOOLEAN,
                instruments VARCHAR(100),
                top_class VARCHAR(20),
                classification TEXT,
                gracedb_url VARCHAR(255),
                notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_gw_notification (superevent_id, alert_type),
                INDEX idx_notified_at (notified_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Launch notifications tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS launch_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                launch_id VARCHAR(255) NOT NULL,
                notification_type VARCHAR(50) NOT NULL,
                notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_launch_notification (launch_id, notification_type),
                INDEX idx_notified_at (notified_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Web Push subscriptions (anonymous site visitors, not tied to a
        # Telegram users row — keyed by the browser's own subscription
        # endpoint). last_iss_pass mirrors users.last_iss_pass (a raw Unix
        # timestamp, not a TIMESTAMP column) since ISS-pass dedup is
        # per-subscriber/per-location the same way it is per-Telegram-user.
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                endpoint VARCHAR(500) NOT NULL,
                p256dh VARCHAR(255) NOT NULL,
                auth VARCHAR(255) NOT NULL,
                lat DECIMAL(10, 8),
                lon DECIMAL(11, 8),
                lang VARCHAR(5) NOT NULL DEFAULT 'uk',
                subscribed_iss BOOLEAN DEFAULT TRUE,
                subscribed_launches BOOLEAN DEFAULT TRUE,
                subscribed_neo BOOLEAN DEFAULT TRUE,
                subscribed_flares BOOLEAN DEFAULT TRUE,
                subscribed_grb BOOLEAN DEFAULT TRUE,
                subscribed_gw BOOLEAN DEFAULT TRUE,
                last_iss_pass INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY idx_endpoint (endpoint),
                INDEX idx_subscribed_iss (subscribed_iss),
                INDEX idx_subscribed_launches (subscribed_launches),
                INDEX idx_subscribed_neo (subscribed_neo),
                INDEX idx_subscribed_flares (subscribed_flares),
                INDEX idx_subscribed_grb (subscribed_grb),
                INDEX idx_subscribed_gw (subscribed_gw)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Website account system (web/auth.py) — the site's own login
        # identity, decoupled from the bot's `users` table the same way
        # push_subscriptions is above. telegram_user_id optionally links to
        # an existing users.user_id once verified via the Telegram Login
        # Widget; notification prefs then live on that users row (single
        # source of truth for bot + site), not duplicated here.
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS web_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255),
                password_hash VARCHAR(255),
                username VARCHAR(255),
                google_id VARCHAR(255),
                telegram_user_id BIGINT,
                telegram_username VARCHAR(255),
                telegram_first_name VARCHAR(255),
                telegram_photo_url VARCHAR(500),
                avatar_url VARCHAR(500),
                city VARCHAR(255),
                lat DECIMAL(10, 8),
                lon DECIMAL(11, 8),
                lang VARCHAR(5) NOT NULL DEFAULT 'uk',
                token_version INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY idx_email (email),
                UNIQUE KEY idx_google_id (google_id),
                UNIQUE KEY idx_telegram_user_id (telegram_user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Named lat/lon bookmarks for a website account (Dark Sky map "My
        # places" panel) — decoupled from the bot the same way web_users is;
        # a web account isn't necessarily linked to a Telegram user.
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS saved_locations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                web_user_id INT NOT NULL,
                label VARCHAR(120) NOT NULL,
                lat DECIMAL(10, 8) NOT NULL,
                lon DECIMAL(11, 8) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (web_user_id) REFERENCES web_users(id) ON DELETE CASCADE,
                INDEX idx_web_user_id (web_user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Add avatar_url column to existing web_users (migration — added after
        # the table itself shipped, for installs that already ran init_db()
        # once before this column existed)
        try:
            cursor.execute('''
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'web_users'
                AND COLUMN_NAME = 'avatar_url'
            ''')
            if cursor.fetchone()[0] == 0:
                cursor.execute('''
                    ALTER TABLE web_users
                    ADD COLUMN avatar_url VARCHAR(500) AFTER telegram_photo_url
                ''')
                conn.commit()
                logger.info("Added avatar_url column to web_users table")
        except Error:
            pass

        # Add subscribed_flares column to existing users (migration)
        try:
            cursor.execute('''
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'subscribed_flares'
            ''')
            if cursor.fetchone()[0] == 0:
                cursor.execute('''
                    ALTER TABLE users
                    ADD COLUMN subscribed_flares BOOLEAN DEFAULT TRUE
                ''')
                conn.commit()
                logger.info("Added subscribed_flares column to users table")
        except Error:
            pass

        # Add subscribed_grb column to existing users (migration)
        try:
            cursor.execute('''
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'subscribed_grb'
            ''')
            if cursor.fetchone()[0] == 0:
                cursor.execute('''
                    ALTER TABLE users
                    ADD COLUMN subscribed_grb BOOLEAN DEFAULT TRUE
                ''')
                conn.commit()
                logger.info("Added subscribed_grb column to users table")
        except Error:
            pass

        # Add subscribed_gw column to existing users (migration)
        try:
            cursor.execute('''
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'subscribed_gw'
            ''')
            if cursor.fetchone()[0] == 0:
                cursor.execute('''
                    ALTER TABLE users
                    ADD COLUMN subscribed_gw BOOLEAN DEFAULT TRUE
                ''')
                conn.commit()
                logger.info("Added subscribed_gw column to users table")
        except Error:
            pass

        # Add subscribed_gw column to existing push_subscriptions (migration)
        try:
            cursor.execute('''
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'push_subscriptions'
                AND COLUMN_NAME = 'subscribed_gw'
            ''')
            if cursor.fetchone()[0] == 0:
                cursor.execute('''
                    ALTER TABLE push_subscriptions
                    ADD COLUMN subscribed_gw BOOLEAN DEFAULT TRUE
                ''')
                conn.commit()
                logger.info("Added subscribed_gw column to push_subscriptions table")
        except Error:
            pass

        # Add quiet-hours columns to existing users (migration). Defaults
        # (enabled, 00:00-06:00) match the previous hardcoded global
        # behavior so nothing changes for existing users until they cycle
        # the setting in /settings.
        for col_name, col_def in (
            ('quiet_hours_enabled', 'BOOLEAN DEFAULT TRUE'),
            ('quiet_start', 'TINYINT DEFAULT 0'),
            ('quiet_end', 'TINYINT DEFAULT 6'),
            ('iss_min_magnitude', 'DECIMAL(3,1) DEFAULT NULL'),
        ):
            try:
                cursor.execute('''
                    SELECT COUNT(*) FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'users'
                    AND COLUMN_NAME = %s
                ''', (col_name,))
                if cursor.fetchone()[0] == 0:
                    cursor.execute(f'ALTER TABLE users ADD COLUMN {col_name} {col_def}')
                    conn.commit()
                    logger.info(f"Added {col_name} column to users table")
            except Error:
                pass

        # Add lang column to existing users (migration)
        try:
            cursor.execute('''
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'lang'
            ''')
            if cursor.fetchone()[0] == 0:
                cursor.execute('''
                    ALTER TABLE users
                    ADD COLUMN lang VARCHAR(5) NOT NULL DEFAULT 'uk'
                ''')
                conn.commit()
                logger.info("Added lang column to users table")
        except Error:
            pass

        # Add slug column to news_articles (migration for existing installs).
        # Order matters: add the column first, backfill empty slugs so they're
        # all unique, THEN add the UNIQUE index (it would otherwise reject the
        # duplicate '' defaults already in the table).
        try:
            cursor.execute('''
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'news_articles'
                AND COLUMN_NAME = 'slug'
            ''')
            if cursor.fetchone()[0] == 0:
                cursor.execute('''
                    ALTER TABLE news_articles
                    ADD COLUMN slug VARCHAR(200) NOT NULL DEFAULT '' AFTER url
                ''')
                conn.commit()
                logger.info("Added slug column to news_articles table")
        except Error as e:
            logger.warning(f"news_articles slug column migration: {e}")

        # Backfill empty slugs from the source URL (best-effort, one pass).
        try:
            cursor.execute("SELECT id, url FROM news_articles WHERE slug = '' OR slug IS NULL")
            rows = cursor.fetchall()
            for row in rows:
                slug = _news_slug_for_url(row[1], cursor)
                if slug:
                    cursor.execute(
                        "UPDATE news_articles SET slug = %s WHERE id = %s",
                        (slug, row[0])
                    )
            if rows:
                conn.commit()
                logger.info(f"Backfilled {len(rows)} news article slug(s)")
        except Error as e:
            logger.warning(f"news_articles slug backfill: {e}")

        # Now that every row has a unique slug, add the UNIQUE index (if missing).
        try:
            cursor.execute('''
                SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'news_articles'
                AND INDEX_NAME = 'idx_news_slug'
            ''')
            if cursor.fetchone()[0] == 0:
                cursor.execute('''
                    ALTER TABLE news_articles
                    ADD UNIQUE KEY idx_news_slug (slug)
                ''')
                conn.commit()
                logger.info("Added idx_news_slug unique index")
        except Error as e:
            # Duplicate non-unique slugs would block this; log and continue
            # (the site still works, the column just isn't uniqueness-constrained).
            logger.warning(f"news_articles idx_news_slug migration: {e}")

        # Add source column to news_articles if missing.
        try:
            cursor.execute('''
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'news_articles'
                AND COLUMN_NAME = 'source'
            ''')
            if cursor.fetchone()[0] == 0:
                cursor.execute('''
                    ALTER TABLE news_articles
                    ADD COLUMN source VARCHAR(120) NOT NULL DEFAULT 'SpaceflightNow' AFTER category_raw
                ''')
                conn.commit()
                logger.info("Added source column to news_articles table")
        except Error as e:
            logger.warning(f"news_articles source column migration: {e}")

        # Galaxy photo nasa_id can be long (Hubble/ESA press-release ids run
        # 65+ chars). Widens VARCHAR(60) → VARCHAR(180) for installs seeded
        # before this fix; idempotent (only alters when the column is narrower).
        try:
            cursor.execute("""
                SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'galaxy_photos'
                  AND COLUMN_NAME = 'nasa_id'
            """)
            row = cursor.fetchone()
            if row and int(row[0] or 0) < 180:
                cursor.execute(
                    "ALTER TABLE galaxy_photos MODIFY COLUMN nasa_id VARCHAR(180) NOT NULL"
                )
                cursor.execute(
                    "ALTER TABLE galaxies MODIFY COLUMN preview_nasa_id VARCHAR(180)"
                )
                conn.commit()
                logger.info("Widened galaxy nasa_id columns to VARCHAR(180)")
        except Error as e:
            logger.warning(f"galaxy nasa_id widen migration: {e}")

        # galaxy_photos.source_url: added for Wikimedia Commons photos (the
        # "open original" link — NASA Image Library photos link to
        # images.nasa.gov/details/<nasa_id> instead). Idempotent: only adds the
        # column when missing, so existing installs (pre-Commons) pick it up.
        try:
            cursor.execute("""
                SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'galaxy_photos'
                  AND COLUMN_NAME = 'source_url'
            """)
            if not cursor.fetchone():
                cursor.execute(
                    "ALTER TABLE galaxy_photos ADD COLUMN source_url VARCHAR(300) AFTER date_created"
                )
                conn.commit()
                logger.info("Added galaxy_photos.source_url column")
        except Error as e:
            logger.warning(f"galaxy_photos source_url migration: {e}")

        # web_users.role: DB-backed admin dashboard access (replaces the old
        # ADMIN_EMAILS-only check in web/auth.py). Only 'admin' is meaningful
        # today; the column is a free string so future roles are just new
        # values, not a schema change.
        try:
            cursor.execute('''
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'web_users'
                AND COLUMN_NAME = 'role'
            ''')
            if cursor.fetchone()[0] == 0:
                cursor.execute('''
                    ALTER TABLE web_users
                    ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user' AFTER lang
                ''')
                conn.commit()
                logger.info("Added role column to web_users table")
        except Error as e:
            logger.warning(f"web_users role column migration: {e}")

        # One-time-safe bootstrap: promote any ADMIN_EMAILS address that
        # isn't already role='admin'. Runs on every startup but only ever
        # touches rows that need it, so ops can grant admin via env var +
        # restart without DB access; from there on, roles are managed from
        # the admin dashboard's Users page.
        try:
            from config import ADMIN_EMAILS
            if ADMIN_EMAILS:
                cursor.execute(
                    f'''UPDATE web_users SET role = 'admin'
                        WHERE role <> 'admin' AND LOWER(email) IN ({",".join(["%s"] * len(ADMIN_EMAILS))})''',
                    tuple(ADMIN_EMAILS)
                )
                if cursor.rowcount:
                    conn.commit()
                    logger.info(f"Promoted {cursor.rowcount} ADMIN_EMAILS account(s) to role=admin")
        except Error as e:
            logger.warning(f"ADMIN_EMAILS role bootstrap: {e}")

        conn.commit()
        logger.info("Database initialized (MySQL)")

    except Error as e:
        logger.error(f"Database initialization error: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


