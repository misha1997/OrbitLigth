import { useTranslation } from "react-i18next";
import ChartCanvas from "../charts/ChartCanvas";

const COLORS = ["#4FD1C5", "#E8B94D", "#FF6B4A", "#9B8AFB", "#8B90AC"];

export function GrbStatsChart({ stats }) {
  const { t } = useTranslation();
  const values = stats?.classification || {};
  const labels = ["short", "long", "unknown"];
  const hasValues = labels.some((label) => values[label] > 0);
  if (!hasValues) return <div className="chart-empty">{t("events.charts.noData")}</div>;

  return (
    <div className="event-chart">
      <ChartCanvas height={220} deps={[JSON.stringify(values)]} factory={() => ({
        type: "doughnut",
        data: {
          labels: labels.map((label) => t(`events.grb.${label}`)),
          datasets: [{ data: labels.map((label) => values[label] || 0), backgroundColor: COLORS, borderColor: "#12142a", borderWidth: 3 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom", labels: { usePointStyle: true, padding: 16 } } },
        },
      })} />
    </div>
  );
}

export function GwClassificationChart({ items }) {
  const { t } = useTranslation();
  const totals = {};
  (items || []).forEach((item) => Object.entries(item.classification || {}).forEach(([key, value]) => {
    if (Number.isFinite(Number(value))) totals[key] = (totals[key] || 0) + Number(value);
  }));
  const labels = Object.keys(totals).sort((a, b) => totals[b] - totals[a]).slice(0, 6);
  if (!labels.length) return <div className="chart-empty">{t("events.charts.noData")}</div>;

  return (
    <div className="event-chart">
      <ChartCanvas height={220} deps={[JSON.stringify(totals)]} factory={() => ({
        type: "bar",
        data: {
          labels: labels.map((label) => t(`deep.gw.class.${label}`, { defaultValue: label })),
          datasets: [{ label: t("events.charts.probability"), data: labels.map((label) => Math.round((totals[label] / items.length) * 100)), backgroundColor: COLORS[0], borderRadius: 3 }],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%` } } },
          plugins: { legend: { display: false } },
        },
      })} />
    </div>
  );
}