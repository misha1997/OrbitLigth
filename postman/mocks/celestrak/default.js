// Synthetic orbital elements based on the official CelesTrak OMM schema.
// No claim that these are real current orbits. Used only for local QA.
const http = require('node:http');
const epoch = new Date().toISOString();
const row = (id, name, index = 0) => ({ OBJECT_NAME: name, OBJECT_ID: ({25544:'1998-067A',48274:'2021-035A',44713:'2019-074A'})[id] || '2026-001A', NORAD_CAT_ID: id,
  EPOCH: epoch, MEAN_MOTION: index % 23 === 0 ? 1.0027 : 14.9 + (index % 10) * .05,
  ECCENTRICITY: .0005, INCLINATION: 30 + index % 70, RA_OF_ASC_NODE: index * 17 % 360,
  ARG_OF_PERICENTER: 20, MEAN_ANOMALY: index * 31 % 360, BSTAR: .00002,
  MEAN_MOTION_DOT: .000001, MEAN_MOTION_DDOT: 0, EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: 'U', ELEMENT_SET_NO: 999, REV_AT_EPOCH: 100 });
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname === '/satcat-unavailable.csv') { res.writeHead(503); return res.end('{"error":"Fixture outage"}'); }
  if (url.pathname === '/satcat-invalid.csv') { res.setHeader('Content-Type', 'text/html'); return res.end('<html>Unavailable</html>'); }
  if (['/satcat.csv', '/satcat-empty.csv'].includes(url.pathname)) {
    res.setHeader('Content-Type', 'text/csv');
    const header = 'OBJECT_NAME,NORAD_CAT_ID,OBJECT_TYPE,OWNER,LAUNCH_DATE,DECAY_DATE,RCS\n';
    const records = Array.from({ length: 14 }, (_, i) => {
      const decay = new Date(Date.now() - (i + 1) * 86400000).toISOString().slice(0, 10);
      return `TEST REENTRY ${i},${150000 + i},${['PAY', 'R B', 'DEB'][i % 3]},TEST,2025-01-01,${decay},1.5`;
    });
    return res.end(header + (url.pathname === '/satcat-empty.csv' ? '' : records.join('\n')));
  }
  if (url.pathname !== '/gp.php') { res.writeHead(501); return res.end('{}'); }
  if (url.searchParams.get('FORMAT') !== 'JSON' || ['GROUP', 'NAME', 'CATNR'].filter(k => url.searchParams.has(k)).length !== 1) {
    res.writeHead(400); return res.end('{"error":"Invalid GP query"}');
  }
  if (url.searchParams.get('GROUP') === 'analyst') { res.writeHead(503); return res.end('{"error":"Fixture outage"}'); }
  const iss = row(25544, 'ISS (ZARYA)', 1);
  let rows;
  if (url.searchParams.get('GROUP') === 'stations') rows = [iss, row(48274, 'CSS (TIANHE)', 4)];
  else if (url.searchParams.get('GROUP') === 'starlink') rows = [row(44713, 'STARLINK-1007', 7)];
  else if (['visual', 'science', 'weather', 'gnss'].includes(url.searchParams.get('GROUP'))) {
    const group = url.searchParams.get('GROUP');
    const [count, base] = { visual: [154, 100000], science: [46, 110000], weather: [73, 115000], gnss: [169, 116000] }[group];
    rows = [...(group === 'visual' ? [iss] : []), ...Array.from({ length: count }, (_, i) => row(base + i, `TEST ${group.toUpperCase()} ${i}`, i))];
  }
  else if (url.searchParams.get('NAME') === 'DEB') rows = Array.from({ length: 3000 }, (_, i) => row(120000 + i, `TEST DEB ${i}`, i));
  else if (url.searchParams.get('NAME') === 'R/B') rows = Array.from({ length: 1000 }, (_, i) => row(140000 + i, `TEST R/B ${i}`, i));
  else rows = [iss, ...Array.from({ length: 6000 }, (_, i) => row(100000 + i, `TEST SAT ${i}`, i))];
  res.end(JSON.stringify(rows));
}).listen(process.env.PORT);
