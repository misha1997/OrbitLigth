import React from "react";
import { daysUntilTxt } from "../../lib/format";
import EclipseGraphic from "./EclipseGraphic";

export default function EventCard({ event, t }) {
  const isEclipse = event.kind === "eclipse";
  
  return (
    <div className="event-grid-card">
      <div className="event-card-graphic">
        {isEclipse ? (
          <EclipseGraphic type={event.type} size={64} />
        ) : (
          <div className="event-card-emoji">{event.emoji || "✨"}</div>
        )}
      </div>
      <div className="event-card-content">
        <div className="event-card-date">
          <span>{event.date}</span>
          <strong>{event.days_until !== undefined ? daysUntilTxt(event.days_until) : event.time}</strong>
        </div>
        <h3 className="event-card-title">{event.title || event.name}</h3>
        <p className="event-card-detail">{event.detail || event.visibility || "—"}</p>
      </div>
    </div>
  );
}
