import { Item } from '../Item.js'
import { WORLD_SCALE } from '../../config/constants.js'
import { ITEM_ART } from '../../config/assets.js'

export class Coin extends Item {
  constructor(scene, x, y, opts) {
    super(scene, x, y, { color: 0xffd700, radius: 9 * WORLD_SCALE, allowGravity: false, art: ITEM_ART.coin, ...opts })
    this.type = 'coin'
  }
}
