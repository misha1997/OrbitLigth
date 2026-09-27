import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import News from "./News";
import { getNews, getNewsKeywords } from "../lib/api";
import i18next from "../i18n";

jest.mock("../lib/api", () => ({ getNews: jest.fn(), getNewsKeywords: jest.fn() }));
jest.mock("../components/home/HistoryWidget", () => () => null);
jest.mock("../context/LanguageContext", () => ({ useLang: () => ({ lang: "en" }) }));

function Probe() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="location">{location.pathname + location.search}</output><button onClick={() => navigate(-1)}>Test back</button></>;
}
function mount(url = "/en/news") {
  return render(<MemoryRouter initialEntries={[url]}><News /><Probe /></MemoryRouter>);
}
beforeEach(() => {
  i18next.changeLanguage("en");
  jest.clearAllMocks();
  window.scrollTo = jest.fn();
  getNewsKeywords.mockResolvedValue({ keywords: [] });
  getNews.mockImplementation((lang, args) => Promise.resolve({ items: [{ id: 1, slug: "moon", title: "Moon mission", category: "missions" }], total: 30, total_pages: 3, page: args.page }));
});

test("opening a filtered URL restores the search, category and pagination links", async () => {
  mount("/en/news?page=1&q=Moon&category=missions");
  await screen.findByText("Moon mission");
  expect(screen.getByRole("searchbox")).toHaveValue("Moon");
  expect(screen.getByRole("button", { name: "Missions" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("link", { name: "3", exact: true })).toHaveAttribute("href", "/en/news?page=2&q=Moon&category=missions");
  fireEvent.click(screen.getByRole("link", { name: "3", exact: true }));
  await waitFor(() => expect(getNews).toHaveBeenLastCalledWith("en", {page:2,pageSize:12,q:"Moon",category:"missions"}));
  fireEvent.click(screen.getByRole("button", {name:"Test back"}));
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("?page=1&q=Moon&category=missions"));
});

test("search and category changes reset the page and are preserved on reload", async () => {
  const view = mount("/en/news?page=2");
  await screen.findByText("Moon mission");
  fireEvent.change(screen.getByRole("searchbox"), {target:{value:"JWST"}});
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/en/news?q=JWST"));
  fireEvent.click(screen.getByRole("button",{name:"Missions"}));
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("q=JWST&category=missions"));
  const url=screen.getByTestId("location").textContent;
  view.unmount(); mount(url);
  expect(screen.getByRole("searchbox")).toHaveValue("JWST");
  await screen.findAllByText("Moon mission");
});

test("a network error has a retry button and is different from an empty result", async () => {
  getNews.mockRejectedValueOnce(new Error("HTTP 503"));
  mount("/en/news?q=Moon");
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the news");
  fireEvent.click(screen.getByRole("button",{name:"Try again"}));
  await screen.findByText("Moon mission");
  expect(getNews).toHaveBeenLastCalledWith("en",{page:0,pageSize:12,q:"Moon",category:"all"});
});

test("empty results explain the outcome and allow clearing filters", async () => {
  getNews.mockResolvedValue({items:[],total:0,total_pages:1,page:0});
  mount("/en/news?q=Nothing");
  await screen.findByText(/Nothing found/);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button",{name:"Clear filters and show all news"})[0]);
  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/en/news"));
});
