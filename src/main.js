import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene.js'
import { GameScene } from './scenes/GameScene.js'
import { HUDScene } from './scenes/HUDScene.js'
import { GameOverScene } from './scenes/GameOverScene.js'
import { GRAVITY_Y } from './config/constants.js'

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: window.innerWidth,
  height: window.innerHeight,
  pixelArt: true,
  backgroundColor: '#87ceeb',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: GRAVITY_Y },
      debug: false,
    },
  },
  scale: {
    // Canvas always matches the current viewport — including when the
    // browser itself goes fullscreen, since that just makes the viewport
    // bigger and RESIZE tracks it (see GameScene's 'resize' listener,
    // which keeps the camera in sync with the new canvas size).
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  input: {
    gamepad: true,
  },
  scene: [BootScene, GameScene, HUDScene, GameOverScene],
})

// Dev/debug hook only (e.g. automated Playwright smoke tests reading scene state).
if (import.meta.env.DEV) {
  window.__PHASER_GAME__ = game
}
