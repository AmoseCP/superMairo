import { CandySlimeKing } from './CandySlimeKing.js'
import { TILE_SIZE, WORLD_SCALE } from '../../config/constants.js'

const RETARGET_MS = 3000
const ICE_PATCH_MS = 4000
const ICE_PATCH_HALF_TILES = 1.5
const BURST_FLAME_MS = 1200
const BURST_WIDTH = 20 * WORLD_SCALE
const BURST_HEIGHT_TILES = 2.5

const VARIANTS = {
  blue: { color: 0x6fa8ff, tint: 0x6fa8ff },
  red: { color: 0xff6f6f, tint: 0xff6f6f },
}

/**
 * 双子史莱姆王（2-5 终关 Boss，LEVELS2.md）——CandySlimeKing 的参数化双体：
 * - blue：砸地落点残留一片冰面（4s），玩家追击时会打滑
 * - red：砸地落点喷出一柱短暂火焰（1.2s，接触=受击）
 * - 简单仇恨：每 3 秒锁定最近的存活玩家并朝其走（双人时两王自然分摊）
 * - hp 可配（单人接力 3，双人同场各 2），继承基类的踩踏/眩晕/阶段提速/火球减伤
 */
export class SovereignSlime extends CandySlimeKing {
  constructor(scene, x, y, { variant = 'blue', hp = 3, ...opts } = {}) {
    super(scene, x, y, { ...opts, color: VARIANTS[variant].color })
    this.variant = variant
    this.hp = hp
    this._retargetAt = 0
    if (!this.artSprite) this.rect.setFillStyle(VARIANTS[variant].color)
  }

  _clearTint() {
    if (this.artSprite) this.artSprite.setTint(VARIANTS[this.variant].tint)
    else this.rect.setFillStyle(VARIANTS[this.variant].color)
  }

  update(time) {
    if (!this.dead && time >= this._retargetAt) {
      this._retargetAt = time + RETARGET_MS
      const coop = this.scene.coop
      const targets = [
        coop?.p1Bubble ? null : coop?.p1,
        coop?.p2Joined && !coop?.p2Bubble ? coop.p2 : null,
      ].filter((p) => p && p.rect.visible)
      if (targets.length) {
        const nearest = targets.reduce((a, b) =>
          Math.abs(a.rect.x - this.rect.x) < Math.abs(b.rect.x - this.rect.x) ? a : b,
        )
        this.direction = nearest.rect.x < this.rect.x ? -1 : 1
      }
    }
    super.update(time)
  }

  _onSlamLand(x, groundY) {
    if (this.variant === 'blue') {
      const left = x - ICE_PATCH_HALF_TILES * TILE_SIZE
      const right = x + ICE_PATCH_HALF_TILES * TILE_SIZE
      const zone = { left, right }
      this.scene.iceZones.push(zone)
      const strip = this.scene.add
        .rectangle(x, groundY + 4 * WORLD_SCALE, right - left, 8 * WORLD_SCALE, 0xcfefff, 0.9)
        .setDepth(2)
      this.scene.time.delayedCall(ICE_PATCH_MS, () => {
        const i = this.scene.iceZones.indexOf(zone)
        if (i >= 0) this.scene.iceZones.splice(i, 1)
        strip.destroy()
      })
    } else {
      // one-shot flame column implementing the FlameJet hazard interface —
      // rides the same per-frame check in GameScene._checkFlameJets
      const height = BURST_HEIGHT_TILES * TILE_SIZE
      const flame = this.scene.add.rectangle(x, groundY - height / 2, BURST_WIDTH, height, 0xff7a1f, 0.92)
      const core = this.scene.add.rectangle(x, groundY - height / 2, BURST_WIDTH * 0.45, height * 0.9, 0xffd166, 0.95)
      const hazard = {
        isDangerous: true,
        getBounds: () => ({ left: x - BURST_WIDTH / 2, right: x + BURST_WIDTH / 2, top: groundY - height, bottom: groundY }),
        update: () => {},
      }
      this.scene.flameJets.push(hazard)
      this.scene.time.delayedCall(BURST_FLAME_MS, () => {
        hazard.isDangerous = false
        const i = this.scene.flameJets.indexOf(hazard)
        if (i >= 0) this.scene.flameJets.splice(i, 1)
        flame.destroy()
        core.destroy()
      })
    }
  }
}
