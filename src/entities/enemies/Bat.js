import { Enemy } from '../Enemy.js'
import { WORLD_SCALE, TILE_SIZE } from '../../config/constants.js'
import { ENEMY_ART } from '../../config/assets.js'

const TRIGGER_RANGE_X = 6 * TILE_SIZE
const SWOOP_SPEED = 240 * WORLD_SCALE
const RETURN_SPEED = 150 * WORLD_SCALE
const COOLDOWN_MS = 2000
const EYE_GLOW_COLOR = 0xff4d4d
// 俯冲前兆：红眼抖动这么久之后才真正起飞（黑暗中的公平性规则，见 LEVELS2.md 2-2）
const TELEGRAPH_MS = 300

/**
 * 洞窟蝙蝠（2-2）——平时倒挂在悬点，玩家从下方靠近时俯冲扑向玩家当时的
 * 位置再飞回原位。可踩、可火球、侧碰伤人。红色眼点渲染在黑暗层之上
 * （depth 1001 > DarknessLayer 1000）：黑暗里可以看不清地形，但威胁必须可见。
 */
export class Bat extends Enemy {
  constructor(scene, x, y, opts) {
    super(scene, x, y, {
      speed: 0,
      color: 0x8a7fb5,
      width: 30 * WORLD_SCALE,
      height: 20 * WORLD_SCALE,
      art: ENEMY_ART.bat,
      ...opts,
    })
    this.body.setAllowGravity(false)
    this.body.setVelocity(0, 0)
    // Read by GameScene._loadEnemies AFTER enemyGroup.add — group membership
    // re-applies allowGravity=true as a group default (the same "group
    // defaults override on add" gotcha as moving platforms/items/fireballs),
    // which otherwise makes hanging bats slowly sink out of their perch.
    this.noGravity = true
    this.homeX = this.rect.x
    this.homeY = this.rect.y
    this.state = 'hang' // hang | telegraph | swoop | return
    this.stateUntil = 0
    this.cooldownUntil = 0
    this.targetX = 0
    this.targetY = 0

    // Red eye glow ABOVE the darkness layer — always visible.
    this.glowLeft = scene.add.circle(this.rect.x, this.rect.y, 2.5 * WORLD_SCALE, EYE_GLOW_COLOR).setDepth(1001)
    this.glowRight = scene.add.circle(this.rect.x, this.rect.y, 2.5 * WORLD_SCALE, EYE_GLOW_COLOR).setDepth(1001)
    this._face.push(this.glowLeft, this.glowRight)
    this._updateFace()
  }

  _updateFace() {
    super._updateFace()
    if (!this.glowLeft) return
    const { x, y, height } = this.rect
    const jitter = this.state === 'telegraph' ? Math.sin(this.scene.time.now / 25) * 2 * WORLD_SCALE : 0
    const spread = 5 * WORLD_SCALE
    this.glowLeft.setPosition(x - spread + jitter, y - height * 0.1)
    this.glowRight.setPosition(x + spread + jitter, y - height * 0.1)
  }

  _nearestActivePlayer() {
    const coop = this.scene.coop
    if (!coop) return null
    const candidates = [
      coop.p1Bubble ? null : coop.p1,
      coop.p2Joined && !coop.p2Bubble ? coop.p2 : null,
    ].filter(Boolean)
    let best = null
    for (const p of candidates) {
      if (!p.rect.visible) continue
      if (!best || Math.abs(p.rect.x - this.rect.x) < Math.abs(best.rect.x - this.rect.x)) best = p
    }
    return best
  }

  update(time = this.scene.time.now) {
    if (this.dead) return

    if (this.state === 'hang') {
      this.body.setVelocity(0, 0)
      if (time >= this.cooldownUntil) {
        const p = this._nearestActivePlayer()
        if (p && Math.abs(p.rect.x - this.rect.x) < TRIGGER_RANGE_X && p.rect.y > this.rect.y + TILE_SIZE) {
          this.state = 'telegraph'
          this.stateUntil = time + TELEGRAPH_MS
          this.targetX = p.rect.x
          this.targetY = p.rect.y
        }
      }
    } else if (this.state === 'telegraph') {
      this.body.setVelocity(0, 0)
      if (time >= this.stateUntil) {
        this.state = 'swoop'
        const dx = this.targetX - this.rect.x
        const dy = this.targetY - this.rect.y
        const len = Math.max(1, Math.hypot(dx, dy))
        this.body.setVelocity((dx / len) * SWOOP_SPEED, (dy / len) * SWOOP_SPEED)
      }
    } else if (this.state === 'swoop') {
      const arrived =
        Math.hypot(this.targetX - this.rect.x, this.targetY - this.rect.y) < 20 * WORLD_SCALE ||
        this.body.blocked.down || this.body.blocked.left || this.body.blocked.right
      if (arrived) this.state = 'return'
    } else if (this.state === 'return') {
      const dx = this.homeX - this.rect.x
      const dy = this.homeY - this.rect.y
      const len = Math.hypot(dx, dy)
      if (len < 10 * WORLD_SCALE) {
        this.rect.setPosition(this.homeX, this.homeY)
        this.body.reset(this.homeX, this.homeY)
        this.state = 'hang'
        this.cooldownUntil = time + COOLDOWN_MS
      } else {
        this.body.setVelocity((dx / len) * RETURN_SPEED, (dy / len) * RETURN_SPEED)
      }
    }
    this.direction = this.body.velocity.x < 0 ? -1 : 1
    this._updateFace()
  }
}
