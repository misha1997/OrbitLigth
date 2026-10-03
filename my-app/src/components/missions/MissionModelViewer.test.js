import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MissionModelViewer from "./MissionModelViewer";
import { MISSION_DETAILS } from "../../lib/missionDetails";
import content from "../../i18n/mission-detail.en.json";

jest.mock("@react-three/fiber", () => ({ Canvas: () => <div data-testid="model-canvas" />, useFrame: jest.fn(), useThree: jest.fn() }));
jest.mock("@react-three/drei", () => ({ OrbitControls: () => null, Stars: () => null, useGLTF: jest.fn() }));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = jest.fn(function () { this.setAttribute("open", ""); });
  HTMLDialogElement.prototype.close = jest.fn(function () { this.removeAttribute("open"); });
});

test.each(["newhorizons", "juno", "chandra"])("%s opens a fullscreen model, then restores focus and page scrolling", (mission) => {
  document.body.style.overflow = "auto";
  render(<MissionModelViewer model={MISSION_DETAILS[mission].model} name={content[mission].name} stats={content[mission].stats} ui={content.ui.model} />);
  const trigger = screen.getByRole("button", { name: `Explore in 3D: ${content[mission].name}` });
  userEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: `${content[mission].name} · 3D` });
  expect(document.body.style.overflow).toBe("hidden");
  expect(within(dialog).getByRole("button", { name: /Reset view/ })).toBeInTheDocument();
  expect(within(dialog).getByText(content[mission].stats[0].value)).toBeInTheDocument();
  fireEvent(dialog, new Event("cancel", { bubbles: false }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe("auto");
  expect(trigger).toHaveFocus();
  userEvent.click(trigger);
  userEvent.click(screen.getByRole("button", { name: "Close 3D view" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  document.body.style.overflow = "";
});

test("Chandra retains the model author's attribution and license", () => {
  render(<MissionModelViewer model={MISSION_DETAILS.chandra.model} name="Chandra" stats={content.chandra.stats} ui={content.ui.model} />);
  expect(screen.getByRole("link", { name: "uperesito" })).toHaveAttribute("href", MISSION_DETAILS.chandra.model.credit.source);
  expect(screen.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
});
