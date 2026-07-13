import { WORLD_SCALE } from '../config/constants.js'
import { MISC_ART } from '../config/assets.js'
import { tryArtSprite } from '../utils/artSwap.js'

const RADIUS = 12 * WORLD_SCALE
const SPEED_X = 150 * WORLD_SCALE
// No explicit design number for the vertical component — a modest lob gives
// the "抛物线" arc the design calls for without needing precision tuning.
const LAUNCH_VY = -260 * WORLD_SCALE
const COLOR = 0x2d2d2d

/**
 * 炮塔炮弹（3-3，LEVELS3.md）——慢速抛物线弹，受重力，落地即碎，不追踪。
 * 火球对消、玩家碰到扣血，两者都是一次性的 overlap（不是 collider）：
 * 打完就 destroy，不需要参与任何分离逻辑。
 */
export class TurretShot {
  constructor(scene, x, y, direction = 1) {
    this.scene = scene
    this.dead = false
    this.artSprite = tryArtSprite(scene, x, y, MISC_ART.turretShot, RADIUS * 2, RADIUS * 2)
    this.circle = this.artSprite ?? scene.add.circle(x, y, RADIUS, COLOR)
    scene.physics.add.existing(this.circle)
    this.circle.body.setAllowGravity(true)
    this.circle.body.setCircle(RADIUS)
    this.circle.body.setVelocity(direction * SPEED_X, LAUNCH_VY)
    this.circle.setData('turretShotRef', this)
  }

  get rect() {
    return this.circle
  }

  destroy() {
    if (this.dead) return
    this.dead = true
    this.circle.destroy()
  }
}
