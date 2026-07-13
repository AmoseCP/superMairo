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
  // --- World 2 (LEVELS2.md) ---
  iceshell: { key: 'enemy_iceshell', path: 'assets/sprites/enemy_iceshell.png', scale: 1.15 },
  // Optional — shown while an IceShell is tucked/kicked (falls back to enemy_iceshell).
  iceshell_shell: { key: 'enemy_iceshell_shell', path: 'assets/sprites/enemy_iceshell_shell.png', scale: 1.15 },
  bat: { key: 'enemy_bat', path: 'assets/sprites/enemy_bat.png', scale: 1.15 },
  gearmochi: { key: 'enemy_gearmochi', path: 'assets/sprites/enemy_gearmochi.png', scale: 1.15 },
  // Optional — 2-5 twin bosses; each falls back to enemy_boss.png when absent.
  sovereign_blue: { key: 'enemy_sovereign_blue', path: 'assets/sprites/enemy_sovereign_blue.png', scale: 1.1 },
  sovereign_red: { key: 'enemy_sovereign_red', path: 'assets/sprites/enemy_sovereign_red.png', scale: 1.1 },
  // --- World 3 (LEVELS3.md) ---
  hopper: { key: 'enemy_hopper', path: 'assets/sprites/enemy_hopper.png', scale: 1.15 },
  shyghost: { key: 'enemy_shyghost', path: 'assets/sprites/enemy_shyghost.png', scale: 1.15 },
  turret: { key: 'enemy_turret', path: 'assets/sprites/enemy_turret.png' },
  // 可选——3-5 终章 Boss，不画则自动复用 enemy_boss.png 并染成紫色（同 2-5 双子王的降级规则）。
  phantomqueen: { key: 'enemy_phantomqueen', path: 'assets/sprites/enemy_phantomqueen.png', scale: 1.1 },
}

export const ITEM_ART = {
  coin: { key: 'item_coin', path: 'assets/sprites/item_coin.png' },
  mushroom: { key: 'item_mushroom', path: 'assets/sprites/item_mushroom.png' },
  fireflower: { key: 'item_fireflower', path: 'assets/sprites/item_fireflower.png' },
  star: { key: 'item_star', path: 'assets/sprites/item_star.png' },
  lantern: { key: 'item_lantern', path: 'assets/sprites/item_lantern.png' },
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
  // --- World 2 (LEVELS2.md) ---
  flameJet: { key: 'flame_jet', path: 'assets/sprites/flame_jet.png' },
  // Conveyor surface — TILED horizontally like ground_tile (must loop seamlessly left↔right).
  belt: { key: 'belt', path: 'assets/sprites/belt.png' },
  crumblePlatform: { key: 'crumble_platform', path: 'assets/sprites/crumble_platform.png' },
  // Optional — swapped in during the 0.4s shake before a crumble platform breaks.
  crumblePlatformCracked: { key: 'crumble_platform_cracked', path: 'assets/sprites/crumble_platform_cracked.png' },
  // --- World 3 (LEVELS3.md) ---
  springSmall: { key: 'spring_small', path: 'assets/sprites/spring_small.png' },
  springBig: { key: 'spring_big', path: 'assets/sprites/spring_big.png' },
  switchBlockRed: { key: 'switch_block_red', path: 'assets/sprites/switch_block_red.png' },
  switchBlockBlue: { key: 'switch_block_blue', path: 'assets/sprites/switch_block_blue.png' },
  turretShot: { key: 'turret_shot', path: 'assets/sprites/turret_shot.png' },
}

/** Per-level full background image — if present, replaces the procedural sky/cloud/grass backdrop for that level entirely. */
export function backgroundArtFor(levelId) {
  return { key: `bg_${levelId}`, path: `assets/backgrounds/bg-${levelId}.png` }
}

const LEVEL_IDS = [
  '1-1', '1-2', '1-3', '1-4', '1-5',
  '2-1', '2-2', '2-3', '2-4', '2-5',
  '3-1', '3-2', '3-3', '3-4', '3-5',
]

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
