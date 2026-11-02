import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../public/central-loader.js', import.meta.url), 'utf8');
function setup(reduced = false, options = {}) {
  let now = 0, sequence = 0;
  const timers = new Map();
  const node = () => ({attributes: {}, hidden: true, inert: true, textContent: '',
    style: {setProperty() {}}, classList: {values: new Set(), add(...v) {v.forEach(x => this.values.add(x));},
      remove(...v) {v.forEach(x => this.values.delete(x));}, toggle(v, on) {on ? this.values.add(v) : this.values.delete(v);},
      contains(v) {return this.values.has(v);}},
    setAttribute(k,v) {this.attributes[k]=v;}, getAttribute(k) {return this.attributes[k];},
    addEventListener(k,fn) {this[k]=fn;}, removeEventListener(k,fn) {if(this[k]===fn) delete this[k];}});
  const elements = Object.fromEntries(['central-loader','central-site','central-loader-title','central-loader-detail',
    'central-loader-percent','central-loader-retry','catm-lab-popcorn','central-loader-sound'].map(id => [id,node()]));
  const dots = Array.from({length:6}, node), orbit = node(), root = node();
  const loader = elements['central-loader']; loader.hidden = false;
  loader.querySelector = () => orbit; loader.querySelectorAll = () => dots;
  const schedule = (fn, delay, interval=0) => {const id=++sequence;timers.set(id,{fn,time:now+delay,interval});return id;};
  const win = {setTimeout: (fn,ms) => schedule(fn,ms), clearTimeout: id => timers.delete(id),
    setInterval: (fn,ms) => schedule(fn,ms,ms), clearInterval:id=>timers.delete(id),
    requestAnimationFrame: fn=>schedule(fn,16), cancelAnimationFrame:id=>timers.delete(id),
    matchMedia:()=>({matches:reduced}), location:{reload(){win.reloaded=true;}},
    addEventListener(k, fn) {this[k]=fn;}, removeEventListener(k,fn) {if(this[k]===fn) delete this[k];},
    CentralSeasonalExperience:{isActive:()=>Boolean(options.seasonal)},
    CatmPopcornLab:options.artwork, CatmPopcornAudio:options.audio};
  vm.runInNewContext(source,{window:win,document:{getElementById:id=>elements[id],documentElement:root},Date:{now:()=>now}});
  function advance(ms) {
    const until=now+ms;
    while (true) {
      const next=[...timers].filter(([,v])=>v.time<=until).sort((a,b)=>a[1].time-b[1].time)[0];
      if (!next) break;
      const [id,timer]=next; now=timer.time; timers.delete(id);
      if(timer.interval) timers.set(id,{...timer,time:now+timer.interval});
      timer.fn();
    }
    now=until;
  }
  return {win,loader,elements,root,dots,timers,advance};
}
test('slow data stays covered, caps progress, and preserves the legacy complete/collapse/reveal sequence',()=>{
  const s=setup();s.advance(20_000);
  assert.equal(s.elements['central-loader-percent'].textContent,'84%');
  assert.equal(s.elements['central-site'].inert,true);
  assert.equal(s.loader.classList.contains('is-collapsing'),false);
  s.win.CentralLoader.finish();s.advance(300);
  assert.equal(s.elements['central-loader-percent'].textContent,'100%');
  assert.equal(s.dots.filter(d=>d.classList.contains('is-visible')).length,6);
  assert.equal(s.loader.classList.contains('is-collapsing'),true);
  s.advance(680);assert.equal(s.loader.classList.contains('is-revealing'),true);
  assert.equal(s.elements['central-site'].inert,true);
  s.advance(1525);assert.equal(s.loader.classList.contains('is-hidden'),true);
  assert.equal(s.elements['central-site'].inert,false);
  assert.equal(s.loader.attributes['aria-hidden'],'true');
  assert.equal(s.root.classList.contains('central-is-loading'),false);
  assert.equal(s.timers.size,0);
});
test('fast loads keep the minimum display time and completion is idempotent',()=>{
  const s=setup();s.win.CentralLoader.finish();s.advance(900);
  assert.equal(s.loader.classList.contains('is-collapsing'),false);
  s.win.CentralLoader.finish();s.advance(4000);
  assert.equal(s.loader.classList.contains('is-hidden'),true);assert.equal(s.timers.size,0);
});
test('failed data reveals the rendered retry UI, including reduced-motion timing',()=>{
  const s=setup(true);s.win.CentralLoader.finish(false);s.advance(1300);
  assert.equal(s.loader.classList.contains('is-hidden'),true);
  assert.equal(s.elements['central-site'].inert,false);
  assert.match(s.elements['central-loader-title'].textContent,/could not load/);
});
test('failed navigation module offers reload, and a late successful load can recover',()=>{
  const s=setup();s.advance(36_000);
  assert.equal(s.elements['central-loader-retry'].hidden,false);
  assert.equal(s.loader.attributes['aria-busy'],'false');assert.equal(s.timers.size,0);
  s.elements['central-loader-retry'].click();assert.equal(s.win.reloaded,true);
  s.win.CentralLoader.finish();s.advance(4000);
  assert.equal(s.loader.classList.contains('is-hidden'),true);
  assert.equal(s.elements['central-loader-retry'].hidden,true);
});
test('production keeps the independent loader with scoped seasonal assets',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(html,/id="central-loader"/);assert.match(html,/id="central-site" inert/);
  assert.match(html,/src="\/central-loader.js\?v=\d+"/);assert.match(html,/\/central-loader.css\?v=\d+/);
  assert.doesNotMatch(html,/\/christmas-movies.css|\/catm-popcorn-lab.css|loader-lab-page/);
  const nav=readFileSync(new URL('../public/navlab.js',import.meta.url),'utf8');
  assert.match(nav,/if \(production\) window.CentralLoader\?\.finish\(Boolean\(data\)\)/);
  assert.match(nav,/if \(production\) window.CentralLoader\?\.fail\(\)/);
});

async function flush() { for (let index=0;index<8;index++) await Promise.resolve(); }
function deferred() {
  let resolve;
  const promise = new Promise(done => {resolve=done;});
  return {promise,resolve};
}
function artworkFixture(idle = Promise.resolve()) {
  const controller = {values:[],destroyed:0,idleCalls:0,
    setProgress(value) {this.values.push(value);},
    whenIdle() {this.idleCalls++;return idle;},destroy() {this.destroyed++;}};
  return {controller,api:{create:()=>Promise.resolve(controller)}};
}
test('seasonal progress waits at 84 and final kernels/ticket settle before the upward reveal', async()=>{
  const idle=deferred(), art=artworkFixture(idle.promise);
  const s=setup(false,{seasonal:true,artwork:art.api});
  await flush();s.advance(20_000);
  assert.equal(art.controller.values.at(-1),84);
  s.win.CentralLoader.finish();s.advance(300);await flush();
  assert.equal(art.controller.values.at(-1),100);
  assert.equal(art.controller.idleCalls,1);
  assert.equal(s.loader.classList.contains('is-collapsing'),false);
  assert.equal(s.elements['central-site'].inert,true);
  idle.resolve();await flush();s.advance(32);
  assert.equal(s.loader.classList.contains('is-collapsing'),true);
  assert.equal(art.controller.destroyed,1);
  s.advance(680);assert.equal(s.loader.classList.contains('is-revealing'),true);
  s.advance(1525);assert.equal(s.elements['central-site'].inert,false);
  assert.equal(s.timers.size,0);
});
test('a stalled animation has a bounded fallback and is disposed before revealing', async()=>{
  const art=artworkFixture(new Promise(()=>{}));
  const s=setup(false,{seasonal:true,artwork:art.api});await flush();
  s.win.CentralLoader.finish();s.advance(980);await flush();
  s.advance(2399);assert.equal(s.loader.classList.contains('is-collapsing'),false);
  s.advance(34);assert.equal(s.loader.classList.contains('is-collapsing'),true);
  s.advance(2300);assert.equal(s.loader.classList.contains('is-hidden'),true);
  assert.equal(art.controller.destroyed,1);assert.equal(s.timers.size,0);
});
test('artwork rejection leaves the static fallback and never blocks loading', async()=>{
  const s=setup(false,{seasonal:true,artwork:{create:()=>Promise.reject(new Error('offline'))}});
  await flush();s.win.CentralLoader.finish();s.advance(980);await flush();s.advance(2300);
  assert.equal(s.loader.classList.contains('is-hidden'),true);
  assert.equal(s.timers.size,0);
});
test('late artwork after the bounded reveal is disposed and cannot restart animation', async()=>{
  const loading=deferred(), art=artworkFixture();
  const s=setup(false,{seasonal:true,artwork:{create:()=>loading.promise}});await flush();
  s.win.CentralLoader.finish();s.advance(6000);
  assert.equal(s.loader.classList.contains('is-hidden'),true);
  loading.resolve(art.controller);await flush();
  assert.equal(art.controller.destroyed,1);
  assert.deepEqual(art.controller.values,[]);assert.equal(s.timers.size,0);
});
test('seasonal reduced-motion fallback stays brief even if the artwork never loads', async()=>{
  const s=setup(true,{seasonal:true,artwork:{create:()=>new Promise(()=>{})}});await flush();
  s.win.CentralLoader.finish();s.advance(1450);
  assert.equal(s.loader.classList.contains('is-hidden'),true);
  assert.equal(s.timers.size,0);
});
test('seasonal watchdog cleans up animation and still allows a late data recovery', async()=>{
  const art=artworkFixture();const s=setup(false,{seasonal:true,artwork:art.api});await flush();
  s.advance(36_000);
  assert.equal(art.controller.destroyed,1);
  assert.equal(s.elements['central-loader-retry'].hidden,false);
  s.win.CentralLoader.finish();s.advance(4000);
  assert.equal(s.loader.classList.contains('is-hidden'),true);assert.equal(s.timers.size,0);
});
test('popcorn audio starts only from its explicit button and is destroyed on reveal', async()=>{
  let starts=0,stops=0,destroys=0;
  const s=setup(false,{seasonal:true,artwork:artworkFixture().api,audio:{create({onState}) {
    onState('off');
    return {start() {starts++;onState('playing');return Promise.resolve(true);},
      stop() {stops++;onState('off');},setProgress() {},destroy() {destroys++;onState('off');}};
  }}});
  const button=s.elements['central-loader-sound'];
  s.advance(5000);assert.equal(starts,0);assert.equal(button.hidden,false);
  button.click();assert.equal(starts,1);assert.equal(button.attributes['aria-pressed'],'true');
  button.click();assert.equal(stops,1);
  s.win.CentralLoader.finish();s.advance(300);await flush();s.advance(2300);
  assert.equal(destroys,1);assert.equal(button.hidden,true);assert.equal(button.click,undefined);
});
test('normal mode never initializes seasonal artwork or sound',async()=>{
  let calls=0;
  const s=setup(false,{artwork:{create() {calls++;}},audio:{create() {calls++;}}});
  await flush();s.advance(5000);
  assert.equal(calls,0);assert.equal(s.elements['central-loader-sound'].hidden,true);
});
test('leaving the page while waiting for final artwork cancels timers and disposes motion',async()=>{
  const art=artworkFixture(new Promise(()=>{}));
  const s=setup(false,{seasonal:true,artwork:art.api});await flush();
  s.win.CentralLoader.finish();s.advance(980);await flush();s.win.pagehide();
  assert.equal(s.timers.size,0);assert.equal(art.controller.destroyed,1);
  s.advance(10_000);assert.equal(s.loader.classList.contains('is-collapsing'),false);
});
test('async decorative scripts may arrive late and initialize once without delaying the watchdog',async()=>{
  let creations=0, audioCreations=0, starts=0;
  const art=artworkFixture();
  const s=setup(false,{seasonal:true});s.advance(20_000);
  assert.equal(s.elements['central-loader-percent'].textContent,'84%');
  s.win.CatmPopcornLab={create() {creations++;return art.api.create();}};
  s.win.CatmPopcornAudio={create() {audioCreations++;return {start() {starts++;},stop() {},setProgress() {},destroy() {}};}};
  s.win['central:loaderasset']();s.win['central:loaderasset']();await flush();
  assert.equal(creations,1);assert.equal(audioCreations,1);assert.equal(starts,0);
  assert.equal(art.controller.values.at(-1),84);
  s.win.CentralLoader.finish();s.advance(300);await flush();s.advance(2300);
  assert.equal(s.loader.classList.contains('is-hidden'),true);
  assert.equal(s.win['central:loaderasset'],undefined);
});
test('missing async decoration still allows the navigation watchdog and reload recovery',()=>{
  const s=setup(false,{seasonal:true});s.advance(36_000);
  assert.equal(s.elements['central-loader-retry'].hidden,false);
  assert.equal(s.timers.size,0);
  s.elements['central-loader-retry'].click();assert.equal(s.win.reloaded,true);
});
test('an unfinished BFCache return offers reload and retains late data recovery',async()=>{
  const art=artworkFixture();
  const s=setup(false,{seasonal:true,artwork:art.api});await flush();s.advance(300);
  s.win.pagehide();assert.equal(s.timers.size,0);assert.equal(art.controller.destroyed,1);
  s.win.pageshow({persisted:true});
  assert.equal(s.elements['central-site'].inert,true);
  assert.equal(s.elements['central-loader-retry'].hidden,false);
  assert.match(s.elements['central-loader-title'].textContent,/could not finish/);
  s.elements['central-loader-retry'].click();assert.equal(s.win.reloaded,true);
  s.win.CentralLoader.finish();s.advance(5000);
  assert.equal(s.loader.classList.contains('is-hidden'),true);
  assert.equal(s.elements['central-site'].inert,false);
  assert.equal(s.timers.size,0);
});
test('a completed BFCache return immediately exposes content without replaying the reveal',async()=>{
  const art=artworkFixture(new Promise(()=>{}));
  const s=setup(false,{seasonal:true,artwork:art.api});await flush();
  s.win.CentralLoader.finish();s.advance(980);await flush();
  s.win.pagehide();assert.equal(s.timers.size,0);
  s.win.pageshow({persisted:true});
  assert.equal(s.elements['central-site'].inert,false);
  assert.equal(s.root.classList.contains('central-is-loading'),false);
  assert.equal(s.loader.classList.contains('is-hidden'),true);
  s.win.CentralLoader.finish();s.advance(5000);assert.equal(s.timers.size,0);
});
test('seasonal CSS is scoped to the loader and retains the upward curtain and logo layering',()=>{
  const css=readFileSync(new URL('../public/central-christmas-loader.css',import.meta.url),'utf8');
  assert.match(css,/#central-loader\.is-revealing \.catm-loader-stage\s*\{\s*transform: translate3d\(0, -106%, 0\)/);
  assert.match(css,/#central-loader \.catm-lab-logo-e\s*\{[^}]*z-index: 3/s);
  assert.doesNotMatch(css,/loader-lab-page|--cp-|\.catm-loader-popcorn-fill/);
});
