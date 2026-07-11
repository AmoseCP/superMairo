import { TILE_SIZE, WORLD_SCALE } from '../config/constants.js'
import { BLOCK_ART } from '../config/assets.js'
import { tryArtSprite } from '../utils/artSwap.js'

const BUMP_TWEEN_Y = 8 * WORLD_SCALE
const SPAWN_ITEM_Y_OFFSET = 28 * WORLD_SCALE
const KNOCK_TWEEN_Y = 6 * WORLD_SCALE
// Drawn (and hit-tested visually) taller than the 1-tile physics footprint —
// a plain TILE_SIZE-tall block reads as noticeably shorter than the player
// (who's drawn chunkier/taller than one tile, matching the Q版萌 art style),
// which looked like a puny, easy-to-miss obstacle. Grown downward only (TOP
// edge stays put): the top must stay flush with the physics body's top or a
// player standing on the brick looks sunk into it up to the ankles; the
// extra height hanging below is harmless since bricks float in open air —
// see the physics-vs-visual split below.
const VISUAL_HEIGHT_SCALE = 1.25

/**
 * Classic brick block: hit from below (see GameScene._handlePlayerBlockCollision,
 * same touching.up trick as QuestionBlock). Small Mario just bonks it — only
 * Big/Fire Mario actually breaks it, matching the original game. A brick can
 * optionally hold a single coin instead (hasCoin) — that variant never
 * breaks, it just pays out once and goes inert, like a coin question block.
 */
export class Brick {
  constructor(scene, x, y, { hasCoin = false, onSpawnItem, onBreak } = {}) {
    this.scene = scene
    this.used = false
    this.hasCoin = hasCoin
    this.onSpawnItem = onSpawnItem
    this.onBreak = onBreak
    this.baseY = y

    this.rect = scene.add.rectangle(x, y, TILE_SIZE, TILE_SIZE, 0xc9702f)
    this.rect.setStrokeStyle(2, 0x8a4a1a)
    // Physics body locks in at exactly TILE_SIZE here, before the rectangle
    // is resized below — static bodies don't auto-follow later setSize()/
    // setPosition() calls on their GameObject, so this keeps the 1-tile
    // hitbox (and the level's tile grid) completely untouched.
    scene.physics.add.existing(this.rect, true)
    this.rect.setData('blockRef', this)

    const visualHeight = TILE_SIZE * VISUAL_HEIGHT_SCALE
    // Center shifts DOWN so the visual's top edge stays exactly at the
    // physics body's top — feet of a player standing on the brick stay flush.
    this.visualY = y + (visualHeight - TILE_SIZE) / 2
    this.rect.setSize(TILE_SIZE, visualHeight)
    this.rect.setPosition(x, this.visualY)

    this.artSprite = tryArtSprite(scene, x, this.visualY, BLOCK_ART.brick, TILE_SIZE, visualHeight)
    if (this.artSprite) this.rect.setVisible(false)
  }

  get _bumpTargets() {
    return this.artSprite ? [this.rect, this.artSprite] : [this.rect]
  }

  bump(player) {
    if (this.used) return

    if (this.hasCoin) {
      this.used = true
      if (!this.artSprite) this.rect.setFillStyle(0x8a4a1a)
      this.scene.tweens.add({ targets: this._bumpTargets, y: this.visualY - BUMP_TWEEN_Y, duration: 80, yoyo: true })
      this.onSpawnItem?.('coin', this.rect.x, this.visualY - SPAWN_ITEM_Y_OFFSET)
      return
    }

    if (player.form === 'small') {
      // Small Mario can knock on it but can't break it (see PLAN.md art/gameplay notes).
      this.scene.tweens.add({ targets: this._bumpTargets, y: this.visualY - KNOCK_TWEEN_Y, duration: 70, yoyo: true })
      return
    }

    this.used = true
    this.onBreak?.(this.rect.x, this.rect.y)
    this.rect.destroy()
    this.artSprite?.destroy()
  }
}
