import { Enemy } from '../Enemy.js'
import { WORLD_SCALE } from '../../config/constants.js'
import { ENEMY_ART } from '../../config/assets.js'

const TOOTH_SIZE = 5 * WORLD_SCALE
const TOOTH_COLOR = 0x5b6069

/**
 * 发条齿轮怪（2-3，LEVELS2.md）——Mochi 的工厂变体：巡逻速度 2×（100
 * 设计值），铁灰配色，头顶两颗方齿装饰。可踩、可火球；在传送带上会被
 * 带子叠加位移（GameScene._applyConveyors 对敌人同样生效），关卡用它做
 * "乘带冲脸"的桥段。
 */
export class GearMochi extends Enemy {
  constructor(scene, x, y, opts) {
    super(scene, x, y, {
      speed: 100 * WORLD_SCALE,
      color: 0x9aa3ad,
      width: 26 * WORLD_SCALE,
      height: 22 * WORLD_SCALE,
      art: ENEMY_ART.gearmochi,
      ...opts,
    })
    if (!this.artSprite) {
      this.toothLeft = scene.add.rectangle(x, y, TOOTH_SIZE, TOOTH_SIZE, TOOTH_COLOR)
      this.toothRight = scene.add.rectangle(x, y, TOOTH_SIZE, TOOTH_SIZE, TOOTH_COLOR)
      this._face.push(this.toothLeft, this.toothRight)
    }
    this._updateFace()
  }

  _updateFace() {
    super._updateFace()
    if (!this.toothLeft) return
    const { x, y, height } = this.rect
    const topY = y - height / 2 - TOOTH_SIZE / 2
    this.toothLeft.setPosition(x - 6 * WORLD_SCALE, topY)
    this.toothRight.setPosition(x + 6 * WORLD_SCALE, topY)
  }
}
