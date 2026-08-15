import test from 'node:test';
import assert from 'node:assert/strict';

import { frameSecondsFromDelta } from '../src/core/frameTiming.js';

test('frame seconds reflect actual frame delta instead of assuming 60 FPS', () => {
  assert.equal(frameSecondsFromDelta(1000 / 30), 1 / 30);
});

test('frame seconds are capped to avoid huge catch-up jumps after a stalled frame', () => {
  assert.equal(frameSecondsFromDelta(200), 0.05);
});

test('frame seconds ignore invalid or negative deltas', () => {
  assert.equal(frameSecondsFromDelta(-16), 0);
  assert.equal(frameSecondsFromDelta(Number.NaN), 0);
});
