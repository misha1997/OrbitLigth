/* eslint-disable testing-library/no-node-access -- Metadata lives in document.head and has no accessible role. */
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

test.each([
  ["/ua/suzirya", "uk", "https://orbitlight.space/ua/suzirya"],
  ["/en/constellations", "en", "https://orbitlight.space/en/constellations"],
])("navigation to %s replaces a filtered news page's SEO metadata", (pathname, lang, canonical) => {
  mockLocation = { pathname: "/en/news", search: "?q=Moon" };
  const { rerender } = renderHook(() => useSeo());
  expect(document.querySelector('meta[name="robots"]').content).toBe("noindex,follow");
  mockLocation = { pathname, search: "" };
  rerender();
  expect(document.title).toBe("title.constellations");
  expect(document.querySelector('meta[name="description"]').content).toBe("seo.desc.constellations");
  expect(document.querySelector('link[rel="canonical"]').href).toBe(canonical);
  expect(document.querySelector('meta[property="og:url"]').content).toBe(canonical);
  expect(document.querySelector('meta[name="robots"]').content).toBe("index,follow,max-image-preview:large");
  expect(document.querySelector('link[hreflang="uk"]').href).toBe("https://orbitlight.space/ua/suzirya");
  expect(document.querySelector('link[hreflang="en"]').href).toBe("https://orbitlight.space/en/constellations");
  const schema = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
  expect(schema["@type"]).toBe("WebPage");
  expect(schema.url).toBe(canonical);
  expect(schema.inLanguage).toBe(lang);
  expect(schema.breadcrumb.itemListElement[1].item).toBe(canonical);
});
