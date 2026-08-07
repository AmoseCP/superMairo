// Registry of playable levels — see LEVELS.md for full per-level design.
export const LEVELS = {
  '1-1': { path: 'assets/maps/1-1.json', name: '阳光草地' },
  '1-2': { path: 'assets/maps/1-2.json', name: '蘑菇森林' },
  '1-3': { path: 'assets/maps/1-3.json', name: '云端漫步' },
  '1-4': { path: 'assets/maps/1-4.json', name: '沙丘迷城' },
  '1-5': { path: 'assets/maps/1-5.json', name: '糖果城堡' },
  '2-1': { path: 'assets/maps/2-1.json', name: '雪晶滑原' },
  '2-2': { path: 'assets/maps/2-2.json', name: '萤光洞窟' },
  '2-3': { path: 'assets/maps/2-3.json', name: '熔岩工厂' },
  '2-4': { path: 'assets/maps/2-4.json', name: '狂风高塔' },
  '2-5': { path: 'assets/maps/2-5.json', name: '双子魔堡' },
  '3-1': { path: 'assets/maps/3-1.json', name: '弹簧牧场' },
  '3-2': { path: 'assets/maps/3-2.json', name: '红蓝回廊' },
  '3-3': { path: 'assets/maps/3-3.json', name: '疾风飞车' },
  '3-4': { path: 'assets/maps/3-4.json', name: '熔火攀登' },
  '3-5': { path: 'assets/maps/3-5.json', name: '幻影王座' },
}

export const FIRST_LEVEL_ID = '1-1'

/**
 * 世界（章节）元数据。关卡 id 的形式是 "<世界>-<序号>"，世界归属直接从 id
 * 前缀取，这里只补展示层需要的东西：标题、一句话主题、配色。
 *
 * 主题文案取自 LEVELS.md / LEVELS2.md / LEVELS3.md 各自的设计主轴——玩家在
 * 世界过渡卡上看到的就是这一句，它是"接下来五关要教你什么"的预告。
 */
export const WORLDS = {
  1: {
    title: '第一世界 · 初出茅庐',
    theme: '踩踏、踢壳、平台与管道——把基本功一样样交给你',
    color: '#8adf6b',
    bg: '#12301a',
  },
  2: {
    title: '第二世界 · 环境即敌人',
    theme: '冰面、黑暗、传送带、狂风——地形本身开始跟你作对',
    color: '#8fd3ff',
    bg: '#10233a',
  },
  3: {
    title: '第三世界 · 机关大成',
    theme: '弹簧、红蓝切换、强制卷轴、上涨岩浆——所有机制的总检验',
    color: '#ff8fc7',
    bg: '#2b1030',
  },
}

/** 关卡 id → 世界编号（'2-3' → 2）。 */
export const worldOf = (levelId) => Number(String(levelId).split('-')[0])

/** 本关是不是某个世界的第一关（决定要不要插世界过渡卡）。 */
export function isWorldOpener(levelId) {
  const ids = Object.keys(LEVELS)
  const i = ids.indexOf(levelId)
  if (i < 0) return false
  return i === 0 || worldOf(ids[i - 1]) !== worldOf(levelId)
}

/** 大金币总数（每关 3 枚，见 tools/audit-levels.mjs 规则 14）。 */
export const BIG_COINS_PER_LEVEL = 3
export const TOTAL_BIG_COINS = Object.keys(LEVELS).length * BIG_COINS_PER_LEVEL
