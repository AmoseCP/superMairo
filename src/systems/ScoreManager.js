const COIN_POINTS = 100
const KILL_POINTS = 200
// 不落地连踩的倍率表（第 1 只 ×1、第 2 只 ×2…）。超出表长按最后一档封顶，
// 由 GameScene 在达到表尾时改奖 1UP——见 LEVELS.md 1-4「连击考验点」。
export const COMBO_MULTIPLIERS = [1, 2, 4, 8, 16]

/**
 * Tracks score for the current level run (see PLAN.md Phase 6/10). Coins and
 * kills are attributed per-player (`who` is 'p1' | 'p2') so co-op can show
 * each player's own contribution; `addBonus` (level-clear bonus, time bonus)
 * is a team achievement, not attributed to either player individually.
 */
export class ScoreManager {
  constructor() {
    this.perPlayer = {
      p1: { coins: 0, kills: 0, bonus: 0 },
      p2: { coins: 0, kills: 0, bonus: 0 },
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

  /**
   * 连踩的第 comboIndex 只（从 0 开始）。基础击杀分照记，倍率带来的**额外**
   * 分记在这名玩家自己的账上（不是队伍公共 bonus）——双人下连击是个人技术，
   * 结算时应该看得出是谁打的。返回本次实际拿到的总分，供飘字显示。
   */
  addComboKill(who, comboIndex) {
    const mult = COMBO_MULTIPLIERS[Math.min(comboIndex, COMBO_MULTIPLIERS.length - 1)]
    this.addKill(who)
    const extra = KILL_POINTS * (mult - 1)
    this.perPlayer[who].bonus += extra
    return { points: KILL_POINTS * mult, mult }
  }

  /** This player's own score — their coins + kills + own combo bonus, not the shared team bonus. */
  playerScore(who) {
    const p = this.perPlayer[who]
    return p.coins * COIN_POINTS + p.kills * KILL_POINTS + p.bonus
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
