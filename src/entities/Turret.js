import { TILE_SIZE, WORLD_SCALE } from '../config/constants.js'
import { ENEMY_ART } from '../config/assets.js'
import { tryArtSprite } from '../utils/artSwap.js'

const WIDTH = 40 * WORLD_SCALE
const HEIGHT = 44 * WORLD_SCALE
const BODY_COLOR = 0x8a8f98
const HIT_TINT = 0xffb3b3
const HIT_FLASH_MS = 120
const HP = 3
const FIRE_PERIOD_MS = 2500

/**
 * 峡谷炮塔（3-3，LEVELS3.md）——固定实体，可站顶、不可推：物理体直接
 * 加进 groundGroup（同 CrumblePlatform/SwitchBlock 的套路），完全不走
 * enemyGroup/踩踏判定那一套，因为设计上"踩不死"——它根本不是"能被踩"
 * 的敌人，就是一段会定期开火的实心地形。伤害只认火球：3 发拆除，复用
 * CandySlimeKing 的 tint 受击反馈（不用 setScale，避免碰撞体跟着抖动）。
 */
export class Turret {
  constructor(scene, { x, groundTileY, tileSize = TILE_SIZE }) {
    this.scene = scene
    this.hp = HP
    this.dead = false
    this.lastFireAt = -Infinity

    const cx = x * tileSize + tileSize / 2
    const cy = groundTileY * tileSize - HEIGHT / 2
    this.x = cx
    this.groundY = groundTileY * tileSize

    this.rect = scene.add.rectangle(cx, cy, WIDTH, HEIGHT, BODY_COLOR)
    this.rect.setStrokeStyle(2 * WORLD_SCALE, 0x5c6068)
    scene.physics.add.existing(this.rect, true)
    this.rect.setData('enemyRef', this) // reused by fireball-hit lookup, see GameScene._loadTurrets

    this.artSprite = tryArtSprite(scene, cx, cy, ENEMY_ART.turret, WIDTH, HEIGHT)
    if (this.artSprite) this.rect.setVisible(false)

    this.muzzle = scene.add.circle(cx, cy - HEIGHT * 0.15, 5 * WORLD_SCALE, 0x2d2d2d)
  }

  /** True the instant it should launch a shot this frame — caller (GameScene) owns spawning the projectile. */
  update(time) {
    if (this.dead) return false
    if (time - this.lastFireAt < FIRE_PERIOD_MS) return false
    this.lastFireAt = time
    return true
  }

  onHitByShell() {
    if (this.dead) return
    this.hp -= 1
    if (this.hp <= 0) {
      this.dead = true
      this.rect.body.enable = false
      this.muzzle.setVisible(false)
      this.rect.setScale(1, 0.3)
      this.artSprite?.setScale(this.artSprite.scaleX, this.artSprite.scaleY * 0.3)
      this.scene.time.delayedCall(200, () => {
        this.rect.destroy()
        this.artSprite?.destroy()
        this.muzzle.destroy()
      })
      return
    }
    if (this.artSprite) this.artSprite.setTint(HIT_TINT)
    else this.rect.setFillStyle(HIT_TINT)
    this.scene.time.delayedCall(HIT_FLASH_MS, () => {
      if (this.dead) return
      if (this.artSprite) this.artSprite.clearTint()
      else this.rect.setFillStyle(BODY_COLOR)
    })
  }
}
