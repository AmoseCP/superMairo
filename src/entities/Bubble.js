import { WORLD_SCALE } from '../config/constants.js'
import { MISC_ART } from '../config/assets.js'
import { tryArtSprite } from '../utils/artSwap.js'

const BUBBLE_RADIUS = 18 * WORLD_SCALE
const BOB_AMPLITUDE_PX = 6 * WORLD_SCALE

/**
 * Floating revive marker spawned where a player went down in co-op mode.
 * The other player touches it to bring them back (see CoopManager).
 * Placeholder art: a pale circle that bobs up and down.
 */
export class Bubble {
  constructor(scene, x, y) {
    this.scene = scene
    this.spawnTime = scene.time.now
    this.circle = scene.add.circle(x, y, BUBBLE_RADIUS, 0xffffff, 0.85)
    this.circle.setStrokeStyle(2, 0xbfe6ff)
    scene.physics.add.existing(this.circle)
    this.circle.body.setAllowGravity(false)
    this.circle.body.setImmovable(true)

    this.artSprite = tryArtSprite(scene, x, y, MISC_ART.bubble, BUBBLE_RADIUS * 2, BUBBLE_RADIUS * 2)
    if (this.artSprite) this.circle.setVisible(false)
  }

  update(time) {
    if (this.baseY === undefined) this.baseY = this.circle.y
    const bobOffset = Math.sin((time - this.spawnTime) / 300) * BOB_AMPLITUDE_PX
    this.circle.y = this.baseY + bobOffset
    this.artSprite?.setPosition(this.circle.x, this.circle.y)
  }

  get x() {
    return this.circle.x
  }

  get y() {
    return this.circle.y
  }

  destroy() {
    this.circle.destroy()
    this.artSprite?.destroy()
  }
}
