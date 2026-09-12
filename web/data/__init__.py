"""Structured data layer for the website.

Split from a single 2,772-line web/data.py into one module per domain,
mirroring that file's own section comments (weather, launches, ISS, sky
digest, NEO, voyager, DSN, planets table, observing conditions, geocoding,
TLE, meteors, events, Mars, APOD, news, debris, per-planet pages, galaxies,
alert feeds, comets/exoplanets, MAST, history). ``_shared.py`` holds the
handful of small helpers (``_compass_short``, ``_strip_tags``) used across
several of them.

web/api.py consumes this package via ``from web import data`` + attribute
access (``data.get_space_weather(...)``, etc.), so this __init__ re-exports
every name it uses, keeping that call site unchanged.
"""
from .weather import get_space_weather, get_weather_series
from .launches import get_launches
from .iss import get_iss_passes, get_elevation, get_iss_now, get_iss_crew
from .sky import get_sky
from .objects import get_neo
from .voyager import get_voyager
from .dsn import get_dsn_now
from .planets_table import get_planets, get_moon
from .observing import get_observing_conditions, get_observing_forecast
from .geocode import geocode, reverse_geocode, ip_geocode
from .tle import get_tle, tle_groups
from .meteors import get_meteors
from .events import get_events
from .mars import get_mars, get_mars_rovers
from .apod import get_apod, get_apod_archive, get_apod_archive_page
from .news import get_news, get_news_keywords, get_news_article_api
from .debris import get_debris
from .planet_pages import (
    get_jupiter, get_mercury, get_neptune, get_saturn, get_uranus,
    get_earth, get_earthquakes, get_earth_day, get_venus,
)
from .galaxies import get_galaxies, get_galaxy_api
from .alerts import get_grb, get_gw, get_sentry, get_reentries, get_flares
from .comets_exoplanets import get_comets, get_exoplanets
from .mast import get_mast_lightcurve, get_mast_hubble_jwst, get_mast_hst_recent, get_mast_jwst_recent
from .hubble import get_hubble_decay
from .history import get_history_today
from .missions import get_mission_previews_api

__all__ = [
    "get_space_weather", "get_weather_series",
    "get_launches",
    "get_iss_passes", "get_elevation", "get_iss_now", "get_iss_crew",
    "get_sky",
    "get_neo",
    "get_voyager",
    "get_dsn_now",
    "get_planets", "get_moon",
    "get_observing_conditions", "get_observing_forecast",
    "geocode", "reverse_geocode", "ip_geocode",
    "get_tle", "tle_groups",
    "get_meteors",
    "get_events",
    "get_mars", "get_mars_rovers",
    "get_apod", "get_apod_archive", "get_apod_archive_page",
    "get_news", "get_news_keywords", "get_news_article_api",
    "get_debris",
    "get_jupiter", "get_mercury", "get_neptune", "get_saturn", "get_uranus",
    "get_earth", "get_earthquakes", "get_earth_day", "get_venus",
    "get_galaxies", "get_galaxy_api",
    "get_grb", "get_gw", "get_sentry", "get_reentries", "get_flares",
    "get_comets", "get_exoplanets",
    "get_mast_lightcurve", "get_mast_hubble_jwst", "get_mast_hst_recent", "get_mast_jwst_recent",
    "get_hubble_decay",
    "get_history_today",
    "get_mission_previews_api",
]
