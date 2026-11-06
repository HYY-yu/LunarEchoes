# 宇航员待机与步行

[Issue #12](https://github.com/HYY-yu/LunarEchoes/issues/12) 只区分现有宇航员的静止与实际移动。白色外壳、青色面罩、深色轮廓、16×16 边界及九色调色板保留。没有新增方向、武器、攻击或死亡姿态，也没有改变移动、冲刺、伤害或碰撞。

## 选帧和观测边界

采用预烘三姿态图集，按 `0 → 1 → 0 → 2` 四拍交替抬脚，每拍六个模拟 tick。头部与躯干前十二行保持原像素。基准帧与全部其他精灵的 frame 0 不变，crawler 的既有循环也不变。

renderer 拥有一条 `{world, tick, x, y, animationTick}` 观测记录。只有 tick 前进且战斗正在运行时，才比较两次观测的实际位置。位置改变就用当前模拟 tick 选步行帧，位置不变就用基准帧。历史方向 `dx`、`dy` 不用作速度，因此边界处持续按移动键但没有位移时仍保持静止。

同 tick 重复绘制不重判运动。暂停、升级和终局保留已选姿态，同时更新观测坐标和 tick，避免恢复同 tick 时产生虚假移动。新 World 或 tick 倒退清除旧姿态。记录只在切换或倒退时创建，平常原位更新，不增加逐帧对象或写入 World。原先仅因 running 就上下跳动的锚点被移除，机体和阴影位置保持稳定，受击透明度仍独立应用。

这一方案只知道两次 render 调用之间的净位移。若跳过了中间的往返和停走，无法重建未采样的轨迹，也不承诺不同绘制频率下逐 tick 的像素回放一致。战斗动作、状态和 checksum 仍按既有协议验证。每个 renderer 首次看到一份快照时先画基准姿态，再依据之后的位移选帧。

备选是使用历史方向或给 main 增加输入标记。历史方向不能区分停下和抵住边界，输入意图也不等于实际位移，还会扩大输入与渲染的耦合。本次保留模拟和 main 的接口。

## 像素和官方参考

`621776d` 先形成了代码姿态候选。独立审查指出视觉流程尚缺实际官方画面观察及 imagegen 参考评审，随后由主协调补齐，作者再对参考与候选复核。这里记录真实的先后顺序，不把补验写成实现前已经完成的步骤。

主协调用 built-in imagegen 生成仅供预览的轮廓和动作参考。输入是生产图集的实际姿态裁图 `/private/tmp/lunar-heartbeat-20261106-1033/media/astronaut-code-poses.png`，约束白机甲、青面罩、深边与16格，仅底部腿靴交替支撑，躯干固定、不旋转或跳跃，不增加攻击或装备。输出位于 `/Users/feng/.codex/generated_images/01a1aa79-5590-7c13-9be6-42328193c376/exec-a3da7f55-c750-43c6-abfb-c65ccd96690b.png`。

作者实际查看了输入裁图与生成参考。固定躯干和左右脚交替支撑符合候选的三姿态、四拍意图，因此保留代码姿态。生成图的柔光、更细密像素和较宽脚位不采用，避免改变现有16×16轮廓。参考只用于评审，没有复制进源码、dist 或运行时资源；既有 code-native 图形仍由像素字符串交付。

官方来源包括已搜索的 [Brotato Steam 页面](https://store.steampowered.com/app/1942280/Brotato/) 与 [Vampire Survivors Steam 页面](https://store.steampowered.com/app/1794680/Vampire_Survivors/)。初次网页工具只取得文字和媒体入口，未成功观察画面。补验时，主协调在 Chrome 实际打开了 [Brotato 官方 CDN 实机截图](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1942280/ss_d4b4c0b552e655169719e35c964765bd27d05900.1920x1080.jpg?t=1771429106)，浏览器证据为 `/private/tmp/lunar-heartbeat-20261106-1033/media/reference-brotato-official.png`，作者也实际查看了该证据。

这张静态画面中，白色主角与厚描边在绿拾取物、亮伤害数字和敌群之间仍可辨识。本次沿用稳定上半身及简短腿部动作，不新增 HUD，也不复制任何角色或素材。静态截图不能证明竞品逐帧动作；Vampire Survivors 仍仅作为官方媒体入口记录。参考和生成概念都不替代本项目最终浏览器验收。

## 可复跑检查

```sh
npm ci --offline --cache /private/tmp/lunar-npm-cache
npm run verify
node scripts/crawler-differential.mjs 12554bffbbb005b1f18a911bfb3dee0cfdb7e98d
git diff --check
node scripts/astronaut-audition.mjs
```

沿用现有全状态差分脚本。虽然脚本名称来自 crawler 任务，它会检查 core 源字节相同，并逐动作严格比较完整 World、events 和每次 checksum，没有过滤事件。本次三个种子共 32,433 个动作通过。

现有 crawler 测试中的“所有非 crawler 均静态”断言仅移除已授权新增动画的 astronaut。全部六种基准像素哈希、四种仍静态精灵、crawler 腿部、冻结、受击和预警断言保留。新增宇航员测试覆盖姿态上身与边界、静止锚点、实际移动、高频同 tick 重绘、停止、边界输入、快进、切换世界、倒退、暂停、升级、终局、受击、阴影和完整 World 不变。

隔离的 `12554bf` 基线运行新断言时，实际得到姿态数量 `1 !== 3`、静止绘制锚点 `735 !== 736`、步行源行 `0 !== 16`。当前实现全部通过。基线探针最初遇到旧版 Python 不支持 `tarfile.extractall(filter=...)`，修正临时提取工具后才观察这些真实断言失败，没有把工具错误计作功能反例。

## 实际浏览器夹具

打开 `http://127.0.0.1:4177`。服务器只监听 loopback、只暴露固定路径。夹具和导出媒体不进入 dist，真实游戏在 `/game/`。

夹具复用生产 core、atlas 和 renderer。它延后开火和生成，并明示固定种子 QA 世界，不用于数值或 FPS 验收。Idle、Move right、Move left 和 Stop 改变送入真实 dispatch 的输入。Pause、Play、Step 6 ticks、Upgrade freeze 和 Hit 使用真实战斗动作或伤害路径。Hit 在 QA 世界放入一枚敌方弹丸，再暂停于可见的受击闪烁拍。Restart 创建新 World，Rewind 将初始 QA 快照恢复到同一 World 以检查倒退失效，这不是玩家存档协议。

状态中的 `observedPose`、`observedAlpha` 和 `observedY` 来自显式拦截生产 Canvas 的实际宇航员 `drawImage` 调用，不复制预期选帧算法。每次 render 前后比较完整 World。Step 控件先在运行状态采样实际渲染，再暂停，避免把从未绘制过的中间姿态当作已经显示的帧。

最终 head 仍须由非作者在 1280×720 和 390×693 录制实际静止、移动、停止、冻结、受击、重开与回放，另在真实游戏操作并检查控制台。作者的参考评审与姿态裁图检查不代替这些交互和动画验收。作者未亲自驱动浏览器，不声明已通过连续运动、实体手机帧率或本轮未改动的音频听感。
