/**
 * Central manifest of every swappable audio asset — same idea as
 * config/assets.js for images. Drop an audio file at the listed path,
 * reload the page, and AudioManager automatically plays it instead of the
 * synthesized placeholder tone. See AUDIO.md.
 */
export const SFX_AUDIO = {
  jump: { key: 'sfx_jump', path: 'assets/audio/sfx_jump.mp3' },
  land: { key: 'sfx_land', path: 'assets/audio/sfx_land.mp3' },
  coin: { key: 'sfx_coin', path: 'assets/audio/sfx_coin.mp3' },
  powerUp: { key: 'sfx_powerup', path: 'assets/audio/sfx_powerup.mp3' },
  stomp: { key: 'sfx_stomp', path: 'assets/audio/sfx_stomp.mp3' },
  hurt: { key: 'sfx_hurt', path: 'assets/audio/sfx_hurt.mp3' },
  bubble: { key: 'sfx_bubble', path: 'assets/audio/sfx_bubble.mp3' },
  rescue: { key: 'sfx_rescue', path: 'assets/audio/sfx_rescue.mp3' },
  flagpole: { key: 'sfx_flagpole', path: 'assets/audio/sfx_flagpole.mp3' },
  blockBump: { key: 'sfx_block_bump', path: 'assets/audio/sfx_block_bump.mp3' },
  brickBreak: { key: 'sfx_brick_break', path: 'assets/audio/sfx_brick_break.mp3' },
  oneUp: { key: 'sfx_1up', path: 'assets/audio/sfx_1up.mp3' },
  pipeWarp: { key: 'sfx_pipe_warp', path: 'assets/audio/sfx_pipe_warp.mp3' },
  // Shared by DualSwitchChest's pressure plates and TimedDoor's switch.
  switchOn: { key: 'sfx_switch', path: 'assets/audio/sfx_switch.mp3' },
  chestOpen: { key: 'sfx_chest_open', path: 'assets/audio/sfx_chest_open.mp3' },
}

/** Shared default BGM — used by any level that doesn't have its own override. */
export const BGM_DEFAULT = { key: 'bgm_overworld', path: 'assets/audio/bgm-overworld.mp3' }

/** Optional per-level BGM override — if this exists for a level, it plays instead of BGM_DEFAULT. */
export function bgmArtFor(levelId) {
  return { key: `bgm_${levelId}`, path: `assets/audio/bgm-${levelId}.mp3` }
}

const LEVEL_IDS = ['1-1', '1-2', '1-3', '1-4', '1-5']

/** Every {key, path} entry worth trying to preload — used by BootScene. Missing files just 404 quietly; nothing here is required to exist yet. */
export function allAudioAssets() {
  return [...Object.values(SFX_AUDIO), BGM_DEFAULT, ...LEVEL_IDS.map(bgmArtFor)]
}
