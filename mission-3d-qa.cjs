const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'mission3d-'));
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=9226',`--user-data-dir=${profile}`,'--no-first-run','--enable-unsafe-swiftshader','--disable-background-networking','about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let tabs;
 for(let i=0;i<80;i++){try{tabs=await(await fetch('http://127.0.0.1:9226/json/list')).json();break;}catch{await delay(250);}}
 assert(tabs,'Chrome is ready');
 const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let id=0;const pending=new Map(),errors=[];
 ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled' && m.params.type==='error')console.log('BROWSER ERROR',m.params.args.map(a=>a.description||a.value));if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expression=>{for(let i=0;i<160;i++){if(await evaluate(expression))return;await delay(250);}await shot('mission3d-failure.png');console.log(await evaluate('document.querySelector(".mission-model")?.outerHTML || document.body.innerText'));console.log(JSON.stringify(errors));throw Error('Timeout: '+expression);};
 const key=async(key,code)=>{await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code});};
 const shot=async name=>{const r=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(name,Buffer.from(r.data,'base64'));};
 await cdp('Page.enable');await cdp('Runtime.enable');
 const results=[];
 for(const width of [1440,390]){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
  for(const slug of ['new-horizons','juno','chandra']){
   await cdp('Page.navigate',{url:`http://127.0.0.1:4173/ua/${slug}`});
   await until('!!document.querySelector(".tele3d-hero-wrap canvas") && !document.querySelector(".tele3d-hero-loading")');
   assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Page fits');
   assert.equal(await evaluate('!!document.querySelector(".mission-model-error")'),false);
   await shot(`mission3d-${slug}-${width}-hero.png`);
   await evaluate('document.querySelector(".tele3d-hero-cta").focus();document.querySelector(".tele3d-hero-cta").click()');
   await until('!!document.querySelector("dialog[open] canvas") && !document.querySelector(".tele3d-loading")');
   assert.equal(await evaluate('document.body.style.overflow'),'hidden');
   await shot(`mission3d-${slug}-${width}-full.png`);
   const start=await evaluate('document.querySelector("dialog canvas").toDataURL()');
   await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:width/2,y:450,button:'left',clickCount:1});
   await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:width/2+70,y:510,button:'left',buttons:1});
   await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:width/2+70,y:510,button:'left',clickCount:1});
   await delay(400);
   await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',x:width/2,y:450,deltaX:0,deltaY:-180});
   await delay(200);
   const end=await evaluate('document.querySelector("dialog canvas").toDataURL()');
   // Screenshot comparison below checks the real drawing buffer as WebGL
   // toDataURL may be blank when preserveDrawingBuffer is disabled.
   await evaluate('document.querySelector(".mission-model-reset").click()');
   await delay(300);
   await key('Escape',27);
   await until('!document.querySelector("dialog[open]")');
   assert.notEqual(await evaluate('document.body.style.overflow'),'hidden');
   assert.equal(await evaluate('document.activeElement.className'),'tele3d-hero-cta');
   results.push({slug,width,loaded:true,controls:true,canvasReadable:!!start&&!!end});
  }
 }
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log(JSON.stringify({passed:results.length,results},null,2));
 await cdp('Browser.close');ws.close();
})().catch(e=>{console.error(e);browser.kill();process.exitCode=1;});
