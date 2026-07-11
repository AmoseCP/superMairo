import {
  COYOTE_TIME_MS,
  HIT_INVINCIBLE_MS,
  JUMP_BUFFER_MS,
  PLAYER_ACCEL,
  PLAYER_BIG_HEIGHT,
  PLAYER_JUMP_VELOCITY,
  PLAYER_RUN_SPEED,
  PLAYER_SMALL_HEIGHT,
  PLAYER_WALK_SPEED,
  STAR_INVINCIBLE_MS,
  WORLD_SCALE,
} from '../config/constants.js'
import { PLAYER_ART } from '../config/assets.js'
import { tryArtSprite } from '../utils/artSwap.js'

const SKIN_COLORS = {
  bunny: 0xff8fc7, // 跳跳兔 P1
  cat: 0xffd35c, // 喵喵猫 P2
}

const PLAYER_WIDTH = 28 * WORLD_SCALE
const RAINBOW_COLORS = [0xff5252, 0xffb142, 0xfff200, 0x4caf50, 0x2196f3, 0x9c27b0]

// Face layout, all measured as an offset from the TOP edge of the body rect
// (not its center) so the "head" stays put when the body grows small<->big.
const EYE_Y_FROM_TOP = 12 * WORLD_SCALE
const BLUSH_Y_FROM_TOP = 21 * WORLD_SCALE
const EYE_X_OFFSET = 6 * WORLD_SCALE
const BLUSH_X_OFFSET = 10 * WORLD_SCALE

// Ear/eye/pupil/blush shape sizes (all pixel magnitudes).
const CAT_EAR_TRI = [0, 10 * WORLD_SCALE, 5 * WORLD_SCALE, -6 * WORLD_SCALE, 10 * WORLD_SCALE, 10 * WORLD_SCALE]
const BUNNY_EAR_ELLIPSE_W = 7 * WORLD_SCALE
const BUNNY_EAR_ELLIPSE_H = 18 * WORLD_SCALE
const EAR_INSET = 3 * WORLD_SCALE
const EYE_RADIUS = 4 * WORLD_SCALE
const PUPIL_RADIUS = 2 * WORLD_SCALE
const BLUSH_RADIUS = 3.5 * WORLD_SCALE
const FACE_LEAN_PX = 1.5 * WORLD_SCALE

/**
 * Placeholder-art player entity: still just a colored rectangle body for
 * collision, but dressed up with ears/eyes/blush (Q版萌 direction — see
 * PLAN.md art section) so it reads as a cute critter instead of a plain box
 * while we wait on real sprites.
 */
export class Player {
  constructor(scene, x, y, { skin = 'bunny', inputManager, audioManager, onFireRequested } = {}) {
    this.scene = scene
    this.inputManager = inputManager
    this.audioManager = audioManager
    this.onFireRequested = onFireRequested
    this.skin = skin
    this.facing = 1
    this.wasOnFloor = true
    this.form = 'small' // 'small' | 'big' | 'fire'
    this.starUntil = 0
    this.hitInvincibleUntil = 0

    const color = SKIN_COLORS[skin] ?? SKIN_COLORS.bunny

    this.rect = scene.add.rectangle(x, y, PLAYER_WIDTH, PLAYER_SMALL_HEIGHT, color)
    scene.physics.add.existing(this.rect)
    this.body = this.rect.body
    this.body.setCollideWorldBounds(true)
    // Fall speed is capped so that even on a slow frame (physics now steps
    // with the real frame delta — see main.js fixedStep note) one step can't
    // move the body a full tile and tunnel through the ground.
    this.body.setMaxVelocity(PLAYER_RUN_SPEED, 900 * WORLD_SCALE)

    // Real art takes over the moment it exists (see ART.md) — the rect stays
    // as the physics body either way, just hidden once a sprite is drawing
    // on top of it, so hitboxes/jump-arc tuning are never affected by art.
    this.artSprite = tryArtSprite(scene, x, y, PLAYER_ART[skin], PLAYER_WIDTH, PLAYER_SMALL_HEIGHT)
    this._decorations = []

    if (this.artSprite) {
      this.rect.setVisible(false)
    } else {
      this.earLeft =
        skin === 'cat'
          ? scene.add.triangle(x, y, ...CAT_EAR_TRI, color)
          : scene.add.ellipse(x, y, BUNNY_EAR_ELLIPSE_W, BUNNY_EAR_ELLIPSE_H, color)
      this.earRight =
        skin === 'cat'
          ? scene.add.triangle(x, y, ...CAT_EAR_TRI, color)
          : scene.add.ellipse(x, y, BUNNY_EAR_ELLIPSE_W, BUNNY_EAR_ELLIPSE_H, color)

      this.eyeLeft = scene.add.circle(x, y, EYE_RADIUS, 0xffffff)
      this.eyeRight = scene.add.circle(x, y, EYE_RADIUS, 0xffffff)
      this.pupilLeft = scene.add.circle(x, y, PUPIL_RADIUS, 0x2d2d2d)
      this.pupilRight = scene.add.circle(x, y, PUPIL_RADIUS, 0x2d2d2d)
      this.blushLeft = scene.add.circle(x, y, BLUSH_RADIUS, 0xff9eb5, 0.7)
      this.blushRight = scene.add.circle(x, y, BLUSH_RADIUS, 0xff9eb5, 0.7)

      this._decorations = [
        this.earLeft,
        this.earRight,
        this.eyeLeft,
        this.eyeRight,
        this.pupilLeft,
        this.pupilRight,
        this.blushLeft,
        this.blushRight,
      ]
    }

    this.lastGroundedTime = -Infinity
    this.jumpPressedTime = -Infinity

    // Set by GameScene._applyPlatformCarry while standing on a moving
    // platform — counts as grounded for jump/coyote purposes, since the
    // glued ride keeps a small air gap that makes body.onFloor() flicker.
    this._ridingPlatform = null

    // Last position with solid ground underfoot — bubbles spawn here (not at
    // the fall position itself, which may be mid-air over the same hazard).
    this.lastSafeX = x
    this.lastSafeY = y

    this._updateFace()
  }

  isStarActive() {
    return this.scene.time.now < this.starUntil
  }

  isHitInvincible() {
    return this.scene.time.now < this.hitInvincibleUntil || this.isStarActive()
  }

  startStar() {
    this.starUntil = this.scene.time.now + STAR_INVINCIBLE_MS
  }

  grow() {
    if (this.form === 'small') this._setForm('big')
  }

  powerUpFire() {
    this._setForm('fire')
  }

  /** Enemy contact. Returns true if it should register as full damage (shared-life loss). */
  takeHit() {
    if (this.isHitInvincible()) return false
    if (this.form === 'fire') {
      this._setForm('big')
      this.hitInvincibleUntil = this.scene.time.now + HIT_INVINCIBLE_MS
      return false
    }
    if (this.form === 'big') {
      this._setForm('small')
      this.hitInvincibleUntil = this.scene.time.now + HIT_INVINCIBLE_MS
      return false
    }
    return true
  }

  /** Restores a form carried over from the previous level (see GameScene priorForms). */
  applyForm(form) {
    if (form === 'big' || form === 'fire') this._setForm(form)
  }

  _setForm(newForm) {
    if (this.form === newForm) return
    const oldHeight = this.rect.height
    const newHeight = newForm === 'small' ? PLAYER_SMALL_HEIGHT : PLAYER_BIG_HEIGHT
    const bottomY = this.rect.y + oldHeight / 2
    this.form = newForm
    this.rect.setSize(PLAYER_WIDTH, newHeight)
    this.rect.setY(bottomY - newHeight / 2)
    this.body.setSize(PLAYER_WIDTH, newHeight)
    this.body.updateFromGameObject()
  }

  /** Show/hide + enable/disable physics — used when bubbled or not yet joined (P2). */
  setActive(isActive) {
    this.rect.setVisible(isActive && !this.artSprite)
    this.artSprite?.setVisible(isActive)
    for (const part of this._decorations) part.setVisible(isActive)
    this.body.enable = isActive
  }

  teleportTo(x, y) {
    this.rect.setPosition(x, y)
    this.body.reset(x, y)
    this.wasOnFloor = true
    this.lastGroundedTime = -Infinity
    this.jumpPressedTime = -Infinity
    this._ridingPlatform = null
    this.lastSafeX = x
    this.lastSafeY = y
  }

  /** Only for an actual life loss (not bubble rescue) — small Mario always respawns small. */
  resetForm() {
    this._setForm('small')
    this.starUntil = 0
    this.hitInvincibleUntil = 0
  }

  /**
   * Brief post-respawn/rescue mercy window. Without it, an enemy patrolling
   * across the spawn/checkpoint kills the player again the very frame they
   * reappear — draining the whole shared-life pool in under a second.
   */
  grantSpawnProtection(ms) {
    this.hitInvincibleUntil = this.scene.time.now + ms
  }

  update(time, delta) {
    if (!this.inputManager) return
    this.inputManager.update()
    const input = this.inputManager.state

    // Riding a moving platform counts as grounded (see _ridingPlatform note),
    // but only genuinely-static footing updates the last-safe respawn spot —
    // a platform mid-cycle over a pit is not somewhere to bring anyone back.
    const onFloor = this.body.onFloor() || !!this._ridingPlatform
    if (this.body.onFloor()) {
      this.lastSafeX = this.rect.x
      this.lastSafeY = this.rect.y
    }
    if (onFloor) this.lastGroundedTime = time
    if (input.jumpDown) this.jumpPressedTime = time

    const withinCoyote = time - this.lastGroundedTime <= COYOTE_TIME_MS
    const withinBuffer = time - this.jumpPressedTime <= JUMP_BUFFER_MS
    if (withinCoyote && withinBuffer) {
      this.body.setVelocityY(-PLAYER_JUMP_VELOCITY)
      this.lastGroundedTime = -Infinity
      this.jumpPressedTime = -Infinity
      this.audioManager?.playJump()
    }

    if (onFloor && !this.wasOnFloor) {
      this.audioManager?.playLand()
    }
    this.wasOnFloor = onFloor

    const targetSpeed = input.run ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED
    let targetVelX = 0
    if (input.left) targetVelX = -targetSpeed
    if (input.right) targetVelX = targetSpeed

    const diff = targetVelX - this.body.velocity.x
    const maxChange = PLAYER_ACCEL * (delta / 1000)
    const newVelX =
      Math.abs(diff) <= maxChange ? targetVelX : this.body.velocity.x + Math.sign(diff) * maxChange
    this.body.setVelocityX(newVelX)

    if (targetVelX !== 0) this.facing = Math.sign(targetVelX)

    this._updateFace()

    if (input.actionDown && this.form === 'fire') {
      this.onFireRequested?.(this)
    }

    this._updateInvincibilityVisual(time)
  }

  /** Repositions ears/eyes/pupils/blush (or the real art sprite) relative to the current body rect. */
  _updateFace() {
    const { x, y, width, height } = this.rect

    if (this.artSprite) {
      this.artSprite.setPosition(x, y)
      this.artSprite.setFlipX(this.facing < 0)
      const scale = PLAYER_ART[this.skin]?.scale ?? 1
      this.artSprite.setDisplaySize(width * scale, height * scale)
      return
    }

    const topY = y - height / 2
    const earY = topY
    const eyeY = topY + EYE_Y_FROM_TOP
    const blushY = topY + BLUSH_Y_FROM_TOP
    const lean = this.facing * FACE_LEAN_PX // eyes/pupils nudge slightly toward facing direction

    this.earLeft.setPosition(x - width / 2 + EAR_INSET, earY)
    this.earRight.setPosition(x + width / 2 - EAR_INSET, earY)
    this.eyeLeft.setPosition(x - EYE_X_OFFSET + lean, eyeY)
    this.eyeRight.setPosition(x + EYE_X_OFFSET + lean, eyeY)
    this.pupilLeft.setPosition(x - EYE_X_OFFSET + lean * 1.8, eyeY)
    this.pupilRight.setPosition(x + EYE_X_OFFSET + lean * 1.8, eyeY)
    this.blushLeft.setPosition(x - BLUSH_X_OFFSET, blushY)
    this.blushRight.setPosition(x + BLUSH_X_OFFSET, blushY)
  }

  _updateInvincibilityVisual(time) {
    const skinShapes = this.artSprite ? [] : [this.rect, this.earLeft, this.earRight]
    if (this.isStarActive()) {
      const idx = Math.floor(time / 100) % RAINBOW_COLORS.length
      for (const shape of skinShapes) shape.setFillStyle(RAINBOW_COLORS[idx])
      this.artSprite?.setTint(RAINBOW_COLORS[idx])
      this._setDecorationsVisible(true)
      this.setPrimaryVisible(true)
    } else if (this.hitInvincibleUntil > time) {
      const visible = Math.floor(time / 80) % 2 === 0
      this.setPrimaryVisible(visible)
      this._setDecorationsVisible(visible)
    } else {
      const color = SKIN_COLORS[this.skin] ?? SKIN_COLORS.bunny
      for (const shape of skinShapes) shape.setFillStyle(color)
      this.artSprite?.clearTint()
      this.setPrimaryVisible(true)
      this._setDecorationsVisible(true)
    }
  }

  /** Toggles whichever of rect/artSprite is the actual visible body. */
  setPrimaryVisible(visible) {
    if (this.artSprite) this.artSprite.setVisible(visible)
    else this.rect.setVisible(visible)
  }

  _setDecorationsVisible(visible) {
    for (const part of this._decorations) part.setVisible(visible)
  }

  destroy() {
    this.rect.destroy()
    this.artSprite?.destroy()
    for (const part of this._decorations) part.destroy()
  }
}
