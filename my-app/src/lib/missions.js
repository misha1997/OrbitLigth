// Space-probe/telescope registry for the Missions hub (/missions). Mirrors
// lib/planets.js's shape for the Planetarium hub: `labelKey`/`blurbKey`
// resolve via i18next; `to` is the i18n route name (only set for missions
// that already have a dedicated page — Hubble/JWST/Roman/Voyager); `disabled`
// entries render as non-clickable "coming soon" tiles. `status` is the
// mission's own real-world state (independent of whether this site has a
// page for it yet) — "active" | "ended" | "upcoming".
export const MISSIONS = [
  {
    key: "voyager", labelKey: "nav.voyager", to: "voyager",
    disabled: false, type: "probe", status: "active", year: "1977",
    icon: "🛰️", accent: "#4FD1C5", img: "/voyager/images/voyager_probe.jpg",
    blurbKey: "missions.blurbs.voyager",
  },
  {
    key: "hubble", labelKey: "nav.hubble", to: "hubble",
    disabled: false, type: "telescope", status: "active", year: "1990",
    icon: "🔭", accent: "#E8B94D", img: "/hubble/images/hubble_telescope.jpg",
    blurbKey: "missions.blurbs.hubble",
  },
  {
    key: "jwst", labelKey: "nav.jwst", to: "jwst",
    disabled: false, type: "telescope", status: "active", year: "2021",
    icon: "🔭", accent: "#D9A066", img: "/jwst/images/jwst_telescope.jpg",
    blurbKey: "missions.blurbs.jwst",
  },
  {
    key: "roman", labelKey: "nav.roman", to: "roman",
    disabled: false, type: "telescope", status: "active", year: "2026",
    icon: "🔭", accent: "#9C8AD9", img: "/roman/images/roman_telescope.jpg",
    blurbKey: "missions.blurbs.roman",
  },
  {
    key: "newhorizons", labelKey: "missions.names.newhorizons",
    disabled: true, type: "probe", status: "active", year: "2006",
    icon: "🛰️", accent: "#7FA8D9", img: "/newhorizons/images/newhorizons_probe.jpg",
    blurbKey: "missions.blurbs.newhorizons",
  },
  {
    key: "parker", labelKey: "missions.names.parker",
    disabled: true, type: "probe", status: "active", year: "2018",
    icon: "☀️", accent: "#E8834D", img: "/parker/images/parker_probe.jpg",
    blurbKey: "missions.blurbs.parker",
  },
  {
    key: "juno", labelKey: "missions.names.juno",
    disabled: true, type: "probe", status: "active", year: "2011",
    icon: "🛰️", accent: "#E8A374", img: "/juno/images/juno_probe.jpg",
    blurbKey: "missions.blurbs.juno",
  },
  {
    key: "chandra", labelKey: "missions.names.chandra",
    disabled: true, type: "telescope", status: "active", year: "1999",
    icon: "🔭", accent: "#6A9CF2", img: "/chandra/images/chandra_probe.jpg",
    blurbKey: "missions.blurbs.chandra",
  },
  {
    key: "tess", labelKey: "missions.names.tess",
    disabled: true, type: "telescope", status: "active", year: "2018",
    icon: "🔭", accent: "#4FD1C5", img: "/tess/images/tess_probe.jpg",
    blurbKey: "missions.blurbs.tess",
  },
  {
    key: "europaclipper", labelKey: "missions.names.europaclipper",
    disabled: true, type: "probe", status: "active", year: "2024",
    icon: "🛰️", accent: "#7FD9E8", img: "/europaclipper/images/europaclipper_probe.jpg",
    blurbKey: "missions.blurbs.europaclipper",
  },
  {
    key: "perseverance", labelKey: "missions.names.perseverance",
    disabled: true, type: "rover", status: "active", year: "2020",
    icon: "🚙", accent: "#E25C5C", img: "/perseverance/images/perseverance_rover.jpg",
    blurbKey: "missions.blurbs.perseverance",
  },
  {
    key: "cassini", labelKey: "missions.names.cassini",
    disabled: true, type: "probe", status: "ended", year: "1997–2017",
    icon: "🛰️", accent: "#D9C29B", img: "/cassini/images/cassini_probe.jpg",
    blurbKey: "missions.blurbs.cassini",
  },
  {
    key: "osirisrex", labelKey: "missions.names.osirisrex",
    disabled: true, type: "probe", status: "ended", year: "2016–2023",
    icon: "🛰️", accent: "#C9A876", img: "/osirisrex/images/preview.jpg",
    blurbKey: "missions.blurbs.osirisrex",
  },
  {
    // No `img` — Gaia is ESA, not NASA, so it isn't in images-api.nasa.gov
    // (the source every other entry's photo is mirrored from). Falls back
    // to the icon tile until an admin sets one via /admin/missions.
    key: "gaia", labelKey: "missions.names.gaia",
    disabled: true, type: "telescope", status: "ended", year: "2013–2025",
    icon: "🔭", accent: "#B08FE0", img: "/gaia/images/gaia_telescope.jpg",
    blurbKey: "missions.blurbs.gaia",
  },
  {
    key: "kepler", labelKey: "missions.names.kepler",
    disabled: true, type: "telescope", status: "ended", year: "2009–2018",
    icon: "🔭", accent: "#8A7DB0", img: "/kepler/images/preview.jpg",
    blurbKey: "missions.blurbs.kepler",
  },
  {
    key: "spitzer", labelKey: "missions.names.spitzer",
    disabled: true, type: "telescope", status: "ended", year: "2003–2020",
    icon: "🔭", accent: "#C46B4D", img: "/spitzer/images/preview.jpg",
    blurbKey: "missions.blurbs.spitzer",
  },
  {
    key: "pioneer10", labelKey: "missions.names.pioneer10",
    disabled: true, type: "probe", status: "ended", year: "1972–2003",
    icon: "🛰️", accent: "#9C948B", img: "/pioneer10/images/preview.jpg",
    blurbKey: "missions.blurbs.pioneer10",
  },
  {
    key: "pioneer11", labelKey: "missions.names.pioneer11",
    disabled: true, type: "probe", status: "ended", year: "1973–1995",
    icon: "🛰️", accent: "#9C948B", img: "/pioneer11/images/preview.jpg",
    blurbKey: "missions.blurbs.pioneer11",
  },
];

