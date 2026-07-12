import Phaser from 'phaser'
import {
  TILE_SIZE,
  LEVEL_CLEAR_BONUS,
  TIME_BONUS_MAX,
  TIME_BONUS_DECAY_PER_SECOND,
  WORLD_SCALE,
  GRAVITY_Y,
  WATER_GRAVITY_SCALE,
  FIREBALL_SPEED,
  PLAYER_JUMP_VELOCITY,
} from '../config/constants.js'
import { Pipe } from '../entities/Pipe.js'
import { AudioManager } from '../systems/AudioManager.js'
import { CoopManager } from '../systems/CoopManager.js'
import { ScoreManager } from '../systems/ScoreManager.js'
import { SaveManager } from '../systems/SaveManager.js'
import { Mochi } from '../entities/enemies/Mochi.js'
import { ShellBuddy } from '../entities/enemies/ShellBuddy.js'
import { IceShell } from '../entities/enemies/IceShell.js'
import { Bat } from '../entities/enemies/Bat.js'
import { GearMochi } from '../entities/enemies/GearMochi.js'
import { CandySlimeKing } from '../entities/enemies/CandySlimeKing.js'
import { SovereignSlime } from '../entities/enemies/SovereignSlime.js'
import { Conveyor } from '../entities/Conveyor.js'
import { FlameJet } from '../entities/FlameJet.js'
import { CrumblePlatform } from '../entities/CrumblePlatform.js'
import { Coin } from '../entities/items/Coin.js'
import { Mushroom } from '../entities/items/Mushroom.js'
import { FireFlower } from '../entities/items/FireFlower.js'
import { Star } from '../entities/items/Star.js'
import { Lantern } from '../entities/items/Lantern.js'
import { DarknessLayer } from '../systems/DarknessLayer.js'
import { QuestionBlock } from '../entities/QuestionBlock.js'
import { Brick } from '../entities/Brick.js'
import { Fireball } from '../entities/Fireball.js'
import { MovingPlatform } from '../entities/MovingPlatform.js'
import { CheckpointManager } from '../systems/CheckpointManager.js'
import { DualSwitchChest } from '../entities/DualSwitchChest.js'
import { TimedDoor } from '../entities/TimedDoor.js'
import { TouchControls } from '../input/TouchControls.js'
import { LEVELS } from '../config/levels.js'
import { MISC_ART, backgroundArtFor } from '../config/assets.js'
import { tryArtSprite } from '../utils/artSwap.js'

const FLAGPOLE_HEIGHT_TILES = 9
// Extra headroom added above the level's own bounds so the camera has real
// room to scroll into on tall/desktop viewports — without this, Phaser's own
// bounds-clamping forces scrollY to exactly 0 whenever a level is shorter
// than the viewport, which pins the *top* of the level to the screen (ground
// ends up floating in the middle) instead of letting the ground sit at the
// bottom. See CoopManager._updateCamera() for the other half of this fix.
const CAMERA_VERTICAL_PADDING = 3000 * WORLD_SCALE
const ENEMY_TYPES = {
  mochi: Mochi,
  shellbuddy: ShellBuddy,
  iceshell: IceShell,
  bat: Bat,
  gearmochi: GearMochi,
  candyslimeking: CandySlimeKing,
}
const ITEM_TYPES = { coin: Coin, mushroom: Mushroom, fireflower: FireFlower, star: Star, lantern: Lantern }

// --- Darkness / lantern (2-2, see DarknessLayer + LEVELS2.md) ---
const LANTERN_DURATION_MS = 12000
const LANTERN_RADIUS_SCALE = 1.8
const STAR_LIGHT_RADIUS_SCALE = 1.6
const BUBBLE_LIGHT_RADIUS_TILES = 1.8

// --- Grass texture strip (Q版萌 placeholder art, see _addGrassTexture) ---
const GRASS_BAND_HEIGHT = 6 * WORLD_SCALE
const GRASS_BAND_Y_OFFSET = 3 * WORLD_SCALE
const GRASS_TUFT_SPACING = 16 * WORLD_SCALE
const GRASS_TUFT_TRI = [-6 * WORLD_SCALE, 6 * WORLD_SCALE, 0, -5 * WORLD_SCALE, 6 * WORLD_SCALE, 6 * WORLD_SCALE]

// --- Background cloud clusters (see _addBackgroundClouds) ---
const CLOUD_WORLD_WIDTH_PER_CLOUD = 500 * WORLD_SCALE
const CLOUD_X_JITTER = 60 * WORLD_SCALE
const CLOUD_Y_BASE = 60 * WORLD_SCALE
const CLOUD_Y_STEP = 40 * WORLD_SCALE
const CLOUD_ELLIPSE_MAIN_W = 60 * WORLD_SCALE
const CLOUD_ELLIPSE_MAIN_H = 32 * WORLD_SCALE
const CLOUD_ELLIPSE_SIDE_W = 40 * WORLD_SCALE
const CLOUD_ELLIPSE_SIDE_H = 24 * WORLD_SCALE
const CLOUD_ELLIPSE_SIDE_OFFSET_X = 26 * WORLD_SCALE
const CLOUD_ELLIPSE_SIDE_OFFSET_Y = 6 * WORLD_SCALE

// --- Flagpole (see _addFlagpole, _checkFlagpole) ---
const FLAGPOLE_POLE_WIDTH = 6 * WORLD_SCALE
const FLAGPOLE_FLAG_X_OFFSET = 12 * WORLD_SCALE
const FLAGPOLE_FLAG_TRI = [0, -12 * WORLD_SCALE, 0, 12 * WORLD_SCALE, 22 * WORLD_SCALE, 0]
// Classic "grab the pole higher up for more points" — split into 5 bands
// from bottom (lowest tier) to top (highest tier), like the original game's
// fixed 100/400/800/2000/5000 tiers, just rescaled to this game's economy.
const FLAGPOLE_HEIGHT_BONUS_TIERS = [0, 100, 200, 300, 400]
// Visual tick marks + point values printed down the right side of the pole
// so players can actually see where each scoring band is (see _addFlagpoleScoreMarks).
const FLAGPOLE_SCORE_MARK_TICK_LENGTH = 16 * WORLD_SCALE
const FLAGPOLE_SCORE_MARK_TICK_THICKNESS = 3 * WORLD_SCALE
const FLAGPOLE_SCORE_MARK_TICK_COLOR = 0xffe066
const FLAGPOLE_SCORE_MARK_LABEL_GAP = 4 * WORLD_SCALE
const FLAGPOLE_SCORE_MARK_FONT_SIZE = `${13 * WORLD_SCALE}px`

// --- Checkpoint markers (see _addCheckpoints) ---
const CHECKPOINT_POLE_Y_OFFSET = 24 * WORLD_SCALE
const CHECKPOINT_POLE_WIDTH = 4 * WORLD_SCALE
const CHECKPOINT_POLE_HEIGHT = 48 * WORLD_SCALE
const CHECKPOINT_FLAG_Y_OFFSET = 48 * WORLD_SCALE
const CHECKPOINT_FLAG_RADIUS = 6 * WORLD_SCALE

// --- Fireball spawn offset (see _spawnFireball) ---
const FIREBALL_SPAWN_OFFSET_PX = 12 * WORLD_SCALE
// Fireball center height above the shooter's FEET. It must sit inside the
// small patrol enemies' body band (Mochi is only 22px/66px-scaled tall) —
// spawning at the fire-form player's center (84px above ground) sent shots
// clean over every small enemy's head, made worse by the projectile's
// shrink-over-lifetime. 11px (pre-scale) centers it on a Mochi.
const FIREBALL_SPAWN_ABOVE_FEET_PX = 11 * WORLD_SCALE

// --- Stomp detection / bounce (see _handlePlayerEnemyCollision) ---
const STOMP_TOLERANCE_PX = 10 * WORLD_SCALE
const STOMP_BOUNCE_VELOCITY = 320 * WORLD_SCALE

// --- Brick-break debris (see _onBrickBreak) ---
const BRICK_CHIP_SIZE = 10 * WORLD_SCALE
const BRICK_CHIP_OFFSETS = [
  { dx: -14 * WORLD_SCALE, dy: -18 * WORLD_SCALE },
  { dx: 14 * WORLD_SCALE, dy: -18 * WORLD_SCALE },
  { dx: -14 * WORLD_SCALE, dy: 4 * WORLD_SCALE },
  { dx: 14 * WORLD_SCALE, dy: 4 * WORLD_SCALE },
]

// --- Moving-platform rider carry tolerances (see _applyPlatformCarry) ---
// How far a rider's feet may hang above / sink into the platform top and
// still be snapped flush onto it. The gap side must cover one frame of the
// fastest descending platform on a slow (30fps) frame, or the platform
// outruns its rider and drops them; the embed side just needs to catch
// collision-resolution slop.
const PLATFORM_CARRY_GAP_TOLERANCE_PX = 12 * WORLD_SCALE
const PLATFORM_CARRY_EMBED_TOLERANCE_PX = 6 * WORLD_SCALE
const PLATFORM_CARRY_X_MARGIN_PX = 4 * WORLD_SCALE

// --- P1/P2 stacking tolerance (see onP2Spawned's collider processCallback) ---
const PLAYER_STACK_TOLERANCE_PX = 10 * WORLD_SCALE

// --- Extra-life-per-coin-milestone (see _handlePlayerItemOverlap) ---
const COINS_PER_EXTRA_LIFE = 100
const ONE_UP_RISE_PX = 60 * WORLD_SCALE
const ONE_UP_FONT_SIZE = `${28 * WORLD_SCALE}px`

// --- Pipes / underwater warp (see _loadPipes, _checkPipeEntry, _updateWaterGravity) ---
const PIPE_WARP_FADE_MS = 200
// Sideways landing offset for the teammate carried along by a co-op warp —
// small enough that both still stand on the 2-tile-wide pipe mouth.
const PIPE_WARP_COMPANION_OFFSET_PX = 15 * WORLD_SCALE
const PIPE_TRAP_DAMAGE_COOLDOWN_MS = 800
const WATER_TINT_COLOR = 0x1f6fb2
const WATER_TINT_ALPHA = 0.28
// Added on top of world gravity to bring the total down to roughly
// WATER_GRAVITY_SCALE × normal — Arcade body gravity is additive with world
// gravity, so this offset is negative.
const WATER_GRAVITY_OFFSET = -(GRAVITY_Y * (1 - WATER_GRAVITY_SCALE))

// --- Ice zones (see _loadIceZones / LEVELS2.md 2-1) ---
const ICE_STRIP_THICKNESS = 8 * WORLD_SCALE
const ICE_STRIP_COLOR = 0xcfefff
const ICE_STRIP_ALPHA = 0.85

// --- Conveyors / flame jets / lava (2-3, LEVELS2.md) ---
const CONVEYOR_CARRY_Y_TOLERANCE_PX = 8 * WORLD_SCALE
const LAVA_COLOR = 0xff5a1f
const LAVA_TOP_COLOR = 0xffc93d
const LAVA_TOP_BAND_PX = 6 * WORLD_SCALE
const LAVA_TRIGGER_DEPTH_PX = 8 * WORLD_SCALE
const CONVEYOR_SWITCH_WIDTH = 28 * WORLD_SCALE
const CONVEYOR_SWITCH_HEIGHT = 6 * WORLD_SCALE
const CONVEYOR_SWITCH_OCCUPY_X_PX = 20 * WORLD_SCALE
const CONVEYOR_SWITCH_OCCUPY_Y_PX = 24 * WORLD_SCALE

// --- Wind gusts (2-4, LEVELS2.md) ---
const WIND_FORETELL_MS = 800
const WIND_PARTICLE_INTERVAL_MS = 90
const WIND_PARTICLE_CAP = 40
const WIND_PARTICLE_COLOR = 0xd9f7c9
const WIND_GROUNDED_SCALE = 0.5

/**
 * Loads a level from its JSON data file (see public/assets/maps/*.json,
 * schema documented in LEVELS.md) and builds ground/platforms/flagpole
 * from it — no more hand-coded test-track arrays (that was Phase 1/2 only).
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene')
  }

  init(data) {
    this.levelId = data.levelId
    // Carried over from levels already cleared this playthrough (see
    // _advanceAfterLevelComplete) so score/coins keep accumulating across
    // levels instead of resetting to 0 at every scene restart. Reset to 0
    // when a brand-new run starts (first level, or retrying after Game Over).
    this.priorScore = data.priorScore ?? 0
    this.priorCoins = data.priorCoins ?? 0
    // Power-up forms survive level transitions too — only losing a life
    // (CoopManager._loseLifeAndRespawn -> resetForm) reverts to small.
    this.priorForms = data.priorForms ?? null
  }

  /** Score already banked from cleared levels + the current level's live score. */
  get totalScore() {
    return this.priorScore + this.scoreManager.score
  }

  /** Coins banked from cleared levels + the current level's — what the HUD shows and the 1UP milestone counts. */
  get totalCoins() {
    return this.priorCoins + this.scoreManager.coins
  }

  create() {
    const level = this.cache.json.get(`level-${this.levelId}`)
    this.level = level
    this.levelComplete = false
    // Not carried across restarts — a warp fade interrupted by level change
    // must not leave warps permanently locked.
    this._pipeWarpInProgress = false

    const worldWidth = level.widthTiles * TILE_SIZE
    const worldHeight = level.heightTiles * TILE_SIZE
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight)
    // Bottom world edge is NOT solid — falling past it is a real pit
    // (co-op bubble / shared-life loss), not an invisible floor.
    this.physics.world.setBoundsCollision(true, true, true, false)

    // A full hand-drawn background image (config/assets.js backgroundArtFor,
    // see ART.md) replaces the procedural sky/clouds entirely for that level.
    this._bgArtKey = backgroundArtFor(this.levelId).key
    if (this.textures.exists(this._bgArtKey)) {
      this.add.image(worldWidth / 2, worldHeight / 2, this._bgArtKey).setDisplaySize(worldWidth, worldHeight).setDepth(-20)
    } else {
      this._addBackgroundClouds(worldWidth)
    }

    this.groundGroup = this.physics.add.staticGroup()
    for (const span of level.groundSpans) {
      this._addGroundSpan(span.fromTile, span.toTile, span.tileY)
    }
    for (const platform of level.platforms) {
      this._addGroundSpan(platform.fromTile, platform.toTile, platform.tileY)
    }
    this._addFlagpole(level.flagpoleTile)
    this._loadEnemies(level.enemies ?? [])
    this._loadItemsAndBlocks(level.coins ?? [], level.questionBlocks ?? [], level.bricks ?? [])
    this._loadMovingPlatforms(level.movingPlatforms ?? [])
    this._addCheckpoints(level.checkpoints ?? [])
    this._loadDualSwitchChests(level.dualSwitchChests ?? [])
    this._loadTimedDoors(level.timedDoors ?? [])
    this._loadWaterZones(level.waterZones ?? [])
    this._loadIceZones(level.iceZones ?? [])
    this._loadPipes(level.pipes ?? [])
    for (const { x, y } of level.lanterns ?? []) {
      this._spawnItem('lantern', x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2)
    }
    this.darkness = level.darkness ? new DarknessLayer(this, level.darkness) : null
    this._loadConveyors(level.conveyors ?? [], level.conveyorSwitches ?? [])
    this.flameJets = (level.flameJets ?? []).map((cfg) => new FlameJet(this, cfg))
    this._loadLavaZones(level.lavaZones ?? [])
    this._loadWindGusts(level.windGusts ?? [])
    this.crumblePlatforms = (level.crumblePlatforms ?? []).map((cfg) => {
      const platform = new CrumblePlatform(this, cfg)
      this.groundGroup.add(platform.rect)
      return platform
    })
    // 2-5 twin-boss arena (see LEVELS2.md): solo = blue then red relay,
    // co-op = both at once with lower hp each.
    this.sovereignFight = level.sovereigns ? { cfg: level.sovereigns, state: 'waiting', bosses: [], walls: [] } : null

    this.startTime = this.time.now
    this.scoreManager = new ScoreManager()
    this.saveManager = new SaveManager()

    const audioManager = new AudioManager(this)
    this.audioManager = audioManager
    audioManager.startBgm(this.levelId)
    this.events.once('shutdown', () => audioManager.stopBgm())

    // Virtual d-pad/buttons for touch devices — only drives P1 (a second
    // on-screen control set for local co-op on one phone screen isn't a
    // realistic use case; P2 stays keyboard/gamepad-only).
    this.touchControls = this.sys.game.device.input.touch ? new TouchControls(this) : null
    this.events.once('shutdown', () => this.touchControls?.destroy())

    this.coop = new CoopManager(this, {
      spawnX: level.spawnTile.x * TILE_SIZE + TILE_SIZE / 2,
      spawnY: level.spawnTile.y * TILE_SIZE + TILE_SIZE / 2,
      groundGroup: this.groundGroup,
      worldHeight,
      audioManager,
      checkpointManager: this.checkpointManager,
      touchState: this.touchControls?.state,
      onP2Spawned: (p2) => {
        // First join this level — restore the form carried from the last one.
        if (this.priorForms?.p2) p2.applyForm(this.priorForms.p2)
        this._wirePlayerCollisions(p2)
        // Lets one player stand on the other's head (LEVELS.md 1-2 co-op
        // bonus) without letting them shove each other around side-by-side —
        // the processCallback only allows the collision to actually resolve
        // when one player's feet are right at the other's head height (true
        // vertical stacking); plain side-by-side overlap (same height) skips
        // resolution entirely, so walking into a teammate just passes through.
        this.physics.add.collider(this.coop.p1.rect, p2.rect, null, (rectA, rectB) => {
          const [top, bottom] = rectA.y < rectB.y ? [rectA, rectB] : [rectB, rectA]
          const gap = top.y + top.height / 2 - (bottom.y - bottom.height / 2)
          return Math.abs(gap) < PLAYER_STACK_TOLERANCE_PX
        })
      },
      onFireRequested: (player) => this._spawnFireball(player),
      onGameOver: () => this._onGameOver(),
    })
    this._wirePlayerCollisions(this.coop.p1)
    if (this.priorForms?.p1) this.coop.p1.applyForm(this.priorForms.p1)

    this.cameras.main.setBounds(0, worldHeight - CAMERA_VERTICAL_PADDING, worldWidth, CAMERA_VERTICAL_PADDING)
    this.cameras.main.fadeIn(250, 0, 0, 0)
    // ScaleManager is game-global — its listeners survive scene restarts, so
    // they must be removed on shutdown or every restart stacks another set
    // pointing at that run's (destroyed) objects.
    this.scale.on('resize', this._handleResize, this)
    this.events.once('shutdown', () => this.scale.off('resize', this._handleResize, this))

    this.levelCompleteText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, '', {
        fontFamily: 'sans-serif',
        fontSize: '32px',
        color: '#2e8b57',
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2000)
    const recenterCompleteText = (gameSize) => {
      this.levelCompleteText.setPosition(gameSize.width / 2, gameSize.height / 2)
    }
    this.scale.on('resize', recenterCompleteText)
    this.events.once('shutdown', () => this.scale.off('resize', recenterCompleteText))
    // Tap/click the completion text itself as a mouse/touch-friendly way to
    // advance — the keyboard/gamepad hint alone isn't discoverable for
    // pointer-only play, so this doubles as the "choose to continue" affordance.
    this.levelCompleteText.setInteractive({ useHandCursor: true })
    this.levelCompleteText.on('pointerdown', () => {
      if (this.levelComplete) this._advanceAfterLevelComplete()
    })

    // Polled (not a one-shot 'keydown-SPACE' listener) so a Space press that
    // was already held down at the moment the level completed still counts —
    // matches the gamepad-A poll below for consistent behavior.
    this.spaceKey = this.input.keyboard.addKey('SPACE')

    this.scene.launch('HUDScene', { gameScene: this })
  }

  _addGroundSpan(fromTile, toTile, tileY) {
    const widthTiles = toTile - fromTile
    const width = widthTiles * TILE_SIZE
    const x = fromTile * TILE_SIZE + width / 2
    const y = tileY * TILE_SIZE + TILE_SIZE / 2
    const rect = this.add.rectangle(x, y, width, TILE_SIZE, 0x6abf4b)
    this.physics.add.existing(rect, true)
    this.groundGroup.add(rect)

    // Real ground art (config/assets.js MISC_ART.ground, see ART.md) tiles
    // seamlessly across the span instead of stretching, since spans vary a
    // lot in width — tileSprite repeats the source image rather than
    // distorting it. Skips the procedural grass overlay in that case since
    // the tile art is expected to already include its own top edge detail.
    if (this.textures.exists(MISC_ART.ground.key)) {
      this.add.tileSprite(x, y, width, TILE_SIZE, MISC_ART.ground.key)
      rect.setVisible(false)
    } else {
      this._addGrassTexture(x, y - TILE_SIZE / 2, width)
    }
  }

  /** Lighter grass band + scalloped tufts along a ground span's top edge (Q版萌 texture, no real tiles yet). */
  _addGrassTexture(centerX, topY, width) {
    this.add.rectangle(centerX, topY + GRASS_BAND_Y_OFFSET, width, GRASS_BAND_HEIGHT, 0x8adf6b)
    const count = Math.max(1, Math.round(width / GRASS_TUFT_SPACING))
    const left = centerX - width / 2
    for (let i = 0; i < count; i++) {
      const tx = left + (i + 0.5) * (width / count)
      this.add.triangle(tx, topY, ...GRASS_TUFT_TRI, 0x8adf6b)
    }
  }

  /** Soft parallax cloud clusters scattered across the sky — cheap placeholder scenery. */
  _addBackgroundClouds(worldWidth) {
    const cloudCount = Math.max(4, Math.round(worldWidth / CLOUD_WORLD_WIDTH_PER_CLOUD))
    const hasCloudArt = this.textures.exists(MISC_ART.cloud.key)
    for (let i = 0; i < cloudCount; i++) {
      const x = ((i + 0.5) / cloudCount) * worldWidth + (i % 2 === 0 ? -CLOUD_X_JITTER : CLOUD_X_JITTER)
      const y = CLOUD_Y_BASE + (i % 3) * CLOUD_Y_STEP
      const scale = 0.8 + (i % 3) * 0.25
      const cloud = hasCloudArt
        ? tryArtSprite(this, x, y, MISC_ART.cloud, CLOUD_ELLIPSE_MAIN_W * 2 * scale, CLOUD_ELLIPSE_MAIN_H * 2 * scale)
        : this.add.container(x, y, [
            this.add.ellipse(0, 0, CLOUD_ELLIPSE_MAIN_W * scale, CLOUD_ELLIPSE_MAIN_H * scale, 0xffffff, 0.9),
            this.add.ellipse(
              -CLOUD_ELLIPSE_SIDE_OFFSET_X * scale,
              CLOUD_ELLIPSE_SIDE_OFFSET_Y * scale,
              CLOUD_ELLIPSE_SIDE_W * scale,
              CLOUD_ELLIPSE_SIDE_H * scale,
              0xffffff,
              0.9,
            ),
            this.add.ellipse(
              CLOUD_ELLIPSE_SIDE_OFFSET_X * scale,
              CLOUD_ELLIPSE_SIDE_OFFSET_Y * scale,
              CLOUD_ELLIPSE_SIDE_W * scale,
              CLOUD_ELLIPSE_SIDE_H * scale,
              0xffffff,
              0.9,
            ),
          ])
      cloud.setScrollFactor(0.3, 0.3)
      cloud.setDepth(-10)
    }
  }

  _addFlagpole(tile) {
    const x = tile.x * TILE_SIZE + TILE_SIZE / 2
    const bottomY = tile.y * TILE_SIZE + TILE_SIZE
    const topY = bottomY - FLAGPOLE_HEIGHT_TILES * TILE_SIZE
    const poleHeight = bottomY - topY
    if (this.textures.exists(MISC_ART.flagpole.key)) {
      this.add.image(x, (topY + bottomY) / 2, MISC_ART.flagpole.key).setDisplaySize(FLAGPOLE_POLE_WIDTH, poleHeight)
    } else {
      this.add.rectangle(x, (topY + bottomY) / 2, FLAGPOLE_POLE_WIDTH, poleHeight, 0xf2f2f2)
    }
    if (this.textures.exists(MISC_ART.flag.key)) {
      this.add.image(x + FLAGPOLE_FLAG_X_OFFSET, topY + FLAGPOLE_FLAG_X_OFFSET, MISC_ART.flag.key).setDisplaySize(44 * WORLD_SCALE, 24 * WORLD_SCALE)
    } else {
      this.add.triangle(x + FLAGPOLE_FLAG_X_OFFSET, topY + FLAGPOLE_FLAG_X_OFFSET, ...FLAGPOLE_FLAG_TRI, 0xffe066)
    }
    // Generous overlap box around the pole — touching anywhere along its
    // height counts, matching classic "slide down the flagpole" leniency.
    this.flagpoleBounds = new Phaser.Geom.Rectangle(x - TILE_SIZE / 2, topY, TILE_SIZE, bottomY - topY)
    this._addFlagpoleScoreMarks(x, topY, bottomY)
  }

  /**
   * Tick + point-value label for each of FLAGPOLE_HEIGHT_BONUS_TIERS' bands,
   * positioned at the vertical midpoint of the y-range that band actually
   * covers (must match _flagpoleTouchRatio/_onLevelComplete's math exactly,
   * or the marks would lie about where each score kicks in).
   */
  _addFlagpoleScoreMarks(x, topY, bottomY) {
    const height = bottomY - topY
    const tierCount = FLAGPOLE_HEIGHT_BONUS_TIERS.length
    const markX = x + TILE_SIZE / 2 + FLAGPOLE_SCORE_MARK_TICK_LENGTH / 2
    for (let i = 0; i < tierCount; i++) {
      const ratioMid = (i + 0.5) / tierCount
      const y = topY + height * (1 - ratioMid)
      this.add.rectangle(markX, y, FLAGPOLE_SCORE_MARK_TICK_LENGTH, FLAGPOLE_SCORE_MARK_TICK_THICKNESS, FLAGPOLE_SCORE_MARK_TICK_COLOR)
      this.add
        .text(markX + FLAGPOLE_SCORE_MARK_TICK_LENGTH / 2 + FLAGPOLE_SCORE_MARK_LABEL_GAP, y, `+${FLAGPOLE_HEIGHT_BONUS_TIERS[i]}`, {
          fontFamily: 'sans-serif',
          fontSize: FLAGPOLE_SCORE_MARK_FONT_SIZE,
          color: '#2d2d2d',
        })
        .setOrigin(0, 0.5)
    }
  }

  // RESIZE scale mode resizes the canvas automatically but leaves the
  // scene's camera viewport alone — this keeps the camera filling it,
  // including when the browser itself is toggled fullscreen.
  _handleResize(gameSize) {
    this.cameras.main.setSize(gameSize.width, gameSize.height)
  }

  _loadMovingPlatforms(platformData) {
    this.movingPlatforms = []
    // NOTE: Group membership re-applies these as *defaults* to every member
    // on add (Phaser's createCallbackHandler) — without them here, adding the
    // platform's rect silently resets allowGravity/immovable back to true/false
    // regardless of what the MovingPlatform constructor set.
    this.movingPlatformGroup = this.physics.add.group({ allowGravity: false, immovable: true })
    for (const { x, y, widthTiles = 3, rangeXTiles = 0, rangeYTiles = 0, speed = 60 } of platformData) {
      const platform = new MovingPlatform(this, x * TILE_SIZE + (widthTiles * TILE_SIZE) / 2, y * TILE_SIZE + TILE_SIZE / 2, {
        width: widthTiles * TILE_SIZE,
        height: TILE_SIZE,
        rangeX: rangeXTiles * TILE_SIZE,
        rangeY: rangeYTiles * TILE_SIZE,
        // Level JSON speeds are authored in original (pre-scale) px/s, same
        // unit LEVELS.md uses (~50px/s clouds) — scale them like every other
        // speed constant, or platforms crawl at 1/WORLD_SCALE of the design.
        speed: speed * WORLD_SCALE,
      })
      this.movingPlatforms.push(platform)
      this.movingPlatformGroup.add(platform.rect)
      // Re-assert the one-way faces after group.add — checkCollision isn't
      // in the Group-defaults reset list today, but this session has been
      // burned three times by add() silently reverting body settings, so
      // keep the platform's contract explicit here rather than trusting it.
      platform.body.checkCollision.down = false
      platform.body.checkCollision.left = false
      platform.body.checkCollision.right = false
    }
    this.physics.add.collider(this.enemyGroup, this.movingPlatformGroup)
    this.physics.add.collider(this.itemsGroup, this.movingPlatformGroup)
  }

  _addCheckpoints(checkpointData) {
    const checkpoints = checkpointData.map(({ x, y }) => ({
      x: x * TILE_SIZE + TILE_SIZE / 2,
      y: y * TILE_SIZE + TILE_SIZE / 2,
    }))
    this.checkpointManager = new CheckpointManager(checkpoints)
    for (const cp of checkpoints) {
      this.add.rectangle(cp.x, cp.y - CHECKPOINT_POLE_Y_OFFSET, CHECKPOINT_POLE_WIDTH, CHECKPOINT_POLE_HEIGHT, 0x8fd3ff)
      this.add.circle(cp.x, cp.y - CHECKPOINT_FLAG_Y_OFFSET, CHECKPOINT_FLAG_RADIUS, 0x8fd3ff)
    }
  }

  _loadDualSwitchChests(chestData) {
    this.dualSwitchChests = chestData.map(({ plateA, plateB, chestX, chestY, reward }) => {
      const chest = new DualSwitchChest(this, {
        plateA: { x: plateA.x * TILE_SIZE + TILE_SIZE / 2, y: plateA.y * TILE_SIZE + TILE_SIZE / 2 },
        plateB: { x: plateB.x * TILE_SIZE + TILE_SIZE / 2, y: plateB.y * TILE_SIZE + TILE_SIZE / 2 },
        chestX: chestX * TILE_SIZE + TILE_SIZE / 2,
        chestY: chestY * TILE_SIZE + TILE_SIZE / 2,
        rewardType: reward,
        onOpen: (type, x, y) => this._spawnItem(type, x, y),
      })
      // The chest is a solid box players can stand on/bump into — add its
      // hitbox to the same ground collision group as everything else solid.
      this.groundGroup.add(chest.chestRect)
      return chest
    })
  }

  _loadTimedDoors(doorData) {
    this.timedDoors = doorData.map(
      ({ switchX, switchY, doorX, doorY, doorHeightTiles, openDurationMs }) =>
        new TimedDoor(this, {
          switchX: switchX * TILE_SIZE + TILE_SIZE / 2,
          switchY: switchY * TILE_SIZE + TILE_SIZE / 2,
          doorX: doorX * TILE_SIZE + TILE_SIZE / 2,
          doorY: doorY * TILE_SIZE + TILE_SIZE / 2,
          doorHeightTiles,
          openDurationMs,
        }),
    )
  }

  /**
   * Tinted swim regions (see config schema `waterZones`) — also drives the
   * swim-gravity check in _updateWaterGravity. Default是整列全高；可选
   * `fromTileY`/`toTileY` 把水体限制在某个高度带（纵版关的"蓄水井"，2-4）。
   */
  _loadWaterZones(zoneData) {
    this.waterZones = zoneData.map(({ fromTile, toTile, fromTileY, toTileY }) => {
      const left = fromTile * TILE_SIZE
      const right = toTile * TILE_SIZE
      const top = (fromTileY ?? 0) * TILE_SIZE
      const bottom = (toTileY ?? this.level.heightTiles) * TILE_SIZE
      const overlay = this.add
        .rectangle((left + right) / 2, (top + bottom) / 2, right - left, bottom - top, WATER_TINT_COLOR, WATER_TINT_ALPHA)
        .setDepth(-5)
      return { left, right, top, bottom, overlay }
    })
  }

  _isInWater(x, y) {
    return this.waterZones.some((z) => x >= z.left && x <= z.right && y >= z.top && y <= z.bottom)
  }

  /**
   * Ice patches (2-1, LEVELS2.md) — x-ranges where grounded movement slides.
   * `tileY` in the data is only for drawing the highlight strip on that
   * span's top edge; the physics check is x-range + standing.
   */
  _loadIceZones(zoneData) {
    this.iceZones = zoneData.map(({ fromTile, toTile, tileY }) => {
      const left = fromTile * TILE_SIZE
      const right = toTile * TILE_SIZE
      if (tileY !== undefined) {
        this.add
          .rectangle((left + right) / 2, tileY * TILE_SIZE + ICE_STRIP_THICKNESS / 2, right - left, ICE_STRIP_THICKNESS, ICE_STRIP_COLOR, ICE_STRIP_ALPHA)
          .setDepth(-2)
      }
      return { left, right }
    })
  }

  _updateIceState(player) {
    player._onIce =
      this.iceZones.length > 0 &&
      (player.body.onFloor() || !!player._ridingPlatform) &&
      this.iceZones.some((z) => player.rect.x >= z.left && player.rect.x <= z.right)
  }

  _loadConveyors(conveyorData, switchData) {
    this.conveyors = conveyorData.map((cfg) => new Conveyor(this, cfg))
    this._conveyorsPausedUntil = 0
    this.conveyorSwitches = switchData.map(({ x, y, pauseMs = 6000 }) => {
      const sx = x * TILE_SIZE + TILE_SIZE / 2
      const sy = y * TILE_SIZE + TILE_SIZE / 2
      const rect = this.add.rectangle(sx, sy, CONVEYOR_SWITCH_WIDTH, CONVEYOR_SWITCH_HEIGHT, 0xff8c42)
      return { x: sx, y: sy, pauseMs, rect }
    })
  }

  /** 岩浆池：可见的即死液面（替代深坑）。触面走掉命/泡泡全套规则，敌人触面直接消灭。 */
  _loadLavaZones(zoneData) {
    this.lavaZones = zoneData.map(({ fromTile, toTile, tileY }) => {
      const left = fromTile * TILE_SIZE
      const right = toTile * TILE_SIZE
      const surfaceY = tileY * TILE_SIZE
      const depth = this.level.heightTiles * TILE_SIZE - surfaceY
      this.add.rectangle((left + right) / 2, surfaceY + depth / 2, right - left, depth, LAVA_COLOR, 0.92).setDepth(-1)
      this.add.rectangle((left + right) / 2, surfaceY + LAVA_TOP_BAND_PX / 2, right - left, LAVA_TOP_BAND_PX, LAVA_TOP_COLOR, 0.95)
      return { left, right, surfaceY }
    })
  }

  /** 传送带对"站在带面上"的玩家/敌人/道具附加位移；开关踩住则全部暂停。 */
  _applyConveyors(time, delta) {
    if (this.conveyors.length === 0) return
    // switch check first (uses whichever players are active)
    const activeRects = [
      this.coop.p1Bubble ? null : this.coop.p1.rect,
      this.coop.p2Joined && !this.coop.p2Bubble ? this.coop.p2.rect : null,
    ].filter(Boolean)
    for (const sw of this.conveyorSwitches) {
      const occupied = activeRects.some(
        (r) =>
          Math.abs(r.x - sw.x) < CONVEYOR_SWITCH_OCCUPY_X_PX &&
          Math.abs(r.y + r.height / 2 - sw.y) < CONVEYOR_SWITCH_OCCUPY_Y_PX,
      )
      if (occupied) {
        if (time >= this._conveyorsPausedUntil) this.audioManager?.playSwitch()
        this._conveyorsPausedUntil = time + sw.pauseMs
      }
      sw.rect.setFillStyle(time < this._conveyorsPausedUntil ? 0x66bb6a : 0xff8c42)
    }
    const paused = time < this._conveyorsPausedUntil
    for (const belt of this.conveyors) belt.update(delta, paused)
    if (paused) return

    const dt = delta / 1000
    const riders = []
    for (const p of [this.coop.p1, this.coop.p2Joined ? this.coop.p2 : null]) {
      if (p && p.rect.visible && p.body.enable && !p._ridingPlatform) riders.push({ rect: p.rect, body: p.body })
    }
    for (const e of this.enemies) if (!e.dead && e.rect.scene) riders.push({ rect: e.rect, body: e.body })
    for (const it of this.items) if (!it.dead && it.allowGravity) riders.push({ rect: it.rect, body: it.body })

    for (const belt of this.conveyors) {
      const shift = belt.dir * belt.speed * dt
      for (const r of riders) {
        if (r.rect.x < belt.left || r.rect.x > belt.right) continue
        const feet = r.rect.y + r.rect.height / 2
        if (Math.abs(feet - belt.top) > CONVEYOR_CARRY_Y_TOLERANCE_PX) continue
        // Move the game object ONLY — Body.preUpdate re-syncs the body from
        // the transform next step. Calling updateFromGameObject() here as
        // well makes Body.postUpdate see the shift as body motion and add it
        // to the game object AGAIN (empirically exactly 2× belt speed).
        r.rect.x += shift
      }
    }
  }

  /**
   * 阵风带（2-4/2-5）：周期循环 静风 → 前兆(粒子) → 阵风(横推)。
   * Y 带为主（纵版塔楼）；可选 fromTile/toTile 限制 x 范围（横版风廊）。
   */
  _loadWindGusts(gustData) {
    this.windGusts = gustData.map((cfg) => ({
      top: cfg.fromTileY * TILE_SIZE,
      bottom: cfg.toTileY * TILE_SIZE,
      left: (cfg.fromTile ?? 0) * TILE_SIZE,
      right: (cfg.toTile ?? this.level.widthTiles) * TILE_SIZE,
      dir: cfg.dir,
      force: cfg.forcePx * WORLD_SCALE,
      periodMs: cfg.periodMs,
      gustMs: cfg.gustMs,
      phase: cfg.phaseMs ?? 0,
      lastParticleAt: 0,
    }))
    this._windParticleCount = 0
  }

  _windPhase(gust, time) {
    const t = (time + gust.phase) % gust.periodMs
    if (t < WIND_FORETELL_MS) return 'foretell'
    if (t < WIND_FORETELL_MS + gust.gustMs) return 'gust'
    return 'calm'
  }

  /**
   * Sets each player's per-frame wind velocity bias (consumed by
   * Player.update as a shift of the movement equilibrium — airborne feels
   * the full bias, grounded half). Also drifts leaf particles through the
   * camera view during foretell+gust so the wind is readable before it hits.
   */
  _updateWind(time, activePlayers) {
    if (this.windGusts.length === 0) return
    for (const p of activePlayers) p._windVelX = 0
    const cam = this.cameras.main
    for (const gust of this.windGusts) {
      const phase = this._windPhase(gust, time)
      if (phase === 'calm') continue
      // particles (foretell + gust) — only when the band intersects the view
      if (
        gust.bottom > cam.scrollY &&
        gust.top < cam.scrollY + cam.height &&
        gust.right > cam.scrollX &&
        gust.left < cam.scrollX + cam.width &&
        time - gust.lastParticleAt > WIND_PARTICLE_INTERVAL_MS &&
        this._windParticleCount < WIND_PARTICLE_CAP
      ) {
        gust.lastParticleAt = time
        this._windParticleCount++
        const y = Phaser.Math.Between(Math.max(gust.top, cam.scrollY), Math.min(gust.bottom, cam.scrollY + cam.height))
        const spawnLeft = Math.max(gust.left, cam.scrollX) - 20
        const spawnRight = Math.min(gust.right, cam.scrollX + cam.width) + 20
        const startX = gust.dir > 0 ? spawnLeft : spawnRight
        const leaf = this.add
          .rectangle(startX, y, 10 * WORLD_SCALE, 3 * WORLD_SCALE, WIND_PARTICLE_COLOR, 0.8)
          .setDepth(5)
        this.tweens.add({
          targets: leaf,
          x: gust.dir > 0 ? spawnRight : spawnLeft,
          y: y + Phaser.Math.Between(-40, 40),
          alpha: 0.2,
          duration: phase === 'gust' ? 500 : 900,
          onComplete: () => {
            leaf.destroy()
            this._windParticleCount--
          },
        })
      }
      if (phase !== 'gust') continue
      for (const p of activePlayers) {
        if (p.rect.y >= gust.top && p.rect.y <= gust.bottom && p.rect.x >= gust.left && p.rect.x <= gust.right) {
          p._windVelX += gust.dir * gust.force
        }
      }
    }
  }

  /** 双子 Boss 战编排：进房触发 → 封墙 → 生成 →（单人）蓝亡红入 → 全灭开墙。 */
  _updateSovereignFight(time, activePlayers) {
    const fight = this.sovereignFight
    if (!fight) return
    const { triggerTile, wallTiles, spawnTile, spawnTile2 } = fight.cfg

    const spawnBoss = (variant, tileX, hp) => {
      const boss = new SovereignSlime(this, tileX * TILE_SIZE + TILE_SIZE / 2, spawnTile.y * TILE_SIZE + TILE_SIZE / 2, {
        groundGroup: this.groundGroup,
        variant,
        hp,
      })
      this.enemies.push(boss)
      this.enemyGroup.add(boss.rect)
      fight.bosses.push(boss)
      return boss
    }

    if (fight.state === 'waiting') {
      if (!activePlayers.some((p) => p.rect.x > triggerTile * TILE_SIZE)) return
      fight.state = this.coop.p2Joined ? 'duo' : 'blue'
      for (const wx of wallTiles) {
        const wall = this.add.rectangle(wx * TILE_SIZE + TILE_SIZE / 2, (spawnTile.y - 2) * TILE_SIZE, TILE_SIZE, 8 * TILE_SIZE, 0x3a2b3f)
        this.physics.add.existing(wall, true)
        this.groundGroup.add(wall)
        fight.walls.push(wall)
      }
      if (fight.state === 'duo') {
        spawnBoss('blue', spawnTile.x, 2)
        spawnBoss('red', spawnTile2.x, 2)
      } else {
        spawnBoss('blue', spawnTile.x, 3)
      }
      this.audioManager?.playHurt() // menacing sting placeholder
      return
    }
    if (fight.state === 'blue') {
      if (fight.bosses[0]?.dead) {
        fight.state = 'red'
        spawnBoss('red', spawnTile2.x, 3)
      }
      return
    }
    if ((fight.state === 'red' || fight.state === 'duo') && fight.bosses.every((b) => b.dead)) {
      fight.state = 'done'
      for (const wall of fight.walls) {
        wall.body.enable = false
        this.tweens.add({ targets: wall, alpha: 0, duration: 500, onComplete: () => wall.destroy() })
      }
      this.audioManager?.play1Up() // victory sting placeholder
    }
  }

  /** 喷火柱伤害（与 PipeTrap 同一套手动 AABB + 共享 800ms 危害冷却）。 */
  _checkFlameJets(player, who) {
    if (!player.rect.visible || player.isStarActive()) return
    const now = this.time.now
    if (player._pipeTrapCooldownUntil > now) return
    for (const jet of this.flameJets) {
      if (!jet.isDangerous) continue
      const b = jet.getBounds()
      const pb = player.rect.getBounds()
      if (pb.right > b.left && pb.left < b.right && pb.bottom > b.top && pb.top < b.bottom) {
        player._pipeTrapCooldownUntil = now + PIPE_TRAP_DAMAGE_COOLDOWN_MS
        if (!player.isHitInvincible() && player.takeHit()) this.coop.handlePlayerDown(who)
        return
      }
    }
  }

  /** 岩浆触面判定：玩家=掉命（同深坑规则，星星也不豁免），敌人=消灭。 */
  _checkLava() {
    if (this.lavaZones.length === 0) return
    const players = [
      this.coop.p1Bubble ? null : this.coop.p1,
      this.coop.p2Joined && !this.coop.p2Bubble ? this.coop.p2 : null,
    ].filter(Boolean)
    for (const zone of this.lavaZones) {
      for (const p of players) {
        if (!p.rect.visible) continue
        const feet = p.rect.y + p.rect.height / 2
        if (p.rect.x >= zone.left && p.rect.x <= zone.right && feet > zone.surfaceY + LAVA_TRIGGER_DEPTH_PX) {
          this.coop.handlePlayerDown(this._whoFor(p))
        }
      }
      for (const e of this.enemies) {
        if (e.dead || !e.rect.scene) continue
        const feet = e.rect.y + e.rect.height / 2
        if (e.rect.x >= zone.left && e.rect.x <= zone.right && feet > zone.surfaceY + LAVA_TRIGGER_DEPTH_PX) {
          e.onHitByShell()
        }
      }
    }
  }

  /** Floatier "swimming" gravity while a player falls inside a water zone — reverted the instant they leave. */
  _updateWaterGravity(player) {
    const inWater = this.waterZones.length > 0 && this._isInWater(player.rect.x, player.rect.y)
    if (inWater === player._inWater) return
    player._inWater = inWater
    player.body.setGravityY(inWater ? WATER_GRAVITY_OFFSET : 0)
  }

  _loadPipes(pipeData) {
    this.pipes = []
    const byId = new Map()
    for (const data of pipeData) {
      // NOTE: this must be the ground's TOP surface (groundTileY * TILE_SIZE),
      // not one tile lower — rooting the pipe any deeper would make its own
      // solid body overlap the ground tile's solid body by that much,
      // the exact "two overlapping static bodies" bug already hit once with
      // moving platforms (see LEVELS.md §0): Arcade Physics gets confused
      // resolving two solids sharing the same space and the player just
      // falls through both, landing wherever the *other* solid's surface is.
      const groundY = data.groundTileY * TILE_SIZE
      const pipe = new Pipe(this, data.x * TILE_SIZE + TILE_SIZE / 2, groundY, {
        widthTiles: data.widthTiles ?? 2,
        heightTiles: data.heightTiles ?? 3,
        hasTrap: !!data.hasTrap,
        enterable: !!data.enterable,
        trapPhaseOffsetMs: data.trapPhaseOffsetMs ?? 0,
        tileSize: TILE_SIZE,
      })
      this.pipes.push(pipe)
      this.groundGroup.addMultiple(pipe.rects)
      if (data.id) byId.set(data.id, pipe)
      pipe._warpToId = data.warpToId
    }
    // Resolve warpToId -> the actual destination Pipe instance once every
    // pipe in this level exists, regardless of declaration order.
    for (const pipe of this.pipes) {
      if (pipe._warpToId) pipe.warpTarget = byId.get(pipe._warpToId) ?? null
    }
  }

  /**
   * Player standing on an enterable pipe's mouth + pressing down warps them
   * to its linked pipe's mouth. Requires a *fresh* down-press (edge
   * detection via _pipePrevDown, mirroring InputManager's own jumpDown/
   * actionDown pattern) rather than "is down currently held" — otherwise a
   * player holding Down through the fade would land exactly on the linked
   * pipe's mouth still holding Down and immediately warp right back, an
   * instant A→B→A loop.
   */
  _checkPipeEntry(player) {
    const down = !!player.inputManager?.state.down
    const justPressed = down && !player._pipePrevDown
    player._pipePrevDown = down
    if (!justPressed || !player.rect.visible || !player.body.onFloor()) return
    for (const pipe of this.pipes) {
      if (!pipe.enterable || !pipe.warpTarget || !pipe.isPlayerAtMouth(player.rect)) continue
      this._warpPlayerToPipe(player, pipe.warpTarget)
      return
    }
  }

  /**
   * Warps the initiating player AND any active teammate together — co-op
   * never splits across the warp (user request: P1 entering takes P2 along,
   * and coming back out brings both out). The initiator lands centered on
   * the destination mouth, the teammate slightly to the side so they don't
   * stack. A bubbled teammate is skipped (they're not in play; their bubble
   * timer/rescue flow continues unchanged).
   */
  _warpPlayerToPipe(initiator, destinationPipe) {
    if (this._pipeWarpInProgress) return // both players triggering the same frame
    this._pipeWarpInProgress = true
    this.audioManager?.playPipeWarp()
    this.cameras.main.fadeOut(PIPE_WARP_FADE_MS, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const travellers = [
        this.coop.p1Bubble ? null : this.coop.p1,
        this.coop.p2Joined && !this.coop.p2Bubble ? this.coop.p2 : null,
      ].filter(Boolean)
      for (const player of travellers) {
        const offsetX = player === initiator ? 0 : PIPE_WARP_COMPANION_OFFSET_PX
        player.teleportTo(destinationPipe.x + offsetX, destinationPipe.mouthY - player.rect.height / 2 - 2)
      }
      this._pipeWarpInProgress = false
      this.cameras.main.fadeIn(PIPE_WARP_FADE_MS, 0, 0, 0)
    })
  }

  /** Manual overlap check against any currently-extended clamp trap — same "unconditional hazard" rule as touching a moving shell. */
  _checkPipeTraps(player, who) {
    if (!player.rect.visible || player.isStarActive()) return
    const now = this.time.now
    if (player._pipeTrapCooldownUntil > now) return
    for (const pipe of this.pipes) {
      if (!pipe.trap?.isDangerous) continue
      const b = pipe.trap.getBounds()
      const pb = player.rect.getBounds()
      const overlaps = pb.right > b.left && pb.left < b.right && pb.bottom > b.top && pb.top < b.bottom
      if (!overlaps) continue
      player._pipeTrapCooldownUntil = now + PIPE_TRAP_DAMAGE_COOLDOWN_MS
      if (!player.isHitInvincible() && player.takeHit()) this.coop.handlePlayerDown(who)
      return
    }
  }

  _loadEnemies(enemyData) {
    this.enemies = []
    this.enemyGroup = this.physics.add.group()
    for (const { type, x, y } of enemyData) {
      const EnemyClass = ENEMY_TYPES[type]
      if (!EnemyClass) continue
      const enemy = new EnemyClass(this, x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, {
        groundGroup: this.groundGroup,
      })
      this.enemies.push(enemy)
      this.enemyGroup.add(enemy.rect)
      // Group defaults reset allowGravity on add — restore flyers (Bat).
      if (enemy.noGravity) enemy.body.setAllowGravity(false)
    }
    this.physics.add.collider(this.enemyGroup, this.groundGroup)
    this.physics.add.collider(this.enemyGroup, this.enemyGroup, (rectA, rectB) => {
      const a = rectA.getData('enemyRef')
      const b = rectB.getData('enemyRef')
      if (!a || !b || a.dead || b.dead) return
      const aIsShellMoving = a.state === 'shell_moving'
      const bIsShellMoving = b.state === 'shell_moving'

      // Credit the chain kill to whoever kicked the shell in the first place,
      // not nobody — a kicked shell is still that player's kill.
      if (aIsShellMoving && !bIsShellMoving) {
        b.onHitByShell()
        if (b.dead && a.kickedBy) this.scoreManager.addKill(this._whoFor(a.kickedBy))
        return
      }
      if (bIsShellMoving && !aIsShellMoving) {
        a.onHitByShell()
        if (a.dead && b.kickedBy) this.scoreManager.addKill(this._whoFor(b.kickedBy))
        return
      }

      // Two ordinary patrollers (any mix of types) walked into each other —
      // without this they just shove against one another forever (Arcade's
      // default collision separation fights their own walk velocity every
      // frame), which looks like two different enemies glued together and
      // creeping along at a crawl. Bounce them apart: whichever is on the
      // left heads further left, whichever is on the right heads further
      // right. Assigning by side (not toggling) keeps this stable even
      // though the callback re-fires every frame the two remain touching.
      if (a.direction !== undefined && b.direction !== undefined) {
        const aOnLeft = a.rect.x <= b.rect.x
        a.direction = aOnLeft ? -1 : 1
        b.direction = aOnLeft ? 1 : -1
      }
    })
  }

  _loadItemsAndBlocks(coinData, blockData, brickData) {
    this.items = []
    // Items have mixed gravity needs (coin/fire flower float, mushroom/star
    // fall) so the group can't use one gravity default for all of them —
    // _spawnItem() re-applies each item's own setting after group.add()
    // resets it to the group default (see the movingPlatformGroup comment
    // above for why that reset happens at all).
    this.itemsGroup = this.physics.add.group()
    this.fireballs = []
    this.fireballGroup = this.physics.add.group({ allowGravity: false })

    for (const { x, y } of coinData) {
      this._spawnItem('coin', x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2)
    }

    this.blocksGroup = this.physics.add.staticGroup()
    for (const { x, y, item } of blockData) {
      const block = new QuestionBlock(this, x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, {
        itemType: item,
        onSpawnItem: (type, ix, iy) => this._spawnItem(type, ix, iy),
        onCoinAward: (player, ix, iy) => this._awardBlockCoin(player, ix, iy),
      })
      this.blocksGroup.add(block.rect)
    }
    for (const { x, y, coin } of brickData) {
      const brick = new Brick(this, x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, {
        hasCoin: !!coin,
        onCoinAward: (player, ix, iy) => this._awardBlockCoin(player, ix, iy),
        onBreak: (bx, by) => this._onBrickBreak(bx, by),
      })
      this.blocksGroup.add(brick.rect)
    }

    this.physics.add.collider(this.itemsGroup, this.groundGroup)
    this.physics.add.collider(this.fireballGroup, this.enemyGroup, (fireballRect, enemyRect) => {
      const fireball = fireballRect.getData('fireballRef')
      const enemy = enemyRect.getData('enemyRef')
      if (!fireball || fireball.dead || !enemy || enemy.dead) return
      enemy.onHitByShell()
      fireball.destroy()
      // A boss soaks partial ranged hits — only an actual kill scores.
      if (enemy.dead && fireball.owner) this.scoreManager.addKill(this._whoFor(fireball.owner))
    })
  }

  _spawnItem(type, x, y) {
    const ItemClass = ITEM_TYPES[type]
    if (!ItemClass) return
    const item = new ItemClass(this, x, y)
    this.items.push(item)
    this.itemsGroup.add(item.rect)
    // Group membership resets allowGravity to the group default on add —
    // restore each item's own setting (coin/fire flower float, mushroom/star fall).
    item.body.setAllowGravity(item.allowGravity)
  }

  _spawnFireball(player) {
    const offsetX = player.facing * (player.rect.width / 2 + FIREBALL_SPAWN_OFFSET_PX)
    const spawnY = player.rect.y + player.rect.height / 2 - FIREBALL_SPAWN_ABOVE_FEET_PX
    const fireball = new Fireball(this, player.rect.x + offsetX, spawnY, player.facing)
    fireball.owner = player
    this.fireballs.push(fireball)
    this.fireballGroup.add(fireball.rect)
    // Group membership re-applies the group's defaults on add — velocityX/Y
    // default to 0 since fireballGroup's config only specifies allowGravity,
    // which was silently zeroing out the launch velocity set in the Fireball
    // constructor (same "group defaults override on add" gotcha as moving
    // platforms/items — see PLAN.md §7 item 9). Re-assert it after adding.
    fireball.body.setVelocityX(player.facing * FIREBALL_SPEED)
    // Overlap (not collider): the shot dies the moment it touches ANY solid,
    // including when it spawns already embedded in one — firing point-blank
    // at a pipe used to bury the fireball deeper than Arcade's max-overlap
    // separation limit, which skips separation entirely and let the shot
    // sail straight through the pipe and hit things on the far side.
    this.physics.add.overlap(fireball.rect, this.groundGroup, () => fireball.destroy())
  }

  _wirePlayerCollisions(player) {
    this.physics.add.collider(player.rect, this.enemyGroup, (playerRect, enemyRect) =>
      this._handlePlayerEnemyCollision(playerRect, enemyRect),
    )
    this.physics.add.overlap(player.rect, this.itemsGroup, (playerRect, itemRect) =>
      this._handlePlayerItemOverlap(playerRect, itemRect),
    )
    this.physics.add.collider(player.rect, this.blocksGroup, (playerRect, blockRect) =>
      this._handlePlayerBlockCollision(playerRect, blockRect),
    )
    this.physics.add.collider(player.rect, this.movingPlatformGroup)
    for (const door of this.timedDoors) {
      this.physics.add.collider(player.rect, door.doorRect)
    }
  }

  /** Maps a Player instance (not a rect) back to its 'p1'/'p2' key. */
  _whoFor(player) {
    return player === this.coop.p1 ? 'p1' : 'p2'
  }

  _handlePlayerEnemyCollision(playerRect, enemyRect) {
    const enemy = enemyRect.getData('enemyRef')
    if (!enemy || enemy.dead) return
    const player = playerRect === this.coop.p1.rect ? this.coop.p1 : this.coop.p2
    const who = playerRect === this.coop.p1.rect ? 'p1' : 'p2'

    // NOTE: don't gate this on body.velocity.y > 0 — Arcade Physics already
    // resolves/zeroes velocity during collision separation *before* this
    // callback runs, so that check is always false here. body.touching.down
    // correctly reflects "just landed on something" for this same step.
    const playerBottom = player.rect.y + player.rect.height / 2
    const enemyTop = enemyRect.y - enemyRect.height / 2
    const isStomp = player.body.touching.down && playerBottom <= enemyTop + STOMP_TOLERANCE_PX
    if (isStomp) {
      enemy.onStomp(player)
      player.body.setVelocityY(-STOMP_BOUNCE_VELOCITY)
      this.audioManager?.playStomp()
      // ShellBuddy stomps just change state (tuck in / kick) without dying —
      // only award kill score when the stomp actually finished it off. A
      // kicked shell records its kicker (see ShellBuddy._kick) so a later
      // chain kill still credits this player, not this stomp itself.
      if (enemy.dead) this.scoreManager.addKill(who)
      return
    }

    const wouldDamage = enemy.onSideTouch(player)
    if (!wouldDamage) return
    if (player.isStarActive()) {
      enemy.onHitByShell()
      this.scoreManager.addKill(who)
    } else if (!player.isHitInvincible() && player.takeHit()) {
      this.coop.handlePlayerDown(who)
    }
  }

  _handlePlayerItemOverlap(playerRect, itemRect) {
    const item = itemRect.getData('itemRef')
    if (!item || item.dead) return
    const player = playerRect === this.coop.p1.rect ? this.coop.p1 : this.coop.p2
    const who = playerRect === this.coop.p1.rect ? 'p1' : 'p2'

    switch (item.type) {
      case 'coin':
        this._collectCoin(player, who)
        break
      case 'mushroom':
        player.grow()
        this.audioManager?.playPowerUp()
        break
      case 'fireflower':
        player.powerUpFire()
        this.audioManager?.playPowerUp()
        break
      case 'star':
        player.startStar()
        this.audioManager?.playPowerUp()
        break
      case 'lantern': {
        player.lanternUntil = this.time.now + LANTERN_DURATION_MS
        this.audioManager?.playPowerUp()
        const hint = this.add
          .text(player.rect.x, player.rect.y - player.rect.height, '✨ 视野增强', {
            fontFamily: 'sans-serif', fontSize: `${16 * WORLD_SCALE}px`, color: '#d7ff8a', stroke: '#3a4a00', strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(1500)
        this.tweens.add({ targets: hint, y: hint.y - 40 * WORLD_SCALE, alpha: 0, duration: 900, onComplete: () => hint.destroy() })
        break
      }
    }
    item.destroy()
  }

  /** Credits a coin to `who` (score + 1UP milestone + sfx) — shared by world coins and block payouts. */
  _collectCoin(player, who) {
    // Milestone counts the cross-level running total, matching what the HUD
    // shows — with per-level counting, 100 coins was practically unreachable.
    const coinsBefore = this.totalCoins
    this.scoreManager.addCoin(who)
    this.audioManager?.playCoin()
    if (Math.floor(coinsBefore / COINS_PER_EXTRA_LIFE) < Math.floor(this.totalCoins / COINS_PER_EXTRA_LIFE)) {
      this._award1Up(player)
    }
  }

  /**
   * A coin knocked out of a brick/question block is credited to the bumping
   * player immediately (classic Mario behavior) — the old version spawned a
   * collectible coin floating above the block, which was easy to miss and
   * made block coins look like they never scored. A short rise-and-fade
   * animation keeps the visual payoff.
   */
  _awardBlockCoin(player, x, y) {
    this._collectCoin(player, this._whoFor(player))
    const coin = this.add.circle(x, y, 9 * WORLD_SCALE, 0xffd700).setDepth(1500)
    this.tweens.add({
      targets: coin,
      y: y - 60 * WORLD_SCALE,
      alpha: 0,
      duration: 450,
      ease: 'Sine.easeOut',
      onComplete: () => coin.destroy(),
    })
  }

  /** Every COINS_PER_EXTRA_LIFE coins collected — classic "1UP" floating text + a shared bonus life. */
  _award1Up(player) {
    this.coop.addExtraLife()
    this.audioManager?.play1Up()
    const text = this.add
      .text(player.rect.x, player.rect.y - player.rect.height / 2, '★1UP', {
        fontFamily: 'sans-serif',
        fontSize: ONE_UP_FONT_SIZE,
        color: '#ffe066',
        stroke: '#7a4a00',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(1500)
    this.tweens.add({
      targets: text,
      y: text.y - ONE_UP_RISE_PX,
      alpha: 0,
      duration: 900,
      onComplete: () => text.destroy(),
    })
  }

  _handlePlayerBlockCollision(playerRect, blockRect) {
    const block = blockRect.getData('blockRef')
    if (!block || block.used) return
    const player = playerRect === this.coop.p1.rect ? this.coop.p1 : this.coop.p2
    if (!player.body.touching.up) return
    this.audioManager?.playBlockBump()
    block.bump(player)
  }

  /** Small flying debris + a score bump — the visual payoff for breaking a brick. */
  _onBrickBreak(x, y) {
    this.scoreManager.addBonus(50)
    this.audioManager?.playBrickBreak()
    for (const { dx, dy } of BRICK_CHIP_OFFSETS) {
      const chip = this.add.rectangle(x, y, BRICK_CHIP_SIZE, BRICK_CHIP_SIZE, 0xc9702f)
      this.tweens.add({
        targets: chip,
        x: x + dx * 2.2,
        y: y + dy * 2.2,
        alpha: 0,
        rotation: dx > 0 ? 3 : -3,
        duration: 350,
        onComplete: () => chip.destroy(),
      })
    }
  }

  update(time, delta) {
    if (this.levelComplete) {
      const pad = this.input.gamepad?.getPad(0)
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey) || pad?.A) {
        if (!this._levelCompleteAdvancing) this._advanceAfterLevelComplete()
      }
      return
    }
    this.coop.update(time, delta)
    // NOTE: pass `time` — CandySlimeKing's attack timers and Bat's swoop
    // state machine are time-driven (plain patrollers just ignore the arg).
    for (const enemy of this.enemies) enemy.update(time)
    for (const item of this.items) item.update()
    for (const fireball of this.fireballs) fireball.update(time)
    for (const platform of this.movingPlatforms) platform.update()
    this._applyPlatformCarry()
    // Priority ordering (LEVELS2.md §3 风险预判): platform glue > conveyor >
    // wind > ice — conveyors run after carry so a glued rider is exempt.
    this._applyConveyors(time, delta)
    for (const jet of this.flameJets) jet.update(time)
    this._checkLava()
    for (const pipe of this.pipes) pipe.update(time)
    {
      const crumbleRiders = [this.coop.p1, this.coop.p2Joined ? this.coop.p2 : null].filter(Boolean)
      for (const cp of this.crumblePlatforms) cp.update(time, crumbleRiders)
    }

    const activePlayers = [
      this.coop.p1Bubble ? null : this.coop.p1,
      this.coop.p2Joined && !this.coop.p2Bubble ? this.coop.p2 : null,
    ].filter(Boolean)
    for (const player of activePlayers) {
      this._checkPipeEntry(player)
      this._checkPipeTraps(player, this._whoFor(player))
      this._checkFlameJets(player, this._whoFor(player))
      this._updateWaterGravity(player)
      this._updateIceState(player)
    }
    this._updateWind(time, activePlayers)
    this._updateSovereignFight(time, activePlayers)

    if (this.dualSwitchChests.length > 0 || this.timedDoors.length > 0) {
      const activeRects = activePlayers.map((p) => p.rect)
      for (const chest of this.dualSwitchChests) {
        if (chest.update(activeRects)) this.audioManager?.playChestOpen()
      }
      for (const door of this.timedDoors) {
        if (door.update(time, activeRects)) this.audioManager?.playSwitch()
      }
    }

    if (!this.coop.gameOver) this._checkFlagpole()
    this._updateDarkness(time, activePlayers)
  }

  /** Collect this frame's light sources and stamp them out of the darkness layer. */
  _updateDarkness(time, activePlayers) {
    if (!this.darkness) return
    const lights = activePlayers.map((p) => {
      let scale = 1
      if (time < (p.lanternUntil ?? 0)) scale = LANTERN_RADIUS_SCALE
      else if (p.isStarActive()) scale = STAR_LIGHT_RADIUS_SCALE
      return { x: p.rect.x, y: p.rect.y, radius: this.darkness.baseRadius * scale }
    })
    for (const bubble of [this.coop.p1Bubble, this.coop.p2Bubble]) {
      if (bubble) lights.push({ x: bubble.x, y: bubble.y, radius: BUBBLE_LIGHT_RADIUS_TILES * TILE_SIZE })
    }
    this.darkness.update(lights)
  }

  // Arcade Physics doesn't automatically carry a rider standing on a
  // velocity-driven immovable body — glue anyone standing on top of it to
  // the platform's top surface each frame, tracked as an explicit riding
  // state (player._ridingPlatform, also read by Player.update for
  // grounded/jump checks).
  //
  // Two hard-won constraints shape this implementation:
  // 1. SNAP the rider's feet flush to the surface, never add the platform's
  //    per-frame delta. Additive carry pushes the rider *into* a descending
  //    platform a little deeper every frame; once the embed exceeds Arcade's
  //    max-overlap threshold (player delta + platform delta + OVERLAP_BIAS),
  //    separation gives up entirely and the rider free-falls straight
  //    through the platform — reproduced consistently on 1-3's vertical lift.
  // 2. Riding must be STICKY (only a real jump or walking off the side
  //    releases it). Relying on per-frame proximity alone drops the rider
  //    at the top of the lift's cycle: while being pushed up they carry the
  //    platform's upward velocity, so the moment it reverses they launch
  //    ballistically, then free-fall after the now-descending platform and
  //    tunnel through it exactly as in (1).
  _applyPlatformCarry() {
    if (this.movingPlatforms.length === 0) return
    const riders = [this.coop.p1, this.coop.p2Joined ? this.coop.p2 : null].filter(Boolean)
    for (const rider of riders) {
      if (!rider.rect.visible || !rider.body.enable || rider.body.velocity.y < -PLAYER_JUMP_VELOCITY / 2) {
        rider._ridingPlatform = null // gone (bubbled/warped) or jumped away
        continue
      }
      let attached = null
      for (const platform of this.movingPlatforms) {
        const withinX =
          rider.rect.x >= platform.rect.x - platform.rect.width / 2 - PLATFORM_CARRY_X_MARGIN_PX &&
          rider.rect.x <= platform.rect.x + platform.rect.width / 2 + PLATFORM_CARRY_X_MARGIN_PX
        if (!withinX) continue
        const platTop = platform.rect.y - platform.rect.height / 2
        const gap = platTop - (rider.rect.y + rider.rect.height / 2) // >0: feet above surface
        const wasRiding = rider._ridingPlatform === platform
        const withinY = gap > -PLATFORM_CARRY_EMBED_TOLERANCE_PX && gap < PLATFORM_CARRY_GAP_TOLERANCE_PX
        if (!withinY && !wasRiding) continue
        // First attach only while falling/standing — never snatch a player
        // who is jumping up past the platform.
        if (!wasRiding && rider.body.velocity.y < -1) continue
        attached = platform
        rider.rect.x += platform.deltaX
        rider.rect.y = platTop - rider.rect.height / 2
        rider.body.updateFromGameObject()
        // Position is authoritative while riding; residual velocity (e.g.
        // the ascent push) would just re-launch the rider at reversals.
        rider.body.setVelocityY(0)
        break
      }
      rider._ridingPlatform = attached
    }
  }

  _checkFlagpole() {
    const touching = (player) =>
      player.rect.visible && Phaser.Geom.Rectangle.Overlaps(player.rect.getBounds(), this.flagpoleBounds)
    let toucher = null
    if (touching(this.coop.p1)) toucher = this.coop.p1
    else if (this.coop.p2Joined && touching(this.coop.p2)) toucher = this.coop.p2
    if (toucher) this._onLevelComplete(toucher)
  }

  /** Height along the pole where `toucher` first made contact — 0 (bottom) to 1 (top). */
  _flagpoleTouchRatio(toucher) {
    const { y: top, height } = this.flagpoleBounds
    return Phaser.Math.Clamp(1 - (toucher.rect.y - top) / height, 0, 1)
  }

  /** Solo: one combined line. Co-op: each player's own (this-level) score + the running team total. */
  _buildScoreSummary(timeBonus, heightBonus, seconds) {
    const sm = this.scoreManager
    const total = this.totalScore
    if (!this.coop.p2Joined) {
      return (
        `总得分：${total}（本关 +${sm.score}，含限时奖励 +${timeBonus}、旗杆高度奖励 +${heightBonus}）　` +
        `金币：${this.totalCoins}（本关 +${sm.coins}）　用时：${seconds.toFixed(1)}s`
      )
    }
    const p1 = sm.perPlayer.p1
    const p2 = sm.perPlayer.p2
    return (
      `P1 本关得分：${sm.playerScore('p1')}（🪙${p1.coins} ⚔${p1.kills}）　` +
      `P2 本关得分：${sm.playerScore('p2')}（🪙${p2.coins} ⚔${p2.kills}）\n` +
      `团队总得分：${total}（本关 +${sm.score}，含限时奖励 +${timeBonus}、旗杆高度奖励 +${heightBonus}）　` +
      `金币：${this.totalCoins}（本关 +${sm.coins}）　用时：${seconds.toFixed(1)}s`
    )
  }

  _onLevelComplete(toucher) {
    this.levelComplete = true
    this._levelCompleteAdvancing = false
    this.coop.p1.setActive(false)
    if (this.coop.p2Joined) this.coop.p2.setActive(false)
    this.audioManager?.playFlagpole()

    const timeMs = this.time.now - this.startTime
    const seconds = timeMs / 1000
    // Time bonus decays with clear time so a short/easy level doesn't always
    // yield the exact same score when 100%-cleared the same way every run.
    const timeBonus = Math.max(0, TIME_BONUS_MAX - Math.floor(seconds) * TIME_BONUS_DECAY_PER_SECOND)
    // Height bonus: which of the 5 bands the pole was grabbed at, based on
    // the toucher's position the instant _checkFlagpole first detected the
    // overlap (not wherever they end up after sliding down).
    const tierCount = FLAGPOLE_HEIGHT_BONUS_TIERS.length
    const tierIndex = Math.min(tierCount - 1, Math.floor(this._flagpoleTouchRatio(toucher) * tierCount))
    const heightBonus = FLAGPOLE_HEIGHT_BONUS_TIERS[tierIndex]
    this.scoreManager.addBonus(LEVEL_CLEAR_BONUS + timeBonus + heightBonus)
    const { score, coins } = this.scoreManager
    const scoreSummary = this._buildScoreSummary(timeBonus, heightBonus, seconds)

    const levelIds = Object.keys(LEVELS)
    this._nextLevelId = levelIds[levelIds.indexOf(this.levelId) + 1]
    const retryHint = this._nextLevelId
      ? '按 Space / 手柄 A 键，或点击本段文字，进入下一关'
      : '🏆 全部关卡通关！按 Space / 手柄 A 键，或点击本段文字，查看总成绩'
    this.levelCompleteText.setText(`🎉 ${this.level.name} 通关！\n${scoreSummary}\n${retryHint}`)

    this.saveManager.unlockLevel(this.levelId)
    this.saveManager
      .recordLevelResult({ levelId: this.levelId, score, coins, timeMs, players: this.coop.p2Joined ? 2 : 1 })
      .then(({ isNewBest }) => {
        if (isNewBest) {
          this.levelCompleteText.setText(`🎉 ${this.level.name} 通关！\n${scoreSummary}\n✨ 打破历史最佳！\n${retryHint}`)
        }
      })
  }

  _advanceAfterLevelComplete() {
    if (this._levelCompleteAdvancing) return
    this._levelCompleteAdvancing = true
    this.scene.stop('HUDScene') // launched separately — restart() won't touch it on its own
    this.cameras.main.fadeOut(250, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (this._nextLevelId) {
        this.scene.restart({
          levelId: this._nextLevelId,
          priorScore: this.totalScore,
          priorCoins: this.totalCoins,
          priorForms: { p1: this.coop.p1.form, p2: this.coop.p2?.form ?? 'small' },
        })
      } else {
        // All levels cleared — show the run's final results instead of
        // silently looping back into level 1 (VictoryScene offers the restart).
        this.scene.start('VictoryScene', {
          score: this.totalScore,
          coins: this.totalCoins,
          coop: this.coop.p2Joined,
          p1Score: this.scoreManager.playerScore('p1'),
          p2Score: this.scoreManager.playerScore('p2'),
          p1: { ...this.scoreManager.perPlayer.p1 },
          p2: { ...this.scoreManager.perPlayer.p2 },
        })
      }
    })
  }

  _onGameOver() {
    this.scene.stop('HUDScene')
    this.cameras.main.fadeOut(250, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameOverScene', {
        levelId: this.levelId,
        score: this.totalScore,
        coins: this.totalCoins,
        // Per-player breakdown, only meaningful (and only shown) in co-op.
        coop: this.coop.p2Joined,
        p1Score: this.scoreManager.playerScore('p1'),
        p2Score: this.scoreManager.playerScore('p2'),
        p1: { ...this.scoreManager.perPlayer.p1 },
        p2: { ...this.scoreManager.perPlayer.p2 },
      })
    })
  }
}
