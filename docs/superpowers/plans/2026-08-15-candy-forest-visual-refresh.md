# Candy Forest Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat prototype-like game rendering with a polished candy forest visual style while preserving gameplay behavior.

**Architecture:** Keep all changes in the Phaser presentation layer. Generate reusable procedural glow textures in `createTextures(scene)`, and draw tree/candy wall primitives directly in `GameScene` map rendering helpers. Do not change `src/core/gameRules.js`.

**Tech Stack:** JavaScript ES modules, Phaser 3, existing PNG assets, Node built-in test runner.

## Global Constraints

- Preserve gameplay rules, controls, map dimensions, AI behavior, collision behavior, scoring, and item effects.
- Do not add runtime dependencies or a build system.
- Keep existing player and item PNG assets.
- Use procedural Phaser graphics/textures for new visual decoration.
- Verify with `npm test`.

---

## File Structure

- Modify `src/main.js`: add candy forest palette constants, procedural texture generation, map drawing helpers, richer item/bubble/explosion/HUD/menu styling, and safe presentation-only animations.
- Modify `src/styles.css`: improve page background and canvas framing.
- Test with `test/gameRules.test.js`: existing game rule tests should remain passing because core logic is unchanged.

---

### Task 1: Add Candy Forest Rendering Primitives

**Files:**
- Modify: `src/main.js`
- Test: `test/gameRules.test.js`

**Interfaces:**
- Consumes: Phaser `Graphics.generateTexture`, existing constants `CELL_SIZE`, `GRID_COLS`, `GRID_ROWS`, `HUD_HEIGHT`.
- Produces: texture keys `pickup-glow`, `bubble-glow`, and drawing helpers for tree/candy wall primitives.

- [ ] **Step 1: Run baseline tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 2: Add procedural texture generation**

In `createTextures(scene)`, generate texture keys:

```js
graphics.generateTexture('pickup-glow', 54, 54);
graphics.generateTexture('bubble-glow', 56, 56);
```

Use rounded shapes, circles, strokes, and highlights only; no external assets. Draw tree and candy wall primitives directly in map helper methods so they can vary by row/column without creating persistent per-cell sprites.

- [ ] **Step 3: Verify tests**

Run: `npm test`
Expected: PASS.

---

### Task 2: Upgrade Board, Hard Walls, and Soft Walls

**Files:**
- Modify: `src/main.js`
- Test: `test/gameRules.test.js`

**Interfaces:**
- Consumes: `COLORS` constants and direct Phaser graphics primitives from Task 1.
- Produces: `renderMap()`, `drawGroundCell(col, row)`, `drawTreeBlock(col, row)`, and `drawCandyBlock(col, row)` that draw richer terrain without changing `this.state.grid`.

- [ ] **Step 1: Replace flat board fill**

In `renderMap()`, draw:

```js
this.mapGraphics.fillStyle(0x2f7d4c);
this.mapGraphics.fillRect(0, HUD_HEIGHT, BOARD_WIDTH, BOARD_HEIGHT);
```

Then add per-cell alternating green tints, subtle rounded inset strokes, and deterministic decorative dots based on row/col.

- [ ] **Step 2: Render tree blockers**

For `terrain === 'hard'`, use graphics-only rendering to draw tree canopy circles, trunk, and highlights directly per cell.

- [ ] **Step 3: Render candy blockers**

For `terrain === 'soft'`, alternate main/accent colors by `(row + col) % 2`. Use saturated candy colors and glossy highlights.

- [ ] **Step 4: Verify tests**

Run: `npm test`
Expected: PASS.

---

### Task 3: Polish Pickups, Bubbles, and Explosions

**Files:**
- Modify: `src/main.js`
- Test: `test/gameRules.test.js`

**Interfaces:**
- Consumes: existing `syncItems()`, `dropBubbleWithVisual(player, now)`, `renderExplosions()`.
- Produces: presentation-only halos, bobbing tweens, and richer explosion shapes.

- [ ] **Step 1: Add pickup presentation**

In `syncItems()`, add a `pickup-glow` image behind each item icon and add a tween:

```js
this.tweens.add({
  targets: view,
  y: view.y - 4,
  duration: 780,
  yoyo: true,
  repeat: -1,
  ease: 'Sine.easeInOut',
});
```

- [ ] **Step 2: Add bubble glow**

In `dropBubbleWithVisual()`, wrap the bubble sprite in a container or add a glow image behind it. Keep `this.bubbleSprites` cleanup valid by storing the container or sprite consistently.

- [ ] **Step 3: Upgrade explosion drawing**

In `renderExplosions()`, draw layered rounded rectangles/circles with warm yellow cores and cyan/pink outer glow. Keep explosion cells exactly as provided by game state.

- [ ] **Step 4: Verify tests**

Run: `npm test`
Expected: PASS.

---

### Task 4: Refresh Screens, HUD, and Page Styling

**Files:**
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Test: `test/gameRules.test.js`

**Interfaces:**
- Consumes: existing `MenuScene`, `ResultScene`, `renderHud()`, `hudTextStyle(size)`.
- Produces: candy forest themed menus, buttons, HUD panel, and page frame.

- [ ] **Step 1: Refresh menu and result backgrounds**

Use green/purple gradient-like layered rectangles, soft decorative circles, and brighter button colors. Keep existing scene flow callbacks unchanged.

- [ ] **Step 2: Add HUD panel styling**

Add a rounded translucent panel behind HUD text in `GameScene.create()`. Ensure HUD text remains readable and help text stays aligned.

- [ ] **Step 3: Refresh CSS shell**

Set the page background to a radial candy-forest gradient and give `#game-root canvas` a soft shadow and rounded border.

- [ ] **Step 4: Verify tests**

Run: `npm test`
Expected: PASS.

---

### Task 5: Final Verification

**Files:**
- No new files.
- Test: `test/gameRules.test.js`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified visual refresh.

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: PASS with no failing tests.

- [ ] **Step 2: Run syntax/import smoke check**

Run: `node --check src/main.js`
Expected: no syntax errors.

- [ ] **Step 3: Inspect git diff**

Run: `git diff -- src/main.js src/styles.css docs/superpowers/plans/2026-08-15-candy-forest-visual-refresh.md`
Expected: only visual rendering, style, and plan changes.
