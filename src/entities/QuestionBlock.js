import { TILE_SIZE, WORLD_SCALE } from '../config/constants.js'
import { BLOCK_ART } from '../config/assets.js'
import { tryArtSprite } from '../utils/artSwap.js'

const BUMP_TWEEN_Y = 8 * WORLD_SCALE
const SPAWN_ITEM_Y_OFFSET = 28 * WORLD_SCALE
// See Brick.js VISUAL_HEIGHT_SCALE — same "taller than the 1-tile hitbox"
// treatment, kept in sync so bricks and question blocks read as the same size.
const VISUAL_HEIGHT_SCALE = 1.25

/**
 * One-time-use bump block. Player must hit it from below (checked by the
 * caller via body.touching.up, same trick as the enemy-stomp detection —
 * see GameScene) — spawns its configured item once, then goes inert.
 */
export class QuestionBlock {
  constructor(scene, x, y, { itemType = 'coin', onSpawnItem, onCoinAward } = {}) {
    this.scene = scene
    this.used = false
    this.itemType = itemType
    this.onSpawnItem = onSpawnItem
    this.onCoinAward = onCoinAward
    this.baseY = y

    this.rect = scene.add.rectangle(x, y, TILE_SIZE, TILE_SIZE, 0xf4c95d)
    this.rect.setStrokeStyle(2, 0xc9962f)
    // Physics body locks in at exactly TILE_SIZE here, before the rectangle
    // is resized below — static bodies don't auto-follow later setSize()/
    // setPosition() calls on their GameObject (verified empirically), so
    // this keeps the 1-tile hitbox and the level's tile grid untouched.
    scene.physics.add.existing(this.rect, true)
    this.rect.setData('blockRef', this)

    const visualHeight = TILE_SIZE * VISUAL_HEIGHT_SCALE
    // Center shifts DOWN so the visual's top edge stays exactly at the
    // physics body's top — feet of a player standing on the block stay flush
    // (see Brick.js for the full reasoning).
    this.visualY = y + (visualHeight - TILE_SIZE) / 2
    this.rect.setSize(TILE_SIZE, visualHeight)
    this.rect.setPosition(x, this.visualY)

    this.artSprite = tryArtSprite(scene, x, this.visualY, BLOCK_ART.question, TILE_SIZE, visualHeight)
    if (this.artSprite) this.rect.setVisible(false)
  }

  bump(player) {
    if (this.used) return
    this.used = true
    if (this.artSprite && this.scene.textures.exists(BLOCK_ART.question_used.key)) {
      this.artSprite.setTexture(BLOCK_ART.question_used.key)
    } else if (!this.artSprite) {
      this.rect.setFillStyle(0xa9825a)
    }
    const targets = this.artSprite ? [this.rect, this.artSprite] : [this.rect]
    this.scene.tweens.add({ targets, y: this.visualY - BUMP_TWEEN_Y, duration: 80, yoyo: true })
    // A coin block pays the bumper directly (auto-collect, classic Mario);
    // power-ups still pop out as real pickups.
    if (this.itemType === 'coin' && this.onCoinAward) {
      this.onCoinAward(player, this.rect.x, this.visualY - SPAWN_ITEM_Y_OFFSET)
    } else {
      this.onSpawnItem?.(this.itemType, this.rect.x, this.visualY - SPAWN_ITEM_Y_OFFSET)
    }
  }
}
