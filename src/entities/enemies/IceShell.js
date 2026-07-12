import { ShellBuddy } from './ShellBuddy.js'
import { WORLD_SCALE } from '../../config/constants.js'
import { ENEMY_ART } from '../../config/assets.js'

const ICE_SHELL_SPEED = 300 * WORLD_SCALE

/**
 * 冰晶龟壳（2-1，见 LEVELS2.md）——ShellBuddy 的雪原变体：踢出的壳滑得
 * 更快（300 vs 220），冰蓝配色。行为状态机完全复用父类；关卡设计上它是
 * "冰面踢壳"这把双刃剑的载体（清怪更远，反弹回来也更快）。
 */
export class IceShell extends ShellBuddy {
  constructor(scene, x, y, opts) {
    super(scene, x, y, { ...opts, color: 0x9fd8f0, art: ENEMY_ART.iceshell })
    this.shellSpeed = ICE_SHELL_SPEED
  }
}
