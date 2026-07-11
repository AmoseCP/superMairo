import { FIREBALL_LIFETIME_MS, FIREBALL_SPEED, WORLD_SCALE } from '../config/constants.js'
import { MISC_ART } from '../config/assets.js'
import { tryArtSprite } from '../utils/artSwap.js'

const FIREBALL_RADIUS = 7 * WORLD_SCALE
// Shrinks from full size down to this fraction over SHRINK_DURATION_MS of
// flight, then holds — a fast, visibly-shrinking "spent" look without the
// hitbox vanishing to nothing for shots that stay alive past that window.
const SHRINK_MIN_SCALE = 0.35
const SHRINK_DURATION_MS = 600

/** Fire-form projectile: straight line, dies on wall hit, timeout, or enemy contact. */
export class Fireball {
  constructor(scene, x, y, direction) {
    this.scene = scene
    this.dead = false
    this.spawnTime = scene.time.now

    this.rect = scene.add.circle(x, y, FIREBALL_RADIUS, 0xff5722)
    scene.physics.add.existing(this.rect)
    this.body = this.rect.body
    this.body.setAllowGravity(false)
    this.body.setCollideWorldBounds(true)
    this.body.setVelocityX(direction * FIREBALL_SPEED)
    this.rect.setData('fireballRef', this)

    this.artSprite = tryArtSprite(scene, x, y, MISC_ART.fireball, FIREBALL_RADIUS * 2, FIREBALL_RADIUS * 2)
    if (this.artSprite) this.rect.setVisible(false)
  }

  update(time) {
    if (this.dead) return
    if (time - this.spawnTime > FIREBALL_LIFETIME_MS) return this.destroy()
    if (this.body.blocked.left || this.body.blocked.right) return this.destroy()

    // Arcade Physics re-syncs the body's size/position from the GameObject's
    // scale every frame (Body.preUpdate -> updateFromGameObject), so scaling
    // the circle down here shrinks its hitbox to match — no gravity on this
    // body, so unlike the boss squash-scale gotcha there's no floor contact
    // to lose (see PLAN.md §7 item 12).
    const shrinkProgress = Math.min(1, (time - this.spawnTime) / SHRINK_DURATION_MS)
    const scale = 1 - shrinkProgress * (1 - SHRINK_MIN_SCALE)
    this.rect.setScale(scale)
    this.artSprite?.setScale(scale)
    this.artSprite?.setPosition(this.rect.x, this.rect.y)
  }

  destroy() {
    if (this.dead) return
    this.dead = true
    this.rect.destroy()
    this.artSprite?.destroy()
  }
}
