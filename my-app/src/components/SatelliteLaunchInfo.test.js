import { act, render, screen } from "@testing-library/react";
import SatelliteLaunchInfo from "./SatelliteLaunchInfo";
import { getSatelliteLaunch } from "../lib/api";

jest.mock("../lib/api", () => ({ getSatelliteLaunch: jest.fn() }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: key => key, i18n: { resolvedLanguage: "en" } }) }));

const result = (id, name) => ({ norad_id: id, available: true, found: true, stale: false, providers: [{ code: name, name }], owners: [], rocket: "Test rocket", launch_date: "2019-11-11" });

beforeEach(() => getSatelliteLaunch.mockReset());

test("embedded and fullscreen panels share the pending enrichment request", async () => {
  let finish;
  getSatelliteLaunch.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const view = render(<><SatelliteLaunchInfo norad={44713} /><SatelliteLaunchInfo norad={44713} /></>);
  expect(getSatelliteLaunch).toHaveBeenCalledTimes(1);
  await act(async () => finish(result(44713, "SpaceX")));
  expect(screen.getAllByText("SpaceX")).toHaveLength(2);
  view.rerender(<><SatelliteLaunchInfo norad={44713} /><SatelliteLaunchInfo norad={44713} /></>);
  expect(getSatelliteLaunch).toHaveBeenCalledTimes(1);
});

test("a slow response for the old selection cannot replace the new object", async () => {
  let finishOld, finishNew;
  getSatelliteLaunch.mockImplementation(id => new Promise(resolve => { if (id === 25544) finishOld = resolve; else finishNew = resolve; }));
  const view = render(<SatelliteLaunchInfo norad={25544} />);
  view.rerender(<SatelliteLaunchInfo norad={48274} />);
  await act(async () => finishNew(result(48274, "CALT")));
  expect(screen.getByText("CALT")).toBeTruthy();
  await act(async () => finishOld(result(25544, "RVSNR")));
  expect(screen.queryByText("RVSNR")).toBeNull();
  expect(screen.getByText("CALT")).toBeTruthy();
});
