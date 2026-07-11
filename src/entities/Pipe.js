import { WORLD_SCALE } from '../config/constants.js'
import { MISC_ART } from '../config/assets.js'
import { tryArtSprite } from '../utils/artSwap.js'
import { PipeTrap } from './PipeTrap.js'

const PIPE_COLOR = 0x3fae4f
const PIPE_DARK = 0x2c7a38
const COLLAR_HEIGHT = 24 * WORLD_SCALE
const COLLAR_OVERHANG = 10 * WORLD_SCALE
// How tall the "step here and press down" trigger zone is, measured down
// from the pipe's mouth — generous so it doesn't feel finicky to line up.
const MOUTH_ZONE_HEIGHT = 30 * WORLD_SCALE

/**
 * Classic green warp pipe: solid (player/enemies can stand on top, can't
 * walk through it), optionally hides a PipeTrap clamp that pops out of the
 * mouth, optionally "enterable" — stand on the mouth and press down to warp
 * (see GameScene._checkPipeEntry / _loadPipes). `x` is the pipe's world
 * center-x, `groundY` is the world-y of the ground surface it's rooted in
 * (its base), `heightTiles` is how many tiles it rises above that.
 */
export class Pipe {
  constructor(scene, x, groundY, { widthTiles = 2, heightTiles = 3, hasTrap = false, enterable = false, trapPhaseOffsetMs = 0, tileSize } = {}) {
    this.scene = scene
    this.x = x
    this.enterable = enterable
    const width = widthTiles * tileSize
    const height = heightTiles * tileSize
    const bodyHeight = height - COLLAR_HEIGHT
    const bodyCenterY = groundY - bodyHeight / 2
    const collarCenterY = groundY - bodyHeight - COLLAR_HEIGHT / 2
    this.mouthY = groundY - height

    const art = tryArtSprite(scene, x, groundY - height / 2, MISC_ART.pipe, width, height)
    if (art) {
      this.artSprite = art
      this.bodyRect = scene.add.rectangle(x, bodyCenterY, width, bodyHeight, 0, 0)
      this.collarRect = scene.add.rectangle(x, collarCenterY, width + COLLAR_OVERHANG * 2, COLLAR_HEIGHT, 0, 0)
    } else {
      this.bodyRect = scene.add.rectangle(x, bodyCenterY, width, bodyHeight, PIPE_COLOR)
      this.bodyRect.setStrokeStyle(3, PIPE_DARK)
      this.collarRect = scene.add.rectangle(x, collarCenterY, width + COLLAR_OVERHANG * 2, COLLAR_HEIGHT, PIPE_COLOR)
      this.collarRect.setStrokeStyle(3, PIPE_DARK)
    }
    scene.physics.add.existing(this.bodyRect, true)
    scene.physics.add.existing(this.collarRect, true)

    this.mouthBounds = { left: x - width / 2, right: x + width / 2, top: this.mouthY - MOUTH_ZONE_HEIGHT, bottom: this.mouthY + MOUTH_ZONE_HEIGHT }

    this.trap = hasTrap ? new PipeTrap(scene, x, this.mouthY, trapPhaseOffsetMs) : null
  }

  /** Static bodies for GameScene to add to its groundGroup — same convention as _addGroundSpan. */
  get rects() {
    return [this.bodyRect, this.collarRect]
  }

  update(time) {
    this.trap?.update(time)
  }

  isPlayerAtMouth(playerRect) {
    return (
      playerRect.x >= this.mouthBounds.left &&
      playerRect.x <= this.mouthBounds.right &&
      playerRect.y + playerRect.height / 2 >= this.mouthBounds.top &&
      playerRect.y + playerRect.height / 2 <= this.mouthBounds.bottom
    )
  }
}
