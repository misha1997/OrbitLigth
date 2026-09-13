import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import L from "leaflet";
import { useLoc, locLabel, DEFAULT_LOC } from "../../context/LocationContext";
import { CARTO_KEY } from "../../lib/constants";
import { getSubsolarPoint, getNightPolygon } from "../../lib/terminator";
import {
  findEclipseGeometry,
  distToPathKm,
  interpolatePath,
  generateCorridorPolygon,
  haversineKm,
} from "../../lib/eclipseGeometry";

const BASE_TILE_URL = `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`;
const NOAA_GLOBAL_CLOUDS_WMS = "https://nowcoast.noaa.gov/geoserver/wms";

export default function EclipseMap({ events = [], onTriggerFullscreen }) {
  const { loc } = useLoc();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Layer refs for dynamic updates
  const terminatorLayerRef = useRef(null);
  const sunMarkerRef = useRef(null);
  const cloudsLayerRef = useRef(null);
  const eclipseLayersRef = useRef([]);
  const movingShadowMarkerRef = useRef(null);
  const observerMarkerRef = useRef(null);

  // Available eclipses from data + curated catalog for full exploration
  const eclipseEvents = useMemo(() => {
    const canonical = [
      {
        kind: "eclipse",
        date: "03.03.2026",
        name: "Повне місячне затемнення (Кривавий Місяць)",
        type: "moon_total",
        visibility: "Азія, Австралія, Тихий океан, Америка",
        emoji: "🌑",
      },
      {
        kind: "eclipse",
        date: "12.08.2026",
        name: "Повне сонячне затемнення (Іспанія, Ісландія)",
        type: "sun_total",
        visibility: "Гренландія, Ісландія, Іспанія",
        emoji: "☀️",
      },
      {
        kind: "eclipse",
        date: "06.02.2027",
        name: "Кільцеве сонячне затемнення (Вогняне кільце)",
        type: "sun_annular",
        visibility: "Чилі, Аргентина, Атлантика, Зх. Африка",
        emoji: "💍",
      },
      {
        kind: "eclipse",
        date: "20.02.2027",
        name: "Півтіньове місячне затемнення",
        type: "moon_penumbral",
        visibility: "Америка, Європа, Африка, Азія",
        emoji: "🌖",
      },
      {
        kind: "eclipse",
        date: "02.08.2027",
        name: "Повне сонячне затемнення століття (Єгипет, Луксор)",
        type: "sun_total",
        visibility: "Іспанія, Єгипет, Саудівська Аравія",
        emoji: "☀️",
      },
      {
        kind: "eclipse",
        date: "22.07.2028",
        name: "Повне сонячне затемнення (Австралія, Сідней)",
        type: "sun_total",
        visibility: "Австралія, Нова Зеландія",
        emoji: "☀️",
      },
    ];

    const canonMap = new Map(canonical.map((c) => [c.date, c]));
    const list = (events || []).filter((e) => e.kind === "eclipse");
    const merged = [];
    const seen = new Set();

    // Add API events, overriding any stale/misattributed entries with verified canonical info
    for (const ev of list) {
      const entry = canonMap.has(ev.date) ? canonMap.get(ev.date) : ev;
      if (!seen.has(entry.date)) {
        seen.add(entry.date);
        merged.push(entry);
      }
    }
    // Add any remaining canonical events
    for (const c of canonical) {
      if (!seen.has(c.date)) {
        seen.add(c.date);
        merged.push(c);
      }
    }

    // Sort chronologically
    merged.sort((a, b) => {
      const p1 = (a.date || "").split(".");
      const p2 = (b.date || "").split(".");
      if (p1.length === 3 && p2.length === 3) {
        return new Date(`${p1[2]}-${p1[1]}-${p1[0]}`) - new Date(`${p2[2]}-${p2[1]}-${p2[0]}`);
      }
      return 0;
    });

    return merged;
  }, [events]);

  const [selectedEclipseIndex, setSelectedEclipseIndex] = useState(0);
  const selectedEvent = eclipseEvents[selectedEclipseIndex] || eclipseEvents[0] || null;
  const geometry = useMemo(() => findEclipseGeometry(selectedEvent), [selectedEvent]);

  // Interactive controls
  const [showTerminator, setShowTerminator] = useState(true);
  const [showClouds, setShowClouds] = useState(false);
  const [localWeather, setLocalWeather] = useState(null);
  const [progress, setProgress] = useState(0.5); // 0..1 timeline
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Invalidate Leaflet map size on mount and resize
  useEffect(() => {
    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener("resize", handleResize);
    const timer = setTimeout(handleResize, 100);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, []);

  // Observer coordinates
  const observerCoords = useMemo(() => {
    return [
      loc && loc.lat != null ? loc.lat : DEFAULT_LOC.lat,
      loc && loc.lon != null ? loc.lon : DEFAULT_LOC.lon,
    ];
  }, [loc]);

  // Fetch real-time local cloud cover and weather conditions for observer location
  useEffect(() => {
    let active = true;
    const [lat, lon] = observerCoords;
    if (lat == null || lon == null) return;

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=cloud_cover,weather_code,temperature_2m`
    )
      .then((res) => {
        if (!res.ok) throw new Error("Open-Meteo HTTP " + res.status);
        return res.json();
      })
      .then((data) => {
        if (!active || !data?.current) return;
        const cc = data.current.cloud_cover ?? 0;
        const temp = Math.round(data.current.temperature_2m ?? 0);
        let quality = "Чисте небо (ідеально)";
        let isGood = true;
        if (cc > 75) {
          quality = "Суцільна хмарність";
          isGood = false;
        } else if (cc > 35) {
          quality = "Мінлива хмарність";
          isGood = true;
        }
        setLocalWeather({
          cloudCover: cc,
          temp,
          quality,
          isGood,
        });
      })
      .catch(() => {
        // Silently ignore network failures
      });

    return () => {
      active = false;
    };
  }, [observerCoords]);

  // Compute visibility and distance from observer to eclipse
  const visibilityReport = useMemo(() => {
    if (!geometry) {
      return { status: "Дані уточнюються", distance: null, coverage: "—", isMoon: false };
    }

    if (geometry.type && geometry.type.includes("moon")) {
      const center = geometry.nightCenter || [10, 50];
      const dist = haversineKm(observerCoords, center);
      const isVisible = dist <= (geometry.moonRadiusKm || 8500);
      return {
        isMoon: true,
        status: isVisible ? "Видимо на нічному небі" : "Місяць під горизонтом",
        distance: null, // Lunar eclipses cover the whole night side, no narrow corridor
        coverage:
          geometry.type === "moon_total"
            ? "100% (Повна тінь)"
            : geometry.type === "moon_penumbral"
            ? "Півтіньове (напівтінь)"
            : "Часткова тінь",
        isOptimal: isVisible,
      };
    }

    // Solar eclipse
    if (geometry.path && geometry.path.length > 0) {
      const dist = Math.round(distToPathKm(observerCoords, geometry.path));
      const halfWidth = (geometry.widthKm || 250) / 2;
      const penumbra = geometry.penumbraRadiusKm || 3000;

      if (dist <= halfWidth) {
        return {
          isMoon: false,
          status: geometry.type === "sun_annular" ? "В смузі «вогняного кільця»!" : "В смузі повної фази!",
          distance: dist,
          coverage: geometry.type === "sun_annular" ? "Кільцеве (до 96%)" : "100% (Повна фаза)",
          isOptimal: true,
        };
      } else if (dist <= penumbra) {
        const pct = Math.round(Math.max(10, (1 - (dist - halfWidth) / penumbra) * 90));
        return {
          isMoon: false,
          status: `Часткова фаза (~${pct}%)`,
          distance: dist,
          coverage: `~${pct}% Сонця закрито`,
          isOptimal: pct > 50,
        };
      } else {
        return {
          isMoon: false,
          status: "Поза зоною видимості",
          distance: dist,
          coverage: "0%",
          isOptimal: false,
        };
      }
    }

    return { isMoon: false, status: "Дані формуються", distance: null, coverage: "—" };
  }, [geometry, observerCoords]);

  const onTriggerFullscreenRef = useRef(onTriggerFullscreen);
  onTriggerFullscreenRef.current = onTriggerFullscreen;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [30, 0],
      zoom: 2,
      minZoom: 1.5,
      maxZoom: 9,
      zoomControl: true,
      attributionControl: false,
      worldCopyJump: true,
    });

    L.tileLayer(BASE_TILE_URL, {
      subdomains: "abcd",
      maxZoom: 8,
    }).addTo(map);

    // Fullscreen control positioned directly beneath the +- zoom controls
    if (onTriggerFullscreenRef.current) {
      const FsControl = L.Control.extend({
        options: { position: "topleft" },
        onAdd: function () {
          const container = L.DomUtil.create("div", "leaflet-bar leaflet-control leaflet-control-fs");
          const btn = L.DomUtil.create("a", "leaflet-control-fs-btn", container);
          btn.href = "#";
          btn.title = "На весь екран";
          btn.setAttribute("role", "button");
          btn.setAttribute("aria-label", "На весь екран");
          btn.innerHTML = `<span class="fs-icon">⛶</span>`;

          L.DomEvent.disableClickPropagation(container);
          L.DomEvent.disableScrollPropagation(container);
          L.DomEvent.on(btn, "click", (e) => {
            L.DomEvent.stop(e);
            onTriggerFullscreenRef.current?.();
          });

          return container;
        },
      });

      const fsControlInstance = new FsControl();
      fsControlInstance.addTo(map);
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Observer Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (observerMarkerRef.current) {
      map.removeLayer(observerMarkerRef.current);
    }

    const obsIcon = L.divIcon({
      className: "observer-map-marker",
      html: `<div class="observer-pin-pulse"><div class="observer-pin-core"></div></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const marker = L.marker(observerCoords, { icon: obsIcon, zIndexOffset: 1000 }).addTo(map);
    const label = locLabel(loc);
    marker.bindPopup(`
      <div class="eclipse-popup-inner">
        <h4>📍 Ваша локація</h4>
        <p><strong>${label}</strong></p>
        <p>Координати: ${observerCoords[0].toFixed(2)}°, ${observerCoords[1].toFixed(2)}°</p>
        <hr/>
        <p class="popup-status ${visibilityReport.isOptimal ? 'highlight' : ''}">${visibilityReport.status}</p>
        ${visibilityReport.distance ? `<p>До смуги затемнення: <b>${visibilityReport.distance} км</b></p>` : ''}
      </div>
    `);

    observerMarkerRef.current = marker;
  }, [observerCoords, loc, visibilityReport]);

  // Clouds layer toggle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (showClouds) {
      if (cloudsLayerRef.current) {
        map.removeLayer(cloudsLayerRef.current);
      }

      // Real-time Global Satellite Infrared Mosaic (NOAA nowCOAST):
      // Seamless 360-degree coverage across the entire globe without cuts, seams, or radar speckles.
      cloudsLayerRef.current = L.tileLayer.wms(NOAA_GLOBAL_CLOUDS_WMS, {
        layers: "satellite:global_longwave_imagery_mosaic",
        format: "image/png",
        transparent: true,
        opacity: 0.85,
        className: "eclipse-cloud-tiles",
        zIndex: 500,
        maxZoom: 9,
      }).addTo(map);
    } else {
      if (cloudsLayerRef.current) {
        map.removeLayer(cloudsLayerRef.current);
        cloudsLayerRef.current = null;
      }
    }
  }, [showClouds]);

  // Day/Night Terminator calculation with simulated time offset
  const updateTerminator = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!showTerminator) {
      if (terminatorLayerRef.current) {
        map.removeLayer(terminatorLayerRef.current);
        terminatorLayerRef.current = null;
      }
      if (sunMarkerRef.current) {
        map.removeLayer(sunMarkerRef.current);
        sunMarkerRef.current = null;
      }
      return;
    }

    // Offset the current date according to scrubber progress
    const baseDate = new Date();
    const simulatedDate = new Date(baseDate.getTime() + (progress - 0.5) * 8 * 3600 * 1000);

    const sun = getSubsolarPoint(simulatedDate);
    const nightRing = getNightPolygon(simulatedDate);

    if (terminatorLayerRef.current) {
      map.removeLayer(terminatorLayerRef.current);
    }
    terminatorLayerRef.current = L.polygon(nightRing, {
      color: "transparent",
      fillColor: "#05060f",
      fillOpacity: 0.52,
      stroke: false,
      interactive: false,
    }).addTo(map);

    const sunIcon = L.divIcon({
      className: "map-sun-marker",
      html: '<div style="width:16px;height:16px;border-radius:50%;background:#FFD700;box-shadow:0 0 16px 4px rgba(255,215,0,0.85)"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    if (!sunMarkerRef.current) {
      sunMarkerRef.current = L.marker([sun.lat, sun.lon], { icon: sunIcon, interactive: false }).addTo(map);
    } else {
      sunMarkerRef.current.setLatLng([sun.lat, sun.lon]);
    }
  }, [showTerminator, progress]);

  useEffect(() => {
    updateTerminator();
  }, [updateTerminator]);

  // Render Eclipse Paths & Corridors
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous eclipse layers
    eclipseLayersRef.current.forEach((l) => map.removeLayer(l));
    eclipseLayersRef.current = [];

    if (!geometry) return;

    if (geometry.type.includes("sun") && geometry.path) {
      // 1. Broad Penumbra band (delicate golden aura of partial eclipse)
      const penumbraPoly = generateCorridorPolygon(geometry.path, (geometry.penumbraRadiusKm || 3000) * 1.5);
      if (penumbraPoly.length > 0) {
        const penumbraLayer = L.polygon(penumbraPoly, {
          color: "rgba(255, 215, 0, 0.15)",
          weight: 1,
          dashArray: "4, 8",
          fillColor: "#e8b94d",
          fillOpacity: 0.04,
          interactive: false,
        }).addTo(map);
        eclipseLayersRef.current.push(penumbraLayer);
      }

      // 2. Soft Corona Glow Edge around totality (solar atmosphere glow)
      const glowPoly = generateCorridorPolygon(geometry.path, (geometry.widthKm || 250) * 1.4);
      if (glowPoly.length > 0) {
        const glowLayer = L.polygon(glowPoly, {
          color: "transparent",
          fillColor: "#FF6B4A",
          fillOpacity: 0.1,
          interactive: false,
        }).addTo(map);
        eclipseLayersRef.current.push(glowLayer);
      }

      // 3. Totality corridor (celestial shadow ribbon with thin golden corona rim)
      const corridorPoly = generateCorridorPolygon(geometry.path, geometry.widthKm || 250);
      if (corridorPoly.length > 0) {
        const corridorLayer = L.polygon(corridorPoly, {
          color: "rgba(255, 215, 0, 0.6)",
          weight: 1,
          fillColor: "#0b0c1e",
          fillOpacity: 0.55,
        }).addTo(map);
        corridorLayer.bindPopup(`
          <div class="eclipse-popup-inner">
            <h4 style="color:#ffd700">Смуга повної фази затемнення</h4>
            <p>Ширина місячної тіні: <b>~${geometry.widthKm || 250} км</b></p>
            <p>Тривалість повної темряви: <b>${geometry.maxDuration || "2-6 хв"}</b></p>
            <p style="color:var(--text-dim);font-size:11px">У межах цієї смуги Сонце буде повністю закрите Місяцем.</p>
          </div>
        `);
        eclipseLayersRef.current.push(corridorLayer);
      }

      // 4. Center Line — fine continuous cosmic trajectory beam (NOT dashed road lines)
      const centerLine = L.polyline(geometry.path, {
        color: "#ffd700",
        weight: 1.5,
        opacity: 0.75,
      }).addTo(map);
      eclipseLayersRef.current.push(centerLine);

      // 5. Waypoints with astronomical timestamps (NASA ephemeris style)
      if (geometry.path && geometry.path.length >= 3) {
        const step = Math.max(1, Math.floor(geometry.path.length / 4));
        for (let idx = 0; idx < geometry.path.length; idx += step) {
          const pt = geometry.path[idx];
          const frac = idx / (geometry.path.length - 1);
          const sH = parseInt((geometry.startTimeUtc || "15:30").split(":")[0], 10);
          const sM = parseInt((geometry.startTimeUtc || "15:30").split(":")[1], 10);
          const eH = parseInt((geometry.endTimeUtc || "19:00").split(":")[0], 10);
          const eM = parseInt((geometry.endTimeUtc || "19:00").split(":")[1], 10);
          const totalMin = (eH * 60 + eM) - (sH * 60 + sM);
          const curMin = (sH * 60 + sM) + Math.round(frac * totalMin);
          const hStr = String(Math.floor(curMin / 60)).padStart(2, "0");
          const mStr = String(curMin % 60).padStart(2, "0");
          const timeLabel = `${hStr}:${mStr} UTC`;

          const nodeMarker = L.circleMarker(pt, {
            radius: 3,
            color: "#ffd700",
            fillColor: "#ffffff",
            fillOpacity: 1,
            weight: 1,
          }).addTo(map);
          nodeMarker.bindTooltip(timeLabel, {
            permanent: true,
            direction: "top",
            className: "eclipse-waypoint-tooltip",
            offset: [0, -4],
          });
          eclipseLayersRef.current.push(nodeMarker);
        }
      }

      // Fit map to path
      const bounds = L.latLngBounds(geometry.path);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 4 });
    } else if (geometry.type.includes("moon")) {
      const center = geometry.nightCenter || [10, 30];

      // Subtle celestial beacon at the Sub-Lunar zenith point (where Moon is overhead at max eclipse)
      const subLunarIcon = L.divIcon({
        className: "sublunar-zenith-marker",
        html: `<div class="sublunar-glow-ring"><div class="sublunar-core">🌕</div></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const zenithMarker = L.marker(center, { icon: subLunarIcon, zIndexOffset: 950 }).addTo(map);
      zenithMarker.bindPopup(`
        <div class="eclipse-popup-inner">
          <h4 style="color:#ffd700">🌕 ${geometry.name}</h4>
          <p>${geometry.description}</p>
          <p>Місяць у зеніті під час максимуму: <b>${center[0]}°, ${center[1]}°</b></p>
          <p>Тривалість: <b>${geometry.maxDuration}</b></p>
          <hr/>
          <p style="color:#4fd1c5;font-size:11px">Затемнення спостерігається на всій нічній півкулі Землі (де Сонце під горизонтом).</p>
        </div>
      `);
      eclipseLayersRef.current.push(zenithMarker);

      map.setView(center, 2);
    }
  }, [geometry]);

  // Moving shadow marker animation along solar eclipse trajectory
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !geometry) return;

    // Moving shadow marker is only for solar eclipses with a totality path
    if (!geometry.path || geometry.path.length === 0 || geometry.type.includes("moon")) {
      if (movingShadowMarkerRef.current) {
        map.removeLayer(movingShadowMarkerRef.current);
        movingShadowMarkerRef.current = null;
      }
      return;
    }

    const currentPos = interpolatePath(geometry.path, progress);

    if (!movingShadowMarkerRef.current) {
      const shadowIcon = L.divIcon({
        className: "eclipse-shadow-marker",
        html: `<div class="shadow-umbra-core"><span class="shadow-umbra-pulse"></span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      movingShadowMarkerRef.current = L.marker(currentPos, {
        icon: shadowIcon,
        zIndexOffset: 900,
      }).addTo(map);
    } else {
      movingShadowMarkerRef.current.setLatLng(currentPos);
    }
  }, [geometry, progress]);

  // Animation player loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 1) return 0;
        return Math.min(1, prev + 0.008 * speed);
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  // Handlers
  const handlePanToUser = () => {
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo(observerCoords, 5, { duration: 1.2 });
    }
  };

  const handlePanToEclipse = () => {
    const map = mapInstanceRef.current;
    if (!map || !geometry) return;
    if (geometry.path && geometry.path.length > 0) {
      map.fitBounds(L.latLngBounds(geometry.path), { padding: [50, 50], maxZoom: 4 });
    } else if (geometry.nightCenter) {
      map.setView(geometry.nightCenter, 2);
    }
  };

  return (
    <div className="eclipse-map-interactive-container">
      {/* Top Header Controls */}
      <div className="eclipse-map-toolbar">
        <div className="eclipse-map-select-group">
          <label htmlFor="eclipse-select">Обране затемнення:</label>
          <select
            id="eclipse-select"
            value={selectedEclipseIndex}
            onChange={(e) => {
              setSelectedEclipseIndex(Number(e.target.value));
              setProgress(0.5);
              setIsPlaying(false);
            }}
          >
            {eclipseEvents.map((ev, idx) => (
              <option key={idx} value={idx}>
                {ev.emoji || "🌑"} {ev.date} — {ev.name || ev.title}
              </option>
            ))}
          </select>
        </div>

        <div className="eclipse-map-toggle-buttons">
          <button
            type="button"
            className={`map-tool-btn ${showTerminator ? "active" : ""}`}
            onClick={() => setShowTerminator(!showTerminator)}
            title="Оверлей дня і ночі"
          >
            🌓 День / Ніч
          </button>
          <button
            type="button"
            className={`map-tool-btn ${showClouds ? "active" : ""}`}
            onClick={() => setShowClouds(!showClouds)}
            title="Шар хмарності"
          >
            ☁️ Хмари
          </button>
          <button
            type="button"
            className="map-tool-btn"
            onClick={handlePanToUser}
            title="Показати мою локацію"
          >
            📍 Де я
          </button>
          {geometry && (geometry.path || geometry.nightCenter) && (
            <button
              type="button"
              className="map-tool-btn"
              onClick={handlePanToEclipse}
              title={geometry.path ? "Центрувати на смузі затемнення" : "Центрувати на зоні видимості"}
            >
              {geometry.path ? "🎯 Смуга" : "🎯 Зона"}
            </button>
          )}
        </div>
      </div>

      {/* Main Map Box */}
      <div className="eclipse-map-viewport-wrapper">
        <div ref={mapContainerRef} className="eclipse-map-canvas" />

        {/* Floating Observer Visibility Badge */}
        <div className="eclipse-observer-card">
          <div className="observer-card-badge">
            <span className="dot" />
            <strong>Аналіз спостереження</strong>
          </div>
          <div className="observer-card-row">
            <span className="lbl">Локація:</span>
            <span className="val">{locLabel(loc)}</span>
          </div>
          <div className="observer-card-row">
            <span className="lbl">Видимість:</span>
            <span className={`val status-tag ${visibilityReport.isOptimal ? "good" : ""}`}>
              {visibilityReport.status}
            </span>
          </div>
          {localWeather && (
            <div className="observer-card-row">
              <span className="lbl">Хмарність (зараз):</span>
              <span className={`val status-tag ${localWeather.isGood ? "good" : ""}`}>
                ☁️ {localWeather.cloudCover}% • {localWeather.temp > 0 ? `+${localWeather.temp}` : localWeather.temp}°C ({localWeather.quality})
              </span>
            </div>
          )}
          {visibilityReport.distance != null && !geometry?.type?.includes("moon") && (
            <div className="observer-card-row">
              <span className="lbl">
                {geometry?.type === "sun_annular" ? "До кільцевої смуги:" : "До смуги повної фази:"}
              </span>
              <span className="val">{visibilityReport.distance} км</span>
            </div>
          )}
          {geometry?.type?.includes("moon") && (
            <div className="observer-card-row">
              <span className="lbl">Зона огляду:</span>
              <span className="val highlight">Нічна півкуля</span>
            </div>
          )}
          {geometry && (
            <div className="observer-card-row">
              <span className="lbl">Тривалість максимуму:</span>
              <span className="val highlight">{geometry.maxDuration || "—"}</span>
            </div>
          )}
          <p className="observer-card-tip">
            {geometry?.description || "Клікніть на зону затемнення для деталей."}
          </p>
        </div>

        {/* Bottom Legend */}
        <div className="eclipse-map-legend">
          {geometry?.type?.includes("moon") ? (
            <>
              <span><span className="legend-swatch" style={{ background: "#ff6b4a", boxShadow: "0 0 6px #ff6b4a" }} /> Зона видимості Місяця</span>
              <span><span className="legend-swatch night" /> Нічна півкуля</span>
              <span><span className="legend-swatch observer" /> Ваша локація</span>
            </>
          ) : (
            <>
              <span>
                <span className="legend-swatch gold" />
                {geometry?.type === "sun_annular" ? " Смуга «вогняного кільця»" : " Смуга повної фази"}
              </span>
              <span><span className="legend-swatch penumbra" /> Часткова фаза</span>
              <span><span className="legend-swatch night" /> Нічна зона</span>
              <span><span className="legend-swatch observer" /> Ваша локація</span>
            </>
          )}
        </div>
      </div>

      {/* Bottom Time Scrubber / Simulation Controller */}
      <div className="eclipse-time-scrubber">
        <div className="scrubber-left">
          <button
            type="button"
            className="play-pause-btn"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "Пауза" : "Запустити рух тіні"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <div className="scrubber-time-info">
            <span className="time-lbl">Симуляція руху тіні:</span>
            <strong className="time-val">
              {geometry?.startTimeUtc || "10:00"} → {geometry?.endTimeUtc || "18:00"} UTC
            </strong>
          </div>
        </div>

        <div className="scrubber-slider-container">
          <input
            type="range"
            min="0"
            max="1"
            step="0.005"
            value={progress}
            onChange={(e) => {
              setProgress(parseFloat(e.target.value));
              setIsPlaying(false);
            }}
            className="scrubber-range-slider"
          />
          <div className="scrubber-ticks">
            <span>Початок фази</span>
            <span>Максимум ({geometry?.maxTimeUtc || "14:00"} UTC)</span>
            <span>Завершення</span>
          </div>
        </div>

        <div className="scrubber-right">
          <button
            type="button"
            className={`speed-pill ${speed === 1 ? "active" : ""}`}
            onClick={() => setSpeed(1)}
          >
            1x
          </button>
          <button
            type="button"
            className={`speed-pill ${speed === 2 ? "active" : ""}`}
            onClick={() => setSpeed(2)}
          >
            2x
          </button>
          <button
            type="button"
            className={`speed-pill ${speed === 5 ? "active" : ""}`}
            onClick={() => setSpeed(5)}
          >
            5x
          </button>
        </div>
      </div>
    </div>
  );
}
