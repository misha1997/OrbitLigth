// Curated selection of internationally certified Dark Sky Places (DarkSky
// International — darksky.org/what-we-do/international-dark-sky-places/). The
// registry has 250+ certified places; this ships a well-known subset spanning
// six continents with reliably documented coordinates, the same "curated, not
// exhaustive" stance services/galaxies.py already takes for its catalog — not
// a scrape of the full live registry (which has no public API). Coordinates
// are park/reserve centroids (approximate — these are large protected areas,
// not single points), good enough for a world-map marker, not for navigation.
//
// type: "park" | "reserve" | "sanctuary" | "community"
export const DARK_SKY_PLACES = [
  // North America
  { name: "Natural Bridges National Monument", country: "USA", type: "park", lat: 37.6, lon: -110.01 },
  { name: "Cherry Springs State Park", country: "USA", type: "park", lat: 41.663, lon: -77.827 },
  { name: "Big Bend National Park", country: "USA", type: "park", lat: 29.25, lon: -103.25 },
  { name: "Death Valley National Park", country: "USA", type: "park", lat: 36.5, lon: -117.1 },
  { name: "Grand Canyon National Park", country: "USA", type: "park", lat: 36.06, lon: -112.14 },
  { name: "Bryce Canyon National Park", country: "USA", type: "park", lat: 37.59, lon: -112.19 },
  { name: "Canyonlands National Park", country: "USA", type: "park", lat: 38.2, lon: -109.93 },
  { name: "Capitol Reef National Park", country: "USA", type: "park", lat: 38.37, lon: -111.26 },
  { name: "Arches National Park", country: "USA", type: "park", lat: 38.73, lon: -109.59 },
  { name: "Chaco Culture National Historical Park", country: "USA", type: "park", lat: 36.06, lon: -107.96 },
  { name: "Great Basin National Park", country: "USA", type: "park", lat: 38.98, lon: -114.3 },
  { name: "Craters of the Moon National Monument", country: "USA", type: "park", lat: 43.42, lon: -113.5 },
  { name: "Central Idaho Dark Sky Reserve", country: "USA", type: "reserve", lat: 44.0, lon: -114.83 },
  { name: "Cosmic Campground", country: "USA", type: "sanctuary", lat: 33.48, lon: -108.93 },
  { name: "Voyageurs National Park", country: "USA", type: "park", lat: 48.5, lon: -92.88 },
  { name: "Headlands International Dark Sky Park", country: "USA", type: "park", lat: 45.78, lon: -84.73 },
  { name: "Enchanted Rock State Natural Area", country: "USA", type: "park", lat: 30.5, lon: -98.82 },
  { name: "Antelope Island State Park", country: "USA", type: "park", lat: 41.03, lon: -112.22 },
  { name: "Jasper National Park", country: "Canada", type: "park", lat: 52.87, lon: -117.95 },
  { name: "Mont-Mégantic International Dark Sky Reserve", country: "Canada", type: "reserve", lat: 45.46, lon: -71.15 },
  { name: "Kejimkujik National Park", country: "Canada", type: "park", lat: 44.4, lon: -65.2 },
  { name: "Torrance Barrens Dark Sky Preserve", country: "Canada", type: "sanctuary", lat: 44.98, lon: -79.53 },
  { name: "Grasslands National Park", country: "Canada", type: "park", lat: 49.11, lon: -107.5 },
  { name: "Point Pelee National Park", country: "Canada", type: "park", lat: 41.95, lon: -82.52 },

  // Europe
  { name: "Exmoor National Park", country: "UK", type: "reserve", lat: 51.13, lon: -3.6 },
  { name: "Snowdonia (Eryri) National Park", country: "UK", type: "reserve", lat: 52.9, lon: -3.9 },
  { name: "Brecon Beacons National Park", country: "UK", type: "reserve", lat: 51.88, lon: -3.44 },
  { name: "Northumberland National Park", country: "UK", type: "park", lat: 55.28, lon: -2.2 },
  { name: "South Downs National Park", country: "UK", type: "reserve", lat: 50.9, lon: -0.5 },
  { name: "North York Moors National Park", country: "UK", type: "reserve", lat: 54.4, lon: -0.9 },
  { name: "Kerry International Dark-Sky Reserve", country: "Ireland", type: "reserve", lat: 51.85, lon: -10.15 },
  { name: "Zselic Starry Sky Park", country: "Hungary", type: "park", lat: 46.2, lon: 17.7 },
  { name: "Hortobágy National Park", country: "Hungary", type: "park", lat: 47.58, lon: 21.1 },
  { name: "Rhön Starry Sky Reserve", country: "Germany", type: "reserve", lat: 50.5, lon: 9.9 },
  { name: "Westhavelland Nature Park", country: "Germany", type: "reserve", lat: 52.7, lon: 12.4 },
  { name: "Eifel National Park", country: "Germany", type: "park", lat: 50.5, lon: 6.4 },
  { name: "Pic du Midi International Dark Sky Reserve", country: "France", type: "reserve", lat: 42.94, lon: 0.14 },
  { name: "Cévennes National Park", country: "France", type: "reserve", lat: 44.3, lon: 3.6 },

  // Africa
  { name: "NamibRand Nature Reserve", country: "Namibia", type: "reserve", lat: -25.0, lon: 16.0 },
  { name: "Lapalala Wilderness Nature Reserve", country: "South Africa", type: "reserve", lat: -23.87, lon: 28.25 },

  // Oceania
  { name: "Aoraki Mackenzie International Dark Sky Reserve", country: "New Zealand", type: "reserve", lat: -44.0, lon: 170.1 },
  { name: "Great Barrier Island (Aotea)", country: "New Zealand", type: "sanctuary", lat: -36.2, lon: 175.4 },
  { name: "Warrumbungle National Park", country: "Australia", type: "park", lat: -31.28, lon: 149.0 },
];

// Haversine great-circle distance in km — used for the "distance from you"
// line in a Dark Sky Place popup.
export function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Curated places nearest (lat, lon), closest first — used by the "Find
// nearest dark sky" button to prefer an actual named, reachable site over a
// raw atlas pixel when one is close enough.
export function nearestPlaces(lat, lon, limit = 1) {
  return DARK_SKY_PLACES
    .map((p) => ({ ...p, distanceKm: distanceKm(lat, lon, p.lat, p.lon) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

// Keyless Google Maps directions deep link (not the paid Directions API) —
// "Get directions" on a Dark Sky Place / nearest-finder result popup.
export function directionsUrl(lat, lon) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}
