const DB_NAME = 'super-mario-web'
const DB_VERSION = 1

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('scoreHistory')) {
        db.createObjectStore('scoreHistory', { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('bestByLevel')) {
        db.createObjectStore('bestByLevel', { keyPath: 'levelId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * IndexedDB for score history / best-per-level (structured, can grow) +
 * localStorage for small flags like unlocked levels (see PLAN.md "本地数据
 * 持久化方案"). Every method degrades to a harmless no-op/null instead of
 * throwing if storage is unavailable (private browsing, quota, etc).
 */
export class SaveManager {
  constructor() {
    this.dbPromise = null
    this.available = typeof indexedDB !== 'undefined'
  }

  _db() {
    if (!this.available) return Promise.reject(new Error('IndexedDB unavailable'))
    if (!this.dbPromise) this.dbPromise = openDb()
    return this.dbPromise
  }

  /** Writes a history row and updates bestByLevel if this run beat it. Resolves { isNewBest }. */
  async recordLevelResult({ levelId, score, coins, timeMs, players }) {
    try {
      const db = await this._db()
      const playedAt = Date.now()
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(['scoreHistory', 'bestByLevel'], 'readwrite')
        tx.objectStore('scoreHistory').add({ levelId, score, coins, timeMs, players, playedAt })

        const bestStore = tx.objectStore('bestByLevel')
        const getReq = bestStore.get(levelId)
        let isNewBest = false
        let isNewBestTime = false
        getReq.onsuccess = () => {
          const current = getReq.result
          isNewBest = !current || score > current.bestScore
          // 最佳用时**独立**记录。原来它只是"最高分那一把顺带用了多久"，
          // 于是一把稳扎稳打的高分会把真正的最速纪录覆盖掉，速通挑战根本
          // 无从谈起（而且这个字段此前从没有任何界面读过，没人发现）。
          isNewBestTime = !current || !(current.bestTimeMs > 0) || timeMs < current.bestTimeMs
          if (isNewBest || isNewBestTime) {
            bestStore.put({
              levelId,
              bestScore: isNewBest ? score : current.bestScore,
              bestTimeMs: isNewBestTime ? timeMs : current.bestTimeMs,
              achievedAt: playedAt,
            })
          }
        }
        tx.oncomplete = () => resolve({ isNewBest, isNewBestTime })
        tx.onerror = () => reject(tx.error)
      })
    } catch (err) {
      console.warn('SaveManager.recordLevelResult failed (storage unavailable?)', err)
      return { isNewBest: false, isNewBestTime: false, error: err }
    }
  }

  async getBestByLevel(levelId) {
    try {
      const db = await this._db()
      return await new Promise((resolve, reject) => {
        const req = db.transaction('bestByLevel', 'readonly').objectStore('bestByLevel').get(levelId)
        req.onsuccess = () => resolve(req.result ?? null)
        req.onerror = () => reject(req.error)
      })
    } catch {
      return null
    }
  }

  getUnlockedLevels() {
    try {
      return JSON.parse(localStorage.getItem('unlockedLevels') ?? '["1-1"]')
    } catch {
      return ['1-1']
    }
  }

  unlockLevel(levelId) {
    try {
      const unlocked = new Set(this.getUnlockedLevels())
      unlocked.add(levelId)
      localStorage.setItem('unlockedLevels', JSON.stringify([...unlocked]))
    } catch {
      // localStorage unavailable (private mode / quota) — non-fatal, just no persistence.
    }
  }

  // --- 每关大金币的收集状态（见 entities/items/BigCoin.js）------------------
  // 存 localStorage 而不是 IndexedDB：这是一份极小的标志位集合（15 关 × 3 位），
  // 和 unlockedLevels 同类。更重要的是它必须能**同步**读到——GameScene.create()
  // 是同步搭场景的，异步读会让大金币先冒出来再消失。IndexedDB 留给分数历史那种
  // 真正需要结构化查询的数据。
  //
  // 形状：{ "1-1": [0, 2], "2-3": [1] }，数组里是 bigCoins 数组的下标。

  /** 整份收集表；选关界面用它一次算出所有关卡的 ★ 数。 */
  getBigCoinRecord() {
    try {
      const raw = JSON.parse(localStorage.getItem('bigCoins') ?? '{}')
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
    } catch {
      return {}
    }
  }

  /** 某一关已收集的大金币下标（Set，供 GameScene 同步查询）。 */
  getCollectedBigCoins(levelId) {
    const list = this.getBigCoinRecord()[levelId]
    return new Set(Array.isArray(list) ? list : [])
  }

  /** 记下一枚。返回 true 表示这是新收集的（用于决定要不要播提示）。 */
  markBigCoinCollected(levelId, index) {
    try {
      const record = this.getBigCoinRecord()
      const set = new Set(record[levelId] ?? [])
      if (set.has(index)) return false
      set.add(index)
      record[levelId] = [...set].sort((a, b) => a - b)
      localStorage.setItem('bigCoins', JSON.stringify(record))
      return true
    } catch {
      return false // localStorage 不可用：本次仍然计分，只是不持久化
    }
  }
}
