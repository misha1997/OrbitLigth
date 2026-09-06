"""Configuration for NEOwatch Bot"""
import os
from dotenv import load_dotenv

load_dotenv()

# API Keys (set in .env or environment variables)
NASA_API_KEY = os.getenv('NASA_API_KEY')
N2YO_API_KEY = os.getenv('N2YO_API_KEY')
# Mars rover photos via the community Mars Vista API (free key, signup at
# https://marsvista.dev/signin). The former NASA Mars Rover Photos API at
# api.nasa.gov/mars-photos was retired (Heroku app decommissioned → 404).
MARS_VISTA_API_KEY = os.getenv('MARS_VISTA_API_KEY', '')
BOT_TOKEN = os.getenv('BOT_TOKEN')
GEOAPIFY_KEY = os.getenv('GEOAPIFY_KEY', '')
DEEPL_API_KEY = os.getenv('DEEPL_API_KEY')

_chat_id_val = os.getenv('FEEDBACK_CHAT_ID', '')
FEEDBACK_CHAT_ID = int(_chat_id_val) if (_chat_id_val.isdigit() or (_chat_id_val.startswith('-') and _chat_id_val[1:].isdigit())) else None

# Web Push (VAPID). Generate with `python3 scripts/gen_vapid_keys.py` once and
# put the output in .env; production needs the same three vars set.
VAPID_PUBLIC_KEY = os.getenv('VAPID_PUBLIC_KEY', '')
VAPID_PRIVATE_KEY = os.getenv('VAPID_PRIVATE_KEY', '')
VAPID_CLAIM_EMAIL = os.getenv('VAPID_CLAIM_EMAIL', '')

# NASA GCN Kafka (gravitational-wave alerts, services/gw_alerts.py). Free
# client credentials from https://gcn.nasa.gov ("Client Credentials"
# quickstart, needs a GCN account). Without these, GW alerts are disabled.
GCN_CLIENT_ID = os.getenv('GCN_CLIENT_ID', '')
GCN_CLIENT_SECRET = os.getenv('GCN_CLIENT_SECRET', '')

# Website account system (web/auth.py). SESSION_SECRET signs the httpOnly
# session cookie's JWT — generate once with
# `python3 -c "import secrets; print(secrets.token_hex(32))"` and never
# rotate it casually (rotating logs every signed-in user out). Falls back to
# an insecure dev-only default so `uvicorn web.app:app` still boots locally;
# web/auth.py refuses to issue/accept sessions signed with it in production
# (see its module docstring).
SESSION_SECRET = os.getenv('SESSION_SECRET', '')

# Google Sign-In (accounts.google.com Identity Services). Create a Web
# application OAuth client at https://console.cloud.google.com/apis/credentials
# with the site's origin as an authorized JavaScript origin. Only the client
# ID is used server-side (web/auth.py verifies ID tokens via Google's
# tokeninfo endpoint, checking `aud`); the secret isn't needed for this flow
# but is kept for parity/future use.
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')

# Telegram Login Widget (site registration/login + account-page "connect
# Telegram"). Needs the bot's @username (for the widget's
# data-telegram-login attribute) and a one-time `/setdomain` on @BotFather
# pointing at the site's real domain, or Telegram refuses to render the
# widget.
TELEGRAM_BOT_USERNAME = os.getenv('TELEGRAM_BOT_USERNAME', '')

# Admin dashboard (/admin) bootstrap. Admin status itself is a DB column
# (web_users.role) managed from the dashboard's Users page — this env var is
# only a one-time seed, applied on every startup by database.init_db(): any
# address listed here gets promoted to role='admin' if it isn't already, so
# an operator can grant the very first admin (or recover access) via env var
# + restart with no direct DB access. Not read anywhere else.
ADMIN_EMAILS = {e.strip().lower() for e in os.getenv('ADMIN_EMAILS', '').split(',') if e.strip()}

# NASA API
NASA_NEO_URL = "https://api.nasa.gov/neo/rest/v1/feed"
NASA_APOD_URL = "https://api.nasa.gov/planetary/apod"

# N2YO API
N2YO_BASE_URL = "https://api.n2yo.com/rest/v1/satellite"

# Default location (Kyiv, Ukraine)
DEFAULT_LAT = float(os.getenv('DEFAULT_LAT', '50.4501'))
DEFAULT_LON = float(os.getenv('DEFAULT_LON', '30.5234'))
DEFAULT_ALT = int(os.getenv('DEFAULT_ALT', '0'))

# Database Configuration
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', 3306))
DB_NAME = os.getenv('DB_NAME', '')
DB_USER = os.getenv('DB_USER', '')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
ISS_NORAD_ID = 25544

# Starlink satellite IDs (most visible ones - updated 2026)
# Source: Celestrak
STARLINK_NORAD_IDS = [
    # v1.0 launches (2019-2020)
    44714, 44718, 44723, 44724, 44725, 44741, 44744, 44747, 44748, 44751,
    44752, 44753, 44768, 44771, 44772, 44927, 44930, 44941, 44949, 44961,
    44968, 45044, 45047, 45048, 45054, 45057, 45060, 45061, 45062, 45064,
    # v1.5 launches (2021-2022)
    47445, 47446, 47447, 47448, 47449, 47450, 47451, 47452, 47453, 47454,
    48219, 48220, 48221, 48222, 48223, 48224, 48225, 48226, 48227, 48228,
]
