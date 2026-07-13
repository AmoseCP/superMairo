import Phaser from 'phaser'
import { FIRST_LEVEL_ID } from '../config/levels.js'

/**
 * Shown once ALL levels are cleared (see GameScene._advanceAfterLevelComplete)
 * — the run's final results, instead of silently looping back to level 1.
 * Space / gamepad A / click starts a brand-new playthrough.
 */
export class VictoryScene extends Phaser.Scene {
  constructor() {
    super('VictoryScene')
  }

  init(data) {
    this.score = data.score
    this.coins = data.coins
    this.coop = data.coop
    this.p1 = data.p1
    this.p2 = data.p2
    this.p1Score = data.p1Score
    this.p2Score = data.p2Score
  }

  create() {
    const cx = this.scale.width / 2
    const cy = this.scale.height / 2
    this.cameras.main.setBackgroundColor('#1a2e1a')
    this.cameras.main.fadeIn(250, 0, 0, 0)
    this._restarting = false

    // p1/p2 breakdowns are the FINAL level's stats only (score/coins carry
    // across levels; per-player tallies reset per level), so co-op shows the
    // shared run totals plus the last level's per-player line.
    const coopLine = this.coop
      ? `\n最终关表现　P1：${this.p1Score}（🪙${this.p1.coins} ⚔${this.p1.kills}）　P2：${this.p2Score}（🪙${this.p2.coins} ⚔${this.p2.kills}）`
      : ''
    this.add
      .text(cx, cy - 60, `🏆 恭喜通关全部关卡！\n\n总得分：${this.score}　总金币：${this.coins}${coopLine}`, {
        fontFamily: 'sans-serif',
        fontSize: '32px',
        color: '#ffe066',
        align: 'center',
      })
      .setOrigin(0.5)

    this.add
      .text(cx, cy + 80, '按 Space / 手柄 A 键，或点击屏幕，返回选关', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#f2f2f2',
        align: 'center',
      })
      .setOrigin(0.5)

    this.input.once('pointerdown', () => this._restart())
    // Space/A use a release-then-press poll — a key still held from the
    // previous scene (or its auto-repeat events) must never skip this screen.
    this.spaceKey = this.input.keyboard.addKey('SPACE')
    this._confirmArmed = false
  }

  update() {
    const pad = this.input.gamepad?.getPad(0)
    const confirmDown = this.spaceKey.isDown || !!pad?.A
    if (!confirmDown) this._confirmArmed = true
    if (this._confirmArmed && confirmDown && !this._restarting) this._restart()
  }

  _restart() {
    if (this._restarting) return
    this._restarting = true
    this.cameras.main.fadeOut(250, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('LevelSelectScene')
    })
  }
}
