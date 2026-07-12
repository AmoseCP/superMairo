/**
 * 关卡几何审计（Phase 12.0 落库，源自第一阶段验证过的临时脚本）：
 *  1. 可达性 BFS：从出生点出发，所有可站立表面（地面/平台/管道顶/砖块顶/
 *     问号块顶/宝箱顶/移动平台）必须能靠 ≤3 格跳跃 + 管道传送到达
 *  2. 底部净空：砖块/问号块/宝箱下方若有可通行地面，净空必须 ≥2 格（192px）
 *  3. 金币不得埋进管道实体
 *  4. 缺口边缘照明（darkness 关）：黑暗关卡每个缺口边缘 1 格内必须有金币标记
 *  5. 纵版关（"vertical": true）：每一列都必须有最底层地面兜底（不许掉出世界）
 *
 * 用法：node tools/audit-levels.mjs   （或 npm run audit）
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAPS = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'maps')
const TILE = 96 // 32 设计值 × WORLD_SCALE 3
const SMALL = 120, BIG = 168
const MAX_RISE = 3   // 跳跃可达的最大台阶高差（格）
const H_UP = 4, H_DOWN = 7 // 跳升/下落允许的水平间隙（格）

let issues = 0
const report = (lvl, msg) => { console.log(`  ✗ ${lvl}: ${msg}`); issues++ }

for (const file of readdirSync(MAPS).filter((f) => f.endsWith('.json')).sort()) {
  const d = JSON.parse(readFileSync(join(MAPS, file), 'utf8'))
  const lvl = d.id ?? file
  const S = [] // {x0, x1, board, top, kind}  board=最易登上的顶面高度, top=站立后起跳的顶面高度
  const add = (x0, x1, top, kind, board = top) => S.push({ x0, x1, board, top, kind })

  for (const s of d.groundSpans ?? []) add(s.fromTile, s.toTile, s.tileY, 'ground')
  for (const s of d.platforms ?? []) add(s.fromTile, s.toTile, s.tileY, 'platform')
  const pipeIdx = new Map()
  for (const p of d.pipes ?? []) {
    const w = p.widthTiles ?? 2, h = p.heightTiles ?? 3
    pipeIdx.set(p.id, S.length)
    add(p.x - w / 2 + 0.5, p.x + w / 2 + 0.5, p.groundTileY - h, 'pipe')
  }
  for (const b of d.bricks ?? []) add(b.x, b.x + 1, b.y, 'brick')
  for (const q of d.questionBlocks ?? []) add(q.x, q.x + 1, q.y, 'qblock')
  for (const c of d.dualSwitchChests ?? []) add(c.chestX - 0.5, c.chestX + 0.5, c.chestY, 'chest')
  for (const m of d.movingPlatforms ?? []) {
    const w = m.widthTiles ?? 3, rx = m.rangeXTiles ?? 0, ry = m.rangeYTiles ?? 0
    add(m.x, m.x + w + rx, m.y, 'mplat', m.y + ry) // 登乘按最低点、起跳按最高点
  }
  for (const c of d.crumblePlatforms ?? []) add(c.x, c.x + (c.widthTiles ?? 3), c.y, 'crumble')
  const warps = (d.pipes ?? [])
    .filter((p) => p.warpToId && pipeIdx.has(p.id) && pipeIdx.has(p.warpToId))
    .map((p) => [pipeIdx.get(p.id), pipeIdx.get(p.warpToId)])

  // ---- 1. 可达性 BFS ----
  const { x: sx, y: sy } = d.spawnTile
  let start = null
  for (let i = 0; i < S.length; i++) {
    const s = S[i]
    if (s.x0 - 1 <= sx && sx <= s.x1 && s.top >= sy && (start === null || s.top < S[start].top)) start = i
  }
  const reach = new Set([start])
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < S.length; i++) {
      if (reach.has(i)) continue
      for (const j of reach) {
        const a = S[i], b = S[j]
        const hgap = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1))
        const rise = b.top - a.board
        if ((rise <= 0 && hgap <= H_DOWN) || (rise > 0 && rise <= MAX_RISE && hgap <= H_UP)) {
          reach.add(i); changed = true; break
        }
      }
    }
    for (const [a, b] of warps) {
      if (reach.has(a) && !reach.has(b)) { reach.add(b); changed = true }
      if (reach.has(b) && !reach.has(a)) { reach.add(a); changed = true }
    }
  }
  for (let i = 0; i < S.length; i++) {
    if (!reach.has(i)) report(lvl, `不可达表面 ${S[i].kind} [${S[i].x0},${S[i].x1})@${S[i].top}`)
  }
  // 旗杆必须立在可达的地面/平台上
  if (d.flagpoleTile) {
    const fx = d.flagpoleTile.x
    const onFlag = [...reach].some((i) => {
      const s = S[i]
      return (s.kind === 'ground' || s.kind === 'platform') && s.x0 <= fx && fx < s.x1
    })
    if (!onFlag) report(lvl, `旗杆 x=${fx} 不在可达地面上`)
  }

  // ---- 2. 底部净空 ----
  for (const s of S) {
    if (!['brick', 'qblock', 'chest'].includes(s.kind)) continue
    const floors = S.filter(
      (f) => (f.kind === 'ground' || f.kind === 'platform') && f.top > s.top && !(f.x1 <= s.x0 || f.x0 >= s.x1),
    )
    if (!floors.length) continue
    const gap = (Math.min(...floors.map((f) => f.top)) - s.top - 1) * TILE
    if (gap > 0 && gap < BIG) report(lvl, `${s.kind} [${s.x0},${s.x1})@${s.top} 底部净空仅 ${gap}px（<${BIG}）`)
  }

  // ---- 3. 金币不得埋进管道 ----
  for (const c of d.coins ?? []) {
    for (const p of d.pipes ?? []) {
      const w = p.widthTiles ?? 2, h = p.heightTiles ?? 3
      if (p.x - w / 2 <= c.x + 0.5 && c.x + 0.5 <= p.x + w / 2 && p.groundTileY - h <= c.y && c.y < p.groundTileY) {
        report(lvl, `金币(${c.x},${c.y}) 埋在管道@${p.x} 实体内`)
      }
    }
  }

  // ---- 4. 黑暗关缺口必须有金币标记 ----
  if (d.darkness) {
    const grounds = (d.groundSpans ?? []).sort((a, b) => a.fromTile - b.fromTile)
    for (let i = 1; i < grounds.length; i++) {
      const gapL = grounds[i - 1].toTile, gapR = grounds[i].fromTile
      if (gapR - gapL <= 0) continue
      const marked = (d.coins ?? []).some((c) => Math.abs(c.x - gapL) <= 1 || Math.abs(c.x - (gapR - 1)) <= 1)
      if (!marked) report(lvl, `黑暗关缺口 [${gapL},${gapR}) 边缘 1 格内无金币标记`)
    }
  }

  // ---- 4.5 出生点/检查点复活不得嵌入地面（嵌入=分离失效直接穿地，连锁死亡）----
  const PLAYER_HALF = 60 // 小形态半高（px）
  const respawnPoints = [{ ...d.spawnTile, kind: 'spawn' }, ...(d.checkpoints ?? []).map((c) => ({ ...c, kind: 'checkpoint' }))]
  for (const pt of respawnPoints) {
    const feet = pt.y * TILE + TILE / 2 + PLAYER_HALF
    const floors = S.filter((s) => ['ground', 'platform', 'crumble'].includes(s.kind) && s.x0 <= pt.x && pt.x < s.x1 && s.top * TILE >= pt.y * TILE)
    if (!floors.length) {
      report(lvl, `${pt.kind}(${pt.x},${pt.y}) 下方无地面（复活即坠亡）`)
      continue
    }
    const floorTop = Math.min(...floors.map((f) => f.top)) * TILE
    if (feet > floorTop) report(lvl, `${pt.kind}(${pt.x},${pt.y}) 复活时脚部嵌入地面 ${feet - floorTop}px（会穿地连锁死亡）`)
  }

  // ---- 5. 纵版关逐列兜底 ----
  if (d.vertical) {
    for (let x = 0; x < d.widthTiles; x++) {
      const hasFloor = (d.groundSpans ?? []).concat(d.platforms ?? []).some((s) => s.fromTile <= x && x < s.toTile)
      if (!hasFloor) report(lvl, `纵版关 x=${x} 列无任何地面兜底（会掉出世界）`)
    }
  }

  console.log(`${lvl}: 表面 ${S.length} 个，全部审计完成`)
}

console.log(issues ? `\n共 ${issues} 个问题` : '\n✓ 全部关卡审计通过')
process.exit(issues ? 1 : 0)
