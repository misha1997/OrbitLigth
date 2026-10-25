# orbits — 2026-10-25

## Purpose

Exercise NEOwatch's real `/api/orbits` adapter against the CelesTrak dependency
using synthetic OMM records matching the official schema. The handler is
`postman/mocks/celestrak/default.js`; the public contract is in
`postman/contracts/celestrak-orbits.openapi.yaml`.
The `gcat` member also exercises the selected object's launch provenance;
see `postman/contracts/satellite-launch.openapi.yaml`.

## Execution

Run `postman simulation run postman/simulations/orbits.sim.yaml --port 4917
--output ndjson --no-history` and redirect output to an ignored log. Start the
application with `CELESTRAK_GP_URL=http://127.0.0.1:4917/celestrak/gp.php`.
Set `GCAT_BASE_URL=http://127.0.0.1:4917/gcat` for launch enrichment. A base
ending in `/gcat/unavailable` injects a 503. Reset the GCAT snapshot/expiry
between cold-failure and stale-fallback runs, or use a fresh process.
For the lower page sections set
`CELESTRAK_SATCAT_URL=http://127.0.0.1:4917/celestrak/satcat.csv`; the same
member serves `/satcat-unavailable.csv` (503), `/satcat-invalid.csv` (HTML) and
`/satcat-empty.csv` (valid header only). Clear the `reentries:` cache between
scenarios or start a fresh process.
Use a separate TLE stash for QA, then request `/api/orbits?group=active`,
`group=stations`, `group=debris`, `group=rocket-bodies`, `group=analyst`, and
`group=unknown`. Stop the simulation and QA service with Ctrl+C.

## Assumptions

- Synthetic data tests catalog scale and behavior, not current physical orbits
  (observed 2026-10-25). The real stations JSON schema was checked separately.
- Published owner mock discovery was unavailable because the CLI is signed out
  (observed 2026-10-25); the local mock follows official GP documentation.
- Orbit discovery returned credentialed OrbitalWiki details or grouped launch
  counts (2026-10-25). Public GCAT TSVs were selected from their own field
  documentation for historical vehicle/organization coverage without a key.
- The browser accessibility tree includes native canvas fallback text even
  with successful WebGL rendering (observed 2026-10-25). Use actual screenshots
  to assess renderer availability; the hero and fullscreen globe rendered.

## Observations

<!-- begin:observations -->
- 2026-10-25: Real GCAT HTTP adapter calls matched SpaceX/Falcon 9/2019-11-11,
  retained launch provenance without an owner for a debris prefix match, and
  distinguished no match from 503. A failed refresh retained the original
  snapshot timestamp; a cold 503 reported unavailable. Separate live GCAT
  checks confirmed Starlink 1007, Zarya, Hubble and Tianhe fields/organization
  codes against the current tables. Desktop/390px mobile UI showed the SpaceX
  identity asset, rocket/date and separate owner in both map views without
  horizontal overflow; switching views reused one metadata request. Fixture
  orbits remain synthetic.
- 2026-10-25: The real reentry service/adapter completed all four SATCAT HTTP
  scenarios: ten recent records, unavailable 503, unavailable malformed HTML,
  and available empty CSV. Dates and rocket types were normalized. Recommended
  orbital groups now have bounded synthetic populations, while `active` retains
  the large-catalog fixture. Browser QA showed 444 deduplicated fixture objects,
  restored all five recommended groups after clearing, expanded/collapsed the
  reentries list, and verified retry on a separate 503-backed app instance.
  Desktop and 390px mobile cards had no horizontal overflow; the globe retained
  the same selection. Test positions are not live orbital observations.
- 2026-10-25: Selection/layout QA used the stations and visual queries, then
  disabled the visual fixture to isolate two station markers. The selected
  screen symbol stayed 38px at both zoom levels, disappeared behind Earth,
  and returned after focusing. The embedded 3D toolbar did not overlap the
  detail close button at desktop or 390px width; closing the card worked.
- 2026-10-25: Tooltip UI verification reused `celestrak`, which served all four
  default sources. Type and group descriptions opened in the page and dialog;
  Escape dismissed the tooltip without closing the dialog. A 390px viewport
  check confirmed the popup stayed on screen and the info button did not
  toggle its checkbox. All 56 descriptions have Ukrainian/English coverage.
- 2026-10-25: The sole member `celestrak` served all four default source queries
  and the analyst 503 scenario. The real adapter returned uncapped groups,
  retained six-digit IDs, reported unavailability explicitly and rejected an
  unknown group with 404. The browser displayed 10,002 deduplicated objects.
<!-- end:observations -->

## What didn't work

- 2026-10-25: In the restricted Windows sandbox, Postman dataset-daemon crashed
  with `Exception 0xc0000008`; the normal local execution succeeded. Python
  `asyncio.to_thread` tests also needed normal local execution to finish.
