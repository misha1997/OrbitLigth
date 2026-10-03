// Curated science images mirrored in public/. Keep credits with each image.
const photo = (mission, file, credit, source) => ({ image: `/${mission}/images/${file}.jpg`, credit, source });
const nasaImage = (id) => `https://images.nasa.gov/details/${id}`;

export const MISSION_DETAILS = {
  newhorizons: {
    model: { url: "/newhorizons/models/new-horizons.glb", direction: [1, 0.8, 1.2] },
    accent: "#7FA8D9",
    hero: "/newhorizons/images/spacecraft.jpg",
    heroSource: nasaImage("PIA10075"),
    gallery: [
      photo("newhorizons", "pluto", "NASA / Johns Hopkins APL / SwRI", nasaImage("PIA19952")),
      photo("newhorizons", "charon", "NASA / Johns Hopkins APL / SwRI", nasaImage("PIA19968")),
      photo("newhorizons", "pluto_haze", "NASA / Johns Hopkins APL / SwRI", "https://science.nasa.gov/mission/new-horizons/"),
    ],
    sources: [
      { label: "NASA · New Horizons", url: "https://science.nasa.gov/mission/new-horizons/" },
      { label: "NASA · Kuiper Belt science", url: "https://science.nasa.gov/blogs/new-horizons/2016/12/22/exploring-pluto-and-a-billion-miles-beyond/" },
    ],
  },
  juno: {
    model: { url: "/juno/models/juno.glb", direction: [0.6, 1.4, 1] },
    accent: "#E8A374",
    hero: "/juno/images/spacecraft.jpg",
    heroSource: nasaImage("PIA13746"),
    gallery: [
      photo("juno", "clouds", "NASA / JPL-Caltech / SwRI / MSSS · Björn Jónsson", nasaImage("PIA21391")),
      photo("juno", "red_spot", "NASA / JPL-Caltech / SwRI / MSSS · Björn Jónsson (CC BY-NC-SA)", nasaImage("PIA21775")),
      photo("juno", "io", "NASA / JPL-Caltech / SwRI / MSSS · Gerald Eichstädt / Thomas Thomopoulos", nasaImage("PIA25697")),
    ],
    sources: [
      { label: "NASA · Juno", url: "https://science.nasa.gov/mission/juno/" },
      { label: "NASA · Juno's orbits", url: "https://science.nasa.gov/mission/juno/juno-orbits/" },
      { label: "NASA · Spacecraft & instruments", url: "https://www.nasa.gov/history/10-years-ago-juno-launched-to-observe-jupiter/" },
    ],
  },
  chandra: {
    model: {
      url: "/chandra/models/chandra.glb", direction: [1, 0.5, 1.4],
      credit: {
        author: "uperesito", license: "CC BY 4.0",
        source: "https://sketchfab.com/3d-models/chandra-x-ray-observatory-b77e540d3df24727b83ed1b818091376",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      },
    },
    accent: "#9C9AF2",
    hero: "/chandra/images/spacecraft.jpg",
    heroSource: nasaImage("PIA18166"),
    gallery: [
      photo("chandra", "cassiopeia", "NASA / CXC / SAO / Rutgers / J. Hughes", nasaImage("9907459")),
      photo("chandra", "crab", "NASA / CXC / SAO", nasaImage("9905980")),
      photo("chandra", "bullet_cluster", "X-ray: NASA/CXC/CfA/M. Markevitch et al.; Optical: NASA/STScI, Magellan/U. Arizona/D. Clowe et al.; Lensing: NASA/STScI, ESO WFI, Magellan/U. Arizona/D. Clowe et al.", "https://chandra.harvard.edu/photo/2006/1e0657/"),
    ],
    sources: [
      { label: "Chandra · Mission", url: "https://chandra.harvard.edu/about/" },
      { label: "Chandra · Specifications", url: "https://chandra.harvard.edu/about/specs.html" },
      { label: "Chandra · Instruments", url: "https://chandra.harvard.edu/about/science_instruments.html" },
      { label: "Chandra · 25 years", url: "https://chandra.harvard.edu/25th/" },
    ],
  },
};
