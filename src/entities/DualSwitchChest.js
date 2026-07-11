import { WORLD_SCALE } from '../config/constants.js'
import { MISC_ART } from '../config/assets.js'
import { tryArtSprite } from '../utils/artSwap.js'

const CHEST_WIDTH = 28 * WORLD_SCALE
const CHEST_HEIGHT = 22 * WORLD_SCALE
const PLATE_WIDTH = 28 * WORLD_SCALE
const PLATE_HEIGHT = 6 * WORLD_SCALE
const PLATE_OCCUPY_X_PX = 20 * WORLD_SCALE
const PLATE_OCCUPY_Y_PX = 24 * WORLD_SCALE
const REWARD_Y_OFFSET = 20 * WORLD_SCALE

/**
 * Two pressure plates that must both be occupied *at the same time* (one
 * player each) to pop the chest open — see LEVELS.md 1-3's hidden co-op
 * bonus. Single-player can still trigger it solo only by literally standing
 * on both at once, which isn't possible, so it's a genuine duo-only bonus
 * (matches the design note that this one is allowed to be duo-exclusive).
 */
export class DualSwitchChest {
  constructor(scene, { plateA, plateB, chestX, chestY, rewardType, onOpen }) {
    this.scene = scene
    this.opened = false
    this.rewardType = rewardType
    this.onOpen = onOpen

    this.plateA = this._addPlate(plateA.x, plateA.y)
    this.plateB = this._addPlate(plateB.x, plateB.y)
    this.chestX = chestX
    this.chestY = chestY
    // The chest is a solid physical box (stand on it, bump into it) — not
    // just a decorative marker — so it always gets a real static body,
    // matching the rect-is-the-hitbox/art-is-an-optional-overlay pattern
    // every other solid entity in this game already follows (Brick, Pipe,
    // ...). Previously this had no physics body at all in either the art or
    // no-art branch, so touching it did nothing and players fell straight
    // through it.
    this.chestRect = scene.add.rectangle(chestX, chestY, CHEST_WIDTH, CHEST_HEIGHT, 0x8a5a2b)
    this.chestRect.setStrokeStyle(2, 0x5c3a1a)
    scene.physics.add.existing(this.chestRect, true)

    this.chestArt = tryArtSprite(scene, chestX, chestY, MISC_ART.chest, CHEST_WIDTH, CHEST_HEIGHT)
    if (this.chestArt) this.chestRect.setVisible(false)
  }

  _addPlate(x, y) {
    const art = tryArtSprite(this.scene, x, y, MISC_ART.switchPlate, PLATE_WIDTH, PLATE_HEIGHT)
    const rect = art ?? this.scene.add.rectangle(x, y, PLATE_WIDTH, PLATE_HEIGHT, 0xffb703)
    return { rect, x, y, isArt: !!art }
  }

  /** Call each frame with the list of currently-active player rects. Returns true the instant it opens. */
  update(playerRects) {
    if (this.opened) return false
    const occupied = (plate) =>
      playerRects.some(
        (r) => Math.abs(r.x - plate.x) < PLATE_OCCUPY_X_PX && Math.abs(r.y + r.height / 2 - plate.y) < PLATE_OCCUPY_Y_PX,
      )
    if (occupied(this.plateA) && occupied(this.plateB)) {
      this._open()
      return true
    }
    return false
  }

  _open() {
    this.opened = true
    // Art sprites don't have setFillStyle (that's a Shape-only method) — a
    // tint achieves the same "lit up" feedback without needing a second
    // "activated" image drawn per asset.
    for (const plate of [this.plateA, this.plateB]) {
      if (plate.isArt) plate.rect.setTint(0x66bb6a)
      else plate.rect.setFillStyle(0x66bb6a)
    }
    if (this.chestArt) this.chestArt.setTint(0xffe066)
    else this.chestRect.setFillStyle(0xffe066)
    this.onOpen?.(this.rewardType, this.chestX, this.chestY - REWARD_Y_OFFSET)
  }
}
