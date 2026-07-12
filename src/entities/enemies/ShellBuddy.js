import { Enemy } from '../Enemy.js'
import { WORLD_SCALE } from '../../config/constants.js'
import { ENEMY_ART } from '../../config/assets.js'

const STATE = { WALK: 'walk', SHELL_IDLE: 'shell_idle', SHELL_MOVING: 'shell_moving' }
const DEFAULT_SHELL_SPEED = 220 * WORLD_SCALE
const STRIPE_COLOR = 0xffe8c2
const STRIPE_WIDTH = 22 * WORLD_SCALE
const STRIPE_HEIGHT = 4 * WORLD_SCALE

/**
 * 龟壳怪 — first stomp tucks it into an idle shell, a second stomp/touch
 * kicks the shell sliding (which can chain-kill other enemies), a stomp on
 * a moving shell stops it again. See LEVELS.md 1-2 "踢壳连锁教学点".
 * Shell gets candy-stripe accents (PLAN.md: "圆润龟壳配色改为糖果条纹") —
 * skipped once real art exists. If ENEMY_ART.shellbuddy_shell also exists,
 * the sprite swaps to it while tucked/kicked; otherwise it just keeps
 * showing the walking art (see ART.md).
 */
export class ShellBuddy extends Enemy {
  constructor(scene, x, y, opts) {
    super(scene, x, y, {
      speed: 45 * WORLD_SCALE,
      color: 0x5cc9d8,
      width: 26 * WORLD_SCALE,
      height: 24 * WORLD_SCALE,
      art: ENEMY_ART.shellbuddy,
      ...opts,
    })
    this.state = STATE.WALK
    // Instance field so subclasses (IceShell) can run a faster shell.
    this.shellSpeed = DEFAULT_SHELL_SPEED
    this._shellArtKey =
      this.artSprite && scene.textures.exists(ENEMY_ART.shellbuddy_shell.key) ? ENEMY_ART.shellbuddy_shell.key : null

    if (!this.artSprite) {
      this.stripeTop = scene.add.rectangle(x, y, STRIPE_WIDTH, STRIPE_HEIGHT, STRIPE_COLOR)
      this.stripeBottom = scene.add.rectangle(x, y, STRIPE_WIDTH, STRIPE_HEIGHT, STRIPE_COLOR)
      this._face.push(this.stripeTop, this.stripeBottom)
    }
    // Base Enemy's constructor already ran _updateFace() once before these
    // stripes existed (virtual dispatch resolves to this override even
    // mid-super-constructor) — run it again now that they're in place.
    this._updateFace()
  }

  _updateFace() {
    super._updateFace()
    if (this.artSprite) {
      if (this._shellArtKey) {
        const wantKey = this.state !== STATE.WALK ? this._shellArtKey : ENEMY_ART.shellbuddy.key
        if (this.artSprite.texture.key !== wantKey) this.artSprite.setTexture(wantKey)
      }
      return
    }
    if (!this.stripeTop) return
    const { x, y, height } = this.rect
    this.stripeTop.setPosition(x, y - height * 0.18)
    this.stripeBottom.setPosition(x, y + height * 0.22)
  }

  update() {
    if (this.dead) return
    if (this.state === STATE.WALK) {
      super.update()
      return
    }
    if (this.state === STATE.SHELL_MOVING) {
      if (this.body.blocked.left) this.direction = 1
      else if (this.body.blocked.right) this.direction = -1
      this.body.setVelocityX(this.direction * this.shellSpeed)
    }
    // SHELL_IDLE: sits still, no movement to apply.
    this._updateFace()
  }

  onStomp(player) {
    if (this.dead) return
    if (this.state === STATE.WALK) {
      this.state = STATE.SHELL_IDLE
      this.body.setVelocityX(0)
      // Only squash the procedural rect — real art switches to a dedicated
      // "tucked" texture instead (see _updateFace), so scaling it too would
      // double up the effect.
      if (!this.artSprite) this.rect.setScale(1, 0.75)
    } else if (this.state === STATE.SHELL_IDLE) {
      this._kick(player)
    } else if (this.state === STATE.SHELL_MOVING) {
      this.state = STATE.SHELL_IDLE
      this.body.setVelocityX(0)
    }
  }

  onSideTouch(player) {
    if (this.dead) return false
    if (this.state === STATE.WALK) return true
    if (this.state === STATE.SHELL_IDLE) {
      this._kick(player)
      return false
    }
    return true // SHELL_MOVING hits like a normal hazard
  }

  _kick(player) {
    this.state = STATE.SHELL_MOVING
    this.kickedBy = player // credits any later chain kill to whoever kicked it
    this.direction = player.rect.x < this.rect.x ? 1 : -1
    this.body.setVelocityX(this.direction * this.shellSpeed)
  }
}
