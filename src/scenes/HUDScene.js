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
    const elapsedMs = time - gs.startTime
    const elapsedSec = Math.floor(elapsedMs / 1000)
    // 速通对照：领先本关历史最佳就显示绿色的负差，落后就显示灰色的正差。
    let pace = ''
    if (gs.bestTimeMs > 0) {
      const diff = (elapsedMs - gs.bestTimeMs) / 1000
      const mm = Math.floor(gs.bestTimeMs / 60000)
      const ss = String(Math.floor((gs.bestTimeMs % 60000) / 1000)).padStart(2, '0')
      pace = `（最佳 ${mm}:${ss}　${diff <= 0 ? `领先 ${(-diff).toFixed(1)}s` : `落后 ${diff.toFixed(1)}s`}）`
    }
    const muteIcon = gs.audioManager?.muted ? '🔇（M 开启声音）' : '🔊（M 静音）'
    // Fire breath (F) only works in fire form, which needs a mushroom (small→big)
    // then a fire flower (big→fire) first — show current form so it's obvious
    // why F does nothing yet, instead of it looking broken.
    const formLabel = { small: '小', big: '大', fire: '🔥火' }
    let formStatus = `P1 形态：${formLabel[coop.p1.form]}`
    if (coop.p2Joined) formStatus += `　P2 形态：${formLabel[coop.p2.form]}`

    // 大金币进度：实心 ★ = 本关已收集（含以前存档里拿到的），空心 ☆ = 还没拿。
    const got = gs.bigCoinsCollected?.size ?? 0
    const total = gs.bigCoinTotal ?? 0
    const bigCoins = total ? `  ★ ${'★'.repeat(got)}${'☆'.repeat(total - got)} ${got}/${total}` : ''

    // 竞争模式：把两人的个人分实时摆在一起，领先的一方标出来。
    let versus = ''
    if (gs.settings?.get('versus') && coop.p2Joined) {
      const s1 = gs.scoreManager.playerScore('p1')
      const s2 = gs.scoreManager.playerScore('p2')
      const lead = s1 === s2 ? '　平' : s1 > s2 ? '　🐰领先' : '　🐱领先'
      versus = `\n🏁 竞争：P1 ${s1}  vs  P2 ${s2}${lead}`
    }

    this.statusText.setText(
      `${gs.level.name}（${gs.levelId}）  ⏱ ${elapsedSec}s ${pace}  ${muteIcon}\n` +
        `共享生命：${hearts}  |  ${p2Status}\n` +
        `🪙 金币：${gs.totalCoins}   总得分：${gs.totalScore}${bigCoins}  |  ${formStatus}` +
        versus,
    )
  }
}
