// Generic Chart.js wrapper for the space-weather charts. `factory` returns a
// Chart.js config (or null to skip); the chart is (re)built whenever `deps`
// change. Chart.js v4 auto-build registers all controllers/elements globally.
// Port of the setupChartTheme + per-chart `new Chart(el, …)` calls in
// space-weather.js.
//
// The canvas is wrapped in its own `position:relative` div with an explicit
// height, rather than sizing the bare <canvas> element directly — Chart.js's
// `responsive:true` resize logic measures the canvas's *parent* to decide
// the internal drawing-buffer size. Without a parent whose height doesn't
// itself depend on the canvas's content (i.e. a plain content-sized div),
// that creates a resize feedback loop that inflates the canvas taller on
// every measurement — this bit the admin dashboard's visits chart, which
// passed `height` expecting it to apply to the canvas itself. Existing
// space-weather callers already work around this by wrapping ChartCanvas in
// their own fixed-height `.canvas-wrap` (neowatch.css); this makes `height`
// safe to rely on directly instead.
import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

export default function ChartCanvas({ factory, deps = [], height }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    // Theme defaults (space-weather.js setupChartTheme).
    Chart.defaults.color = "#8B90AC";
    Chart.defaults.borderColor = "rgba(255,255,255,0.06)";
    Chart.defaults.font.family = "ui-monospace, 'JetBrains Mono', monospace";
    Chart.defaults.font.size = 11;

    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    const cfg = factory();
    if (!cfg) return;
    chartRef.current = new Chart(ref.current, cfg);

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return (
    <div style={{ position: "relative", width: "100%", height: height || "100%" }}>
      <canvas ref={ref} />
    </div>
  );
}