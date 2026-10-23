import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NewsCard from "./NewsCard";
import { DEFAULT_NEWS_IMAGE } from "./NewsImage";
import "../i18n";

jest.mock("../context/LanguageContext", () => ({ useLang: () => ({ lang: "en" }) }));
const item = { id: 1, slug: "planet", title: "Planet discovery", category: "discoveries", image: "https://example.com/planet.jpg" };
const card = (value) => <MemoryRouter><NewsCard item={value} /></MemoryRouter>;

test.each([undefined, null, "", "  "])("missing image %p uses the local news preview", (image) => {
  const { container } = render(card({ ...item, image }));
  expect(container.querySelector("img")).toHaveAttribute("src", DEFAULT_NEWS_IMAGE);
  expect(screen.getByRole("link")).toHaveAttribute("href", "/en/news/planet");
});

test("a failed image switches to the default without retry loops and a different image can load", () => {
  const { container, rerender } = render(card(item));
  const image = container.querySelector("img");
  expect(image).toHaveAttribute("src", item.image);
  fireEvent.error(image);
  expect(image).toHaveAttribute("src", DEFAULT_NEWS_IMAGE);
  fireEvent.error(image);
  expect(image).toHaveAttribute("src", DEFAULT_NEWS_IMAGE);
  rerender(card({ ...item, image: "https://example.com/new.jpg" }));
  expect(image).toHaveAttribute("src", "https://example.com/new.jpg");
});
