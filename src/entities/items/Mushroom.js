import { Item } from '../Item.js'
import { MUSHROOM_SPEED, WORLD_SCALE } from '../../config/constants.js'
import { ITEM_ART } from '../../config/assets.js'

/** Slides along the ground until touched; turns at walls (falling off ledges is fine). */
export class Mushroom extends Item {
  constructor(scene, x, y, opts) {
    super(scene, x, y, { color: 0xff6b6b, radius: 11 * WORLD_SCALE, allowGravity: true, art: ITEM_ART.mushroom, ...opts })
    this.type = 'mushroom'
    this.direction = 1
    this.body.setCollideWorldBounds(true)
    this.body.setVelocityX(this.direction * MUSHROOM_SPEED)
  }

  update() {
    if (this.dead) return
    if (this.body.blocked.left) this.direction = 1
    else if (this.body.blocked.right) this.direction = -1
    this.body.setVelocityX(this.direction * MUSHROOM_SPEED)
    this.artSprite?.setPosition(this.rect.x, this.rect.y)
  }
}
