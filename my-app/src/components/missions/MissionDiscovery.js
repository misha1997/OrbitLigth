import { useState } from "react";
import { useTranslation } from "react-i18next";
import SectionHead from "../primitives/SectionHead";
import "../../styles/mission-discovery.css";

const MARKERS = {
  perseverance: [[60, 65], [39, 39], [51, 73], [25, 25]],
  cassini: [[45, 48], [64, 61], [83, 26], [23, 75]],
  osirisrex: [[14, 73], [49, 42], [79, 73], [83, 23]],
  gaia: [[25, 43], [51, 35], [72, 59], [44, 72]],
  kepler: [[22, 30], [52, 33], [79, 58], [35, 76]],
  spitzer: [[21, 37], [50, 28], [78, 54], [40, 77]],
  pioneer10: [[12, 70], [34, 53], [57, 36], [85, 19]],
  pioneer11: [[12, 70], [47, 42], [76, 67], [85, 18]],
};

const MAP_LABELS = { perseverance: "JEZERO / 18.4° N · 77.5° E", cassini: "SATURN SYSTEM / 2004–2017", osirisrex: "BENNU / SAMPLE RETURN / 2016–2023", gaia: "GAIA / ASTROMETRY · PHOTOMETRY · SPECTROSCOPY", kepler: "KEPLER / TRANSIT PHOTOMETRY / K2", spitzer: "SPITZER / INFRARED UNIVERSE / 2003–2020" };
MAP_LABELS.pioneer10 = "PIONEER 10 / EARTH · ASTEROID BELT · JUPITER";
MAP_LABELS.pioneer11 = "PIONEER 11 / EARTH · JUPITER · SATURN";

function DiscoveryMap({ mission, selected, onSelect, content }) {
  const mars = mission === "perseverance";
  return <figure className={`mission-discovery-map ${mars ? "is-mars" : ""} is-${mission}`}>
    <div className="mission-discovery-drawing">
      <svg viewBox="0 0 800 500" role="img" aria-label={content.description}>
        <defs>
          <radialGradient id={`${mission}-world`} cx="35%" cy="25%"><stop stopColor={mars ? "#d8a380" : "#eedeb8"} /><stop offset="1" stopColor={mars ? "#593c32" : "#76634c"} /></radialGradient>
          <pattern id={`${mission}-stars`} width="89" height="71" patternUnits="userSpaceOnUse"><circle cx="15" cy="22" r="1" fill="#ffffff60" /><circle cx="63" cy="49" r="0.7" fill="#ffffff30" /></pattern>
        </defs>
        <rect width="800" height="500" fill={`url(#${mission}-stars)`} />
        {mars ? <g>
          <ellipse cx="425" cy="255" rx="295" ry="210" fill={`url(#${mission}-world)`} stroke="#d6a07c55" strokeWidth="22" />
          <ellipse cx="425" cy="255" rx="265" ry="185" fill="none" stroke="#e3b79630" strokeWidth="2" />
          <path d="M180 25 205 78 242 118 312 195 274 221 252 203 236 174 209 160 192 122 166 82" fill="#735346" stroke="#d5ac8b60" strokeWidth="2" />
          <path d="m242 118 125 68-35 70-60-35Z" fill="#c4937055" stroke="#e1b08b90" />
          <path d="m247 127 91 70m-86-59 66 75m-59-66 32 69" fill="none" stroke="#e6b68b70" strokeWidth="2" />
          <path d="M480 325 Q430 310 408 365 T312 195 T200 125" fill="none" stroke="#f1c09a88" strokeWidth="2" strokeDasharray="6 9" />
          <g fill="#d9ae8c50"><ellipse cx="530" cy="186" rx="28" ry="12" /><ellipse cx="580" cy="280" rx="17" ry="9" /><ellipse cx="380" cy="290" rx="21" ry="11" /></g>
        </g> : mission === "osirisrex" ? <g>
          <path d="M112 365Q180 65 392 210T632 365M632 365Q740 310 664 115" fill="none" stroke="#c9a87680" strokeWidth="2" strokeDasharray="7 8" />
          <circle cx="112" cy="365" r="42" fill="#46708e" /><path d="m85 342 22 6 4 22 23 8-10 19-23-10-5-20-17-8Z" fill="#8eb7ab" />
          <path d="m337 129 69-10 67 46 15 68-42 63-75 5-49-53-8-72Z" fill="#77716c" stroke="#b0a398" strokeWidth="2" />
          <path d="m337 129 42 55 27-65 25 92 42-46-27 131-67-112-57 64 109-37 57 22" fill="none" stroke="#c9b9a044" strokeWidth="2" />
          <g fill="#494744"><ellipse cx="357" cy="213" rx="13" ry="9" /><ellipse cx="429" cy="166" rx="11" ry="8" /><ellipse cx="415" cy="260" rx="18" ry="9" /></g>
          <path d="m468 105 27 11-8 22-27-11Zm43 18 27 11-8 22-27-11Z" fill="#405d89" stroke="#a5b3c7" />
          <path d="m493 124 12 6-25 50" fill="none" stroke="#d5bd8e" strokeWidth="5" />
          <path d="m599 372 32-20 34 20-12 13h-43Z" fill="#d6ba98" stroke="#a88a67" strokeWidth="2" />
          <path d="m648 98 29-8 22 18-6 27-30 5-21-17Z" fill="#908175" />
          <circle cx="632" cy="365" r="66" fill="none" stroke="#c9a87630" />
        </g> : mission === "gaia" ? <g>
          <ellipse cx="400" cy="245" rx="335" ry="175" fill="#211b3d" stroke="#b4a0ed55" strokeWidth="2" />
          <path d="M72 231Q230 133 399 227T727 251" fill="none" stroke="#9d86d140" strokeWidth="74" />
          <path d="M78 224Q230 166 399 235T721 249" fill="none" stroke="#d0bced55" strokeWidth="20" />
          {Array.from({ length: 80 }, (_, index) => {
            const angle = index * 2.39996, radius = Math.sqrt((index + 1) / 81);
            return <circle key={index} cx={400 + Math.cos(angle) * radius * 315} cy={245 + Math.sin(angle) * radius * 158} r={1.2 + (index % 4) * 0.6} fill={index % 3 ? "#dfd2f0" : "#8fc6e3"} opacity={0.4 + (index % 3) * 0.2} />;
          })}
          <path d="m400 175 40-20-9 17m9-17-20-1m136 140 35 17-17 3m17-3-9-18" fill="none" stroke="#b4a0ed" strokeWidth="2" />
          <path d="m163 200 37 30 37-30m-37-30v60" fill="none" stroke="#b4a0ed80" strokeWidth="2" />
          <path d="m309 354 16-13 15 9 13-32 16 27 15-6 13 13" fill="none" stroke="#c7b3eb" strokeWidth="2" />
        </g> : mission === "kepler" ? <g>
          <path d="M176 150 416 165 632 290 280 380" fill="none" stroke="#b2a2de65" strokeWidth="2" strokeDasharray="6 9" />
          <path d="m96 89 160 22-10 116-160-23Z" fill="#29253e" stroke="#b2a2de80" strokeWidth="2" />
          {Array.from({ length: 12 }, (_, index) => <rect key={index} x={110 + index % 4 * 31} y={119 + Math.floor(index / 4) * 27} width="19" height="17" fill="#b2a2de55" />)}
          <circle cx="416" cy="165" r="67" fill="#e6bd7a" /><circle cx="447" cy="173" r="14" fill="#25263f" stroke="#cdbbe4" />
          <ellipse cx="632" cy="290" rx="98" ry="43" transform="rotate(-28 632 290)" fill="none" stroke="#b2a2de70" strokeWidth="2" />
          <circle cx="632" cy="290" r="23" fill="#d0a061" /><path d="m550 310 11 7-6 13-11-7Z" fill="#b2a2de" />
          <path d="M167 336V421H392" stroke="#b2a2de50" fill="none" />
          <path d="M173 357h20l9 38h21l9-38h42l9 38h21l9-38h42l9 38h21l9-38h10" fill="none" stroke="#c5b6ec" strokeWidth="3" />
        </g> : mission === "spitzer" ? <g>
          <path d="M168 185 400 140 624 270 320 385" fill="none" stroke="#e6a17b60" strokeWidth="2" strokeDasharray="6 9" />
          <g fill="#ad6f6140" stroke="#e6a17b40"><ellipse cx="156" cy="184" rx="89" ry="60" /><ellipse cx="197" cy="168" rx="61" ry="42" /><ellipse cx="124" cy="211" rx="51" ry="35" /></g>
          <path d="M313 168Q330 73 415 95T471 191Q425 228 358 196" fill="#d7785a25" stroke="#d5947560" strokeWidth="2" />
          <circle cx="400" cy="140" r="24" fill="#f5c991" /><path d="M400 102V178M362 140H438" stroke="#f5c99180" strokeWidth="2" />
          <ellipse cx="624" cy="270" rx="106" ry="54" transform="rotate(-23 624 270)" fill="none" stroke="#e6a17b60" strokeWidth="2" />
          <circle cx="624" cy="270" r="28" fill="#d6a076" /><circle cx="689" cy="235" r="11" fill="#91a4bd" /><circle cx="546" cy="312" r="8" fill="#c58e75" />
          <path d="M219 407H430M235 407Q264 263 302 407M274 407Q328 319 390 407" fill="none" stroke="#dfae88" strokeWidth="3" />
          <path d="M268 286V415M335 330V415" stroke="#b4c1dd70" strokeDasharray="4 6" />
        </g> : mission === "pioneer10" || mission === "pioneer11" ? <g>
          <circle cx="96" cy="350" r="25" fill="#527990" /><path d="m80 332 15 8 6 21 15 7-15 5-16-14Z" fill="#9ab6a8" />
          {Array.from({ length: 38 }, (_, index) => <circle key={index} cx={220 + (index % 6) * 19} cy={110 + index * 9 % 250} r={1.5 + index % 3} fill="#c5ae8670" />)}
          <path d={mission === "pioneer10" ? "M96 350Q215 350 272 265T456 180Q550 145 680 95" : "M96 350Q220 330 376 210Q340 85 220 100T608 335Q685 240 680 90"} fill="none" stroke="#e0c292b0" strokeWidth="3" strokeDasharray="7 8" />
          <g transform={mission === "pioneer10" ? "translate(456 180)" : "translate(376 210)"}>
            <circle r="48" fill="#c4a078" /><path d="M-44-16Q0-4 44-16M-48 4Q0 18 48 4M-40 26Q0 34 40 26" fill="none" stroke="#876953" strokeWidth="8" />
            <ellipse cx="18" cy="18" rx="12" ry="6" fill="#ad6858" />
          </g>
          {mission === "pioneer11" && <g transform="translate(608 335)"><ellipse rx="94" ry="31" transform="rotate(-25)" fill="none" stroke="#d8c29b90" strokeWidth="13" /><circle r="38" fill="#d2bb91" /><path d="M-80 37Q5 20 82-36" fill="none" stroke="#d8c29b" strokeWidth="10" /></g>}
          <path d="m660 75 30 10-10 30-30-10Z" fill="#d7c4a5" /><path d="m665 80 15 5-5 15-15-5Z" fill="#756552" />
          <path d="M618 71 641 78M616 95 637 95M637 119 648 107" stroke="#c7b59270" strokeWidth="2" />
        </g> : <g>
          <ellipse cx="360" cy="240" rx="252" ry="95" transform="rotate(-24 360 240)" fill="none" stroke="#c6ae8070" strokeWidth="39" />
          <ellipse cx="360" cy="240" rx="216" ry="78" transform="rotate(-24 360 240)" fill="none" stroke="#e3cfac50" strokeWidth="12" />
          <circle cx="360" cy="240" r="105" fill={`url(#${mission}-world)`} />
          <path d="M263 210q97 36 194 0M257 239q103 38 206 0M264 273q96 32 192 0" fill="none" stroke="#ac916755" strokeWidth="11" />
          <path d="M158 347Q350 380 576 176" fill="none" stroke="#eed8b6a0" strokeWidth="26" />
          <path d="M150 337Q350 370 581 165" fill="none" stroke="#6f6148" strokeWidth="4" />
          <circle cx="664" cy="130" r="41" fill="#c29b59" stroke="#ddb97855" strokeWidth="12" />
          <circle cx="184" cy="375" r="22" fill="#cbdde3" />
          <path d="m175 392-15 36m25-31 4 35m4-37 22 29" fill="none" stroke="#b2e0f280" strokeWidth="3" />
          <ellipse cx="360" cy="240" rx="340" ry="184" fill="none" stroke="#e4d7be30" strokeDasharray="5 10" />
        </g>}
      </svg>
      {content.stops.map((stop, index) => <button key={stop.name} type="button" className="mission-map-marker"
        style={{ left: `${MARKERS[mission][index][0]}%`, top: `${MARKERS[mission][index][1]}%` }}
        aria-label={`${index + 1}. ${stop.name}`} aria-pressed={selected === index} aria-controls={`${mission}-destination`}
        onClick={() => onSelect(index)}>{String(index + 1).padStart(2, "0")}</button>)}
      <span className="mission-map-coordinate" aria-hidden="true">{MAP_LABELS[mission]}</span>
    </div>
    <figcaption>{content.note}</figcaption>
  </figure>;
}

export default function MissionDiscovery({ mission, content }) {
  const [selected, setSelected] = useState(0);
  const { t } = useTranslation();
  const stop = content.stops[selected];
  return <section className="section" id="trajectory"><div className="wrap">
    <SectionHead eyebrow={content.eyebrow} title={content.title} sub={content.intro} />
    <div className="mission-destination-buttons" role="group" aria-label={content.choose}>
      {content.stops.map((item, index) => <button type="button" key={item.name} aria-pressed={selected === index}
        aria-controls={`${mission}-destination`} onClick={() => setSelected(index)}><span>0{index + 1}</span>{item.name}</button>)}
    </div>
    <div className="mission-discovery-grid">
      <DiscoveryMap mission={mission} selected={selected} onSelect={setSelected} content={content} />
      <article className="card mission-destination" id={`${mission}-destination`} aria-live="polite" aria-atomic="true">
        <div className="eyebrow">{content.detailLabel} / 0{selected + 1}</div>
        <h3>{stop.name}</h3><p>{stop.body}</p>
        <div className="mission-destination-fact"><strong>{stop.fact}</strong><span>{stop.factLabel}</span></div>
        <p>{stop.question}</p><a className="section-link" href={stop.source} target="_blank" rel="noopener noreferrer">{t("missionDetail.ui.readResearch")} ↗</a>
      </article>
    </div>
  </div></section>;
}

export function MissionQuiz({ mission, content }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const question = content.questions[index];
  const answered = answer !== null;
  return <section className="section" id="quiz"><div className="wrap">
    <div className="mission-quiz card">
      <div><div className="eyebrow">{content.eyebrow} · {index + 1} / {content.questions.length}</div><h2>{content.title}</h2><p>{content.intro}</p></div>
      <div>
        <fieldset><legend>{question.question}</legend>
          <div className="mission-quiz-options">{question.options.map((option, optionIndex) => <button type="button" key={option}
            disabled={answered} aria-pressed={answer === optionIndex}
            className={answered && optionIndex === question.correct ? "is-correct" : answered && optionIndex === answer ? "is-incorrect" : ""}
            onClick={() => setAnswer(optionIndex)}>{option}</button>)}</div>
        </fieldset>
        {answered && <div className="mission-quiz-answer" role="status"><strong>{answer === question.correct ? content.correct : content.incorrect}</strong><p>{question.explanation}</p>
          <button type="button" className="btn ghost" onClick={() => { setAnswer(null); setIndex((index + 1) % content.questions.length); }}>{index === content.questions.length - 1 ? content.restart : content.next} →</button>
        </div>}
      </div>
    </div>
  </div></section>;
}
