import {
  CELL_SIZE,
  FUSE_MS,
  GRID_COLS,
  GRID_ROWS,
  ITEM_TYPES,
  MATCH_DURATION_MS,
  cellKey,
  chooseWinner,
  createInitialState,
  dangerCells,
  explodeDueBubbles,
  findPath,
  getCell,
  handleTrapTouch,
  placeBubble,
  playerAtCell,
  pruneExplosions,
  resolvePlayerMove,
  tickTraps,
  tryCollectItem,
  useHeldItem,
  updatePlayerPositionState,
} from './core/gameRules.js';
import { createWalkPose } from './core/walkPose.js';

const BOARD_WIDTH = GRID_COLS * CELL_SIZE;
const BOARD_HEIGHT = GRID_ROWS * CELL_SIZE;
const HUD_HEIGHT = 82;
const GAME_WIDTH = BOARD_WIDTH;
const GAME_HEIGHT = BOARD_HEIGHT + HUD_HEIGHT;
const PLAYER_RADIUS = 16;

class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.image('player-blue', 'src/assets/player-blue.png');
    this.load.image('player-red', 'src/assets/player-red.png');
    this.load.image('bubble', 'src/assets/bubble-orb.png');
    this.load.image('item-power', 'src/assets/item-power.png');
    this.load.image('item-speed', 'src/assets/item-speed.png');
    this.load.image('item-bubble', 'src/assets/bubble-orb.png');
    this.load.image('item-dart', 'src/assets/item-dart.png');
    this.load.image('item-banana', 'src/assets/item-banana.png');
    this.load.image('item-needle', 'src/assets/item-needle.png');
    this.load.image('item-shield', 'src/assets/item-shield.png');
  }

  create() {
    createTextures(this);
    this.scene.start('MenuScene');
  }
}

class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x17212a).setOrigin(0);
    this.add.text(GAME_WIDTH / 2, 105, '糖泡对战', {
      fontFamily: 'Microsoft YaHei, sans-serif',
      fontSize: '54px',
      color: '#f7fbff',
      fontStyle: '700',
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 166, '放糖泡、炸软糖、捡道具，把对手困住', {
      fontFamily: 'Microsoft YaHei, sans-serif',
      fontSize: '20px',
      color: '#b9c8d6',
    }).setOrigin(0.5);

    this.createButton(GAME_WIDTH / 2, 262, '单人模式  玩家 vs AI', () => this.scene.start('GameScene', { mode: 'single' }));
    this.createButton(GAME_WIDTH / 2, 342, '本地双人  WASD/方向键', () => this.scene.start('GameScene', { mode: 'duel' }));

    this.add.text(GAME_WIDTH / 2, 458, '玩家1: WASD 移动，Space 放糖泡，1-4 使用背包道具\n玩家2: 方向键移动，Enter 放糖泡，小键盘1-4 使用背包道具', {
      fontFamily: 'Microsoft YaHei, sans-serif',
      fontSize: '18px',
      color: '#dbe7ef',
      align: 'center',
      lineSpacing: 10,
    }).setOrigin(0.5);
  }

  createButton(x, y, label, onClick) {
    const button = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 360, 56, 0x2e4759).setStrokeStyle(2, 0x8bd5ff);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Microsoft YaHei, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: '700',
    }).setOrigin(0.5);
    button.add([bg, text]);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(0x3b6078));
    bg.on('pointerout', () => bg.setFillStyle(0x2e4759));
    bg.on('pointerdown', onClick);
    return button;
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.mode = 'single';
    this.state = null;
    this.keys = null;
    this.playerSprites = new Map();
    this.bubbleSprites = new Map();
    this.itemViews = new Map();
    this.aiNextThinkAt = 0;
    this.aiTarget = null;
  }

  init(data) {
    this.mode = data.mode ?? 'single';
  }

  create() {
    this.state = createInitialState({ mode: this.mode, seed: Date.now() });
    this.state.startedAt = this.time.now;
    this.playerSprites.clear();
    this.bubbleSprites.clear();
    this.itemViews.clear();
    this.aiTarget = null;

    this.mapGraphics = this.add.graphics();
    this.explosionGraphics = this.add.graphics();
    this.itemLayer = this.add.container(0, HUD_HEIGHT);
    this.bubbleLayer = this.add.container(0, HUD_HEIGHT);
    this.playerLayer = this.add.container(0, HUD_HEIGHT);
    this.hudText = this.add.text(16, 12, '', hudTextStyle(18));
    this.helpText = this.add.text(GAME_WIDTH - 16, 12, this.mode === 'single' ? '单人模式' : '本地双人', hudTextStyle(18)).setOrigin(1, 0);

    this.keys = this.input.keyboard.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
      numOne: Phaser.Input.Keyboard.KeyCodes.NUMPAD_ONE,
      numTwo: Phaser.Input.Keyboard.KeyCodes.NUMPAD_TWO,
      numThree: Phaser.Input.Keyboard.KeyCodes.NUMPAD_THREE,
      numFour: Phaser.Input.Keyboard.KeyCodes.NUMPAD_FOUR,
      esc: Phaser.Input.Keyboard.KeyCodes.ESC,
    });

    this.input.keyboard.on('keydown-ESC', () => this.scene.start('MenuScene'));
    for (const player of this.state.players) this.createPlayerSprite(player);
    this.renderMap();
  }

  update(time, delta) {
    if (this.state.ended) return;

    const elapsed = time - this.state.startedAt;
    this.handleHumanInput(time, delta / 1000);
    this.handleAi(time);
    explodeDueBubbles(this.state, time);
    tickTraps(this.state, time);
    handleTrapTouch(this.state);
    pruneExplosions(this.state, time);
    this.syncVisuals();

    const result = chooseWinner(this.state, elapsed);
    if (result.ended) {
      this.state.ended = true;
      this.time.delayedCall(450, () => this.scene.start('ResultScene', { mode: this.mode, state: this.state, result }));
      return;
    }

    this.renderHud(Math.max(0, MATCH_DURATION_MS - elapsed));
  }

  handleHumanInput(now, dt) {
    const p1 = this.state.players[0];
    this.moveFromKeys(p1, dt, this.keys.a.isDown, this.keys.d.isDown, this.keys.w.isDown, this.keys.s.isDown);
    if (Phaser.Input.Keyboard.JustDown(this.keys.space)) this.dropBubbleWithVisual(p1, now);
    this.handleInventoryKeys(p1, now, [this.keys.one, this.keys.two, this.keys.three, this.keys.four]);

    const p2 = this.state.players[1];
    if (!p2.ai) {
      this.moveFromKeys(p2, dt, this.keys.left.isDown, this.keys.right.isDown, this.keys.up.isDown, this.keys.down.isDown);
      if (Phaser.Input.Keyboard.JustDown(this.keys.enter)) this.dropBubbleWithVisual(p2, now);
      this.handleInventoryKeys(p2, now, [this.keys.numOne, this.keys.numTwo, this.keys.numThree, this.keys.numFour]);
    }
  }

  handleInventoryKeys(player, now, keys) {
    keys.forEach((key, index) => {
      if (Phaser.Input.Keyboard.JustDown(key)) this.usePlayerItem(player, now, index);
    });
  }

  moveFromKeys(player, dt, left, right, up, down) {
    const xAxis = Number(right) - Number(left);
    const yAxis = Number(down) - Number(up);
    if (xAxis === 0 && yAxis === 0) return;
    player.lastDirection =
      Math.abs(xAxis) >= Math.abs(yAxis) && xAxis !== 0 ? { col: Math.sign(xAxis), row: 0 } : { col: 0, row: Math.sign(yAxis) };
    const length = Math.hypot(xAxis, yAxis) || 1;
    this.tryMovePlayer(player, (xAxis / length) * player.speed * dt, (yAxis / length) * player.speed * dt);
  }

  tryMovePlayer(player, dx, dy) {
    if (player.status !== 'alive') return false;
    const move = resolvePlayerMove(this.state, player, dx, dy, PLAYER_RADIUS);
    const previousX = player.x;
    const previousY = player.y;
    player.x = move.x;
    player.y = move.y;
    updatePlayerPositionState(this.state, player, PLAYER_RADIUS);
    tryCollectItem(this.state, player);
    return move.moved || player.x !== previousX || player.y !== previousY;
  }

  dropBubbleWithVisual(player, now) {
    const result = placeBubble(this.state, player.id, now);
    if (result.placed) {
      const sprite = this.add.image(result.bubble.col * CELL_SIZE + CELL_SIZE / 2, result.bubble.row * CELL_SIZE + CELL_SIZE / 2, 'bubble');
      sprite.setDisplaySize(38, 38);
      this.bubbleLayer.add(sprite);
      this.bubbleSprites.set(result.bubble.id, sprite);
      this.tweens.add({ targets: sprite, displayWidth: 41, displayHeight: 41, duration: 320, yoyo: true, repeat: -1 });
    }
  }

  usePlayerItem(player, now, slotIndex = 0) {
    const result = useHeldItem(this.state, player.id, now, player.lastDirection, slotIndex);
    if (result.used && result.action === 'shield') {
      const sprite = this.playerSprites.get(player.id);
      if (sprite) this.tweens.add({ targets: sprite, scale: 1.12, duration: 120, yoyo: true });
    }
    return result;
  }

  handleAi(now) {
    const ai = this.state.players[1];
    if (ai.ai && ai.status === 'trapped') {
      const needleIndex = ai.inventory.indexOf(ITEM_TYPES.NEEDLE);
      if (needleIndex >= 0) this.usePlayerItem(ai, now, needleIndex);
    }
    if (!ai.ai || ai.status !== 'alive') return;
    const danger = dangerCells(this.state, now, 900);
    const shieldIndex = ai.inventory.indexOf(ITEM_TYPES.SHIELD);
    if (shieldIndex >= 0 && danger.has(cellKey(ai.col, ai.row))) {
      this.usePlayerItem(ai, now, shieldIndex);
    }
    if (now >= this.aiNextThinkAt || !this.aiTarget) {
      this.aiTarget = this.pickAiTarget(ai, now);
      this.aiNextThinkAt = now + 260;
    }
    if (!this.aiTarget) return;

    if (this.aiTarget.place) {
      this.dropBubbleWithVisual(ai, now);
      this.aiTarget = this.pickAiTarget(ai, now + 1);
      return;
    }

    const targetX = this.aiTarget.col * CELL_SIZE + CELL_SIZE / 2;
    const targetY = this.aiTarget.row * CELL_SIZE + CELL_SIZE / 2;
    const dx = targetX - ai.x;
    const dy = targetY - ai.y;
    if (Math.hypot(dx, dy) < 4) {
      ai.x = targetX;
      ai.y = targetY;
      ai.col = this.aiTarget.col;
      ai.row = this.aiTarget.row;
      this.aiTarget = this.pickAiTarget(ai, now);
      return;
    }
    const length = Math.hypot(dx, dy) || 1;
    this.tryMovePlayer(ai, (dx / length) * ai.speed * (1 / 60), (dy / length) * ai.speed * (1 / 60));
  }

  pickAiTarget(ai, now) {
    const danger = dangerCells(this.state, now, 1100);
    if (danger.has(cellKey(ai.col, ai.row))) {
      const escape = findPath(this.state, { col: ai.col, row: ai.row }, (cell) => !danger.has(cellKey(cell.col, cell.row)), new Set());
      return escape[0] ?? null;
    }

    const player = this.state.players[0];
    if (Math.abs(player.col - ai.col) + Math.abs(player.row - ai.row) <= ai.power && ai.activeBubbles < ai.maxBubbles) {
      return { col: ai.col, row: ai.row, place: true };
    }

    if (adjacentSoftBlock(this.state, ai.col, ai.row) && ai.activeBubbles < ai.maxBubbles) {
      return { col: ai.col, row: ai.row, place: true };
    }

    const itemPath = this.pathToNearestItem(ai);
    if (itemPath.length) return itemPath[0];

    const targetPath = findPath(this.state, { col: ai.col, row: ai.row }, (cell) => {
      const distance = Math.abs(cell.col - player.col) + Math.abs(cell.row - player.row);
      return distance <= Math.max(1, ai.power - 1) || adjacentSoftBlock(this.state, cell.col, cell.row);
    }, danger);
    return targetPath[0] ?? null;
  }

  pathToNearestItem(ai) {
    let best = [];
    for (const key of this.state.items.keys()) {
      const [col, row] = key.split(',').map(Number);
      const path = findPath(this.state, { col: ai.col, row: ai.row }, (cell) => cell.col === col && cell.row === row);
      if (path.length && (!best.length || path.length < best.length)) best = path;
    }
    return best;
  }

  createPlayerSprite(player) {
    const sprite = this.add.container(player.x, player.y);
    const shadow = this.add.ellipse(0, 19, 32, 9, 0x0c1720, 0.28);
    const footColor = player.id === 'p1' ? 0x1b74d6 : 0xd64a67;
    const footStroke = player.id === 'p1' ? 0x0d3f7d : 0x7d2639;
    const leftFoot = this.add.ellipse(-9, 28, 15, 9, footColor, 1).setStrokeStyle(2, footStroke, 0.9);
    const rightFoot = this.add.ellipse(9, 28, 15, 9, footColor, 1).setStrokeStyle(2, footStroke, 0.9);
    const body = this.add.image(0, -5, player.id === 'p1' ? 'player-blue' : 'player-red');
    body.setDisplaySize(42, 72);
    sprite.add([shadow, leftFoot, rightFoot, body]);
    sprite.bodyImage = body;
    sprite.shadow = shadow;
    sprite.leftFoot = leftFoot;
    sprite.rightFoot = rightFoot;
    sprite.lastX = player.x;
    sprite.lastY = player.y;
    sprite.walkTime = 0;
    this.playerLayer.add(sprite);
    this.playerSprites.set(player.id, sprite);
  }

  renderMap() {
    this.mapGraphics.clear();
    this.mapGraphics.fillStyle(0x274a3a);
    this.mapGraphics.fillRect(0, HUD_HEIGHT, BOARD_WIDTH, BOARD_HEIGHT);
    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const x = col * CELL_SIZE;
        const y = HUD_HEIGHT + row * CELL_SIZE;
        this.mapGraphics.lineStyle(1, 0x315945, 0.65);
        this.mapGraphics.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
        const terrain = this.state.grid[row][col].terrain;
        if (terrain === 'hard') {
          this.mapGraphics.fillStyle(0x53616b);
          this.mapGraphics.fillRect(x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8);
        }
        if (terrain === 'soft') {
          this.mapGraphics.fillStyle(0xd59c5c);
          this.mapGraphics.fillRect(x + 7, y + 7, CELL_SIZE - 14, CELL_SIZE - 14);
          this.mapGraphics.fillStyle(0xf4bf75);
          this.mapGraphics.fillRect(x + 12, y + 12, CELL_SIZE - 24, 8);
        }
      }
    }
  }

  syncVisuals() {
    this.renderMap();
    this.renderExplosions();
    this.syncItems();
    this.syncBubbles();
    this.syncPlayers();
  }

  renderExplosions() {
    this.explosionGraphics.clear();
    for (const explosion of this.state.explosions) {
      this.explosionGraphics.fillStyle(0x9eeaff, 0.78);
      for (const cell of explosion.cells) {
        this.explosionGraphics.fillRoundedRect(cell.col * CELL_SIZE + 7, HUD_HEIGHT + cell.row * CELL_SIZE + 7, CELL_SIZE - 14, CELL_SIZE - 14, 8);
      }
    }
  }

  syncItems() {
    for (const [key, view] of [...this.itemViews.entries()]) {
      if (!this.state.items.has(key)) {
        view.destroy();
        this.itemViews.delete(key);
      }
    }
    for (const [key, type] of this.state.items.entries()) {
      if (this.itemViews.has(key)) continue;
      const [col, row] = key.split(',').map(Number);
      const view = this.add.container(col * CELL_SIZE + CELL_SIZE / 2, HUD_HEIGHT + row * CELL_SIZE + CELL_SIZE / 2);
      const icon = this.add.image(0, 0, `item-${type}`);
      if (type === ITEM_TYPES.SPEED) {
        icon.setDisplaySize(40, 39);
      } else if (type === ITEM_TYPES.POWER) {
        icon.setDisplaySize(28, 40);
      } else if (type === ITEM_TYPES.DART) {
        icon.setDisplaySize(38, 38);
      } else if (type === ITEM_TYPES.BANANA) {
        icon.setDisplaySize(42, 36);
      } else if (type === ITEM_TYPES.NEEDLE) {
        icon.setDisplaySize(32, 40);
      } else if (type === ITEM_TYPES.SHIELD) {
        icon.setDisplaySize(38, 38);
      } else {
        icon.setDisplaySize(36, 36);
      }
      view.add(icon);
      this.itemViews.set(key, view);
    }
  }

  syncBubbles() {
    const liveIds = new Set(this.state.bubbles.map((bubble) => bubble.id));
    for (const [id, sprite] of [...this.bubbleSprites.entries()]) {
      if (!liveIds.has(id)) {
        sprite.destroy();
        this.bubbleSprites.delete(id);
      }
    }
  }

  syncPlayers() {
    for (const player of this.state.players) {
      const sprite = this.playerSprites.get(player.id);
      if (!sprite) continue;
      this.updatePlayerWalkAnimation(player, sprite);
      sprite.setPosition(player.x, player.y);
      sprite.setAlpha(player.status === 'out' ? 0.25 : 1);
      sprite.setScale(player.status === 'trapped' ? 0.82 : 1);
      const shieldActive = player.shieldUntil > this.time.now && player.status === 'alive';
      if (shieldActive) {
        if (!sprite.shieldRing) {
          sprite.shieldRing = this.add.image(0, -5, 'item-shield');
          sprite.shieldRing.setDisplaySize(54, 54);
          sprite.shieldRing.setAlpha(0.38);
          sprite.addAt(sprite.shieldRing, 1);
        }
      } else if (sprite.shieldRing) {
        sprite.shieldRing.destroy();
        sprite.shieldRing = null;
      }
      if (player.status === 'trapped') {
        if (!sprite.trapRing) {
          sprite.trapRing = this.add.image(0, 0, 'trap');
          sprite.addAt(sprite.trapRing, 0);
        }
      } else if (sprite.trapRing) {
        sprite.trapRing.destroy();
        sprite.trapRing = null;
      }
    }
  }

  updatePlayerWalkAnimation(player, sprite) {
    const dx = player.x - sprite.lastX;
    const dy = player.y - sprite.lastY;
    const distance = Math.hypot(dx, dy);
    const moving = distance > 0.08 && player.status === 'alive';
    const body = sprite.bodyImage;
    const shadow = sprite.shadow;
    const leftFoot = sprite.leftFoot;
    const rightFoot = sprite.rightFoot;

    if (moving) {
      sprite.walkTime += distance * 0.32;
      const pose = createWalkPose({ dx, dy, walkTime: sprite.walkTime, moving: true });
      leftFoot.x = -9 + pose.leftFoot.x;
      leftFoot.y = 28 + pose.leftFoot.y;
      rightFoot.x = 9 + pose.rightFoot.x;
      rightFoot.y = 28 + pose.rightFoot.y;
      body.y = -5 + pose.bodyOffsetY;
      body.angle = pose.bodyAngle;
      if (dx < -0.08) body.setFlipX(true);
      if (dx > 0.08) body.setFlipX(false);
      shadow.scaleX = pose.shadowScaleX;
      shadow.scaleY = pose.shadowScaleY;
      shadow.alpha = pose.shadowAlpha;
    } else {
      const pose = createWalkPose({ dx: 0, dy: 0, walkTime: sprite.walkTime, moving: false });
      sprite.walkTime *= 0.82;
      leftFoot.x += (-9 + pose.leftFoot.x - leftFoot.x) * 0.35;
      leftFoot.y += (28 + pose.leftFoot.y - leftFoot.y) * 0.35;
      rightFoot.x += (9 + pose.rightFoot.x - rightFoot.x) * 0.35;
      rightFoot.y += (28 + pose.rightFoot.y - rightFoot.y) * 0.35;
      body.y += (-5 + pose.bodyOffsetY - body.y) * 0.35;
      body.angle += (pose.bodyAngle - body.angle) * 0.3;
      shadow.scaleX += (pose.shadowScaleX - shadow.scaleX) * 0.35;
      shadow.scaleY += (pose.shadowScaleY - shadow.scaleY) * 0.35;
      shadow.alpha += (pose.shadowAlpha - shadow.alpha) * 0.35;
    }

    sprite.lastX = player.x;
    sprite.lastY = player.y;
  }

  renderHud(remainingMs) {
    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000).toString().padStart(2, '0');
    const stats = this.state.players
      .map(
        (player) =>
          `${player.name} ${statusText(player)}  威${player.power}  速${player.speed}  泡${player.activeBubbles}/${player.maxBubbles}  包:${inventoryText(player)}  分${player.score}`,
      )
      .join('\n');
    this.hudText.setText(`时间 ${minutes}:${seconds}   P1道具:1-4   P2道具:小键盘1-4\n${stats}`);
  }
}

class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  create(data) {
    const result = data.result;
    const state = data.state;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x17212a).setOrigin(0);
    this.add.text(GAME_WIDTH / 2, 130, result.reason, {
      fontFamily: 'Microsoft YaHei, sans-serif',
      fontSize: '38px',
      color: '#f7fbff',
      fontStyle: '700',
    }).setOrigin(0.5);

    const scoreLines = state.players
      .map((player) => `${player.name}: ${player.score} 分  |  炸糖块 ${player.destroyedBlocks}  道具 ${player.itemsCollected}  命中 ${player.hits}`)
      .join('\n');
    this.add.text(GAME_WIDTH / 2, 240, scoreLines, {
      fontFamily: 'Microsoft YaHei, sans-serif',
      fontSize: '21px',
      color: '#dbe7ef',
      align: 'center',
      lineSpacing: 12,
    }).setOrigin(0.5);

    this.createButton(GAME_WIDTH / 2, 370, '再来一局', () => this.scene.start('GameScene', { mode: data.mode }));
    this.createButton(GAME_WIDTH / 2, 446, '返回菜单', () => this.scene.start('MenuScene'));
  }

  createButton(x, y, label, onClick) {
    const bg = this.add.rectangle(x, y, 260, 54, 0x2e4759).setStrokeStyle(2, 0x8bd5ff);
    this.add.text(x, y, label, {
      fontFamily: 'Microsoft YaHei, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: '700',
    }).setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(0x3b6078));
    bg.on('pointerout', () => bg.setFillStyle(0x2e4759));
    bg.on('pointerdown', onClick);
  }
}

function createTextures(scene) {
  const graphics = scene.add.graphics();
  graphics.lineStyle(4, 0x9eeaff, 0.95);
  graphics.strokeCircle(22, 22, 20);
  graphics.generateTexture('trap', 44, 44);
  graphics.destroy();
}

function adjacentSoftBlock(state, col, row) {
  return [
    [col + 1, row],
    [col - 1, row],
    [col, row + 1],
    [col, row - 1],
  ].some(([nextCol, nextRow]) => getCell(state, nextCol, nextRow)?.terrain === 'soft');
}

function statusText(player) {
  if (player.status === 'alive') return '行动中';
  if (player.status === 'trapped') return '困住';
  return '出局';
}

function itemName(type) {
  if (!type) return '无';
  return {
    [ITEM_TYPES.POWER]: '药水',
    [ITEM_TYPES.SPEED]: '飞鞋',
    [ITEM_TYPES.BUBBLE]: '糖泡',
    [ITEM_TYPES.DART]: '飞镖',
    [ITEM_TYPES.BANANA]: '香蕉皮',
    [ITEM_TYPES.NEEDLE]: '针',
    [ITEM_TYPES.SHIELD]: '盾牌',
  }[type] ?? type;
}

function inventoryText(player) {
  return [0, 1, 2, 3].map((index) => `${index + 1}.${itemName(player.inventory[index])}`).join(' ');
}

function hudTextStyle(size) {
  return {
    fontFamily: 'Microsoft YaHei, sans-serif',
    fontSize: `${size}px`,
    color: '#f7fbff',
    lineSpacing: 6,
  };
}

const config = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#17212a',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, GameScene, ResultScene],
};

new Phaser.Game(config);
