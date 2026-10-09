import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {Timeline, clusters, ticketPose} = require('../public/catm-popcorn-lab.js');

test('empty starts truly empty and stationary scrub produces deterministic fill', () => {
  const timeline = new Timeline();
  assert.deepEqual(timeline.frame(0).settled, []);
  for (const value of [25, 50, 75, 100, 0]) {
    timeline.seek(value);
    const state = timeline.frame(1000);
    assert.equal(state.settled.length, clusters.filter(p => p.threshold <= value).length);
    assert.equal(state.flights.length, 0);
    assert.equal(state.complete, value === 100);
  }
});

test('pops land at their own persistent reveal region and never remove earlier fill', () => {
  const timeline = new Timeline();
  timeline.advance(25, 0);
  const airborne = timeline.frame(300);
  assert.ok(airborne.flights.some(f => f.visible));
  assert.equal(airborne.settled.length, 0);
  const landed = timeline.frame(2000);
  assert.ok(landed.settled.length > 0);
  assert.equal(landed.flights.length, 0);
  timeline.advance(50, 2100);
  const next = timeline.frame(2300);
  for (const index of landed.settled) assert.ok(next.settled.includes(index));
  assert.ok(next.flights.every(f => !landed.settled.includes(f.index)));
});

test('fast jump completes only after every queued kernel has landed', () => {
  const timeline = new Timeline();
  timeline.advance(100, 100);
  assert.equal(timeline.frame(100).complete, false);
  const final = timeline.frame(3000);
  assert.equal(final.complete, true);
  assert.equal(final.settled.length, clusters.length);
  assert.equal(final.flights.length, 0);
});

test('a loading stall keeps its settled pile without repeated popping', () => {
  const timeline = new Timeline();
  timeline.advance(48, 0);
  const settled = timeline.frame(2000).settled;
  timeline.advance(48, 5000);
  assert.deepEqual(timeline.frame(6000).settled, settled);
  assert.equal(timeline.frame(6000).flights.length, 0);
});

test('reset during a flight cancels pending landings and supports replay', () => {
  const timeline = new Timeline();
  timeline.advance(75, 0);
  timeline.seek(0);
  assert.deepEqual(timeline.frame(5000).settled, []);
  assert.equal(timeline.frame(5000).flights.length, 0);
  timeline.advance(25, 6000);
  assert.ok(timeline.frame(6100).flights.length > 0);
});

test('backward scrubbing and reduced-motion settling clear in-flight kernels', () => {
  const timeline = new Timeline();
  timeline.advance(80, 0);
  timeline.advance(25, 10);
  assert.equal(timeline.frame(20).flights.length, 0);
  timeline.advance(100, 30);
  timeline.seek(timeline.progress);
  assert.equal(timeline.frame(40).complete, true);
});

test('ticket appears late and progress is bounded', () => {
  const timeline = new Timeline();
  timeline.seek(75);
  assert.equal(timeline.frame(0).ticket, 0);
  timeline.seek(94);
  assert.equal(timeline.frame(0).ticket, 2 / 3);
  timeline.seek(150);
  assert.equal(timeline.frame(0).ticket, 1);
  timeline.seek(NaN);
  assert.equal(timeline.progress, 0);
  timeline.seek(-5);
  assert.equal(timeline.progress, 0);
});

test('an incomplete SVG keeps the original fallback mounted', async () => {
  const {readFile} = await import('node:fs/promises');
  const {runInNewContext} = await import('node:vm');
  const source = await readFile(new URL('../public/catm-popcorn-lab.js', import.meta.url), 'utf8');
  const context = {
    module: {exports: {}},
    fetch: async () => ({ok: true, text: async () => '<svg/>'}),
    DOMParser: class { parseFromString() { return {querySelector: () => null, documentElement: {}}; } },
    document: {
      importNode: () => ({setAttribute() {}, querySelector: () => null, querySelectorAll: () => []}),
    },
  };
  runInNewContext(source, context);
  let replaced = false;
  await assert.rejects(context.module.exports.create({replaceChildren() { replaced = true; }}), /Incomplete popcorn layers/);
  assert.equal(replaced, false);
});

test('ticket grows from the logo, passes in front, and lands at original coordinates', () => {
  const origin = {x: 230, y: -170};
  const tucked = ticketPose(0, origin);
  const forward = ticketPose(0.28, origin);
  const falling = ticketPose(0.6, origin);
  const landed = ticketPose(1, origin);
  assert.equal(tucked.scale, 0.50);
  assert.equal(tucked.front, false);
  assert.ok(forward.scale > 1);
  assert.equal(forward.front, true);
  assert.ok(falling.y > forward.y);
  assert.equal(landed.front, false);
  assert.equal(landed.x, 289.15);
  assert.ok(Math.abs(landed.y - 63.03) < 0.000001);
  assert.ok(Math.abs(landed.angle) < 0.000001);
  assert.equal(landed.scale, 1);
});

test('a fast load waits for ticket travel and motion to settle', () => {
  const timeline = new Timeline(undefined, () => 0.5);
  timeline.advance(100, 0);
  assert.equal(timeline.frame(1000).complete, false);
  assert.ok(timeline.frame(1000).ticket > 0 && timeline.frame(1000).ticket < 1);
  const end = timeline.frame(2500);
  assert.equal(end.ticket, 1);
  assert.equal(end.busy, false);
  assert.equal(end.bucketAngle, 0);
  assert.equal(end.flyaways.length, 0);
  assert.equal(end.complete, true);
});

test('flyaways recede into the distance and reset cancels every motion channel', () => {
  const timeline = new Timeline(undefined, () => 0.5);
  timeline.advance(100, 0);
  const early = timeline.frame(100).flyaways;
  const later = timeline.frame(700).flyaways;
  assert.equal(early.length, 4);
  assert.ok(later[0].scale < early[0].scale);
  assert.ok(later[0].x < early[0].x);
  assert.ok(later[1].x > early[1].x);
  assert.ok(later[0].y < early[0].y);
  timeline.seek(0);
  const reset = timeline.frame(1000);
  assert.equal(reset.busy, false);
  assert.equal(reset.bucketAngle, 0);
  assert.equal(reset.ticket, 0);
  assert.equal(reset.flyaways.length, 0);
});

test('a stalled load stops swaying and never starts the late ticket early', () => {
  const timeline = new Timeline(undefined, () => 0.5);
  timeline.advance(48, 0);
  assert.notEqual(timeline.frame(100).bucketAngle, 0);
  const stalled = timeline.frame(2500);
  assert.equal(stalled.bucketAngle, 0);
  assert.equal(stalled.busy, false);
  assert.equal(stalled.ticket, 0);
  timeline.advance(48, 3000);
  assert.equal(timeline.frame(3100).busy, false);
});

test('animated continuation after a late scrub completes the remaining ticket travel', () => {
  const timeline = new Timeline(undefined, () => 0.5);
  timeline.seek(94);
  const pausedPhase = timeline.frame(0).ticket;
  timeline.advance(100, 100);
  assert.ok(Math.abs(timeline.frame(100).ticket - pausedPhase) < 0.000001);
  assert.equal(timeline.frame(100).complete, false);
  const landed = timeline.frame(2500);
  assert.equal(landed.ticket, 1);
  assert.equal(landed.complete, true);
});

test('bucket jolts are stronger and foliage swings back after a delay', () => {
  const timeline = new Timeline(undefined, () => 0.5);
  timeline.advance(4, 0);
  const early = timeline.frame(70);
  assert.ok(Math.abs(early.jitterX) > 0.5);
  assert.equal(early.foliageAngle, 0);
  const followThrough = timeline.frame(180);
  assert.ok(followThrough.bucketAngle > 1);
  assert.ok(followThrough.foliageAngle < -1);
  assert.ok(followThrough.bucketAngle + followThrough.foliageAngle < 0);
  const resting = timeline.frame(1400);
  assert.equal(resting.bucketAngle, 0);
  assert.equal(resting.foliageAngle, 0);
  assert.equal(resting.jitterX, 0);
  assert.equal(resting.jitterY, 0);
});

test('normal loading has separated shake bursts instead of one shake per kernel', () => {
  const timeline = new Timeline(undefined, () => 0.5);
  const starts = new Set();
  for (let progress = 1; progress <= 75; progress++) {
    timeline.advance(progress, progress * 60);
    timeline.pulses.forEach(pulse => starts.add(pulse.start));
    timeline.frame(progress * 60);
  }
  assert.ok(starts.size >= 3 && starts.size <= 6);
  const times = [...starts].sort((a,b) => a-b);
  for (let index = 1; index < times.length; index++) assert.ok(times[index] - times[index-1] >= 650);
});
