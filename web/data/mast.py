"""MAST (Kepler/TESS/Hubble/JWST) — runs in an isolated subprocess (see services/mast.py)."""
import logging
import asyncio
import json
import os

from web.cache import get_or_fetch

logger = logging.getLogger(__name__)

def _run_mast_subprocess(args: list[str], timeout: float = 180) -> dict | list | None:
    """Run a MAST query in a short-lived child process and parse its JSON.

    lightkurve + astropy + astroquery are ~hundreds of MB resident, and
    ``MastService.query_star_lightcurve`` loads a full TESS/Kepler FITS
    product into memory on top of that. Running them in the long-lived
    web/bot process grew it until the OOM killer took the whole service
    down. The child process imports the heavy stack, does the work, prints
    one JSON line to stdout and exits — freeing all of it. The caller
    caches the result (24 h / 12 h), so the child only forks once per
    target per day. Returns ``None`` on timeout / non-zero exit / bad JSON
    so the caller can avoid caching a failure.
    """
    import sys as _sys
    import subprocess
    import json as _json
    try:
        proc = subprocess.run(
            [_sys.executable, "-m", "services.mast", *args],
            capture_output=True, text=True, timeout=timeout, check=False,
        )
    except subprocess.TimeoutExpired:
        logger.warning("MAST subprocess timed out (%s)", args)
        return None
    if proc.returncode != 0:
        logger.warning("MAST subprocess rc=%s: %s",
                       proc.returncode, (proc.stderr or "")[-1000:])
        return None
    try:
        return _json.loads(proc.stdout)
    except _json.JSONDecodeError as exc:
        logger.warning("MAST subprocess bad JSON: %s", exc)
        return None


def _mast_lightcurve_raw(target: str) -> dict | None:
    return _run_mast_subprocess(["lightcurve", target])

async def get_mast_lightcurve(target: str) -> dict:
    key = f"mast_lc:{target.strip().upper()}"
    # Don't cache a failed (None) result for 24 h — only cache real data.
    val = await asyncio.to_thread(
        get_or_fetch, key, 86400,
        lambda: _mast_lightcurve_raw(target),
        lambda v: v is not None,
    )
    return val or {}

def _mast_hubble_jwst_raw() -> list | None:
    # Tighter budget than the default 180s: Cloudflare's proxy times out a
    # slow origin response at ~100s regardless of what we do here, turning
    # a merely-slow MAST day into a raw 524 error page instead of the
    # empty-list-then-retry-later behavior get_or_fetch already handles
    # gracefully (failed subprocess isn't cached, so the next request tries
    # again rather than being stuck empty for the full 12h TTL).
    return _run_mast_subprocess(["hubble-jwst"], timeout=90)


# Last-good hubble-jwst payload, kept beyond the TTL — same "stash" pattern as
# _TLE_STASH: a slow/empty MAST poll shouldn't blank the Hubble/JWST galleries
# for every visitor until the next lucky poll succeeds. Persisted to disk so a
# server restart doesn't lose it either.
_MAST_HJ_STASH: list | None = None
_MAST_HJ_STASH_PATH = os.path.join("data", "mast_hj_stash.json")


def _mast_hj_stash_load() -> list | None:
    global _MAST_HJ_STASH
    if _MAST_HJ_STASH is not None:
        return _MAST_HJ_STASH
    try:
        if os.path.exists(_MAST_HJ_STASH_PATH):
            with open(_MAST_HJ_STASH_PATH, encoding="utf-8") as f:
                _MAST_HJ_STASH = json.load(f)
                return _MAST_HJ_STASH
    except Exception as e:
        logger.warning("MAST hubble-jwst stash load: %s", e)
    return None


def _mast_hj_stash_save(payload: list) -> None:
    global _MAST_HJ_STASH
    _MAST_HJ_STASH = payload
    try:
        os.makedirs("data", exist_ok=True)
        with open(_MAST_HJ_STASH_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
    except Exception as e:
        logger.warning("MAST hubble-jwst stash save: %s", e)


def _mast_hst_recent_raw() -> list | None:
    # Same Cloudflare-proxy reasoning as _mast_hubble_jwst_raw's 90s budget
    # (see that function's comment) — a single sky-wide query_criteria call,
    # but observed taking anywhere from ~15s to 100s+ depending on how much
    # MAST has to search/paginate, so it gets the same tight deadline rather
    # than the default 180s.
    return _run_mast_subprocess(["hst-recent"], timeout=90)


# Last-good hst-recent payload — same "stash" pattern as _MAST_HJ_STASH above
# (and _TLE_STASH elsewhere): a slow/failed poll shouldn't blank the
# "recently observed" card for every visitor until the next poll succeeds.
_MAST_HR_STASH: list | None = None
_MAST_HR_STASH_PATH = os.path.join("data", "mast_hr_stash.json")


def _mast_hr_stash_load() -> list | None:
    global _MAST_HR_STASH
    if _MAST_HR_STASH is not None:
        return _MAST_HR_STASH
    try:
        if os.path.exists(_MAST_HR_STASH_PATH):
            with open(_MAST_HR_STASH_PATH, encoding="utf-8") as f:
                _MAST_HR_STASH = json.load(f)
                return _MAST_HR_STASH
    except Exception as e:
        logger.warning("MAST hst-recent stash load: %s", e)
    return None


def _mast_hr_stash_save(payload: list) -> None:
    global _MAST_HR_STASH
    _MAST_HR_STASH = payload
    try:
        os.makedirs("data", exist_ok=True)
        with open(_MAST_HR_STASH_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
    except Exception as e:
        logger.warning("MAST hst-recent stash save: %s", e)


async def get_mast_hst_recent() -> list:
    """Most-recent public HST science image(s), sky-wide — an honest
    "recently observed" feature, not a literal live feed (see
    MastService.get_hst_recent_observation's docstring). Shorter TTL than
    get_mast_hubble_jwst's 12h: this is meant to feel closer to current, and
    new HST exposures land in the public archive multiple times a day."""
    val = await asyncio.to_thread(
        get_or_fetch, "mast_hr", 14400, _mast_hst_recent_raw,
        lambda v: bool(v),
    )
    if val:
        _mast_hr_stash_save(val)
        return val
    return _mast_hr_stash_load() or []


async def get_mast_hubble_jwst() -> list:
    # `v is not None` isn't enough here: a subprocess that ran fine but hit
    # its internal 45s per-batch deadline on every target (see
    # MastService.get_hubble_jwst_recent_obs) returns `[]`, not `None` — an
    # empty-but-not-None result would pass that check and get pinned in the
    # cache for the full 12h, showing "no observations" for half a day over
    # what was really a transient MAST slowdown. Any of the 6 permanent
    # famous targets having zero recent HST/JWST imagery is implausible
    # enough to treat an empty list the same as a failure: don't cache it,
    # let the next request try again.
    #
    # But "retry next request" still means *this* request has nothing to
    # show — so on an empty/failed poll, fall back to the last known-good
    # list (_MAST_HJ_STASH) instead of returning []. The live poll keeps
    # retrying on every request either way, so a fresh success overwrites the
    # stash the moment MAST cooperates again; the Hubble/JWST pages already
    # show each photo's observation date, so a slightly older stashed photo
    # is still honestly labeled, not passed off as brand new.
    val = await asyncio.to_thread(
        get_or_fetch, "mast_hj", 43200, _mast_hubble_jwst_raw,
        lambda v: bool(v),
    )
    if val:
        _mast_hj_stash_save(val)
        return val
    return _mast_hj_stash_load() or []

