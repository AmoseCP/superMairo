import { Item } from '../Item.js'
import { WORLD_SCALE } from '../../config/constants.js'
import { ITEM_ART } from '../../config/assets.js'

// 明显大于普通金币（半径 9）——它是"这一关的目标"，必须一眼从金币串里认出来。
const BIG_COIN_RADIUS = 16 * WORLD_SCALE
const RING_RADIUS = 23 * WORLD_SCALE
const RING_COLOR = 0xfff3a0
const RING_PULSE_MS = 900

/**
 * 大金币（每关 3 枚，见 LEVELS.md「每关收集品」）——通关之外的第二层目标：
 * 藏在需要绕路或需要一点操作才够得到的位置，收集状态按关卡持久化，选关界面
 * 显示 ★★☆。
 *
 * `index` 是它在本关 `bigCoins` 数组里的下标，也是存档里的标识——**放置顺序
 * 一旦发布就不能再改**，否则老存档里"已收集第 2 枚"会指到另一枚上去。往关卡
 * 里加新的大金币请追加到数组末尾。
 *
 * 注意：呼吸光环是一个**没有物理体**的独立视觉层。这里不能去 tween 挂着
 * 物理体的 this.rect —— Arcade 每帧会用 body 的位置覆写 GameObject，动画既
 * 不生效又会和物理打架（PLAN.md §7 item 12 已经踩过一次，Spring.js 同理）。
 */
export class BigCoin extends Item {
  constructor(scene, x, y, opts = {}) {
    super(scene, x, y, {
      color: 0xffc400,
      radius: BIG_COIN_RADIUS,
      allowGravity: false,
      art: ITEM_ART.bigCoin,
      ...opts,
    })
    this.type = 'bigcoin'
    this.index = opts.index ?? 0

    this.ring = scene.add.circle(x, y, RING_RADIUS, RING_COLOR, 0.35).setDepth(-1)
    this._pulse = scene.tweens.add({
      targets: this.ring,
      scale: 1.18,
      alpha: 0.12,
      duration: RING_PULSE_MS,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /**
   * 存档里这一枚已经拿过：留一个不可拾取的暗色幽灵，既告诉玩家"这里有过一枚"，
   * 又不让它被重复刷分。停掉呼吸 tween，否则它会继续覆写 alpha。
   */
  markAlreadyCollected() {
    this.alreadyCollected = true
    this._pulse?.remove()
    this.body.enable = false
    this.rect.setAlpha(0.18)
    this.artSprite?.setAlpha(0.18)
    this.ring?.setScale(1).setAlpha(0.06)
  }

  destroy() {
    if (this.dead) return
    this._pulse?.remove()
    this.ring?.destroy()
    super.destroy()
  }
}
