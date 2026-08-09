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
    // 用 ?? 而不是 `!== undefined`：后者放 null 通过，null*96 = 0 会把黑暗区间
    // 反转成空集，整关黑暗静默失效（真出过一次，见 tools/space-out-pipes.mjs
    // 里那段注释）。缺省语义是"没有边界"。
    this.left = Number.isFinite(fromTile) ? fromTile * TILE_SIZE : -Infinity
    this.right = Number.isFinite(toTile) ? toTile * TILE_SIZE : Infinity

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

    // 屏幕空间（scrollFactor 0）——**不能**改成世界空间跟随 worldView：
    // worldView 要到渲染阶段才刷新，覆盖层就永远慢镜头一帧。平时只差十几像素，
    // 但复活/管道传送后镜头是大跨度追赶，实测有 436px 的亮边漏出来。钉在屏幕上
    // 则天然零延迟。
    //
    // 代价是要自己抵消相机缩放（GameScene 在小屏上会 zoom<1）：RT 按
    // "屏幕尺寸 ÷ zoom" 做大，再摆到屏幕左上角对应的位置，渲染时乘回 zoom
    // 正好铺满一屏。
    this.rt = scene.add
      .renderTexture(0, 0, scene.scale.width, scene.scale.height)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(1000)
    // Off-list stamp object reused for every erase call (never displayed).
    this.spot = scene.make.image({ key: LIGHT_TEXTURE_KEY, add: false }).setOrigin(0.5)

    scene.events.once('shutdown', () => this.destroy())
  }

  /** `lights`: [{x, y, radius}] in WORLD coordinates. Call once per frame. */
  update(lights) {
    const cam = this.scene.cameras.main
    const z = cam.zoom
    // RT 以"世界单位"计量：做成一屏那么大 ÷ zoom，渲染时乘回 zoom 铺满屏幕。
    const w = cam.width / z
    const h = cam.height / z
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h)
    const origin = this.scene.screenToUi?.(0, 0) ?? { x: 0, y: 0 }
    this.rt.setPosition(origin.x, origin.y)

    const view = cam.worldView
    // Local-darkness ramp: full black deep inside [left, right], fading at edges.
    const cx = view.centerX
    const ramp = EDGE_RAMP_TILES * TILE_SIZE
    const depthIn = Math.min(cx - this.left, this.right - cx)
    const alpha = this.maxAlpha * Phaser.Math.Clamp((depthIn + ramp) / ramp, 0, 1)

    this.rt.clear()
    if (alpha <= 0.01) return
    this.rt.fill(0x000000, alpha)
    for (const l of lights) {
      this.spot.setDisplaySize(l.radius * 2, l.radius * 2)
      // RT 内坐标同样是世界单位，直接用"世界点 − 可视矩形左上角"。
      this.rt.erase(this.spot, l.x - view.x, l.y - view.y)
    }
  }

  destroy() {
    this.rt.destroy()
    this.spot.destroy()
  }
}
