import test from 'node:test';
import assert from 'node:assert/strict';

import { createWalkPose } from '../src/core/walkPose.js';

test('walk pose alternates left and right feet horizontally', () => {
  const pose = createWalkPose({ dx: 3, dy: 0, walkTime: Math.PI / 2, moving: true });

  assert.ok(pose.leftFoot.x > 0, 'left foot should step forward on the movement axis');
  assert.ok(pose.rightFoot.x < 0, 'right foot should step backward on the movement axis');
  assert.equal(pose.leftFoot.y, 0);
  assert.equal(pose.rightFoot.y, 0);
  assert.ok(Math.abs(pose.bodyAngle) > 0);
});

test('walk pose alternates left and right feet vertically', () => {
  const pose = createWalkPose({ dx: 0, dy: -3, walkTime: Math.PI / 2, moving: true });

  assert.ok(pose.leftFoot.y < 0, 'left foot should step up when walking up');
  assert.ok(pose.rightFoot.y > 0, 'right foot should counter-step down');
  assert.equal(pose.leftFoot.x, 0);
  assert.equal(pose.rightFoot.x, 0);
});

test('idle pose keeps feet planted and body level', () => {
  const pose = createWalkPose({ dx: 0, dy: 0, walkTime: Math.PI / 2, moving: false });

  assert.deepEqual(pose.leftFoot, { x: 0, y: 0 });
  assert.deepEqual(pose.rightFoot, { x: 0, y: 0 });
  assert.equal(pose.bodyOffsetY, 0);
  assert.equal(pose.bodyAngle, 0);
});
