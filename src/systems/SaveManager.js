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
        getReq.onsuccess = () => {
          const current = getReq.result
          isNewBest = !current || score > current.bestScore
          if (isNewBest) {
            bestStore.put({ levelId, bestScore: score, bestTimeMs: timeMs, achievedAt: playedAt })
          }
        }
        tx.oncomplete = () => resolve({ isNewBest })
        tx.onerror = () => reject(tx.error)
      })
    } catch (err) {
      console.warn('SaveManager.recordLevelResult failed (storage unavailable?)', err)
      return { isNewBest: false, error: err }
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
}
