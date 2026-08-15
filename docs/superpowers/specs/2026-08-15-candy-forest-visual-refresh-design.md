# Candy Forest Visual Refresh Design

## Goal

Upgrade the current game visuals from a prototype-like grid of flat blocks into a richer “candy forest playground” style. The change should make the board feel more polished and playful while preserving the existing gameplay, collision rules, controls, and asset pipeline.

## Visual Direction

The game should look like a saturated candy forest:

- The board becomes a lively grassy candy-garden floor with subtle tile variation, leaf marks, sparkles, and soft depth.
- Hard walls become tree-like blockers: trunk bases, rounded canopies, bark highlights, and small leaf details.
- Soft walls become colorful candy bushes/sugar blocks: saturated pink, orange, mint, and violet accents with candy stripes and glossy highlights.
- Bubbles and explosions receive stronger glow and syrup-like rounded shapes.
- Pickups sit on glowing pads with a small floating animation so they feel collectible.
- HUD and menu backgrounds shift toward the same candy-forest palette.

## Scope

In scope:

- Improve `src/main.js` rendering of the map, walls, items, bubbles, explosions, menu, result scene, and HUD.
- Add procedural Phaser textures if useful, so the refresh does not require new external art files.
- Add lightweight animations that do not change gameplay state.
- Keep existing PNG assets for players, bubbles, and item icons.

Out of scope:

- Changing the gameplay rules, map generation, AI, controls, scoring, or tests for game logic.
- Replacing the player character art.
- Adding a build system or new runtime dependency.

## Architecture

The visual refresh should stay inside the Phaser scene layer:

- `createTextures(scene)` will generate reusable procedural textures for tree walls, candy blocks, grass details, glow pads, and sparkle/highlight elements.
- `GameScene.renderMap()` will draw the board in layered passes: background floor, decorative tile details, hard blockers, and soft blockers.
- Existing state fields such as `terrain`, `items`, `bubbles`, and `explosions` remain the source of truth.
- Item and bubble syncing methods will add presentation-only containers, halos, and tweens without changing the data model.

This keeps the code simple and local: the core rules stay untouched, and visual changes are easy to tune.

## Components

### Board floor

Draw a richer grass base with alternating tile tints, subtle grid lines, small leaf strokes, and candy sparkle dots. The floor should still be readable for movement.

### Hard walls

Render hard terrain as tree blockers. Each cell should have a rounded shadow, a trunk base, a leafy canopy, and bark/leaf highlights. Hard blockers should visually communicate “permanent obstacle.”

### Soft walls

Render soft terrain as breakable candy shrubs or sugar blocks. Use saturated warm colors, diagonal candy stripes, and glossy highlights. Soft blockers should feel destructible and rewarding.

### Pickups

Wrap existing item icons in a glow pad and add gentle bobbing/pulsing. The icon art stays the same but gains stronger game affordance.

### Bubble and explosion effects

Keep the bubble asset but add glow/pulse where placed. Explosions should become brighter, rounded candy-splash beams with warm and cool layered highlights.

### HUD and screens

Refresh menu/result backgrounds and buttons with a softer candy-forest palette, brighter borders, and subtle decorative shapes. Keep text layout and controls intact.

## Testing and Verification

- Run existing tests with `npm test` to confirm rules were not broken.
- Start the local server and visually inspect the game in browser if possible.
- If browser inspection is unavailable, verify the JavaScript parses and the render functions use valid Phaser APIs already present in the project.

## Acceptance Criteria

- The game board no longer looks like plain rectangles on a flat grid.
- Hard walls clearly read as tree/forest obstacles.
- Soft blocks and candy elements are more saturated and playful.
- Items and bubbles feel more polished through glow/animation.
- Existing game rules and tests remain unchanged and passing.
