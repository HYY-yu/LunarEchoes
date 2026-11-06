# Crawler 步行动画

[Issue #10](https://github.com/HYY-yu/LunarEchoes/issues/10) 只补现有爬行机械体的步行腿部姿态，不交付完整 A3、沙漠地图或六关战役。外壳、前部琥珀色、青色组织、16×16 边界和共享调色板保持不变。其他精灵保留原像素。

## 结构与视觉边界

比较了两种形状。静态图集方案在启动时烘入三种姿态；分层变换方案在每次绘制时拆分和移动腿部。采用前者，避免逐敌多次绘制、拼接缝隙和受击透明度组合问题。

`createAtlas().draw` 保持既有参数，追加可选 `animationTick = 0`。只有 crawler 消费该参数，按每六个模拟 tick 一拍播放 `0 → 1 → 0 → 2`。renderer 传入 `world.tick + enemy.id * 7`，不同敌人错相；没有动画控制器、真实时钟、持久缓存或新 World 字段。

暂停、升级与终局不推进 World tick，因此 crawler 姿态冻结。重新开始和回放从相同 tick、ID 得到相同姿态。动画不是移动速度、攻击前摇或碰撞范围。没有蓄力、跳跃、钻地、周期闪红或新攻击阶段。既有受击 alpha、阴影和 sentry/Boss 预警保持独立。

imagegen skill 明确优先直接编辑既有 code-native 图形。本任务沿用可编辑像素源，使用三种代码姿态作为轮廓草案，没有生成、下载或接入位图。草案不替代实际游戏渲染验收。

## 官方参考入口

已搜索并读取 [Brotato 官方 Steam 页面](https://store.steampowered.com/app/1942280/Brotato/) 与 [Vampire Survivors 官方 Steam 页面](https://store.steampowered.com/app/1794680/Vampire_Survivors/)，定位官方实机媒体入口。对照目标是密集战场中保持角色轮廓和普通移动、受击提示的区分，不复制角色、帧或布局。本任务不更改游戏 HUD、菜单或触屏操作布局。

当前网页工具未成功打开其媒体画面，因此这里不声称观察了竞品步行逐帧节奏。动画是按本项目已有机械轮廓原创的代码姿态；实际画面仍由独立浏览器验收。

## 可复跑检查

```sh
npm ci --offline --cache /private/tmp/lunar-npm-cache
npm run verify
node scripts/crawler-differential.mjs 3675b32c9131e454ea40a3426cd90c0f3be68562
git diff --check
node scripts/crawler-audition.mjs
```

专用差分在同一数学环境中逐动作比较三个种子的完整 World，包含 events 与每次 checksum，并检查 core 源字节相同。原音频差分有意过滤新增 `enemy-hit`，适用于音频事件加入前的基线，不适用于本任务的当前基线，因此没有修改或复用其过滤比较。

新增测试检查原六种精灵的基线像素、三种腿姿态与原边界、非 crawler 的静态兼容、真实时间不推进 crawler 帧、暂停/升级/终局冻结、重新开始不继承姿态、渲染前后完整 World 相同、受击 alpha 与既有预警。测试使用记录 Canvas 调用的替身，只证明绘制契约，不证明像素观感或浏览器性能。

## 实际浏览器夹具

打开 `http://127.0.0.1:4176`。夹具复用生产 `createAtlas`、`createRenderer`、`createWorld` 与 `dispatch`。服务器只监听 loopback，使用固定路由白名单，不暴露目录。夹具、脚本和媒体证据不进入 dist。

- Play 恢复模拟；Pause 使用真实 pause action。仅改变渲染时间不能让 crawler 换帧。
- Step 6 ticks 有意执行 resume、六个真实模拟步与 pause，用于定格比较；它不是游戏中的暂停输入。
- Upgrade freeze 在明示 QA 世界中达到升级阈值，使用真实 dispatch 进入 upgrading。Play 选择首个 QA 模块后继续。
- Hit crawler 在 QA 世界中加入普通友方弹丸并执行真实伤害，随后暂停以观察 flash。Play 后 flash 按真实 tick 消退。
- Preview telegraph 只在 QA 世界中设定现有 sentry 的攻击倒计时，查看已有预警。
- Restart 重建相同 QA 世界。状态区显示 tick、phase、playing、checksum、flash、事件和完整 World 的渲染不变性检查。

QA 玩家无敌，开火与生成计时被延后，不能据此判断玩家平衡或 FPS。`http://127.0.0.1:4176/game/` 提供同一构建的原游戏，须另行通过真实操作观察 crawler。

最终 head 仍需非作者在桌面 1280×720、窄屏 390×693 保存实际截图和动画片段，覆盖移动、冻结、受击、预警及重开，并检查控制台。作者没有自行声明浏览器、手机帧率或本轮未修改的音频听感通过。
