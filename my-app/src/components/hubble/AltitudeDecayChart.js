// Hubble "altitude decay" chart for the Hubble page's future/decay section:
// curated historical altitude milestones (services/hubble_decay.py, tied to
// each servicing mission) plus a live "now" point from Hubble's current TLE
// (web/data/hubble.py), plus a simple illustrative decline toward the
// curated re-entry window. See web/data/hubble.py's get_hubble_decay
// docstring for why the projection is a plain straight line, not a real
// drag simulation.
import { useTranslation } from "react-i18next";
import ChartCanvas from "../charts/ChartCanvas";
import { useApi } from "../../hooks/useApi";
import { getHubbleDecay } from "../../lib/api";

// Shades the estimated re-entry window and marks solar-cycle-peak years —
// drawn manually instead of pulling in chartjs-plugin-annotation (not an
// existing dependency) since this is the only chart on the site that needs it.
const reentryBandPlugin = {
  id: "hubbleReentryBand",
  beforeDatasetsDraw(chart) {
    const opts = chart.config.options.plugins.hubbleReentryBand;
    if (!opts) return;
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;
    const { start, end, peaks } = opts;

    if (start != null && end != null) {
      const x1 = scales.x.getPixelForValue(start);
      const x2 = scales.x.getPixelForValue(end);
      ctx.save();
      ctx.fillStyle = "rgba(239, 68, 68, 0.10)";
      ctx.fillRect(x1, chartArea.top, x2 - x1, chartArea.bottom - chartArea.top);
      ctx.restore();
    }

    if (peaks && peaks.length) {
      ctx.save();
      ctx.strokeStyle = "rgba(245, 166, 35, 0.35)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      peaks.forEach((yr) => {
        const x = scales.x.getPixelForValue(yr);
        if (x < chartArea.left || x > chartArea.right) return;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
      });
      ctx.restore();
    }
  },
};

export default function AltitudeDecayChart() {
  const { t } = useTranslation();
  const { data } = useApi(getHubbleDecay);

  const history = data?.history || [];
  const projection = data?.projection || [];
  const reentry = data?.reentry_window || {};
  const sources = data?.sources || {};

  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 16 }}>
        <div>
          <div className="foot">{t("hubble.future.decayChart.currentAltitudeLabel")}</div>
          <div className="v" style={{ fontSize: 28 }}>
            {data ? `~${Math.round(data.current_altitude_km)}` : "—"}
            <span className="unit">{t("common.units.km")}</span>
          </div>
          <div className="foot">{t("hubble.future.decayChart.currentAltitudeNote")}</div>
        </div>
        {reentry.start != null && (
          <div>
            <div className="foot">{t("hubble.future.decayChart.reentryLabel")}</div>
            <div className="v" style={{ fontSize: 28, color: "#EF4444" }}>
              {t("hubble.future.decayChart.reentryRange", { start: reentry.start, end: reentry.end })}
            </div>
            <div className="foot">{t("hubble.future.decayChart.reentryNote")}</div>
          </div>
        )}
      </div>

      {!data && <p className="section-sub">{t("hubble.future.decayChart.loading")}</p>}
      {data && !history.length && <p className="section-sub">{t("hubble.future.decayChart.empty")}</p>}

      {history.length > 0 && (
        <div className="canvas-wrap" style={{ height: 280 }}>
          <ChartCanvas
            deps={[data]}
            factory={() => {
              const historicalPoints = history.map((h) => ({ x: h.year, y: h.altitude_km }));
              if (projection[0]) historicalPoints.push({ x: projection[0].year, y: projection[0].altitude_km });
              const projectedPoints = projection.map((p) => ({ x: p.year, y: p.altitude_km }));
              const launchAlt = history[0]?.altitude_km;
              const lastProjectedYear = projection.length ? projection[projection.length - 1].year : history[history.length - 1].year;
              // Extend the axis to the full re-entry window, not just to
              // where the illustrative line hits 0 (its midpoint) — otherwise
              // the shaded band gets cut off before its right edge.
              const lastYear = Math.max(lastProjectedYear, reentry.end || 0);

              return {
                type: "line",
                data: {
                  datasets: [
                    {
                      label: t("hubble.future.decayChart.chartHistorical"),
                      data: historicalPoints,
                      borderColor: "#8B7CF6",
                      backgroundColor: "transparent",
                      borderWidth: 2,
                      pointRadius: 3,
                      pointBackgroundColor: "#8B7CF6",
                      tension: 0,
                    },
                    {
                      label: t("hubble.future.decayChart.chartProjected"),
                      data: projectedPoints,
                      borderColor: "#EF4444",
                      backgroundColor: "transparent",
                      borderDash: [6, 4],
                      borderWidth: 2,
                      pointRadius: 0,
                      tension: 0.1,
                    },
                    launchAlt != null && {
                      label: t("hubble.future.decayChart.chartLaunchAlt"),
                      data: [{ x: history[0].year, y: launchAlt }, { x: lastYear, y: launchAlt }],
                      borderColor: "rgba(255,255,255,0.25)",
                      borderDash: [2, 3],
                      borderWidth: 1,
                      pointRadius: 0,
                    },
                  ].filter(Boolean),
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  animation: { duration: 300 },
                  plugins: {
                    legend: {
                      display: true,
                      position: "top",
                      labels: { boxWidth: 12, font: { family: "ui-monospace, 'JetBrains Mono', monospace", size: 10.5 } },
                    },
                    tooltip: {
                      callbacks: {
                        title: (items) => Math.round(items[0].parsed.x),
                        label: (c) => `${c.dataset.label}: ${Math.round(c.parsed.y)} km`,
                      },
                    },
                    hubbleReentryBand: { start: reentry.start, end: reentry.end, peaks: data.solar_cycle_peaks },
                  },
                  scales: {
                    x: {
                      type: "linear",
                      min: history[0]?.year,
                      max: lastYear,
                      ticks: { color: "#8B90AC", stepSize: 5, callback: (v) => Math.round(v) },
                      grid: { color: "rgba(255,255,255,0.05)" },
                      title: { display: true, text: t("hubble.future.decayChart.axisYear"), color: "#8B90AC" },
                    },
                    y: {
                      min: 0,
                      ticks: { color: "#8B90AC" },
                      grid: { color: "rgba(255,255,255,0.05)" },
                      title: { display: true, text: t("hubble.future.decayChart.axisAltitude"), color: "#8B90AC" },
                    },
                  },
                },
                plugins: [reentryBandPlugin],
              };
            }}
          />
        </div>
      )}

      <p className="section-sub" style={{ marginTop: 14, marginBottom: 0, fontSize: 12 }}>
        {t("hubble.future.decayChart.disclaimer")}
        {Object.keys(sources).length > 0 && (
          <>
            {" "}{t("hubble.future.decayChart.sources")}
            {Object.entries(sources).map(([key, url], i) => (
              <span key={key}>
                {i > 0 && ", "}
                <a href={url} target="_blank" rel="noopener noreferrer" className="section-link">{key}</a>
              </span>
            ))}
          </>
        )}
      </p>
    </div>
  );
}
