"""Shared geocentric distance / light-time helper for the per-planet services.

Deduplicates the ``_earth_<planet>_distance_km`` + ``_C_KM_S`` pattern that
used to be copy-pasted identically (bar the NAIF body id) into mercury.py,
venus.py, jupiter.py, saturn.py, uranus.py, and neptune.py.
"""

C_KM_S = 299792.458  # speed of light, km/s


def earth_distance_km(naif_id: int) -> float | None:
    """Live geocentric distance (km) to the body at ``naif_id``, via skyfield.

    Returns None if the ephemeris cannot be loaded (callers keep serving
    the rest of their page even without a distance value).
    """
    try:
        from services.planets import _get_skyfield
        eph, ts, _wgs84, _cm, _latin = _get_skyfield()
        t = ts.now()
        earth = eph[399]
        body = eph[naif_id]
        d = earth.at(t).observe(body).distance()
        return d.km
    except Exception:
        return None


def light_time_minutes(dist_km: float | None) -> float | None:
    """One-way light travel time (minutes) for a distance in km."""
    return (dist_km / C_KM_S / 60.0) if dist_km is not None else None
