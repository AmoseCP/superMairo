/**
 * Central manifest of every swappable art asset in the game. This is the
 * ONE file that describes what image goes where — see ART.md for the full
 * how-to. The short version: draw a PNG, save it at the listed path under
 * `public/`, reload the page. No code changes needed — every entity checks
 * `scene.textures.exists(key)` at the moment it's created and automatically
 * switches from its procedural placeholder shape to your image.
 *
 * `scale` is optional (default 1) — a multiplier on top of the entity's
 * actual hitbox size, for art that's meant to overhang its collision box a
 * bit (a common, deliberate look in this genre: the visible sprite reads as
 * slightly bigger/chunkier than the thing you actually bump into).
 */

export const PLAYER_ART = {
  bunny: { key: 'player_bunny', path: 'assets/sprites/player_bunny.png', scale: 1.15 },
  cat: { key: 'player_cat', path: 'assets/sprites/player_cat.png', scale: 1.15 },
}

export const ENEMY_ART = {
  mochi: { key: 'enemy_mochi', path: 'assets/sprites/enemy_mochi.png', scale: 1.15 },
  shellbuddy: { key: 'enemy_shellbuddy', path: 'assets/sprites/enemy_shellbuddy.png', scale: 1.15 },
  // Optional — only used while a ShellBuddy is tucked into its shell
  // (state = shell_idle/shell_moving). Falls back to enemy_shellbuddy if absent.
  shellbuddy_shell: { key: 'enemy_shellbuddy_shell', path: 'assets/sprites/enemy_shellbuddy_shell.png', scale: 1.15 },
  candyslimeking: { key: 'enemy_boss', path: 'assets/sprites/enemy_boss.png', scale: 1.1 },
}

export const ITEM_ART = {
  coin: { key: 'item_coin', path: 'assets/sprites/item_coin.png' },
  mushroom: { key: 'item_mushroom', path: 'assets/sprites/item_mushroom.png' },
  fireflower: { key: 'item_fireflower', path: 'assets/sprites/item_fireflower.png' },
  star: { key: 'item_star', path: 'assets/sprites/item_star.png' },
}

export const BLOCK_ART = {
  brick: { key: 'block_brick', path: 'assets/sprites/block_brick.png' },
  question: { key: 'block_question', path: 'assets/sprites/block_question.png' },
  // Optional — a question block that's already been popped (used = true).
  // Falls back to the procedural "spent" color flip if absent.
  question_used: { key: 'block_question_used', path: 'assets/sprites/block_question_used.png' },
}

export const MISC_ART = {
  fireball: { key: 'fireball', path: 'assets/sprites/fireball.png' },
  bubble: { key: 'bubble', path: 'assets/sprites/bubble.png' },
  platform: { key: 'platform', path: 'assets/sprites/platform.png' },
  cloud: { key: 'cloud', path: 'assets/sprites/cloud.png' },
  flagpole: { key: 'flagpole', path: 'assets/sprites/flagpole.png' },
  flag: { key: 'flag', path: 'assets/sprites/flag.png' },
  ground: { key: 'ground_tile', path: 'assets/sprites/ground_tile.png' },
  pipe: { key: 'pipe', path: 'assets/sprites/pipe.png' },
  pipeTrap: { key: 'pipe_trap', path: 'assets/sprites/pipe_trap.png' },
  // Shared by DualSwitchChest's two pressure plates and TimedDoor's switch —
  // same "step here" floor marking either way, just different trigger logic.
  switchPlate: { key: 'switch_plate', path: 'assets/sprites/switch_plate.png' },
  chest: { key: 'chest', path: 'assets/sprites/chest.png' },
  door: { key: 'door', path: 'assets/sprites/door.png' },
}

/** Per-level full background image — if present, replaces the procedural sky/cloud/grass backdrop for that level entirely. */
export function backgroundArtFor(levelId) {
  return { key: `bg_${levelId}`, path: `assets/backgrounds/bg-${levelId}.png` }
}

const LEVEL_IDS = ['1-1', '1-2', '1-3', '1-4', '1-5']

/** Every {key, path} entry worth trying to preload — used by BootScene. Missing files just 404 quietly; nothing here is required to exist yet. */
export function allArtAssets() {
  return [
    ...Object.values(PLAYER_ART),
    ...Object.values(ENEMY_ART),
    ...Object.values(ITEM_ART),
    ...Object.values(BLOCK_ART),
    ...Object.values(MISC_ART),
    ...LEVEL_IDS.map(backgroundArtFor),
  ]
}
