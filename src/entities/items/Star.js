import { Item } from '../Item.js'
import { STAR_SPEED, STAR_BOUNCE_VELOCITY, WORLD_SCALE } from '../../config/constants.js'
import { ITEM_ART } from '../../config/assets.js'

/** Bounces along the ground, turning at walls, until touched. */
export class Star extends Item {
  constructor(scene, x, y, opts) {
    super(scene, x, y, { color: 0xfff59d, radius: 10 * WORLD_SCALE, allowGravity: true, art: ITEM_ART.star, ...opts })
    this.type = 'star'
    this.direction = 1
    this.body.setCollideWorldBounds(true)
    this.body.setVelocityX(this.direction * STAR_SPEED)
    this.body.setVelocityY(-STAR_BOUNCE_VELOCITY)
  }

  update() {
    if (this.dead) return
    if (this.body.blocked.left) this.direction = 1
    else if (this.body.blocked.right) this.direction = -1
    this.body.setVelocityX(this.direction * STAR_SPEED)
    if (this.body.onFloor()) {
      this.body.setVelocityY(-STAR_BOUNCE_VELOCITY)
    }
    this.artSprite?.setPosition(this.rect.x, this.rect.y)
  }
}
