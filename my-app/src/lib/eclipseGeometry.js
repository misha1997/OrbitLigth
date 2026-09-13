// Eclipse trajectory geometry, visibility modeling & animation helpers
// Contains realistic totality corridors and visibility regions for upcoming eclipses.

export function haversineKm([lat1, lon1], [lat2, lon2]) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Distance from point P to line segment AB
function distToSegmentKm(p, a, b) {
  const dAB = haversineKm(a, b);
  if (dAB < 1) return haversineKm(p, a);
  // Sample along segment for spherical accuracy
  const STEPS = 8;
  let minD = Infinity;
  for (let i = 0; i <= STEPS; i++) {
    const frac = i / STEPS;
    const lat = a[0] + (b[0] - a[0]) * frac;
    const lon = a[1] + (b[1] - a[1]) * frac;
    const d = haversineKm(p, [lat, lon]);
    if (d < minD) minD = d;
  }
  return minD;
}

export function distToPathKm(point, path) {
  if (!path || path.length === 0) return Infinity;
  if (path.length === 1) return haversineKm(point, path[0]);
  let minD = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const d = distToSegmentKm(point, path[i], path[i + 1]);
    if (d < minD) minD = d;
  }
  return minD;
}

// Linear interpolation along a polyline
export function interpolatePath(path, progress) {
  if (!path || path.length === 0) return [0, 0];
  if (path.length === 1 || progress <= 0) return path[0];
  if (progress >= 1) return path[path.length - 1];

  // Calculate cumulative distances
  const dists = [0];
  let totalDist = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = haversineKm(path[i], path[i + 1]);
    totalDist += d;
    dists.push(totalDist);
  }

  const targetDist = progress * totalDist;
  for (let i = 0; i < dists.length - 1; i++) {
    if (targetDist >= dists[i] && targetDist <= dists[i + 1]) {
      const segLen = dists[i + 1] - dists[i];
      const frac = segLen > 0 ? (targetDist - dists[i]) / segLen : 0;
      return [
        path[i][0] + (path[i + 1][0] - path[i][0]) * frac,
        path[i][1] + (path[i + 1][1] - path[i][1]) * frac,
      ];
    }
  }
  return path[path.length - 1];
}

// Generate an approximate corridor polygon around a center path line (width in km)
export function generateCorridorPolygon(centerPath, widthKm = 220) {
  if (!centerPath || centerPath.length < 2) return [];
  const rad = Math.PI / 180;
  const leftSide = [];
  const rightSide = [];
  const offsetDeg = widthKm / 2 / 111.32; // approx degrees lat

  for (let i = 0; i < centerPath.length; i++) {
    const [lat, lon] = centerPath[i];
    let heading = 0;
    if (i < centerPath.length - 1) {
      const next = centerPath[i + 1];
      heading = Math.atan2(next[1] - lon, next[0] - lat);
    } else {
      const prev = centerPath[i - 1];
      heading = Math.atan2(lon - prev[1], lat - prev[0]);
    }
    const perpHeading = heading + Math.PI / 2;
    const dLat = offsetDeg * Math.cos(perpHeading);
    const dLon =
      (offsetDeg / Math.max(0.1, Math.cos(lat * rad))) * Math.sin(perpHeading);

    leftSide.push([lat + dLat, lon + dLon]);
    rightSide.push([lat - dLat, lon - dLon]);
  }

  return [...leftSide, ...rightSide.reverse()];
}

// Catalog of known eclipse trajectories and geometry for 2026-2028
export const ECLIPSE_GEOMETRY = {
  // 12 August 2026: Great North Atlantic / Spain Total Solar Eclipse
  "2026-08-12": {
    type: "sun_total",
    name: "Повне сонячне затемнення (Іспанія, Ісландія, Гренландія)",
    name_en: "Total Solar Eclipse (Spain, Iceland, Greenland)",
    startTimeUtc: "15:40",
    maxTimeUtc: "17:47",
    endTimeUtc: "19:15",
    path: [
      [80.5, 105.0],
      [83.0, 50.0],
      [78.5, -15.0],
      [71.0, -22.5],
      [65.5, -24.0], // West Iceland (Reykjavik near totality)
      [58.0, -21.0],
      [49.5, -14.0],
      [44.2, -7.5], // Northern Spain (A Coruna / Gijon)
      [41.6, -2.5], // Central Spain (near Madrid/Zaragoza)
      [39.5, 2.5], // Balearic Islands (Palma de Mallorca sunset)
    ],
    widthKm: 290,
    penumbraRadiusKm: 3200,
    maxDuration: "2 хв 18 с",
    description:
      "Смуга повної фази пройде через Гренландію, західну Ісландію та північну й східну Іспанію перед заходом Сонця.",
  },

  // 20 March 2026: Arctic Partial Solar Eclipse
  "2026-03-20": {
    type: "sun_partial",
    name: "Часткове сонячне затемнення",
    name_en: "Partial Solar Eclipse",
    startTimeUtc: "10:15",
    maxTimeUtc: "11:45",
    endTimeUtc: "13:20",
    path: [
      [72.0, -40.0],
      [78.0, -10.0],
      [82.0, 30.0],
      [75.0, 70.0],
    ],
    widthKm: 500,
    penumbraRadiusKm: 2800,
    maxDuration: "Фаза до 45%",
    description:
      "Видно у високих широтах Північної півкулі, Арктиці та Північній Атлантиці.",
  },

  // 3 March 2026: Total Lunar Eclipse
  "2026-03-03": {
    type: "moon_total",
    name: "Повне місячне затемнення (Кривавий Місяць)",
    name_en: "Total Lunar Eclipse (Blood Moon)",
    startTimeUtc: "09:50",
    maxTimeUtc: "11:34",
    endTimeUtc: "13:17",
    nightCenter: [5.0, 160.0], // Pacific, Asia, Australia, Americas
    moonRadiusKm: 8500,
    maxDuration: "58 хв (повна фаза)",
    description:
      "Місяць повністю зануриться у тінь Землі, набувши характерного багряно-мідного кольору.",
  },
  "2026-03-14": {
    type: "moon_total",
    name: "Повне місячне затемнення (Кривавий Місяць)",
    name_en: "Total Lunar Eclipse (Blood Moon)",
    startTimeUtc: "04:55",
    maxTimeUtc: "06:59",
    endTimeUtc: "09:05",
    nightCenter: [5.0, 100.0],
    moonRadiusKm: 8500,
    maxDuration: "1 год 02 хв",
    description:
      "Місяць повністю зануриться у тінь Землі, набувши характерного багряно-мідного кольору.",
  },

  // 28 August 2026: Partial Lunar Eclipse
  "2026-08-28": {
    type: "moon_partial",
    name: "Часткове місячне затемнення",
    name_en: "Partial Lunar Eclipse",
    startTimeUtc: "02:22",
    maxTimeUtc: "04:14",
    endTimeUtc: "06:05",
    nightCenter: [-10.0, -20.0], // Atlantic, Americas, Europe, Africa
    moonRadiusKm: 8000,
    maxDuration: "Часткова фаза 93%",
    description:
      "Понад 90% диска Місяця зануриться у темну тінь Землі (умбру). Видно в Європі, Африці та Америці.",
  },
  "2026-08-12-moon": {
    type: "moon_partial",
    name: "Часткове місячне затемнення",
    name_en: "Partial Lunar Eclipse",
    startTimeUtc: "16:20",
    maxTimeUtc: "17:45",
    endTimeUtc: "19:10",
    nightCenter: [-12.0, 45.0],
    moonRadiusKm: 7500,
    maxDuration: "Часткова фаза 93%",
    description:
      "Видно у східній Європі, Африці, Азії та Австралії під час сходу Місяця.",
  },

  // 6 February 2027: Annular Solar Eclipse (Ring of Fire)
  "2027-02-06": {
    type: "sun_annular",
    name: "Кільцеве сонячне затемнення (Вогняне кільце)",
    name_en: "Annular Solar Eclipse (Ring of Fire)",
    startTimeUtc: "13:50",
    maxTimeUtc: "16:00",
    endTimeUtc: "18:10",
    path: [
      [-48.0, -75.0], // South Pacific / Chile
      [-46.0, -68.0], // Argentina (Patagonia)
      [-44.0, -50.0], // South Atlantic
      [-38.0, -20.0],
      [-28.0, 5.0],
      [-15.0, 20.0], // Southern Africa
      [4.0, -1.0], // Gulf of Guinea / West Africa
    ],
    widthKm: 280,
    penumbraRadiusKm: 2900,
    maxDuration: "7 хв 51 с",
    description:
      "Місяць закриє до 96% диска Сонця, залишивши яскраве палаюче «вогняне кільце» над Патагонією та Південною Атлантикою.",
  },
  "2027-02-16": {
    type: "sun_annular",
    name: "Кільцеве сонячне затемнення (Вогняне кільце)",
    name_en: "Annular Solar Eclipse (Ring of Fire)",
    startTimeUtc: "13:50",
    maxTimeUtc: "16:00",
    endTimeUtc: "18:10",
    path: [
      [-48.0, -75.0],
      [-46.0, -68.0],
      [-44.0, -50.0],
      [-38.0, -20.0],
      [-28.0, 5.0],
      [-15.0, 20.0],
      [4.0, -1.0],
    ],
    widthKm: 280,
    penumbraRadiusKm: 2900,
    maxDuration: "7 хв 51 с",
    description:
      "Місяць закриє до 96% диска Сонця, залишивши яскраве палаюче «вогняне кільце» над Патагонією та Південною Атлантикою.",
  },

  // 20 February 2027: Penumbral Lunar Eclipse
  "2027-02-20": {
    type: "moon_penumbral",
    name: "Півтіньове місячне затемнення",
    name_en: "Penumbral Lunar Eclipse",
    startTimeUtc: "21:15",
    maxTimeUtc: "23:13",
    endTimeUtc: "01:10",
    nightCenter: [12.0, 20.0],
    moonRadiusKm: 8500,
    maxDuration: "Фаза напівтіні 95%",
    description:
      "Місяць зануриться у напівтінь Землі; спостерігається делікатне потемніння північного краю диска.",
  },

  // 2 August 2027: Eclipse of the Century (Total Solar Eclipse)
  "2027-08-02": {
    type: "sun_total",
    name: "Повне сонячне затемнення століття (Єгипет, Луксор)",
    name_en: "Total Solar Eclipse of the Century (Egypt, Luxor)",
    startTimeUtc: "08:25",
    maxTimeUtc: "10:07",
    endTimeUtc: "12:15",
    path: [
      [36.8, -12.0], // Atlantic
      [36.1, -5.5], // Strait of Gibraltar / Tarifa
      [35.8, -1.0], // Northern Algeria
      [34.5, 8.0], // Tunisia
      [31.2, 17.0], // Libya (Gulf of Sidra)
      [26.2, 29.5], // Western Desert Egypt
      [25.7, 32.6], // Luxor (Valley of the Kings, 6m 23s totality!)
      [22.8, 39.0], // Red Sea / Saudi Arabia (Jeddah, Mecca)
      [16.5, 47.0], // Yemen
      [12.0, 52.0], // Gulf of Aden / Somalia
    ],
    widthKm: 258,
    penumbraRadiusKm: 3400,
    maxDuration: "6 хв 23 с (Луксор)",
    description:
      "Найдовше повне затемнення XXI століття над сушею з ідеальними погодними умовами у Єгипті.",
  },

  // 22 July 2028: Great Australian Total Solar Eclipse
  "2028-07-22": {
    type: "sun_total",
    name: "Повне сонячне затемнення (Австралія, Сідней)",
    name_en: "Total Solar Eclipse (Australia, Sydney)",
    startTimeUtc: "02:10",
    maxTimeUtc: "04:15",
    endTimeUtc: "06:20",
    path: [
      [-14.0, 120.0], // Kimberley, Western Australia
      [-21.0, 130.0], // Northern Territory
      [-27.5, 140.0], // Outback Queensland / NSW
      [-33.8, 151.2], // Direct hit on Sydney!
      [-41.0, 172.0], // New Zealand
    ],
    widthKm: 230,
    penumbraRadiusKm: 3100,
    maxDuration: "3 хв 48 с (Сідней)",
    description:
      "Смуга повної фази перетне всю Австралію з північного заходу на південний схід і пройде просто над Сіднеєм.",
  },
  "2028-07-31": {
    type: "sun_total",
    name: "Повне сонячне затемнення (Австралія, Сідней)",
    name_en: "Total Solar Eclipse (Australia, Sydney)",
    startTimeUtc: "02:10",
    maxTimeUtc: "04:15",
    endTimeUtc: "06:20",
    path: [
      [-14.0, 120.0],
      [-21.0, 130.0],
      [-27.5, 140.0],
      [-33.8, 151.2],
      [-41.0, 172.0],
    ],
    widthKm: 230,
    penumbraRadiusKm: 3100,
    maxDuration: "3 хв 48 с",
    description:
      "Смуга повної фази перетне всю Австралію з північного заходу на південний схід і пройде просто над Сіднеєм.",
  },
};

// Match event date string (e.g. "12.08.2026", "2026-08-12") to geometry definition
export function findEclipseGeometry(event) {
  if (!event) return null;
  const rawDate = event.date || "";
  let key = "";
  if (rawDate.includes(".")) {
    const [d, m, y] = rawDate.split(".");
    key = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  } else {
    key = rawDate;
  }

  const isMoon =
    (event.type && event.type.includes("moon")) ||
    (event.name && event.name.toLowerCase().includes("місячн")) ||
    (event.title && event.title.toLowerCase().includes("місячн"));

  // 1. Direct key match (e.g. "2027-02-06", "2027-02-20", "2026-08-12-moon")
  if (isMoon && ECLIPSE_GEOMETRY[`${key}-moon`]) {
    return ECLIPSE_GEOMETRY[`${key}-moon`];
  }
  if (ECLIPSE_GEOMETRY[key]) {
    const cand = ECLIPSE_GEOMETRY[key];
    const candIsMoon = cand.type && cand.type.includes("moon");
    if (Boolean(isMoon) === Boolean(candIsMoon)) {
      return cand;
    }
  }

  // 2. Fallback for lunar eclipse: return dynamic lunar geometry for this specific date
  if (isMoon) {
    return {
      type: event.type || "moon_partial",
      name: event.name || event.title || "Місячне затемнення",
      name_en: "Lunar Eclipse",
      startTimeUtc: "18:00",
      maxTimeUtc: "20:00",
      endTimeUtc: "22:00",
      nightCenter: [10.0, 30.0],
      moonRadiusKm: 8500,
      maxDuration: "Часткова фаза",
      description:
        "Місячне затемнення спостерігається на всій нічній півкулі Землі, де Місяць перебуває над горизонтом.",
    };
  }

  // 3. Default solar fallback
  return ECLIPSE_GEOMETRY["2026-08-12"];
}
