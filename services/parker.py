import requests
import math
from datetime import datetime, timedelta, timezone
from web.cache import get_or_fetch

JPL_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api'

def _fetch_vectors(center: str):
    """Fetches 3 days of hourly vectors for Parker Solar Probe from JPL Horizons."""
    now = datetime.now(timezone.utc)
    # Start a bit in the past to ensure we have data before "now" for interpolation
    start = now - timedelta(hours=2)
    stop = now + timedelta(days=3)
    
    # Using format=json so Horizons returns a JSON wrapper containing 'result' text
    params = {
        'format': 'json',
        'COMMAND': '-96',
        'OBJ_DATA': 'NO',
        'MAKE_EPHEM': 'YES',
        'EPHEM_TYPE': 'VECTORS',
        'CENTER': center,
        'START_TIME': f"'{start.strftime('%Y-%m-%d %H:%M')}'",
        'STOP_TIME': f"'{stop.strftime('%Y-%m-%d %H:%M')}'",
        'STEP_SIZE': "'1 h'",
        'OUT_UNITS': 'KM-S',
        'CSV_FORMAT': 'YES',
        'VEC_TABLE': '2'
    }
    
    resp = requests.get(JPL_URL, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    
    if 'result' not in data:
        return []
        
    result = data['result']
    try:
        soe_idx = result.index('$$SOE')
        eoe_idx = result.index('$$EOE')
        lines = result[soe_idx:eoe_idx].split('\n')
    except ValueError:
        return []
        
    points = []
    for line in lines:
        if not line.strip() or line.startswith('$$'):
            continue
        parts = [p.strip() for p in line.split(',')]
        if len(parts) >= 8:
            try:
                date_str = parts[1].replace('A.D. ', '') 
                if '.' in date_str:
                    date_str = date_str.split('.')[0]
                dt = datetime.strptime(date_str, '%Y-%b-%d %H:%M:%S').replace(tzinfo=timezone.utc)
                x, y, z = float(parts[2]), float(parts[3]), float(parts[4])
                vx, vy, vz = float(parts[5]), float(parts[6]), float(parts[7])
                points.append({
                    'timestamp': dt.timestamp(),
                    'dist': math.sqrt(x*x + y*y + z*z),
                    'speed': math.sqrt(vx*vx + vy*vy + vz*vz)
                })
            except Exception:
                continue
                
    return points

def _fetch_both():
    sun_data = _fetch_vectors('@10')
    earth_data = _fetch_vectors('@399')
    if not sun_data or not earth_data:
        return None
    combined = []
    for s, e in zip(sun_data, earth_data):
        if s['timestamp'] == e['timestamp']:
            combined.append({
                'time': s['timestamp'],
                'dist_sun': s['dist'],
                'speed_sun': s['speed'],
                'dist_earth': e['dist'],
                'speed_earth': e['speed']
            })
    if not combined:
        return None
    return {
        'trajectory': combined,
        'updated_at': datetime.now(timezone.utc).timestamp()
    }

def get_parker_telemetry():
    return get_or_fetch("parker_ephemeris", 3600 * 12, _fetch_both, lambda v: v is not None)
