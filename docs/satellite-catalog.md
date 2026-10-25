# Earth orbital explorer

The Satellites page shares one OMM catalog, worker and selection between its
Canvas Leaflet map, schematic hero globe and fullscreen Three.js globe.
ISS-specific pages continue to use the existing `/api/tle` interface.

The initial view loads stations, bright/visual, science, weather and GNSS groups
(a few hundred objects, with overlaps removed). The Recommended action restores
this selection in both views. Satellite
and station types start enabled; debris, rocket bodies and unclassified
objects start hidden. Enabling a catalog explicitly also enables its object
type, and selecting all catalogs enables all types.

The lower sections distinguish ESA's dated tracked population from MASTER-8
estimates in non-overlapping debris size bins. These curated figures are not a
live map count. Reentries show the latest ten catalog records over sixty days,
initially five rows; failures are reported explicitly and can be retried.
Successful reentry responses are cached for six hours per window/limit pair;
failed responses are not cached. See `postman/contracts/satellite-context.openapi.yaml`.

## Sources and coverage

The public registry in `web/data/tle.py` includes all 47 GP group selectors
listed by CelesTrak on 2026-10-25, plus ISS, GOES by name, and broad `NAME=DEB`
and `NAME=R/B` queries for debris and rocket bodies. The old `other` and Hubble
keys remain resolvable internally. Group overlap is deduplicated by NORAD ID;
newer OMM epochs win. Classification is derived from the source group and
standard object-name suffixes; it is not an authoritative SATCAT object type.
Stations remain classified as stations when another overlapping group supplies
their elements. Dedicated type checkboxes filter independently of sources.
Every object type and public group has a Ukrainian/English description,
available by hovering, keyboard focus or its information button. Tooltips stay
inside the fullscreen dialog's top layer and outside the sidebar's scroll clip.

CelesTrak is the orbital source; ESA debris estimates below the map do not
supply coordinates. Untracked small debris, restricted/unpublished orbits and
objects that SGP4 cannot propagate above Earth are not rendered. This is full
coverage of enabled, available public groups, not a complete catalog of every
physical object in space. No authentication or new secret is required.

Official source references:

- https://celestrak.org/NORAD/elements/
- https://celestrak.org/NORAD/documentation/gp-data-formats.php

## Data and rendering

`GET /api/orbits?group=active&lang=en` returns the complete OMM group without
the legacy 400/1000-object caps. JSON OMM supports six-digit and larger NORAD
numbers that cannot be encoded by legacy TLE. Earth/TEME/UTC/SGP4 elements
are validated; the backend retains an original `fetched_at` on stale fallback.
Concurrent requests for a group share a lock. Successful responses are cached
for two hours; upstream failures are negatively cached for five minutes.
`available` and `stale` are explicit, including unavailable sources with no
saved payload. Unknown group keys return 404. See the OpenAPI contract in
`postman/contracts/celestrak-orbits.openapi.yaml`.

The browser loads no more than three groups concurrently. Turning off a group
while it loads does not re-enable it when the response arrives. Worker SGP4
updates at two-second intervals and pauses while the document is hidden.
The globe uses Earth-fixed Cartesian coordinates in Earth-radius units;
the 2D view uses geodetic latitude and longitude from the same propagation.
Object markers are enlarged, lighting is schematic, and the selected orbital
line predicts one revolution in the current orientation of Earth. The hero's
decorative rings are schematic. A CSS globe substitutes for its WebGL canvas
on unsupported devices; fullscreen retains a usable 2D mode.
The selected object uses a fixed-size screen marker with a category symbol,
name and NORAD ID; Earth occludes it when it passes behind the planet. The
embedded map has fullscreen and 3D buttons in a Leaflet control below zoom.
Fullscreen opens the 2D explorer; 3D opens the globe. The object count and
loading/source status sit below the map, away from the detail panel.

Selection includes NORAD/COSPAR identifiers, categories and source memberships,
coordinates, altitude, speed, inclination, eccentricity, period, perigee,
apogee, ascending node, argument of perigee, mean anomaly/motion, B*, eclipse
estimate, source timestamp, epoch, raw OMM and a SATCAT link. Operator, mass
and dimensions are not inferred from orbital elements.

## Launch provenance

The shared detail panel lazily requests `/api/satellites/{norad_id}/launch`
with the OMM COSPAR designator. GCAT's `derived/launchlog.tsv` provides the
vehicle, UTC launch date and historical launch organization; `tables/orgs.tsv`
resolves organization codes to names. `SatOwner` is labeled as the owner,
separately from the launch organization, and is not asserted to be the operator.
Exact S-prefixed numeric JCAT/NORAD matches take priority. A COSPAR launch-prefix
fallback supplies launch-level details for stages/debris but never copies an
unrelated payload's owner. Conflicting values remain unknown. Uncertain GCAT
dates retain their original text, without inventing an exact day.
Years in orbit uses the exact launch date when available; a value derived only
from the COSPAR year is marked approximate.

The station note explains that this is the base NORAD object's launch, not
every module's launch. For launch-prefix matches, deployment or fragmentation
may occur later than the recorded launch. No name-based provider guessing is
used. The card links to GCAT and distinguishes no match from source failure.

One locked shared snapshot is cached for 24 hours; failed refreshes cool down
for five minutes and retain the last good snapshot/timestamp in memory. The
browser shares pending requests between embedded/fullscreen cards and ignores
responses from a previously selected object. Position updates do not refetch
metadata. Set `GCAT_BASE_URL` only to override the dependency for QA.
Verified SpaceX/NASA identity assets are local and optional; other organizations
show their source name. See `my-app/public/images/agencies/README.md`.

Sources: https://planet4589.org/space/gcat/web/cat/llog.html and
https://planet4589.org/space/gcat/web/orgs/index.html.

## Verification

Run `python -m unittest tests.test_orbital_catalog_unit -v` and, in `my-app`,
`npm test -- --watch=false --runInBand --runTestsByPath src/lib/orbitalCatalog.test.js`.
Launch provenance: `python -m unittest tests.test_satellite_launch_unit -v` and
`npm test -- --watch=false --runInBand --runTestsByPath src/components/SatelliteLaunchInfo.test.js`.
The API simulation and its reproducible commands are documented beside
`postman/simulations/orbits.sim.yaml`. Set `CELESTRAK_GP_URL` only for local
simulation, leaving the production default unchanged. Keep simulated stash
files in a separate directory when embedding the router in a QA server.
