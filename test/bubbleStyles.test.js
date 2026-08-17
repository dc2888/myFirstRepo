import test from 'node:test';
import assert from 'node:assert/strict';

import { BUBBLE_STYLES } from '../src/core/bubbleStyles.js';

test('bubble style catalog includes twelve unique selectable styles', () => {
  assert.equal(BUBBLE_STYLES.length, 12);
  assert.equal(new Set(BUBBLE_STYLES.map((style) => style.id)).size, BUBBLE_STYLES.length);

  assert.deepEqual(
    BUBBLE_STYLES.slice(5).map((style) => style.id),
    ['pudding', 'lemon', 'matcha', 'rainbow', 'chocolate', 'ice', 'sakura'],
  );
});
