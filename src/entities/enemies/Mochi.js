import { Enemy } from '../Enemy.js'
import { WORLD_SCALE } from '../../config/constants.js'
import { ENEMY_ART } from '../../config/assets.js'

const BOW_COLOR = 0xff5c8a
const BOW_TRI_X = 7 * WORLD_SCALE
const BOW_TRI_Y = 4 * WORLD_SCALE
const BOW_KNOT_RADIUS = 2.5 * WORLD_SCALE
const BOW_Y_OFFSET = 2 * WORLD_SCALE
const BOW_X_OFFSET = 3 * WORLD_SCALE

/**
 * 团子怪 — plain patrol enemy, squashes flat on stomp (see LEVELS.md).
 * Wears a little bow on top (PLAN.md art direction: "头顶蝴蝶结/触角装饰")
 * to read as a cute团子 rather than a plain box.
 */
export class Mochi extends Enemy {
  constructor(scene, x, y, opts) {
    super(scene, x, y, {
      speed: 50 * WORLD_SCALE,
      color: 0xd8a15c,
      width: 26 * WORLD_SCALE,
      height: 22 * WORLD_SCALE,
      art: ENEMY_ART.mochi,
      ...opts,
    })

    if (!this.artSprite) {
      this.bowLeft = scene.add.triangle(x, y, 0, 0, BOW_TRI_X, -BOW_TRI_Y, BOW_TRI_X, BOW_TRI_Y, BOW_COLOR)
      this.bowRight = scene.add.triangle(x, y, 0, 0, -BOW_TRI_X, -BOW_TRI_Y, -BOW_TRI_X, BOW_TRI_Y, BOW_COLOR)
      this.bowKnot = scene.add.circle(x, y, BOW_KNOT_RADIUS, BOW_COLOR)
      this._face.push(this.bowLeft, this.bowRight, this.bowKnot)
    }
    // Base Enemy's constructor already called _updateFace() once before these
    // bow parts existed (virtual dispatch resolves to this override even
    // mid-super-constructor) — run it again now that they're in place.
    this._updateFace()
  }

  _updateFace() {
    super._updateFace()
    if (!this.bowLeft) return
    const { x, y, width, height } = this.rect
    const bowY = y - height / 2 - BOW_Y_OFFSET
    this.bowLeft.setPosition(x - BOW_X_OFFSET, bowY)
    this.bowRight.setPosition(x + BOW_X_OFFSET, bowY)
    this.bowKnot.setPosition(x, bowY)
  }
}
