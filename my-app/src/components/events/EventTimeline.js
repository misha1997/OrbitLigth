import { useTranslation } from "react-i18next";

function dateValue(value) {
  const timestamp = Date.parse(value || "");
  return Number.isNaN(timestamp) ? null : timestamp;
}

export default function EventTimeline({ eclipses, conjunctions, weekly }) {
  const { t } = useTranslation();
  const entries = [
    ...(eclipses || []).map((event) => ({ ...event, kind: "eclipse" })),
    ...(conjunctions || []).map((event) => ({ ...event, kind: "conjunction" })),
    ...(weekly || []).map((event) => ({
      date: event.date,
      name: event.text,
      days_until: event.days,
      kind: "weekly",
    })),
  ]
    .map((event) => ({ ...event, timestamp: dateValue(event.date) }))
    .filter((event) => event.timestamp !== null)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, 6);

  if (!entries.length) return null;

  return (
    <div className="event-agenda" aria-label={t("events.timeline.label")}>
      {entries.map((event, index) => (
        <div className={`event-agenda-row ${event.kind}`} key={`${event.date}-${index}`}>
          <div className="event-agenda-date"><strong>{event.date}</strong><span>{daysLabel(event.days_until, t)}</span></div>
          <span className="event-agenda-rule" />
          <div className="event-agenda-content">
            <span className="event-agenda-kind">
              <span className="event-icon">{kindIcon(event.kind)}</span>
              {kindLabel(event.kind, t)}
            </span>
            <strong>{event.name}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

function kindIcon(kind) {
  if (kind === "eclipse") return "🌑";
  if (kind === "conjunction") return "✨";
  return "📅";
}

function daysLabel(days, t) {
  if (days === 0) return t("common.days.today");
  if (days === 1) return t("common.days.tomorrow");
  return t("common.days.in_n", { n: days });
}

function kindLabel(kind, t) {
  if (kind === "eclipse") return t("events.timeline.eclipse");
  if (kind === "conjunction") return t("events.timeline.conjunction");
  return t("events.timeline.weekly");
}