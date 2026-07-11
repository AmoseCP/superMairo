import { WORLD_SCALE } from '../config/constants.js'
import { tryArtSprite } from '../utils/artSwap.js'

const EYE_RADIUS = 3 * WORLD_SCALE
const PUPIL_RADIUS = 1.5 * WORLD_SCALE
const EYE_Y_CAP_PX = 8 * WORLD_SCALE
const FACE_LEAN_PX = 1 * WORLD_SCALE
const GROUND_PROBE_X_PX = 4 * WORLD_SCALE
const GROUND_PROBE_Y_PX = 6 * WORLD_SCALE
// Per-instance speed variance so same-type enemies don't all move in lockstep.
const SPEED_VARIANCE_MIN = 0.85
const SPEED_VARIANCE_RANGE = 0.3

/**
 * Base patrol enemy: walks back and forth, turns around at walls and at
 * platform edges (checked via a small ground-ahead probe against the level's
 * static ground group). Subclasses (Mochi, ShellBuddy) override onStomp /
 * onSideTouch / onHitByShell for their specific reactions.
 *
 * Draws a simple pair of eyes (Q版萌 direction, see PLAN.md) that track
 * facing direction as a placeholder — unless `art` (see config/assets.js)
 * points at a real image that exists, in which case that's used instead
 * and the procedural eyes are skipped entirely. See ART.md.
 */
export class Enemy {
  constructor(
    scene,
    x,
    y,
    {
      speed = 50 * WORLD_SCALE,
      color = 0xcc8844,
      width = 26 * WORLD_SCALE,
      height = 24 * WORLD_SCALE,
      groundGroup,
      art = null,
    },
  ) {
    this.scene = scene
    this.groundGroup = groundGroup
    // Randomized per instance so same-type enemies don't all pace back and
    // forth in perfect unison — makes patrols feel varied even when several
    // of the same enemy share a level (see PLAN.md Phase 10 notes).
    this.direction = Math.random() < 0.5 ? -1 : 1
    this.speedMultiplier = SPEED_VARIANCE_MIN + Math.random() * SPEED_VARIANCE_RANGE
    this.dead = false

    this.rect = scene.add.rectangle(x, y, width, height, color)
    scene.physics.add.existing(this.rect)
    this.rect.setData('enemyRef', this)
    this.body = this.rect.body
    this.body.setCollideWorldBounds(true)
    this.speed = speed * this.speedMultiplier
    this.body.setVelocityX(this.direction * this.speed)

    // Real art takes over the moment it exists — rect stays as the physics
    // body regardless, just hidden once a sprite draws on top of it.
    this.art = art
    this.artSprite = tryArtSprite(scene, x, y, art, width, height)
    this._face = []

    if (this.artSprite) {
      this.rect.setVisible(false)
    } else {
      this.eyeLeft = scene.add.circle(x, y, EYE_RADIUS, 0xffffff)
      this.eyeRight = scene.add.circle(x, y, EYE_RADIUS, 0xffffff)
      this.pupilLeft = scene.add.circle(x, y, PUPIL_RADIUS, 0x2d2d2d)
      this.pupilRight = scene.add.circle(x, y, PUPIL_RADIUS, 0x2d2d2d)
      this._face = [this.eyeLeft, this.eyeRight, this.pupilLeft, this.pupilRight]
    }
    this._updateFace()
  }

  update() {
    if (this.dead) return
    if (this.body.blocked.left) this.direction = 1
    else if (this.body.blocked.right) this.direction = -1
    // Only make ledge-turn decisions while actually standing on solid ground —
    // checked here regardless of onFloor(), this fired spuriously on every
    // single airborne frame (falling after spawn, knocked up, etc.), which
    // showed up as the direction flip-flopping every frame while in the air
    // and settling on whatever direction happened to "win" right as the enemy
    // landed — effectively a coin flip, unrelated to any real ledge. Gating
    // on onFloor() makes the turn-before-you-fall check only ever run while
    // there's solid ground to actually turn around on.
    else if (this.body.onFloor() && !this._hasGroundAhead()) this.direction *= -1

    this.body.setVelocityX(this.direction * this.speed)
    this._updateFace()
  }

  _updateFace() {
    const { x, y, width, height } = this.rect

    if (this.artSprite) {
      this.artSprite.setPosition(x, y)
      this.artSprite.setFlipX(this.direction < 0)
      const scale = this.art?.scale ?? 1
      this.artSprite.setDisplaySize(width * scale, height * scale)
      return
    }

    const eyeY = y - height / 2 + Math.min(EYE_Y_CAP_PX, height * 0.35)
    const spread = Math.max(4 * WORLD_SCALE, width * 0.22)
    const lean = this.direction * FACE_LEAN_PX
    this.eyeLeft.setPosition(x - spread, eyeY)
    this.eyeRight.setPosition(x + spread, eyeY)
    this.pupilLeft.setPosition(x - spread + lean, eyeY)
    this.pupilRight.setPosition(x + spread + lean, eyeY)
  }

  _hasGroundAhead() {
    const checkX = this.rect.x + this.direction * (this.rect.width / 2 + GROUND_PROBE_X_PX)
    const checkY = this.rect.y + this.rect.height / 2 + GROUND_PROBE_Y_PX
    for (const child of this.groundGroup.getChildren()) {
      const b = child.getBounds()
      if (checkX >= b.left && checkX <= b.right && checkY >= b.top && checkY <= b.bottom) return true
    }
    return false
  }

  /** Player landed on top. Default: a plain squash-kill. */
  onStomp() {
    this._squashAndDestroy()
  }

  /** Player touched from the side. Return true if it should damage the player. */
  onSideTouch() {
    return !this.dead
  }

  /** Hit by a sliding shell (see ShellBuddy). Default: dies instantly. */
  onHitByShell() {
    if (this.dead) return
    this.dead = true
    this.body.enable = false
    this.rect.destroy()
    this.artSprite?.destroy()
    for (const part of this._face) part.destroy()
  }

  _squashAndDestroy() {
    if (this.dead) return
    this.dead = true
    this.body.setVelocity(0, 0)
    this.body.enable = false
    // setScale() on a physics-linked GameObject would desync its collision
    // body (Arcade re-syncs body size/position from the transform every
    // frame) — harmless here since the body is already disabled, but the
    // art sprite has no physics component at all, so it's always safe to
    // squash directly regardless.
    this.rect.setScale(1, 0.3)
    this.artSprite?.setScale(this.artSprite.scaleX, this.artSprite.scaleY * 0.3)
    for (const part of this._face) part.setVisible(false)
    this.scene.time.delayedCall(200, () => {
      this.rect.destroy()
      this.artSprite?.destroy()
      for (const part of this._face) part.destroy()
    })
  }
}
