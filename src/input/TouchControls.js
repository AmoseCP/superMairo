const BUTTON_ALPHA_IDLE = 0.35
const BUTTON_ALPHA_ACTIVE = 0.65

/**
 * On-screen virtual d-pad + action buttons for touch devices. Only ever
 * drives P1 (a second on-screen control set for local co-op on one phone
 * screen isn't a realistic use case — P2 stays keyboard/gamepad-only).
 * Exposes a plain `state` object that InputManager ORs into its own state,
 * the same way it already does for gamepad input.
 */
export class TouchControls {
  constructor(scene) {
    this.scene = scene
    this.state = { left: false, right: false, jump: false, run: false, action: false }
    this._buttons = []

    this._layout()
    scene.scale.on('resize', () => this._layout())
  }

  /** 屏幕尺寸或相机缩放变了都要重排（GameScene._syncScreenSpaceUi 会调）。 */
  relayout() {
    this._layout()
  }

  _layout() {
    for (const b of this._buttons) {
      b.zone.destroy()
      b.text.destroy()
    }
    this._buttons = []

    const w = this.scene.scale.width
    const h = this.scene.scale.height
    const r = 34
    const margin = 24

    // 按键要贴着屏幕四角、并保持固定的手指大小，所以先按屏幕坐标摆好，再统一
    // 换算成 scrollFactor=0 对象的坐标——主相机在小屏上会缩小（见 GameScene
    // MIN_VISIBLE_TILES_Y），而该缩放是绕相机中心做的，不换算的话按键会跟着
    // 缩到 58% 并挤向屏幕中央（实测过，完全没法按）。
    this._addButton(margin + r, h - margin - r, r, '◀', 'left')
    this._addButton(margin + r * 2 + 16 + r, h - margin - r, r, '▶', 'right')
    this._addButton(w - margin - r, h - margin - r, r, '⤒', 'jump')
    this._addButton(w - margin - r * 2 - 16 - r, h - margin - r - 50, r * 0.8, '🔥', 'action')
    this._addButton(margin + r, h - margin - r * 2 - 16 - r, r * 0.8, '⚡', 'run')
  }

  _addButton(screenX, screenY, screenRadius, label, action) {
    // screen* 是希望在屏幕上呈现的位置与大小；换算到相机缩放前的坐标系。
    const ui = this.scene.screenToUi?.(screenX, screenY) ?? { x: screenX, y: screenY }
    const s = this.scene.uiScale ?? 1
    const x = ui.x
    const y = ui.y
    const radius = screenRadius * s
    const circle = this.scene.add
      .circle(x, y, radius, 0xffffff, BUTTON_ALPHA_IDLE)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive()
    const text = this.scene.add
      .text(x, y, label, { fontSize: `${Math.round(screenRadius)}px` })
      .setOrigin(0.5)
      .setScale(s)
      .setScrollFactor(0)
      .setDepth(1001)

    circle.on('pointerdown', () => {
      this.state[action] = true
      circle.setFillStyle(0xffffff, BUTTON_ALPHA_ACTIVE)
    })
    const release = () => {
      this.state[action] = false
      circle.setFillStyle(0xffffff, BUTTON_ALPHA_IDLE)
    }
    circle.on('pointerup', release)
    circle.on('pointerout', release)

    this._buttons.push({ zone: circle, text, action })
  }

  destroy() {
    for (const b of this._buttons) {
      b.zone.destroy()
      b.text.destroy()
    }
  }
}
