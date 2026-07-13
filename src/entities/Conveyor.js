import { TILE_SIZE, WORLD_SCALE } from '../config/constants.js'
import { MISC_ART } from '../config/assets.js'

const BELT_TEXTURE_KEY = 'belt_tex'
const BELT_THICKNESS = 10 * WORLD_SCALE
const BELT_COLOR_A = '#3d424d'
const BELT_COLOR_B = '#7c828f'

/**
 * 传送带（2-3，LEVELS2.md）——铺在既有地面顶面上的"动力表面"：范围内站立
 * 的实体每帧被附加 dir*speed 的位移（吸附式，由 GameScene._applyConveyors
 * 统一结算，优先级：平台吸附 > 传送带 > 冰）。本类只负责数据 + 滚动纹理。
 */
export class Conveyor {
  constructor(scene, { fromTile, toTile, tileY, speed = 60, dir = 1 }) {
    this.scene = scene
    this.left = fromTile * TILE_SIZE
    this.right = toTile * TILE_SIZE
    this.top = tileY * TILE_SIZE
    this.dir = dir
    this.speed = speed * WORLD_SCALE

    // Real belt art (MISC_ART.belt, tiles horizontally like ground_tile)
    // takes over when present; otherwise generate the chevron placeholder.
    let texKey = MISC_ART.belt.key
    if (!scene.textures.exists(texKey)) {
      texKey = BELT_TEXTURE_KEY
      if (!scene.textures.exists(BELT_TEXTURE_KEY)) {
        const size = 32
        const canvas = scene.textures.createCanvas(BELT_TEXTURE_KEY, size, 16)
        const ctx = canvas.getContext()
        ctx.fillStyle = BELT_COLOR_A
        ctx.fillRect(0, 0, size, 16)
        ctx.strokeStyle = BELT_COLOR_B
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(4, 13)
        ctx.lineTo(16, 3)
        ctx.lineTo(28, 13)
        ctx.stroke()
        canvas.refresh()
      }
    }
    const width = this.right - this.left
    this.textureKey = texKey // which art was picked (TileSprite wraps it in an internal UUID key)
    this.strip = scene.add
      .tileSprite((this.left + this.right) / 2, this.top + BELT_THICKNESS / 2, width, BELT_THICKNESS, texKey)
      .setDepth(1)
    // Fit the source texture's height to the strip so any art height works;
    // scrolling is then done in texture-space pixels.
    const srcHeight = scene.textures.get(texKey).getSourceImage().height
    this._tileScale = BELT_THICKNESS / srcHeight
    this.strip.setTileScale(this._tileScale)
  }

  /** Scroll the belt texture with the belt's motion (paused = frozen). */
  update(delta, paused) {
    if (paused) return
    this.strip.tilePositionX += (this.dir * this.speed * delta) / 1000 / this._tileScale
  }
}
