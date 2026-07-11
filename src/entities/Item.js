import { WORLD_SCALE } from '../config/constants.js'
import { tryArtSprite } from '../utils/artSwap.js'

/**
 * Base pickup: a physics-enabled shape sitting in the world, collected via
 * overlap with a player. Subclasses set `this.type` (read by GameScene's
 * overlap handler to decide what happens) and may add movement in update().
 * Draws real art instead of the placeholder circle the moment it exists —
 * see config/assets.js ITEM_ART + ART.md.
 */
export class Item {
  constructor(scene, x, y, { color = 0xffd700, radius = 10 * WORLD_SCALE, allowGravity = false, art = null } = {}) {
    this.scene = scene
    this.dead = false
    this.allowGravity = allowGravity
    this.rect = scene.add.circle(x, y, radius, color)
    scene.physics.add.existing(this.rect)
    this.body = this.rect.body
    this.body.setAllowGravity(allowGravity)
    this.rect.setData('itemRef', this)

    this.artSprite = tryArtSprite(scene, x, y, art, radius * 2, radius * 2)
    if (this.artSprite) this.rect.setVisible(false)
  }

  update() {
    this.artSprite?.setPosition(this.rect.x, this.rect.y)
  }

  destroy() {
    if (this.dead) return
    this.dead = true
    this.rect.destroy()
    this.artSprite?.destroy()
  }
}
