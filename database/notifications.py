"""Per-notification-type dedup tracking (launch/neo/news/meteor/flare/storm/grb/gw)."""
import json
import logging
from typing import Dict, List

from mysql.connector import Error

from .pool import get_db_connection

logger = logging.getLogger(__name__)


def is_launch_notified(launch_id: str, notification_type: str) -> bool:
    """Check if launch notification was already sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT 1 FROM launch_notifications WHERE launch_id = %s AND notification_type = %s',
            (launch_id, notification_type)
        )
        return cursor.fetchone() is not None
    except Error as e:
        logger.error(f"Error checking launch notification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def mark_launch_notified(launch_id: str, notification_type: str):
    """Mark launch notification as sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'INSERT INTO launch_notifications (launch_id, notification_type) VALUES (%s, %s)',
            (launch_id, notification_type)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error marking launch notification: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def cleanup_old_launch_notifications(days: int = 7):
    """Remove old launch notifications (older than N days)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'DELETE FROM launch_notifications WHERE notified_at < DATE_SUB(NOW(), INTERVAL %s DAY)',
            (days,)
        )
        conn.commit()
        logger.info(f"Cleaned up {cursor.rowcount} old launch notifications")
    except Error as e:
        logger.error(f"Error cleaning up launch notifications: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def is_neo_notified(asteroid_id: str, approach_date: str) -> bool:
    """Check if hazardous asteroid notification was already sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT 1 FROM neo_notifications WHERE asteroid_id = %s AND approach_date = %s',
            (asteroid_id, approach_date)
        )
        return cursor.fetchone() is not None
    except Error as e:
        logger.error(f"Error checking NEO notification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def mark_neo_notified(asteroid_id: str, approach_date: str):
    """Mark hazardous asteroid notification as sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'INSERT INTO neo_notifications (asteroid_id, approach_date) VALUES (%s, %s)',
            (asteroid_id, approach_date)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error marking NEO notification: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def cleanup_old_neo_notifications(days: int = 30):
    """Remove old NEO notifications (older than N days)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'DELETE FROM neo_notifications WHERE notified_at < DATE_SUB(NOW(), INTERVAL %s DAY)',
            (days,)
        )
        conn.commit()
        logger.info(f"Cleaned up {cursor.rowcount} old NEO notifications")
    except Error as e:
        logger.error(f"Error cleaning up NEO notifications: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def is_news_notified(article_url: str) -> bool:
    """Check if news article was already sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT 1 FROM news_notifications WHERE article_url = %s',
            (article_url,)
        )
        return cursor.fetchone() is not None
    except Error as e:
        logger.error(f"Error checking news notification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def mark_news_notified(article_url: str, article_title: str):
    """Mark news article as sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'INSERT INTO news_notifications (article_url, article_title) VALUES (%s, %s)',
            (article_url, article_title)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error marking news notification: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def cleanup_old_news_notifications(days: int = 30):
    """Remove old news notifications (older than N days)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'DELETE FROM news_notifications WHERE notified_at < DATE_SUB(NOW(), INTERVAL %s DAY)',
            (days,)
        )
        conn.commit()
        logger.info(f"Cleaned up {cursor.rowcount} old news notifications")
    except Error as e:
        logger.error(f"Error cleaning up news notifications: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()



def is_meteor_notified(shower_name: str, peak_date: str, notification_type: str) -> bool:
    """Check if meteor shower notification was already sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT 1 FROM meteor_notifications WHERE shower_name = %s AND peak_date = %s AND notification_type = %s',
            (shower_name, peak_date, notification_type)
        )
        return cursor.fetchone() is not None
    except Error as e:
        logger.error(f"Error checking meteor notification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def mark_meteor_notified(shower_name: str, peak_date: str, notification_type: str):
    """Mark meteor shower notification as sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'INSERT INTO meteor_notifications (shower_name, peak_date, notification_type) VALUES (%s, %s, %s)',
            (shower_name, peak_date, notification_type)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error marking meteor notification: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def cleanup_old_meteor_notifications(days: int = 60):
    """Remove old meteor notifications (older than N days)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'DELETE FROM meteor_notifications WHERE notified_at < DATE_SUB(NOW(), INTERVAL %s DAY)',
            (days,)
        )
        conn.commit()
        logger.info(f"Cleaned up {cursor.rowcount} old meteor notifications")
    except Error as e:
        logger.error(f"Error cleaning up meteor notifications: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def is_flare_notified(flare_class: str, flare_time: str) -> bool:
    """Check if solar flare notification was already sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT 1 FROM flare_notifications WHERE flare_class = %s AND flare_time = %s',
            (flare_class, flare_time)
        )
        return cursor.fetchone() is not None
    except Error as e:
        logger.error(f"Error checking flare notification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def mark_flare_notified(flare_class: str, flare_time: str, flux_value: float):
    """Mark solar flare notification as sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'INSERT INTO flare_notifications (flare_class, flare_time, flux_value) VALUES (%s, %s, %s)',
            (flare_class, flare_time, flux_value)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error marking flare notification: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def cleanup_old_flare_notifications(days: int = 7):
    """Remove old flare notifications (older than N days)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'DELETE FROM flare_notifications WHERE notified_at < DATE_SUB(NOW(), INTERVAL %s DAY)',
            (days,)
        )
        conn.commit()
        logger.info(f"Cleaned up {cursor.rowcount} old flare notifications")
    except Error as e:
        logger.error(f"Error cleaning up flare notifications: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def is_storm_notified(kp_value: float, observation_time: str) -> bool:
    """Check if geomagnetic storm notification was already sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT 1 FROM storm_notifications WHERE kp_value = %s AND observation_time = %s',
            (kp_value, observation_time)
        )
        return cursor.fetchone() is not None
    except Error as e:
        logger.error(f"Error checking storm notification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def mark_storm_notified(kp_value: float, observation_time: str, g_scale: str):
    """Mark geomagnetic storm notification as sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'INSERT INTO storm_notifications (kp_value, observation_time, g_scale) VALUES (%s, %s, %s)',
            (kp_value, observation_time, g_scale)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error marking storm notification: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def cleanup_old_storm_notifications(days: int = 7):
    """Remove old storm notifications (older than N days)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'DELETE FROM storm_notifications WHERE notified_at < DATE_SUB(NOW(), INTERVAL %s DAY)',
            (days,)
        )
        conn.commit()
        logger.info(f"Cleaned up {cursor.rowcount} old storm notifications")
    except Error as e:
        logger.error(f"Error cleaning up storm notifications: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def is_grb_notified(grb_name: str) -> bool:
    """Check if GRB notification was already sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT 1 FROM grb_notifications WHERE grb_name = %s',
            (grb_name,)
        )
        return cursor.fetchone() is not None
    except Error as e:
        logger.error(f"Error checking GRB notification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def mark_grb_notified(grb_name: str, circular_id: str):
    """Mark GRB notification as sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'INSERT INTO grb_notifications (grb_name, circular_id) VALUES (%s, %s)',
            (grb_name, circular_id)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error marking GRB notification: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def cleanup_old_grb_notifications(days: int = 30):
    """Remove old GRB notifications (older than N days)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'DELETE FROM grb_notifications WHERE notified_at < DATE_SUB(NOW(), INTERVAL %s DAY)',
            (days,)
        )
        conn.commit()
        logger.info(f"Cleaned up {cursor.rowcount} old GRB notifications")
    except Error as e:
        logger.error(f"Error cleaning up GRB notifications: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def is_gw_notified(superevent_id: str, alert_type: str) -> bool:
    """Check if this exact (superevent, alert_type) update was already sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT 1 FROM gw_notifications WHERE superevent_id = %s AND alert_type = %s',
            (superevent_id, alert_type)
        )
        return cursor.fetchone() is not None
    except Error as e:
        logger.error(f"Error checking GW notification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def mark_gw_notified(alert: dict):
    """Record a sent GW notification. Also serves as the display cache for
    the site/bot "recent alerts" views (see get_recent_gw_alerts) — the Kafka
    topic itself can't be re-read without consuming from it."""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            '''INSERT INTO gw_notifications
               (superevent_id, alert_type, event_time, far, significant,
                instruments, top_class, classification, gracedb_url)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)''',
            (
                alert.get('superevent_id'),
                alert.get('alert_type'),
                alert.get('event_time'),
                alert.get('far'),
                alert.get('significant'),
                ', '.join(alert.get('instruments') or []),
                alert.get('top_class'),
                json.dumps(alert.get('classification') or {}),
                alert.get('gracedb_url'),
            )
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error marking GW notification: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def get_recent_gw_alerts(limit: int = 10) -> List[Dict]:
    """Recently notified GW alerts, newest first — backs /api/gw and the
    bot's on-demand "recent alerts" command. Reads the notification-dedup
    cache rather than polling Kafka again (see mark_gw_notified)."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            'SELECT * FROM gw_notifications ORDER BY notified_at DESC LIMIT %s',
            (limit,)
        )
        rows = cursor.fetchall()
        for row in rows:
            try:
                row['classification'] = json.loads(row['classification']) if row['classification'] else {}
            except (TypeError, ValueError):
                row['classification'] = {}
        return rows
    except Error as e:
        logger.error(f"Error getting recent GW alerts: {e}")
        return []
    finally:
        cursor.close()
        conn.close()



def cleanup_old_gw_notifications(days: int = 180):
    """Remove old GW notifications (older than N days).

    Longer retention than GRB's 30 days on purpose: LVK observing runs have
    multi-month gaps between them, and this table also serves as the
    "recent alerts" display cache — a 30-day window could leave the site
    feed empty for the whole length of an observing gap.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'DELETE FROM gw_notifications WHERE notified_at < DATE_SUB(NOW(), INTERVAL %s DAY)',
            (days,)
        )
        conn.commit()
        logger.info(f"Cleaned up {cursor.rowcount} old GW notifications")
    except Error as e:
        logger.error(f"Error cleaning up GW notifications: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()
