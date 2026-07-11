import Phaser from 'phaser'
import { LEVELS, FIRST_LEVEL_ID } from '../config/levels.js'
import { allArtAssets } from '../config/assets.js'
import { allAudioAssets } from '../config/audio.js'

/**
 * Preloads level data and every art/audio asset listed in config/assets.js
 * and config/audio.js before handing off to GameScene. Files that don't
 * exist yet just 404 quietly (see ART.md / AUDIO.md) — entities fall back
 * to their procedural placeholder shape or synthesized tone whenever
 * `scene.textures.exists(key)` / `scene.cache.audio.exists(key)` come back false.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  preload() {
    for (const [levelId, level] of Object.entries(LEVELS)) {
      this.load.json(`level-${levelId}`, level.path)
    }
    for (const { key, path } of allArtAssets()) {
      this.load.image(key, path)
    }
    for (const { key, path } of allAudioAssets()) {
      this.load.audio(key, path)
    }
    // Missing placeholder art/audio is expected (nothing's been made yet) —
    // don't spam the console with a 404 warning per asset while that's true.
    this.load.on('loaderror', (file) => {
      if (![...allArtAssets(), ...allAudioAssets()].some((a) => a.key === file.key)) {
        console.warn('Failed to load', file.key, file.src)
      }
    })
  }

  create() {
    this.scene.start('GameScene', { levelId: FIRST_LEVEL_ID })
  }
}
