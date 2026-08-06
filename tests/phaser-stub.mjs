/**
 * 极简 Phaser 替身 + Node 侧的 'phaser' 模块重定向。
 *
 * 存在的理由：`npm run audit` 只检查关卡数据的几何，看不到**引擎接线**层面的
 * 问题——"blocksGroup 到底和谁挂了 collider""实体的绘制盒和物理盒是不是一样
 * 大"。玩家反馈的"方块悬在那里无法触碰"恰恰是这两类，全部绕过了审计。
 *
 * 真跑一个 Phaser.Game 需要 canvas/WebGL，在 CI 里既慢又脆。这里换个思路：
 * 被测代码里真正值得断言的是"它调用了哪些 physics.add.* / 用什么尺寸建了
 * GameObject"，那就把 scene 换成一个记账用的假对象，让真实的生产代码跑在
 * 上面。断言的是生产代码的行为，不是 stub 的行为。
 *
 * 'phaser' 说明符本身的重定向在 tests/register.mjs —— 必须由 `node --import`
 * 预加载，原因见那个文件。
 */

/** 记录下所有 physics.add.* 调用的假 Scene。 */
export function makeSceneStub() {
  const colliders = []
  const groups = []

  const makeGameObject = (x, y, width, height) => {
    const go = {
      x, y, width, height, visible: true, alpha: 1, fillColor: 0,
      _data: new Map(), body: null,
      setStrokeStyle: () => go, setFillStyle: () => go, setVisible: (v) => ((go.visible = v), go),
      setAlpha: (a) => ((go.alpha = a), go), setDepth: () => go, setOrigin: () => go,
      setScrollFactor: () => go, setInteractive: () => go, setTexture: () => go,
      setDisplaySize: (w, h) => ((go.width = w), (go.height = h), go),
      setSize: (w, h) => ((go.width = w), (go.height = h), go),
      setPosition: (nx, ny) => ((go.x = nx), (go.y = ny), go),
      setData: (k, v) => (go._data.set(k, v), go), getData: (k) => go._data.get(k),
      on: () => go, destroy: () => { go.destroyed = true },
      getBounds: () => ({ left: go.x - go.width / 2, right: go.x + go.width / 2,
                          top: go.y - go.height / 2, bottom: go.y + go.height / 2 }),
    }
    return go
  }

  const makeGroup = (tag, config) => {
    const g = {
      tag, config, children: [],
      add(c) { g.children.push(c); return g },
      addMultiple(cs) { cs.forEach((c) => g.add(c)); return g },
      getChildren() { return g.children },
      remove(c) { g.children = g.children.filter((x) => x !== c); return g },
    }
    groups.push(g)
    return g
  }

  const scene = {
    colliders, groups,
    add: {
      rectangle: (x, y, w, h) => makeGameObject(x, y, w, h),
      circle: (x, y, r) => makeGameObject(x, y, r * 2, r * 2),
      ellipse: (x, y, w, h) => makeGameObject(x, y, w, h),
      triangle: (x, y) => makeGameObject(x, y, 0, 0),
      image: (x, y) => makeGameObject(x, y, 0, 0),
      tileSprite: (x, y, w, h) => makeGameObject(x, y, w, h),
      container: (x, y) => makeGameObject(x, y, 0, 0),
      text: (x, y) => makeGameObject(x, y, 0, 0),
    },
    // 项目里没有任何美术资源，所有实体都走程序化 placeholder 分支；测试固定
    // 用这个分支，因为绘制盒/物理盒的一致性正是要守的那条线（见 Brick.js）。
    textures: { exists: () => false },
    tweens: { add: () => ({}) },
    time: { now: 0 },
    cameras: { main: { flash: () => {}, width: 1280, height: 720 } },
    physics: {
      add: {
        existing(go, isStatic) {
          go.body = {
            x: go.x - go.width / 2, y: go.y - go.height / 2,
            width: go.width, height: go.height, isStatic: !!isStatic, enable: true,
            setAllowGravity: () => {}, setVelocityX: () => {}, setVelocityY: () => {},
            setImmovable: () => {}, setMaxVelocity: () => {}, setCollideWorldBounds: () => {},
            checkCollision: { up: true, down: true, left: true, right: true },
          }
          return go
        },
        group: (config) => makeGroup('dynamic', config),
        staticGroup: (config) => makeGroup('static', config),
        collider: (a, b, cb) => (colliders.push({ kind: 'collider', a, b, cb }), { a, b }),
        overlap: (a, b, cb) => (colliders.push({ kind: 'overlap', a, b, cb }), { a, b }),
      },
    },
  }
  return scene
}

/** true 如果 a 和 b 之间注册过碰撞/重叠（不分先后顺序）。 */
export function hasPair(scene, a, b, kind) {
  return scene.colliders.some(
    (c) => (!kind || c.kind === kind) && ((c.a === a && c.b === b) || (c.a === b && c.b === a)),
  )
}
