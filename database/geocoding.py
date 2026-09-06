"""Nominatim-backed city lookup and reverse-geocoding helpers."""
import logging
from typing import Optional, Dict, List

import requests

from utils.i18n import DEFAULT_LANG

logger = logging.getLogger(__name__)


def _nominatim_accept_language(lang: str) -> str:
    """Return an accept-language preference string for Nominatim."""
    return 'uk,en' if lang == 'uk' else 'en'


def _short_name_from_address(address: Dict, display_name: str, item_name: str = '') -> str:
    """Pick the most specific locality name from a Nominatim `address` dict,
    falling back to the item's `name` field and then the first chunk of
    `display_name`."""
    if address:
        for key in ('city', 'town', 'village', 'hamlet', 'locality',
                    'municipality', 'county', 'state_district'):
            val = address.get(key)
            if val:
                return val
    if item_name:
        return item_name
    if display_name:
        return display_name.split(',')[0].strip()
    return ''


def _country_from_address(address: Dict, display_name: str) -> str:
    """Country name from structured `address`, falling back to the last chunk
    of `display_name`."""
    if address and address.get('country'):
        return address['country']
    if display_name and ',' in display_name:
        return display_name.split(',')[-1].strip()
    return ''



def get_city_suggestions(city_name: str, lang: str = DEFAULT_LANG, limit: int = 5) -> List[Dict]:
    """Get disambiguated city suggestions from OpenStreetMap Nominatim.

    Returns a list of dicts: {short_name, country, country_code, state,
    display_name, lat, lon}. Structured `addressdetails=1` is requested so the
    short name and country come from parsed fields (not fragile display_name
    splitting), and `accept-language` is set per the user's language.
    """
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            'q': city_name,
            'format': 'json',
            'limit': limit,
            'addressdetails': 1,
            'accept-language': _nominatim_accept_language(lang),
        }
        headers = {'User-Agent': 'NEOwatchBot/1.0'}

        response = requests.get(url, params=params, headers=headers, timeout=10)
        data = response.json()

        suggestions = []
        seen = set()
        for item in data:
            address = item.get('address') or {}
            display_name = item.get('display_name', '') or ''
            short_name = _short_name_from_address(address, display_name, item.get('name', ''))
            country = _country_from_address(address, display_name)
            country_code = address.get('country_code', '').upper()
            state = address.get('state', address.get('region', ''))

            # Deduplicate the same place (Nominatim often returns multiple OSM
            # elements — e.g. a node and a relation — for one city). Merge by
            # name + country + state; keep the first occurrence's coordinates.
            try:
                float(item.get('lat'))
                float(item.get('lon'))
            except (TypeError, ValueError):
                continue
            key = (short_name.lower(), country.lower(), state.lower())
            if key in seen:
                continue
            seen.add(key)

            suggestions.append({
                'short_name': short_name or display_name.split(',')[0].strip(),
                'country': country,
                'country_code': country_code,
                'state': state,
                'display_name': display_name,
                'lat': item.get('lat'),
                'lon': item.get('lon'),
            })

        return suggestions
    except Exception as e:
        logger.error(f"Error getting city suggestions for '{city_name}': {e}")
        return []


def reverse_geocode(lat: float, lon: float, lang: str = DEFAULT_LANG) -> Optional[tuple]:
    """Reverse-geocode coordinates to a place name via Nominatim /reverse.

    Returns (short_name, display_name, country) or None. Used by the
    location-share flow and the coord-based picker callback so the stored
    `city` label matches the user's language.
    """
    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {
            'lat': lat,
            'lon': lon,
            'format': 'json',
            'addressdetails': 1,
            'accept-language': _nominatim_accept_language(lang),
        }
        headers = {'User-Agent': 'NEOwatchBot/1.0'}

        response = requests.get(url, params=params, headers=headers, timeout=10)
        if response.status_code != 200:
            return None
        data = response.json()
        address = data.get('address') or {}
        display_name = data.get('display_name', '') or ''
        short_name = _short_name_from_address(address, display_name)
        country = _country_from_address(address, display_name)
        if not short_name:
            return None
        return (short_name, display_name, country)
    except Exception as e:
        logger.error(f"Error reverse-geocoding ({lat}, {lon}): {e}")
        return None


