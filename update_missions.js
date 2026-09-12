const fs = require('fs');
const path = require('path');
const p = path.join('d:', 'ProjectNode', 'NEOwatchBot', 'my-app', 'src', 'lib', 'missions.js');
let content = fs.readFileSync(p, 'utf8');

const newMissions =   {
    key: "galileo", labelKey: "missions.names.galileo",
    disabled: true, type: "probe", status: "ended", year: "1989–2003",
    icon: "🛰️", accent: "#E8A374", img: "/galileo/images/preview.jpg",
    blurbKey: "missions.blurbs.galileo",
  },
  {
    key: "curiosity", labelKey: "missions.names.curiosity",
    disabled: true, type: "rover", status: "active", year: "2012",
    icon: "🚙", accent: "#E25C5C", img: "/curiosity/images/preview.jpg",
    blurbKey: "missions.blurbs.curiosity",
  },
  {
    key: "rosetta", labelKey: "missions.names.rosetta",
    disabled: true, type: "probe", status: "ended", year: "2004–2016",
    icon: "🛰️", accent: "#9CA3AF", img: "/rosetta/images/preview.jpg",
    blurbKey: "missions.blurbs.rosetta",
  },
  {
    key: "dawn", labelKey: "missions.names.dawn",
    disabled: true, type: "probe", status: "ended", year: "2007–2018",
    icon: "🛰️", accent: "#A78BFA", img: "/dawn/images/preview.jpg",
    blurbKey: "missions.blurbs.dawn",
  },
  {
    key: "messenger", labelKey: "missions.names.messenger",
    disabled: true, type: "probe", status: "ended", year: "2004–2015",
    icon: "🛰️", accent: "#FCD34D", img: "/messenger/images/preview.jpg",
    blurbKey: "missions.blurbs.messenger",
  },
  {
    key: "magellan", labelKey: "missions.names.magellan",
    disabled: true, type: "probe", status: "ended", year: "1989–1994",
    icon: "🛰️", accent: "#FBBF24", img: "/magellan/images/preview.jpg",
    blurbKey: "missions.blurbs.magellan",
  },
  {
    key: "bepicolombo", labelKey: "missions.names.bepicolombo",
    disabled: true, type: "probe", status: "active", year: "2018",
    icon: "🛰️", accent: "#FCD34D", img: "/bepicolombo/images/preview.jpg",
    blurbKey: "missions.blurbs.bepicolombo",
  },
  {
    key: "hayabusa2", labelKey: "missions.names.hayabusa2",
    disabled: true, type: "probe", status: "ended", year: "2014–2020",
    icon: "🛰️", accent: "#9CA3AF", img: "/hayabusa2/images/preview.jpg",
    blurbKey: "missions.blurbs.hayabusa2",
  },
];;

content = content.replace('];', newMissions);
fs.writeFileSync(p, content, 'utf8');
