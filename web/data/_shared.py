"""Small formatting helpers shared across several web/data submodules."""
from utils.i18n import DEFAULT_LANG, t

# Ukrainian short compass abbreviations (8-point) for the dashboard, matching
# the template style ("ПнЗ → ПдС"). Collapsed from N2YO's 16-point codes.
_COMPASS_SHORT = {
    "N": "Пн", "NE": "ПнСх", "E": "Сх", "SE": "ПдСх",
    "S": "Пд", "SW": "ПдЗ", "W": "Зх", "NW": "ПнЗ",
}
from utils.i18n import _COMPASS_COLLAPSE  # noqa: E402 — reuse the collapse map

def _compass_short(code: str | None, lang: str = DEFAULT_LANG) -> str:
    if not code:
        return "—"
    code = _COMPASS_COLLAPSE.get(code.upper(), code.upper())
    if code not in _COMPASS_SHORT:
        return code
    return t(f"compass.short.{code}", lang)


import re as _re
_TAG_RE = _re.compile(r"<[^>]+>")


def _strip_tags(s: str | None) -> str:
    """Telegram <b>/<i> tags → plain text for JSON/web."""
    if not s:
        return ""
    return _TAG_RE.sub("", s).strip()

