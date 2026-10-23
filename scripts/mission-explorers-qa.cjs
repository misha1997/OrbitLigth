// Browser smoke test against the production build; no backend or account needed.
// Run: node scripts/mission-explorers-qa.cjs [screenshot-directory]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../my-app/build');
const shots = process.argv[2];
const missions = (process.env.MISSION_QA_MISSIONS || 'perseverance,cassini,osirisrex,gaia,kepler,spitzer').split(',');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
  fs.createReadStream(target).pipe(res);
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, ws;
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mission-explorers-'));
  browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--enable-unsafe-swiftshader', '--disable-background-networking', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 120; i++) {
    try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; break; } catch { await delay(250); }
  }
  assert(port, 'Chrome started');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  const pending = new Map(), errors = [], requests = [];
  let id = 0;
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
    if (!message.id) return;
    const task = pending.get(message.id); pending.delete(message.id);
    message.error ? task.reject(message.error) : task.resolve(message.result);
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); ws.send(JSON.stringify({ id: key, method, params })); });
  const evaluate = async expression => { const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const until = async expression => { for (let i = 0; i < 240; i++) { if (await evaluate(expression)) return; await delay(250); } throw Error('Timed out: ' + expression); };
  const capture = async name => { if (!shots) return; fs.mkdirSync(shots, { recursive: true }); const result = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(shots, name + '.png'), Buffer.from(result.data, 'base64')); };
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
  const results = [];
  for (const width of [1440, 390]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
    for (const lang of ['ua', 'en']) for (const mission of missions) {
      const slug = mission === 'osirisrex' ? 'osiris-rex' : mission;
      await cdp('Page.navigate', { url: `${origin}/${lang}/${slug}` });
      await until('!!document.querySelector(".tele3d-hero-wrap canvas") && !document.querySelector(".tele3d-hero-loading")');
      await evaluate('document.documentElement.style.scrollBehavior = "auto"');
      await evaluate('Array.from(document.querySelectorAll("button")).find(b => /Тільки необхідні|Only necessary/.test(b.textContent))?.click()');
      assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'No horizontal overflow');
      assert(await evaluate('!document.body.innerText.includes("missionDetail.")'), 'Translations resolved');
      assert(await evaluate('!document.querySelector("#live")'), 'No live spacecraft telemetry');
      await capture(`${mission}-${lang}-${width}-hero`);
      await evaluate('document.querySelector("#trajectory").scrollIntoView({block:"start",behavior:"instant"})');
      await delay(150);
      for (let i = 0; i < 4; i++) {
        await evaluate(`document.querySelectorAll('.mission-map-marker')[${i}].click()`);
        assert(await evaluate(`document.querySelectorAll('.mission-destination-buttons button')[${i}].getAttribute('aria-pressed') === 'true'`));
      }
      await capture(`${mission}-${lang}-${width}-explore`);
      if (mission === 'kepler') {
        await evaluate('document.querySelector("#transit").scrollIntoView({block:"start",behavior:"instant"})');
        const initial = await evaluate('document.querySelector(".kepler-transit-results strong").textContent');
        await evaluate('{const input = document.querySelector("#kepler-radius");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"4");input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));}');
        await until(`document.querySelector('.kepler-transit-results strong').textContent !== ${JSON.stringify(initial)}`);
        await evaluate('{const input = document.querySelector("#kepler-phase");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"0");input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));}');
        await until('document.querySelectorAll(".kepler-transit-results strong")[1].textContent === "100%"');
        await capture(`${mission}-${lang}-${width}-transit`);
      }
      if (mission === 'spitzer') {
        await evaluate('document.querySelector("#infrared").scrollIntoView({block:"start",behavior:"instant"})');
        const initial = await evaluate('document.querySelector(".spitzer-spectrum-results strong").textContent');
        await evaluate('{const input = document.querySelector("#spitzer-temperature");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"600");input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));}');
        await until(`document.querySelector('.spitzer-spectrum-results strong').textContent !== ${JSON.stringify(initial)}`);
        await evaluate('document.querySelectorAll(".spitzer-spectrum-controls .mission-destination-buttons button")[1].click()');
        await until('document.querySelectorAll(".spitzer-spectrum-channels .is-available").length === 2');
        await capture(`${mission}-${lang}-${width}-infrared`);
        await evaluate('document.querySelector(".spitzer-spectrum-controls").scrollIntoView({block:"start",behavior:"instant"})');
        await capture(`${mission}-${lang}-${width}-controls`);
        await evaluate('document.querySelector(".spitzer-spectrum-controls .btn").click()');
        await until('document.querySelectorAll(".spitzer-spectrum-channels .is-available").length === 7');
      }
      if (mission === 'gaia') {
        await evaluate('document.querySelector("#parallax").scrollIntoView({block:"start",behavior:"instant"})');
        await evaluate('{const input = document.querySelector("#gaia-distance");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"1000");input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));}');
        await until('document.querySelector(".mission-parallax-results strong").textContent.startsWith("1 ")');
        await evaluate('document.querySelectorAll(".mission-parallax-controls .mission-destination-buttons button")[1].click()');
        assert(await evaluate('document.querySelectorAll(".mission-parallax-controls .mission-destination-buttons button")[1].getAttribute("aria-pressed") === "true"'));
        await capture(`${mission}-${lang}-${width}-parallax`);
      }
      await evaluate('document.querySelector("#quiz").scrollIntoView({block:"start",behavior:"instant"});document.querySelector(".mission-quiz-options button").click()');
      assert(await evaluate('!!document.querySelector(".mission-quiz-answer")'));
      await evaluate('document.querySelector(".mission-quiz-answer button").click()');
      assert(await evaluate('!document.querySelector(".mission-quiz-answer")'));
      await evaluate('document.querySelector("#gallery").scrollIntoView({block:"start",behavior:"instant"})');
      await until('Array.from(document.querySelectorAll(".mission-gallery-card img")).every(i => i.complete && i.naturalWidth > 0)');
      await evaluate('document.querySelector(".mission-photo-button").click()');
      await until('!!document.querySelector(".mission-lightbox[open]")');
      await evaluate('document.querySelector(".mission-lightbox-nav button:last-child").click()');
      assert.equal(await evaluate('document.querySelector(".mission-lightbox-nav span").textContent'), '2 / 3');
      await evaluate('document.querySelector(".mission-lightbox-close").click()');
      await evaluate('document.querySelector(".tele3d-hero-cta").click()');
      await until('!!document.querySelector("dialog[open] canvas") && !document.querySelector(".tele3d-loading")');
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await until('!document.querySelector("dialog[open]")');
      assert.notEqual(await evaluate('document.body.style.overflow'), 'hidden');
      assert(await evaluate('Array.from(document.querySelectorAll(".mission-gallery-card img")).every(i => i.complete && i.naturalWidth > 0)'));
      results.push({ mission, lang, width }); console.log('PASS', mission, lang, width);
    }
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(requests.filter(url => /\/api\/missions\/(cassini|perseverance|osirisrex|gaia|kepler|spitzer)|\/api\/dsn/.test(url)).length, 0, 'No unsupported mission data requests');
  console.log(JSON.stringify({ passed: results.length, runtimeErrors: errors.length }));
  await cdp('Browser.close'); ws.close(); server.close();
}
main().catch(error => { console.error(error); ws?.close(); browser?.kill(); server.close(); process.exitCode = 1; });
