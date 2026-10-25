"""Space debris statistics — curated ESA figures.

ESA publishes periodically updated figures, not a live JSON feed. Keep the
source date and model reference separate: tracked counts and modeled size
bins measure different populations. Update from the linked ESA table.
"""
import logging
from utils.i18n import t, DEFAULT_LANG

logger = logging.getLogger(__name__)

# Source table updated 23 October 2026; MASTER-8 model reference February 2026.
# https://www.esa.int/Space_Safety/Space_Debris/Space_debris_by_the_numbers
_DATA = {
    "year_ref": "2026",
    "reference_date": "2026-10-23",
    "model_ref": "2026-02",
    "tracked": 47250,       # routinely tracked objects, including payloads
    "debris_1_to_10_cm": 1_500_000,
    "debris_1mm_to_1cm": 230_000_000,
    "cm1": 1_500_000,       # legacy alias: 1–10 cm bin, NOT a cumulative count
    "cm01": 230_000_000,    # legacy alias: 1 mm–1 cm bin
    "total_mass_t": 17400,  # MORE THAN this mass of ALL space objects, tonnes
    "breakups": 660,        # MORE THAN this many fragmentation events
    "source_url": "https://www.esa.int/Space_Safety/Space_Debris/Space_debris_by_the_numbers",
}


class SpaceDebrisAPI:
    """Curated space-debris statistics."""

    @staticmethod
    def get_stats_dict() -> dict:
        """Structured debris stats for the website (curated ESA figures)."""
        return dict(_DATA)

    @staticmethod
    def get_stats(lang: str = DEFAULT_LANG) -> str:
        try:
            d = _DATA
            msg = t('debris.title', lang)
            msg += t('debris.tracked', lang, v=f"{d['tracked']:,}".replace(",", " "))
            msg += t('debris.cm1', lang, v=f"{d['cm1']:,}".replace(",", " "))
            msg += t('debris.cm01', lang, v=f"{d['cm01']:,}".replace(",", " "))
            msg += t('debris.mass', lang, v="> " + f"{d['total_mass_t']:,}".replace(",", " "))
            msg += t('debris.breakups', lang, v=f"> {d['breakups']}")
            msg += t('debris.note', lang, year=d['reference_date'])
            msg += t('debris.source', lang, url=d['source_url'])
            return msg
        except Exception as e:
            logger.error(f"Debris stats error: {e}")
            return t('debris.error', lang)
