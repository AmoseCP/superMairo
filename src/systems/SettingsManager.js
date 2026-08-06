const STORAGE_KEY = 'settings'

/**
 * 玩家可切换的游戏选项，持久化到 localStorage（和 unlockedLevels / bigCoins
 * 同一套轻量存储；IndexedDB 留给分数历史）。
 *
 * 读取一律走 get()，它会把缺失/损坏的值退回默认值——存档是用户可编辑的
 * 文本，不能假设里面一定是合法结构。
 */
export const SETTING_DEFS = [
  {
    key: 'versus',
    label: '双人竞争',
    hint: '双人同屏比谁分高，通关时结算胜负（关闭 = 纯协作）',
    default: false,
  },
  {
    key: 'infiniteLives',
    label: '无限生命',
    hint: '掉命不减共享生命，只回检查点——给小朋友或想专心探索时用',
    default: false,
  },
  {
    key: 'reduceMotion',
    label: '减弱画面效果',
    hint: '关闭受击/踩敌的画面震动与卡帧（晕动症友好）',
    default: false,
  },
]

const DEFAULTS = Object.fromEntries(SETTING_DEFS.map((d) => [d.key, d.default]))

export class SettingsManager {
  constructor() {
    this.values = { ...DEFAULTS, ...this._load() }
  }

  _load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
      // 只接受已知键上的布尔值，其余一律忽略
      return Object.fromEntries(
        Object.entries(raw).filter(([k, v]) => k in DEFAULTS && typeof v === 'boolean'),
      )
    } catch {
      return {}
    }
  }

  get(key) {
    return this.values[key] ?? DEFAULTS[key] ?? false
  }

  set(key, value) {
    if (!(key in DEFAULTS)) return
    this.values[key] = !!value
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values))
    } catch {
      // localStorage 不可用（无痕模式/配额）：本次会话仍然生效，只是不持久化
    }
  }

  toggle(key) {
    this.set(key, !this.get(key))
    return this.get(key)
  }
}
