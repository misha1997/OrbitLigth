import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NewsArticle from "./NewsArticle";
import { getNewsArticle } from "../lib/api";
import i18next from "../i18n";

jest.mock("../lib/api", () => ({ getNewsArticle: jest.fn() }));
jest.mock("../context/LanguageContext", () => ({ useLang: () => ({ lang: "en" }) }));

test("article embeds identify the site to YouTube while native clips still use a video player", async () => {
  i18next.changeLanguage("en");
  const slug = "jwst-reveals-a-lopsided-alien-world-with-blistering-evening-winds";
  const sources = [
    "https://www.youtube.com/embed/178AiyS7QXo",
    "https://www.youtube.com/embed/u6n4wrp9MGw",
    "https://www.youtube-nocookie.com/embed/178AiyS7QXo",
  ];
  getNewsArticle.mockResolvedValue({
    available: true,
    slug,
    title: "JWST Reveals a Lopsided Alien World with Blistering Evening Winds",
    category: "discoveries",
    body: "Before the videos.\n\n[VIDEO:0]\n\n[VIDEO:1]\n\n[VIDEO:2]\n\n[VIDEO:3]\n\nAfter the videos.",
    body_videos: [
      ...sources.map((src, position) => ({ src, position })),
      { position: 3, src: "https://www.nasa.gov/clip.mp4" },
    ],
  });

  const { container } = render(
    <MemoryRouter initialEntries={[`/en/news/${slug}`]}>
      <NewsArticle slug={slug} />
    </MemoryRouter>
  );

  await screen.findByRole("heading", { name: /JWST Reveals/ });
  expect(screen.getByText("Before the videos.")).toBeInTheDocument();
  expect(screen.getByText("After the videos.")).toBeInTheDocument();
  const players = screen.getAllByTitle("video");
  expect(players).toHaveLength(sources.length);
  players.forEach((player, index) => {
    expect(player).toHaveAttribute("src", sources[index]);
    // YouTube rejects embeds without a Referer (player error 153).
    // Send only the site's origin to the external player.
    expect(player).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    expect(player).toHaveAttribute("allowfullscreen");
  });
  expect(container.querySelector("video")).toHaveAttribute("src", "https://www.nasa.gov/clip.mp4");
  expect(container.querySelector("video")).toHaveAttribute("controls");
});
