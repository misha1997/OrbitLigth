import { useTranslation } from "react-i18next";
import SectionHead from "../primitives/SectionHead";
import "../../styles/mission-editorial.css";

export default function MissionReadingGuide({ mission }) {
  const { t } = useTranslation();
  const guide = t(`${mission}.reading`, { returnObjects: true });
  return <section className="section" id="questions"><div className="wrap">
    <SectionHead title={guide.title} />
    <div className="mission-reading-questions">{guide.items.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
    <p className="mission-editorial-note"><a className="section-link" href={guide.source} target="_blank" rel="noopener noreferrer">{guide.sourceLabel} ↗</a></p>
  </div></section>;
}
