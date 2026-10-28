/* eslint-disable testing-library/no-node-access -- Inspect the mocked Pixi scene graph to verify culling and resource disposal. */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ConstellationMapFullscreenPixi from "./ConstellationMapFullscreenPixi";

const mockT = key => key;
const mockApps = [];
const mockSprites = [];
const mockTexts = [];
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: mockT }) }));
jest.mock("../context/LanguageContext", () => ({ useLang: () => ({ lang: "en" }) }));
jest.mock("pixi.js", () => {
  const vector = () => ({ x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y; } });
  class Container {
    constructor() {
      this.children = [];
      this.position = vector(); this.scale = vector(); this.pivot = vector(); this.anchor = vector();
      this.alpha = 1;
    }
    get x() { return this.position.x; }
    get y() { return this.position.y; }
    addChild(child) { this.children.push(child); child.parent = this; return child; }
    removeChild(child) { this.children = this.children.filter(c => c !== child); }
    removeChildren() { const children = this.children; this.children = []; return children; }
    on(event, handler) { this.handlers ||= {}; this.handlers[event] = handler; return this; }
    destroy(options) { this.destroyed = true; if (options?.children) this.children.forEach(c => c.destroy(options)); }
  }
  class Graphics extends Container {
    constructor() { super(); this.circles = []; this.strokes = []; }
    clear() { this.circles = []; this.strokes = []; }
    lineStyle(style) { this.strokes.push(style); }
    drawCircle(x, y, radius) { this.circles.push({ x, y, radius }); }
    beginFill() {} endFill() {} drawEllipse() {} moveTo() {} lineTo() {}
  }
  class Sprite extends Container { constructor() { super(); mockSprites.push(this); } }
  class Text extends Container { constructor(text, style) { super(); this.text = text; this.style = { ...style }; mockTexts.push(this); } }
  class Application {
    constructor({ width, height }) {
      this.view = global.document.createElement("canvas");
      this.stage = new Container();
      this.screen = { width, height };
      this.renderer = {
        width, height, resolution: 1, generateTexture: () => ({}),
        resize: (w, h) => { this.screen.width = this.renderer.width = w; this.screen.height = this.renderer.height = h; }
      };
      this.ticker = { add: fn => { this.tick = fn; }, remove: () => {} };
      mockApps.push(this);
    }
    destroy(removeView, options) { this.stage.destroy(options); this.view.remove(); }
  }
  return { Container, Graphics, Sprite, Text, Application, TextStyle: class { constructor(style) { Object.assign(this, style); } }, Circle: class {} };
});

const date = new Date("2026-10-28T18:00:00Z");
const lst = ((280.46061837 + 360.98564736629 * (date.getTime() / 86400000 + 2440587.5 - 2451545) + 30.52) % 360 + 360) % 360;
const catalog = [
  // These are above the horizon but outside the initial viewport.
  ...Array.from({ length: 1000 }, (_, i) => [i + 1, lst + 100, 20, 4, "", "", "UMa"]),
  ...Array.from({ length: 10 }, (_, i) => [i + 1001, lst + i / 10, 50, 4, "", "", "UMa"]),
  [0, lst, 50, -26.7, "Sol", null, null]
];
const previousFetch = global.fetch;
beforeEach(() => {
  mockApps.length = mockSprites.length = mockTexts.length = 0;
  global.fetch = jest.fn(async url => ({ ok: true, json: async () => url.includes("real_stars") ? catalog : { items: [] } }));
});
afterAll(() => { global.fetch = previousFetch; });

test("fullscreen only materializes visible stars and selection preserves the scene", async () => {
  const props = {
    onClose: () => {}, activeConst: "UMa", setActiveConst: () => {}, currentTime: date,
    latLon: { lat: 50.45, lon: 30.52 }, seasonFilter: null,
    constellationData: { constellations: [] }
  };
  const { rerender, unmount } = render(<ConstellationMapFullscreenPixi {...props} />);
  await waitFor(() => expect(mockSprites.filter(s => !s.destroyed)).toHaveLength(10));
  const creations = mockSprites.length;
  const texts = mockTexts.length;
  rerender(<ConstellationMapFullscreenPixi {...props} activeConst="Ori" />);
  expect(mockSprites).toHaveLength(creations);
  expect(mockTexts).toHaveLength(texts);
  expect(mockSprites.filter(s => !s.destroyed).every(s => s.tint === 0xffffff)).toBe(true);

  const world = mockApps[0].stage.children[0];
  const star = mockSprites.find(sprite => !sprite.destroyed);
  act(() => star.handlers.pointertap({ stopPropagation() {} }));
  const details = screen.getByRole("region", { name: "Object details" });
  expect(details).toHaveTextContent("Illustration · not a photograph");
  expect(details).toHaveTextContent("HYG 1001");
  expect(details).not.toHaveTextContent("HIP 1001");
  expect(details).not.toHaveTextContent("Blue-white");
  const zoomControls = screen.getByRole("group", { name: "Map zoom" });
  expect(details.contains(zoomControls)).toBe(false);
  expect(zoomControls.closest(".cfm-top-bar")).not.toBeNull();
  expect(screen.getByRole("dialog")).toHaveClass("cfm-has-details");
  const ring = world.children[world.children.length - 1];
  const expectedCircles = [{ x: 0, y: 0, radius: 25.5 }, { x: 0, y: 0, radius: 15 }];
  expect(ring.circles).toEqual(expectedCircles);
  expect(ring.position).toMatchObject({ x: star.x, y: star.y });
  // Even at deep zoom, the geometry retains enough vertices for smooth circles.
  for (let i = 0; i < 24; i++) fireEvent.click(screen.getByRole("button", { name: "Zoom In" }));
  expect(world.scale.x).toBeGreaterThan(1000);
  expect(ring.circles).toEqual(expectedCircles);
  expect(world.scale.x * ring.scale.x).toBeCloseTo(1);
  expect(ring.strokes.map(style => style.width)).toEqual([1.5, 2]);
  fireEvent.click(screen.getByRole("button", { name: "Close object details" }));
  expect(ring.circles).toHaveLength(0);
  expect(screen.getByRole("dialog")).not.toHaveClass("cfm-has-details");
  fireEvent.click(screen.getByRole("button", { name: "Reset View" }));
  // Move the offscreen group into the viewport; the index must materialize it.
  act(() => { world.position.set(world.x - 700, world.y); mockApps[0].tick(); });
  expect(mockSprites.filter(s => !s.destroyed).length).toBeGreaterThan(10);

  fireEvent(window, new Event("resize"));
  expect(world.pivot.x).toBe(window.innerWidth / 2);
  expect(world.pivot.y).toBe(window.innerHeight / 2);
  unmount();
  expect(mockSprites.every(s => s.destroyed)).toBe(true);
});
