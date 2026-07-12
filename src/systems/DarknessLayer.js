import Phaser from 'phaser'
import { TILE_SIZE } from '../config/constants.js'

const LIGHT_TEXTURE_KEY = 'light_spot'
const LIGHT_TEXTURE_SIZE = 256
// Darkness ramps in/out over this many tiles at the zone's edges so walking
// into a dark section is a dusk transition, not a hard cut to black.
const EDGE_RAMP_TILES = 4

/**
 * 黑暗+光圈系统（2-2，LEVELS2.md）——全屏 RenderTexture 铺黑，每帧对每个
 * 光源 erase 一张径向渐变光斑。光源列表由 GameScene 每帧传入（玩家/提灯
 * 加成/泡泡）。`fromTile`/`toTile` 可选，用于"关卡局部黑暗"（2-5 暗室段），
 * 有效黑度按镜头中心与区间边缘的距离渐变。
 */
export class DarknessLayer {
  constructor(scene, { alpha = 0.92, lightRadiusTiles = 4.5, fromTile, toTile } = {}) {
    this.scene = scene
    this.maxAlpha = alpha
    this.baseRadius = lightRadiusTiles * TILE_SIZE
    this.left = fromTile !== undefined ? fromTile * TILE_SIZE : -Infinity
    this.right = toTile !== undefined ? toTile * TILE_SIZE : Infinity

    if (!scene.textures.exists(LIGHT_TEXTURE_KEY)) {
      const canvas = scene.textures.createCanvas(LIGHT_TEXTURE_KEY, LIGHT_TEXTURE_SIZE, LIGHT_TEXTURE_SIZE)
      const ctx = canvas.getContext()
      const half = LIGHT_TEXTURE_SIZE / 2
      const grad = ctx.createRadialGradient(half, half, 0, half, half, half)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(0.55, 'rgba(255,255,255,0.9)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, LIGHT_TEXTURE_SIZE, LIGHT_TEXTURE_SIZE)
      canvas.refresh()
    }

    this.rt = scene.add
      .renderTexture(0, 0, scene.scale.width, scene.scale.height)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(1000)
    // Off-list stamp object reused for every erase call (never displayed).
    this.spot = scene.make.image({ key: LIGHT_TEXTURE_KEY, add: false }).setOrigin(0.5)

    this._onResize = (gameSize) => this.rt.setSize(gameSize.width, gameSize.height)
    scene.scale.on('resize', this._onResize)
    scene.events.once('shutdown', () => this.destroy())
  }

  /** `lights`: [{x, y, radius}] in WORLD coordinates. Call once per frame. */
  update(lights) {
    const cam = this.scene.cameras.main
    // Local-darkness ramp: full black deep inside [left, right], fading at edges.
    const cx = cam.scrollX + cam.width / 2
    const ramp = EDGE_RAMP_TILES * TILE_SIZE
    const depthIn = Math.min(cx - this.left, this.right - cx)
    const alpha = this.maxAlpha * Phaser.Math.Clamp((depthIn + ramp) / ramp, 0, 1)

    this.rt.clear()
    if (alpha <= 0.01) return
    this.rt.fill(0x000000, alpha)
    for (const l of lights) {
      this.spot.setDisplaySize(l.radius * 2, l.radius * 2)
      this.rt.erase(this.spot, l.x - cam.scrollX, l.y - cam.scrollY)
    }
  }

  destroy() {
    this.scene.scale.off('resize', this._onResize)
    this.rt.destroy()
    this.spot.destroy()
  }
}
