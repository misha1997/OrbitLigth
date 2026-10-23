"""NASA API Service - NEO and APOD"""
import requests
import logging
from datetime import datetime, timedelta
from config import NASA_API_KEY, NASA_NEO_URL, NASA_APOD_URL
from utils.translator import Translator
from utils.i18n import t, DEFAULT_LANG, escape_html
from services.apod_source import normalize_apod

logger = logging.getLogger(__name__)


class NasaAPI:
    """NASA Open APIs client"""

    @staticmethod
    def get_asteroids_today(lang: str = DEFAULT_LANG):
        """Fetch near-Earth objects for today"""
        today = datetime.now().strftime('%Y-%m-%d')
        params = {
            'start_date': today,
            'end_date': today,
            'api_key': NASA_API_KEY
        }

        try:
            response = requests.get(NASA_NEO_URL, params=params, timeout=10)
            data = response.json()

            asteroids = data['near_earth_objects'].get(today, [])

            if not asteroids:
                return t('neo.none_today', lang)

            # Sort by distance (closest first)
            asteroids.sort(key=lambda x: float(x['close_approach_data'][0]['miss_distance']['kilometers']))

            return NasaAPI._format_asteroids(asteroids, today, lang)

        except Exception as e:
            logger.error(f"NEO API error: {e}")
            return t('neo.api_error', lang)

    @staticmethod
    def _format_asteroids(asteroids, date, lang=DEFAULT_LANG):
        """Format asteroids data for Telegram"""
        message = t('neo.today_title', lang, date=date)
        message += t('neo.found', lang, n=len(asteroids))

        for i, neo in enumerate(asteroids[:5], 1):
            name = neo['name']
            diameter = neo['estimated_diameter']['meters']
            diameter_min = int(diameter['estimated_diameter_min'])
            diameter_max = int(diameter['estimated_diameter_max'])

            approach = neo['close_approach_data'][0]
            distance_km = float(approach['miss_distance']['kilometers'])
            distance_km_str = f"{distance_km:,.0f}".replace(',', ' ')

            velocity = float(approach['relative_velocity']['kilometers_per_hour'])
            velocity_str = f"{velocity:,.0f}".replace(',', ' ')

            is_hazardous = neo['is_potentially_hazardous_asteroid']
            hazard_label = t('neo.hazardous', lang) if is_hazardous else t('neo.safe', lang)

            message += t('neo.item', lang, i=i, name=name,
                         min=diameter_min, max=diameter_max,
                         dist=distance_km_str, vel=velocity_str,
                         hazard=hazard_label)

        return message

    @staticmethod
    def get_hazardous_asteroids():
        """Fetch potentially hazardous asteroids for today and next 6 days"""
        today = datetime.now()
        today_str = today.strftime('%Y-%m-%d')
        end_date = (today + timedelta(days=6)).strftime('%Y-%m-%d')

        params = {
            'start_date': today_str,
            'end_date': end_date,
            'api_key': NASA_API_KEY
        }

        try:
            response = requests.get(NASA_NEO_URL, params=params, timeout=10)
            data = response.json()

            hazardous = []
            for date_str, asteroids in data.get('near_earth_objects', {}).items():
                for neo in asteroids:
                    if neo['is_potentially_hazardous_asteroid']:
                        hazardous.append({
                            'id': neo['id'],
                            'name': neo['name'],
                            'approach_date': date_str,
                            'miss_distance_km': float(neo['close_approach_data'][0]['miss_distance']['kilometers']),
                            'diameter_min': int(neo['estimated_diameter']['meters']['estimated_diameter_min']),
                            'diameter_max': int(neo['estimated_diameter']['meters']['estimated_diameter_max']),
                            'velocity': float(neo['close_approach_data'][0]['relative_velocity']['kilometers_per_hour']),
                            'url': neo.get('nasa_jpl_url', '')
                        })

            # Sort by distance (closest first)
            hazardous.sort(key=lambda x: x['miss_distance_km'])
            return hazardous

        except Exception as e:
            logger.error(f"NEO hazardous API error: {e}")
            return []

    @staticmethod
    def get_apod():
        """Latest published APOD from NASA Science (no API key required)."""
        try:
            response = requests.get(NASA_APOD_URL, params={'per_page': 1, 'page': 1}, timeout=15)
            response.raise_for_status()
            data = response.json()
            items = data if isinstance(data, list) else [data]
            entries = [entry for raw in items if (entry := normalize_apod(raw))]
            return max(entries, key=lambda entry: entry['date']) if entries else None
        except Exception as e:
            logger.error(f"APOD API error: {e}")
            return None

    @staticmethod
    def get_apod_archive(start_date: str, end_date: str):
        """Inclusive range. NASA WordPress uses date_from/date_to in YYMMDD.

        The old API's start_date/end_date are silently ignored by this API.
        Paginate explicitly and filter dates defensively before persisting.
        """
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d').date()
            end = datetime.strptime(end_date, '%Y-%m-%d').date()
            if end < start:
                return []
            out = {}
            page = 1
            while True:
                response = requests.get(NASA_APOD_URL, params={'date_from': start.strftime('%y%m%d'),
                                        'date_to': end.strftime('%y%m%d'), 'per_page': 60, 'page': page}, timeout=20)
                response.raise_for_status()
                data = response.json()
                items = data if isinstance(data, list) else [data]
                for raw in items:
                    entry = normalize_apod(raw)
                    if entry and start_date <= entry['date'] <= end_date:
                        out[entry['date']] = entry
                total_pages = int(response.headers.get('X-WP-TotalPages') or 0)
                if (total_pages and page >= total_pages) or (not total_pages and len(items) < 60):
                    break
                page += 1
                if page > 200:
                    raise ValueError('APOD pagination exceeded safety limit')
            return sorted(out.values(), key=lambda entry: entry['date'], reverse=True)
        except Exception as e:
            logger.error(f"APOD archive API error: {e}")
            return []

    @staticmethod
    def format_apod(data, lang=DEFAULT_LANG):
        """Format APOD for Telegram (returns photo + text separately for long captions)"""
        title = escape_html(data['title'])
        date = data['date']
        explanation = data['explanation']

        # Translate explanation (no-op for English users)
        explanation_tr = escape_html(Translator.translate_apod(explanation, lang))

        # Short caption for photo
        caption = t('apod.caption', lang, date=date, title=title)

        # Full text message
        full_text = t('apod.full_apod', lang, title=title, date=date, explanation='')

        # Truncate explanation if too long
        if len(explanation_tr) > 3800:
            explanation_tr = explanation_tr[:3800] + "..."
        full_text = f"🌌 <b>{title}</b>\n📅 {date}\n\n{explanation_tr}\n\n🌐 science.nasa.gov/apod"

        # For image APODs: prefer the HD url, fall back to the standard url.
        # For video APODs: `url` is either a direct file (caller can send it
        # with send_video) or a YouTube/other embed link (Telegram's
        # send_video rejects those — "Wrong type of the web page content").
        # NASA doesn't always ship a thumbnail for videos, so `image_url` can
        # legitimately be empty here — callers must not fall back to `url`
        # itself as a photo, since a video file/page is not a valid image.
        media_type = data.get('media_type', 'image')
        video_url = data.get('url', '') if media_type == 'video' else ''
        if media_type == 'video':
            image_url = data.get('thumbnail') or ''
        else:
            image_url = data.get('hdurl') or data.get('url', '')

        return {
            'image': image_url,
            'caption': caption,
            'text': full_text,
            'video_url': video_url,
        }
