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

  checkReached(playerX) {
    for (let i = this.reachedIndex + 1; i < this.checkpoints.length; i++) {
      if (playerX >= this.checkpoints[i].x) this.reachedIndex = i
    }
  }

  getRespawnPoint(defaultX, defaultY) {
    if (this.reachedIndex === -1) return { x: defaultX, y: defaultY }
    const cp = this.checkpoints[this.reachedIndex]
    return { x: cp.x, y: cp.y }
  }
}
