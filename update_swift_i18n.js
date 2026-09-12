const fs = require('fs');
const path = require('path');

const ukPath = path.join('d:', 'ProjectNode', 'NEOwatchBot', 'my-app', 'src', 'i18n', 'uk.json');
const enPath = path.join('d:', 'ProjectNode', 'NEOwatchBot', 'my-app', 'src', 'i18n', 'en.json');

const uk = JSON.parse(fs.readFileSync(ukPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

uk.missions.names.swift = "Swift";
en.missions.names.swift = "Swift";

uk.missions.blurbs.swift = "Космічна обсерваторія NASA для спостереження гамма-сплесків, що працює з 2004 року.";
en.missions.blurbs.swift = "NASA space observatory dedicated to the study of gamma-ray bursts, active since 2004.";

fs.writeFileSync(ukPath, JSON.stringify(uk, null, 2) + '\n');
fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n');
