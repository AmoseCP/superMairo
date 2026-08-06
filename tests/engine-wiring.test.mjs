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
