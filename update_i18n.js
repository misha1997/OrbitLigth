const fs = require('fs');
const path = require('path');

const ukPath = path.join(__dirname, 'my-app', 'src', 'i18n', 'uk.json');
const enPath = path.join(__dirname, 'my-app', 'src', 'i18n', 'en.json');

const uk = JSON.parse(fs.readFileSync(ukPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const newNames = {
  galileo: "Galileo",
  curiosity: "Curiosity",
  rosetta: "Rosetta",
  dawn: "Dawn",
  messenger: "MESSENGER",
  magellan: "Magellan",
  bepicolombo: "BepiColombo",
  hayabusa2: "Hayabusa2"
};

const ukBlurbs = {
  galileo: "Перший космічний апарат, що вийшов на орбіту Юпітера та вивчав його супутники.",
  curiosity: "Марсохід NASA, який досліджує кратер Гейл з 2012 року на наявність умов для життя.",
  rosetta: "Місія ESA, яка вперше в історії вийшла на орбіту комети та висадила на неї зонд.",
  dawn: "Перший апарат, що досліджував дві карликові планети — Весту та Цереру.",
  messenger: "Перший зонд, що вийшов на орбіту Меркурія для глобального картографування.",
  magellan: "Місія NASA, яка здійснила перше глобальне радіолокаційне картографування Венери.",
  bepicolombo: "Спільна європейсько-японська місія для комплексного дослідження Меркурія.",
  hayabusa2: "Японська місія, яка успішно доставила на Землю зразки з астероїда Рюгу."
};

const enBlurbs = {
  galileo: "The first spacecraft to orbit Jupiter and study its moons in detail.",
  curiosity: "NASA rover exploring Gale Crater since 2012 for past habitable conditions.",
  rosetta: "ESA mission that became the first to orbit and land a probe on a comet.",
  dawn: "The first spacecraft to orbit two extraterrestrial bodies: Vesta and Ceres.",
  messenger: "The first probe to orbit Mercury and map its entire surface.",
  magellan: "NASA mission that performed the first global radar mapping of Venus.",
  bepicolombo: "A joint European-Japanese mission for comprehensive study of Mercury.",
  hayabusa2: "Japanese mission that successfully returned samples from asteroid Ryugu."
};

Object.assign(uk.missions.names, newNames);
Object.assign(en.missions.names, newNames);
Object.assign(uk.missions.blurbs, ukBlurbs);
Object.assign(en.missions.blurbs, enBlurbs);

fs.writeFileSync(ukPath, JSON.stringify(uk, null, 2) + '\n');
fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n');
