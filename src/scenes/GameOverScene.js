import Phaser from 'phaser'

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

    const summary = this.coop
      ? `游戏结束\nP1 本关得分：${this.p1Score}（🪙${this.p1.coins} ⚔${this.p1.kills}）　P2 本关得分：${this.p2Score}（🪙${this.p2.coins} ⚔${this.p2.kills}）\n团队总得分：${this.score}`
      : `游戏结束\n总得分：${this.score}　金币：${this.coins}`

    this.add
      .text(cx, cy - 40, summary, {
        fontFamily: 'sans-serif',
        fontSize: '28px',
        color: '#ff8fc7',
        align: 'center',
      })
      .setOrigin(0.5)

    this.add
      .text(cx, cy + 50, '按 Space / 手柄 A 键重新挑战', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#f2f2f2',
        align: 'center',
      })
      .setOrigin(0.5)

    this.input.keyboard.once('keydown-SPACE', () => this._retry())
  }

  update() {
    const pad = this.input.gamepad?.getPad(0)
    if (pad?.A && !this._retrying) this._retry()
  }

  _retry() {
    this._retrying = true
    this.cameras.main.fadeOut(250, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', { levelId: this.levelId })
    })
  }
}
