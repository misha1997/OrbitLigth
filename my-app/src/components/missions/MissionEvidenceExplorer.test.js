import { fireEvent, render, screen, within } from "@testing-library/react";
import i18next from "../../i18n";
import { MISSION_DETAILS } from "../../lib/missionDetails";
import MissionEvidenceExplorer from "./MissionEvidenceExplorer";

test.each(["galileo", "curiosity", "rosetta", "dawn"].flatMap(mission => ["uk", "en"].map(lang => [mission, lang])))
("%s distinguishes observations, interpretations and limits in %s", (mission, lang) => {
  i18next.changeLanguage(lang);
  const details = i18next.t(`missionDetail.${mission}`, { returnObjects: true });
  const content = details.evidence;
  const photos = MISSION_DETAILS[mission].gallery;
  const { container } = render(<MissionEvidenceExplorer mission={mission} content={content} photos={photos} captions={details.gallery} />);
  const cases = screen.getByRole("group", { name: content.choose });
  const stages = screen.getByRole("group", { name: content.chooseStep });
  const reading = screen.getByRole("status");
  content.cases.forEach((example, caseIndex) => {
    const choose = within(cases).getAllByRole("button")[caseIndex];
    fireEvent.click(choose);
    expect(choose).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img")).toHaveAttribute("src", photos[example.photo].image);
    expect(screen.getByRole("img")).toHaveAccessibleName(details.gallery[example.photo].alt);
    example.readings.forEach((text, step) => {
      expect(within(stages).getAllByRole("button")[step]).toHaveAttribute("aria-pressed", "true");
      expect(reading).toHaveTextContent(text);
      expect(within(reading).getByRole("heading")).toHaveTextContent(example.headings[step]);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(step === 2 ? content.restart : content.next) }));
    });
    expect(reading).toHaveTextContent(example.readings[0]);
    expect(container.querySelector(".mission-evidence-actions a")).toHaveAttribute("href", example.source);
    fireEvent.click(within(stages).getAllByRole("button")[2]);
    expect(reading).toHaveTextContent(example.readings[2]);
    // Switching cases must return to observation, not retain the previous claim.
    fireEvent.click(within(cases).getAllByRole("button")[(caseIndex + 1) % content.cases.length]);
    expect(within(stages).getAllByRole("button")[0]).toHaveAttribute("aria-pressed", "true");
  });
});
