import { Item } from '../Item.js'
import { WORLD_SCALE } from '../../config/constants.js'
import { ITEM_ART } from '../../config/assets.js'

/** Sits still where it pops out — no movement, no gravity. */
export class FireFlower extends Item {
  constructor(scene, x, y, opts) {
    super(scene, x, y, { color: 0xff8c42, radius: 10 * WORLD_SCALE, allowGravity: false, art: ITEM_ART.fireflower, ...opts })
    this.type = 'fireflower'
  }
}
