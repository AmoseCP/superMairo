/**
 * 关卡几何审计（Phase 12.0 落库，源自第一阶段验证过的临时脚本；
 * Phase 13.0 补充弹簧净空/单色路线完整性/卷轴区检查点规则）：
 *  1. 可达性 BFS：从出生点出发，所有可站立表面（地面/平台/管道顶/砖块顶/
 *     问号块顶/宝箱顶/移动平台/弹簧顶点/红蓝切换方块）必须能靠 ≤3 格跳跃
 *     + 弹簧冲量 + 管道传送 + 免费变色（见规则 7）到达
 *  2. 底部净空：砖块/问号块/宝箱下方若有可通行地面，净空必须 ≥2 格（192px）
 *  3. 金币不得埋进管道实体
 *  4. 缺口边缘照明（darkness 关）：黑暗关卡每个缺口边缘 1 格内必须有金币标记
 *  5. 纵版关（"vertical": true）：每一列都必须有最底层地面兜底（不许掉出世界）
 *  6. 弹簧净空：弹簧正上方必须留出其弹跳高度对应的净空（否则弹起即撞顶）
 *  7. 切换方块路线完整性：规则 1 的 BFS 实际跑在"(表面, 当前颜色)"的
 *     状态空间里——某方块只有在它自己的颜色等于当前颜色时才算实心可站；
 *     站在装了开关的表面上可以立即免费切到另一色（0 代价的状态转移）。
 *     这比"红/蓝各自独立跑一遍、全程不许切换"的天真版本准确得多——像
 *     "深坑桥中间有个开关小岛，前半段红、后半段蓝"这种设计本来就要求
 *     中途切换，天真版本会把它错判成两色都断路。仍然能抓住真正的死局：
 *     某种颜色的方块永远没有机会被切换到（找不到任何一条路径能在切换
 *     前/切换后落到它自己的颜色状态）时，规则 1 的"不可达表面"照常报出来。
 *  8. 卷轴区（autoScroll）范围内不得放置检查点——卷轴关死亡统一回卷轴
 *     起点，中途检查点在镜头强制推进下没有意义且容易被冲流冲过去
 *  9. 弹簧飞行路径的水平净空：任何平台（不只是这个弹簧自己"配对"的落点）
 *     只要顶面高于某个弹簧的地面高度（会挡在弹起路径上），水平方向必须
 *     和该弹簧的实际弹簧体（比 1 格宽，左右各多出半格）保持 ≥2 格净空。
 *     实测踩过的坑：弹簧A 的专属承接平台自己留了 3 格偏移很安全，但平台
 *     另一侧的边缘恰好只离"另一个不相关的弹簧B"6px——高速弹起的角色贴着
 *     平台一角擦过，Arcade 判成撞上，直接把弧线削掉 1/4 高度，看起来像
 *     "弹簧只弹了预期一半的高度"，其实是被一个自己完全没意识到的邻居
 *     平台顶角刮到了。这个净空要求覆盖关卡里**所有**弹簧，不能只检查
 *     每个弹簧自己名下的承接平台。
 * 10. 两个实心体不许重叠（按真实像素盒，含管道帽沿的左右外探）
 * 11. 金币不许长在任何实心体里（取代原规则 3：它只看管身、漏掉了帽沿，
 *     也完全没管砖块/地板/移动平台）
 * 12. 敌人出生点不许卡在实心体里
 * 13. 砖块/问号块必须真的顶得到（有落脚面 + 底面下方空气柱通畅），
 *     顶面之上还要有一个小形态玩家的站立净空
 *
 *  规则 10~13 是"看得见、碰不到"这一类玩家投诉的根因：规则 1~9 全部在
 *  格子索引上比较，看不见亚格差异（帽沿外探 30px、宝箱只有 84×66、方块
 *  底面正好压在平台顶面上……），所以这些问题一路漏到了玩家手里。
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
// 与 src/entities/Spring.js 的 SIZES 常量保持同步（弹跳高度，格）。
const SPRING_APEX_TILES = { small: 5, big: 8 }
const SPRING_H_UP = 8 // 弹簧滞空时间长，水平可控范围也放宽

// --- 规则 10~13 用的实体像素尺寸（必须和 src/entities/* 保持同步）---
// 这些是"格子索引"算不出来的部分：管道帽沿比管身左右各宽 30px、弹簧比 1 格宽、
// 宝箱只有 84×66 而不是整格……规则 1~9 全部按格子索引比较，正是这一点让
// "看得见、碰不到 / 卡在实体里" 这一整类 bug 从审计里漏了过去。
const PIPE_COLLAR_H = 24 * 3      // Pipe.js COLLAR_HEIGHT
const PIPE_COLLAR_OVERHANG = 10 * 3 // Pipe.js COLLAR_OVERHANG（左右各多出这么多）
const SPRING_W = 56 * 3, SPRING_H = 12 * 3 // Spring.js SPRING_WIDTH / SPRING_HEIGHT
const CHEST_W = 28 * 3, CHEST_H = 22 * 3   // DualSwitchChest.js CHEST_WIDTH / CHEST_HEIGHT
const TURRET_W = 40 * 3, TURRET_H = 44 * 3 // Turret.js WIDTH / HEIGHT
const COIN_SIZE = 18 * 3          // items/Coin.js 的碰撞体边长
const PLAYER_JUMP_APEX = (520 * 3) ** 2 / (2 * 1200 * 3) // ≈338px，v²/2g（constants.js）
// 敌人出生框（Enemy.js 各子类的 width/height，设计值 × 3）。
const ENEMY_BOX = {
  mochi: [26 * 3, 22 * 3], gearmochi: [26 * 3, 22 * 3], shellbuddy: [26 * 3, 24 * 3],
  iceshell: [26 * 3, 24 * 3], hopper: [28 * 3, 24 * 3], bat: [30 * 3, 20 * 3],
  shyghost: [32 * 3, 32 * 3], candyslimeking: [44 * 3, 40 * 3],
}

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
  for (const sp of d.springs ?? []) {
    // 弹簧自身的站立面和普通地面一样按 groundTileY 算（走上去/落上去都算
    // 正常够到）；apex 只影响"从这个弹簧起跳能到多高"，见下方 BFS 特判。
    add(sp.x, sp.x + 1, sp.groundTileY, 'spring', sp.groundTileY)
    S[S.length - 1].springApex = SPRING_APEX_TILES[sp.size] ?? SPRING_APEX_TILES.small
  }
  for (const sb of d.switchBlocks ?? []) {
    add(sb.x, sb.x + (sb.widthTiles ?? 1), sb.y, 'switchBlock')
    S[S.length - 1].color = sb.color
  }
  const warps = (d.pipes ?? [])
    .filter((p) => p.warpToId && pipeIdx.has(p.id) && pipeIdx.has(p.warpToId))
    .map((p) => [pipeIdx.get(p.id), pipeIdx.get(p.warpToId)])
  // 装了开关的表面：站在这上面可以免费切换全局颜色（见规则 7）。
  const switchHost = new Set()
  for (const cs of d.colorSwitches ?? []) {
    for (let i = 0; i < S.length; i++) {
      const s = S[i]
      if (s.x0 <= cs.x && cs.x < s.x1 && Math.abs(s.top - cs.y) <= 1) switchHost.add(i)
    }
  }

  // ---- 1 & 7. 可达性 BFS（状态空间 = 表面 × 当前颜色，见规则 7）----
  const { x: sx, y: sy } = d.spawnTile
  let start = null
  for (let i = 0; i < S.length; i++) {
    const s = S[i]
    if (s.x0 - 1 <= sx && sx <= s.x1 && s.top >= sy && (start === null || s.top < S[start].top)) start = i
  }
  const COLORS = ['red', 'blue']
  const key = (i, c) => `${i}:${c}`
  const reachState = new Set([key(start, 'red')]) // scene.activeColor 初始为 red
  let changed = true
  while (changed) {
    changed = false
    for (const c of COLORS) {
      for (let i = 0; i < S.length; i++) {
        const node = S[i]
        if (node.kind === 'switchBlock' && node.color !== c) continue // 非当前色不实心，站不上去
        if (reachState.has(key(i, c))) continue
        for (const kk of reachState) {
          const [jStr, jc] = kk.split(':')
          if (jc !== c) continue
          const bNode = S[Number(jStr)]
          const hgap = Math.max(0, Math.max(node.x0, bNode.x0) - Math.min(node.x1, bNode.x1))
          const rise = bNode.top - node.board
          // 从弹簧(bNode)起跳允许远超普通跳跃的高差/横向窗口——它是"已到达的
          // 起点"，不是目标；到达弹簧本身仍走下面的普通判定。滞空时间长
          // 这件事跟"最终落点比起跳点高/平/低"无关——哪怕落点和弹簧站立面
          // 同高甚至更低，助跑的水平速度依然能在这段悬空时间里带你飞更
          // 远，所以横向放宽不能像普通跳跃那样只在"往上跳"（rise>0）时
          // 才生效，弹簧要整段 rise（负/零/正，直到 apex）统一套用。
          const ok =
            bNode.kind === 'spring'
              ? rise <= bNode.springApex && hgap <= SPRING_H_UP
              : (rise <= 0 && hgap <= H_DOWN) || (rise > 0 && rise <= MAX_RISE && hgap <= H_UP)
          if (ok) {
            reachState.add(key(i, c)); changed = true; break
          }
        }
      }
      for (const [wa, wb] of warps) {
        if (reachState.has(key(wa, c)) && !reachState.has(key(wb, c))) { reachState.add(key(wb, c)); changed = true }
        if (reachState.has(key(wb, c)) && !reachState.has(key(wa, c))) { reachState.add(key(wa, c)); changed = true }
      }
      const other = c === 'red' ? 'blue' : 'red'
      for (const i of switchHost) {
        if (reachState.has(key(i, c)) && !reachState.has(key(i, other))) { reachState.add(key(i, other)); changed = true }
      }
    }
  }
  const reach = new Set()
  for (const kk of reachState) reach.add(Number(kk.split(':')[0]))
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

    // 复活点（含 P2 的 -1.5 格偏移落点）不得与管道实体水平重叠且身位落在管身高度带内
    const PLAYER_HALF_W = 42
    for (const [who, offset] of [['P1', 0], ['P2', -1.5 * TILE]]) {
      const cx = pt.x * TILE + TILE / 2 + offset
      for (const p of d.pipes ?? []) {
        const w = (p.widthTiles ?? 2) * TILE, h = (p.heightTiles ?? 3) * TILE
        const pipeCx = p.x * TILE + TILE / 2
        const pipeTop = p.groundTileY * TILE - h
        const pipeBottom = p.groundTileY * TILE
        const head = feet - SMALL
        if (Math.abs(cx - pipeCx) < w / 2 + PLAYER_HALF_W && feet > pipeTop && head < pipeBottom) {
          report(lvl, `${pt.kind}(${pt.x},${pt.y}) 的 ${who} 复活位与管道@${p.x} 实体重叠（会嵌入卡死）`)
        }
      }
    }
  }

  // ---- 8. 卷轴区不得放置检查点 ----
  if (d.autoScroll) {
    for (const cp of d.checkpoints ?? []) {
      if (cp.x >= d.autoScroll.startTile && cp.x <= d.autoScroll.endTile) {
        report(lvl, `检查点(${cp.x},${cp.y}) 落在卷轴区 [${d.autoScroll.startTile},${d.autoScroll.endTile}] 内（卷轴关死亡应统一回卷轴起点）`)
      }
    }
  }

  // ---- 5. 纵版关逐列兜底 ----
  if (d.vertical) {
    for (let x = 0; x < d.widthTiles; x++) {
      const hasFloor = (d.groundSpans ?? []).concat(d.platforms ?? []).some((s) => s.fromTile <= x && x < s.toTile)
      if (!hasFloor) report(lvl, `纵版关 x=${x} 列无任何地面兜底（会掉出世界）`)
    }
  }

  // ---- 6 & 9. 弹簧净空：弹起最高点 + 玩家身高都不能撞到头顶实体 ----
  // 注意：rise<=apex 的头顶平台是弹簧"半程落地"的合法目标（弹簧游戏的经典
  // 玩法——平台正好摆在顶点之下，玩家上升途中减速经过时自然落上去），不算
  // 违规；只有落在"任何合法落点都够不到，但全弹到顶点时仍会撞到"这个夹层
  // 里的实体才是真正的头顶净空问题。
  //
  // 水平重叠判定必须用弹簧的**真实像素宽度**（SPRING_WIDTH_PX，比 1 格宽），
  // 不能只按格子索引比较（`s.x1 <= sp.x`）——弹簧实体会向左右各多探出去
  // 大约 0.375 格，一个平台哪怕自己算的时候刚好卡在"隔壁格"，真实边界也
  // 可能已经和弹簧的物理体重叠了几十像素。这正是 Pc 平台（原 toTile:78）
  // 和 x=78 大弹簧之间踩过的坑：格子索引判定认为二者相邻不重叠
  // （78<=78），但真实像素边界其实重叠了 36px，导致高速上升的角色擦角
  // 被判成撞击，弧线被削掉了将近 1/4 高度。
  const SPRING_WIDTH_PX = 168 // 56(设计值) * WORLD_SCALE(3)，需和 Spring.js 的 SPRING_WIDTH 保持同步
  const SPRING_HALF_WIDTH_TILES = SPRING_WIDTH_PX / TILE / 2
  for (const sp of d.springs ?? []) {
    const apex = SPRING_APEX_TILES[sp.size] ?? SPRING_APEX_TILES.small
    const headTiles = Math.ceil(SMALL / TILE)
    const springL = sp.x + 0.5 - SPRING_HALF_WIDTH_TILES
    const springR = sp.x + 0.5 + SPRING_HALF_WIDTH_TILES
    const blockers = S.filter((s) => {
      if (s.kind === 'spring' || s.x1 <= springL || s.x0 >= springR || s.top >= sp.groundTileY) return false
      const rise = sp.groundTileY - s.top
      return rise > apex && rise <= apex + headTiles
    })
    if (blockers.length) {
      const nearest = blockers.reduce((a, b) => (a.top > b.top ? a : b))
      report(lvl, `弹簧(${sp.x},${sp.groundTileY}) 全弹到顶点(${apex}格)+身高会撞上 ${nearest.kind}@${nearest.top}（头顶净空不足，按弹簧真实像素宽度计算）`)
    }
  }

  // ---- 10~13. 像素级实体几何（见文件头 PIXEL_BOXES 一节的常量）----
  // 规则 1~9 全部用格子索引比较，看不见"帽沿多出 30px""宝箱只有 84×66"这类
  // 亚格差异，于是漏掉了一整类玩家实际会遇到的 bug：方块半埋进管道、金币整枚
  // 长在砖块／地板里、敌人出生在管道实体内、方块贴着平台顶面永远顶不到。
  // 下面按真实像素盒重跑一遍。
  const boxes = [] // {kind, l, r, t, b}
  const box = (kind, l, t, w, h) => boxes.push({ kind, l, r: l + w, t, b: t + h })
  for (const s of d.groundSpans ?? []) box('ground', s.fromTile * TILE, s.tileY * TILE, (s.toTile - s.fromTile) * TILE, TILE)
  for (const s of d.platforms ?? []) box('platform', s.fromTile * TILE, s.tileY * TILE, (s.toTile - s.fromTile) * TILE, TILE)
  for (const p of d.pipes ?? []) {
    const w = (p.widthTiles ?? 2) * TILE, h = (p.heightTiles ?? 3) * TILE
    const cx = p.x * TILE + TILE / 2, groundY = p.groundTileY * TILE
    box('pipe帽沿', cx - (w + PIPE_COLLAR_OVERHANG * 2) / 2, groundY - h, w + PIPE_COLLAR_OVERHANG * 2, PIPE_COLLAR_H)
    box('pipe管身', cx - w / 2, groundY - h + PIPE_COLLAR_H, w, h - PIPE_COLLAR_H)
  }
  for (const b of d.bricks ?? []) box('brick', b.x * TILE, b.y * TILE, TILE, TILE)
  for (const q of d.questionBlocks ?? []) box('qblock', q.x * TILE, q.y * TILE, TILE, TILE)
  for (const c of d.dualSwitchChests ?? [])
    box('chest', c.chestX * TILE + TILE / 2 - CHEST_W / 2, c.chestY * TILE + TILE / 2 - CHEST_H / 2, CHEST_W, CHEST_H)
  for (const t of d.turrets ?? []) box('turret', t.x * TILE + TILE / 2 - TURRET_W / 2, t.groundTileY * TILE - TURRET_H, TURRET_W, TURRET_H)
  for (const sp of d.springs ?? []) box('spring', sp.x * TILE + TILE / 2 - SPRING_W / 2, sp.groundTileY * TILE - SPRING_H, SPRING_W, SPRING_H)
  for (const c of d.crumblePlatforms ?? []) box('crumble', c.x * TILE, c.y * TILE, (c.widthTiles ?? 3) * TILE, TILE)
  for (const sb of d.switchBlocks ?? []) box('switchBlock', sb.x * TILE, sb.y * TILE, (sb.widthTiles ?? 1) * TILE, TILE)
  // 移动平台按"出生位"算——它扫过的行程里和别的实体交错是设计的一部分，
  // 但静止时和另一个实体重叠就是数据错误。
  for (const m of d.movingPlatforms ?? []) box('mplat', m.x * TILE, m.y * TILE, (m.widthTiles ?? 3) * TILE, TILE)

  const hit = (a, b, eps = 2) => a.l < b.r - eps && a.r > b.l + eps && a.t < b.b - eps && a.b > b.t + eps
  const at = (o) => `[${(o.l / TILE).toFixed(1)},${(o.t / TILE).toFixed(1)}]`

  // 红蓝切换方块是唯一"故意和别的东西共处一格"的实体：LEVELS3.md 3-2 明写了
  // 「红蓝方块盖在部分管口上方（翻转才能站上管口）」和水下调色湖的「金币走廊」，
  // 也就是把管口/金币埋进方块本来就是玩法——它半数时间 body.enable=false，
  // 不构成"两个恒实心体互相挤"的那种物理隐患。规则 10/11 因此放行它。
  const deliberate = (o) => o.kind === 'switchBlock'

  // ---- 10. 两个实心体不许重叠 ----
  // Arcade 解重叠时会在两个静态体之间反复推挤，轻则视觉上一半埋进去，
  // 重则直接把玩家漏下去（LEVELS.md §0 已经踩过一次）。
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (deliberate(boxes[i]) || deliberate(boxes[j])) continue
      if (hit(boxes[i], boxes[j])) report(lvl, `实心体重叠：${boxes[i].kind}${at(boxes[i])} × ${boxes[j].kind}${at(boxes[j])}`)
    }
  }

  // ---- 11. 金币不许长在实心体里（取代原规则 3——它只看管身、漏了帽沿）----
  for (const c of d.coins ?? []) {
    const cb = { l: c.x * TILE + TILE / 2 - COIN_SIZE / 2, r: c.x * TILE + TILE / 2 + COIN_SIZE / 2,
                 t: c.y * TILE + TILE / 2 - COIN_SIZE / 2, b: c.y * TILE + TILE / 2 + COIN_SIZE / 2 }
    const inside = boxes.find((o) => !deliberate(o) && hit(cb, o, 4))
    if (inside) report(lvl, `金币(${c.x},${c.y}) 埋在 ${inside.kind}${at(inside)} 实体里（看得见、吃不到）`)
  }

  // ---- 12. 敌人出生点不许卡在实心体里 ----
  for (const e of d.enemies ?? []) {
    const [w, h] = ENEMY_BOX[e.type] ?? [26 * 3, 24 * 3]
    const cx = e.x * TILE + TILE / 2, cy = e.y * TILE + TILE / 2
    const eb = { l: cx - w / 2, r: cx + w / 2, t: cy - h / 2, b: cy + h / 2 }
    // 站在地面上是正常的（脚刚好贴着顶面不算重叠，eps 已经吃掉了分离误差）。
    const inside = boxes.find((o) => hit(eb, o, 4))
    if (inside) report(lvl, `敌人 ${e.type}(${e.x},${e.y}) 出生就嵌在 ${inside.kind}${at(inside)} 里（开局会被弹飞/卡住）`)
  }

  // ---- 13. 砖块/问号块必须顶得到，站上去还得有站立净空 ----
  // "顶得到" = 存在某个落脚面，站上去起跳后头顶（升 APEX + 身高）能够到方块
  // 底面，且方块正下方那一段空气柱里没有别的实心体挡路。两个条件缺一不可：
  //  · 只看"正下方最近的地板"会误报——2-1 的问号块悬在两块平台之间的 1 格
  //    缝上方，正下方只有 6 格远的主地面（够不着），但从旁边那块平台起跳斜
  //    着顶完全没问题。所以落脚面要在水平跳跃范围内找，不限于正下方。
  //  · 只看"头顶高度够不够"也会误报反了——3-2 的问号块曾经直接坐在平台顶
  //    面上（底面 = 平台顶面），地面在下面 5 格，高度算得通，实际上底面被
  //    整块平台压死，星星永远顶不出来。所以还要检查空气柱。
  const H_UP_PX = H_UP * TILE
  for (const o of boxes) {
    if (o.kind !== 'brick' && o.kind !== 'qblock') continue
    const bumpable = boxes.some((f) => {
      if (f === o || f.t <= o.b) return false                                   // 必须在方块底面之下
      if (f.t - SMALL - PLAYER_JUMP_APEX > o.b) return false                    // 全跳头顶也够不着
      if (Math.max(0, Math.max(f.l, o.l) - Math.min(f.r, o.r)) > H_UP_PX) return false // 水平太远
      // 方块正下方 (o.b, f.t) 这段空气柱必须是空的，否则头会先撞到别的东西
      return !boxes.some((s) => s !== o && s !== f && s.t < f.t && s.b > o.b && s.l < o.r - 2 && s.r > o.l + 2)
    })
    if (!bumpable) report(lvl, `${o.kind}${at(o)} 顶不到：找不到任何能把头送到它底面的落脚面（底面被压住或高度不够）`)
    // 站立净空：顶面之上要塞得下一个小形态玩家。
    const ceils = boxes.filter((f) => f !== o && f.b <= o.t && f.l < o.r - 8 && f.r > o.l + 8)
    if (ceils.length) {
      const gap = o.t - Math.max(...ceils.map((f) => f.b))
      if (gap < SMALL) report(lvl, `${o.kind}${at(o)} 顶上只有 ${gap}px 净空（玩家 ${SMALL}px，站不上去）`)
    }
  }

  console.log(`${lvl}: 表面 ${S.length} 个 / 实心盒 ${boxes.length} 个，全部审计完成`)
}

console.log(issues ? `\n共 ${issues} 个问题` : '\n✓ 全部关卡审计通过')
process.exit(issues ? 1 : 0)
