import { CandySlimeKing } from './CandySlimeKing.js'
import { WORLD_SCALE } from '../../config/constants.js'
import { ENEMY_ART } from '../../config/assets.js'

const SOLID_MS = 8000
const PHANTOM_MS = 10000
const PHANTOM_SPEED = 60 * WORLD_SCALE
const PHANTOM_SPEED_ENRAGED = PHANTOM_SPEED * 1.4
const BREAK_STUN_MS = 2000
const PHANTOM_ALPHA = 0.45
const PHANTOM_COLOR = 0x9a6fd9
const ENRAGE_HP = 2
const CONTACT_RANGE_PX = 2 * 96 * WORLD_SCALE
const CONTACT_TELEGRAPH_MS = 400
const BURST_FLAME_MS = 1200
const BURST_WIDTH = 20 * WORLD_SCALE
const BURST_HEIGHT_TILES = 2.5
const SOLID_COLOR = 0x8a4fc9

/**
 * 幻影女王（3-5 终章 Boss，LEVELS3.md）——CandySlimeKing 的相位变体：
 * 实体态（8s，正常重力+可踩+可火球，行为=父类的追踪+预警砸地）↔
 * 幻影态（10s，半透明+无敌+无重力穿墙缓慢追踪最近玩家，接触仍伤人）。
 * 幻影态期间踩红蓝开关（GameScene._updatePhantomFight 里的两个固定按钮）
 * 强制拉回实体态并眩晕 2s——这是本 Boss 唯一的输出窗口，开关本身有
 * 独立冷却（8s），不复用 SwitchBlock 的红蓝染色系统，只是外观借用
 * switch_plate。
 *
 * 物理体归属会随相位切换在 `enemyGroup`（实体态，正常踩踏/side-touch）
 * 和 `ghostGroup`（幻影态，overlap-only、不参与地面碰撞，同 3-2 害羞
 * 幽灵的"穿墙"套路）之间搬家——GameScene._updatePhantomFight 负责这次
 * 搬家，PhantomQueen 自己只管什么时候该切相位。
 */
export class PhantomQueen extends CandySlimeKing {
  constructor(scene, x, y, opts) {
    const hasOwnArt = scene.textures.exists(ENEMY_ART.phantomqueen.key)
    super(scene, x, y, { ...opts, art: hasOwnArt ? ENEMY_ART.phantomqueen : ENEMY_ART.candyslimeking })
    this._hasOwnArt = hasOwnArt
    this.hp = 5
    this.phaseState = 'solid'
    this.phaseUntil = scene.time.now + SOLID_MS
    this._telegraphUntil = -Infinity
    this._watchingPlayer = false
    this._clearTint()
  }

  /** Override CandySlimeKing's base-pink reset — we're purple, and use tint (not fillStyle) when riding the shared boss art. */
  _clearTint() {
    if (this.artSprite) {
      if (this._hasOwnArt) this.artSprite.clearTint()
      else this.artSprite.setTint(SOLID_COLOR)
    } else {
      this.rect.setFillStyle(SOLID_COLOR)
    }
  }

  get isPhantom() {
    return this.phaseState === 'phantom'
  }

  _nearestActivePlayer() {
    const coop = this.scene.coop
    if (!coop) return null
    const candidates = [
      coop.p1Bubble ? null : coop.p1,
      coop.p2Joined && !coop.p2Bubble ? coop.p2 : null,
    ].filter((p) => p && p.rect.visible)
    let best = null
    for (const p of candidates) {
      if (!best || Math.abs(p.rect.x - this.rect.x) < Math.abs(best.rect.x - this.rect.x)) best = p
    }
    return best
  }

  /**
   * Called by the normal `this.enemies` update loop every frame. Phase
   * transitions just flip `this.phaseState` here — GameScene._updatePhantomFight
   * runs AFTER this loop each frame and diffs phaseState against what it saw
   * last frame to know when to re-parent the physics body between
   * enemyGroup/ghostGroup (can't do that reparenting from inside the entity
   * itself; it doesn't own those groups).
   */
  update(time) {
    if (this.dead) return
    if (time < this.stunnedUntil) {
      this.body.setVelocity(0, 0)
      this._updateFace()
      return
    }
    if (this.isPhantom) {
      this._updatePhantom(time)
      return
    }
    super.update(time)
    if (time >= this.phaseUntil) {
      this.phaseState = 'phantom'
      this.phaseUntil = time + PHANTOM_MS
      this.body.setAllowGravity(false)
      this.body.setVelocity(0, 0)
      this._setPhantomVisual(true)
    }
  }

  _updatePhantom(time) {
    const speed = this.hp <= ENRAGE_HP ? PHANTOM_SPEED_ENRAGED : PHANTOM_SPEED
    const target = this._nearestActivePlayer()
    if (target) {
      const dx = target.rect.x - this.rect.x
      const dy = target.rect.y - this.rect.y
      const len = Math.max(1, Math.hypot(dx, dy))
      this.body.setVelocity((dx / len) * speed, (dy / len) * speed)
      this.direction = dx < 0 ? -1 : 1
      const dist = Math.hypot(dx, dy)
      if (dist < CONTACT_RANGE_PX) {
        if (!this._watchingPlayer) {
          this._watchingPlayer = true
          this._telegraphUntil = time + CONTACT_TELEGRAPH_MS
        }
      } else {
        this._watchingPlayer = false
      }
    } else {
      this.body.setVelocity(0, 0)
    }
    this._updateFace()
    if (time >= this.phaseUntil) this._breakPhantom(time)
  }

  /** 接触伤害是否已经过了 0.4s 前兆——幻影态贴脸的一瞬间不算数，得先闪烁警示。 */
  get contactArmed() {
    return !this.isPhantom || (this._watchingPlayer && this.scene.time.now >= this._telegraphUntil)
  }

  /** 踩开关强制破隐——GameScene._updatePhantomFight 检测到按钮触发时调用。 */
  _breakPhantom(time) {
    this.phaseState = 'solid'
    this.phaseUntil = time + SOLID_MS
    this.stunnedUntil = time + BREAK_STUN_MS
    this.body.setAllowGravity(true)
    this.body.setVelocity(0, 0)
    this._setPhantomVisual(false)
  }

  _setPhantomVisual(phantom) {
    const alpha = phantom ? PHANTOM_ALPHA : 1
    this.rect.setAlpha(alpha)
    this.artSprite?.setAlpha(alpha)
    if (phantom) {
      if (this.artSprite) this.artSprite.setTint(PHANTOM_COLOR)
      else this.rect.setFillStyle(PHANTOM_COLOR)
    } else {
      this._clearTint()
    }
  }

  /** 幻影态完全无敌：踩踏/火球都无效，直到被开关强制拉回实体态。 */
  onStomp() {
    if (this.isPhantom) return
    super.onStomp()
  }

  onHitByShell() {
    if (this.isPhantom) return
    super.onHitByShell()
  }

  onSideTouch() {
    if (this.dead) return false
    if (this.isPhantom) return this.contactArmed
    return this.scene.time.now >= this.stunnedUntil
  }

  _onSlamLand(x, groundY) {
    if (this.hp > ENRAGE_HP) return
    // hp<=2：实体态砸地喷横向火舌（复用 2-5 红王 BurstFlame 的 hazard 接口）。
    const height = BURST_HEIGHT_TILES * 96 * WORLD_SCALE
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
