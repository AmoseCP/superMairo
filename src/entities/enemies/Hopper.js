import { Enemy } from '../Enemy.js'
import { WORLD_SCALE } from '../../config/constants.js'
import { ENEMY_ART } from '../../config/assets.js'

const IDLE_MS = 800
const TELEGRAPH_MS = 150
// Pre-scale (32px-tile) projectile derivation for a ~2-tile horizontal /
// 1.5-tile-high hop under this game's gravity — same method used for the
// standard jump and for Spring's velocities (v_y = sqrt(2·g·h), flight
// time = 2·v_y/g, v_x = distance/flightTime).
const HOP_VX = 113 * WORLD_SCALE
const HOP_VY = 339 * WORLD_SCALE
// Stomping a hopper mid-air is meant to feel forgiving (LEVELS3.md: "跳跃中
// 被踩判定放宽，鼓励空中拦截") — GameScene reads this instead of the global
// STOMP_TOLERANCE_PX whenever an enemy exposes it.
const AIRBORNE_STOMP_TOLERANCE_PX = 26 * WORLD_SCALE
const TELEGRAPH_TINT = 0xffffff
const BODY_COLOR = 0x6fd67a

/**
 * 弹跳史莱姆（3-1，LEVELS3.md）——地面待机 0.8s（含 0.15s 起跳前的白色
 * 闪烁预警）→ 朝最近玩家方向小跳（水平 2 格、高 1.5 格）→ 落地待机循环。
 * 可踩（空中拦截判定更宽松）、可火球；侧碰伤人。完全不复用 Enemy 基类的
 * 连续巡逻 update()——待机时是静止的，不是"慢速行走"。
 */
export class Hopper extends Enemy {
  constructor(scene, x, y, opts) {
    super(scene, x, y, {
      speed: 0,
      color: BODY_COLOR,
      width: 28 * WORLD_SCALE,
      height: 24 * WORLD_SCALE,
      art: ENEMY_ART.hopper,
      ...opts,
    })
    this.body.setVelocityX(0)
    this.state = 'idle' // idle | telegraph | hop
    this.stateUntil = this.scene.time.now + IDLE_MS
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

    if (this.state === 'hop') {
      // Landed — Arcade's onFloor() only reads true once gravity has pulled
      // it back onto solid ground after the launch impulse.
      if (this.body.onFloor()) {
        this.state = 'idle'
        this.stateUntil = time + IDLE_MS
        this.body.setVelocityX(0)
        this.stompTolerance = undefined
      }
      this._updateFace()
      return
    }

    if (time < this.stateUntil) {
      this._updateFace()
      return
    }

    if (this.state === 'idle') {
      this.state = 'telegraph'
      this.stateUntil = time + TELEGRAPH_MS
      if (this.artSprite) this.artSprite.setTint(TELEGRAPH_TINT)
      else this.rect.setFillStyle(TELEGRAPH_TINT)
    } else if (this.state === 'telegraph') {
      this.state = 'hop'
      this.stompTolerance = AIRBORNE_STOMP_TOLERANCE_PX
      if (this.artSprite) this.artSprite.clearTint()
      else this.rect.setFillStyle(BODY_COLOR)
      const target = this._nearestActivePlayer()
      this.direction = target && target.rect.x < this.rect.x ? -1 : 1
      this.body.setVelocity(this.direction * HOP_VX * this.speedMultiplier, -HOP_VY)
    }
    this._updateFace()
  }
}
