import { act, fireEvent, render, screen } from "@testing-library/react";
import i18next from "../../i18n";
import { useApi } from "../../hooks/useApi";
import { MissionTelemetry, MissionContact, SignalCalculator } from "./MissionLiveData";
import MissionOrbitExplorer from "./MissionOrbitExplorer";
import base from "../../i18n/mission-detail.en.json";

jest.mock("../../hooks/useApi", () => ({ useApi: jest.fn() }));
jest.mock("./MissionOrbitScene", () => ({ __esModule: true, default: ({ selected }) => <div data-testid="orbit-scene">{selected}</div> }));

const data = { available: true, stale: false, updated_at: "2026-10-04T10:00:00Z", distance_earth_km: 149597870.7, distance_center_km: 100000, speed_center_kms: 12, light_time_seconds: 499, trajectory: [
  { time: 1000000, position: [3, 4, 0], velocity: [0, 0, 1] },
  { time: 1003600, position: [6, 8, 0], velocity: [0, 0, 2] }
] };
beforeEach(() => { i18next.changeLanguage("en"); useApi.mockReturnValue({ data: null, loading: false, error: null, refetch: jest.fn() }); });

test("missing telemetry offers a retry without four empty metric cards", () => {
  const refetch = jest.fn();
  render(<MissionTelemetry mission="juno" data={{ available: false }} loading={false} error={new Error("offline")} refetch={refetch} />);
  expect(screen.queryByText(i18next.t("missionDetail.ui.live.earth"))).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

test("distance units convert and a failed refresh labels retained data as cached", () => {
  const props = { mission: "juno", data, refetch: jest.fn() };
  const { rerender } = render(<MissionTelemetry {...props} />);
  expect(screen.getByText("149,597,871")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "AU" }));
  expect(screen.getByText("1")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(props.refetch).toHaveBeenCalledTimes(1);
  rerender(<MissionTelemetry {...props} error={new Error("offline")} />);
  expect(screen.getByRole("status")).toHaveTextContent("Cached data");
});

test("signal calculator distinguishes API distance from a manual example", () => {
  render(<SignalCalculator mission="chandra" data={{ ...data, distance_earth_km: 299792.458 }} />);
  expect(screen.getByText("1 s")).toBeInTheDocument();
  expect(screen.getByText("2 s")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("slider"), { target: { value: "100000" } });
  expect(screen.getByText(/Illustrative calculation/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Use API distance" }));
  expect(screen.getByText(/Using the latest available/)).toBeInTheDocument();
});

test("DSN shows only active signals for this mission and suppresses stale links", () => {
  const dsn = { timestamp_ms: Date.now(), stations: [{ friendly_name: "Madrid", dishes: [{ name: "DSS-63", up_signals: [
    { active: true, spacecraft_code: "JNO", band: "X", data_rate: 1000 },
    { active: true, spacecraft_code: "NHPC", band: "Ka" }
  ], down_signals: [] }] }] };
  useApi.mockReturnValue({ data: dsn });
  const { rerender } = render(<MissionContact mission="juno" />);
  expect(screen.getByText("Madrid · DSS-63")).toBeInTheDocument();
  expect(screen.queryByText(/Ka/)).not.toBeInTheDocument();
  useApi.mockReturnValue({ data: { ...dsn, timestamp_ms: Date.now() - 3600000 } });
  rerender(<MissionContact mission="juno" />);
  expect(screen.getByRole("status")).toHaveTextContent("out of date");
  expect(screen.queryByText("Madrid · DSS-63")).not.toBeInTheDocument();
});

test("time scrubber changes only the diagram and playback can be paused", async () => {
  render(<MissionOrbitExplorer mission="juno" data={data} content={base.juno} accent="#fff" />);
  expect(await screen.findByTestId("orbit-scene")).toHaveTextContent("1");
  fireEvent.change(screen.getByRole("slider"), { target: { value: "0" } });
  expect(screen.getByTestId("orbit-scene")).toHaveTextContent("0");
  jest.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "Play trajectory" }));
  act(() => jest.advanceTimersByTime(120));
  expect(screen.getByTestId("orbit-scene")).toHaveTextContent("1");
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  jest.useRealTimers();
  fireEvent.click(screen.getByRole("button", { name: "NASA Eyes" }));
  expect(screen.getByTitle("NASA Eyes · Juno")).toHaveAttribute("src", "https://eyes.nasa.gov/apps/solar-system/");
});

test.each([["tess", "tess"], ["europaclipper", "eurc"]])("%s matches NASA's lowercase DSN spacecraft code", (mission, spacecraft_code) => {
  useApi.mockReturnValue({ data: { timestamp_ms: Date.now(), stations: [{ friendly_name: "Goldstone", dishes: [{ name: "DSS-14", up_signals: [], down_signals: [
    { active: true, spacecraft_code, band: "X", data_rate: 1000 },
    { active: true, spacecraft_code: "juno", band: "Ka" }
  ] }] }] } });
  render(<MissionContact mission={mission} />);
  expect(screen.getByText(/Goldstone/)).toBeInTheDocument();
  expect(screen.queryByText(/Ka/)).not.toBeInTheDocument();
});

test("missing ephemeris uses a clearly labelled schematic without a time slider", () => {
  const refetch = jest.fn();
  render(<MissionOrbitExplorer mission="juno" data={{ available: false }} content={base.juno} refetch={refetch} />);
  expect(screen.getByText(/This is not live tracking/)).toBeInTheDocument();
  expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(refetch).toHaveBeenCalledTimes(1);
});
