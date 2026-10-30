// Compile the same trusted, escaped HTML for React and the initial server response.
// Run with --images and CONSTELLATION_SHARP_MODULE (or an installed sharp) to
// regenerate PNG social previews. Normal builds only need Node's standard library.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'my-app/src/data');
const publicDir = path.join(root, 'my-app/public/constellations');
const input = JSON.parse(fs.readFileSync(path.join(dataDir, 'constellationGuides.json'), 'utf8'));
const sky = JSON.parse(fs.readFileSync(path.join(root, 'my-app/public/data/celestial_data.json'), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text = {
  uk: {
    directory: 'Довідник сузір’їв', directoryIntro: 'Вісім маршрутів для першого знайомства з небом: від впізнаваної фігури до зір і об’єктів для спостереження.',
    read: 'Як знайти на небі', map: 'Знайти на карті', all: 'Усі сузір’я', home: 'Головна',
    find: 'Як знайти', when: 'Коли й звідки спостерігати', stars: 'Яскраві зорі', targets: 'Що ще подивитися', story: 'Історія та міфологія', sources: 'Джерела й дані', related: 'Досліджуй далі',
    name: 'Зоря', mag: 'Видима величина', hip: 'Каталог HIP', checked: 'Перевірено', north: 'Північ угорі · схід ліворуч · J2000',
    chart: 'Схема сузір’я', chartNote: 'Схематичний зоряний малюнок, а не поточний вигляд над горизонтом. Лінії допомагають упізнати фігуру й не є офіційними межами сузір’я.',
    magNote: 'Менша зоряна величина означає яскравішу зорю. Значення приблизні; блиск змінних зір може відрізнятися від каталогу.',
    latitudeNote: 'Поради стосуються передусім України та середніх північних широт. Сезон описує зручність вечірніх спостережень, а не гарантує видимість у будь-який момент.',
    dark: 'Знайти темне місце', meteors: 'Метеорні потоки', galaxies: 'Довідник галактик', editorial: 'Матеріал OrbitLight за наведеними джерелами. Зоряні координати й блиск — каталог HYG; схема — OrbitLight.',
    hero: 'Впізнай сузір’я на нічному небі', heroIntro: 'Досліджуй 88 сузір’їв на інтерактивній карті зоряного неба. Обери місце спостереження й сезон або почни з восьми довідкових сторінок.',
    js: 'Інтерактивна карта працює з JavaScript. Довідник і схеми нижче доступні без нього.'
  },
  en: {
    directory: 'Constellation field guides', directoryIntro: 'Eight starting points for exploring the sky: recognise the pattern, identify its stars and choose an observing target.',
    read: 'How to find it', map: 'Find on the map', all: 'All constellations', home: 'Home',
    find: 'How to find it', when: 'When and where to observe', stars: 'Bright stars', targets: 'More observing targets', story: 'History and mythology', sources: 'Sources and data', related: 'Explore next',
    name: 'Star', mag: 'Apparent magnitude', hip: 'HIP catalogue', checked: 'Checked', north: 'North up · east left · J2000',
    chart: 'Constellation finder chart', chartNote: 'A schematic star pattern, not the current horizon view. Connecting lines help identify the figure and do not represent official constellation boundaries.',
    magNote: 'A smaller magnitude means a brighter star. Values are approximate; variable stars may differ from the catalogue.',
    latitudeNote: 'Advice primarily covers Ukraine and mid-northern latitudes. The season describes convenient evening viewing, rather than guaranteed visibility at every moment.',
    dark: 'Find darker skies', meteors: 'Meteor showers', galaxies: 'Galaxy guides', editorial: 'An OrbitLight guide based on the sources below. Star positions and magnitudes: HYG catalogue; diagram: OrbitLight.',
    hero: 'Find constellations in the night sky', heroIntro: 'Explore 88 constellations on an interactive night sky map. Choose your observing location and season, or start with eight illustrated field guides.',
    js: 'The interactive map needs JavaScript. The field guides and charts below remain available without it.'
  }
};
const base = lang => lang === 'uk' ? '/ua/suzirya' : '/en/constellations';
const prefix = lang => lang === 'uk' ? '/ua' : '/en';
const route = (lang, name) => prefix(lang) + '/' + ({dark:{uk:'temne-nebo',en:'dark-sky'},meteors:{uk:'meteory',en:'meteors'},galaxies:{uk:'galaktyky',en:'galaxies'}}[name][lang]);

function chart(item, lang, social = false) {
  const c = sky.constellations.find(c => c.id === item.id);
  const raw = (ra, dec) => ({x: -(((ra-c.ra+540)%360)-180)*Math.cos(c.dec*Math.PI/180), y:-dec});
  const lines = c.lines.map(line => line.map(pt => raw(...pt)));
  const stars = sky.stars.filter(s => s.const === item.id && s.mag <= 4.5).map(s => ({...s,...raw(s.ra,s.dec)}));
  const points = [...lines.flat(), ...stars];
  const minX = Math.min(...points.map(p=>p.x)), maxX = Math.max(...points.map(p=>p.x));
  const minY = Math.min(...points.map(p=>p.y)), maxY = Math.max(...points.map(p=>p.y));
  const scale = Math.min(540/Math.max(1,maxX-minX), 330/Math.max(1,maxY-minY));
  const xy = p => ({x:400+(p.x-(minX+maxX)/2)*scale, y:260+(p.y-(minY+maxY)/2)*scale});
  const paths = lines.map(line => `<path d="M${line.map(p=>{const q=xy(p);return q.x.toFixed(2)+','+q.y.toFixed(2)}).join(' L')}"/>`).join('');
  const bright = [...stars].sort((a,b)=>a.mag-b.mag).slice(0,3);
  const dots = stars.map(s=>{const p=xy(s);return `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${Math.max(2,5-s.mag*.65).toFixed(2)}"/>`}).join('');
  const labelBoxes=[];
  const labels = bright.map(s=>{
    const p=xy(s),name=(lang==='uk'?s.name||s.name_en:s.name_en||s.name)||s.bayer;
    const width=name.length*13.5;
    const x=Math.max(20,Math.min(780-width,p.x<400?p.x-width-14:p.x+14));
    let y=p.y-14;
    for(const candidate of [p.y-14,p.y+34,p.y-50,p.y+65]) {
      if(candidate<65||candidate>450)continue;
      if(!labelBoxes.some(b=>x<b.right+8&&x+width>b.left-8&&candidate>b.top-8&&candidate-24<b.bottom+8)) {y=candidate;break;}
    }
    labelBoxes.push({left:x,right:x+width,top:y-24,bottom:y});
    return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}">${escape(name)}</text>`;
  }).join('');
  const content = `<defs><radialGradient id="bg"><stop stop-color="#142d40"/><stop offset="1" stop-color="#080d1b"/></radialGradient></defs><rect width="800" height="520" rx="20" fill="url(#bg)"/><g stroke="#67839c" stroke-opacity=".12"><path d="M80 130H720M80 260H720M80 390H720M200 80V450M400 80V450M600 80V450"/></g><g fill="none" stroke="#65d5cc" stroke-width="2" stroke-linejoin="round">${paths}</g><g fill="#f0d19a">${dots}</g><g fill="#dce8f2" font-family="Arial,sans-serif" font-size="24">${labels}</g><text x="26" y="34" fill="#91a8bc" font-family="Arial,sans-serif" font-size="13">${escape(text[lang].north)}</text><text x="26" y="490" fill="#65d5cc" font-family="Arial,sans-serif" font-size="17">${escape(item.latin)} · ${item.id}</text>`;
  return social
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#080d1b"/><g transform="translate(390 65) scale(.94)">${content}</g><text x="45" y="155" fill="#65d5cc" font-family="Arial,sans-serif" font-size="21">ORBITLIGHT · ${item.id}</text><text x="45" y="225" fill="white" font-family="Arial,sans-serif" font-size="35">${escape(item[lang].name)}</text><text x="45" y="280" fill="#a5b8c9" font-family="Arial,sans-serif" font-size="22">${escape(item.latin)}</text><text x="45" y="560" fill="#a5b8c9" font-family="Arial,sans-serif" font-size="20">${escape(lang==='uk'?'Як знайти на нічному небі':'Find it in the night sky')}</text></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520" role="img" aria-label="${escape(text[lang].chart+' '+item[lang].name)}">${content}</svg>`;
}

function renderGuide(item, lang) {
  const v=item[lang],ui=text[lang];
  const stars=sky.stars.filter(s=>s.const===item.id).sort((a,b)=>a.mag-b.mag).slice(0,3);
  const links = item.related.map(slug=>{const other=input.items.find(i=>i.slug===slug);return `<a class="cg-next" href="${base(lang)}/${slug}">${escape(other[lang].name)} <span aria-hidden="true">↗</span></a>`}).join('');
  const sources=[...item.sources,{name:'IAU · Constellations',url:'https://www.iau.org/IAU/Astronomy-FAQs/Constellations.aspx'},{name:'HYG star catalogue',url:'https://codeberg.org/astronexus/hyg'}];
  return `<article class="cg-page wrap"><nav class="cg-breadcrumb" aria-label="${lang==='uk'?'Навігаційний ланцюжок':'Breadcrumb'}"><a href="${prefix(lang)}/">OrbitLight</a><span aria-hidden="true">/</span><a href="${base(lang)}">${escape(ui.all)}</a><span aria-hidden="true">/</span><span aria-current="page">${escape(v.name)}</span></nav>
<header class="cg-hero"><div><p class="cg-eyebrow">${escape(ui.directory)} · ${item.id}</p><h1>${escape(v.name)}</h1><p class="cg-latin" lang="la">${escape(item.latin)}</p><p class="cg-lead">${escape(v.lead)}</p><p class="cg-season">${escape(v.season)}</p><div class="cg-actions"><a class="btn primary" href="${base(lang)}?focus=${item.id}&amp;season=${item.seasonKey}#sky-map">${escape(ui.map)} <span aria-hidden="true">↗</span></a><a class="btn ghost" href="${base(lang)}#field-guides">${escape(ui.all)}</a></div></div><figure><img src="/constellations/${item.slug}-${lang}.svg" width="800" height="520" alt="${escape(ui.chart+' '+v.name)}" fetchpriority="high"><figcaption>${escape(ui.chartNote)}</figcaption></figure></header>
<div class="cg-layout"><div class="cg-article"><section class="cg-section" id="find"><h2>${escape(ui.find)}</h2><ol>${v.find.map(p=>`<li>${escape(p)}</li>`).join('')}</ol></section><section class="cg-section" id="observe"><h2>${escape(ui.when)}</h2><p>${escape(v.visibility)}</p><p class="cg-note">${escape(ui.latitudeNote)}</p></section><section class="cg-section"><h2>${escape(ui.stars)}</h2><div class="cg-table-wrap"><table><caption>${escape(v.name+' · '+ui.stars)}</caption><thead><tr><th scope="col">${escape(ui.name)}</th><th scope="col">${escape(ui.mag)}</th><th scope="col">${escape(ui.hip)}</th></tr></thead><tbody>${stars.map(s=>`<tr><th scope="row">${escape((lang==='uk'?s.name:s.name_en)||s.name_en||s.bayer)}</th><td>${s.mag.toFixed(2)}</td><td>${s.id}</td></tr>`).join('')}</tbody></table></div><p class="cg-small">${escape(ui.magNote)}</p></section><section class="cg-section"><h2>${escape(ui.targets)}</h2>${v.targets.map(t=>`<div class="cg-target"><h3>${escape(t.name)}</h3><p class="cg-equipment">${escape(t.equipment)}</p><p>${escape(t.text)}</p></div>`).join('')}</section><section class="cg-section"><h2>${escape(ui.story)}</h2><p>${escape(v.story)}</p></section><section class="cg-section cg-sources"><h2>${escape(ui.sources)}</h2><p>${escape(ui.editorial)}</p><p>${escape(ui.checked)}: <time datetime="${input.checked}">${input.checked}</time></p><ul>${sources.map(s=>`<li><a href="${escape(s.url)}" rel="noopener noreferrer">${escape(s.name)}</a></li>`).join('')}</ul></section></div><aside class="cg-aside"><h2>${escape(ui.related)}</h2>${links}<div class="cg-help"><a href="${route(lang,'dark')}">${escape(ui.dark)}</a><a href="${route(lang,'meteors')}">${escape(ui.meteors)}</a><a href="${route(lang,'galaxies')}">${escape(ui.galaxies)}</a></div></aside></div></article>`;
}

async function main() {
  fs.mkdirSync(publicDir,{recursive:true});
  let sharp;
  if(process.argv.includes('--images')) sharp=require(process.env.CONSTELLATION_SHARP_MODULE||'sharp');
  const pages={uk:{},en:{}},directory={},landing={};
  const index={checked:input.checked,ui:text,items:input.items.map(item=>({id:item.id,slug:item.slug,latin:item.latin,seasonKey:item.seasonKey,...Object.fromEntries(['uk','en'].map(lang=>[lang,{name:item[lang].name,title:(lang==='uk'?'Сузір’я ':'')+item[lang].name+(lang==='uk'?' — як знайти на небі | OrbitLight':' Constellation: How to Find It | OrbitLight'),description:item[lang].description,lead:item[lang].lead,season:item[lang].season,image:'/constellations/'+item.slug+'-'+lang+'.png'}]))}))};
  for(const lang of ['uk','en']) {
    for(const item of input.items) {
      fs.writeFileSync(path.join(publicDir,item.slug+'-'+lang+'.svg'),chart(item,lang));
      if(sharp) await sharp(Buffer.from(chart(item,lang,true))).png().toFile(path.join(publicDir,item.slug+'-'+lang+'.png'));
      pages[lang][item.slug]=renderGuide(item,lang);
    }
    const ui=text[lang];
    directory[lang]=`<section class="cg-directory" id="field-guides" aria-labelledby="cg-directory-title"><div class="cg-section-heading"><p class="cg-eyebrow">ORBITLIGHT · ${escape(ui.directory)}</p><h2 id="cg-directory-title">${escape(ui.directory)}</h2><p>${escape(ui.directoryIntro)}</p></div><div class="cg-directory-grid">${input.items.map(item=>`<a class="cg-directory-card" href="${base(lang)}/${item.slug}"><img src="/constellations/${item.slug}-${lang}.svg" width="800" height="520" alt="${escape(ui.chart+' '+item[lang].name)}" loading="lazy"><div><p class="cg-eyebrow">${item.id} · ${escape(item.latin)}</p><h3>${escape(item[lang].name)}</h3><p>${escape(item[lang].season)}</p><span class="cg-card-link">${escape(ui.read)} ↗</span></div></a>`).join('')}</div></section>`;
    landing[lang]=`<div class="wrap cg-page"><header class="cg-landing"><h1>${escape(ui.hero)}</h1><p class="cg-lead">${escape(ui.heroIntro)}</p><a class="btn primary" href="#field-guides">${escape(ui.directory)}</a></header><section id="sky-map"><p class="cg-note">${escape(ui.js)}</p></section>${directory[lang]}</div>`;
  }
  for(const [name,value] of Object.entries({constellationGuideIndex:index,constellationGuidePages:pages,constellationDirectory:directory,constellationLanding:landing}))fs.writeFileSync(path.join(dataDir,name+'.json'),JSON.stringify(value,null,2)+'\n');
  fs.copyFileSync(path.join(root,'my-app/src/styles/constellation-guides.css'),path.join(publicDir,'guides.css'));
  console.log('Built 8 bilingual constellation guides, charts and directory'+(sharp?' with PNG previews':''));
}
main().catch(error=>{console.error(error);process.exitCode=1});
