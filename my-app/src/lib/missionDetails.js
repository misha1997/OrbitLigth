// Curated science images mirrored in public/. Keep credits with each image.
const photo = (mission, file, credit, source, year) => ({ image: `/${mission}/images/${file}.jpg`, credit, source, year });
const nasaImage = (id) => `https://images.nasa.gov/details/${id}`;

export const MISSION_DETAILS = {
  rosetta: {
    additionalScience: [1],
    experience: "comet-archive",
    model: { url: "/rosetta/models/rosetta.glb", direction: [1, 0.7, 1.3], credit: { author: "NASA · 3D Resources", source: "https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Rosetta" } },
    accent: "#9CCFD2", hero: "/rosetta/images/comet.jpg",
    gallery: [
      photo("rosetta", "comet", "ESA / Rosetta / NAVCAM · CC BY-SA 3.0 IGO", "https://www.esa.int/ESA_Multimedia/Images/2014/09/Comet_on_19_September_2014_NavCam", "2014"),
      photo("rosetta", "philae", "ESA / Rosetta / MPS for OSIRIS Team MPS / UPD / LAM / IAA / SSO / INTA / UPM / DASP / IDA; context: ESA / Rosetta / NAVCAM (CC BY-SA 3.0 IGO) · ESA Standard Licence", "https://www.esa.int/ESA_Multimedia/Images/2016/09/Philae_found", "2016"),
      photo("rosetta", "jets", "ESA / Rosetta / MPS for OSIRIS Team MPS / UPD / LAM / IAA / SSO / INTA / UPM / DASP / IDA · ESA Standard Licence", "https://www.esa.int/ESA_Multimedia/Images/2015/08/Approaching_perihelion", "2015"),
    ],
    sources: [
      { label: "ESA · Rosetta factsheet", url: "https://www.esa.int/Science_Exploration/Space_Science/Rosetta/Rosetta_factsheet" },
      { label: "ESA · Rosetta instruments", url: "https://www.esa.int/Science_Exploration/Space_Science/Rosetta/Rosetta_s_instruments" },
      { label: "ESA · Philae found", url: "https://www.esa.int/Science_Exploration/Space_Science/Rosetta/Philae_found" },
      { label: "ESA · Planetary Science Archive", url: "https://psa.esa.int/" },
    ],
  },
  dawn: {
    additionalScience: [2],
    experience: "asteroid-belt-archive",
    model: { url: "/dawn/models/dawn.glb", direction: [1, 0.65, 1.3], credit: { author: "NASA / Brian E. Kumanchik", source: "https://science.nasa.gov/3d-resources/dawn/" } },
    accent: "#B8A5E3", hero: "/dawn/images/ceres.jpg",
    gallery: [
      photo("dawn", "vesta", "NASA / JPL-Caltech / UCLA / MPS / DLR / IDA", nasaImage("PIA14322"), "2011"),
      photo("dawn", "ceres", "NASA / JPL-Caltech / UCLA / MPS / DLR / IDA", nasaImage("PIA19562"), "2015"),
      photo("dawn", "occator", "NASA / JPL-Caltech / UCLA / MPS / DLR / IDA", "https://science.nasa.gov/resource/bright-material-in-occator-crater/", "2018"),
    ],
    sources: [
      { label: "NASA · Dawn", url: "https://science.nasa.gov/mission/dawn/" },
      { label: "NASA · Science highlights", url: "https://science.nasa.gov/mission/dawn/toolkit/highlights/" },
      { label: "NASA · Science payload", url: "https://science.nasa.gov/mission/dawn/technology/science-payload/" },
      { label: "NASA · Ion propulsion", url: "https://science.nasa.gov/mission/dawn/technology/ion-propulsion/" },
      { label: "NASA · End of mission", url: "https://www.nasa.gov/news-release/nasas-dawn-mission-to-asteroid-belt-comes-to-end/" },
      { label: "NASA · Planetary Data System", url: "https://pds.nasa.gov/" },
    ],
  },
  galileo: {
    experience: "jupiter-system-archive",
    model: { url: "/galileo/models/galileo.glb", direction: [1, 0.6, 1.4], credit: { author: "NASA · 3D Resources", source: "https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Galileo" } },
    accent: "#DFAC78", hero: "/galileo/images/preview.jpg",
    gallery: [
      photo("galileo", "europa", "NASA / JPL / DLR", "https://science.nasa.gov/photojournal/pj-natural-and-false-color-views-of-europa/", "1996"),
      photo("galileo", "ganymede", "NASA / JPL / DLR", "https://science.nasa.gov/resource/ganymede-galileo/", "1996"),
      photo("galileo", "io", "NASA / JPL / University of Arizona", "https://science.nasa.gov/photojournal/global-image-of-io-true-color/", "1999"),
    ],
    sources: [
      { label: "NASA · Galileo", url: "https://science.nasa.gov/mission/galileo/" },
      { label: "NASA · Galileo science", url: "https://science.nasa.gov/mission/galileo/galileo-science/" },
      { label: "NASA · Atmospheric probe", url: "https://science.nasa.gov/mission/galileo-jupiter-atmospheric-probe/" },
      { label: "NASA · Mission history", url: "https://www.nasa.gov/history/30-years-ago-galileo-off-to-orbit-jupiter/" },
      { label: "NASA · Europa & magnetic induction", url: "https://europa.nasa.gov/resources/174/induced-magnetic-field-from-europas-subsurface-ocean/" },
    ],
  },
  curiosity: {
    experience: "mars-field-geology",
    model: { url: "/curiosity/models/curiosity.glb", direction: [1, 0.7, 1.3], credit: { author: "NASA / JPL-Caltech", source: "https://science.nasa.gov/resource/curiosity-3d-model/" } },
    accent: "#D78C68", hero: "/curiosity/images/selfie.jpg",
    gallery: [
      photo("curiosity", "selfie", "NASA / JPL-Caltech / MSSS", nasaImage("PIA19807"), "2015"),
      photo("curiosity", "john-klein", "NASA / JPL-Caltech / MSSS", nasaImage("PIA16567"), "2013"),
      photo("curiosity", "buttes", "NASA / JPL-Caltech / MSSS", nasaImage("PIA21042"), "2016"),
    ],
    sources: [
      { label: "NASA · Curiosity", url: "https://science.nasa.gov/mission/msl-curiosity/" },
      { label: "JPL · Mission overview & status", url: "https://www.jpl.nasa.gov/missions/mars-science-laboratory-curiosity-rover-msl/" },
      { label: "NASA · Science instruments", url: "https://science.nasa.gov/mission/msl-curiosity/science-instruments/" },
      { label: "NASA · Ancient habitable environment", url: "https://www.nasa.gov/news-release/nasas-mars-curiosity-rover-marks-first-martian-year-with-mission-successes/" },
      { label: "NASA · Organic compounds in mudstone", url: "https://science.gsfc.nasa.gov/600/nuggets/files/OrganicCompounds-nugget20180625.pdf" },
      { label: "NASA · CheMin discoveries", url: "https://www.nasa.gov/missions/mars-science-laboratory/curiosity-rover/what-is-the-chemistry-and-mineralogy-instrument/" },
    ],
  },
  pioneer10: {
    experience: "outer-planet-pathfinder",
    model: { url: "/pioneer10/models/pioneer10.glb", direction: [1, 0.7, 1.4], credit: { author: "NASA · 3D Resources", source: "https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Pioneer%2010" } },
    accent: "#D5B681", hero: "/pioneer10/images/preview.jpg",
    gallery: [
      photo("pioneer10", "launch", "NASA", "https://www.nasa.gov/history/50-years-ago-pioneer-10-launches-to-explore-jupiter/", "1972"),
      photo("pioneer10", "jupiter", "NASA", "https://www.nasa.gov/history/50-years-ago-pioneer-10-launches-to-explore-jupiter/", "1973"),
      photo("pioneer10", "plaque", "NASA", "https://www.nasa.gov/history/50-years-ago-pioneer-10-launches-to-explore-jupiter/", "1972"),
    ],
    sources: [
      { label: "NASA · Pioneer 10", url: "https://science.nasa.gov/mission/pioneer-10/" },
      { label: "NASA · Launch & mission history", url: "https://www.nasa.gov/history/50-years-ago-pioneer-10-launches-to-explore-jupiter/" },
      { label: "NASA · Final signal", url: "https://science.nasa.gov/missions/pioneer/pioneer-10-sends-last-signal/" },
      { label: "NASA · Gravity assist primer", url: "https://science.nasa.gov/learn/basics-of-space-flight/primer/" },
      { label: "JPL · Pioneer anomaly", url: "https://www.jpl.nasa.gov/news/study-finds-heat-is-source-of-pioneer-anomaly/" },
      { label: "NASA · Pioneer archives", url: "https://nssdc.gsfc.nasa.gov/planetary/pioneer10-11.html" },
      { label: "JPL · Launch chronology (UTC)", url: "https://ipnpr.jpl.nasa.gov/progress_report/IX/IXE.PDF" },
    ],
  },
  pioneer11: {
    experience: "saturn-pathfinder",
    model: { url: "/pioneer11/models/pioneer11.glb", direction: [1, 0.7, 1.4], credit: { author: "NASA · Pioneer 10 model", source: "https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Pioneer%2010" } },
    accent: "#B4A3D0", hero: "/pioneer11/images/preview.jpg",
    gallery: [
      photo("pioneer11", "jupiter", "NASA / Ames", "https://science.nasa.gov/mission/pioneer-11/", "1974"),
      photo("pioneer11", "saturn", "NASA / Ames", "https://www.nasa.gov/solar-system/planets/saturn/40-years-ago-pioneer-11-first-to-explore-saturn/", "1979"),
      photo("pioneer11", "trajectory", "NASA", "https://www.nasa.gov/solar-system/planets/saturn/40-years-ago-pioneer-11-first-to-explore-saturn/", "1973–1979"),
    ],
    sources: [
      { label: "NASA · Pioneer 11", url: "https://science.nasa.gov/mission/pioneer-11/" },
      { label: "NASA · Launch & Jupiter encounter", url: "https://www.nasa.gov/history/45-years-ago-pioneer-11-launched-to-study-jupiter-and-saturn/" },
      { label: "NASA · First at Saturn", url: "https://www.nasa.gov/solar-system/planets/saturn/40-years-ago-pioneer-11-first-to-explore-saturn/" },
      { label: "NASA · Gravity assist primer", url: "https://science.nasa.gov/learn/basics-of-space-flight/primer/" },
      { label: "NASA · Pioneer archives", url: "https://nssdc.gsfc.nasa.gov/planetary/pioneer10-11.html" },
    ],
  },
  spitzer: {
    experience: "infrared-archive",
    model: { url: "/spitzer/models/spitzer.glb", direction: [1, 0.65, 1.3], credit: { author: "NASA / VTAD", source: "https://science.nasa.gov/resource/spitzer-space-telescope-3d-model/" } },
    accent: "#E6A17B", hero: "/spitzer/images/preview.jpg",
    gallery: [
      photo("spitzer", "helix", "NASA / JPL-Caltech / University of Arizona", nasaImage("PIA09178"), "2007"),
      photo("spitzer", "orion", "NASA / ESA / JPL-Caltech / IRAM", nasaImage("PIA13959"), "2012"),
      photo("spitzer", "trappist", "NASA / JPL-Caltech", nasaImage("PIA21422"), "2017"),
    ],
    sources: [
      { label: "JPL · Spitzer", url: "https://www.jpl.nasa.gov/missions/spitzer-space-telescope/" },
      { label: "JPL · Facts & instruments", url: "https://www.jpl.nasa.gov/news/press_kits/spitzer/quick-facts/" },
      { label: "NASA · End of mission", url: "https://www.nasa.gov/news-release/nasas-spitzer-space-telescope-ends-mission-of-astronomical-discovery/" },
      { label: "NASA · Exoplanet discoveries", url: "https://science.nasa.gov/missions/spitzer/10-things-spitzer-taught-us-about-exoplanets/" },
      { label: "IRSA · Spitzer archive", url: "https://irsa.ipac.caltech.edu/Missions/spitzer.html" },
    ],
  },
  kepler: {
    experience: "exoplanet-archive",
    model: { url: "/kepler/models/kepler.glb", direction: [1, 0.65, 1.3], credit: { author: "NASA · 3D Resources", source: "https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Kepler%20(A)" } },
    accent: "#B2A2DE", hero: "/kepler/images/preview.jpg",
    gallery: [
      photo("kepler", "fields", "NASA Ames / Wendy Stenzel · Science: Jeff Coughlin, Kenneth Mighell, Doug Caldwell", nasaImage("ACD20-0045-002"), "2020"),
      photo("kepler", "kepler186f", "NASA Ames / SETI Institute / JPL-Caltech", nasaImage("PIA17999"), "2014"),
      photo("kepler", "kepler16b", "NASA / JPL-Caltech / T. Pyle", nasaImage("PIA14724"), "2011"),
    ],
    sources: [
      { label: "NASA · Kepler / K2", url: "https://science.nasa.gov/mission/kepler/" },
      { label: "NASA · Mission history", url: "https://science.nasa.gov/mission/kepler/in-depth/" },
      { label: "JPL · K2 mission", url: "https://science.jpl.nasa.gov/projects/k2/" },
      { label: "NASA Exoplanet Archive · Transit depth", url: "https://exoplanetarchive.ipac.caltech.edu/docs/transit/transit_algorithms.html" },
      { label: "MAST · Kepler archive", url: "https://archive.stsci.edu/missions-and-data/kepler" },
    ],
  },
  osirisrex: {
    experience: "sample-return",
    model: { url: "/osirisrex/models/osirisrex.glb", direction: [1, 0.7, 1.3], credit: { author: "NASA / VTAD", source: "https://science.nasa.gov/resource/osiris-rex-3d-model/" } },
    accent: "#C9A876", hero: "/osirisrex/images/preview.jpg",
    gallery: [
      { image: "/osirisrex/images/bennu.png", credit: "NASA / Goddard / University of Arizona", source: "https://www.nasa.gov/image-article/osiris-rex-debuts-new-bennu-mosaic-3d-shape-model/", year: "2018" },
      photo("osirisrex", "return", "NASA / Keegan Barber", nasaImage("NHQ202309240006"), "2023"),
      photo("osirisrex", "samples", "NASA / Erika Blumenfeld & Joseph Aebersold", nasaImage("jsc2024e023024"), "2023"),
    ],
    sources: [
      { label: "NASA · OSIRIS-REx", url: "https://science.nasa.gov/mission/osiris-rex/" },
      { label: "NASA · Bennu sample curation", url: "https://ares.jsc.nasa.gov/astromaterials-newsletter/vol6-no1/osirisrex-news.cfm" },
      { label: "NASA · Sample science", url: "https://www.nasa.gov/news-release/nasas-asteroid-bennu-sample-reveals-mix-of-lifes-ingredients/" },
      { label: "NASA · OSIRIS-APEX", url: "https://science.nasa.gov/mission/osiris-apex/" },
    ],
  },
  gaia: {
    experience: "survey-archive",
    model: { url: "/gaia/models/gaia.glb", direction: [1, 0.75, 1.3], credit: { author: "OrbitLight · ESA reference", source: "https://www.esa.int/Science_Exploration/Space_Science/Gaia/Gaia_factsheet" } },
    accent: "#B4A0ED", hero: "/gaia/images/gaia_telescope.jpg",
    gallery: [
      photo("gaia", "observing", "Spacecraft: ESA / ATG medialab; Milky Way: ESA / Gaia / DPAC · CC BY-SA 3.0 IGO · A. Moitinho", "https://www.esa.int/ESA_Multimedia/Images/2022/06/Gaia_observes_the_Milky_Way", "2022"),
      photo("gaia", "milkyway", "ESA / Gaia / DPAC · CC BY-SA 3.0 IGO", "https://www.esa.int/ESA_Multimedia/Images/2022/06/Gaia_Exploring_the_multi-dimensional_Milky_Way", "2022"),
      photo("gaia", "asteroids", "ESA · ESA Standard Licence", "https://www.esa.int/ESA_Multimedia/Images/2022/06/Gaia_Solar_System_observations", "2022"),
    ],
    sources: [
      { label: "ESA · Gaia", url: "https://www.esa.int/Science_Exploration/Space_Science/Gaia" },
      { label: "ESA · Gaia factsheet", url: "https://www.esa.int/Science_Exploration/Space_Science/Gaia/Gaia_factsheet" },
      { label: "ESA · Measuring parallax", url: "https://www.esa.int/Science_Exploration/Space_Science/Gaia/Parallax" },
      { label: "ESA · Farewell, Gaia", url: "https://www.esa.int/Enabling_Support/Operations/Farewell_Gaia!_Spacecraft_operations_come_to_an_end" },
      { label: "ESA · Gaia Archive", url: "https://gea.esac.esa.int/archive/" },
    ],
  },
  perseverance: {
    experience: "surface",
    model: { url: "/perseverance/models/perseverance.glb", direction: [1, 0.7, 1.3], credit: { author: "NASA / JPL-Caltech", source: "https://science.nasa.gov/resource/mars-perseverance-rover-3d-model/" } },
    accent: "#E8A078", hero: "/perseverance/images/perseverance_rover.jpg",
    gallery: [
      photo("perseverance", "selfie", "NASA / JPL-Caltech / MSSS", nasaImage("PIA24542"), "2021"),
      photo("perseverance", "kodiak", "NASA / JPL-Caltech / ASU / MSSS", nasaImage("PIA24802"), "2021"),
      photo("perseverance", "depot", "NASA / JPL-Caltech", nasaImage("PIA25678"), "2022"),
    ],
    sources: [
      { label: "NASA · Perseverance", url: "https://science.nasa.gov/mission/mars-2020-perseverance/" },
      { label: "NASA · Science instruments", url: "https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/" },
      { label: "NASA · Science highlights", url: "https://science.nasa.gov/mission/mars-2020-perseverance/science-highlights/" },
      { label: "NASA · Sample caching", url: "https://science.nasa.gov/mission/mars-2020-perseverance/science-objectives/" },
    ],
  },
  cassini: {
    experience: "archive",
    model: { url: "/cassini/models/cassini.glb", direction: [1, 0.6, 1.3], credit: { author: "NASA / VTAD", source: "https://science.nasa.gov/resource/cassini-3d-model/" } },
    accent: "#D9C29B", hero: "/cassini/images/cassini_probe.jpg",
    gallery: [
      photo("cassini", "saturn", "NASA / JPL-Caltech / SSI", nasaImage("PIA17172"), "2013"),
      photo("cassini", "enceladus", "NASA / JPL / Space Science Institute", nasaImage("PIA07758"), "2005"),
      photo("cassini", "titan", "NASA / JPL / University of Arizona / University of Idaho", nasaImage("PIA20016"), "2015"),
    ],
    sources: [
      { label: "NASA · Cassini–Huygens", url: "https://science.nasa.gov/mission/cassini/" },
      { label: "NASA · Mission overview", url: "https://science.nasa.gov/resource/cassini-mission-overview/" },
      { label: "NASA · Grand Finale", url: "https://science.nasa.gov/mission/cassini/grand-finale/overview/" },
      { label: "NASA · Spacecraft", url: "https://science.nasa.gov/mission/cassini/spacecraft/" },
      { label: "NASA · Enceladus discoveries", url: "https://science.nasa.gov/missions/cassini/cassini-at-enceladus-a-decade-plus-of-discovery/" },
    ],
  },
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
