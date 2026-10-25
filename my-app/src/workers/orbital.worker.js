import { json2satrec, gstime } from "satellite.js";
import { propagateObject } from "../lib/orbitalCatalog";

let records = [], version = 0, timer;
function tick() {
  const date = new Date(), gmst = gstime(date);
  const positions = new Float32Array(records.length * 3);
  const geographic = new Float32Array(records.length * 4);
  let valid = 0;
  records.forEach((rec, i) => {
    const p = rec && propagateObject(rec, date, gmst);
    if (!p) { geographic.fill(NaN, i * 4, i * 4 + 4); return; }
    positions.set(p.position, i * 3);
    geographic.set([p.lat, p.lon, p.alt, p.vel], i * 4);
    valid++;
  });
  // eslint-disable-next-line no-restricted-globals
  self.postMessage({ positions, geographic, valid, version, time: date.getTime() }, [positions.buffer, geographic.buffer]);
}
// eslint-disable-next-line no-restricted-globals
self.onmessage = ({ data }) => {
  clearInterval(timer);
  if (data.pause) return;
  version = data.version;
  records = data.objects.map(o => { try { return json2satrec(o.omm); } catch { return null; } });
  tick();
  timer = setInterval(tick, 2000);
};
