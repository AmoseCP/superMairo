/**
 * 拉开管道间距（一次性关卡改造工具，保留在库里是因为它同时是"整关水平插列"
 * 这个操作的唯一正确实现——以后再想给某一段加宽都应该走这里，而不是手改
 * JSON 的几十个 x 字段）。
 *
 * 玩家反馈"每一关的管道与管道太靠近了"。实测：陷阱管小节普遍是 Δ8 格，
 * 帽沿（比管身左右各外探 30px）之间只剩 516px ≈ 5.4 格；最挤的 3-3 只有
 * Δ5。原地挪不动——每个管道小节的左边紧贴前一段内容、右边紧贴旗杆，几乎
 * 没有余量，所以必须把小节本身撑长，再把下游整体右移。
 *
 * 做法：insertColumns(level, atTile, n) = 在 atTile 处插入 n 列空格子。
 *   · 点坐标 x >= atTile → +n
 *   · 区间 [from, to)：to <= atTile 不动；from >= atTile 整体 +n；
 *     from < atTile <= to 则拉长（to += n）
 *     —— "<= to"这一档是关键：紧邻的两段地面 [a,T) 和 [T,c) 会分别变成
 *     [a,T+n) 和 [T+n, c+n)，仍然首尾相接，不会凭空裂出一个坑。
 *   · widthTiles += n
 * 插入点必须落在连续地面内部（否则等于把深坑拉宽），脚本会强制校验。
 *
 * 用法：node tools/space-out-pipes.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAPS = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'maps')
const DRY = process.argv.includes('--dry')

// 目标最小间距（格）。12 格 → 帽沿间隙 96*12-252 = 900px ≈ 9.4 格，
// 走过去约 1 秒，和经典马里奥的管道小节手感一致。
const MIN_GAP_TILES = 12
// 深坑里当踏脚石用的管道另算：间距受"跳得过去"约束，不能按 12 格来。
// 同高度平跳的水平极限约 780px，取 6 格（帽沿间隙 324px）留足余量。
const MIN_GAP_TILES_STEPPING_STONE = 6

// --- 完整字段分类（新增字段必须在这里登记，否则脚本直接报错退出）---------
const X_POINT = new Set([
  'bricks.x', 'checkpoints.x', 'coins.x', 'colorSwitches.x', 'conveyorSwitches.x',
  'crumblePlatforms.x', 'enemies.x', 'flameJets.x', 'lanterns.x', 'movingPlatforms.x',
  'pipes.x', 'questionBlocks.x', 'springs.x', 'switchBlocks.x', 'turrets.x',
  'flagpoleTile.x', 'spawnTile.x',
  'dualSwitchChests.chestX', 'dualSwitchChests.plateA.x', 'dualSwitchChests.plateB.x',
  'timedDoors.doorX', 'timedDoors.switchX',
  'sovereigns.triggerTile', 'sovereigns.spawnTile.x', 'sovereigns.spawnTile2.x', 'sovereigns.wallTiles',
  'phantomBoss.triggerTile', 'phantomBoss.spawnTile.x', 'phantomBoss.switchTiles.x', 'phantomBoss.wallTiles',
])
const X_RANGE = [
  ['groundSpans', 'fromTile', 'toTile'], ['platforms', 'fromTile', 'toTile'],
  ['waterZones', 'fromTile', 'toTile'], ['iceZones', 'fromTile', 'toTile'],
  ['lavaZones', 'fromTile', 'toTile'], ['conveyors', 'fromTile', 'toTile'],
  ['windGusts', 'fromTile', 'toTile'], ['darkness', 'fromTile', 'toTile'],
  ['autoScroll', 'startTile', 'endTile'],
]
// 与 x 无关（y / 高度 / 速度 / 时长 / 字符串等）——列在这里只是为了让
// "未登记字段"的校验能真正报错，而不是默默漏掉一个新加的横坐标。
const NON_X = new Set([
  'id', 'name', 'widthTiles', 'heightTiles', 'vertical',
  'spawnTile.y', 'flagpoleTile.y', 'checkpoints.y',
  'groundSpans.tileY', 'platforms.tileY', 'conveyors.tileY', 'conveyors.dir', 'conveyors.speed',
  'iceZones.tileY', 'lavaZones.tileY', 'waterZones.fromTileY', 'waterZones.toTileY',
  'coins.y', 'bricks.y', 'bricks.coin', 'questionBlocks.y', 'questionBlocks.item',
  'enemies.y', 'enemies.type', 'lanterns.y',
  'pipes.y', 'pipes.id', 'pipes.groundTileY', 'pipes.widthTiles', 'pipes.heightTiles',
  'pipes.hasTrap', 'pipes.enterable', 'pipes.warpToId', 'pipes.trapPhaseOffsetMs',
  'movingPlatforms.y', 'movingPlatforms.widthTiles', 'movingPlatforms.rangeXTiles',
  'movingPlatforms.rangeYTiles', 'movingPlatforms.speed',
  'crumblePlatforms.y', 'crumblePlatforms.widthTiles',
  'springs.groundTileY', 'springs.size', 'switchBlocks.y', 'switchBlocks.widthTiles', 'switchBlocks.color',
  'colorSwitches.y', 'colorSwitches.forceColor', 'turrets.groundTileY',
  'flameJets.tileY', 'flameJets.periodMs', 'flameJets.phaseMs',
  'conveyorSwitches.y', 'conveyorSwitches.pauseMs',
  'dualSwitchChests.chestY', 'dualSwitchChests.plateA.y', 'dualSwitchChests.plateB.y', 'dualSwitchChests.reward',
  'timedDoors.doorY', 'timedDoors.switchY', 'timedDoors.doorHeightTiles', 'timedDoors.openDurationMs',
  'windGusts.fromTileY', 'windGusts.toTileY', 'windGusts.dir', 'windGusts.forcePx',
  'windGusts.periodMs', 'windGusts.gustMs', 'windGusts.phaseMs',
  'darkness.alpha', 'darkness.lightRadiusTiles',
  'autoScroll.speedPx',
  'sovereigns.spawnTile.y', 'sovereigns.spawnTile2.y', 'phantomBoss.spawnTile.y', 'phantomBoss.switchTiles.y',
  'risingLava.startTileY', 'risingLava.speedPx', 'risingLava.pauseMs', 'risingLava.pauseAtTileY',
])

/** 遍历所有叶子字段，确认每一个都被登记过——挡住"新加了横坐标却没人改这里"。 */
function assertSchemaKnown(d, lvl) {
  const rangeKeys = new Set(X_RANGE.flatMap(([sec, a, b]) => [`${sec}.${a}`, `${sec}.${b}`]))
  const visit = (obj, path) => {
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v)) {
        if (v.length === 0) continue // 空数组没有叶子，也就没什么可归类的
        if (v.every((e) => typeof e !== 'object' || e === null)) { check(path ? `${path}.${k}` : k); continue }
        for (const e of v) visit(e, path ? `${path}.${k}` : k)
      } else if (v && typeof v === 'object') {
        visit(v, path ? `${path}.${k}` : k)
      } else {
        check(path ? `${path}.${k}` : k)
      }
    }
  }
  const check = (key) => {
    if (X_POINT.has(key) || NON_X.has(key) || rangeKeys.has(key)) return
    throw new Error(`${lvl}: 未登记的字段 "${key}" —— 请先在 space-out-pipes.mjs 的 X_POINT / X_RANGE / NON_X 里归类`)
  }
  visit(d, '')
}

/** 在 atTile 处插入 n 列空格子；所有横坐标随之平移/拉伸。 */
function insertColumns(d, atTile, n) {
  if (n <= 0) return
  const shiftPoint = (obj, key) => { if (typeof obj?.[key] === 'number' && obj[key] >= atTile) obj[key] += n }
  const walkPoints = (obj, path) => {
    for (const [k, v] of Object.entries(obj)) {
      const key = path ? `${path}.${k}` : k
      if (Array.isArray(v)) {
        if (X_POINT.has(key)) { obj[k] = v.map((e) => (typeof e === 'number' && e >= atTile ? e + n : e)); continue }
        for (const e of v) if (e && typeof e === 'object') walkPoints(e, key)
      } else if (v && typeof v === 'object') {
        walkPoints(v, key)
      } else if (X_POINT.has(key)) {
        shiftPoint(obj, k)
      }
    }
  }
  walkPoints(d, '')
  for (const [sec, aKey, bKey] of X_RANGE) {
    const list = Array.isArray(d[sec]) ? d[sec] : d[sec] ? [d[sec]] : []
    for (const r of list) {
      const a = r[aKey], b = r[bKey]
      if (b <= atTile) continue                 // 完全在插入点左侧
      else if (a >= atTile) { r[aKey] = a + n; r[bKey] = b + n } // 完全在右侧，整体平移
      else r[bKey] = b + n                      // 跨过插入点，拉长
    }
  }
  d.widthTiles += n
}

const onSolidGround = (d, tile) =>
  (d.groundSpans ?? []).concat(d.platforms ?? []).some((g) => g.fromTile < tile && tile < g.toTile)

// ---------------------------------------------------------------------------
let touched = 0
for (const file of readdirSync(MAPS).filter((f) => f.endsWith('.json')).sort()) {
  const path = join(MAPS, file)
  const raw = readFileSync(path, 'utf8')
  const d = JSON.parse(raw)
  assertSchemaKnown(d, d.id)
  if (!(d.pipes ?? []).length) continue

  const log = []
  let guard = 0
  for (;;) {
    if (++guard > 50) throw new Error(`${d.id}: 间距调整没有收敛`)
    // 同一层地面上的相邻管道才算"挨在一起"；不同 groundTileY 的（纵版关上下层）
    // 视觉上本来就分得开，不参与。
    const byFloor = new Map()
    for (const p of d.pipes) {
      if (!byFloor.has(p.groundTileY)) byFloor.set(p.groundTileY, [])
      byFloor.get(p.groundTileY).push(p)
    }
    let fixed = false
    for (const row of byFloor.values()) {
      row.sort((a, b) => a.x - b.x)
      for (let i = 1; i < row.length; i++) {
        const gap = row[i].x - row[i - 1].x
        // 相隔很远的是"主关 vs 隔离区"的两根传送管，不是一个小节，跳过。
        if (gap > MIN_GAP_TILES + 8) continue
        // 踏脚石管道（自己脚下没有地面，站在深坑里）另用一套更小的目标间距。
        const stone = !onSolidGround(d, row[i - 1].x + 1) || !onSolidGround(d, row[i].x + 1)
        const target = stone ? MIN_GAP_TILES_STEPPING_STONE : MIN_GAP_TILES
        if (gap >= target) continue
        const need = target - gap
        if (!stone && !onSolidGround(d, row[i].x)) {
          throw new Error(`${d.id}: 插入点 ${row[i].x} 不在连续地面内部（会把深坑拉宽）`)
        }
        log.push(`  ${row[i - 1].x}↔${row[i].x} Δ${gap} → Δ${target}（在 x=${row[i].x} 插入 ${need} 列）`)
        insertColumns(d, row[i].x, need)
        fixed = true
        break
      }
      if (fixed) break
    }
    if (!fixed) break
  }

  if (!log.length) { console.log(`${d.id}: 间距已达标，未改动`); continue }
  touched++
  console.log(`${d.id}: 宽度 ${JSON.parse(raw).widthTiles} → ${d.widthTiles}`)
  for (const l of log) console.log(l)
  if (!DRY) writeFileSync(path, JSON.stringify(d, null, 2) + raw.slice(raw.trimEnd().length))
}
console.log(`\n${DRY ? '[dry-run] ' : ''}共调整 ${touched} 个关卡`)
