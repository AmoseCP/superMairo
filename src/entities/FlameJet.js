import { TILE_SIZE, WORLD_SCALE } from '../config/constants.js'

const COLUMN_HEIGHT_TILES = 3
const COLUMN_WIDTH = 20 * WORLD_SCALE
const NOZZLE_WIDTH = 30 * WORLD_SCALE
const NOZZLE_HEIGHT = 8 * WORLD_SCALE
const WARMUP_MS = 600
const DEFAULT_PERIOD_MS = 3600
const DEFAULT_BURN_MS = 900
const FLAME_COLOR = 0xff7a1f
const CORE_COLOR = 0xffd166
const GLOW_COLOR = 0xff3b1f

/**
 * 喷火柱（2-3，LEVELS2.md）——从地面喷口向上喷 3 格高的火柱，循环
 * idle →（预热 0.6s：喷口红光，尚无伤害）→ 喷发（burnMs，接触=受击）→ idle。
 * 伤害判定与 PipeTrap 同模式：GameScene 每帧手动 AABB（见 _checkFlameJets），
 * 遵守玩家受击无敌帧。喷口本身无碰撞体（纯地表装饰）。
 */
export class FlameJet {
  constructor(scene, { x, tileY, periodMs = DEFAULT_PERIOD_MS, phaseMs = 0, burnMs = DEFAULT_BURN_MS }) {
    this.scene = scene
    this.x = x * TILE_SIZE + TILE_SIZE / 2
    this.groundY = tileY * TILE_SIZE
    this.burnMs = burnMs
    this.periodMs = periodMs
    this.state = 'idle' // idle | warmup | burn
    this.stateUntil = scene.time.now + periodMs - WARMUP_MS - burnMs + phaseMs

    this.nozzle = scene.add.rectangle(this.x, this.groundY - NOZZLE_HEIGHT / 2, NOZZLE_WIDTH, NOZZLE_HEIGHT, 0x6b6f78)
    this.glow = scene.add.circle(this.x, this.groundY - NOZZLE_HEIGHT, 8 * WORLD_SCALE, GLOW_COLOR, 0.8).setVisible(false)
    const columnHeight = COLUMN_HEIGHT_TILES * TILE_SIZE
    this.columnY = this.groundY - columnHeight / 2
    this.flame = scene.add.rectangle(this.x, this.columnY, COLUMN_WIDTH, columnHeight, FLAME_COLOR, 0.9).setVisible(false)
    this.core = scene.add.rectangle(this.x, this.columnY, COLUMN_WIDTH * 0.45, columnHeight * 0.92, CORE_COLOR, 0.95).setVisible(false)
  }

  get isDangerous() {
    return this.state === 'burn'
  }

  getBounds() {
    const columnHeight = COLUMN_HEIGHT_TILES * TILE_SIZE
    return {
      left: this.x - COLUMN_WIDTH / 2,
      right: this.x + COLUMN_WIDTH / 2,
      top: this.groundY - columnHeight,
      bottom: this.groundY,
    }
  }

  update(time) {
    if (time < this.stateUntil) {
      if (this.state === 'burn') {
        const flicker = 0.85 + Math.sin(time / 40) * 0.1
        this.flame.setAlpha(flicker)
      } else if (this.state === 'warmup') {
        this.glow.setAlpha(0.4 + Math.sin(time / 60) * 0.4)
      }
      return
    }
    if (this.state === 'idle') {
      this.state = 'warmup'
      this.stateUntil = time + WARMUP_MS
      this.glow.setVisible(true)
    } else if (this.state === 'warmup') {
      this.state = 'burn'
      this.stateUntil = time + this.burnMs
      this.glow.setVisible(false)
      this.flame.setVisible(true)
      this.core.setVisible(true)
    } else {
      this.state = 'idle'
      this.stateUntil = time + Math.max(400, this.periodMs - WARMUP_MS - this.burnMs)
      this.flame.setVisible(false)
      this.core.setVisible(false)
    }
  }
}
