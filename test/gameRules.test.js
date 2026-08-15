import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CELL_SIZE,
  GRID_COLS,
  GRID_ROWS,
  INITIAL_SPEED,
  ITEM_TYPES,
  MAX_BUBBLES,
  MAX_POWER,
  MAX_SPEED,
  TRAP_MS,
  createInitialState,
  createPlayer,
  canPlayerOccupyPosition,
  explodeBubble,
  placeBubble,
  resolvePlayerMove,
  tickTraps,
  tryCollectItem,
  useHeldItem,
  updatePlayerPositionState,
} from '../src/core/gameRules.js';

test('map generation creates fixed walls, destructible blocks, and safe spawn zones', () => {
  const state = createInitialState({ mode: 'duel', seed: 4 });

  assert.equal(GRID_COLS, 15);
  assert.equal(GRID_ROWS, 13);
  assert.equal(CELL_SIZE, 48);
  assert.equal(state.grid[0][0].terrain, 'hard');
  assert.equal(state.grid[1][1].terrain, 'empty');
  assert.equal(state.grid[1][2].terrain, 'empty');
  assert.equal(state.grid[2][1].terrain, 'empty');
  assert.equal(state.grid[11][13].terrain, 'empty');
  assert.ok(
    state.grid.flat().some((cell) => cell.terrain === 'soft'),
    'generated map should include destructible soft blocks',
  );
});

test('players start with responsive movement speed for the 48px grid', () => {
  const state = createInitialState({ mode: 'duel', seed: 1, softFill: false });

  assert.equal(INITIAL_SPEED, 150);
  assert.equal(state.players[0].speed, INITIAL_SPEED);
  assert.equal(state.players[1].speed, INITIAL_SPEED);
});

test('placing bubbles respects the player bubble limit and stores power on the grid cell', () => {
  const state = createInitialState({ mode: 'duel', seed: 1 });
  const player = state.players[0];

  const first = placeBubble(state, player.id);
  const second = placeBubble(state, player.id);

  assert.equal(first.placed, true);
  assert.equal(second.placed, false);
  assert.equal(state.bubbles.length, 1);
  assert.equal(state.bubbles[0].power, 2);
  assert.equal(state.grid[player.row][player.col].bubbleId, state.bubbles[0].id);
});

test('player can walk out of a newly placed bubble but cannot re-enter after leaving it', () => {
  const state = createInitialState({ mode: 'duel', seed: 1, softFill: false });
  const player = state.players[0];

  const placed = placeBubble(state, player.id);

  assert.equal(placed.placed, true);
  assert.equal(player.passThroughBubbleId, placed.bubble.id);
  assert.equal(canPlayerOccupyPosition(state, player, 97, 72, 16), true);

  player.x = 113;
  player.y = 72;
  updatePlayerPositionState(state, player, 16);

  assert.equal(player.passThroughBubbleId, null);
  assert.equal(canPlayerOccupyPosition(state, player, 95, 72, 16), false);
});

test('movement assist nudges a player into a corridor when turning near a wall corner', () => {
  const state = createInitialState({ mode: 'duel', seed: 1, softFill: false });
  const player = state.players[0];
  const radius = 16;
  player.x = 1 * CELL_SIZE + CELL_SIZE / 2 + 13;
  player.y = 1 * CELL_SIZE + CELL_SIZE / 2;

  const move = resolvePlayerMove(state, player, 0, CELL_SIZE / 2, radius);

  assert.equal(move.moved, true);
  assert.ok(move.y > player.y, 'player should keep moving through the turn');
  assert.ok(move.x < player.x, 'player should be nudged back toward the corridor center');
});

test('movement assist does not let a player pass through blocking walls', () => {
  const state = createInitialState({ mode: 'duel', seed: 1, softFill: false });
  const player = state.players[0];
  const radius = 16;
  player.x = 1 * CELL_SIZE + CELL_SIZE / 2;
  player.y = 1 * CELL_SIZE + CELL_SIZE / 2;

  const move = resolvePlayerMove(state, player, -CELL_SIZE, 0, radius);

  assert.equal(move.moved, false);
  assert.equal(move.x, player.x);
  assert.equal(move.y, player.y);
});

test('explosion spreads in a cross, destroys soft blocks, stops at blockers, and can chain bubbles', () => {
  const state = createInitialState({ mode: 'duel', seed: 1, softFill: false });
  const player = state.players[0];
  player.col = 3;
  player.row = 3;
  player.power = 3;
  player.maxBubbles = 3;
  state.grid[3][5].terrain = 'soft';

  const first = placeBubble(state, player.id);
  player.col = 3;
  player.row = 4;
  const chained = placeBubble(state, player.id);

  const result = explodeBubble(state, first.bubble.id);

  assert.equal(result.explodedBubbleIds.includes(chained.bubble.id), true);
  assert.equal(state.grid[3][5].terrain, 'empty');
  assert.equal(result.destroyedSoftBlocks, 1);
  assert.deepEqual(
    result.cells.map((cell) => `${cell.col},${cell.row}`).sort(),
    ['1,3', '2,3', '3,1', '3,2', '3,3', '3,4', '3,5', '3,6', '3,7', '4,3', '5,3'].sort(),
  );
});

test('items apply capped player upgrades and are removed after collection', () => {
  const state = createInitialState({ mode: 'duel', seed: 2 });
  const player = createPlayer({ id: 'test', col: 1, row: 1 });
  state.players = [player];
  state.items.set('1,1', ITEM_TYPES.POWER);

  assert.equal(tryCollectItem(state, player).collected, ITEM_TYPES.POWER);
  assert.equal(player.power, 3);
  assert.equal(state.items.size, 0);

  for (let i = 0; i < 10; i += 1) {
    state.items.set('1,1', ITEM_TYPES.SPEED);
    tryCollectItem(state, player);
    state.items.set('1,1', ITEM_TYPES.BUBBLE);
    tryCollectItem(state, player);
    state.items.set('1,1', ITEM_TYPES.POWER);
    tryCollectItem(state, player);
  }

  assert.equal(player.speed, MAX_SPEED);
  assert.equal(player.maxBubbles, MAX_BUBBLES);
  assert.equal(player.power, MAX_POWER);
});

test('tactical items enter inventory slots in pickup order and shift forward after use', () => {
  const state = createInitialState({ mode: 'duel', seed: 2, softFill: false });
  const player = state.players[0];
  state.items.set('1,1', ITEM_TYPES.BANANA);
  assert.equal(tryCollectItem(state, player).collected, ITEM_TYPES.BANANA);

  state.items.set('1,1', ITEM_TYPES.SHIELD);
  assert.equal(tryCollectItem(state, player).collected, ITEM_TYPES.SHIELD);

  assert.deepEqual(player.inventory, [ITEM_TYPES.BANANA, ITEM_TYPES.SHIELD]);

  const used = useHeldItem(state, player.id, 100, { col: 1, row: 0 }, 0);

  assert.equal(used.used, true);
  assert.equal(used.action, 'banana');
  assert.deepEqual(player.inventory, [ITEM_TYPES.SHIELD]);
});

test('tactical inventory is capped at four items and darts instantly pop the first bubble in line', () => {
  const state = createInitialState({ mode: 'duel', seed: 2, softFill: false });
  const player = state.players[0];
  player.maxBubbles = 2;

  for (const type of [ITEM_TYPES.DART, ITEM_TYPES.BANANA, ITEM_TYPES.NEEDLE, ITEM_TYPES.SHIELD]) {
    state.items.set('1,1', type);
    assert.equal(tryCollectItem(state, player).collected, type);
  }
  state.items.set('1,1', ITEM_TYPES.DART);
  assert.equal(tryCollectItem(state, player).collected, null);
  assert.deepEqual(player.inventory, [ITEM_TYPES.DART, ITEM_TYPES.BANANA, ITEM_TYPES.NEEDLE, ITEM_TYPES.SHIELD]);

  player.col = 5;
  player.row = 1;
  const placed = placeBubble(state, player.id, 100);
  player.col = 3;
  player.row = 1;

  const used = useHeldItem(state, player.id, 200, { col: 1, row: 0 }, 0);

  assert.equal(used.used, true);
  assert.equal(used.action, 'dart');
  assert.equal(used.targetBubbleId, placed.bubble.id);
  assert.equal(state.bubbles.length, 0);
  assert.deepEqual(player.inventory, [ITEM_TYPES.BANANA, ITEM_TYPES.NEEDLE, ITEM_TYPES.SHIELD]);
});

test('banana item slides the user to the farthest walkable cell in the chosen direction', () => {
  const state = createInitialState({ mode: 'duel', seed: 2, softFill: false });
  const player = state.players[0];
  player.inventory = [ITEM_TYPES.BANANA];
  state.grid[1][5].terrain = 'soft';

  const used = useHeldItem(state, player.id, 100, { col: 1, row: 0 }, 0);

  assert.equal(used.used, true);
  assert.equal(used.action, 'banana');
  assert.equal(player.col, 4);
  assert.equal(player.row, 1);
  assert.equal(player.x, 4 * CELL_SIZE + CELL_SIZE / 2);
  assert.deepEqual(player.inventory, []);
});

test('needle frees a trapped player and shield blocks one explosion trap window', () => {
  const state = createInitialState({ mode: 'duel', seed: 3, softFill: false });
  const player = state.players[0];
  player.status = 'trapped';
  player.trappedUntil = 100 + TRAP_MS;
  player.inventory = [ITEM_TYPES.NEEDLE];

  const freed = useHeldItem(state, player.id, 100, { col: 1, row: 0 }, 0);

  assert.equal(freed.used, true);
  assert.equal(player.status, 'alive');
  assert.deepEqual(player.inventory, []);

  player.inventory = [ITEM_TYPES.SHIELD];
  const shielded = useHeldItem(state, player.id, 200, { col: 1, row: 0 }, 0);
  assert.equal(shielded.action, 'shield');

  player.col = 3;
  player.row = 3;
  player.x = 3 * CELL_SIZE + CELL_SIZE / 2;
  player.y = 3 * CELL_SIZE + CELL_SIZE / 2;
  player.maxBubbles = 2;
  const placed = placeBubble(state, player.id, 250);
  explodeBubble(state, placed.bubble.id, 300);

  assert.equal(player.status, 'alive');
});

test('items dropped from destroyed soft blocks remain after the explosion clears', () => {
  const state = createInitialState({ mode: 'duel', seed: 1, softFill: false });
  const player = state.players[0];
  player.col = 3;
  player.row = 3;
  state.grid[3][4].terrain = 'soft';
  state.random = createDropSequence();

  const placed = placeBubble(state, player.id);
  explodeBubble(state, placed.bubble.id);

  assert.equal(state.items.size, 1);
  assert.equal(state.items.get('4,3'), ITEM_TYPES.POWER);
});

test('trapped players cannot act and are eliminated after five seconds', () => {
  const state = createInitialState({ mode: 'duel', seed: 3 });
  const player = state.players[0];
  player.status = 'trapped';
  player.trappedUntil = 5000;

  const denied = placeBubble(state, player.id, 1000);
  tickTraps(state, 4999);

  assert.equal(denied.placed, false);
  assert.equal(player.status, 'trapped');

  tickTraps(state, 5000);

  assert.equal(player.status, 'out');
});

function createDropSequence() {
  const values = [0.1, 0.1];
  return () => values.shift() ?? 0.1;
}
