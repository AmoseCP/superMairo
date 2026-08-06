// 只提供 GameScene.js 在模块加载期和被测路径上真正用到的那几个符号。
class Scene {
  constructor(key) { this.sceneKey = key }
}
class Rectangle {
  constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }) }
  static Overlaps(a, b) { return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom }
}
const Geom = { Rectangle }
const MathUtils = {
  Clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
  Between: (lo) => lo,
}
export default { Scene, Geom, Math: MathUtils }
export { Scene, Geom }
