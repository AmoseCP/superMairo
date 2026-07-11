import { TILE_SIZE, WORLD_SCALE } from '../config/constants.js'
import { MISC_ART } from '../config/assets.js'
import { tryArtSprite } from '../utils/artSwap.js'

const SWITCH_WIDTH = 28 * WORLD_SCALE
const SWITCH_HEIGHT = 6 * WORLD_SCALE
const DOOR_WIDTH = 14 * WORLD_SCALE
const SWITCH_OCCUPY_X_PX = 20 * WORLD_SCALE
const SWITCH_OCCUPY_Y_PX = 24 * WORLD_SCALE

/**
 * A pressure switch that opens a blocking door for a fixed window — see
 * LEVELS.md 1-4 "一人踩板/一人限时通过". Simplified vs. a true continuous
 * hold: stepping on the switch grants a fixed open duration regardless of
 * whether the switch keeps being held, which keeps the timing simple while
 * still capturing the "one commits, the other dashes through" co-op beat.
 */
export class TimedDoor {
  constructor(scene, { switchX, switchY, doorX, doorY, doorHeightTiles = 3, openDurationMs = 4000 }) {
    this.scene = scene
    this.openDurationMs = openDurationMs
    this.openUntil = -Infinity
    this.switchX = switchX
    this.switchY = switchY
    this.isOpen = false

    this.switchArt = tryArtSprite(scene, switchX, switchY, MISC_ART.switchPlate, SWITCH_WIDTH, SWITCH_HEIGHT)
    this.switchRect = this.switchArt ?? scene.add.rectangle(switchX, switchY, SWITCH_WIDTH, SWITCH_HEIGHT, 0xffb703)

    const doorHeight = doorHeightTiles * TILE_SIZE
    this.doorArt = tryArtSprite(scene, doorX, doorY, MISC_ART.door, DOOR_WIDTH, doorHeight)
    this.doorRect = scene.add.rectangle(doorX, doorY, DOOR_WIDTH, doorHeight, 0x8a5a2b)
    if (this.doorArt) this.doorRect.setVisible(false)
    scene.physics.add.existing(this.doorRect, true)
  }

  update(time, playerRects) {
    const onSwitch = playerRects.some(
      (r) => Math.abs(r.x - this.switchX) < SWITCH_OCCUPY_X_PX && Math.abs(r.y + r.height / 2 - this.switchY) < SWITCH_OCCUPY_Y_PX,
    )
    if (onSwitch) this.openUntil = time + this.openDurationMs

    const shouldBeOpen = time < this.openUntil
    let justOpened = false
    if (shouldBeOpen !== this.isOpen) {
      this.isOpen = shouldBeOpen
      this.doorRect.body.enable = !shouldBeOpen
      // doorRect stays the (invisible) physics body when real door art is
      // present — the art image is what's actually shown/hidden.
      this.doorRect.setVisible(!shouldBeOpen && !this.doorArt)
      this.doorArt?.setVisible(!shouldBeOpen)
      if (this.switchArt) this.switchArt.setTint(shouldBeOpen ? 0x66bb6a : 0xffffff)
      else this.switchRect.setFillStyle(shouldBeOpen ? 0x66bb6a : 0xffb703)
      justOpened = shouldBeOpen
    }
    return justOpened
  }
}
