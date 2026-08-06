import Phaser from 'phaser'
import { LEVELS } from '../config/levels.js'
import { SaveManager } from '../systems/SaveManager.js'
import { SettingsManager, SETTING_DEFS } from '../systems/SettingsManager.js'

const COLS = 5
const CARD_W = 200
// 96 → 128：卡片现在要放下四行（关号 / 关名 / ★收集度 / 最佳分与最佳用时）。
const CARD_H = 128
const BIG_COINS_PER_LEVEL = 3
const CARD_GAP_X = 18
const CARD_GAP_Y = 22
const NAV_REPEAT_MS = 220

/**
 * 开局选关画面（玩家想玩哪关就玩哪关）。键盘（方向键/WASD 移动光标，
 * Space/Enter 确认）、手柄（十字键/左摇杆移动，A 确认）、鼠标/触屏
 * （直接点卡片）三套输入都可用。选定后以全新一轮开始该关（分数/金币/
 * 形态/生命全部重置），之后照常一关接一关直到总结算。
 */
export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a2340')
    this.cameras.main.fadeIn(250, 0, 0, 0)
    this._starting = false
    this._navReadyAt = 0
    // Release-then-press: a Space/Enter/A still held from the previous
    // scene (results screen dismissal etc.) must not instantly start the
    // level the cursor happens to sit on.
    this._confirmArmed = false

    this.levelIds = Object.keys(LEVELS)
    this.index = 0
    this.saveManager = new SaveManager()
    this.settings = new SettingsManager()
    const collected = this.saveManager.getBigCoinRecord()

    this.root = this.add.container(0, 0)
    const title = this.add
      .text(0, 0, '🐰 跳跳兔历险记 · 选择关卡', { fontFamily: 'sans-serif', fontSize: '40px', color: '#ffe066' })
      .setOrigin(0.5)
    const hint = this.add
      .text(0, 0, this._defaultHint = '方向键 / WASD / 手柄十字键·摇杆 选择　·　Space / Enter / 手柄 A 开始　·　点击下方选项可开关', {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        color: '#cdd6f4',
      })
      .setOrigin(0.5)
    this.root.add([title, hint])
    this._title = title
    this._hint = hint

    this.cards = this.levelIds.map((id, i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const x = (col - (COLS - 1) / 2) * (CARD_W + CARD_GAP_X)
      const y = row * (CARD_H + CARD_GAP_Y)
      const box = this.add.rectangle(x, y, CARD_W, CARD_H, 0x2b355c).setStrokeStyle(3, 0x4a5680)
      const idText = this.add
        .text(x, y - 40, id, { fontFamily: 'sans-serif', fontSize: '26px', color: '#8fd3ff' })
        .setOrigin(0.5)
      const nameText = this.add
        .text(x, y - 12, LEVELS[id].name, { fontFamily: 'sans-serif', fontSize: '18px', color: '#f2f2f2' })
        .setOrigin(0.5)
      // 大金币收集度：localStorage 里是同步的，直接画。
      const got = collected[id]?.length ?? 0
      const starText = this.add
        .text(x, y + 14, '★'.repeat(got) + '☆'.repeat(Math.max(0, BIG_COINS_PER_LEVEL - got)), {
          fontFamily: 'sans-serif',
          fontSize: '20px',
          color: got === BIG_COINS_PER_LEVEL ? '#ffd34d' : '#c8b06a',
        })
        .setOrigin(0.5)
      // 最佳成绩在 IndexedDB 里，只能异步取——先占位，回来再填。
      const bestText = this.add
        .text(x, y + 40, '尚未通关', { fontFamily: 'sans-serif', fontSize: '13px', color: '#8b93b5' })
        .setOrigin(0.5)
      box.setInteractive({ useHandCursor: true })
      box.on('pointerover', () => this._setIndex(i))
      box.on('pointerdown', () => {
        this._setIndex(i)
        this._start()
      })
      this.root.add([box, idText, nameText, starText, bestText])
      return { box, idText, nameText, starText, bestText }
    })

    this._loadBestScores()

    this._buildSettings()
    this._layout(this.scale.gameSize)
    this._onResize = (gameSize) => this._layout(gameSize)
    this.scale.on('resize', this._onResize)
    this.events.once('shutdown', () => this.scale.off('resize', this._onResize))

    this.keys = this.input.keyboard.addKeys({
      left: 'LEFT', right: 'RIGHT', up: 'UP', down: 'DOWN',
      a: 'A', d: 'D', w: 'W', s: 'S',
      space: 'SPACE', enter: 'ENTER',
    })
    this._highlight()
  }

  /**
   * 关卡网格下方的一排设置开关。放在选关页而不是单独的设置场景：这三项都会
   * 改变"这一把怎么玩"，在开始前顺手切最自然，也省掉一层菜单。
   */
  _buildSettings() {
    this.settingRow = this.add.container(0, 0)
    this.settingToggles = SETTING_DEFS.map((def, i) => {
      const label = this.add
        .text(0, 0, '', { fontFamily: 'sans-serif', fontSize: '15px', color: '#cdd6f4' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
      label.on('pointerdown', () => {
        this.settings.toggle(def.key)
        this._refreshSettings()
      })
      label.on('pointerover', () => this._hint.setText(def.hint))
      label.on('pointerout', () => this._hint.setText(this._defaultHint))
      this.settingRow.add(label)
      return { def, label, i }
    })
    this.root.add(this.settingRow)
    this._refreshSettings()
  }

  _refreshSettings() {
    // 等宽排布：先算出每项的文本，再按总宽居中摆开。
    const texts = this.settingToggles.map(({ def }) => `${this.settings.get(def.key) ? '☑' : '☐'} ${def.label}`)
    this.settingToggles.forEach((t, i) => {
      t.label.setText(texts[i])
      t.label.setColor(this.settings.get(t.def.key) ? '#a8e6a1' : '#8b93b5')
    })
    const gap = 40
    const widths = this.settingToggles.map((t) => t.label.width)
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1)
    let x = -totalW / 2
    this.settingToggles.forEach((t, i) => {
      t.label.setPosition(x + widths[i] / 2, 0)
      x += widths[i] + gap
    })
  }

  /**
   * 把 SaveManager 里躺着的成绩填进卡片。这些数据一直都在写（每次通关都记），
   * 但在此之前界面上一个字都没显示过。
   *
   * IndexedDB 是异步的，玩家可能在结果回来之前就选关走人了——每次回调都要
   * 确认场景还活着且 text 对象没被销毁，否则会往已销毁对象上 setText。
   */
  _loadBestScores() {
    // 对存档里的时间做防御：早期版本 / 异常关闭可能留下 0、负数或 NaN，
    // 直接格式化会在卡片上印出 "-1:-3" 这种东西。
    const fmtTime = (ms) => {
      if (!Number.isFinite(ms) || ms <= 0) return '--:--'
      const total = Math.round(ms / 1000)
      return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
    }
    this.levelIds.forEach((id, i) => {
      this.saveManager.getBestByLevel(id).then((best) => {
        const card = this.cards?.[i]
        if (!best || !card?.bestText?.scene) return
        card.bestText.setText(`最佳 ${best.bestScore}　${fmtTime(best.bestTimeMs)}`)
        card.bestText.setColor('#a8e6a1')
      })
    })
  }

  _layout(gameSize) {
    // Generalized for any row count (was hand-tuned for exactly 2 rows,
    // hardcoding "2" in two places) — 3 worlds × 5 levels now makes a 5×3
    // grid, and more worlds keep working without touching this again.
    const rows = Math.ceil(this.levelIds.length / COLS)
    const cx = gameSize.width / 2
    const gridTop = gameSize.height / 2 - CARD_H / 2 - ((rows - 1) * (CARD_H + CARD_GAP_Y)) / 2 + 20
    this.root.setPosition(cx, gridTop)
    // Title/hint offsets are relative to row 0 / the last row respectively —
    // constant regardless of how many rows exist below/above them.
    this._title.setPosition(0, -CARD_H - 60)
    this.settingRow?.setPosition(0, rows * (CARD_H + CARD_GAP_Y) + 8)
    this._hint.setPosition(0, rows * (CARD_H + CARD_GAP_Y) + 40)
  }

  _setIndex(i) {
    if (this._starting) return
    this.index = Phaser.Math.Clamp(i, 0, this.levelIds.length - 1)
    this._highlight()
  }

  _highlight() {
    this.cards.forEach(({ box, idText }, i) => {
      const selected = i === this.index
      box.setStrokeStyle(selected ? 5 : 3, selected ? 0xffe066 : 0x4a5680)
      box.setFillStyle(selected ? 0x3a4a7a : 0x2b355c)
      box.setScale(selected ? 1.06 : 1)
      idText.setColor(selected ? '#ffe066' : '#8fd3ff')
    })
  }

  _nav(dx, dy) {
    const cols = COLS
    const rows = Math.ceil(this.levelIds.length / cols)
    let col = this.index % cols
    let row = Math.floor(this.index / cols)
    col = (col + dx + cols) % cols
    row = (row + dy + rows) % rows
    this._setIndex(row * cols + col)
  }

  _start() {
    if (this._starting) return
    this._starting = true
    const levelId = this.levelIds[this.index]
    this.cameras.main.fadeOut(250, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', { levelId })
    })
  }

  update(time) {
    if (this._starting) return
    const k = this.keys
    const pad = this.input.gamepad?.getPad(0)
    const stickX = pad?.leftStick?.x ?? 0
    const stickY = pad?.leftStick?.y ?? 0

    const left = k.left.isDown || k.a.isDown || pad?.left || stickX < -0.5
    const right = k.right.isDown || k.d.isDown || pad?.right || stickX > 0.5
    const up = k.up.isDown || k.w.isDown || pad?.up || stickY < -0.5
    const down = k.down.isDown || k.s.isDown || pad?.down || stickY > 0.5

    if ((left || right || up || down) && time >= this._navReadyAt) {
      this._navReadyAt = time + NAV_REPEAT_MS
      if (left) this._nav(-1, 0)
      else if (right) this._nav(1, 0)
      else if (up) this._nav(0, -1)
      else if (down) this._nav(0, 1)
    }

    const confirmDown = k.space.isDown || k.enter.isDown || !!pad?.A
    if (!confirmDown) this._confirmArmed = true
    if (this._confirmArmed && confirmDown) this._start()
  }
}
