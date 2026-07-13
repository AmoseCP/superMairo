import Phaser from 'phaser'

/**
 * Persistent overlay launched alongside GameScene (see GameScene.create()).
 * Purely reads state off the GameScene reference each frame — no game logic
 * lives here, just display.
 */
export class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUDScene')
  }

  init(data) {
    this.gameScene = data.gameScene
  }

  create() {
    this.add
      .text(
        12,
        12,
        'P1: 方向键/WASD 移动 · Shift 加速 · Space/↑/W 跳跃 · F 或手柄 X/扳机键 喷火（需先吃蘑菇变大+吃火焰花才能用）· 手柄0\n' +
          'P2 加入: IJKL + U + O，或手柄1 · 掉进缺口会变泡泡，队友碰泡泡复活',
        { fontFamily: 'sans-serif', fontSize: '14px', color: '#2d2d2d' },
      )
      .setScrollFactor(0)

    this.statusText = this.add
      .text(12, 56, '', { fontFamily: 'sans-serif', fontSize: '14px', color: '#2d2d2d' })
      .setScrollFactor(0)

    this.input.keyboard.on('keydown-M', () => this.gameScene?.audioManager?.toggleMute())
  }

  update(time) {
    const gs = this.gameScene
    if (!gs?.coop) return

    const coop = gs.coop
    // '❤️'（U+2764 + U+FE0F 表情变体符）强制彩色 emoji 呈现——裸 '❤' 是文本
    // 字形，会被 HUD 的深色文字颜色染成黑心。
    const hearts = '❤️'.repeat(Math.max(0, coop.sharedLives))
    const p2Status = coop.p2Joined ? 'P2 已加入 🐱' : '按 IJKL/U 或手柄1 加入 P2'
    const elapsedSec = Math.floor((time - gs.startTime) / 1000)
    const muteIcon = gs.audioManager?.muted ? '🔇（M 开启声音）' : '🔊（M 静音）'
    // Fire breath (F) only works in fire form, which needs a mushroom (small→big)
    // then a fire flower (big→fire) first — show current form so it's obvious
    // why F does nothing yet, instead of it looking broken.
    const formLabel = { small: '小', big: '大', fire: '🔥火' }
    let formStatus = `P1 形态：${formLabel[coop.p1.form]}`
    if (coop.p2Joined) formStatus += `　P2 形态：${formLabel[coop.p2.form]}`

    this.statusText.setText(
      `${gs.level.name}（${gs.levelId}）  ⏱ ${elapsedSec}s  ${muteIcon}\n` +
        `共享生命：${hearts}  |  ${p2Status}\n` +
        `🪙 金币：${gs.totalCoins}   总得分：${gs.totalScore}  |  ${formStatus}`,
    )
  }
}
