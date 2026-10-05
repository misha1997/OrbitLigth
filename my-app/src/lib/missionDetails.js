// Curated science images mirrored in public/. Keep credits with each image.
const photo = (mission, file, credit, source, year) => ({ image: `/${mission}/images/${file}.jpg`, credit, source, year });
const nasaImage = (id) => `https://images.nasa.gov/details/${id}`;

export const MISSION_DETAILS = {
  tess: {
    model: { url: "/tess/models/tess.glb", direction: [1, 0.6, 1.3], credit: { author: "NASA · 3D Resources", source: "https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Transiting%20Exoplanet%20Survey%20Satellite%20(TESS)%20(B)" } },
    accent: "#4FD1C5", hero: "/tess/images/tess_probe.jpg",
    gallery: [
      photo("tess", "first_light", "NASA / MIT / TESS", "https://science.nasa.gov/missions/tess/first-light-tess-shares-first-science-image-in-hunt-to-find-new-worlds/", "2018"),
      photo("tess", "toi700", "NASA's Goddard Space Flight Center", nasaImage("PIA23408"), "2020"),
      photo("tess", "toi1338", "NASA's Goddard Space Flight Center / Chris Smith", "https://svs.gsfc.nasa.gov/13510/", "2020"),
    ],
    sources: [
      { label: "NASA · TESS", url: "https://science.nasa.gov/mission/tess/" },
      { label: "NASA HEASARC · Telescope", url: "https://heasarc.gsfc.nasa.gov/docs/tess/telescope_information.html" },
      { label: "NASA HEASARC · Data products", url: "https://heasarc.gsfc.nasa.gov/docs/tess/data-products.html" },
      { label: "MAST · TESS archive", url: "https://archive.stsci.edu/missions-and-data/tess" },
    ],
  },
  europaclipper: {
    model: { url: "/europaclipper/models/europaclipper.glb", direction: [1, 0.7, 1.3], credit: { author: "NASA / VTAD", source: "https://science.nasa.gov/resource/europa-clipper-3d-model/" } },
    accent: "#7FD9E8", hero: "/europaclipper/images/europaclipper_probe.jpg",
    gallery: [
      photo("europaclipper", "launch", "NASA / SpaceX", nasaImage("KSC-20241014-PH-SPX01_0004"), "2024"),
      photo("europaclipper", "assembly", "NASA / JPL-Caltech", nasaImage("PIA25958"), "2023"),
      photo("europaclipper", "europa", "NASA / JPL-Caltech / SETI Institute", nasaImage("PIA19048"), "Galileo"),
    ],
    sources: [
      { label: "NASA · Europa Clipper", url: "https://science.nasa.gov/mission/europa-clipper/" },
      { label: "NASA · Mission timeline", url: "https://science.nasa.gov/mission/europa-clipper/mission-timeline/" },
      { label: "NASA · Science instruments", url: "https://science.nasa.gov/mission/europa-clipper/spacecraft-instruments/" },
      { label: "JPL · Science objectives", url: "https://www.jpl.nasa.gov/press-kits/europa-clipper/mission/science/" },
    ],
  },
  newhorizons: {
    model: { url: "/newhorizons/models/new-horizons.glb", direction: [1, 0.8, 1.2] },
    accent: "#7FA8D9",
    hero: "/newhorizons/images/spacecraft.jpg",
    heroSource: nasaImage("PIA10075"),
    gallery: [
      photo("newhorizons", "pluto", "NASA / Johns Hopkins APL / SwRI", nasaImage("PIA19952"), "2015"),
      photo("newhorizons", "charon", "NASA / Johns Hopkins APL / SwRI", nasaImage("PIA19968"), "2015"),
      photo("newhorizons", "pluto_haze", "NASA / Johns Hopkins APL / SwRI", "https://science.nasa.gov/mission/new-horizons/", "2015"),
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
      photo("juno", "clouds", "NASA / JPL-Caltech / SwRI / MSSS · Björn Jónsson", nasaImage("PIA21391"), "2017"),
      photo("juno", "red_spot", "NASA / JPL-Caltech / SwRI / MSSS · Björn Jónsson (CC BY-NC-SA)", nasaImage("PIA21775"), "2017"),
      photo("juno", "io", "NASA / JPL-Caltech / SwRI / MSSS · Gerald Eichstädt / Thomas Thomopoulos", nasaImage("PIA25697"), "2024"),
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
      photo("chandra", "cassiopeia", "NASA / CXC / SAO / Rutgers / J. Hughes", nasaImage("9907459"), "1999"),
      photo("chandra", "crab", "NASA / CXC / SAO", nasaImage("9905980"), "1999"),
      photo("chandra", "bullet_cluster", "X-ray: NASA/CXC/CfA/M. Markevitch et al.; Optical: NASA/STScI, Magellan/U. Arizona/D. Clowe et al.; Lensing: NASA/STScI, ESO WFI, Magellan/U. Arizona/D. Clowe et al.", "https://chandra.harvard.edu/photo/2006/1e0657/", "2006"),
    ],
    sources: [
      { label: "Chandra · Mission", url: "https://chandra.harvard.edu/about/" },
      { label: "Chandra · Specifications", url: "https://chandra.harvard.edu/about/specs.html" },
      { label: "Chandra · Instruments", url: "https://chandra.harvard.edu/about/science_instruments.html" },
      { label: "Chandra · 25 years", url: "https://chandra.harvard.edu/25th/" },
    ],
  },
};
