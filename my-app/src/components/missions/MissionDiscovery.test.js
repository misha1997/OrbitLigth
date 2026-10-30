import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18next from "../../i18n";
import { useApi } from "../../hooks/useApi";
import MissionDetail from "./MissionDetail";
import GaiaParallaxLab from "./GaiaParallaxLab";
import { pathFor } from "../../lib/seo";

jest.mock("../../hooks/useApi", () => ({ useApi: jest.fn() }));
jest.mock("./MissionModelViewer", () => ({ __esModule: true, default: () => <div data-testid="mission-model" /> }));

beforeEach(() => {
  jest.clearAllMocks();
  i18next.changeLanguage("en");
});

test.each(["perseverance", "cassini", "osirisrex", "gaia", "kepler", "spitzer", "pioneer10", "pioneer11", "galileo", "curiosity"].flatMap(mission => ["uk", "en"].map(lang => [mission, lang])))
("%s supports exploration, quizzes and a signal scenario in %s without live API requests", async (mission, lang) => {
  i18next.changeLanguage(lang);
  const content = i18next.t(`missionDetail.${mission}`, { returnObjects: true });
  const signal = i18next.t("missionDetail.ui.signal", { returnObjects: true });
  const { container } = render(<MemoryRouter initialEntries={[pathFor(mission, lang)]}><MissionDetail mission={mission} /></MemoryRouter>);
  await screen.findByTestId("mission-model");
  expect(useApi).not.toHaveBeenCalled();
  expect(container.querySelector("#live")).not.toBeInTheDocument();
  expect(screen.getByText(content.status.title)).toBeInTheDocument();

  const destinations = screen.getByRole("group", { name: content.exploration.choose });
  content.exploration.stops.forEach((stop, index) => {
    const button = within(destinations).getAllByRole("button")[index];
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    const detail = container.querySelector(`#${mission}-destination`);
    expect(detail).toHaveTextContent(stop.body);
    expect(within(detail).getByRole("link")).toHaveAttribute("href", stop.source);
  });
  fireEvent.click(screen.getByRole("button", { name: `1. ${content.exploration.stops[0].name}` }));
  expect(container.querySelector(`#${mission}-destination`)).toHaveTextContent(content.exploration.stops[0].body);

  const calculator = container.querySelector(".mission-signal");
  const slider = within(calculator).getByRole("slider");
  fireEvent.change(slider, { target: { value: mission === "gaia" ? "1000000" : mission === "kepler" ? "100000000" : "299000000" } });
  expect(calculator).not.toHaveTextContent("NaN");
  const expected = mission === "gaia" ? "3.34" : mission === "kepler" ? "5.6" : "16.6";
  expect(calculator).toHaveTextContent(lang === "en" ? expected : expected.replace(".", ","));
  fireEvent.click(within(calculator).getByRole("button", { name: signal.reset }));
  expect(slider.value).toBe({ perseverance: "225000000", cassini: "1400000000", osirisrex: "300000000", gaia: "1500000", kepler: "150000000", spitzer: "200000000", pioneer10: "12230000000", pioneer11: "6400000000", galileo: "628000000", curiosity: "225000000" }[mission]);

  const quiz = container.querySelector("#quiz");
  content.quiz.questions.forEach((question, index) => {
    expect(within(quiz).getByRole("group")).toHaveAccessibleName(question.question);
    // Include both incorrect and correct answers; feedback must always explain the science.
    const chosen = index === 0 ? (question.correct + 1) % question.options.length : question.correct;
    fireEvent.click(within(quiz).getByRole("button", { name: question.options[chosen] }));
    expect(within(quiz).getByRole("status")).toHaveTextContent(question.explanation);
    expect(within(quiz).getByRole("status")).toHaveTextContent(chosen === question.correct ? content.quiz.correct : content.quiz.incorrect);
    question.options.forEach(option => expect(within(quiz).getByRole("button", { name: option })).toBeDisabled());
    fireEvent.click(within(quiz).getByRole("button", { name: new RegExp(index === 2 ? content.quiz.restart : content.quiz.next) }));
  });
  expect(within(quiz).getByRole("group")).toHaveAccessibleName(content.quiz.questions[0].question);
  expect(within(quiz).queryByRole("status")).not.toBeInTheDocument();
});

test.each(["uk", "en"])("Gaia parallax decreases with distance and the viewpoint changes in %s", lang => {
  i18next.changeLanguage(lang);
  const content = i18next.t("missionDetail.gaia.parallax", { returnObjects: true });
  const { container } = render(<GaiaParallaxLab content={content} />);
  const results = container.querySelector(".mission-parallax-results");
  expect(results).toHaveTextContent(`10 ${content.mas}`);
  fireEvent.change(screen.getByRole("slider", { name: new RegExp(content.distance) }), { target: { value: "1000" } });
  expect(results).toHaveTextContent(`1 ${content.mas}`);
  expect(results).toHaveTextContent(lang === "en" ? "3,261.56" : "3 261,56");
  const diagram = screen.getByRole("img", { name: content.diagram });
  const oldGeometry = diagram.innerHTML;
  fireEvent.click(screen.getByRole("button", { name: content.epochs[1] }));
  expect(diagram.innerHTML).not.toBe(oldGeometry);
  expect(screen.getByRole("button", { name: content.epochs[1] })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: content.epochs[0] })).toHaveAttribute("aria-pressed", "false");
  fireEvent.change(screen.getByRole("slider"), { target: { value: "10" } });
  expect(results).toHaveTextContent(`100 ${content.mas}`);
});
