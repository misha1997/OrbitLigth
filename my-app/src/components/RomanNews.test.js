import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RomanNews from "./RomanNews";
import { getNews } from "../lib/api";
import i18next from "../i18n";

jest.mock("../lib/api", () => ({ getNews: jest.fn() }));
let mockLang = "en";
jest.mock("../context/LanguageContext", () => ({ useLang: () => ({ lang: mockLang }) }));

const article = { id: 12, slug: "roman-wfi", title: "Roman instrument update", image: "/roman.jpg", category: "missions", source: "NASA", date: "25.09.2026" };
const mount = () => render(<MemoryRouter><RomanNews /></MemoryRouter>);

beforeEach(() => {
  jest.clearAllMocks();
  mockLang = "en";
  i18next.changeLanguage("en");
});

test("requests mission articles and uses the shared news cards and filtered archive link", async () => {
  getNews.mockResolvedValue({ items: [article] });
  mount();
  const link = await screen.findByRole("link", { name: /Roman instrument update/ });
  expect(getNews).toHaveBeenCalledWith("en", { page: 0, pageSize: 6, q: "Roman" });
  expect(link).toHaveClass("news-card");
  expect(link).toHaveAttribute("href", "/en/news/roman-wfi");
  expect(within(link).getByAltText("")).toHaveAttribute("src", "/roman.jpg");
  expect(screen.getByRole("link", { name: "All Roman news →" })).toHaveAttribute("href", "/en/news?q=Roman");
});

test("empty archive shows a message instead of unrelated articles or permanent skeletons", async () => {
  getNews.mockResolvedValue({ items: [] });
  mount();
  expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  expect(await screen.findByText(/There are no Roman telescope articles/)).toBeInTheDocument();
  expect(screen.getAllByRole("link")).toHaveLength(1);
});

test("retry keeps the mission filter and Ukrainian article routes", async () => {
  mockLang = "uk";
  i18next.changeLanguage("uk");
  getNews.mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce({ items: [article] });
  mount();
  const alert = await screen.findByRole("alert");
  fireEvent.click(within(alert).getByRole("button"));
  expect(await screen.findByRole("link", { name: /Roman instrument update/ })).toHaveAttribute("href", "/ua/novyny/roman-wfi");
  expect(getNews).toHaveBeenLastCalledWith("uk", { page: 0, pageSize: 6, q: "Roman" });
});

test("articles without an archive slug link to their source", async () => {
  getNews.mockResolvedValue({ items: [{ ...article, id: null, slug: "", url: "https://science.nasa.gov/roman" }] });
  mount();
  const link = await screen.findByRole("link", { name: /Roman instrument update/ });
  expect(link).toHaveAttribute("href", "https://science.nasa.gov/roman");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
});
