import {
  BUBBLE_RESCUE_WINDOW_MS,
  CAMERA_EDGE_MARGIN,
  CAMERA_LERP,
  HIT_INVINCIBLE_MS,
  P2_IDLE_LEAVE_MS,
  SHARED_LIVES_START,
  WORLD_SCALE,
} from '../config/constants.js'
import { Player } from '../entities/Player.js'
import { Bubble } from '../entities/Bubble.js'
import { InputManager, P2_KEYBOARD_BINDINGS } from '../input/InputManager.js'

const FALL_MARGIN = 80 * WORLD_SCALE
const P2_SPAWN_OFFSET_X = 48 * WORLD_SCALE
const BUBBLE_SPAWN_Y_OFFSET = 20 * WORLD_SCALE
const RESCUE_DISTANCE_PX = 40 * WORLD_SCALE

/**
 * Owns everything that only matters once a second player might be in the
 * picture: P2 join/leave, shared camera (midpoint + soft edge walls),
 * shared life pool, and bubble revive. Solo play runs through the exact
 * same code path (camera just follows P1, no bubbles ever spawn) so there
 * is only one set of rules to maintain (see PLAN.md Phase 2).
 */
export class CoopManager {
  constructor(
    scene,
    {
      spawnX,
      spawnY,
      groundGroup,
      worldHeight,
      audioManager,
      onGameOver,
      onP2Spawned,
      onFireRequested,
      checkpointManager,
      touchState,
    },
  ) {
    this.scene = scene
    this.spawnX = spawnX
    this.spawnY = spawnY
    this.groundGroup = groundGroup
    this.worldHeight = worldHeight
    this.audioManager = audioManager
    this.onGameOver = onGameOver
    this.onP2Spawned = onP2Spawned
    this.onFireRequested = onFireRequested
    this.checkpointManager = checkpointManager

    this.sharedLives = SHARED_LIVES_START
    this.gameOver = false

    this.p1Input = new InputManager(scene, { gamepadIndex: 0, touchState })
    this.p1 = new Player(scene, spawnX, spawnY, {
      skin: 'bunny',
      inputManager: this.p1Input,
      audioManager,
      onFireRequested,
    })
    scene.physics.add.collider(this.p1.rect, groundGroup)
    this.p1Bubble = null

    this.p2 = null
    this.p2Joined = false
    this.p2Bubble = null
    this.p2LastInputTime = 0
    // Watches for the join press even before P2 exists; once joined, the
    // same instance keeps driving P2 (whatever device pressed first "owns" P2).
    this.joinInput = new InputManager(scene, { keyboardBindings: P2_KEYBOARD_BINDINGS, gamepadIndex: 1 })

    this.cameraTarget = scene.add.rectangle(spawnX, spawnY, 1, 1, 0, 0)
    scene.cameras.main.startFollow(this.cameraTarget, true, CAMERA_LERP, CAMERA_LERP)

    // sharedLives/p2Joined are read directly by HUDScene each frame; game-over
    // screen is a full scene transition (GameOverScene) driven by onGameOver.
    this._joinArrow = scene.add
      .triangle(0, 0, 0, -10, 0, 10, 16, 0, 0xffe066)
      .setScrollFactor(0)
      .setVisible(false)
  }

  update(time, delta) {
    if (this.gameOver) return

    if (!this.p2Joined) {
      this.joinInput.update()
      if (this.joinInput.hasAnyInput()) this._spawnP2()
    }

    if (!this.p1Bubble) this.p1.update(time, delta)
    if (this.p2Joined && !this.p2Bubble) {
      this.p2.update(time, delta)
      if (this.joinInput.hasAnyInput()) this.p2LastInputTime = time
      else if (time - this.p2LastInputTime > P2_IDLE_LEAVE_MS) this._despawnP2(time)
    }

    this._checkFall(time, 'p1')
    if (this.p2Joined) this._checkFall(time, 'p2')

    this._updateBubble(time, 'p1')
    if (this.p2Joined) this._updateBubble(time, 'p2')

    if (this.checkpointManager) {
      if (!this.p1Bubble) this.checkpointManager.checkReached(this.p1.rect.x)
      if (this.p2Joined && !this.p2Bubble) this.checkpointManager.checkReached(this.p2.rect.x)
    }

    this._updateCamera()
  }

  _spawnP2() {
    if (this.p2Joined) return
    if (!this.p2) {
      this.p2 = new Player(this.scene, this.p1.rect.x - P2_SPAWN_OFFSET_X, this.p1.rect.y, {
        skin: 'cat',
        inputManager: this.joinInput,
        audioManager: this.audioManager,
        onFireRequested: this.onFireRequested,
      })
      this.scene.physics.add.collider(this.p2.rect, this.groundGroup)
      this.onP2Spawned?.(this.p2)
    } else {
      this.p2.teleportTo(this.p1.rect.x - P2_SPAWN_OFFSET_X, this.p1.rect.y)
      this.p2.setActive(true)
    }
    this.p2Joined = true
    this.p2LastInputTime = this.scene.time.now
  }

  _despawnP2(time) {
    this.p2Joined = false
    this.p2.setActive(false)
    const floatAway = new Bubble(this.scene, this.p2.rect.x, this.p2.rect.y)
    this.scene.time.delayedCall(1200, () => floatAway.destroy())
  }

  _checkFall(time, who) {
    const player = who === 'p1' ? this.p1 : this.p2
    if (player.rect.y <= this.worldHeight + FALL_MARGIN) return
    this.handlePlayerDown(who, time)
  }

  /**
   * Single entry point for "this player just went down" — used by falling
   * into a pit (_checkFall) and by enemy contact damage (Phase 4). Duo mode
   * bubbles them if the other player can still rescue; otherwise (or solo)
   * it's an instant shared-life loss + respawn.
   */
  handlePlayerDown(who, time = this.scene.time.now) {
    const bubble = who === 'p1' ? this.p1Bubble : this.p2Bubble
    if (bubble) return // already down, waiting on the bubble timer/rescue

    this.audioManager?.playHurt()
    const otherActive = who === 'p1' ? this.p2Joined && !this.p2Bubble : !this.p1Bubble
    if (this.p2Joined && otherActive) {
      this._spawnBubbleFor(who, time)
    } else {
      this._loseLifeAndRespawn(who)
    }
  }

  _spawnBubbleFor(who, time) {
    const player = who === 'p1' ? this.p1 : this.p2
    // Spawn where they last had solid ground, not their current (mid-air,
    // possibly over the same pit) position — otherwise the rescuer has to
    // cross the same hazard to reach them.
    const bubble = new Bubble(this.scene, player.lastSafeX, player.lastSafeY - BUBBLE_SPAWN_Y_OFFSET)
    bubble.spawnedAt = time
    player.setActive(false)
    this.audioManager?.playBubble()
    if (who === 'p1') this.p1Bubble = bubble
    else this.p2Bubble = bubble
  }

  _updateBubble(time, who) {
    const bubble = who === 'p1' ? this.p1Bubble : this.p2Bubble
    if (!bubble) return
    bubble.update(time)

    const rescuer = who === 'p1' ? this.p2 : this.p1
    const rescuerBubbled = who === 'p1' ? this.p2Bubble : this.p1Bubble
    const rescuerAvailable = who === 'p1' ? this.p2Joined && !rescuerBubbled : !rescuerBubbled
    if (rescuerAvailable) {
      const dx = bubble.x - rescuer.rect.x
      const dy = bubble.y - rescuer.rect.y
      if (Math.sqrt(dx * dx + dy * dy) < RESCUE_DISTANCE_PX) {
        this._rescue(who, bubble)
        return
      }
    }

    if (time - bubble.spawnedAt > BUBBLE_RESCUE_WINDOW_MS) {
      bubble.destroy()
      if (who === 'p1') this.p1Bubble = null
      else this.p2Bubble = null
      this._loseLifeAndRespawn(who)
    }
  }

  _rescue(who, bubble) {
    bubble.destroy()
    const player = who === 'p1' ? this.p1 : this.p2
    player.teleportTo(bubble.x, bubble.y)
    player.setActive(true)
    player.grantSpawnProtection(HIT_INVINCIBLE_MS)
    this.audioManager?.playRescue()
    if (who === 'p1') this.p1Bubble = null
    else this.p2Bubble = null
  }

  /** Every 100 coins collected (see GameScene._handlePlayerItemOverlap) grants the shared pool a bonus life. */
  addExtraLife() {
    this.sharedLives += 1
  }

  _loseLifeAndRespawn(who) {
    this.sharedLives -= 1
    if (this.sharedLives <= 0) {
      this._gameOver()
      return
    }
    const player = who === 'p1' ? this.p1 : this.p2
    const offsetX = who === 'p1' ? 0 : -P2_SPAWN_OFFSET_X
    const respawn = this.checkpointManager?.getRespawnPoint(this.spawnX, this.spawnY) ?? {
      x: this.spawnX,
      y: this.spawnY,
    }
    player.teleportTo(respawn.x + offsetX, respawn.y)
    player.resetForm()
    player.setActive(true)
    // AFTER resetForm (which zeroes invincibility) — see grantSpawnProtection.
    player.grantSpawnProtection(HIT_INVINCIBLE_MS)
  }

  _gameOver() {
    this.gameOver = true
    this.p1.setActive(false)
    if (this.p2Joined) this.p2.setActive(false)
    this.onGameOver?.()
  }

  _updateCamera() {
    const activePlayers = [
      !this.p1Bubble ? this.p1 : null,
      this.p2Joined && !this.p2Bubble ? this.p2 : null,
    ].filter(Boolean)

    if (activePlayers.length === 0) return

    const midX = activePlayers.reduce((sum, p) => sum + p.rect.x, 0) / activePlayers.length
    const midY = activePlayers.reduce((sum, p) => sum + p.rect.y, 0) / activePlayers.length

    // When the level's total height fits within the current viewport, pin
    // the camera so the level's bottom (the ground) sits at the bottom of
    // the screen instead of centering vertically on the players — otherwise
    // the ground floats in the middle/upper area with empty space below it
    // on any screen taller than the level. Only taller-than-viewport levels
    // (or tall sections) actually need real vertical follow.
    const viewportHeight = this.scene.scale.height
    const targetY = this.worldHeight <= viewportHeight ? this.worldHeight - viewportHeight / 2 : midY
    this.cameraTarget.setPosition(midX, targetY)

    if (!this.p2Joined) {
      this._joinArrow.setVisible(false)
      return
    }

    const view = this.scene.cameras.main.worldView
    if (activePlayers.length === 2) {
      for (const p of activePlayers) {
        if (p.rect.x < view.x + CAMERA_EDGE_MARGIN && p.body.velocity.x < 0) {
          p.body.setVelocityX(0)
        } else if (p.rect.x > view.right - CAMERA_EDGE_MARGIN && p.body.velocity.x > 0) {
          p.body.setVelocityX(0)
        }
        // Vertical soft wall — the tall tower level (2-4) lets players split
        // vertically; same rule as the horizontal edges: you can't move
        // further out of view, gravity/teammate movement re-converges you.
        if (p.rect.y < view.y + CAMERA_EDGE_MARGIN && p.body.velocity.y < 0) {
          p.body.setVelocityY(0)
        }
      }
    }
    this._updateJoinArrow(view)
  }

  _updateJoinArrow(view) {
    // Points toward whichever teammate (or their bubble) is currently off-screen.
    const p1X = this.p1Bubble ? this.p1Bubble.x : this.p1.rect.x
    const p2X = this.p2Bubble ? this.p2Bubble.x : this.p2.rect.x
    const targets = [p1X, p2X].filter((x) => x < view.x || x > view.right)

    if (targets.length === 0) {
      this._joinArrow.setVisible(false)
      return
    }
    const pointsRight = targets[0] > view.centerX
    const screenW = this.scene.scale.width
    const screenH = this.scene.scale.height
    this._joinArrow.setVisible(true)
    this._joinArrow.setPosition(pointsRight ? screenW - 20 : 20, screenH / 2)
    this._joinArrow.setRotation(pointsRight ? 0 : Math.PI)
  }
}
