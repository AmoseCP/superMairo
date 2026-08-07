/**
 * 引擎接线回归测试。
 *
 * 这一批断言全部对应真实发生过、并且被玩家反馈出来的 bug：关卡审计
 * (`npm run audit`) 只看关卡 JSON 的几何，这些问题在它的视野之外。
 *
 * 跑法：`npm test`（Node 内置 test runner，零额外依赖）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeSceneStub, hasPair } from './phaser-stub.mjs'

import { TILE_SIZE, PLAYER_JUMP_VELOCITY, PLAYER_JUMP_CUT_VELOCITY, GRAVITY_Y } from '../src/config/constants.js'
import { Brick } from '../src/entities/Brick.js'
import { QuestionBlock } from '../src/entities/QuestionBlock.js'
import { GameScene } from '../src/scenes/GameScene.js'

// --- 1. 绘制盒必须等于物理盒 ----------------------------------------------
// 曾经的 bug：VISUAL_HEIGHT_SCALE = 1.25 把方块向下多画了 24px，那一条带子
// 看得见但完全不实心，玩家的反馈是"有的方块悬在那里无法触碰"。
for (const [name, Cls, opts] of [['Brick', Brick, {}], ['QuestionBlock', QuestionBlock, { itemType: 'coin' }]]) {
  test(`${name}：绘制尺寸与物理体完全一致（没有看得见碰不到的幽灵带）`, () => {
    const scene = makeSceneStub()
    const b = new Cls(scene, 480, 576, opts)
    const body = b.rect.body
    assert.equal(b.rect.width, body.width, '宽度不一致')
    assert.equal(b.rect.height, body.height, '高度不一致')
    assert.equal(b.rect.height, TILE_SIZE, '方块应该正好一格高')
    assert.equal(b.rect.y - b.rect.height / 2, body.y, '顶边不齐')
    assert.equal(b.rect.y + b.rect.height / 2, body.y + body.height, '底边不齐')
  })
}

// --- 2. 方块对所有人都实心 -------------------------------------------------
// 曾经的 bug：blocksGroup 只和 player.rect 挂了 collider，敌人穿砖块走、
// 问号块顶出的蘑菇穿过砖块掉到地上。
function loadBlocks() {
  const scene = makeSceneStub()
  const s = Object.create(GameScene.prototype)
  Object.assign(s, scene)
  s.enemyGroup = scene.physics.add.group()
  s.ghostGroup = scene.physics.add.group()
  s.groundGroup = scene.physics.add.staticGroup()
  s._spawnItem = () => {}
  s._awardBlockCoin = () => {}
  s._onBrickBreak = () => {}
  s._loadItemsAndBlocks([{ x: 3, y: 6 }], [{ x: 5, y: 6, item: 'mushroom' }], [{ x: 7, y: 6 }])
  return { scene, s }
}

test('方块对敌人实心', () => {
  const { scene, s } = loadBlocks()
  assert.ok(hasPair(scene, s.enemyGroup, s.blocksGroup, 'collider'), '敌人会穿过砖块/问号块')
})

test('方块对道具实心（蘑菇不会穿砖掉下去）', () => {
  const { scene, s } = loadBlocks()
  assert.ok(hasPair(scene, s.itemsGroup, s.blocksGroup, 'collider'), '道具会穿过砖块/问号块')
})

test('道具与地面的原有碰撞没有被改坏', () => {
  const { scene, s } = loadBlocks()
  assert.ok(hasPair(scene, s.itemsGroup, s.groundGroup, 'collider'))
})

// --- 3. 火球的实体判定是 group 级、且只注册一次 ----------------------------
// 曾经的 bug：每发火球单独 physics.add.overlap，而 Arcade 在 GameObject 被
// 销毁时并不会回收 Collider（只有 World.removeCollider 会），于是每扣一次
// 扳机就永久多两个"死" collider，每个物理步还要遍历整个 groundGroup。
test('火球对实体的判定挂在 group 上，不随每发子弹增长', () => {
  const { scene, s } = loadBlocks()
  assert.ok(hasPair(scene, s.fireballGroup, s.groundGroup, 'overlap'), '火球会穿过地面/管道')
  assert.ok(hasPair(scene, s.fireballGroup, s.blocksGroup, 'overlap'), '火球会穿过砖块/问号块')

  const before = scene.colliders.length
  s.coop = { p1: { rect: {} } }
  s.fireballGroup.add = () => {}
  const player = {
    facing: 1, rect: { x: 100, y: 100, width: 84, height: 120 },
    body: { setVelocityX: () => {} },
  }
  // 真的走一遍 _spawnFireball —— 它不能再注册任何新的 collider。
  for (let i = 0; i < 5; i++) {
    try { s._spawnFireball(player) } catch { /* Fireball 构造需要更多 stub，不影响本断言 */ }
  }
  assert.equal(scene.colliders.length, before, '每发火球仍在泄漏 collider')
})

// --- 4. 可变跳跃高度的数值关系 --------------------------------------------
// 轻点小跳 / 长按高跳。必须严格小于全跳，且仍够得着 1 格台阶，否则关卡里
// 那些 1~2 格的小台阶会变得比按住不放还难上。
test('跳跃切断值合理：小跳 < 全跳，且仍能跨过 1 格台阶', () => {
  assert.ok(PLAYER_JUMP_CUT_VELOCITY < PLAYER_JUMP_VELOCITY, '小跳不比全跳低就没有意义')
  const apex = (v) => (v * v) / (2 * GRAVITY_Y)
  const tapTiles = apex(PLAYER_JUMP_CUT_VELOCITY) / TILE_SIZE
  const holdTiles = apex(PLAYER_JUMP_VELOCITY) / TILE_SIZE
  assert.ok(tapTiles > 1.2, `小跳只有 ${tapTiles.toFixed(2)} 格，上不了 1 格台阶`)
  assert.ok(tapTiles < holdTiles * 0.6, `小跳 ${tapTiles.toFixed(2)} 格与全跳 ${holdTiles.toFixed(2)} 格差别太小，手感上分不出来`)
  // 关卡设计上限是 3 格台阶（见 tools/audit-levels.mjs MAX_RISE），全跳必须留有余量
  assert.ok(holdTiles > 3, `全跳只有 ${holdTiles.toFixed(2)} 格，够不到关卡里的 3 格台阶`)
})

// --- 5. 连击倍率阶梯 -------------------------------------------------------
// LEVELS.md 1-4 写了"连击考验点"的设计意图，敌人也照着摆了，但代码里一直没有
// 连击——每只固定 200 分。这组断言锁住兑现后的阶梯。
test('连击：不落地连踩的分数按倍率递增，且额外分记在个人账上', async () => {
  const { ScoreManager, COMBO_MULTIPLIERS } = await import('../src/systems/ScoreManager.js')
  const sm = new ScoreManager()
  const got = COMBO_MULTIPLIERS.map((_, i) => sm.addComboKill('p1', i).points)
  for (let i = 1; i < got.length; i++) {
    assert.ok(got[i] > got[i - 1], `第 ${i + 1} 只没有比第 ${i} 只更值钱：${got}`)
  }
  assert.equal(got[0], 200, '第一只应当是基础击杀分')
  // 超出倍率表要封顶，不能无限翻倍
  assert.equal(sm.addComboKill('p1', COMBO_MULTIPLIERS.length + 5).points, got.at(-1))
  // 连击奖励属于打出它的人，不进队伍公共 bonus
  assert.equal(sm.bonus, 0)
  assert.ok(sm.playerScore('p1') > 200 * (got.length + 1))
  assert.equal(sm.playerScore('p2'), 0)
})

// --- 6. 设置项的存档兜底 ---------------------------------------------------
test('设置：缺失/损坏的存档一律退回默认值，未知键被忽略', async () => {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
  const { SettingsManager, SETTING_DEFS } = await import('../src/systems/SettingsManager.js')

  const fresh = new SettingsManager()
  for (const def of SETTING_DEFS) assert.equal(fresh.get(def.key), def.default, `${def.key} 默认值不对`)

  store.set('settings', '{"versus":true,')            // 半截 JSON
  assert.equal(new SettingsManager().get('versus'), false, '损坏存档没有退回默认值')

  store.set('settings', JSON.stringify({ versus: 'yes', 未知键: true }))
  const coerced = new SettingsManager()
  assert.equal(coerced.get('versus'), false, '非布尔值应被忽略')
  assert.equal(coerced.get('未知键'), false, '未知键不该被接受')

  const round = new SettingsManager()
  round.set('infiniteLives', true)
  assert.equal(new SettingsManager().get('infiniteLives'), true, '写入后没有持久化')
})

// --- 7. 幽灵录像的时间轴 ---------------------------------------------------
// 曾经的 bug：采样间隔写成"上次采样时刻 + 50ms"，而帧长 16.7ms 除不尽 50ms，
// 误差每帧累积——实测 6 秒只记到 107 个点（应为 120），存下来的幽灵比它实际
// 跑的快 11%，速通对照直接失真。第 i 个采样点必须严格代表 i×50ms 这一刻。
test('幽灵：采样点落在固定时间栅格上，不随帧长漂移', async () => {
  const { GhostRecorder, SAMPLE_INTERVAL_MS } = await import('../src/systems/GhostRecorder.js')
  const rec = new GhostRecorder()
  const player = { rect: { x: 0, y: 100 }, form: 'small' }
  const FRAME = 1000 / 60
  const DURATION = 6000
  // 用最后一次真实喂进去的时间戳来算期望值：帧长是无限小数，循环累加到
  // 6000 时会差几个 ulp，写死 DURATION 会让断言自己差一个点。
  let last = 0
  for (let t = 0; t <= DURATION; t += FRAME) {
    player.rect.x = t // 位置直接编码时间，方便反查
    rec.sample(t, player)
    last = t
  }
  const n = rec.samples.length / 3
  assert.equal(n, Math.floor(last / SAMPLE_INTERVAL_MS) + 1, `采样数漂移了：${n}`)
  // 漂移版实现在这个时长下只会记到 ~107 个点，这条下界就是它的照妖镜
  assert.ok(n >= 119, `采样明显偏少（${n}），间隔正在随帧长漂移`)
  // 第 i 个点必须是"第 i×50ms 之后的第一帧"采到的，也就是最多晚一帧。
  // 容差里的 +1 是采样时 Math.round 到整像素带来的（位置在这里编码的是时间）。
  for (const i of [0, 20, 60, n - 1]) {
    const recordedAt = rec.samples[i * 3]
    const delay = recordedAt - i * SAMPLE_INTERVAL_MS
    assert.ok(delay >= 0 && delay <= FRAME + 1, `第 ${i} 点偏离栅格 ${delay}ms（应在 [0, 一帧] 内）`)
  }
})

test('幽灵：掉帧跨过整格时补齐采样，时间轴不错位', async () => {
  const { GhostRecorder, SAMPLE_INTERVAL_MS } = await import('../src/systems/GhostRecorder.js')
  const rec = new GhostRecorder()
  const player = { rect: { x: 10, y: 100 }, form: 'small' }
  rec.sample(0, player)
  player.rect.x = 999
  rec.sample(SAMPLE_INTERVAL_MS * 5, player) // 一次卡顿跨过 4 个格子
  assert.equal(rec.samples.length / 3, 6, '空档没有被补齐，后续采样会整体前移')
  assert.equal(rec.samples[5 * 3], 999, '最后一个点应当是本次真实采样')
})

test('幽灵：回放按经过时间插值，跑完即隐藏', async () => {
  const { GhostRecorder, GhostPlayback, SAMPLE_INTERVAL_MS } = await import('../src/systems/GhostRecorder.js')
  const rec = new GhostRecorder()
  const player = { rect: { x: 0, y: 100 }, form: 'small' }
  for (let i = 0; i < 10; i++) {
    player.rect.x = i * 100
    rec.sample(i * SAMPLE_INTERVAL_MS, player)
  }
  const ghost = rec.toGhost(9 * SAMPLE_INTERVAL_MS)
  const scene = makeSceneStub()
  const pb = new GhostPlayback(scene, ghost)

  pb.update(0)
  assert.equal(pb.rect.x, 0)
  pb.update(SAMPLE_INTERVAL_MS * 3)
  assert.equal(pb.rect.x, 300, '整格时刻应当正好落在采样点上')
  pb.update(SAMPLE_INTERVAL_MS * 3.5)
  assert.equal(pb.rect.x, 350, '格子之间应当线性插值')
  pb.update(SAMPLE_INTERVAL_MS * 50)
  assert.equal(pb.rect.visible, false, '录像放完后幽灵应当消失（= 你已经落后于自己的纪录）')
  // 纯视觉：绝不能挂物理体，否则会挡路/被踩
  assert.equal(pb.rect.body, null)
})

// --- 8. 世界（章节）划分 ---------------------------------------------------
test('世界：id 前缀决定归属，每个世界的第一关才插过渡卡', async () => {
  const { LEVELS, WORLDS, worldOf, isWorldOpener, TOTAL_BIG_COINS, BIG_COINS_PER_LEVEL } =
    await import('../src/config/levels.js')
  const ids = Object.keys(LEVELS)

  assert.equal(worldOf('2-3'), 2)
  // 每个世界都要有展示元数据，否则过渡卡会退回第一世界的文案
  for (const id of ids) assert.ok(WORLDS[worldOf(id)], `世界 ${worldOf(id)} 缺少元数据`)

  const openers = ids.filter(isWorldOpener)
  assert.deepEqual(openers, [...new Set(ids.map(worldOf))].map((w) => ids.find((id) => worldOf(id) === w)))
  assert.equal(openers.length, new Set(ids.map(worldOf)).size, '过渡卡数量应当等于世界数')
  assert.ok(!isWorldOpener('1-2'), '世界中间的关卡不该插过渡卡')
  assert.ok(!isWorldOpener('nope'), '未知关卡 id 不该被当成世界开场')

  assert.equal(TOTAL_BIG_COINS, ids.length * BIG_COINS_PER_LEVEL)
})
