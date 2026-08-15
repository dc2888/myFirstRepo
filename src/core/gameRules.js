export const GRID_COLS = 15;
export const GRID_ROWS = 13;
export const CELL_SIZE = 48;
export const MATCH_DURATION_MS = 240000;
export const FUSE_MS = 2200;
export const TRAP_MS = 5000;
export const SHIELD_MS = 3500;
export const INVENTORY_SIZE = 4;
export const INITIAL_SPEED = 150;
export const INITIAL_POWER = 2;
export const INITIAL_BUBBLES = 1;
export const MAX_SPEED = 250;
export const MAX_POWER = 6;
export const MAX_BUBBLES = 5;
export const SPEED_STEP = 20;
export const ITEM_DROP_CHANCE = 0.35;
export const TURN_ASSIST_DISTANCE = 16;

export const ITEM_TYPES = Object.freeze({
  POWER: 'power',
  SPEED: 'speed',
  BUBBLE: 'bubble',
  DART: 'dart',
  BANANA: 'banana',
  NEEDLE: 'needle',
  SHIELD: 'shield',
});

export const UPGRADE_ITEMS = new Set([ITEM_TYPES.POWER, ITEM_TYPES.SPEED, ITEM_TYPES.BUBBLE]);

const DIRECTIONS = [
  { col: 1, row: 0 },
  { col: -1, row: 0 },
  { col: 0, row: 1 },
  { col: 0, row: -1 },
];

const SPAWN_ZONES = [
  [
    [1, 1],
    [2, 1],
    [1, 2],
  ],
  [
    [13, 11],
    [12, 11],
    [13, 10],
  ],
];

export function createSeededRandom(seed = Date.now()) {
  let value = Math.max(1, Math.floor(seed) % 2147483647);
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function cellKey(col, row) {
  return `${col},${row}`;
}

export function isInsideGrid(col, row) {
  return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
}

export function createPlayer({ id, name = id, col, row, tint = 0xffffff, ai = false }) {
  return {
    id,
    name,
    col,
    row,
    x: col * CELL_SIZE + CELL_SIZE / 2,
    y: row * CELL_SIZE + CELL_SIZE / 2,
    tint,
    ai,
    speed: INITIAL_SPEED,
    power: INITIAL_POWER,
    maxBubbles: INITIAL_BUBBLES,
    activeBubbles: 0,
    passThroughBubbleId: null,
    inventory: [],
    shieldUntil: 0,
    lastDirection: { col: 1, row: 0 },
    status: 'alive',
    trappedUntil: 0,
    score: 0,
    destroyedBlocks: 0,
    itemsCollected: 0,
    hits: 0,
  };
}

export function createInitialState({ mode = 'duel', seed = Date.now(), softFill = true } = {}) {
  const random = createSeededRandom(seed);
  const grid = [];
  const safeCells = new Set(SPAWN_ZONES.flat().map(([col, row]) => cellKey(col, row)));

  for (let row = 0; row < GRID_ROWS; row += 1) {
    const cells = [];
    for (let col = 0; col < GRID_COLS; col += 1) {
      let terrain = 'empty';
      if (isHardWall(col, row)) {
        terrain = 'hard';
      } else if (softFill && !safeCells.has(cellKey(col, row)) && random() < 0.58) {
        terrain = 'soft';
      }
      cells.push({ terrain, bubbleId: null });
    }
    grid.push(cells);
  }

  return {
    mode,
    random,
    grid,
    bubbles: [],
    explosions: [],
    items: new Map(),
    players: [
      createPlayer({ id: 'p1', name: '玩家1', col: 1, row: 1, tint: 0x41d1ff }),
      createPlayer({ id: 'p2', name: mode === 'single' ? 'AI' : '玩家2', col: 13, row: 11, tint: 0xff6b8a, ai: mode === 'single' }),
    ],
    startedAt: 0,
    ended: false,
    winnerId: null,
    resultReason: '',
    nextBubbleId: 1,
  };
}

export function isHardWall(col, row) {
  return col === 0 || row === 0 || col === GRID_COLS - 1 || row === GRID_ROWS - 1 || (col % 2 === 0 && row % 2 === 0);
}

export function getCell(state, col, row) {
  if (!isInsideGrid(col, row)) return null;
  return state.grid[row][col];
}

export function isWalkable(state, col, row, { ignoreBubbleId = null } = {}) {
  const cell = getCell(state, col, row);
  if (!cell || cell.terrain !== 'empty') return false;
  return !cell.bubbleId || cell.bubbleId === ignoreBubbleId;
}

export function playerAtCell(state, col, row, exceptId = null) {
  return state.players.find((player) => player.id !== exceptId && player.status !== 'out' && player.col === col && player.row === row);
}

export function placeBubble(state, playerId, now = 0) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player || player.status !== 'alive') {
    return { placed: false, reason: 'player-unavailable' };
  }

  const cell = getCell(state, player.col, player.row);
  if (!cell || cell.terrain !== 'empty' || cell.bubbleId || player.activeBubbles >= player.maxBubbles) {
    return { placed: false, reason: 'blocked' };
  }

  const bubble = {
    id: `b${state.nextBubbleId}`,
    ownerId: player.id,
    col: player.col,
    row: player.row,
    power: player.power,
    placedAt: now,
    explodeAt: now + FUSE_MS,
    exploding: false,
  };
  state.nextBubbleId += 1;
  state.bubbles.push(bubble);
  cell.bubbleId = bubble.id;
  player.activeBubbles += 1;
  player.passThroughBubbleId = bubble.id;
  return { placed: true, bubble };
}

export function canPlayerOccupyPosition(state, player, x, y, radius) {
  const minCol = Math.floor((x - radius) / CELL_SIZE);
  const maxCol = Math.floor((x + radius) / CELL_SIZE);
  const minRow = Math.floor((y - radius) / CELL_SIZE);
  const maxRow = Math.floor((y + radius) / CELL_SIZE);
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      if (!isWalkable(state, col, row, { ignoreBubbleId: player.passThroughBubbleId })) return false;
    }
  }
  return true;
}

export function resolvePlayerMove(state, player, dx, dy, radius, assistDistance = TURN_ASSIST_DISTANCE) {
  if (player.status !== 'alive') return { x: player.x, y: player.y, moved: false };

  let x = player.x;
  let y = player.y;
  let moved = false;

  if (dx !== 0) {
    const next = resolveAxisMove(state, player, x, y, dx, 0, radius, assistDistance);
    x = next.x;
    y = next.y;
    moved ||= next.moved;
  }

  if (dy !== 0) {
    const next = resolveAxisMove(state, player, x, y, 0, dy, radius, assistDistance);
    x = next.x;
    y = next.y;
    moved ||= next.moved;
  }

  return { x, y, moved };
}

export function updatePlayerPositionState(state, player, radius) {
  player.col = clamp(Math.floor(player.x / CELL_SIZE), 0, GRID_COLS - 1);
  player.row = clamp(Math.floor(player.y / CELL_SIZE), 0, GRID_ROWS - 1);

  if (!player.passThroughBubbleId) return;
  const bubble = state.bubbles.find((candidate) => candidate.id === player.passThroughBubbleId);
  if (!bubble || !footprintOverlapsCell(player.x, player.y, radius, bubble.col, bubble.row)) {
    player.passThroughBubbleId = null;
  }
}

export function explodeDueBubbles(state, now) {
  const due = state.bubbles.filter((bubble) => bubble.explodeAt <= now).map((bubble) => bubble.id);
  return due.flatMap((id) => explodeBubble(state, id, now));
}

export function explodeBubble(state, bubbleId, now = 0, chain = new Set()) {
  const bubble = state.bubbles.find((candidate) => candidate.id === bubbleId);
  if (!bubble || chain.has(bubbleId)) return [];
  chain.add(bubbleId);
  bubble.exploding = true;

  const owner = state.players.find((player) => player.id === bubble.ownerId);
  if (owner) owner.activeBubbles = Math.max(0, owner.activeBubbles - 1);

  const originCell = getCell(state, bubble.col, bubble.row);
  if (originCell?.bubbleId === bubble.id) originCell.bubbleId = null;

  const cells = [{ col: bubble.col, row: bubble.row }];
  let destroyedSoftBlocks = 0;
  const chainedIds = [];

  for (const direction of DIRECTIONS) {
    for (let step = 1; step <= bubble.power; step += 1) {
      const col = bubble.col + direction.col * step;
      const row = bubble.row + direction.row * step;
      const cell = getCell(state, col, row);
      if (!cell || cell.terrain === 'hard') break;

      cells.push({ col, row });
      state.items.delete(cellKey(col, row));

      if (cell.bubbleId && cell.bubbleId !== bubble.id) {
        chainedIds.push(cell.bubbleId);
      }

      if (cell.terrain === 'soft') {
        cell.terrain = 'empty';
        destroyedSoftBlocks += 1;
        maybeDropItem(state, col, row);
        break;
      }
    }
  }

  state.items.delete(cellKey(bubble.col, bubble.row));

  state.bubbles = state.bubbles.filter((candidate) => candidate.id !== bubble.id);
  applyExplosionToPlayers(state, bubble.ownerId, cells, now);

  const result = {
    bubbleId,
    explodedBubbleIds: [bubbleId],
    cells,
    destroyedSoftBlocks,
  };

  if (owner) {
    owner.destroyedBlocks += destroyedSoftBlocks;
    owner.score += destroyedSoftBlocks;
  }

  for (const chainedId of chainedIds) {
    const chainedResults = explodeBubble(state, chainedId, now, chain);
    for (const chainedResult of Array.isArray(chainedResults) ? chainedResults : [chainedResults]) {
      result.explodedBubbleIds.push(...chainedResult.explodedBubbleIds);
      result.destroyedSoftBlocks += chainedResult.destroyedSoftBlocks;
      result.cells.push(...chainedResult.cells);
    }
  }

  result.explodedBubbleIds = [...new Set(result.explodedBubbleIds)];
  result.cells = uniqueCells(result.cells);
  state.explosions.push({ cells: result.cells, createdAt: now, expiresAt: now + 360 });
  return result;
}

export function applyExplosionToPlayers(state, ownerId, cells, now) {
  const hitCells = new Set(cells.map((cell) => cellKey(cell.col, cell.row)));
  for (const player of state.players) {
    if (player.status !== 'alive') continue;
    if (!hitCells.has(cellKey(player.col, player.row))) continue;
    if (player.shieldUntil > now) continue;
    player.status = 'trapped';
    player.trappedUntil = now + TRAP_MS;
    const owner = state.players.find((candidate) => candidate.id === ownerId);
    if (owner && owner.id !== player.id) {
      owner.hits += 1;
      owner.score += 3;
    }
  }
}

export function tickTraps(state, now) {
  for (const player of state.players) {
    if (player.status === 'trapped' && now >= player.trappedUntil) {
      player.status = 'out';
    }
  }
}

export function tryCollectItem(state, player) {
  if (player.status !== 'alive') return { collected: null };
  const key = cellKey(player.col, player.row);
  const type = state.items.get(key);
  if (!type) return { collected: null };
  if (!UPGRADE_ITEMS.has(type) && player.inventory.length >= INVENTORY_SIZE) {
    return { collected: null, reason: 'inventory-full' };
  }
  state.items.delete(key);

  if (type === ITEM_TYPES.POWER) player.power = Math.min(MAX_POWER, player.power + 1);
  if (type === ITEM_TYPES.SPEED) player.speed = Math.min(MAX_SPEED, player.speed + SPEED_STEP);
  if (type === ITEM_TYPES.BUBBLE) player.maxBubbles = Math.min(MAX_BUBBLES, player.maxBubbles + 1);
  if (!UPGRADE_ITEMS.has(type)) player.inventory.push(type);

  player.itemsCollected += 1;
  player.score += 2;
  return { collected: type };
}

export function useHeldItem(state, playerId, now = 0, direction = { col: 1, row: 0 }, slotIndex = 0) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  const item = player?.inventory?.[slotIndex];
  if (!player || !item) return { used: false, reason: 'no-item' };
  const normalized = normalizeDirection(direction);

  if (item === ITEM_TYPES.NEEDLE) {
    if (player.status !== 'trapped') return { used: false, reason: 'not-trapped' };
    player.status = 'alive';
    player.trappedUntil = 0;
    consumeInventorySlot(player, slotIndex);
    return { used: true, action: 'needle' };
  }

  if (player.status !== 'alive') return { used: false, reason: 'player-unavailable' };

  if (item === ITEM_TYPES.SHIELD) {
    player.shieldUntil = now + SHIELD_MS;
    consumeInventorySlot(player, slotIndex);
    return { used: true, action: 'shield', shieldUntil: player.shieldUntil };
  }

  if (item === ITEM_TYPES.DART) {
    const target = findFirstBubbleInLine(state, player.col, player.row, normalized);
    consumeInventorySlot(player, slotIndex);
    if (!target) return { used: true, action: 'dart', targetBubbleId: null };
    explodeBubble(state, target.id, now);
    return { used: true, action: 'dart', targetBubbleId: target.id };
  }

  if (item === ITEM_TYPES.BANANA) {
    const target = farthestWalkableCell(state, player.col, player.row, normalized, player.passThroughBubbleId);
    player.col = target.col;
    player.row = target.row;
    player.x = target.col * CELL_SIZE + CELL_SIZE / 2;
    player.y = target.row * CELL_SIZE + CELL_SIZE / 2;
    player.passThroughBubbleId = null;
    consumeInventorySlot(player, slotIndex);
    tryCollectItem(state, player);
    return { used: true, action: 'banana', destination: target };
  }

  return { used: false, reason: 'unknown-item' };
}

export function handleTrapTouch(state) {
  for (const trapped of state.players.filter((player) => player.status === 'trapped')) {
    const toucher = playerAtCell(state, trapped.col, trapped.row, trapped.id);
    if (toucher?.status === 'alive') {
      trapped.status = 'out';
      toucher.score += 5;
    }
  }
}

export function pruneExplosions(state, now) {
  state.explosions = state.explosions.filter((explosion) => explosion.expiresAt > now);
}

export function chooseWinner(state, now = MATCH_DURATION_MS) {
  const alive = state.players.filter((player) => player.status !== 'out');
  if (alive.length === 1) {
    return { ended: true, winnerId: alive[0].id, reason: `${alive[0].name} 获胜` };
  }
  if (alive.length === 0) {
    return { ended: true, winnerId: null, reason: '双方同时出局' };
  }
  if (now < MATCH_DURATION_MS) {
    return { ended: false, winnerId: null, reason: '' };
  }
  const [p1, p2] = state.players;
  if (p1.score === p2.score) {
    return { ended: true, winnerId: null, reason: '时间到，平局' };
  }
  const winner = p1.score > p2.score ? p1 : p2;
  return { ended: true, winnerId: winner.id, reason: `时间到，${winner.name} 得分获胜` };
}

export function maybeDropItem(state, col, row) {
  if (state.random() > ITEM_DROP_CHANCE) return null;
  const types = [
    ITEM_TYPES.POWER,
    ITEM_TYPES.SPEED,
    ITEM_TYPES.BUBBLE,
    ITEM_TYPES.DART,
    ITEM_TYPES.BANANA,
    ITEM_TYPES.NEEDLE,
    ITEM_TYPES.SHIELD,
  ];
  const type = types[Math.floor(state.random() * types.length)];
  state.items.set(cellKey(col, row), type);
  return type;
}

export function dangerCells(state, now, warningMs = FUSE_MS) {
  const dangerous = new Set();
  for (const bubble of state.bubbles) {
    if (bubble.explodeAt - now > warningMs) continue;
    for (const cell of previewExplosionCells(state, bubble)) {
      dangerous.add(cellKey(cell.col, cell.row));
    }
  }
  for (const explosion of state.explosions) {
    for (const cell of explosion.cells) dangerous.add(cellKey(cell.col, cell.row));
  }
  return dangerous;
}

export function previewExplosionCells(state, bubble) {
  const cells = [{ col: bubble.col, row: bubble.row }];
  for (const direction of DIRECTIONS) {
    for (let step = 1; step <= bubble.power; step += 1) {
      const col = bubble.col + direction.col * step;
      const row = bubble.row + direction.row * step;
      const cell = getCell(state, col, row);
      if (!cell || cell.terrain === 'hard') break;
      cells.push({ col, row });
      if (cell.terrain === 'soft') break;
    }
  }
  return cells;
}

export function neighbors(state, col, row) {
  return DIRECTIONS.map((direction) => ({ col: col + direction.col, row: row + direction.row })).filter((cell) =>
    isWalkable(state, cell.col, cell.row),
  );
}

export function findPath(state, start, isGoal, blocked = new Set()) {
  const queue = [{ ...start, path: [] }];
  const visited = new Set([cellKey(start.col, start.row)]);
  while (queue.length) {
    const current = queue.shift();
    if (isGoal(current)) return current.path;
    for (const next of neighbors(state, current.col, current.row)) {
      const key = cellKey(next.col, next.row);
      if (visited.has(key) || blocked.has(key)) continue;
      visited.add(key);
      queue.push({ ...next, path: [...current.path, next] });
    }
  }
  return [];
}

function uniqueCells(cells) {
  const seen = new Set();
  return cells.filter((cell) => {
    const key = cellKey(cell.col, cell.row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveAxisMove(state, player, x, y, dx, dy, radius, assistDistance) {
  const targetX = x + dx;
  const targetY = y + dy;
  if (canPlayerOccupyPosition(state, player, targetX, targetY, radius)) {
    return { x: targetX, y: targetY, moved: true };
  }

  const assist = perpendicularCenteringOffset(x, y, dx, dy, assistDistance);
  if (!assist) return { x, y, moved: false };

  const assistedX = targetX + assist.x;
  const assistedY = targetY + assist.y;
  if (canPlayerOccupyPosition(state, player, assistedX, assistedY, radius)) {
    return { x: assistedX, y: assistedY, moved: true };
  }

  const centeredX = x + assist.x;
  const centeredY = y + assist.y;
  if (canPlayerOccupyPosition(state, player, centeredX, centeredY, radius)) {
    return { x: centeredX, y: centeredY, moved: true };
  }

  return { x, y, moved: false };
}

function perpendicularCenteringOffset(x, y, dx, dy, assistDistance) {
  if (dy !== 0) {
    const centerX = Math.floor(x / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
    const offsetX = centerX - x;
    if (Math.abs(offsetX) > 0 && Math.abs(offsetX) <= assistDistance) return { x: offsetX, y: 0 };
  }

  if (dx !== 0) {
    const centerY = Math.floor(y / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
    const offsetY = centerY - y;
    if (Math.abs(offsetY) > 0 && Math.abs(offsetY) <= assistDistance) return { x: 0, y: offsetY };
  }

  return null;
}

function footprintOverlapsCell(x, y, radius, col, row) {
  const left = x - radius;
  const right = x + radius;
  const top = y - radius;
  const bottom = y + radius;
  const cellLeft = col * CELL_SIZE;
  const cellRight = cellLeft + CELL_SIZE;
  const cellTop = row * CELL_SIZE;
  const cellBottom = cellTop + CELL_SIZE;
  return right > cellLeft && left < cellRight && bottom > cellTop && top < cellBottom;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function consumeInventorySlot(player, slotIndex) {
  player.inventory.splice(slotIndex, 1);
}

function normalizeDirection(direction) {
  if (Math.abs(direction.col) >= Math.abs(direction.row) && direction.col !== 0) {
    return { col: Math.sign(direction.col), row: 0 };
  }
  if (direction.row !== 0) {
    return { col: 0, row: Math.sign(direction.row) };
  }
  return { col: 1, row: 0 };
}

function findFirstBubbleInLine(state, col, row, direction) {
  for (let step = 1; step < Math.max(GRID_COLS, GRID_ROWS); step += 1) {
    const nextCol = col + direction.col * step;
    const nextRow = row + direction.row * step;
    const cell = getCell(state, nextCol, nextRow);
    if (!cell || cell.terrain !== 'empty') return null;
    if (cell.bubbleId) return state.bubbles.find((bubble) => bubble.id === cell.bubbleId) ?? null;
  }
  return null;
}

function farthestWalkableCell(state, col, row, direction, ignoreBubbleId = null) {
  let current = { col, row };
  for (let step = 1; step < Math.max(GRID_COLS, GRID_ROWS); step += 1) {
    const next = { col: col + direction.col * step, row: row + direction.row * step };
    if (!isWalkable(state, next.col, next.row, { ignoreBubbleId })) break;
    current = next;
  }
  return current;
}
