import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18next from "../../i18n";
import MissionDetail from "./MissionDetail";
import { MISSIONS } from "../../lib/missions";
import { pathFor, nameFromPath, switchLangPath, SITE_URL } from "../../lib/seo";

let mockLang = "en";
jest.mock("../../context/LanguageContext", () => ({ useLang: () => ({ lang: mockLang }) }));
jest.mock("./MissionModelViewer", () => ({ __esModule: true, default: ({ name, ui }) => <button>{ui.open}: {name}</button> }));

beforeEach(() => {
  jest.clearAllMocks();
  HTMLDialogElement.prototype.showModal = jest.fn(function () { this.setAttribute("open", ""); });
  HTMLDialogElement.prototype.close = jest.fn(function () { this.removeAttribute("open"); });
  mockLang = "en";
  i18next.changeLanguage("en");
});

const mount = (mission) => render(
  <MemoryRouter initialEntries={[pathFor(mission, mockLang)]}>
    <MissionDetail mission={mission} />
  </MemoryRouter>
);

test.each(["newhorizons", "juno", "chandra"].flatMap((mission) => ["uk", "en"].map((lang) => [mission, lang])))
("%s renders translated content and SEO in %s, with working catalogue routes", async (mission, lang) => {
  mockLang = lang;
  i18next.changeLanguage(lang);
  const { container } = mount(mission);
  const content = i18next.t(`missionDetail.${mission}`, { returnObjects: true });
  expect(await screen.findByRole("button", { name: `${i18next.t("missionDetail.ui.model.open")}: ${content.name}` })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(content.name);
  expect(container).not.toHaveTextContent("missionDetail.");
  expect(screen.getAllByRole("button", { name: new RegExp(i18next.t("missionDetail.ui.enlarge")) })).toHaveLength(3);
  expect(container.querySelectorAll("#timeline li")).toHaveLength(4);
  expect(container.querySelectorAll("#instruments article")).toHaveLength(4);
  const backLinks = screen.getAllByRole("link", { name: new RegExp(i18next.t("missionDetail.ui.back")) });
  backLinks.forEach((link) => expect(link).toHaveAttribute("href", pathFor("missions", lang)));
  expect(document.title).toBe(i18next.t(`title.${mission}`));
  expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute("href", SITE_URL + pathFor(mission, lang));
  expect(document.querySelector('meta[name="description"]')).toHaveAttribute("content", i18next.t(`seo.desc.${mission}`));
  const entry = MISSIONS.find((item) => item.key === mission);
  expect(entry.disabled).toBe(false);
  expect(nameFromPath(pathFor(entry.to, lang))).toEqual({ name: mission, lang });
  const otherLang = lang === "uk" ? "en" : "uk";
  expect(switchLangPath(pathFor(mission, lang), otherLang)).toBe(pathFor(mission, otherLang));
});

test("gallery navigates without closing, wraps with arrow keys, and restores scroll after Escape", () => {
  document.body.style.overflow = "auto";
  mount("newhorizons");
  fireEvent.click(screen.getByRole("button", { name: "Enlarge image: Pluto in colour" }));
  let modal = screen.getByRole("dialog");
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.click(within(modal).getByRole("button", { name: "Next image" }));
  expect(screen.getByRole("dialog")).toHaveAccessibleName("Charon's contrasting terrain");
  fireEvent.keyDown(modal, { key: "ArrowLeft" });
  fireEvent.keyDown(modal, { key: "ArrowLeft" });
  expect(screen.getByRole("dialog")).toHaveAccessibleName("A blue atmospheric haze");
  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
  expect(HTMLDialogElement.prototype.close).not.toHaveBeenCalled();
  fireEvent(modal, new Event("cancel", { bubbles: false }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe("auto");
  document.body.style.overflow = "";
});
