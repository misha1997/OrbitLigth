import { fireEvent, render, screen } from "@testing-library/react";
import i18next from "../../i18n";
import SpitzerInfraredLab from "./SpitzerInfraredLab";

test.each(["uk", "en"])("Spitzer's lab shifts the thermal peak, switches available channels and resets in %s", lang => {
  i18next.changeLanguage(lang);
  const content = i18next.t("missionDetail.spitzer.infrared", { returnObjects: true });
  const { container } = render(<SpitzerInfraredLab content={content} />);
  const results = container.querySelector(".spitzer-spectrum-results");
  expect(results).toHaveTextContent(lang === "en" ? "9.66" : "9,66");
  expect(container.querySelectorAll(".is-available")).toHaveLength(7);
  const graph = screen.getByRole("img", { name: content.diagram });
  const originalCurve = graph.querySelector("path").getAttribute("d");
  fireEvent.change(screen.getByRole("slider"), { target: { value: "600" } });
  expect(results).toHaveTextContent(lang === "en" ? "4.83" : "4,83");
  expect(graph.querySelector("path").getAttribute("d")).not.toBe(originalCurve);
  fireEvent.click(screen.getByRole("button", { name: content.warm }));
  expect(screen.getByRole("status")).toHaveTextContent(content.warmAvailability);
  expect(container.querySelectorAll(".is-available")).toHaveLength(2);
  expect(container.querySelectorAll(".is-unavailable")).toHaveLength(5);
  expect(results).toHaveTextContent(lang === "en" ? "4.83" : "4,83");
  expect(screen.getByRole("button", { name: content.warm })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: content.reset }));
  expect(screen.getByRole("slider")).toHaveValue("300");
  expect(container.querySelectorAll(".is-available")).toHaveLength(7);
  expect(screen.getByRole("status")).toHaveTextContent(content.coldAvailability);
  expect(results).toHaveTextContent(lang === "en" ? "9.66" : "9,66");
});
