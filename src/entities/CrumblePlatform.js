import { TILE_SIZE, WORLD_SCALE } from '../config/constants.js'
import { MISC_ART } from '../config/assets.js'
import { tryArtSprite } from '../utils/artSwap.js'

const SHAKE_MS = 400
const RESPAWN_MS = 3000
const BODY_COLOR = 0xb8a08a
const CRACK_COLOR = 0x6e5a48
const CHIP_SIZE = 8 * WORLD_SCALE

/**
 * 碎裂平台（2-4，LEVELS2.md）——玩家站上 0.4s 后抖动掉渣，再碎裂消失，
 * 3s 后原位重生（重生前会等玩家让开，避免把人卡进实体）。敌人站立不触发。
 * 触发检测由 GameScene 每帧传入活跃玩家（见 _updateCrumblePlatforms）。
 */
export class CrumblePlatform {
  constructor(scene, { x, y, widthTiles = 3 }) {
    this.scene = scene
    const width = widthTiles * TILE_SIZE
    this.rect = scene.add.rectangle(x * TILE_SIZE + width / 2, y * TILE_SIZE + TILE_SIZE / 2, width, TILE_SIZE, BODY_COLOR)
    this.rect.setStrokeStyle(3 * WORLD_SCALE, CRACK_COLOR)
    scene.physics.add.existing(this.rect, true)
    this.state = 'intact' // intact | shaking | broken
    this.stateUntil = 0

    // Real art takes over when present; the optional "cracked" frame is
    // swapped in during the pre-break shake (see assets.js MISC_ART).
    this.artSprite = tryArtSprite(scene, this.rect.x, this.rect.y, MISC_ART.crumblePlatform, width, TILE_SIZE)
    if (this.artSprite) this.rect.setVisible(false)
    this._hasCrackedArt = !!this.artSprite && scene.textures.exists(MISC_ART.crumblePlatformCracked.key)
  }

  /** The currently-drawn shape (art if present, placeholder rect otherwise). */
  get _visual() {
    return this.artSprite ?? this.rect
  }

  _riderOn(players) {
    const top = this.rect.y - this.rect.height / 2
    const left = this.rect.x - this.rect.width / 2
    const right = this.rect.x + this.rect.width / 2
    return players.some((p) => {
      if (!p.rect.visible || !p.body.touching.down) return false
      const feet = p.rect.y + p.rect.height / 2
      return p.rect.x > left - 10 && p.rect.x < right + 10 && Math.abs(feet - top) < 8 * WORLD_SCALE
    })
  }

  _playerOverlaps(players) {
    const b = this.rect.getBounds()
    return players.some((p) => {
      const pb = p.rect.getBounds()
      return p.rect.visible && pb.right > b.left && pb.left < b.right && pb.bottom > b.top && pb.top < b.bottom
    })
  }

  update(time, players) {
    if (this.state === 'intact') {
      if (this._riderOn(players)) {
        this.state = 'shaking'
        this.stateUntil = time + SHAKE_MS
        if (this._hasCrackedArt) this.artSprite.setTexture(MISC_ART.crumblePlatformCracked.key)
        this.scene.tweens.add({ targets: this._visual, alpha: 0.55, duration: 80, yoyo: true, repeat: 4 })
      }
    } else if (this.state === 'shaking') {
      if (time >= this.stateUntil) {
        this.state = 'broken'
        this.stateUntil = time + RESPAWN_MS
        this.rect.body.enable = false
        this.rect.setVisible(false)
        this.artSprite?.setVisible(false)
        for (const dx of [-1, 0, 1]) {
          const chip = this.scene.add.rectangle(this.rect.x + dx * 20 * WORLD_SCALE, this.rect.y, CHIP_SIZE, CHIP_SIZE, BODY_COLOR)
          this.scene.tweens.add({
            targets: chip,
            y: chip.y + 120 * WORLD_SCALE,
            alpha: 0,
            rotation: dx * 2,
            duration: 420,
            onComplete: () => chip.destroy(),
          })
        }
      }
    } else if (this.state === 'broken') {
      // Wait until no player is inside the respawn volume, or we'd entomb them.
      if (time >= this.stateUntil && !this._playerOverlaps(players)) {
        this.state = 'intact'
        this.rect.body.enable = true
        this.rect.setVisible(!this.artSprite)
        this.rect.setAlpha(1)
        if (this.artSprite) {
          if (this._hasCrackedArt) this.artSprite.setTexture(MISC_ART.crumblePlatform.key)
          this.artSprite.setVisible(true)
          this.artSprite.setAlpha(1)
        }
      }
    }
  }
}
