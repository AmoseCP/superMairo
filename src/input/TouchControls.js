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

    this._addButton(margin + r, h - margin - r, r, '◀', 'left')
    this._addButton(margin + r * 2 + 16 + r, h - margin - r, r, '▶', 'right')
    this._addButton(w - margin - r, h - margin - r, r, '⤒', 'jump')
    this._addButton(w - margin - r * 2 - 16 - r, h - margin - r - 50, r * 0.8, '🔥', 'action')
    this._addButton(margin + r, h - margin - r * 2 - 16 - r, r * 0.8, '⚡', 'run')
  }

  _addButton(x, y, radius, label, action) {
    const circle = this.scene.add
      .circle(x, y, radius, 0xffffff, BUTTON_ALPHA_IDLE)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive()
    const text = this.scene.add
      .text(x, y, label, { fontSize: `${radius}px` })
      .setOrigin(0.5)
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
