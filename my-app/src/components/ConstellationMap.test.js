/* eslint-disable testing-library/no-container, testing-library/no-node-access -- These regressions inspect SVG duplication and mutations, rather than accessible text. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ConstellationMap from "./ConstellationMap";

const mockT = key => key;
let mockFullscreenProps;
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: mockT }) }));
jest.mock("../context/LanguageContext", () => ({ useLang: () => ({ lang: "en" }) }));
jest.mock("../context/LocationContext", () => ({ useLoc: () => ({ loc: null }) }));
jest.mock("./ConstellationMapFullscreenPixi", () => ({ __esModule: true, default: props => {
  mockFullscreenProps = props;
  return <div data-testid="fullscreen" />;
} }));

const catalog = {
  constellations: [{ id: "UMa", name: "Ursa Major", uk: "Велика Ведмедиця", la: "UMa", ra: 0, dec: 89, lines: [[[0, 88], [10, 89]]] }],
  stars: [{ id: 1, ra: 0, dec: 89, mag: 4.5, name: "Test star", const: "UMa" }]
};
const previousFetch = global.fetch;
beforeEach(() => { global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => catalog }); });
afterAll(() => { global.fetch = previousFetch; });

test("hover leaves the sky subtree untouched and constellation stars render once", async () => {
  const { container } = render(<ConstellationMap />);
  await waitFor(() => expect(container.querySelector("svg")).not.toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Zoom Out" }));
  fireEvent.click(screen.getByRole("button", { name: "Zoom Out" }));
  await waitFor(() => expect(container.querySelectorAll(".const-star")).toHaveLength(1));
  expect(container.querySelectorAll(".bg-star")).toHaveLength(0);
  const svg = container.querySelector("svg");
  const changes = jest.fn();
  const observer = new MutationObserver(changes);
  observer.observe(svg, { subtree: true, childList: true, attributes: true });
  fireEvent.mouseMove(container.querySelector(".const-hit"), { clientX: 50, clientY: 60 });
  expect(screen.getByText("Test star")).toBeInTheDocument();
  await Promise.resolve();
  expect(changes).not.toHaveBeenCalled();
  observer.disconnect();
});

test("geolocation applies actual coordinates and current time to fullscreen", async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "geolocation");
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
    getCurrentPosition: success => success({ coords: { latitude: -33.86, longitude: 151.21 } })
  } });
  try {
    render(<ConstellationMap />);
    fireEvent.click(screen.getByRole("button", { name: /Show my sky/ }));
    fireEvent.click(screen.getByRole("button", { name: "Open fullscreen" }));
    await screen.findByTestId("fullscreen");
    expect(mockFullscreenProps.latLon).toEqual({ lat: -33.86, lon: 151.21 });
    expect(mockFullscreenProps.seasonFilter).toBeNull();
    expect(Math.abs(mockFullscreenProps.currentTime.getTime() - Date.now())).toBeLessThan(5000);
  } finally {
    if (original) Object.defineProperty(navigator, "geolocation", original);
    else delete navigator.geolocation;
  }
});

test("a field-guide link centres the chosen constellation without manual pan", async () => {
  const { container } = render(<ConstellationMap focusConst="UMa" initialSeason="spring" />);
  await waitFor(() => expect(container.querySelectorAll(".const-star")).toHaveLength(1));
  expect(container.querySelector(".const-group.active")).not.toBeNull();
  expect(container.querySelector('svg > g').getAttribute("transform")).not.toContain("translate(0, 0)");
});
