import { Item } from '../Item.js'
import { WORLD_SCALE } from '../../config/constants.js'
import { ITEM_ART } from '../../config/assets.js'

/**
 * 萤火提灯（2-2）——拾取后一段时间内该玩家的光圈半径放大（见 GameScene
 * 的 darkness 光源结算与 LANTERN_DURATION_MS）。原地悬浮，无重力。
 */
export class Lantern extends Item {
  constructor(scene, x, y, opts) {
    super(scene, x, y, { color: 0xd7ff8a, radius: 10 * WORLD_SCALE, allowGravity: false, art: ITEM_ART.lantern, ...opts })
    this.type = 'lantern'
    // Self-glow pulse so it's findable in the dark even outside any light circle.
    this.rect.setDepth(1001)
    scene.tweens.add({ targets: this.rect, alpha: 0.55, duration: 600, yoyo: true, repeat: -1 })
  }
}
