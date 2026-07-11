# 音效/音乐替换指南

现在游戏里所有的声音（跳跃、吃金币、踩怪、背景音乐……）都是代码用 Web Audio API 实时合成的电子音效（一段频率滑动的"哔"声），不是真实录音/音乐文件。原理和 [ART.md](ART.md) 里图片的换皮机制完全一样：**把音频文件放到指定路径，刷新页面，不用改代码**。

## 原理（一句话）

每次要播放一个音效或背景音乐时，代码会先检查对应的音频文件是不是已经加载成功。加载成功就播放你的音频文件，加载失败（文件还不存在）就继续播放现在这个合成音效。两条路径随时能切换，互不影响——你可以先做好几个音效，其余的过几天再补，中间游戏一直能正常出声音。

## 怎么加一个音效

1. 按下表把音频文件放到 `public/assets/audio/` 目录下，文件名必须和表格里"文件名"列完全一致。
2. 刷新浏览器页面。
3. 完事——不需要重启 dev server，不需要改代码，不需要注册什么"资源列表"（已经全部在 `src/config/audio.js` 里配置好了）。

## 格式要求

| 项目 | 要求 |
|---|---|
| 格式 | **推荐 MP3**（兼容性最好）。WAV / OGG 也可以，Phaser 都能播放 |
| 声道 | 单声道或立体声都可以，音效类建议单声道，文件更小 |
| 采样率 | 常规的 44100Hz 或 48000Hz 即可，不需要特殊处理 |
| 音量 | 建议音频文件本身就处理好合适的响度（不要留特别大的静音前奏/尾奏），代码里会再乘一个整体音量系数，但不会做响度均衡 |

## 音效清单（15 个，都是一次性短音效）

| 文件名 | 存放路径 | 对应场景 | 参考时长 |
|---|---|---|---|
| `sfx_jump.mp3` | `public/assets/audio/` | 跳跃起跳 | 约 0.15 秒 |
| `sfx_land.mp3` | `public/assets/audio/` | 落地 | 约 0.1 秒 |
| `sfx_coin.mp3` | `public/assets/audio/` | 吃到金币 | 约 0.12 秒 |
| `sfx_powerup.mp3` | `public/assets/audio/` | 吃到蘑菇/火焰花/星星（变身） | 约 0.3 秒 |
| `sfx_stomp.mp3` | `public/assets/audio/` | 踩中怪物 | 约 0.15 秒 |
| `sfx_hurt.mp3` | `public/assets/audio/` | 玩家受伤/掉血（包括被水管里的机械夹子夹到） | 约 0.25 秒 |
| `sfx_bubble.mp3` | `public/assets/audio/` | 双人模式：掉坑变泡泡 | 约 0.2 秒 |
| `sfx_rescue.mp3` | `public/assets/audio/` | 双人模式：队友被救回 | 约 0.25 秒 |
| `sfx_flagpole.mp3` | `public/assets/audio/` | 摸到旗杆，本关通关 | 约 0.5 秒，建议做得稍微有"庆祝感" |
| `sfx_block_bump.mp3` | `public/assets/audio/` | 顶到砖块/问号砖（无论有没有弹出东西都会响） | 约 0.08 秒，很短促的"咚"声 |
| `sfx_brick_break.mp3` | `public/assets/audio/` | 大马里奥/火焰马里奥顶碎砖块 | 约 0.2 秒，碎裂感 |
| `sfx_1up.mp3` | `public/assets/audio/` | 每攒够 100 个金币，额外获得一条命 | 约 0.4 秒，建议比吃道具的音效更"喜庆" |
| `sfx_pipe_warp.mp3` | `public/assets/audio/` | 站在水管口按下方向键，传送进/出水底世界 | 约 0.3 秒，经典马里奥的"嗖"下水管声 |
| `sfx_switch.mp3` | `public/assets/audio/` | 双人合作机关触发瞬间——1-3 两人同时踩下两块板、或 1-4/1-5 踩板开门的那一下 | 约 0.1 秒，短促的"啪嗒"机关声 |
| `sfx_chest_open.mp3` | `public/assets/audio/` | 1-3 双人合作宝箱弹开、吐出奖励道具的瞬间 | 约 0.35 秒，建议有"开宝箱"的惊喜感 |

参考时长按现在合成音效的时长给的，仅供参考，实际时长你可以自己判断，不需要精确匹配。

## 背景音乐（1~6 个文件，都可选）

| 文件名 | 存放路径 | 说明 |
|---|---|---|
| `bgm-overworld.mp3` | `public/assets/audio/` | **共用默认背景音乐**——没有单独关卡音乐的关卡都会用这一首（循环播放） |
| `bgm-1-1.mp3` | `public/assets/audio/` | 阳光草地专属背景音乐（**可选**，有就优先用这个，没有就用上面的默认音乐） |
| `bgm-1-2.mp3` | `public/assets/audio/` | 蘑菇森林专属背景音乐（可选） |
| `bgm-1-3.mp3` | `public/assets/audio/` | 云端漫步专属背景音乐（可选） |
| `bgm-1-4.mp3` | `public/assets/audio/` | 沙丘迷城专属背景音乐（可选） |
| `bgm-1-5.mp3` | `public/assets/audio/` | 糖果城堡专属背景音乐（可选，Boss 关，可以做得更紧张一些） |

- 背景音乐会**自动循环播放**，不需要自己做无缝循环剪辑，但如果开头/结尾能对上，循环听感会更好。
- 时长没有限制，正常一首 BGM 30 秒到 2 分钟都可以，太短会循环得很频繁。
- 只做 `bgm-overworld.mp3` 这一首也完全可以（5 关都会用它），不是必须每关都单独做一首。

## 静音开关

游戏内按 `M` 键静音/取消静音（右上角 HUD 有提示），这个开关对合成音效和真实音频文件都同时生效，不需要额外处理。

## 技术细节（给以后维护代码的人看）

- 所有音频资源的"文件在哪"统一记录在 `src/config/audio.js`，`BootScene.js` 启动时会尝试加载这里列出的每一个文件；文件不存在时 Phaser 会在控制台报一条加载失败（本地开发环境下因为 Vite 的兜底机制，缺失的音频有时会额外多报一条"解码失败"的错误，这是正常现象，不影响功能——已经用 Playwright 验证过，即使某个音频解码失败，对应的音效调用依然会正确回退到合成音效）。
- `AudioManager`（`src/systems/AudioManager.js`）现在需要传入 `scene`（`new AudioManager(this)`，已在 `GameScene.js` 里改好），每个 `playXxx()` 方法内部通过 `scene.cache.audio.exists(key)` 判断真实音频是否可用，可用就走 `scene.sound.play(key, {volume})`，否则调用原来的 `_playTone()` 合成一段音效。
- `startBgm(levelId)` 会依次尝试：该关卡专属 BGM → 共用默认 BGM → 合成音乐循环，取第一个存在的。
- 想加新的可换音效时，照抄这个模式：在 `audio.js` 的 `SFX_AUDIO` 里加一条 `{key, path}`，在 `AudioManager` 里新增一个 `playXxx()` 方法调用 `this._playSfx(SFX_AUDIO.xxx, toneConfig)`。
