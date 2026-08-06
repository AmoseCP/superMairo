/**
 * 预加载钩子：把 'phaser' 说明符指向替身模块。
 *
 * 必须走 `node --import`，不能写在测试文件里 —— ESM 的解析发生在任何模块体
 * 执行之前，等 phaser-stub.mjs 的 body 跑起来时，GameScene.js 顶层的
 * `import Phaser from 'phaser'` 早就已经解析并加载了真 Phaser（它一加载就要
 * 摸 window/canvas，在 Node 里直接抛 ReferenceError）。
 */
import { registerHooks } from 'node:module'

const STUB_URL = new URL('./phaser-module-stub.mjs', import.meta.url).href
registerHooks({
  resolve(spec, ctx, next) {
    return spec === 'phaser' ? { url: STUB_URL, shortCircuit: true } : next(spec, ctx)
  },
})
