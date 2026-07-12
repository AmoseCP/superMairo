import Phaser from 'phaser'
import { LEVELS } from '../config/levels.js'

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene')
  }

  init(data) {
    this.levelId = data.levelId
    this.score = data.score
    this.coins = data.coins
    this.coop = data.coop
    this.p1Score = data.p1Score
    this.p2Score = data.p2Score
    this.p1 = data.p1
    this.p2 = data.p2
  }

  create() {
    const cx = this.scale.width / 2
    const cy = this.scale.height / 2
    this.cameras.main.setBackgroundColor('#1a1a2e')
    this.cameras.main.fadeIn(250, 0, 0, 0)
    this._retrying = false

    // 综合成绩面板：生命耗尽时展示整轮累计数据，然后回到选关画面。
    const levelName = LEVELS[this.levelId]?.name ?? this.levelId
    const coopLine = this.coop
      ? `\n最终关表现　P1：${this.p1Score}（🪙${this.p1.coins} ⚔${this.p1.kills}）　P2：${this.p2Score}（🪙${this.p2.coins} ⚔${this.p2.kills}）`
      : ''
    const summary =
      `💔 生命耗尽 —— 本轮综合成绩\n\n` +
      `总得分：${this.score}　总金币：${this.coins}\n` +
      `止步于：${levelName}（${this.levelId}）${coopLine}`

    this.add
      .text(cx, cy - 50, summary, {
        fontFamily: 'sans-serif',
        fontSize: '28px',
        color: '#ff8fc7',
        align: 'center',
      })
      .setOrigin(0.5)

    this.add
      .text(cx, cy + 90, '按 Space / 手柄 A 键，或点击屏幕，返回选关', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#f2f2f2',
        align: 'center',
      })
      .setOrigin(0.5)

    this.input.keyboard.once('keydown-SPACE', () => this._toLevelSelect())
    this.input.once('pointerdown', () => this._toLevelSelect())
  }

  update() {
    const pad = this.input.gamepad?.getPad(0)
    if (pad?.A && !this._retrying) this._toLevelSelect()
  }

  _toLevelSelect() {
    if (this._retrying) return
    this._retrying = true
    this.cameras.main.fadeOut(250, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('LevelSelectScene')
    })
  }
}
