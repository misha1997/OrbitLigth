/* eslint-disable testing-library/no-node-access -- Verify metadata in document.head. */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ConstellationGuide from "./ConstellationGuide";
let mockLang = "en";
const mockT = key => key;
jest.mock("../context/LanguageContext", () => ({ useLang: () => ({ lang: mockLang }) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: mockT }) }));

test.each([
  ["en", "/en/constellations/orion", "Orion", "Find on the map"],
  ["uk", "/ua/suzirya/orion", "Оріон", "Знайти на карті"],
])("%s guide displays its content and uses detail-page metadata", async (lang, path, title, cta) => {
  mockLang = lang;
  render(<MemoryRouter initialEntries={[path]}><ConstellationGuide slug="orion" /></MemoryRouter>);
  expect(await screen.findByRole("heading", { level: 1, name: title })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: new RegExp(cta) })).toHaveAttribute("href", (lang === "uk" ? "/ua/suzirya" : "/en/constellations") + "?focus=Ori&season=winter#sky-map");
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "NASA · Messier 42" })).toBeInTheDocument();
  expect(document.querySelector('link[rel="canonical"]').href).toBe("https://orbitlight.space" + path);
  expect(document.querySelector('meta[property="og:image"]').content).toContain("/constellations/orion-" + lang + ".png");
  const schema = JSON.parse(document.querySelector('script[data-route-seo]').textContent);
  expect(schema.breadcrumb.itemListElement[2].name).toBe(title);
});

test("a newly added guide loads its own content and review date", async () => {
  mockLang = "uk";
  render(<MemoryRouter initialEntries={["/ua/suzirya/taurus"]}><ConstellationGuide slug="taurus" /></MemoryRouter>);
  expect(await screen.findByRole("heading", { level: 1, name: "Телець" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Знайти на карті/ })).toHaveAttribute("href", "/ua/suzirya?focus=Tau&season=winter#sky-map");
  expect(screen.getByRole("heading", { name: "M45 — Плеяди" })).toBeInTheDocument();
  const schema = JSON.parse(document.querySelector('script[data-route-seo]').textContent);
  expect(schema.dateModified).toBe("2026-10-30");
});
