const fs = require('fs');
const path = require('path');

const ukPath = path.join('d:', 'ProjectNode', 'NEOwatchBot', 'my-app', 'src', 'i18n', 'uk.json');
const enPath = path.join('d:', 'ProjectNode', 'NEOwatchBot', 'my-app', 'src', 'i18n', 'en.json');

const uk = JSON.parse(fs.readFileSync(ukPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const newNames = {
  euclid: "Euclid",
  soho: "SOHO",
  sdo: "SDO",
  fermi: "Fermi",
  planck: "Planck",
  wmap: "WMAP",
  wise: "WISE / NEOWISE",
  opportunity: "Opportunity",
  spirit: "Spirit",
  viking: "Viking 1 & 2",
  huygens: "Huygens",
  lro: "LRO",
  akatsuki: "Akatsuki",
  giotto: "Giotto",
  change4: "Chang'e 4",
  change6: "Chang'e 6"
};

const ukBlurbs = {
  euclid: "Новітній космічний телескоп ESA для картографування темної матерії та темної енергії у Всесвіті.",
  soho: "Історична спільна місія NASA та ESA для безперервного спостереження за Сонцем та його короною.",
  sdo: "Обсерваторія сонячної динаміки, що знімає Сонце у надвисокій роздільності кожні кілька секунд.",
  fermi: "Гамма-телескоп, який вивчає найпотужніші вибухи та об'єкти у Всесвіті: пульсари, чорні діри, спалахи.",
  planck: "Місія ESA, що склала найдетальнішу карту реліктового випромінювання (залишків Великого вибуху).",
  wmap: "Зонд NASA, який точно виміряв вік Всесвіту за допомогою аналізу реліктового випромінювання.",
  wise: "Інфрачервоний телескоп, що відкрив тисячі астероїдів, коричневих карликів та галактик.",
  opportunity: "Легендарний марсохід-довгожитель, що пропрацював на Марсі майже 15 років замість 90 днів.",
  spirit: "Марсохід-близнюк Opportunity, який довів наявність гідротермальних джерел на давньому Марсі.",
  viking: "Перші в історії космічні апарати NASA, що успішно здійснили посадку на Марс і передали кольорові фото.",
  huygens: "Європейський посадковий модуль, який здійснив посадку на Титан (супутник Сатурна) у 2005 році.",
  lro: "Місячний орбітальний розвідник, що складає детальну 3D-карту Місяця з 2009 року.",
  akatsuki: "Японський орбітальний апарат, який успішно досліджує динаміку атмосфери та клімат Венери.",
  giotto: "Перша глибококосмічна місія ESA, яка здійснила історичний проліт крізь хвіст комети Галлея.",
  change4: "Китайська місія, що здійснила першу в історії людства м'яку посадку на зворотний бік Місяця.",
  change6: "Історична місія, яка вперше доставила на Землю зразки ґрунту зі зворотного боку Місяця."
};

const enBlurbs = {
  euclid: "ESA space telescope designed to explore the evolution of the dark Universe.",
  soho: "Joint ESA/NASA mission that provides near-continuous observations of the Sun.",
  sdo: "Solar Dynamics Observatory capturing ultra-high definition images of the Sun every few seconds.",
  fermi: "Gamma-ray space observatory studying the most extreme phenomena in the universe.",
  planck: "ESA mission that mapped the anisotropies of the cosmic microwave background at high resolution.",
  wmap: "NASA probe that precisely measured the age of the universe via the cosmic microwave background.",
  wise: "Infrared-wavelength astronomical space telescope that discovered thousands of minor planets.",
  opportunity: "Legendary Mars rover that operated for nearly 15 years, vastly exceeding its 90-day planned lifetime.",
  spirit: "Twin rover to Opportunity that found evidence of ancient hydrothermal environments on Mars.",
  viking: "The first NASA spacecraft to successfully land on Mars and return high-resolution images.",
  huygens: "ESA lander that successfully touched down on Saturn's moon Titan in 2005.",
  lro: "Lunar Reconnaissance Orbiter mapping the Moon's surface in high resolution since 2009.",
  akatsuki: "Japanese Venus climate orbiter studying the planet's atmospheric dynamics and weather.",
  giotto: "ESA's first deep space mission, famous for its close flyby of Halley's Comet.",
  change4: "Chinese mission that achieved the first soft landing on the far side of the Moon.",
  change6: "Historic mission that returned the first-ever lunar samples from the far side of the Moon."
};

Object.assign(uk.missions.names, newNames);
Object.assign(en.missions.names, newNames);
Object.assign(uk.missions.blurbs, ukBlurbs);
Object.assign(en.missions.blurbs, enBlurbs);

fs.writeFileSync(ukPath, JSON.stringify(uk, null, 2) + '\n');
fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n');
