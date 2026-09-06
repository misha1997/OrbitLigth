// /admin (index route) — overview stats. See AdminLayout.js for the shell
// this renders inside.
import { useEffect, useState } from "react";
import ChartCanvas from "../../components/charts/ChartCanvas";
import { getStats } from "../../lib/adminApi";
import {
  ActivityIcon, TrendingUpIcon, NewspaperIcon, ImageIcon, SparkleIcon, UsersIcon,
} from "../../lib/adminIcons";
import "../../styles/admin.css";

const WEEKDAY_LABELS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

const COUNT_META = {
  news: { label: "Статті новин", icon: NewspaperIcon },
  apod: { label: "Записи фотоархіву", icon: ImageIcon },
  galaxies: { label: "Галактики", icon: SparkleIcon },
  web_users: { label: "Акаунти на сайті", icon: UsersIcon },
  bot_users: { label: "Користувачі бота", icon: UsersIcon },
};

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="adm-stat-card">
      <div className="adm-stat-icon"><Icon size={16} /></div>
      <div>
        <div className="adm-stat-value">{value}</div>
        <div className="adm-stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getStats().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="adm-page"><p className="adm-error">{error}</p></div>;
  if (!stats) return <div className="adm-page"><p className="adm-hint">Завантаження…</p></div>;

  const daily = stats.visits_daily || [];

  return (
    <div className="adm-page">
      <h1 className="adm-page-title">Дашборд</h1>

      <div className="adm-stat-grid">
        <StatCard label="Онлайн зараз" value={stats.online_now} icon={ActivityIcon} />
        <StatCard label="Відвідувачів сьогодні" value={stats.visits_today} icon={TrendingUpIcon} />
        <StatCard label="Відвідувачів за 7 днів" value={stats.visits_week} icon={TrendingUpIcon} />
        {Object.entries(stats.counts).map(([key, value]) => {
          const meta = COUNT_META[key] || { label: key, icon: ActivityIcon };
          return <StatCard key={key} label={meta.label} value={value} icon={meta.icon} />;
        })}
      </div>

      <div className="adm-card">
        <h2 className="adm-card-title">Відвідування за 7 днів</h2>
        {daily.length === 0 ? (
          <p className="adm-hint">Немає даних.</p>
        ) : (
          <ChartCanvas
            height="240px"
            deps={[daily]}
            factory={() => ({
              type: "bar",
              data: {
                labels: daily.map((d) => WEEKDAY_LABELS[new Date(d.date + "T00:00:00").getDay()]),
                datasets: [{
                  label: "Унікальні відвідувачі",
                  data: daily.map((d) => d.count),
                  backgroundColor: "rgba(99, 102, 241, 0.65)",
                  hoverBackgroundColor: "rgba(124, 127, 244, 0.85)",
                  borderRadius: 4,
                  maxBarThickness: 44,
                }],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: {
                    ticks: { color: "#97979f" },
                    grid: { display: false },
                  },
                  y: {
                    beginAtZero: true,
                    suggestedMax: Math.max(4, ...daily.map((d) => d.count)),
                    ticks: { precision: 0, color: "#97979f" },
                    grid: { color: "rgba(255, 255, 255, 0.06)" },
                  },
                },
              },
            })}
          />
        )}
      </div>
    </div>
  );
}
