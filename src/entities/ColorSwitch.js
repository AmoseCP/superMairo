import { TILE_SIZE, WORLD_SCALE } from '../config/constants.js'
import { MISC_ART } from '../config/assets.js'
import { tryArtSprite } from '../utils/artSwap.js'

const WIDTH = 28 * WORLD_SCALE
const HEIGHT = 8 * WORLD_SCALE
const OCCUPY_X_PX = 20 * WORLD_SCALE
const OCCUPY_Y_PX = 26 * WORLD_SCALE
const COOLDOWN_MS = 500
const TINT = { red: 0xd1453b, blue: 0x3b7dd1 }

/**
 * 红蓝切换开关（3-2，LEVELS3.md）——地面按钮，任意玩家踩一下/顶一下
 * 即让 GameScene 全场翻转 activeColor；冷却 0.5s 防止长踩连发。复用
 * DualSwitchChest 的"switch_plate"占位美术+同款距离判定（同为"踩一下就
 * 触发"的地面机关，没必要另画一套图）。
 */
export class ColorSwitch {
  constructor(scene, { x, y, tileSize = TILE_SIZE, forceColor = null }) {
    this.scene = scene
    this.x = x * tileSize + tileSize / 2
    // `y` is the row whose TOP edge is the floor surface it stands on (same
    // convention as groundSpans/platforms tileY and Spring's groundTileY) —
    // the button sits just above that line, not centered inside the row.
    this.y = y * tileSize - HEIGHT / 2
    this.cooldownUntil = 0
    // Optional: instead of toggling, always set activeColor to this value —
    // used where an earlier stretch of optional switches leaves the color
    // genuinely unpredictable by the time the player reaches this one.
    this.forceColor = forceColor

    this.artSprite = tryArtSprite(scene, this.x, this.y, MISC_ART.switchPlate, WIDTH, HEIGHT)
    this.rect = this.artSprite ?? scene.add.rectangle(this.x, this.y, WIDTH, HEIGHT, 0xdddddd)
    this._lastTint = null
  }

  _applyTint(activeColor) {
    if (this._lastTint === activeColor) return
    this._lastTint = activeColor
    const color = TINT[activeColor] ?? TINT.red
    if (this.artSprite) this.artSprite.setTint(color)
    else this.rect.setFillStyle(color)
  }

  /** Returns true the instant it fires — caller (GameScene) flips the global color + plays fx. */
  update(time, playerRects, activeColor) {
    this._applyTint(activeColor)
    if (time < this.cooldownUntil) return false
    const occupied = playerRects.some(
      (r) => Math.abs(r.x - this.x) < OCCUPY_X_PX && Math.abs(r.y + r.height / 2 - this.y) < OCCUPY_Y_PX,
    )
    if (!occupied) return false
    this.cooldownUntil = time + COOLDOWN_MS
    return true
  }
}
