import { fireEvent, render, screen } from "@testing-library/react";
import ConstellationDirectory from "./ConstellationDirectory";

test("the expanded directory finds stars, objects and names in either language", () => {
  render(<ConstellationDirectory lang="uk" />);
  expect(screen.getAllByRole("link")).toHaveLength(20);
  const search = screen.getByRole("searchbox", { name: "Пошук за назвою, зорею або об’єктом" });
  fireEvent.change(search, { target: { value: "  Polaris " } });
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "Мала Ведмедиця" })).toBeInTheDocument();
  fireEvent.change(search, { target: { value: "M 45" } });
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "Телець" })).toBeInTheDocument();
  fireEvent.change(search, { target: { value: "bootes" } });
  expect(screen.getByRole("heading", { name: "Волопас" })).toBeInTheDocument();
  fireEvent.change(search, { target: { value: "візничий" } });
  expect(screen.getByRole("heading", { name: "Візничий" })).toBeInTheDocument();
});

test("search combines with multiple convenient seasons and reset restores all guides", () => {
  render(<ConstellationDirectory lang="en" />);
  const search = screen.getByRole("searchbox");
  const season = screen.getByRole("combobox", { name: "Convenient season" });
  fireEvent.change(search, { target: { value: "taurus" } });
  fireEvent.change(season, { target: { value: "autumn" } });
  expect(screen.getByRole("heading", { name: "Taurus" })).toBeInTheDocument();
  fireEvent.change(season, { target: { value: "summer" } });
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.getByText("No guides found. Try another name or reset the filters.")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Found: 0 / 20");
  fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  expect(search).toHaveValue("");
  expect(season).toHaveValue("");
  expect(screen.getAllByRole("link")).toHaveLength(20);
  expect(screen.getByRole("button", { name: "Reset filters" })).toBeDisabled();
  fireEvent.change(search, { target: { value: "Полярна" } });
  fireEvent.change(season, { target: { value: "winter" } });
  expect(screen.getByRole("heading", { name: "Ursa Minor" })).toBeInTheDocument();
});

test("markup typed in search is treated as text", () => {
  render(<ConstellationDirectory lang="en" />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: '<img src=x onerror="alert(1)">' } });
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
