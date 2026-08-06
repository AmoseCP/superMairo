import { WORLD_SCALE, PLAYER_SMALL_HEIGHT, PLAYER_BIG_HEIGHT } from '../config/constants.js'

// 采样频率。20Hz 足够让回放看着连贯（两点之间线性插值），同时把一把 90 秒的
// 录像压到 ~1800 个采样点；再高就是往 IndexedDB 里灌没人看得出差别的数据。
export const SAMPLE_INTERVAL_MS = 50

// 位置以整数像素存储：亚像素精度对一个半透明轮廓毫无意义，取整能让 JSON
// 体积直接减半。
const round = Math.round

const GHOST_WIDTH = 28 * WORLD_SCALE // 与 Player.js PLAYER_WIDTH 一致
const GHOST_COLOR = 0x8fd3ff
const GHOST_ALPHA = 0.32
const GHOST_DEPTH = 400 // 在地形之上、HUD 之下

/**
 * 录制玩家这一把的走位。只有刷新了本关最速纪录的那一把才会被存下来
 * （见 GameScene._onLevelComplete），所以幽灵永远代表"你自己的最好成绩"。
 *
 * 采样的是**关卡内经过时间**而不是墙钟时间，回放时也按同一口径查找，
 * 于是幽灵和玩家在任意时刻都处在各自那一把的同一秒——这正是速通对照
 * 需要的语义。
 */
export class GhostRecorder {
  constructor() {
    this.samples = [] // 扁平数组 [x, y, formCode, ...]，省掉每点一个对象的开销
    this._lastIndex = -1
  }

  /**
   * 每帧调用，elapsedMs = 关卡开始至今。
   *
   * 采样点严格落在 i × SAMPLE_INTERVAL_MS 这个固定栅格上，第 i 个点就代表
   * 第 i × 50ms 这一刻——回放端正是这么反推时间的。这里不能写成"上次采样时刻
   * + 间隔"：帧长 16.7ms 除不尽 50ms，每次都会多攒一点误差，实测 6 秒只记到
   * 107 个点（应为 120）。那样存下来的幽灵会比它实际跑的快 11%，速通对照直接
   * 失真。掉帧跨过整格时补上重复采样，宁可幽灵短暂静止也不让时间轴错位。
   */
  sample(elapsedMs, player) {
    const idx = Math.floor(elapsedMs / SAMPLE_INTERVAL_MS)
    if (idx <= this._lastIndex) return
    const n = this.samples.length
    while (this._lastIndex < idx - 1 && n >= 3) {
      this.samples.push(this.samples[n - 3], this.samples[n - 2], this.samples[n - 1])
      this._lastIndex++
    }
    this.samples.push(round(player.rect.x), round(player.rect.y), player.form === 'small' ? 0 : 1)
    this._lastIndex = idx
  }

  /** 打包成可存档的形状；太短的（几乎立刻通关/异常）不值得存。 */
  toGhost(totalMs) {
    if (this.samples.length < 6) return null
    return { intervalMs: SAMPLE_INTERVAL_MS, totalMs: round(totalMs), samples: this.samples }
  }
}

/**
 * 把一条录像画成半透明轮廓。纯视觉——没有物理体，不参与任何碰撞，
 * 也不会被玩家踩到或挡路。
 */
export class GhostPlayback {
  constructor(scene, ghost) {
    this.scene = scene
    this.ghost = ghost
    this.interval = ghost.intervalMs || SAMPLE_INTERVAL_MS
    this.count = Math.floor(ghost.samples.length / 3)
    this.rect = scene.add
      .rectangle(0, 0, GHOST_WIDTH, PLAYER_SMALL_HEIGHT, GHOST_COLOR, GHOST_ALPHA)
      .setDepth(GHOST_DEPTH)
      .setVisible(false)
  }

  /**
   * 按关卡内经过时间定位。跑完录像就隐藏——这时玩家已经落后于自己的最好
   * 成绩，幽灵消失本身就是最直白的"你慢了"反馈。
   */
  update(elapsedMs) {
    const t = elapsedMs / this.interval
    const i = Math.floor(t)
    if (i < 0 || i >= this.count - 1) {
      this.rect.setVisible(false)
      return
    }
    const f = t - i
    const s = this.ghost.samples
    const a = i * 3
    const b = a + 3
    this.rect.setVisible(true)
    this.rect.setPosition(s[a] + (s[b] - s[a]) * f, s[a + 1] + (s[b + 1] - s[a + 1]) * f)
    // 形态只在两个采样点都是大形态时才按大形态画，避免变身瞬间来回抖。
    const big = s[a + 2] === 1 && s[b + 2] === 1
    const h = big ? PLAYER_BIG_HEIGHT : PLAYER_SMALL_HEIGHT
    if (this.rect.height !== h) this.rect.setSize(GHOST_WIDTH, h)
  }

  destroy() {
    this.rect.destroy()
  }
}
