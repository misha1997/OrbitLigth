import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Constellations from "./Constellations";

jest.mock("../context/LanguageContext", () => ({ useLang: () => ({ lang: "en" }) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: key => key }) }));
jest.mock("../hooks/useSeo", () => ({ useSeo: jest.fn() }));
jest.mock("../components/ConstellationMap", () => () => <div>Map</div>);
jest.mock("../components/ConstellationDirectory", () => () => <section id="field-guides">Guides</section>);

test.each([
  ["/en/constellations#field-guides", "field-guides"],
  ["/en/constellations?focus=Tau#sky-map", "sky-map"],
])("%s scrolls to its requested section after the page mounts", (path, target) => {
  const previousScroll = HTMLElement.prototype.scrollIntoView;
  const scroll = jest.fn();
  HTMLElement.prototype.scrollIntoView = scroll;
  let frame;
  const raf = jest.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frame = callback; return 1; });
  const cancel = jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  try {
    const view = render(<MemoryRouter initialEntries={[path]}><Constellations /></MemoryRouter>);
    act(() => frame());
    expect(scroll).toHaveBeenCalledWith({ block: "start" });
    expect(scroll.mock.instances[0]).toHaveAttribute("id", target);
    view.unmount();
    expect(cancel).toHaveBeenCalledWith(1);
  } finally {
    raf.mockRestore();
    cancel.mockRestore();
    HTMLElement.prototype.scrollIntoView = previousScroll;
  }
});
