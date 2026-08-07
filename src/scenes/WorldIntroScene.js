import Phaser from 'phaser'
import { LEVELS, WORLDS, worldOf } from '../config/levels.js'

const AUTO_ADVANCE_MS = 2600
const FADE_MS = 250

/**
 * 进入某个世界的第一关之前插一张过渡卡。
 *
 * 在此之前，15 关是一条没有段落的直线：打完 1-5 直接淡入 2-1，玩家不会意识到
 * 自己跨进了一个主题完全不同的章节。这张卡只做一件事——把"接下来五关要教你
 * 什么"提前讲清楚（文案见 config/levels.js WORLDS）。
 *
 * 到时自动进关，也可以按键/点击立刻跳过：过场动画挡在玩家和游戏之间，第二次
 * 看到它时必须能一秒跳过，否则它就从铺垫变成了阻碍。
 */
export class WorldIntroScene extends Phaser.Scene {
  constructor() {
    super('WorldIntroScene')
  }

  init(data) {
    // 原样透传给 GameScene——这张卡夹在关卡之间，不能把跨关携带的分数/形态弄丢。
    this.gameData = data
  }

  create() {
    const { width, height } = this.scale
    const cx = width / 2
    const cy = height / 2
    const world = WORLDS[worldOf(this.gameData.levelId)] ?? WORLDS[1]
    this._advancing = false

    this.cameras.main.setBackgroundColor(world.bg)
    this.cameras.main.fadeIn(FADE_MS, 0, 0, 0)

    const title = this.add
      .text(cx, cy - 50, world.title, { fontFamily: 'sans-serif', fontSize: '46px', color: world.color })
      .setOrigin(0.5)
    const theme = this.add
      .text(cx, cy + 20, world.theme, {
        fontFamily: 'sans-serif', fontSize: '20px', color: '#e6e6e6', align: 'center', wordWrap: { width: width * 0.8 },
      })
      .setOrigin(0.5)
    const first = this.add
      .text(cx, cy + 74, `即将开始：${this.gameData.levelId}　${LEVELS[this.gameData.levelId]?.name ?? ''}`, {
        fontFamily: 'sans-serif', fontSize: '18px', color: '#b9c2d8',
      })
      .setOrigin(0.5)
    this.add
      .text(cx, height - 48, '按任意键 / 点击 立即开始', { fontFamily: 'sans-serif', fontSize: '15px', color: '#7d879e' })
      .setOrigin(0.5)

    for (const [i, obj] of [title, theme, first].entries()) {
      obj.setAlpha(0)
      this.tweens.add({ targets: obj, alpha: 1, y: obj.y - 12, duration: 400, delay: i * 160, ease: 'Quad.easeOut' })
    }

    this.time.delayedCall(AUTO_ADVANCE_MS, () => this._advance())
    this.input.once('pointerdown', () => this._advance())
    // 释放后再按：从上一个场景带过来的按键（通关时按的那下 Space）不该
    // 一按到底把这张卡也一并跳过 —— 同 GameScene/VictoryScene 的既有做法。
    this._confirmArmed = false
  }

  update() {
    if (this._advancing) return
    const anyKey = this.input.keyboard.addKeys('SPACE,ENTER,W,A,S,D,UP,DOWN,LEFT,RIGHT')
    const pad = this.input.gamepad?.getPad(0)
    const down = Object.values(anyKey).some((k) => k.isDown) || !!pad?.A
    if (!down) this._confirmArmed = true
    if (this._confirmArmed && down) this._advance()
  }

  _advance() {
    if (this._advancing) return
    this._advancing = true
    this.cameras.main.fadeOut(FADE_MS, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene', this.gameData))
  }
}
