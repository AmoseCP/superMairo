import { Enemy } from '../Enemy.js'
import { WORLD_SCALE } from '../../config/constants.js'
import { ENEMY_ART } from '../../config/assets.js'

const FLOAT_SPEED = 90 * WORLD_SCALE
const BLUSH_COLOR = 0xff9fb0
const BLUSH_RADIUS = 3 * WORLD_SCALE
const FROZEN_ALPHA = 0.55

/**
 * 害羞幽灵（3-2，LEVELS3.md）——无重力悬浮。任意存活玩家面朝它（玩家
 * 与它的相对方向和 player.facing 同号）时定住+捂脸；所有存活玩家都背对
 * 它时才会径直飘向最近的那个玩家（无视地形——见 passThrough）。双人反向
 * 站位可以让它永远动不了，是天然的协作点。
 *
 * 不可踩：GameScene._loadEnemies 靠 `passThrough` 把它的物理体分流进
 * ghostGroup（overlap，不做物理分离），而不是常规的 enemyGroup
 * （collider，会把玩家顶开/判定踩踏）——所以它对玩家而言完全没有"实体
 * 碰撞"，只有"接触伤人"这一种交互（星星/火球仍能秒杀它，走的是各自独立
 * 的 overlap）。
 */
export class ShyGhost extends Enemy {
  constructor(scene, x, y, opts) {
    super(scene, x, y, {
      speed: 0,
      color: 0xffffff,
      width: 32 * WORLD_SCALE,
      height: 32 * WORLD_SCALE,
      art: ENEMY_ART.shyghost,
      ...opts,
    })
    this.body.setAllowGravity(false)
    this.body.setVelocity(0, 0)
    this.noGravity = true
    this.passThrough = true
    this.watched = false

    if (!this.artSprite) {
      this.blushLeft = scene.add.circle(x, y, BLUSH_RADIUS, BLUSH_COLOR)
      this.blushRight = scene.add.circle(x, y, BLUSH_RADIUS, BLUSH_COLOR)
      this._face.push(this.blushLeft, this.blushRight)
    }
    this._updateFace()
  }

  _activePlayers() {
    const coop = this.scene.coop
    if (!coop) return []
    return [
      coop.p1Bubble ? null : coop.p1,
      coop.p2Joined && !coop.p2Bubble ? coop.p2 : null,
    ].filter((p) => p && p.rect.visible)
  }

  update() {
    if (this.dead) return
    const players = this._activePlayers()
    // Ties (dx === 0) count as "being watched" — errs shy, matches the
    // design intent that it's easy to accidentally pin it in place.
    this.watched = players.length > 0 && players.some((p) => (this.rect.x - p.rect.x) * p.facing >= 0)

    if (this.watched) {
      this.body.setVelocity(0, 0)
    } else {
      let target = null
      for (const p of players) {
        if (!target || Math.abs(p.rect.x - this.rect.x) < Math.abs(target.rect.x - this.rect.x)) target = p
      }
      if (target) {
        const dx = target.rect.x - this.rect.x
        const dy = target.rect.y - this.rect.y
        const len = Math.max(1, Math.hypot(dx, dy))
        this.body.setVelocity((dx / len) * FLOAT_SPEED, (dy / len) * FLOAT_SPEED)
        this.direction = dx < 0 ? -1 : 1
      } else {
        this.body.setVelocity(0, 0)
      }
    }
    this._updateFace()
  }

  _updateFace() {
    super._updateFace()
    const alpha = this.watched ? FROZEN_ALPHA : 1
    this.rect.setAlpha(alpha)
    this.artSprite?.setAlpha(alpha)
    if (this.blushLeft) {
      const { x, y, width, height } = this.rect
      this.blushLeft.setPosition(x - width * 0.28, y + height * 0.08)
      this.blushRight.setPosition(x + width * 0.28, y + height * 0.08)
    }
    // Shy = cover the eyes the moment someone's looking.
    const showEyes = !this.watched
    this.eyeLeft?.setVisible(showEyes)
    this.eyeRight?.setVisible(showEyes)
    this.pupilLeft?.setVisible(showEyes)
    this.pupilRight?.setVisible(showEyes)
  }
}
