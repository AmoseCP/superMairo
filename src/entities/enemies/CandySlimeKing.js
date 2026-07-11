import { Enemy } from '../Enemy.js'
import { WORLD_SCALE } from '../../config/constants.js'
import { ENEMY_ART } from '../../config/assets.js'

// Each phase kicks in once hp drops to/below its threshold — see LEVELS.md 1-5.
const PHASES = [
  { hpThreshold: 3, speed: 80 * WORLD_SCALE, attackInterval: 4000, telegraphMs: 800 },
  { hpThreshold: 2, speed: 110 * WORLD_SCALE, attackInterval: 3000, telegraphMs: 700 },
  { hpThreshold: 1, speed: 140 * WORLD_SCALE, attackInterval: 2200, telegraphMs: 600 },
]
const STUN_MS = 1500
const BASE_COLOR = 0xff6fae
const SLAM_HOP_VELOCITY = 220 * WORLD_SCALE

/**
 * 糖果史莱姆王 — takes 3 stomps to defeat, gets faster/more aggressive each
 * hit. Attacks are a telegraphed "slam" (brief hop + color flash before it
 * lands) rather than a projectile, keeping the Q-萌 tone (see PLAN.md art
 * direction) — no cheap hits, always a visible warning first.
 */
export class CandySlimeKing extends Enemy {
  constructor(scene, x, y, opts) {
    super(scene, x, y, {
      speed: PHASES[0].speed,
      color: BASE_COLOR,
      width: 48 * WORLD_SCALE,
      height: 44 * WORLD_SCALE,
      art: ENEMY_ART.candyslimeking,
      ...opts,
    })
    // A boss shouldn't be shovable — without this, a hard stomp (player
    // falling with real velocity) can shove its body down through the thin
    // ground in one collision-separation step (classic AABB tunneling).
    // Regular small enemies never got hit hard/fast enough to expose this.
    this.body.setImmovable(true)
    this.hp = 3
    this.stunnedUntil = -Infinity
    this.telegraphing = false
    this.nextAttackAt = scene.time.now + PHASES[0].attackInterval
  }

  get phase() {
    return PHASES.find((p) => this.hp >= p.hpThreshold) ?? PHASES[PHASES.length - 1]
  }

  /** Flashes either the procedural rect's fill or the real art sprite's tint — whichever is actually visible. */
  _setTint(color) {
    if (this.artSprite) this.artSprite.setTint(color)
    else this.rect.setFillStyle(color)
  }

  _clearTint() {
    if (this.artSprite) this.artSprite.clearTint()
    else this.rect.setFillStyle(BASE_COLOR)
  }

  update(time) {
    if (this.dead) return

    if (time < this.stunnedUntil) {
      this.body.setVelocityX(0)
      return
    }

    this.speed = this.phase.speed * this.speedMultiplier
    super.update()

    const phase = this.phase
    if (!this.telegraphing && time >= this.nextAttackAt - phase.telegraphMs) {
      this.telegraphing = true
      this._setTint(0xffffff)
    }
    if (time >= this.nextAttackAt) {
      this.telegraphing = false
      this._clearTint()
      this.nextAttackAt = time + phase.attackInterval
      if (this.body.onFloor()) this.body.setVelocityY(-SLAM_HOP_VELOCITY) // the "slam" hop
    }
  }

  onStomp() {
    if (this.dead) return
    this.hp -= 1
    if (this.hp <= 0) {
      this._squashAndDestroy()
      return
    }
    this.stunnedUntil = this.scene.time.now + STUN_MS
    // NOTE: don't use setScale() for the hit-reaction flash — Arcade Physics
    // re-syncs the body's size/position from the GameObject's transform
    // every frame (preUpdate -> updateFromGameObject), so scaling a
    // physics-linked shape actually shifts its collision box and can knock
    // it loose from the ground. A color/tint flash has no such side effect.
    this._setTint(0xffb3d9)
    this.scene.time.delayedCall(200, () => {
      if (!this.dead) this._clearTint()
    })
  }

  onSideTouch() {
    if (this.dead) return false
    return this.scene.time.now >= this.stunnedUntil
  }
}
