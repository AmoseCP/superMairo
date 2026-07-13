import { TILE_SIZE, WORLD_SCALE } from '../config/constants.js'
import { MISC_ART } from '../config/assets.js'
import { tryArtSprite } from '../utils/artSwap.js'

const PALETTE = {
  red: { key: 'switchBlockRed', fill: 0xd1453b, stroke: 0xff8a80 },
  blue: { key: 'switchBlockBlue', fill: 0x3b7dd1, stroke: 0x8ab4ff },
}
const GHOST_ALPHA = 0.28
const STROKE_PX = 2 * WORLD_SCALE

/**
 * 红蓝切换方块（3-2，LEVELS3.md）——scene.activeColor 决定哪一色实心；
 * 非激活色 body.enable=false，但轮廓保持可见（半透明，不整体隐藏——玩家
 * 要能预判翻转后的地形）。
 *
 * 防压死规则：`sync()` 每帧被 GameScene._updateSwitchBlocks 调用。翻到
 * "该虚化" 总是立即执行（虚化不会压到任何人）；翻到"该实心"则先检查是否
 * 仍有玩家和方块重叠——重叠就保持虚化，直到玩家离开的某一帧才真正实心
 * 化。这就是"逐块延迟实心化"，同 CrumblePlatform 等玩家让开才重生的
 * 套路，而不是取消这次翻转。
 */
export class SwitchBlock {
  constructor(scene, { x, y, widthTiles = 1, color, tileSize = TILE_SIZE }) {
    this.scene = scene
    this.color = color
    const palette = PALETTE[color] ?? PALETTE.red
    const width = widthTiles * tileSize
    const cx = x * tileSize + width / 2
    const cy = y * tileSize + tileSize / 2

    this.artSprite = tryArtSprite(scene, cx, cy, MISC_ART[palette.key], width, tileSize)
    this.rect = scene.add.rectangle(cx, cy, width, tileSize, palette.fill)
    this.rect.setStrokeStyle(STROKE_PX, palette.stroke)
    if (this.artSprite) this.rect.setVisible(false)
    scene.physics.add.existing(this.rect, true)

    this.solid = false
    this._setSolid(false)
  }

  _overlapsAny(players) {
    const b = this.rect.getBounds()
    return players.some((p) => {
      if (!p.rect.visible) return false
      const pb = p.rect.getBounds()
      return pb.right > b.left && pb.left < b.right && pb.bottom > b.top && pb.top < b.bottom
    })
  }

  _setSolid(solid) {
    this.solid = solid
    this.rect.body.enable = solid
    this.rect.setFillStyle(this.rect.fillColor, solid ? 1 : GHOST_ALPHA)
    this.artSprite?.setAlpha(solid ? 1 : GHOST_ALPHA)
  }

  /** Call every frame with the current global color + the players who might be standing in the way. */
  sync(activeColor, players) {
    const shouldBeSolid = this.color === activeColor
    if (shouldBeSolid === this.solid) return
    if (!shouldBeSolid || !this._overlapsAny(players)) this._setSolid(shouldBeSolid)
  }
}
