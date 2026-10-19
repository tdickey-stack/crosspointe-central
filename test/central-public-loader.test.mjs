import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../public/central-loader.js', import.meta.url), 'utf8');
function setup(reduced = false) {
  let now = 0, sequence = 0;
  const timers = new Map();
  const node = () => ({attributes: {}, hidden: true, inert: true, textContent: '',
    style: {setProperty() {}}, classList: {values: new Set(), add(...v) {v.forEach(x => this.values.add(x));},
      remove(...v) {v.forEach(x => this.values.delete(x));}, toggle(v, on) {on ? this.values.add(v) : this.values.delete(v);},
      contains(v) {return this.values.has(v);}},
    setAttribute(k,v) {this.attributes[k]=v;}, addEventListener(k,fn) {this[k]=fn;}});
  const elements = Object.fromEntries(['central-loader','central-site','central-loader-title','central-loader-detail',
    'central-loader-percent','central-loader-retry'].map(id => [id,node()]));
  const dots = Array.from({length:6}, node), orbit = node(), root = node();
  const loader = elements['central-loader']; loader.hidden = false;
  loader.querySelector = () => orbit; loader.querySelectorAll = () => dots;
  const schedule = (fn, delay, interval=0) => {const id=++sequence;timers.set(id,{fn,time:now+delay,interval});return id;};
  const win = {setTimeout: (fn,ms) => schedule(fn,ms), clearTimeout: id => timers.delete(id),
    setInterval: (fn,ms) => schedule(fn,ms,ms), clearInterval:id=>timers.delete(id),
    requestAnimationFrame: fn=>schedule(fn,16), cancelAnimationFrame:id=>timers.delete(id),
    matchMedia:()=>({matches:reduced}), location:{reload(){win.reloaded=true;}}};
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
test('production includes the standard loader independently of the lab and seasonal assets',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(html,/id="central-loader"/);assert.match(html,/id="central-site" inert/);
  assert.match(html,/src="\/central-loader.js\?v=1"/);assert.match(html,/\/central-loader.css\?v=1/);
  assert.doesNotMatch(html,/catm-loader|christmas-movies|seasonal-experience.js/);
  const nav=readFileSync(new URL('../public/navlab.js',import.meta.url),'utf8');
  assert.match(nav,/if \(production\) window.CentralLoader\?\.finish\(Boolean\(data\)\)/);
  assert.match(nav,/if \(production\) window.CentralLoader\?\.fail\(\)/);
});
