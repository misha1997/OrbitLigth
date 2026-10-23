# Аудит новин OrbitLight — 23.10.2026

Перевірено публічний архів: **1 035 новин, 2 070 сторінок EN/UK та 2 307 унікальних адрес зображень**. Один початковий тайм-аут сторінки не повторився. Після повторної перевірки всі сторінки повернули HTTP 200.

Аудит читає збережений bootstrap HTML з `enrich=False`. Він не викликає індивідуальний API новини, не запускає масове завантаження/переклад текстів і не змінює базу. HTTP 200 та правильні медіапосилання не доводять відтворення кожного зовнішнього відео.

| Знахідка | Унікальних новин / адрес | Значення |
|---|---:|---|
| Картка без фото | 48 новин | Додано локальне прев’ю, також при `onError` |
| Відеоплейсхолдери без адрес відео | 58 новин | Підтверджено дефект прив’язування відео під час імпорту RSS |
| Зайві записи фото, яких немає у тексті | 43 новини | Зазвичай наслідок обрізання тексту до 6 000 символів |
| Зайві записи відео | 1 новина | Може бути наслідком неправильного article ID |
| HTML entities у медіа-URL | 317 адрес | Додано декодування як нових, так і вже збережених URL |
| URL зображень, що повертають 404 через entities | 5 адрес | Усі 5 після декодування повернули валідні зображення з HTTP 200 |
| Пошкоджений локальний кеш зображень | 2 файли | `meteosat-third-generation/1-full.jpg`, `epsilon/1-full.jpg` |
| Немає збереженого тексту та анонсу | 4 новини | Кандидати для довантаження з джерела, а не підтверджені 404 |
| Збережено лише анонс, потрібне enrichment | 409 новин | Очікуваний стан до першого відкриття, не рахується підтвердженим збоєм |
| Біографія автора / промоблок у тексті | 13 кандидатів | Евристика для ручного перегляду; на прикладі JWST біографію підтверджено |
| Дуже короткий текст | 2 новини | Одна з них — збережений шаблон помилки ESA |

## Виправлено в коді

- Збереження відео: ID новини фіксується до вставлення рядків фото. Раніше `cursor.lastrowid` після вставлення фото міг указувати на ID зображення, і відео потрапляло до іншої новини або губилося при помилці зовнішнього ключа.
- Вибір основного тексту статті перед загальним `<article>`, відсікання біографій автора, навігації, скриптів та службових блоків.
- Обробка одинарних лапок атрибутів, `data-src`, `data-lazy-src`, `srcset`, RSS media thumbnails/enclosures, `<video src>` і відео з query-параметрами.
- Декодування entities у URL та безпечне декодування некоректних числових HTML entities.
- Вибір обкладинки з Open Graph, щоб перша ілюстрація не підміняла обкладинку.
- Обрізання тексту без часткових медіаплейсхолдерів і без збереження медіарядків за межами тексту.
- Відхилення шаблону ESA `error-404`, навіть якщо відповідь HTTP 200.
- Перевірка байтів зображення перед записом у кеш; повторна спроба завантаження невалідного кешу.
- Стандартне SVG-прев’ю карток на головній, в архіві, у новинах місій і в пов’язаних новинах.

## Що залишилося у вже опублікованих даних

Код і production-база — різні результати цієї роботи: зміни локальні, сайт не розгортався. Старі відеозв’язки автоматично не відновлювалися, тексти та переклади не переписувалися. Після розгортання декодування URL та стандартне прев’ю працюватимуть для наявних записів; для втрачених відеозв’язків потрібне адресне відновлення з джерел.

Наявний адміністративний інструмент «Refresh from source» (`database.refresh_news_article_from_source`) може відновити текст і медіа конкретної статті. Він також скидає український переклад і замінює текст, тому перелік нижче слід використовувати для адресного перегляду, а не безумовного масового перезапису.

`new-brain-for-galileo`: джерело ESA повертає HTTP 200 зі сторінкою `error-404`; у базі збережено лише “Go back to Earth to get your bearings.”. Це потребує виправлення URL джерела/редакційного рішення, а не повторення того самого імпорту.

## Перевірка

- 12 offline-тестів парсера; 8 тестів даних/БД без підключення до БД.
- 5 HTTP-тестів через локальну Postman simulation: стаття, RSS, 503 джерела, HTML замість фото з HTTP 200 та відновлення невалідного кешу фото. Запити підтверджені журналом симуляції.
- 14 React-тестів, включно з fallback при відсутньому/зламаному фото та YouTube referrer policy.
- `npm run build` завершився успішно; попередження ESLint стосуються інших компонентів.
- На локально збережених реальних HTML-прикладах: JWST → 5 241 символ, 2 відео, без біографії автора; два порожні ESA-приклади → понад 6 000 символів і медіа; NASA Movie Night → 4 відео; ESA error-404 → порожній результат без збереження шаблону.

## Повторення аудиту

```powershell
.venv/Scripts/python.exe scripts/audit_news.py --check-images
.venv/Scripts/python.exe scripts/audit_news.py --recheck-failures
```

Сирі результати: `data/news-audit/report.json` (локальний файл у gitignored `data/`). Картинки перевіряються за HTTP і розпізнаванням формату/розмірів; це не повна перевірка декодування кожного пікселя чи перевірка кожного зовнішнього відео.

## Новини з відсутніми відеозв’язками

- [10-things-movie-night](https://orbitlight.space/en/news/10-things-movie-night) — NASA
- [arctic-sea-ice-2026-min](https://orbitlight.space/en/news/arctic-sea-ice-2026-min) — NASA
- [career-spotlight-mechanic-ages-14-18](https://orbitlight.space/en/news/career-spotlight-mechanic-ages-14-18) — NASA
- [europes-scorching-summer](https://orbitlight.space/en/news/europes-scorching-summer) — NASA
- [falcon-heavy-to-fly-its-first-mission-for-u-s-spy-satellite-agency](https://orbitlight.space/en/news/falcon-heavy-to-fly-its-first-mission-for-u-s-spy-satellite-agency) — SpaceflightNow
- [human-related-microbes-may-survive-moons-south-pole-nasa-finds](https://orbitlight.space/en/news/human-related-microbes-may-survive-moons-south-pole-nasa-finds) — NASA
- [live-coverage-ai-datacenter-prototypes-energy-redirection-demonstrators-and-more-launching-on-spacexs-transporter-18](https://orbitlight.space/en/news/live-coverage-ai-datacenter-prototypes-energy-redirection-demonstrators-and-more-launching-on-spacexs-transporter-18) — SpaceflightNow
- [live-coverage-avio-to-launch-spacecraft-to-monitor-plant-health-and-ocean-conditions](https://orbitlight.space/en/news/live-coverage-avio-to-launch-spacecraft-to-monitor-plant-health-and-ocean-conditions) — SpaceflightNow
- [live-coverage-nasa-spacex-to-launch-new-solar-arrays-6300-pounds-of-cargo-to-the-space-station](https://orbitlight.space/en/news/live-coverage-nasa-spacex-to-launch-new-solar-arrays-6300-pounds-of-cargo-to-the-space-station) — SpaceflightNow
- [live-coverage-nasa-spacex-to-launch-next-crewed-mission-to-the-international-space-station](https://orbitlight.space/en/news/live-coverage-nasa-spacex-to-launch-next-crewed-mission-to-the-international-space-station) — SpaceflightNow
- [live-coverage-spacex-to-launch-100th-orbital-mission-of-2026](https://orbitlight.space/en/news/live-coverage-spacex-to-launch-100th-orbital-mission-of-2026) — SpaceflightNow
- [live-coverage-spacex-to-launch-21-data-transport-satellites-for-the-space-development-agency](https://orbitlight.space/en/news/live-coverage-spacex-to-launch-21-data-transport-satellites-for-the-space-development-agency) — SpaceflightNow
- [live-coverage-spacex-to-launch-27-starlink-satellites-on-falcon-9-rocket-from-vandenberg-2](https://orbitlight.space/en/news/live-coverage-spacex-to-launch-27-starlink-satellites-on-falcon-9-rocket-from-vandenberg-2) — SpaceflightNow
- [live-coverage-spacex-to-launch-27-starlink-satellites-on-falcon-9-rocket-from-vandenberg-sfb-5](https://orbitlight.space/en/news/live-coverage-spacex-to-launch-27-starlink-satellites-on-falcon-9-rocket-from-vandenberg-sfb-5) — SpaceflightNow
- [live-coverage-spacex-to-launch-27-starlink-v2-mini-satellites-on-falcon-9-rocket-from-vandenberg](https://orbitlight.space/en/news/live-coverage-spacex-to-launch-27-starlink-v2-mini-satellites-on-falcon-9-rocket-from-vandenberg) — SpaceflightNow
- [live-coverage-spacex-to-launch-75th-starlink-mission-of-2026](https://orbitlight.space/en/news/live-coverage-spacex-to-launch-75th-starlink-mission-of-2026) — SpaceflightNow
- [live-coverage-spacex-to-launch-80th-starlink-mission-of-2026](https://orbitlight.space/en/news/live-coverage-spacex-to-launch-80th-starlink-mission-of-2026) — SpaceflightNow
- [live-coverage-spacex-to-launch-classified-payload-for-the-u-s-space-force](https://orbitlight.space/en/news/live-coverage-spacex-to-launch-classified-payload-for-the-u-s-space-force) — SpaceflightNow
- [live-coverage-spacex-to-launch-classified-payload-for-u-s-space-force](https://orbitlight.space/en/news/live-coverage-spacex-to-launch-classified-payload-for-u-s-space-force) — SpaceflightNow
- [live-coverage-spacex-to-launch-final-3-o3b-mpower-satellites-for-ses](https://orbitlight.space/en/news/live-coverage-spacex-to-launch-final-3-o3b-mpower-satellites-for-ses) — SpaceflightNow
- [live-coverage-spacex-to-launch-first-starlink-v3-satellites-to-orbit-on-starship](https://orbitlight.space/en/news/live-coverage-spacex-to-launch-first-starlink-v3-satellites-to-orbit-on-starship) — SpaceflightNow
- [live-coverage-spacex-to-launch-national-security-payload-for-the-u-s-space-force-on-falcon-9-rocket-from-vandenberg](https://orbitlight.space/en/news/live-coverage-spacex-to-launch-national-security-payload-for-the-u-s-space-force-on-falcon-9-rocket-from-vandenberg) — SpaceflightNow
- [live-coverage-spacex-to-launch-satellite-replenishment-mission-for-globalstar-from-cape-canaveral](https://orbitlight.space/en/news/live-coverage-spacex-to-launch-satellite-replenishment-mission-for-globalstar-from-cape-canaveral) — SpaceflightNow
- [live-coverage-spacex-to-launch-starfall-reentry-capsule-31-customer-payloads-on-bandwagon-5-rideshare-mission](https://orbitlight.space/en/news/live-coverage-spacex-to-launch-starfall-reentry-capsule-31-customer-payloads-on-bandwagon-5-rideshare-mission) — SpaceflightNow
- [live-coverage-spacex-to-launch-starlink-mission-on-a-falcon-boosters-record-breaking-37th-flight](https://orbitlight.space/en/news/live-coverage-spacex-to-launch-starlink-mission-on-a-falcon-boosters-record-breaking-37th-flight) — SpaceflightNow
- [live-coverage-spacex-to-send-starlink-satellites-to-orbit-with-tuesday-night-launch-from-california](https://orbitlight.space/en/news/live-coverage-spacex-to-send-starlink-satellites-to-orbit-with-tuesday-night-launch-from-california) — SpaceflightNow
- [nasa-administrator-extremely-confident-in-artemis-3-launch-in-2027](https://orbitlight.space/en/news/nasa-administrator-extremely-confident-in-artemis-3-launch-in-2027) — SpaceflightNow
- [nasa-armstrong-celebrates-80-years-of-flight-innovation](https://orbitlight.space/en/news/nasa-armstrong-celebrates-80-years-of-flight-innovation) — NASA
- [nasa-begins-moon-mission-plume-surface-interaction-tests](https://orbitlight.space/en/news/nasa-begins-moon-mission-plume-surface-interaction-tests) — NASA
- [nasa-campaign-explores-clouds-spawned-by-wildfires](https://orbitlight.space/en/news/nasa-campaign-explores-clouds-spawned-by-wildfires) — NASA
- [nasa-celebrates-restoration-of-guam-station-damaged-by-typhoon-mawar](https://orbitlight.space/en/news/nasa-celebrates-restoration-of-guam-station-damaged-by-typhoon-mawar) — NASA
- [nasa-funded-research-finds-complex-life-defying-record-heat](https://orbitlight.space/en/news/nasa-funded-research-finds-complex-life-defying-record-heat) — NASA
- [nasa-provides-progress-update-on-moon-base-rovers](https://orbitlight.space/en/news/nasa-provides-progress-update-on-moon-base-rovers) — NASA
- [nasa-river-forecasts-snow-drought](https://orbitlight.space/en/news/nasa-river-forecasts-snow-drought) — NASA
- [nasa-satellites-observe-historic-2026-el-nino](https://orbitlight.space/en/news/nasa-satellites-observe-historic-2026-el-nino) — NASA
- [nasa-shares-views-of-august-solar-eclipse-from-ground-air-space](https://orbitlight.space/en/news/nasa-shares-views-of-august-solar-eclipse-from-ground-air-space) — NASA
- [nasa-unveils-winning-designs-for-mars-space-food-systems-challenge](https://orbitlight.space/en/news/nasa-unveils-winning-designs-for-mars-space-food-systems-challenge) — NASA
- [nasa-watches-earths-weight-finds-center-of-mass](https://orbitlight.space/en/news/nasa-watches-earths-weight-finds-center-of-mass) — NASA
- [nasas-casals-instrument-bridges-gaps-in-3d-maps-of-earths-surface](https://orbitlight.space/en/news/nasas-casals-instrument-bridges-gaps-in-3d-maps-of-earths-surface) — NASA
- [nasas-hubble-webb-find-far-out-solar-system-objects-remember-past](https://orbitlight.space/en/news/nasas-hubble-webb-find-far-out-solar-system-objects-remember-past) — NASA
- [nasas-lro-images-falcon-9-crater-on-moon-learns-new-details](https://orbitlight.space/en/news/nasas-lro-images-falcon-9-crater-on-moon-learns-new-details) — NASA
- [nasas-pandora-mission-begins-study-of-exoplanets-host-stars](https://orbitlight.space/en/news/nasas-pandora-mission-begins-study-of-exoplanets-host-stars) — NASA
- [newfound-baby-planet-smashes-record-for-youngest-known-world](https://orbitlight.space/en/news/newfound-baby-planet-smashes-record-for-youngest-known-world) — NASA
- [perseverance-captures-another-phobos-transit](https://orbitlight.space/en/news/perseverance-captures-another-phobos-transit) — NASA
- [power-up-roll-out-solar-arrays-boost-space-station-power-supply](https://orbitlight.space/en/news/power-up-roll-out-solar-arrays-boost-space-station-power-supply) — NASA
- [roman-space-telescope-nasas-next-great-observatory-poised-for-sunday-launch](https://orbitlight.space/en/news/roman-space-telescope-nasas-next-great-observatory-poised-for-sunday-launch) — SpaceflightNow
- [spacex-falcon-9-rocket-to-launch-27-starlink-satellites-into-orbit-from-california](https://orbitlight.space/en/news/spacex-falcon-9-rocket-to-launch-27-starlink-satellites-into-orbit-from-california) — SpaceflightNow
- [spacex-falcon-9-to-launch-classified-mission-for-u-s-space-force-from-west-coast](https://orbitlight.space/en/news/spacex-falcon-9-to-launch-classified-mission-for-u-s-space-force-from-west-coast) — SpaceflightNow
- [spacex-launches-nasa-science-and-cargo-to-the-international-space-station](https://orbitlight.space/en/news/spacex-launches-nasa-science-and-cargo-to-the-international-space-station) — SpaceflightNow
- [spacex-stack-starship-and-super-heavy-for-first-orbital-flight](https://orbitlight.space/en/news/spacex-stack-starship-and-super-heavy-for-first-orbital-flight) — SpaceflightNow
- [spacex-to-launch-starlink-mission-from-west-coast](https://orbitlight.space/en/news/spacex-to-launch-starlink-mission-from-west-coast) — SpaceflightNow
- [spacex-to-make-another-attempt-to-launch-21-data-satellites-for-space-development-agency](https://orbitlight.space/en/news/spacex-to-make-another-attempt-to-launch-21-data-satellites-for-space-development-agency) — SpaceflightNow
- [starstruck-nasa-research-shows-how-suns-ancient-history-shaped-earth](https://orbitlight.space/en/news/starstruck-nasa-research-shows-how-suns-ancient-history-shaped-earth) — NASA
- [suspected-second-generation-planet-solves-nasa-hubble-cold-case](https://orbitlight.space/en/news/suspected-second-generation-planet-solves-nasa-hubble-cold-case) — NASA
- [us-india-satellite-captures-time-lapse-video-of-volcanic-eruption](https://orbitlight.space/en/news/us-india-satellite-captures-time-lapse-video-of-volcanic-eruption) — NASA
- [whats-up-october-2026-skywatching-tips-from-nasa](https://orbitlight.space/en/news/whats-up-october-2026-skywatching-tips-from-nasa) — NASA
- [whats-up-september-2026-skywatching-tips-from-nasa](https://orbitlight.space/en/news/whats-up-september-2026-skywatching-tips-from-nasa) — NASA
- [xrism-sees-pulsar-gathering-companions-wind](https://orbitlight.space/en/news/xrism-sees-pulsar-gathering-companions-wind) — NASA

## Новини без збереженого тексту

- [esa-space-environment-report-2026](https://orbitlight.space/en/news/esa-space-environment-report-2026) — ESA
- [first-contracts-kick-off-european-launcher-challenge](https://orbitlight.space/en/news/first-contracts-kick-off-european-launcher-challenge) — ESA
- [hera-s-mars-flyby-guided-impact-study-of-deimos-moon](https://orbitlight.space/en/news/hera-s-mars-flyby-guided-impact-study-of-deimos-moon) — ESA
- [three-earth-explorer-candidates-go-forward](https://orbitlight.space/en/news/three-earth-explorer-candidates-go-forward) — ESA

## Картки без фото

- [nasa-invites-media-to-2026-von-braun-space-exploration-symposium](https://orbitlight.space/en/news/nasa-invites-media-to-2026-von-braun-space-exploration-symposium) — NASA
- [faster-to-science-a-letter-to-the-science-community](https://orbitlight.space/en/news/faster-to-science-a-letter-to-the-science-community) — NASA
- [technomile-recognized-as-a-2026-inc-power-partner-award-winner](https://orbitlight.space/en/news/technomile-recognized-as-a-2026-inc-power-partner-award-winner) — SpaceNews
- [summer-of-quantum-building-momentum-for-space-based-qkd](https://orbitlight.space/en/news/summer-of-quantum-building-momentum-for-space-based-qkd) — SpaceNews
- [solstar-provides-wi-fi-connectivity-for-nasa-proximity-operations-demonstration](https://orbitlight.space/en/news/solstar-provides-wi-fi-connectivity-for-nasa-proximity-operations-demonstration) — SpaceNews
- [space-nuclear-power-corporation-awarded-darpa-agreement-for-ground-test-of-autonomous-nuclear-reactor-controller](https://orbitlight.space/en/news/space-nuclear-power-corporation-awarded-darpa-agreement-for-ground-test-of-autonomous-nuclear-reactor-controller) — SpaceNews
- [apod-2026-october-18-sonified-eagle-nebula-pillars](https://orbitlight.space/en/news/apod-2026-october-18-sonified-eagle-nebula-pillars) — NASA
- [apod-2026-october-16-chasing-the-international-space-station](https://orbitlight.space/en/news/apod-2026-october-16-chasing-the-international-space-station) — NASA
- [nasa-welcomes-all-ages-experience-levels-for-space-apps-challenge](https://orbitlight.space/en/news/nasa-welcomes-all-ages-experience-levels-for-space-apps-challenge) — NASA
- [agile-space-industries-expands-to-seattle-area-with-new-bellevue-office](https://orbitlight.space/en/news/agile-space-industries-expands-to-seattle-area-with-new-bellevue-office) — SpaceNews
- [job-opportunities-nasa-office-of-the-general-counsel](https://orbitlight.space/en/news/job-opportunities-nasa-office-of-the-general-counsel) — NASA
- [nasas-spacex-crs-35-mission-to-launch-health-research](https://orbitlight.space/en/news/nasas-spacex-crs-35-mission-to-launch-health-research) — NASA
- [esa-at-ila-2026-day-2-highlights](https://orbitlight.space/en/news/esa-at-ila-2026-day-2-highlights) — ESA
- [esa-science-missions-get-green-light-for-new-discoveries-3](https://orbitlight.space/en/news/esa-science-missions-get-green-light-for-new-discoveries-3) — ESA
- [watch-the-total-solar-eclipse-with-esa-in-leon-2](https://orbitlight.space/en/news/watch-the-total-solar-eclipse-with-esa-in-leon-2) — ESA
- [esa-council-appoints-two-new-directors-3](https://orbitlight.space/en/news/esa-council-appoints-two-new-directors-3) — ESA
- [esa-statement-on-the-wildfires-near-cebreros](https://orbitlight.space/en/news/esa-statement-on-the-wildfires-near-cebreros) — ESA
- [esa-and-poland-to-establish-a-new-civil-security-and-resilience-centre-in-warsaw](https://orbitlight.space/en/news/esa-and-poland-to-establish-a-new-civil-security-and-resilience-centre-in-warsaw) — ESA
- [esa-at-ila-2026-day-1-highlights](https://orbitlight.space/en/news/esa-at-ila-2026-day-1-highlights) — ESA
- [esa-welcomes-new-uk-space-and-defence-gateway-5](https://orbitlight.space/en/news/esa-welcomes-new-uk-space-and-defence-gateway-5) — ESA
- [esa-s-euclid-captures-the-milky-way-s-crowded-heart-4](https://orbitlight.space/en/news/esa-s-euclid-captures-the-milky-way-s-crowded-heart-4) — ESA
- [deposition-sciences-inc-expands-sunshade-tape-offering-with-new-12-x-30-format](https://orbitlight.space/en/news/deposition-sciences-inc-expands-sunshade-tape-offering-with-new-12-x-30-format) — SpaceNews
- [agile-space-industries-strengthens-board-and-corporate-development-to-support-continued-growth](https://orbitlight.space/en/news/agile-space-industries-strengthens-board-and-corporate-development-to-support-continued-growth) — SpaceNews
- [galileo-space-is-building-satellites-that-turn-signals-into-answers-in-orbit](https://orbitlight.space/en/news/galileo-space-is-building-satellites-that-turn-signals-into-answers-in-orbit) — SpaceNews
- [navigate-successfully-demonstrates-onboard-precise-orbit-determination-aboard-d-orbits-ion-satellite-carrier](https://orbitlight.space/en/news/navigate-successfully-demonstrates-onboard-precise-orbit-determination-aboard-d-orbits-ion-satellite-carrier) — SpaceNews
- [quantum-space-executes-launch-processing-agreement-with-all-points-logistics-for-prime-mission](https://orbitlight.space/en/news/quantum-space-executes-launch-processing-agreement-with-all-points-logistics-for-prime-mission) — SpaceNews
- [nasa-awards-orbital-safety-analysis-support-services-contract](https://orbitlight.space/en/news/nasa-awards-orbital-safety-analysis-support-services-contract) — NASA
- [terran-orbital-names-jamin-brown-chief-operating-officer](https://orbitlight.space/en/news/terran-orbital-names-jamin-brown-chief-operating-officer) — SpaceNews
- [agile-space-industries-expands-leadership-structure-to-support-next-phase-of-growth](https://orbitlight.space/en/news/agile-space-industries-expands-leadership-structure-to-support-next-phase-of-growth) — SpaceNews
- [ffa-2026-hyperwall-schedule](https://orbitlight.space/en/news/ffa-2026-hyperwall-schedule) — NASA
- [commercial-space-federation-csf-welcomes-two-new-members](https://orbitlight.space/en/news/commercial-space-federation-csf-welcomes-two-new-members) — SpaceNews
- [nasa-ethics-advice-for-widely-attended-gatherings-wags](https://orbitlight.space/en/news/nasa-ethics-advice-for-widely-attended-gatherings-wags) — NASA
- [terran-orbital-promotes-margherita-cardi-to-vice-president-of-european-operations-head-of-strategic-programs](https://orbitlight.space/en/news/terran-orbital-promotes-margherita-cardi-to-vice-president-of-european-operations-head-of-strategic-programs) — SpaceNews
- [nasa-invites-media-to-international-observe-the-moon-night](https://orbitlight.space/en/news/nasa-invites-media-to-international-observe-the-moon-night) — NASA
- [new-crops-health-research-proposals-to-help-nasa-advance-exploration](https://orbitlight.space/en/news/new-crops-health-research-proposals-to-help-nasa-advance-exploration) — NASA
- [apod-2026-september-13-comet-neowise-rising-over-the-adriatic-sea](https://orbitlight.space/en/news/apod-2026-september-13-comet-neowise-rising-over-the-adriatic-sea) — NASA
- [latconnect-60-expands-india-market-presence-for-swirsat-with-nsil-agreement-and-geosyze-partnership](https://orbitlight.space/en/news/latconnect-60-expands-india-market-presence-for-swirsat-with-nsil-agreement-and-geosyze-partnership) — SpaceNews
- [nasa-ames-fire-department-aircraft-firefighting-training](https://orbitlight.space/en/news/nasa-ames-fire-department-aircraft-firefighting-training) — NASA
- [agile-space-industries-celebrates-durango-headquarters-expansion-with-ribbon-cutting](https://orbitlight.space/en/news/agile-space-industries-celebrates-durango-headquarters-expansion-with-ribbon-cutting) — SpaceNews
- [apod-2026-august-31-launch-of-the-roman-space-telescope](https://orbitlight.space/en/news/apod-2026-august-31-launch-of-the-roman-space-telescope) — NASA
- [latconnect-60-and-phi-earth-partner-to-connect-space-and-soil](https://orbitlight.space/en/news/latconnect-60-and-phi-earth-partner-to-connect-space-and-soil) — SpaceNews
- [rtxs-blue-canyon-technologies-introduces-new-spacecraft-mission-enabler](https://orbitlight.space/en/news/rtxs-blue-canyon-technologies-introduces-new-spacecraft-mission-enabler) — SpaceNews
- [nasa-ames-experts-available-for-roman-space-telescope-interviews](https://orbitlight.space/en/news/nasa-ames-experts-available-for-roman-space-telescope-interviews) — NASA
- [nasa-invites-media-to-lunarecycle-challenge-finale-event-in-alabama](https://orbitlight.space/en/news/nasa-invites-media-to-lunarecycle-challenge-finale-event-in-alabama) — NASA
- [tb-26-04-updates-and-modernization-of-nasas-chemical-equilibrium-with-applications-cea-code](https://orbitlight.space/en/news/tb-26-04-updates-and-modernization-of-nasas-chemical-equilibrium-with-applications-cea-code) — NASA
- [smallsat-2026](https://orbitlight.space/en/news/smallsat-2026) — NASA
- [nasa-techleap-prize-orbital-clarity-challenge](https://orbitlight.space/en/news/nasa-techleap-prize-orbital-clarity-challenge) — NASA
- [apod-2026-august-19-the-case-of-the-mysterious-maybe-meteor](https://orbitlight.space/en/news/apod-2026-august-19-the-case-of-the-mysterious-maybe-meteor) — NASA

## Кандидати з біографією / промоблоком

- [are-mega-constellations-sleepwalking-low-earth-orbit-into-runaway-chaos](https://orbitlight.space/en/news/are-mega-constellations-sleepwalking-low-earth-orbit-into-runaway-chaos) — Universe Today
- [astronomers-find-a-sub-neptune-orbiting-completely-backward-around-a-red-dwarf](https://orbitlight.space/en/news/astronomers-find-a-sub-neptune-orbiting-completely-backward-around-a-red-dwarf) — Universe Today
- [earths-magnetosphere-might-not-protect-us-from-superstorms-after-all](https://orbitlight.space/en/news/earths-magnetosphere-might-not-protect-us-from-superstorms-after-all) — Universe Today
- [exercise-keeps-astronaut-hearts-in-fighting-shape-for-the-journey-to-mars](https://orbitlight.space/en/news/exercise-keeps-astronaut-hearts-in-fighting-shape-for-the-journey-to-mars) — Universe Today
- [high-orbit-laser-satellites-could-guide-future-lunar-travelers](https://orbitlight.space/en/news/high-orbit-laser-satellites-could-guide-future-lunar-travelers) — Universe Today
- [honda-wants-to-put-a-robotic-lab-assistant-on-future-commercial-space-stations](https://orbitlight.space/en/news/honda-wants-to-put-a-robotic-lab-assistant-on-future-commercial-space-stations) — Universe Today
- [jwst-reveals-a-lopsided-alien-world-with-blistering-evening-winds](https://orbitlight.space/en/news/jwst-reveals-a-lopsided-alien-world-with-blistering-evening-winds) — Universe Today
- [nasa-funds-interworld-slingshot-concept-to-map-solar-system-resources](https://orbitlight.space/en/news/nasa-funds-interworld-slingshot-concept-to-map-solar-system-resources) — Universe Today
- [nasa-highlights-next-gen-cargo-landers-paving-the-way-for-a-moon-base](https://orbitlight.space/en/news/nasa-highlights-next-gen-cargo-landers-paving-the-way-for-a-moon-base) — Universe Today
- [nasa-wants-to-float-microscopic-tracers-on-sunlight-to-map-the-edge-of-space](https://orbitlight.space/en/news/nasa-wants-to-float-microscopic-tracers-on-sunlight-to-map-the-edge-of-space) — Universe Today
- [scientists-melted-a-diamond-and-cracked-a-secret-of-ice-giants](https://orbitlight.space/en/news/scientists-melted-a-diamond-and-cracked-a-secret-of-ice-giants) — Universe Today
- [snapping-the-suns-grand-magnetic-border-at-03-au](https://orbitlight.space/en/news/snapping-the-suns-grand-magnetic-border-at-03-au) — Universe Today
- [whats-carving-active-gullies-on-mars-its-not-water](https://orbitlight.space/en/news/whats-carving-active-gullies-on-mars-its-not-water) — Universe Today
