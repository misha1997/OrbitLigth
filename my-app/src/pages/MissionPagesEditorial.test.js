/* eslint-disable testing-library/no-node-access, testing-library/no-container -- Check head metadata, section IDs and native disclosure state. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18next from "../i18n";
import { pathFor } from "../lib/seo";
import Roman from "./Roman";
import Hubble from "./Hubble";
import Jwst from "./Jwst";
import Parker from "./Parker";
import Voyager from "./Voyager";

let mockLang = "en";
jest.mock("../context/LanguageContext", () => ({ useLang: () => ({ lang: mockLang }) }));
jest.mock("../hooks/useApi", () => ({ useApi: () => ({ data: null, loading: false, error: null, refetch: jest.fn() }) }));
jest.mock("./RomanHeroPreview", () => () => <div>Roman preview</div>);
jest.mock("./RomanFullscreen", () => () => <div>Roman fullscreen</div>);
jest.mock("./HubbleHeroPreview", () => () => <div>Hubble preview</div>);
jest.mock("./HubbleFullscreen", () => () => <div>Hubble fullscreen</div>);
jest.mock("./HubbleOrbitDiagram", () => () => <div>Hubble orbit</div>);
jest.mock("./JwstHeroPreview", () => () => <div>Webb preview</div>);
jest.mock("./JwstFullscreen", () => () => <div>Webb fullscreen</div>);
jest.mock("./JwstL2Orbit", () => () => <div>Webb orbit</div>);
jest.mock("./ParkerHeroPreview", () => () => <div>Parker preview</div>);
jest.mock("./ParkerFullscreen", () => () => <div>Parker fullscreen</div>);
jest.mock("../components/parker/ParkerOrbitDiagram", () => () => <div>Parker orbit</div>);
jest.mock("../components/voyager/OrbitMap", () => () => <div>Voyager orbit</div>);
jest.mock("../components/voyager/DsnNow", () => () => <div>DSN</div>);
jest.mock("../components/hubble/RecentlyObserved", () => () => <div>Hubble observations</div>);
jest.mock("../components/jwst/RecentlyObservedJwst", () => () => <div>Webb observations</div>);
jest.mock("../components/RomanNews", () => () => <section id="news">Roman news</section>);

const pages = { roman: Roman, hubble: Hubble, jwst: Jwst, parker: Parker, voyager: Voyager };
function mount(mission, lang = "en") {
  mockLang = lang;
  i18next.changeLanguage(lang);
  const Page = pages[mission];
  return render(<MemoryRouter initialEntries={[pathFor(mission, lang)]}><Page /></MemoryRouter>);
}

test.each(Object.keys(pages).flatMap(mission => ["uk", "en"].map(lang => [mission, lang])))
("%s has localized content and route metadata in %s", async (mission, lang) => {
  const { container } = mount(mission, lang);
  if (mission !== "voyager") await screen.findByText({ roman: "Roman preview", hubble: "Hubble preview", jwst: "Webb preview", parker: "Parker preview" }[mission]);
  expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  expect(container).not.toHaveTextContent(`${mission}.reading`);
  expect(container).not.toHaveTextContent(`${mission}.surveys`);
  expect(container.querySelector("#quiz")).not.toBeInTheDocument();
  expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute("href", "https://orbitlight.space" + pathFor(mission, lang));
  expect(document.title).toBe(i18next.t(`title.${mission}`));
  expect(container.querySelectorAll("#questions details")).toHaveLength(mission === "voyager" ? 0 : 3);
});

test.each(["en", "uk"])("Voyager does not invent current metrics or battery percentages in %s", lang => {
  const { container } = mount("voyager", lang);
  expect(screen.getByRole("status")).toHaveTextContent(i18next.t("voyager.dataUnavailable"));
  expect(container.querySelector(".pbar")).not.toBeInTheDocument();
  expect(container.querySelector("#voyager-cards")).not.toBeInTheDocument();
});

test("Roman presents dated commissioning evidence, three planned surveys and an opt-in launch video", async () => {
  const { container } = mount("roman");
  await screen.findByText("Roman preview");
  expect(screen.getByRole("heading", { name: "Final commissioning phase" })).toBeInTheDocument();
  expect(container.querySelectorAll("#science article")).toHaveLength(3);
  expect(container.querySelector('#status time[datetime="2026-10-30"]')).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "NASA · Commissioning ↗" })).toHaveAttribute("href", expect.stringContaining("/2026/10/22/"));
  expect(container.querySelector("#orbit svg")).toHaveAccessibleName(/target halo orbit/);
  expect(container.querySelector("#orbit canvas")).not.toBeInTheDocument();
  expect(container.querySelector("#launch iframe")).not.toBeInTheDocument();
  const history = container.querySelector("#launch details");
  history.open = true;
  fireEvent(history, new Event("toggle"));
  expect(await screen.findByTitle("Roman launch replay")).toHaveAttribute("src", expect.stringContaining("youtube-nocookie.com"));
  history.open = false;
  fireEvent(history, new Event("toggle"));
  await waitFor(() => expect(screen.queryByTitle("Roman launch replay")).not.toBeInTheDocument());
});
