const COIN_POINTS = 100
const KILL_POINTS = 200

/**
 * Tracks score for the current level run (see PLAN.md Phase 6/10). Coins and
 * kills are attributed per-player (`who` is 'p1' | 'p2') so co-op can show
 * each player's own contribution; `addBonus` (level-clear bonus, time bonus)
 * is a team achievement, not attributed to either player individually.
 */
export class ScoreManager {
  constructor() {
    this.perPlayer = {
      p1: { coins: 0, kills: 0 },
      p2: { coins: 0, kills: 0 },
    }
    this.bonus = 0
  }

  addCoin(who) {
    this.perPlayer[who].coins += 1
  }

  addKill(who) {
    this.perPlayer[who].kills += 1
  }

  addBonus(points) {
    this.bonus += points
  }

  /** This player's own score — their coins + kills only, not the shared bonus. */
  playerScore(who) {
    const p = this.perPlayer[who]
    return p.coins * COIN_POINTS + p.kills * KILL_POINTS
  }

  get coins() {
    return this.perPlayer.p1.coins + this.perPlayer.p2.coins
  }

  get kills() {
    return this.perPlayer.p1.kills + this.perPlayer.p2.kills
  }

  /** Team total: both players' own scores plus the shared bonus. */
  get score() {
    return this.playerScore('p1') + this.playerScore('p2') + this.bonus
  }
}
