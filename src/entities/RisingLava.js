import { TILE_SIZE, WORLD_SCALE } from '../config/constants.js'

const LAVA_COLOR = 0xff5a1f
const LAVA_TOP_COLOR = 0xffc93d
const LAVA_TOP_BAND_PX = 6 * WORLD_SCALE
const WARNING_RANGE_TILES = 4
const WARNING_COLOR = 0xff2d2d

/**
 * 上涨岩浆（3-4，LEVELS3.md）——纵版塔身脚下持续上涨的即死液面。复用
 * 2-3 岩浆的视觉配色，但表面高度是每帧算出来的，不是加载时定好的一块
 * 静态矩形，所以整块矩形（含顶部亮带）每帧都要重新摆放/拉伸。
 *
 * 触面判定完全不重新发明轮子：GameScene 把这个实例的 `{left, right,
 * get surfaceY}` 描述符塞进和 2-3/2-5 共用的 `this.lavaZones` 数组，走
 * 既有的 `_checkLava()`——掉命/泡泡/敌人消灭全套规则自动生效，双人"岩浆
 * 只认最高的存活玩家、落后者靠泡泡跟上"也是 `handlePlayerDown` 本来就有
 * 的行为，不需要专门再判一次。
 */
export class RisingLava {
  constructor(scene, { startTileY, speedPx, pauseAtTileY = [], pauseMs = 6000, fromTile = 0, toTile, tileSize = TILE_SIZE }) {
    this.scene = scene
    this.speed = speedPx * WORLD_SCALE
    this.pauseAtY = pauseAtTileY.map((t) => t * tileSize)
    this.pauseMs = pauseMs
    this.startY = startTileY * tileSize
    this.surfaceY = this.startY
    this.pauseIndex = 0
    this.pausedUntil = null
    this.left = fromTile * tileSize
    this.right = (toTile ?? fromTile) * tileSize

    this.body = scene.add.rectangle(0, 0, this.right - this.left, 1, LAVA_COLOR, 0.92).setDepth(-1)
    this.topBand = scene.add.rectangle(0, 0, this.right - this.left, LAVA_TOP_BAND_PX, LAVA_TOP_COLOR, 0.95)
    this.warningOverlay = scene.add
      .rectangle(0, 0, scene.scale.width, scene.scale.height, WARNING_COLOR, 0)
      .setScrollFactor(0)
      .setDepth(2000)
    this._render()
  }

  get zone() {
    return this
  }

  /** 从检查点复活时调用——把岩浆面拉回该检查点对应的暂停高度下方 2 格，不然复活即死。 */
  resetToCheckpoint(reachedIndex) {
    if (reachedIndex < 0 || reachedIndex >= this.pauseAtY.length) {
      this.surfaceY = this.startY
      this.pauseIndex = 0
    } else {
      this.surfaceY = this.pauseAtY[reachedIndex] + 2 * TILE_SIZE
      this.pauseIndex = reachedIndex
    }
    this.pausedUntil = null
    this._render()
  }

  update(time, delta, activePlayers) {
    if (this.pausedUntil !== null) {
      if (time < this.pausedUntil) {
        this._updateWarning(activePlayers)
        return
      }
      this.pausedUntil = null
      this.pauseIndex += 1
    }
    this.surfaceY -= this.speed * (delta / 1000)
    const nextPauseY = this.pauseAtY[this.pauseIndex]
    if (nextPauseY !== undefined && this.surfaceY <= nextPauseY) {
      this.surfaceY = nextPauseY
      this.pausedUntil = time + this.pauseMs
    }
    this._render()
    this._updateWarning(activePlayers)
  }

  _render() {
    const worldBottom = this.scene.level.heightTiles * TILE_SIZE
    const depth = Math.max(1, worldBottom - this.surfaceY)
    this.body.setSize(this.right - this.left, depth)
    this.body.setPosition((this.left + this.right) / 2, this.surfaceY + depth / 2)
    this.topBand.setPosition((this.left + this.right) / 2, this.surfaceY + LAVA_TOP_BAND_PX / 2)
  }

  _updateWarning(activePlayers) {
    let closestTiles = Infinity
    for (const p of activePlayers) {
      if (p.rect.x < this.left || p.rect.x > this.right) continue
      const feet = p.rect.y + p.rect.height / 2
      const gapTiles = (this.surfaceY - feet) / TILE_SIZE
      if (gapTiles < closestTiles) closestTiles = gapTiles
    }
    const alpha = closestTiles <= 0 ? 0 : Math.max(0, (WARNING_RANGE_TILES - closestTiles) / WARNING_RANGE_TILES) * 0.35
    const pulse = 0.7 + 0.3 * Math.sin(this.scene.time.now / 220)
    this.warningOverlay.setAlpha(alpha * pulse)
  }
}
