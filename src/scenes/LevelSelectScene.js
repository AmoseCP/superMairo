import Phaser from 'phaser'
import { LEVELS, WORLDS, worldOf, TOTAL_BIG_COINS, BIG_COINS_PER_LEVEL as PER_LEVEL } from '../config/levels.js'
import { SaveManager } from '../systems/SaveManager.js'
import { SettingsManager, SETTING_DEFS } from '../systems/SettingsManager.js'

const COLS = 5
const CARD_W = 200
// 96 → 128：卡片现在要放下四行（关号 / 关名 / ★收集度 / 最佳分与最佳用时）。
const CARD_H = 128
// 小屏（手机横屏）用的紧凑卡片：只留关号 / 关名 / ★，最佳成绩挪到底部提示行。
// 不这么做的话整块内容要缩到 0.47 倍才塞得下，关名只剩 8.5px，等于看不见。
const CARD_H_COMPACT = 92
const COMPACT_BELOW_H = 560
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
    // 总进度：45 枚大金币里拿了多少、通关了几关。收集品做出来了却没有一个
    // 地方显示"我离全收集还有多远"，这一行就是那个地方。
    const progress = this.add
      .text(0, 0, '', { fontFamily: 'sans-serif', fontSize: '18px', color: '#ffd34d' })
      .setOrigin(0.5)
    this.root.add([title, hint, progress])
    this._title = title
    this._hint = hint
    this._progress = progress

    this.cards = this.levelIds.map((id, i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const x = (col - (COLS - 1) / 2) * (CARD_W + CARD_GAP_X)
      const y = row * (CARD_H + CARD_GAP_Y)
      const box = this.add.rectangle(x, y, CARD_W, CARD_H, 0x2b355c).setStrokeStyle(3, 0x4a5680)
      const idText = this.add
        .text(x, y - 40, id, { fontFamily: 'sans-serif', fontSize: '26px', color: WORLDS[worldOf(id)]?.color ?? '#8fd3ff' })
        .setOrigin(0.5)
      const nameText = this.add
        .text(x, y - 12, LEVELS[id].name, { fontFamily: 'sans-serif', fontSize: '18px', color: '#f2f2f2' })
        .setOrigin(0.5)
      // 大金币收集度：localStorage 里是同步的，直接画。
      const got = collected[id]?.length ?? 0
      const starText = this.add
        .text(x, y + 14, '★'.repeat(got) + '☆'.repeat(Math.max(0, PER_LEVEL - got)), {
          fontFamily: 'sans-serif',
          fontSize: '20px',
          color: got === PER_LEVEL ? '#ffd34d' : '#c8b06a',
        })
        .setOrigin(0.5)
      // 最佳成绩在 IndexedDB 里，只能异步取——先占位，回来再填。
      const bestText = this.add
        .text(x, y + 40, '尚未通关', { fontFamily: 'sans-serif', fontSize: '13px', color: '#8b93b5' })
        .setOrigin(0.5)
      bestText.bestLabel = null // 由 _loadBestScores 填；紧凑模式下改由提示行显示
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

    this._updateProgress()
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

  /** 顶部总进度行。★ 数同步可得；通关关数由 _loadBestScores 回填。 */
  _updateProgress(clearedCount = null) {
    const record = this.saveManager.getBigCoinRecord()
    const stars = this.levelIds.reduce((n, id) => n + Math.min(PER_LEVEL, record[id]?.length ?? 0), 0)
    const cleared = clearedCount === null ? '' : `　🏁 已通关 ${clearedCount}/${this.levelIds.length} 关`
    const done = stars === TOTAL_BIG_COINS ? '　🎉 全收集！' : ''
    this._progress.setText(`★ 大金币 ${stars}/${TOTAL_BIG_COINS}${cleared}${done}`)
    this._progress.setColor(stars === TOTAL_BIG_COINS ? '#a8e6a1' : '#ffd34d')
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
    let cleared = 0
    this.levelIds.forEach((id, i) => {
      this.saveManager.getBestByLevel(id).then((best) => {
        const card = this.cards?.[i]
        if (!best) return
        cleared++
        if (this._progress?.scene) this._updateProgress(cleared)
        if (!card?.bestText?.scene) return
        card.bestText.bestLabel = `最佳 ${best.bestScore}　${fmtTime(best.bestTimeMs)}`
        card.bestText.setText(card.bestText.bestLabel)
        card.bestText.setColor('#a8e6a1')
      })
    })
  }

  _layout(gameSize) {
    // 内部一律按"设计空间"摆（原点 = 第一行卡片的中心），最后再把整个 root
    // 等比缩放到视口里。
    //
    // 这一步是必须的：整块内容固定 1072×712px，而手机横屏只有 844×390 甚至
    // 667×375。缩放之前，标题和总进度整个跑到屏幕上方外面，设置行和操作提示
    // 掉到屏幕下方外面，左右两列卡片被切掉——连 iPad mini 横屏都横向少 48px。
    // 与其为每种断点写一套排布，不如让这一版设计整体缩小：卡片布局本身
    // （5 列 × 3 行 = 每行正好一个世界）是有含义的，不该在小屏上被拆散。
    const rows = Math.ceil(this.levelIds.length / COLS)
    // 屏幕矮到一定程度就换紧凑卡片：与其让整块内容缩到 0.47 倍（关名只剩
    // 8.5px，纯属"在屏内但看不清"），不如砍掉每张卡上最次要的一行。
    const compact = gameSize.height < COMPACT_BELOW_H
    const cardH = compact ? CARD_H_COMPACT : CARD_H
    this._applyCardMode(compact, cardH)

    this._title.setPosition(0, -cardH - 76)
    this._progress.setPosition(0, -cardH - 34)
    this.settingRow?.setPosition(0, rows * (cardH + CARD_GAP_Y) + 8)
    this._hint.setPosition(0, rows * (cardH + CARD_GAP_Y) + 40)

    const designW = COLS * CARD_W + (COLS - 1) * CARD_GAP_X
    const designTop = -cardH - 76 - 26 // 标题字号 40，再留一点上边
    const designBottom = rows * (cardH + CARD_GAP_Y) + 40 + 14 // 提示行下边
    const designH = designBottom - designTop
    const pad = 14
    const fit = Math.min(
      1,
      (gameSize.width - pad * 2) / designW,
      (gameSize.height - pad * 2) / designH,
    )
    this.root.setScale(fit)
    // 缩放后整体垂直居中：设计空间的上边界要落在留白之后。
    this.root.setPosition(gameSize.width / 2, (gameSize.height - designH * fit) / 2 - designTop * fit)
  }

  /** 切换标准/紧凑卡片：改卡片高度、重排内部元素、决定要不要显示最佳成绩行。 */
  _applyCardMode(compact, cardH) {
    if (this._compact === compact) return
    this._compact = compact
    const rowsOf = compact
      ? { id: -26, name: -2, star: 22, best: null }
      : { id: -40, name: -12, star: 14, best: 40 }
    this.cards.forEach(({ box, idText, nameText, starText, bestText }, i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const x = (col - (COLS - 1) / 2) * (CARD_W + CARD_GAP_X)
      const y = row * (cardH + CARD_GAP_Y)
      box.setSize(CARD_W, cardH)
      box.setPosition(x, y)
      idText.setPosition(x, y + rowsOf.id)
      nameText.setPosition(x, y + rowsOf.name)
      starText.setPosition(x, y + rowsOf.star)
      bestText.setVisible(rowsOf.best !== null)
      if (rowsOf.best !== null) bestText.setPosition(x, y + rowsOf.best)
    })
    this._highlight()
  }

  _setIndex(i) {
    if (this._starting) return
    this.index = Phaser.Math.Clamp(i, 0, this.levelIds.length - 1)
    this._highlight()
  }

  _highlight() {
    // 紧凑模式下卡片放不下最佳成绩，改在底部提示行显示当前选中关的成绩。
    if (this._compact && this._hint) {
      const best = this.cards[this.index]?.bestText?.bestLabel
      this._hint.setText(best ? `${this.levelIds[this.index]}　${best}　·　${this._defaultHint}` : this._defaultHint)
    }
    this.cards.forEach(({ box, idText }, i) => {
      const selected = i === this.index
      box.setStrokeStyle(selected ? 5 : 3, selected ? 0xffe066 : 0x4a5680)
      box.setFillStyle(selected ? 0x3a4a7a : 0x2b355c)
      box.setScale(selected ? 1.06 : 1)
      idText.setColor(selected ? '#ffe066' : (WORLDS[worldOf(this.levelIds[i])]?.color ?? '#8fd3ff'))
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
