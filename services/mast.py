import os
import sys
import json
import logging
import warnings
import concurrent.futures
import numpy as np
from datetime import datetime
import lightkurve as lk
from astroquery.mast import Observations
from astropy.coordinates import SkyCoord
import astropy.units as u
from astropy.time import Time

logger = logging.getLogger(__name__)

# Suppress lightkurve submodules warnings
warnings.filterwarnings("ignore", category=UserWarning, module="lightkurve")

# Predefined list of 6 famous targets for Hubble/JWST recent observations cone search
FAMOUS_TARGETS = [
    {"name": "TRAPPIST-1 e", "coords": "23h06m29.28s -05d02m28.5s"},
    {"name": "Ring Nebula (M57)", "coords": "18h53m35.079s +33d01m45.03s"},
    {"name": "Sombrero Galaxy", "coords": "12h39m59.4s -11d37m23s"},
    {"name": "Abell 2218", "coords": "16h35m54s +66d13m00s"},
    {"name": "Orion Nebula (M42)", "coords": "05h35m17.3s -05d23m28s"},
    {"name": "Pillars of Creation", "coords": "18h18m48s -13d49m00s"}
]

# Cap on simultaneous MAST cone-search queries — see the docstring on
# MastService.get_hubble_jwst_recent_obs for why this isn't len(FAMOUS_TARGETS).
_MAX_CONCURRENT_TARGETS = 2


def mjd_to_date(mjd) -> str:
    """Convert Modified Julian Date (MJD) to DD.MM.YYYY string."""
    try:
        t = Time(mjd, format='mjd')
        return t.datetime.strftime("%d.%m.%Y")
    except Exception:
        return ""

class MastService:
    @staticmethod
    def query_star_lightcurve(target_id: str) -> dict | None:
        """Search, download and process TESS/Kepler lightcurve for a target."""
        target_clean = target_id.strip()
        logger.info("MAST: Searching light curve for target: %s", target_clean)
        
        try:
            # Try SPOC (high quality pipeline) author first, fallback to any
            search_result = lk.search_lightcurve(target_clean, author="SPOC")
            if len(search_result) == 0:
                search_result = lk.search_lightcurve(target_clean)
                
            if len(search_result) == 0:
                logger.warning("MAST: No light curves found for %s", target_clean)
                return None
                
            # Download the first product
            logger.info("MAST: Downloading light curve for %s", target_clean)
            lc = search_result[0].download()
            if lc is None:
                return None
                
            # Extract time & flux values
            time = lc.time.value
            flux = getattr(lc, 'pdcsap_flux', None)
            if flux is None:
                flux = getattr(lc, 'flux', None)
                
            if flux is None:
                logger.warning("MAST: No flux column found in light curve for %s", target_clean)
                return None
                
            flux_val = flux.value
            
            # Remove NaNs
            mask = ~np.isnan(time) & ~np.isnan(flux_val)
            time = time[mask]
            flux_val = flux_val[mask]
            
            # Downsample if too many points (limit to ~800 points for web chart performance)
            max_pts = 800
            if len(time) > max_pts:
                step = int(np.ceil(len(time) / max_pts))
                time = time[::step]
                flux_val = flux_val[step-1::step] # use step offset to match lengths if sliced
                # Ensure equal length
                min_len = min(len(time), len(flux_val))
                time = time[:min_len]
                flux_val = flux_val[:min_len]
                
            # Normalize flux around 1.0
            if len(flux_val) > 0:
                median_flux = float(np.median(flux_val))
                if median_flux > 0:
                    normalized_flux = (flux_val / median_flux).tolist()
                else:
                    normalized_flux = flux_val.tolist()
            else:
                normalized_flux = []
                
            time_list = time.tolist()
            
            return {
                "target": target_clean,
                "label": getattr(lc, 'label', target_clean),
                "mission": getattr(lc, 'mission', 'TESS'),
                "sector": int(getattr(lc, 'sector', 0)) if getattr(lc, 'sector', None) is not None else None,
                "time": time_list,
                "flux": normalized_flux
            }
            
        except Exception as e:
            logger.error("MAST: Failed to query lightcurve for %s: %s", target_clean, e)
            return None

    @staticmethod
    def _query_one_target(target: dict) -> list[dict]:
        """Cone-search a single target and return its top-2 recent HST/JWST
        science images. Split out of get_hubble_jwst_recent_obs so it can
        run in its own worker thread."""
        rows_out: list[dict] = []
        try:
            coord = SkyCoord(target["coords"], frame="icrs")
            # Query within 0.05 deg (3 arcmin)
            res = Observations.query_region(coord, radius=0.05 * u.deg)
            if len(res) == 0:
                return rows_out

            # Filter for HST & JWST science image observations with valid JPEGs
            mask = (res['obs_collection'] == 'HST') | (res['obs_collection'] == 'JWST')
            res = res[mask]
            res = res[res['intentType'] == 'science']
            res = res[res['dataproduct_type'] == 'image']
            res = res[~res['jpegURL'].mask]

            if len(res) == 0:
                return rows_out

            # Sort by time descending (latest first)
            res.sort('t_min')
            res.reverse()

            # Take top 2 observations for this target
            for row in res[:2]:
                jpeg_uri = row['jpegURL']
                # Convert to public HTTP URL if it is a mast: URI
                if jpeg_uri.startswith("mast:"):
                    jpeg_url = f"https://mast.stsci.edu/api/v0.1/Download/file/?uri={jpeg_uri}"
                else:
                    jpeg_url = jpeg_uri

                rows_out.append({
                    "instrument": f"{row['obs_collection']} · {row['instrument_name']}",
                    "target": target["name"],
                    "coords": f"RA {row['s_ra']:.2f}° / Dec {row['s_dec']:.2f}°",
                    "date": mjd_to_date(row['t_min']),
                    "jpeg_url": jpeg_url,
                    "collection": row['obs_collection']
                })
        except Exception as e:
            logger.error("MAST: Failed to query region for %s: %s", target["name"], e)
        return rows_out

    @staticmethod
    def get_hubble_jwst_recent_obs() -> list[dict]:
        """Query recent HST & JWST science image observations in famous
        regions — one cone search per target, run IN PARALLEL.

        Each ``Observations.query_region()`` call is a network round-trip
        to the MAST archive; run sequentially, 6 of them routinely added up
        to 120s+ of total wait — longer than Cloudflare's proxy timeout, so
        the request died with a 524 before our own subprocess even finished.
        A thread pool (this is I/O-bound, not CPU-bound, so the GIL isn't a
        problem) cuts the wall-clock time down. The 45s deadline below is
        shared across all targets at once (``concurrent.futures.wait``, not
        a per-future ``result(timeout=...)`` in a loop) — the latter would
        re-arm a fresh 45s wait for every still-hung target it reaches,
        letting several slow targets add their timeouts back up again.

        Worker count is capped, NOT ``len(FAMOUS_TARGETS)``: this whole
        subprocess exists because lightkurve/astropy/astroquery are already
        hundreds of MB resident just imported (see the module docstring on
        ``_main``) — running every target's query truly concurrently was
        observed OOM-killing the subprocess outright (rc=-9 in the journal)
        because that many in-flight MAST result tables now overlap in
        memory at once, where the old sequential version only ever held
        one. _MAX_CONCURRENT_TARGETS trades some of the parallel speed-up
        back for a bounded peak: still much faster than fully sequential,
        without holding all 6 result sets in memory at the same time.

        Deliberately NOT a ``with ThreadPoolExecutor(...) as pool:`` block:
        leaving that context manager calls ``pool.shutdown(wait=True)`` on
        exit, which blocks until *every* submitted future finishes —
        including the ones ``wait(timeout=60)`` already gave up on. A single
        target whose network call hangs past 60s then holds up the whole
        function indefinitely (observed exceeding 100s+ locally), and the
        caller's own subprocess timeout (``_run_mast_subprocess``, 90s) kills
        the process before it ever reaches the ``print(json.dumps(...))`` in
        ``_main`` — silently discarding results that were already done at the
        60s mark. Calling ``shutdown(wait=False)`` explicitly instead avoids
        that block; ``_main`` also exits via ``os._exit`` right after printing
        so the interpreter's own atexit thread-join doesn't reintroduce the
        same hang for whichever queries are still stuck in the background."""
        obs_list: list[dict] = []
        pool = concurrent.futures.ThreadPoolExecutor(max_workers=_MAX_CONCURRENT_TARGETS)
        futures = {pool.submit(MastService._query_one_target, t): t for t in FAMOUS_TARGETS}
        # With only _MAX_CONCURRENT_TARGETS running at once, 6 targets
        # need 3 sequential rounds, not 1 — the deadline has to cover
        # all of them, not just one batch.
        done, not_done = concurrent.futures.wait(futures, timeout=60)
        for fut in done:
            target = futures[fut]
            try:
                obs_list.extend(fut.result())
            except Exception as e:
                logger.error("MAST: target %s failed: %s", target["name"], e)
        for fut in not_done:
            logger.warning("MAST: target %s timed out", futures[fut]["name"])
        pool.shutdown(wait=False)

        return obs_list

    @staticmethod
    def get_hst_recent_observation() -> list[dict]:
        """Sky-wide most-recent public HST science image(s) — an honest
        "recently observed" feature, deliberately NOT the literal live
        "what Hubble is pointed at right now" feed. That would need
        spacetelescopelive.org's undocumented, session-gated internal API
        (see CLAUDE.md's "Hubble/JWST 'what they're observing'" section for
        why that was ruled out). This instead does one plain
        ``Observations.query_criteria`` call — the same public, documented
        MAST archive endpoint ``_query_one_target`` already uses — across the
        whole sky rather than 6 fixed cone searches, sorted by observation
        time descending. MAST's own pipeline latency means the newest hit is
        typically hours to ~1-2 days old, not this second; the caller labels
        it "recent", not "live", same honesty convention as the Hubble/JWST
        famous-target gallery above.

        Filters on ``dataRights == "PUBLIC"`` in addition to having a
        jpegURL: MAST's default proprietary period means the genuinely
        newest observations are usually still ``EXCLUSIVE_ACCESS`` — their
        row has a jpegURL reference, but fetching it 401s. Skipping straight
        to "most recent PUBLIC row" is what actually makes this feature look
        recent instead of broken; observed practice is this still lands
        within about a day of "now", since HST's public archive is
        continuously catching up as each proprietary window expires."""
        rows_out: list[dict] = []
        try:
            now_mjd = Time.now().mjd
            res = Observations.query_criteria(
                obs_collection="HST",
                dataproduct_type="image",
                intentType="science",
                dataRights="PUBLIC",
                t_min=[now_mjd - 30, now_mjd],
            )
            if len(res) == 0:
                return rows_out

            res = res[~res['jpegURL'].mask]
            if len(res) == 0:
                return rows_out

            res.sort('t_min')
            res.reverse()

            for row in res[:5]:
                jpeg_uri = row['jpegURL']
                if jpeg_uri.startswith("mast:"):
                    jpeg_url = f"https://mast.stsci.edu/api/v0.1/Download/file/?uri={jpeg_uri}"
                else:
                    jpeg_url = jpeg_uri

                target_name = str(row['target_name']) if row['target_name'] else "—"
                rows_out.append({
                    "instrument": f"{row['obs_collection']} · {row['instrument_name']}",
                    "target": target_name,
                    "coords": f"RA {row['s_ra']:.2f}° / Dec {row['s_dec']:.2f}°",
                    "date": mjd_to_date(row['t_min']),
                    "jpeg_url": jpeg_url,
                    "collection": row['obs_collection'],
                })
        except Exception as e:
            logger.error("MAST: hst-recent query failed: %s", e)
        return rows_out

    @staticmethod
    def get_jwst_recent_observation() -> list[dict]:
        """Sky-wide most-recent public JWST science image(s)."""
        rows_out: list[dict] = []
        try:
            now_mjd = Time.now().mjd
            res = Observations.query_criteria(
                obs_collection="JWST",
                dataproduct_type="image",
                intentType="science",
                dataRights="PUBLIC",
                t_min=[now_mjd - 30, now_mjd],
            )
            if len(res) == 0:
                return rows_out

            res = res[~res['jpegURL'].mask]
            if len(res) == 0:
                return rows_out

            res.sort('t_min')
            res.reverse()

            for row in res[:5]:
                jpeg_uri = row['jpegURL']
                if jpeg_uri.startswith("mast:"):
                    jpeg_url = f"https://mast.stsci.edu/api/v0.1/Download/file/?uri={jpeg_uri}"
                else:
                    jpeg_url = jpeg_uri

                target_name = str(row['target_name']) if row['target_name'] else "—"
                rows_out.append({
                    "instrument": f"{row['obs_collection']} · {row['instrument_name']}",
                    "target": target_name,
                    "coords": f"RA {row['s_ra']:.2f}° / Dec {row['s_dec']:.2f}°",
                    "date": mjd_to_date(row['t_min']),
                    "jpeg_url": jpeg_url,
                    "collection": row['obs_collection'],
                })
        except Exception as e:
            logger.error("MAST: jwst-recent query failed: %s", e)
        return rows_out


def _main() -> None:
    """CLI entry used by ``web.data._run_mast_subprocess`` for process isolation.

    Why a subprocess: importing lightkurve + astropy + astroquery pulls
    ~hundreds of MB into resident memory, and ``download()`` loads a full
    TESS/Kepler FITS product on top of that. Running it in the long-lived
    web/bot process kept growing it until the OOM killer took the whole
    service down. A short-lived child process imports the heavy stack,
    does the work, prints one JSON line to stdout and exits — freeing all
    of it. The web layer caches the result (24 h / 12 h), so the child
    only forks once per target per day.

    Usage::

        python -m services.mast lightcurve <target>
        python -m services.mast hubble-jwst
        python -m services.mast hst-recent

    ``hubble-jwst`` and ``hst-recent`` exit via ``os._exit`` right after
    printing, not a normal return — see the "Deliberately NOT a `with
    ThreadPoolExecutor`" note on ``get_hubble_jwst_recent_obs`` for why a
    normal interpreter exit can still hang joining background threads that
    ``pool.shutdown(wait=False)`` already gave up waiting on.
    """
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "lightcurve":
        target = sys.argv[2] if len(sys.argv) > 2 else ""
        print(json.dumps(MastService.query_star_lightcurve(target)))
    elif mode == "hubble-jwst":
        result = MastService.get_hubble_jwst_recent_obs()
        print(json.dumps(result))
        sys.stdout.flush()
        os._exit(0)
    elif mode == "hst-recent":
        result = MastService.get_hst_recent_observation()
        print(json.dumps(result))
        sys.stdout.flush()
        os._exit(0)
    elif mode == "jwst-recent":
        result = MastService.get_jwst_recent_observation()
        print(json.dumps(result))
        sys.stdout.flush()
        os._exit(0)
    else:
        sys.stderr.write(f"services.mast: unknown mode {mode!r}\n")
        sys.exit(2)


if __name__ == "__main__":
    _main()
