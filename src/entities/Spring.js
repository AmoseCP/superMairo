import { WORLD_SCALE } from '../config/constants.js'
import { MISC_ART } from '../config/assets.js'
import { tryArtSprite } from '../utils/artSwap.js'

const SPRING_WIDTH = 56 * WORLD_SCALE
// Must stay well BELOW player height (small form 120px) — a body this
// short reads unambiguously as "a low pad to step onto" to Arcade's AABB
// separation. Making it player-height-tall (the original 102px) instead
// reads as "a wall of comparable height," which resolves the collision as
// a side-bump about as often as a landing (measured: only ~1 tile of the
// spring's own body height leaked out as the "launch," not the intended
// impulse at all) — this was the actual bug behind a completely wrong
// bounce height in testing, not a velocity/physics mistake.
const SPRING_HEIGHT = 12 * WORLD_SCALE
const BASE_COLOR = 0xd23c3c
const STRIPE_COLOR = 0xffffff
const STRIPE_HEIGHT = 5 * WORLD_SCALE
const BOUNCE_DIP_PX = 6 * WORLD_SCALE
const BOUNCE_MS = 110
const COOLDOWN_MS = 120

// Pre-scale (32px-tile) design heights: small=5 tiles, big=8 tiles, matching
// the standard jump's own derivation (v = sqrt(2 * GRAVITY_Y_prescale * h)),
// so these plug into the same "design_value * WORLD_SCALE" convention as
// every other velocity constant in the game.
const SIZES = {
  small: { velocity: 620 * WORLD_SCALE, artKey: 'springSmall' },
  big: { velocity: 784 * WORLD_SCALE, artKey: 'springBig' },
}

/**
 * 弹簧垫（3-1，LEVELS3.md）——静态实体，玩家落地/站上其顶面即获得向上
 * 冲量。`groundTileY` 是弹簧所立足的地面顶面所在行（同 Pipe.js 的既有
 * 约定：必须是地面实际表面那一行，不能再往下多算一格，否则物理体会和
 * 地面重叠 —— 这个坑已经在水管上踩过一次，弹簧照抄同一规则）。
 *
 * 物理体（this.rect）永远不可见、永远不被动画——参照 PLAN.md §7 item 12
 * 的教训（对挂物理体的对象 setScale/移动会让 Arcade 下一帧重新用它同步
 * 碰撞体，压缩反馈动画必须做在一个完全没有物理体的独立视觉层上）。
 */
export class Spring {
  constructor(scene, { x, groundTileY, size = 'small', tileSize }) {
    this.scene = scene
    this.size = size
    const cfg = SIZES[size] ?? SIZES.small
    this.velocity = cfg.velocity
    this.cooldownUntil = 0

    const cx = x * tileSize + tileSize / 2
    const bottomY = groundTileY * tileSize
    this.baseY = bottomY - SPRING_HEIGHT / 2

    this.rect = scene.add.rectangle(cx, this.baseY, SPRING_WIDTH, SPRING_HEIGHT, 0, 0).setVisible(false)
    scene.physics.add.existing(this.rect, true)
    this.rect.setData('springRef', this)

    this.artSprite = tryArtSprite(scene, cx, this.baseY, MISC_ART[cfg.artKey], SPRING_WIDTH, SPRING_HEIGHT)
    if (this.artSprite) {
      this._bounceTargets = [this.artSprite]
    } else {
      this.base = scene.add.rectangle(cx, this.baseY, SPRING_WIDTH, SPRING_HEIGHT, BASE_COLOR)
      this.stripe = scene.add.rectangle(cx, this.baseY - SPRING_HEIGHT * 0.22, SPRING_WIDTH * 0.75, STRIPE_HEIGHT, STRIPE_COLOR)
      this._bounceTargets = [this.base, this.stripe]
    }
  }

  /** Compression feedback: dip the (physics-free) visual down and spring it back — never touches this.rect. */
  bounce() {
    this.scene.tweens.add({ targets: this._bounceTargets, y: `+=${BOUNCE_DIP_PX}`, duration: BOUNCE_MS, yoyo: true, ease: 'Quad.easeOut' })
  }
}
