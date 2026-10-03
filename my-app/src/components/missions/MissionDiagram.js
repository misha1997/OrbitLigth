// Educational diagrams, deliberately not ephemerides or current positions.
export default function MissionDiagram({ mission, labels, note }) {
  const flyby = mission === "newhorizons";
  const jupiter = mission === "juno";
  return (
    <figure className="mission-diagram">
      <svg viewBox="0 0 900 320" role="img" aria-label={labels.description}>
        {flyby ? (
          <>
            <path d="M85 225 Q210 80 310 135 T555 140 T810 80" className="mission-diagram-path" />
            {[[85,225,15],[310,135,34],[555,140,20],[810,80,11]].map(([cx,cy,r], index) => (
              <g key={labels.stops[index]}>
                <circle cx={cx} cy={cy} r={r} className={`mission-diagram-body body-${index}`} />
                <text x={cx} y={cy + r + 32} textAnchor="middle">{labels.stops[index]}</text>
                <text x={cx} y={cy + r + 55} textAnchor="middle" className="mission-diagram-date">{["2006","2007","2015","2019"][index]}</text>
              </g>
            ))}
          </>
        ) : (
          <>
            <ellipse cx="450" cy="148" rx={jupiter ? 120 : 320} ry={jupiter ? 125 : 100} className="mission-diagram-path" />
            <circle cx={jupiter ? 450 : 205} cy={jupiter ? 190 : 148} r={jupiter ? 48 : 27} className={`mission-diagram-body ${jupiter ? "body-1" : "body-0"}`} />
            {jupiter && <path d="M409 173 Q450 185 491 173 M404 193 Q450 207 496 193 M415 217 Q450 223 485 217" className="mission-diagram-bands" />}
            <circle cx={jupiter ? 450 : 770} cy={jupiter ? 23 : 148} r="8" className="mission-diagram-probe" />
            <text x={jupiter ? 520 : 205} y={jupiter ? 205 : 207} textAnchor={jupiter ? "start" : "middle"}>{labels.center}</text>
            <text x={jupiter ? 476 : 770} y={jupiter ? 32 : 124} textAnchor={jupiter ? "start" : "middle"}>{jupiter ? "Juno" : "Chandra"}</text>
            <text x="450" y="306" textAnchor="middle">{labels.orbit}</text>
          </>
        )}
      </svg>
      <figcaption>{note}</figcaption>
    </figure>
  );
}
