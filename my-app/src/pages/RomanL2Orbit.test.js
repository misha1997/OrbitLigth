import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18next from "../i18n";
import RomanL2Orbit from "./RomanL2Orbit";

jest.mock("./RomanL2Scene", () => ({ __esModule: true, default: ({ running, resetKey }) => <div data-testid="orbit-scene" data-running={String(running)} data-reset={resetKey} /> }));

let notifyIntersection;
let notifyReducedMotion;
const disconnect = jest.fn();
const originalObserver = global.IntersectionObserver;
const originalMatchMedia = window.matchMedia;
const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
const media = { matches: false, addEventListener: (_, callback) => { notifyReducedMotion = callback; }, removeEventListener: jest.fn() };
beforeEach(() => {
  i18next.changeLanguage("en");
  media.matches = false;
  global.IntersectionObserver = jest.fn(callback => { notifyIntersection = callback; return { observe: jest.fn(), disconnect }; });
  window.matchMedia = () => media;
});
afterEach(() => {
  global.IntersectionObserver = originalObserver;
  window.matchMedia = originalMatchMedia;
  if (hiddenDescriptor) Object.defineProperty(document, "hidden", hiddenDescriptor);
  else delete document.hidden;
  jest.clearAllMocks();
});

test("loads near the viewport, pauses offscreen and supports playback and view reset", async () => {
  const view = render(<RomanL2Orbit />);
  expect(screen.queryByTestId("orbit-scene")).not.toBeInTheDocument();
  act(() => notifyIntersection([{ isIntersecting: true }]));
  const scene = await screen.findByTestId("orbit-scene");
  expect(scene).toHaveAttribute("data-running", "true");
  fireEvent.click(screen.getByRole("button", { name: "Pause animation" }));
  expect(scene).toHaveAttribute("data-running", "false");
  fireEvent.click(screen.getByRole("button", { name: "Play animation" }));
  expect(scene).toHaveAttribute("data-running", "true");
  act(() => notifyIntersection([{ isIntersecting: false }]));
  expect(scene).toHaveAttribute("data-running", "false");
  act(() => notifyIntersection([{ isIntersecting: true }]));
  expect(scene).toHaveAttribute("data-running", "true");
  fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
  expect(scene).toHaveAttribute("data-reset", "1");
  view.unmount();
  expect(disconnect).toHaveBeenCalledTimes(1);
});

test("pauses while the browser tab is hidden and resumes when it returns", async () => {
  render(<RomanL2Orbit />);
  act(() => notifyIntersection([{ isIntersecting: true }]));
  const scene = await screen.findByTestId("orbit-scene");
  Object.defineProperty(document, "hidden", { configurable: true, value: true });
  fireEvent(document, new Event("visibilitychange"));
  expect(scene).toHaveAttribute("data-running", "false");
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  fireEvent(document, new Event("visibilitychange"));
  expect(scene).toHaveAttribute("data-running", "true");
});

test("reduced motion starts paused but permits explicit playback", async () => {
  media.matches = true;
  render(<RomanL2Orbit />);
  act(() => notifyIntersection([{ isIntersecting: true }]));
  const scene = await screen.findByTestId("orbit-scene");
  expect(scene).toHaveAttribute("data-running", "false");
  fireEvent.click(screen.getByRole("button", { name: "Play animation" }));
  expect(scene).toHaveAttribute("data-running", "true");
  act(() => notifyReducedMotion());
  await waitFor(() => expect(scene).toHaveAttribute("data-running", "false"));
});
