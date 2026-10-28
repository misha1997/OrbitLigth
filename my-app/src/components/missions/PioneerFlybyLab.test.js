import { fireEvent, render, screen, within } from "@testing-library/react";
import i18next from "../../i18n";
import PioneerFlybyLab from "./PioneerFlybyLab";

test.each(["pioneer10", "pioneer11"].flatMap(mission => ["uk", "en"].map(lang => [mission, lang])))
("%s's flyby lab changes the geometry and reference-frame speeds in %s", (mission, lang) => {
  i18next.changeLanguage(lang);
  const content = i18next.t(`missionDetail.${mission}.flyby`, { returnObjects: true });
  const { container } = render(<PioneerFlybyLab mission={mission} content={content} />);
  const results = container.querySelector(".pioneer-flyby-results");
  const values = () => within(results).getAllByRole("strong").map(node => node.textContent);
  const initial = values();
  expect(initial).toEqual([`3 ${content.kms}`, `${lang === "en" ? "16.4" : "16,4"} ${content.kms}`, `10 ${content.kms}`]);
  const diagram = screen.getByRole("img", { name: content.diagram });
  const geometry = diagram.innerHTML;
  fireEvent.change(screen.getByRole("slider"), { target: { value: "0" } });
  expect(values()[1]).toBe(`3 ${content.kms}`);
  expect(diagram.innerHTML).not.toBe(geometry);
  fireEvent.change(screen.getByRole("slider"), { target: { value: "140" } });
  expect(values()[1]).not.toBe(initial[1]);
  expect(values()[2]).toBe(initial[2]);
  fireEvent.click(screen.getByRole("button", { name: content.stationary }));
  expect(values()).toEqual(Array(3).fill(`10 ${content.kms}`));
  expect(screen.getByRole("status")).toHaveTextContent(content.stationaryExplanation);
  expect(screen.getByRole("button", { name: content.stationary })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: content.reset }));
  expect(screen.getByRole("slider")).toHaveValue("90");
  expect(values()).toEqual(initial);
  expect(screen.getByRole("status")).toHaveTextContent(content.movingExplanation);
});
