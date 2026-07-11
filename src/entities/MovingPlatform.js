import { WORLD_SCALE } from '../config/constants.js'
import { MISC_ART } from '../config/assets.js'
import { tryArtSprite } from '../utils/artSwap.js'

/**
 * Ping-pongs between its start position and start+range along one axis.
 * Moved via velocity so it still collides/pushes normally, but Arcade
 * Physics does NOT automatically carry a rider standing on top of a
 * velocity-driven immovable body — GameScene manually applies deltaX/deltaY
 * to whoever it detects standing on it each frame (see _applyPlatformCarry).
 */
export class MovingPlatform {
  constructor(
    scene,
    x,
    y,
    { width = 96 * WORLD_SCALE, height = 24 * WORLD_SCALE, rangeX = 0, rangeY = 0, speed = 60 * WORLD_SCALE } = {},
  ) {
    this.startX = x
    this.startY = y
    this.rangeX = rangeX
    this.rangeY = rangeY
    this.speed = speed
    this.direction = 1
    this.deltaX = 0
    this.deltaY = 0
    this.lastX = x
    this.lastY = y

    this.rect = scene.add.rectangle(x, y, width, height, 0xcfe9ff)
    this.rect.setStrokeStyle(2, 0x9fc9ee)
    scene.physics.add.existing(this.rect)
    this.body = this.rect.body
    this.body.setAllowGravity(false)
    this.body.setImmovable(true)

    // Widths vary a lot per instance (widthTiles * TILE_SIZE) — real art gets
    // stretched to fit whatever width this particular platform needs, so
    // draw something that reads fine stretched (a simple plank/cloud shape,
    // not fine detail) — see ART.md.
    this.artSprite = tryArtSprite(scene, x, y, MISC_ART.platform, width, height)
    if (this.artSprite) this.rect.setVisible(false)
  }

  update() {
    this.deltaX = this.rect.x - this.lastX
    this.deltaY = this.rect.y - this.lastY

    if (this.rangeX > 0) {
      if (this.rect.x >= this.startX + this.rangeX) this.direction = -1
      else if (this.rect.x <= this.startX) this.direction = 1
      this.body.setVelocityX(this.direction * this.speed)
    }
    if (this.rangeY > 0) {
      if (this.rect.y >= this.startY + this.rangeY) this.direction = -1
      else if (this.rect.y <= this.startY) this.direction = 1
      this.body.setVelocityY(this.direction * this.speed)
    }

    this.lastX = this.rect.x
    this.lastY = this.rect.y
    this.artSprite?.setPosition(this.rect.x, this.rect.y)
  }
}
