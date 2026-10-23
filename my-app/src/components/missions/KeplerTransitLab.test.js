import { fireEvent, render, screen, within } from "@testing-library/react";
import i18next from "../../i18n";
import KeplerTransitLab from "./KeplerTransitLab";

test.each(["uk", "en"])("Kepler's transit lab relates size, period and position to the light curve in %s", lang => {
  i18next.changeLanguage(lang);
  const content = i18next.t("missionDetail.kepler.transit", { returnObjects: true });
  const { container } = render(<KeplerTransitLab content={content} />);
  const results = container.querySelector(".kepler-transit-results");
  const number = text => Number(text.replace(/ppm|\s/g, "").replace(/,/g, lang === "en" ? "" : "."));
  const depth = () => number(within(results).getAllByRole("strong")[0].textContent);
  const originalDepth = depth();
  expect(originalDepth).toBeCloseTo(336, 0);
  fireEvent.change(screen.getByRole("slider", { name: new RegExp(content.radius) }), { target: { value: "4" } });
  expect(depth() / originalDepth).toBeCloseTo(4, 2);
  const graph = screen.getByRole("img", { name: content.diagram });
  const originalCurve = graph.querySelectorAll("path")[2].getAttribute("d");
  fireEvent.change(screen.getByRole("slider", { name: new RegExp(content.period) }), { target: { value: "20" } });
  expect(graph.querySelectorAll("path")[2].getAttribute("d")).not.toBe(originalCurve);
  fireEvent.change(screen.getByRole("slider", { name: content.phase }), { target: { value: "0" } });
  expect(within(results).getAllByRole("strong")[1]).toHaveTextContent("100%");
  fireEvent.change(screen.getByRole("slider", { name: content.phase }), { target: { value: "50" } });
  expect(within(results).getAllByRole("strong")[1]).not.toHaveTextContent(/^100%$/);
  fireEvent.click(screen.getByRole("button", { name: content.reset }));
  expect(depth()).toBe(originalDepth);
  expect(screen.getByRole("slider", { name: new RegExp(content.period) })).toHaveValue("10");
  expect(screen.getByRole("slider", { name: content.phase })).toHaveValue("50");
});
