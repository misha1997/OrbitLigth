import { renderHook } from "@testing-library/react";
import { useSeo } from "./useSeo";

let mockLocation = { pathname: "/en/news", search: "?page=2" };
jest.mock("react-router-dom", () => ({ useLocation: () => mockLocation }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: key => key }) }));

afterEach(() => { document.head.innerHTML = ""; });

test("archive pagination keeps its own canonical and language alternates", () => {
  renderHook(() => useSeo());
  expect(document.querySelector('link[rel="canonical"]').href).toBe("https://orbitlight.space/en/news?page=2");
  expect(document.querySelector('link[hreflang="uk"]').href).toBe("https://orbitlight.space/ua/novyny?page=2");
});

test("article navigation updates metadata and structured data", () => {
  mockLocation = { pathname: "/en/news/test-article", search: "" };
  renderHook(() => useSeo({ title: "Test article", excerpt: "Description", image: "/news-img/test.jpg", source: "NASA", date: "27.09.2026" }));
  expect(document.querySelector('meta[property="og:type"]').content).toBe("article");
  expect(document.querySelector('meta[property="og:image"]').content).toBe("https://orbitlight.space/news-img/test.jpg");
  const schema = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
  expect(schema.headline).toBe("Test article");
  expect(schema.datePublished).toBe("2026-09-27");
});


test("filtered results preserve their canonical and are not indexed", () => {
  mockLocation = { pathname: "/en/news", search: "?page=1&q=Moon&category=missions" };
  renderHook(() => useSeo());
  expect(document.querySelector('link[rel="canonical"]').href).toBe("https://orbitlight.space/en/news?page=1&q=Moon&category=missions");
  expect(document.querySelector('meta[name="robots"]').content).toBe("noindex,follow");
});
