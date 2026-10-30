import { useState } from "react";
import { useTranslation } from "react-i18next";
import SectionHead from "../primitives/SectionHead";
import "../../styles/mission-evidence.css";

export default function MissionEvidenceExplorer({ mission, content, photos, captions }) {
  const [caseIndex, setCaseIndex] = useState(0);
  const [step, setStep] = useState(0);
  const { t } = useTranslation();
  const example = content.cases[caseIndex];
  const photo = photos[example.photo];
  const caption = captions[example.photo];
  const panelId = `${mission}-evidence-panel`;
  return <section className="section" id="evidence"><div className="wrap">
    <SectionHead eyebrow={content.eyebrow} title={content.title} sub={content.intro} />
    <div className="mission-destination-buttons" role="group" aria-label={content.choose}>
      {content.cases.map((item, index) => <button type="button" key={item.name} aria-pressed={caseIndex === index} aria-controls={panelId}
        onClick={() => { setCaseIndex(index); setStep(0); }}><span>0{index + 1}</span>{item.name}</button>)}
    </div>
    <div className="mission-two-columns">
      <figure className="mission-evidence-figure">
        <img src={photo.image} alt={caption.alt} width="900" height="600" loading="lazy" decoding="async" />
        <figcaption><strong>{caption.title}</strong><p>{content.imageNote}</p><a href={photo.source} target="_blank" rel="noopener noreferrer">{photo.credit} ↗</a></figcaption>
      </figure>
      <article className="card mission-evidence-panel" id={panelId}>
        <h3>{example.name}</h3>
        <div className="mission-evidence-steps" role="group" aria-label={content.chooseStep}>
          {content.steps.map((label, index) => <button type="button" key={label} aria-pressed={step === index} aria-controls={`${panelId}-reading`} onClick={() => setStep(index)}><span>0{index + 1}</span>{label}</button>)}
        </div>
        <div className="mission-evidence-reading" id={`${panelId}-reading`} role="status" aria-live="polite" aria-atomic="true">
          <div className="eyebrow">{content.steps[step]}</div><h4>{example.headings[step]}</h4><p>{example.readings[step]}</p>
        </div>
        <p className="mission-evidence-question">{example.question}</p>
        <div className="mission-evidence-actions">
          <button type="button" className="btn ghost" onClick={() => setStep((step + 1) % content.steps.length)}>{step === content.steps.length - 1 ? content.restart : content.next} →</button>
          <a className="section-link" href={example.source} target="_blank" rel="noopener noreferrer">{t("missionDetail.ui.readResearch")} ↗</a>
        </div>
      </article>
    </div>
  </div></section>;
}
