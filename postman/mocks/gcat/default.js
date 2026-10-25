// Minimal GCAT TSV fixtures with the columns and comments verified upstream.
const http = require('node:http');
const launches = [
  ['1998-067', '1998 Nov 20 0640:00', '1998-067A', 'PPTH-MU', 'S25544', 'JSC', 'Proton-K', '395-01', 'RVSNR'],
  ['2021-035', '2021 Apr 29 0323:16', '2021-035A', 'PPTH-MU', 'S48274', 'CMSEO', 'Chang Zheng 5B', 'Y2', 'CALT'],
  ['2019-074', '2019 Nov 11 1456', '2019-074A', 'P', 'S44713', 'SPXS', 'Falcon 9', '077/B1048.4', 'SPX'],
  ['2019-074', '2019 Nov 11 1456', '2019-074B', 'P', 'S44714', 'SPXS', 'Falcon 9', '077/B1048.4', 'SPX'],
  ['2026-001', '2026 Jan 1?', '2026-001A', 'P', 'S100000', 'ESA', 'Test vehicle', '-', 'ESA'],
];
const orgs = [
  ['SPX', 'SpaceX', '-'], ['SPXS', 'SpaceX Services', '-'], ['JSC', 'Lyndon B. Johnson Space Center', '-'],
  ['RVSNR', 'RVSN RF', 'Russian Strategic Rocket Forces'], ['CALT', 'CALT', 'Chinese Academy of Launch Vehicle Technology'],
  ['CMSEO', 'CMSEO', 'China Manned Space Engineering Office'], ['ESA', 'European Space Agency', '-'],
];
http.createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path.startsWith('/unavailable/')) { res.writeHead(503); return res.end('Temporarily unavailable'); }
  res.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8');
  if (path === '/derived/launchlog.tsv') return res.end('#Launch_Tag\tLaunch_Date\tPiece\tType\tJCAT\tSatOwner\tLV_Type\tFlight_ID\tAgency\n# Updated 2026 Oct 24 1901:37\n' + launches.map(r => r.join('\t')).join('\n'));
  if (path === '/tables/orgs.tsv') return res.end('#Code\tName\tEName\n# Updated 2026 Oct 24 1902:03\n' + orgs.map(r => r.join('\t')).join('\n'));
  res.writeHead(501); res.end('Unmodeled fixture path');
}).listen(process.env.PORT);
