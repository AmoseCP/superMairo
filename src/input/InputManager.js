import { GAMEPAD_DEADZONE } from '../config/constants.js'

const DEFAULT_KEYBOARD_BINDINGS = {
  left: ['LEFT', 'A'],
  right: ['RIGHT', 'D'],
  jump: ['SPACE', 'UP', 'W'],
  run: ['SHIFT'],
  down: ['DOWN', 'S'],
  action: ['F'],
}

// P1 keeps the default (arrows/WASD + gamepad 0). P2 falls back to this
// keyboard layout when a second gamepad isn't connected (see PLAN.md Phase 2).
export const P2_KEYBOARD_BINDINGS = {
  left: ['J'],
  right: ['L'],
  jump: ['I'],
  run: ['U'],
  down: ['K'],
  action: ['O'],
}

/**
 * Unifies keyboard + gamepad input into a single logical state per player.
 * Game code reads `left/right/jump/jumpDown/run/down` and never touches
 * the underlying device.
 */
export class InputManager {
  constructor(scene, { keyboardBindings = DEFAULT_KEYBOARD_BINDINGS, gamepadIndex = 0, touchState = null } = {}) {
    this.scene = scene
    this.gamepadIndex = gamepadIndex
    this.touchState = touchState
    this.keys = {}

    for (const [action, codes] of Object.entries(keyboardBindings)) {
      this.keys[action] = codes.map((code) => scene.input.keyboard.addKey(code))
    }

    this.state = {
      left: false,
      right: false,
      jump: false,
      jumpDown: false,
      run: false,
      down: false,
      action: false,
      actionDown: false,
    }
    this._prevJump = false
    this._prevAction = false
  }

  get pad() {
    if (!this.scene.input.gamepad) return undefined
    return this.scene.input.gamepad.getPad(this.gamepadIndex)
  }

  _keyIsDown(action) {
    return this.keys[action]?.some((key) => key.isDown) ?? false
  }

  update() {
    const pad = this.pad

    let left = this._keyIsDown('left')
    let right = this._keyIsDown('right')
    let jump = this._keyIsDown('jump')
    let run = this._keyIsDown('run')
    let down = this._keyIsDown('down')
    let action = this._keyIsDown('action')

    if (pad?.connected) {
      const stickX = pad.leftStick?.x ?? 0
      if (Math.abs(stickX) > GAMEPAD_DEADZONE) {
        left = left || stickX < 0
        right = right || stickX > 0
      }
      left = left || pad.left
      right = right || pad.right
      down = down || pad.down
      jump = jump || pad.A || pad.B
      run = run || pad.Y || pad.R1
      action = action || pad.X
    }

    if (this.touchState) {
      left = left || this.touchState.left
      right = right || this.touchState.right
      jump = jump || this.touchState.jump
      run = run || this.touchState.run
      action = action || this.touchState.action
    }

    this.state.left = left
    this.state.right = right
    this.state.jump = jump
    this.state.jumpDown = jump && !this._prevJump
    this.state.run = run
    this.state.down = down
    this.state.action = action
    this.state.actionDown = action && !this._prevAction
    this._prevJump = jump
    this._prevAction = action
  }

  /** True if any action is currently active — used for join-detection and idle tracking. */
  hasAnyInput() {
    const s = this.state
    return s.left || s.right || s.jump || s.run || s.down
  }
}
