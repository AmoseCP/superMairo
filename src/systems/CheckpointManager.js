// A serpentine vertical level (e.g. 3-4's climb) revisits the same x-range
// at very different heights, so an x-only check can credit a checkpoint
// while the player is many tiles below/above its actual position (e.g.
// wandering the switch-block corridor at the checkpoint's x but 10+ tiles
// lower). Require the player be within this many px of the checkpoint's own
// height too — generous enough (>1 max jump rise) to still credit a normal
// horizontal level's checkpoint while the player is mid-jump across it.
const Y_TOLERANCE_PX = 384

/**
 * Tracks the furthest checkpoint any player has reached (pixel coords, in
 * level-progression order). Respawns after a life loss use this instead of
 * the level's original spawn point — but collected coins / triggered
 * mechanisms are untouched (see LEVELS.md checkpoint policy).
 */
export class CheckpointManager {
  constructor(checkpoints) {
    this.checkpoints = checkpoints
    this.reachedIndex = -1
  }

  checkReached(playerX, playerY) {
    for (let i = this.reachedIndex + 1; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i]
      if (playerX >= cp.x && Math.abs(playerY - cp.y) <= Y_TOLERANCE_PX) this.reachedIndex = i
    }
  }

  getRespawnPoint(defaultX, defaultY) {
    if (this.reachedIndex === -1) return { x: defaultX, y: defaultY }
    const cp = this.checkpoints[this.reachedIndex]
    return { x: cp.x, y: cp.y }
  }
}
