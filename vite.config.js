import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      // `import Phaser from 'phaser'` 默认解析到完整构建（package.json 的
      // module 字段 → dist/phaser.esm.js），里面打包了 Matter 物理引擎等本
      // 项目一概没用到的子系统。Phaser 内部大量运行时特性引用，Rollup 摇不掉
      // 这些死代码，所以只能换入口：官方预先裁剪好的 arcade-physics 变体去掉
      // 了 Matter，而本项目全程只用 Arcade（见 main.js 的 physics.default）。
      // 实测产物 1315KB → 1204KB，gzip 361KB → 327KB。
      phaser: 'phaser/dist/phaser-arcade-physics.js',
    },
  },
  server: {
    port: 5173,
  },
})
