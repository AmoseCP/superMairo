import Phaser from 'phaser'
import { LEVELS } from '../config/levels.js'

const COLS = 5
const CARD_W = 200
const CARD_H = 96
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

    this.root = this.add.container(0, 0)
    const title = this.add
      .text(0, 0, '🐰 跳跳兔历险记 · 选择关卡', { fontFamily: 'sans-serif', fontSize: '40px', color: '#ffe066' })
      .setOrigin(0.5)
    const hint = this.add
      .text(0, 0, '方向键 / WASD / 手柄十字键·摇杆 选择　·　Space / Enter / 手柄 A 开始　·　也可直接点击关卡', {
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
        .text(x, y - 16, id, { fontFamily: 'sans-serif', fontSize: '26px', color: '#8fd3ff' })
        .setOrigin(0.5)
      const nameText = this.add
        .text(x, y + 18, LEVELS[id].name, { fontFamily: 'sans-serif', fontSize: '18px', color: '#f2f2f2' })
        .setOrigin(0.5)
      box.setInteractive({ useHandCursor: true })
      box.on('pointerover', () => this._setIndex(i))
      box.on('pointerdown', () => {
        this._setIndex(i)
        this._start()
      })
      this.root.add([box, idText, nameText])
      return { box, idText, nameText }
    })

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
    this._hint.setPosition(0, rows * (CARD_H + CARD_GAP_Y) + 20)
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
