import { WORLD_SCALE } from '../config/constants.js'
import { MISC_ART } from '../config/assets.js'
import { tryArtSprite } from '../utils/artSwap.js'

const TRAP_WIDTH = 40 * WORLD_SCALE
const TRAP_HEIGHT = 36 * WORLD_SCALE
const TRAP_COLOR = 0x8a8f99
const SEAM_COLOR = 0x4a4e55
const SEAM_HEIGHT = 6 * WORLD_SCALE

const HIDDEN_MS = 1800
const RISE_MS = 450
const EXTENDED_MS = 1400

/**
 * The "夹子" (mechanical clamp) some pipes hide — cycles hidden (tucked
 * inside the pipe, harmless) → rising → extended (sitting above the pipe
 * mouth, dangerous on touch) → retracting → hidden, on a loop. Deliberately
 * NOT a character (no face) — it's a trap, not an enemy, matching the
 * user's "夹子" description rather than a classic Piranha Plant.
 */
export class PipeTrap {
  // phaseOffsetMs staggers this trap's cycle relative to others created at the
  // same time, so a level can put two traps near each other and have them pop
  // out of sync (a weaving gauntlet) instead of moving in perfect lockstep.
  constructor(scene, x, mouthY, phaseOffsetMs = 0) {
    this.scene = scene
    this.x = x
    this.mouthY = mouthY
    this.hiddenY = mouthY + TRAP_HEIGHT * 0.55
    this.extendedY = mouthY - TRAP_HEIGHT * 0.3
    this.state = 'hidden'
    this.stateUntil = scene.time.now + HIDDEN_MS + phaseOffsetMs

    this.artSprite = tryArtSprite(scene, x, this.hiddenY, MISC_ART.pipeTrap, TRAP_WIDTH, TRAP_HEIGHT)
    if (!this.artSprite) {
      this.body = scene.add.ellipse(x, this.hiddenY, TRAP_WIDTH, TRAP_HEIGHT, TRAP_COLOR)
      this.body.setStrokeStyle(3, SEAM_COLOR)
      this.seam = scene.add.rectangle(x, this.hiddenY, TRAP_WIDTH * 0.8, SEAM_HEIGHT, SEAM_COLOR)
    }
    this._setVisible(false)
  }

  get parts() {
    return this.artSprite ? [this.artSprite] : [this.body, this.seam]
  }

  /** True only while actually up and out of the pipe — the only time it can hurt the player. */
  get isDangerous() {
    return this.state === 'extended' || this.state === 'rising' || this.state === 'retracting'
  }

  /** Current world-space hazard box, for GameScene's manual overlap check. */
  getBounds() {
    const y = this._currentY()
    return { left: this.x - TRAP_WIDTH / 2, right: this.x + TRAP_WIDTH / 2, top: y - TRAP_HEIGHT / 2, bottom: y + TRAP_HEIGHT / 2 }
  }

  _currentY() {
    return this.artSprite ? this.artSprite.y : this.body.y
  }

  _setY(y) {
    for (const part of this.parts) part.setPosition(this.x, y)
  }

  _setVisible(visible) {
    for (const part of this.parts) part.setVisible(visible)
  }

  update(time) {
    if (time < this.stateUntil) return

    if (this.state === 'hidden') {
      this.state = 'rising'
      this._setVisible(true)
      this.stateUntil = time + RISE_MS
      this.scene.tweens.add({ targets: this.parts, y: this.extendedY, duration: RISE_MS, ease: 'Sine.easeOut' })
    } else if (this.state === 'rising') {
      this.state = 'extended'
      this.stateUntil = time + EXTENDED_MS
    } else if (this.state === 'extended') {
      this.state = 'retracting'
      this.stateUntil = time + RISE_MS
      this.scene.tweens.add({ targets: this.parts, y: this.hiddenY, duration: RISE_MS, ease: 'Sine.easeIn' })
    } else if (this.state === 'retracting') {
      this.state = 'hidden'
      this._setVisible(false)
      this.stateUntil = time + HIDDEN_MS
    }
  }
}
