# 微信小游戏接入方案

面向当前 main 分支的实测结论与实施计划。文中"实测"指本机运行 `npm run verify` 与静态统计得到的数字，"估计"指尚未实施的工作量判断。

## 结论摘要

技术上可行，包体不是障碍：当前构建产物合计 37,132 字节（逐文件 gzip 合计），小游戏主包上限 4 MB、整包 30 MB，余量在两数量级之上。运行时零下载资源，首屏无加载等待。

真正的成本只有一处：界面。`index.html` 的 23 个容器、`style.css` 的 247 条规则、`main.ts` 里 55 处 `createElement` 与 61 处 `element()` 查询，全部依赖浏览器 DOM 与 CSS 布局。小游戏运行在 iOS JavaScriptCore 与 Android V8，没有 BOM 和 DOM，没有 `document`、`window`、`localStorage`、`matchMedia`。因此"能启动"和"能玩"是两个不同难度的问题。

推荐路线：**抽出视图模型，保留现有 DOM 渲染器，新增 Canvas 渲染器与平台端口层**。`core.ts` 一行不改，web 端视觉不重做，小游戏端得到一份独立可验收的渲染实现。

工程估计 10–14 人日（不含资质办理与审核排队）。外部行政环节才是关键路径：主体、软著、备案的办理周期以周计。

## 一、现状体检

| 项目 | 实测值 | 说明 |
| --- | --- | --- |
| 构建产物 | 15 个文件，148 KB 原始 / 37,132 B gzip | 预算 153,600 B，占 24% |
| 源码规模 | 13 个 TS 文件，1,565 行 | `core.ts` 290 行，`main.ts` 387 行 |
| 运行时依赖 | 0 | 小游戏端无需任何引擎或垫片库 |
| 远程资源 | 0 | 精灵、场景、音乐全部程序生成 |
| 验证状态 | `npm run verify` 通过 | 单测全绿，三seed模拟全胜（208907/42/101），回放校验一致 |
| 工作区状态 | 有未提交改动 | `src/i18n.ts`、`src/main.ts`、`test/opening-main.test.mjs` 已修改，`marketing/` 未跟踪 |

浏览器 API 依赖的位置与处置方向：

| 依赖 | 出现位置 | 小游戏可用性 | 处置 |
| --- | --- | --- | --- |
| `document.createElement('canvas')` | `art.ts:18`、`desert-map.ts:7` | 无 `document` | 由画布端口提供离屏画布 |
| `canvas.clientWidth/clientHeight` | `render.ts:20` | 无布局系统 | 渲染器改为接收视口尺寸 |
| `document.getElementById`、`createElement`、`classList`、`innerHTML` | `main.ts` 全文 | 无 | 视图模型 + Canvas 渲染器 |
| `matchMedia('(pointer: coarse)')` | `main.ts:55` | 无 | 平台端口直接声明输入形态 |
| `localStorage` | `progress-storage.ts` 经端口注入 | 无，有 `wx.setStorageSync` | 已具备接缝，补一个小游戏实现 |
| `new AudioContext()` | `audio.ts:48` | `wx.createWebAudioContext`（基础库 2.19.0+） | 构造器注入 |
| `crypto.getRandomValues` | `main.ts:124` | 无，有 `wx.getRandomValues`（异步） | 种子改由端口提供 |
| `location.search` | `logger.ts:4` | 无 | debug 标记由端口提供 |
| `document.hidden`、`visibilitychange`、`blur` | `main.ts:68,334,335` | 无，有 `wx.onHide/onShow` | 生命周期端口 |
| `window.onerror`、`unhandledrejection` | `main.ts:349` | 无，有 `wx.onError` | 生命周期端口 |
| `requestAnimationFrame` | `main.ts:382` | 基础库原生提供 | 无需改动 |
| `canvas.getBoundingClientRect` | `main.ts:342` | 无 | 摇杆中心改为布局常量 |

已存在的两个有利接缝：`createRenderer(canvas)` 只依赖 2D 上下文，`openProgressStorage(port)` 已经是端口注入形态。`core.ts` 的模拟边界由 `check` 强制，接入过程不需要碰它。

## 二、平台差异要点

官方文档确认的事实：运行环境无 BOM/DOM；基础库只提供 `wx.createCanvas`、`wx.createImage`、`setTimeout`、`setInterval`、`requestAnimationFrame`；`weapp-adapter` 是参考实现，不属于基础库，官方明确说明其模拟"远不完整"。小游戏代码包主包上限 4 MB，主包加分包合计上限 30 MB。

四个容易低估的差异：

1. **只有一个上屏画布**。第一次 `wx.createCanvas()` 返回上屏画布，之后的调用返回离屏画布。因此 HUD 与文字必须画在同一张画布上。
2. **分辨率与像素风冲突**。`render.ts` 现在按 `clientWidth / 2` 设置绘制缓冲，靠 CSS 放大得到块状像素感，文字交给 DOM 保持清晰。小游戏端若把 UI 画在同一缓冲，中文字形只有半分辨率，会明显发糊。必须做双层：离屏画布按半分辨率画游戏，上屏画布按设备像素比画界面，再由上屏画布用无插值缩放贴图。
3. **触摸是事件流，不是元素**。没有元素边界，摇杆中心、冲刺按钮、升级卡片的可点区域都要由布局常量计算，并在多指同时按下时按触点 id 归属。
4. **样式能力缺失**。`clip-path` 8 处、`box-shadow` 7 处、`linear-gradient` 5 处、`@keyframes` 1 处、`@media` 13 处、`safe-area-inset` 20 处。Canvas 侧需要自写切角路径、硬阴影偏移矩形、渐变填充、缓动过渡与两三档响应式规则。

## 三、方案对比

| 方案 | 做法 | 优点 | 致命问题 | 结论 |
| --- | --- | --- | --- | --- |
| A 垫片适配 | 引入 `weapp-adapter` 或自写 document 垫片 | 改动最小，能启动 | 垫片不实现 CSS 布局与命中测试，HUD、模态、摇杆、按钮全部不可见或不可点，等于没有界面 | 只能作为勘探期的临时工具 |
| B 视图模型 + 双渲染器 | 抽出纯视图模型，DOM 与 Canvas 各实现一个渲染器 | web 不重做视觉，两端口共用状态推导，后续可删 DOM 渲染器 | 短期存在两份渲染实现，但由同一数据源驱动，不存在状态分叉 | **推荐** |
| C 双 UI 平行开发 | web 保留 DOM，小游戏写一套独立 UI 与状态同步 | 起步快 | `updateUi` 的九个分支要平行维护，战役六关扩张期成本持续放大 | 不采用 |
| D 迁移到游戏引擎 | Cocos、Laya、PIXI | 生态成熟 | 引入 1 MB 以上运行时，违反零依赖与体积预算，37 KB 的收益被引擎吃掉 | 不采用 |

方案 B 的边界很清楚：渲染器只读视图模型，视图模型只读世界状态与界面状态，任何渲染路径都不写回战斗状态。这条约束与现有"渲染和音频不修改战斗状态"的规则一致，也可以交给 `check` 静态守护。

## 四、目标架构

```
src/
  core.ts                 不变。确定性模拟与回放
  app.ts                  平台无关的应用状态机：screen、录制、回放、帧循环、意图分发
  view.ts                 纯函数：world + screen + language + audioState -> ViewModel
  ui/
    theme.ts              颜色、字号、间距、切角参数，取自 style.css 现有取值
    layout.ts             安全区、两档断点、各屏幕的矩形布局
    text.ts               中英混排换行、measureText 缓存、单行截断
    canvas-ui.ts          Canvas 渲染器：HUD、标题、开场、升级、暂停、结算、无线电、摇杆
    dom-ui.ts             现有 DOM 渲染器迁入，行为与视觉保持现状
    hit.ts                命中测试：触点 id -> 意图
  platform/
    ports.ts              CanvasHost、InputPort、AudioPort、StoragePort、LifecyclePort、RandomPort、LogPort
    web.ts                浏览器实现
    minigame.ts           小游戏实现，含最小 wx 类型声明，不引入 @types 依赖
minigame/
  game.js                 入口，import 构建产物后启动
  game.json               deviceOrientation、showStatusBar、无分包
  project.config.json     compileType 设为 game
scripts/
  build-minigame.mjs      tsc 产物复制、入口生成、体积与禁用全局检查
```

数据流：

```
输入 -> InputPort -> app 意图 -> dispatch(world, action) -> world
world + screen + language -> view.ts -> ViewModel -> {dom-ui | canvas-ui}
                                        -> 只读
```

关键实现点：

- 视图模型是纯数据，不含 DOM 节点与画布上下文。单测可直接断言其中的文案、数值、可见性与按钮集合，不需要渲染环境。
- `app.ts` 吸收 `main.ts` 现有逻辑，但把 `document`、`window`、`AudioContext`、`crypto`、`location`、`localStorage` 全部改为端口调用。`main.ts` 退化为 web 启动器：装配 `web` 端口、选择 `dom-ui`。
- 画布端口区分主画布与离屏画布，`art.ts` 与 `desert-map.ts` 改为接收画布工厂。
- 小游戏端 UI 画在上屏画布的全分辨率层，游戏画面由离屏画布贴图。web 端不需要这一层，因为文字由 DOM 渲染。
- 内容文案仍以 `content/desert-base.story.json` 为唯一来源。构建时同时生成 web 用的内联脚本与小游戏用的模块，去掉从 DOM script 标签读取的路径。

## 五、实施阶段

### P0 环境勘探（0.5–1 人日）

在微信开发者工具建一个空小游戏工程，验证四件不确定的事，结论写回本节：

1. `import './x.js'` 形式的 ES 模块能否直接运行。若不能，需要自写一个按依赖顺序拼接的构建步骤，约 80 行，仍不引入第三方打包器。
2. Canvas 2D 的 `ellipse`、`createRadialGradient`、`setLineDash`、`measureText`、`imageSmoothingEnabled` 行为是否与浏览器一致。`render.ts` 全部依赖这些。
3. `wx.createWebAudioContext` 下 `OscillatorNode.frequency.exponentialRampToValueAtTime`、`onended`、节点数量上限的表现。`audio.ts` 最多同时 24 个声部。
4. 真机 `pixelRatio` 与 `safeArea` 的实际取值，以及半分辨率离屏画布贴图后的清晰度是否可接受。

验收：一页记录，四项各有"可用/不可用/降级方案"的明确结论。任何一项不可用，先在此收敛，不进入 P1。

### P1 端口层与视图模型（2–3 人日）

新增 `platform/ports.ts`、`platform/web.ts`、`app.ts`、`view.ts`，把 `main.ts` 的装配与状态机拆开。`dom-ui.ts` 由现有 `updateUi` 平移，DOM 结构与文案不变。

同时完成：`render.ts` 接收视口、`art.ts` 与 `desert-map.ts` 接收画布工厂、`audio.ts` 接收上下文工厂、`logger.ts` 接收 debug 标记。

验收：web 端 `npm run verify` 全绿；浏览器试玩流程与当前一致（启动、开场、战斗、升级、暂停、结算、回放校验一致、语言与声音切换）。

### P2 Canvas 渲染器（5–7 人日）

按屏幕推进，每完成一个屏幕就可在小游戏里看到对应画面：战斗 HUD（装甲格、计时与同步条、等级击破、经验条、装备位、冲刺冷却）→ 升级卡片 → 标题与开场 → 暂停 → 结算与任务报告 → 无线电 → 摇杆与冲刺按钮。

视觉对照以 `docs/ui-style.md` 的颜色与边框约定为准，切角用路径绘制，硬阴影用偏移矩形，渐变用 `createLinearGradient`，过渡用固定时长的缓动函数。中文换行按字断行、英文按词断行，禁止按固定字宽估算。

验收：小游戏模拟器内逐屏与 web 截图对照，误差项写清单；长文案在最小屏幕（约 320×568 逻辑像素）不溢出、不遮挡可点区域。

### P3 小游戏工程与构建（1–2 人日）

`build:minigame` 复用现有 `tsc`，产物落 `minigame/js/`，生成入口 `game.js`，写 `game.json` 与 `project.config.json`。`game.json` 至少包含 `deviceOrientation: "portrait"`、`showStatusBar: false`；不配置分包。

`check` 增加三条小游戏专属规则：产物中不得出现 `document.`、`window.`、`localStorage`、`new AudioContext`、`matchMedia`；主包体积上限单独设定并纳入现有预算日志；`game.json` 必备字段齐全。

验收：开发者工具上传预览成功，真机扫码可进入标题页。

### P4 真机验证与提审（2–3 人日 + 外部周期）

真机验收清单：至少一台 iOS 与一台 Android 完整跑完 180 秒并触发结算；回放播放校验一致；切后台再回前台后战斗已暂停且音频已静音；刘海屏与安全区无遮挡；多点触控下摇杆与冲刺互不抢占；低端机连续三局无明显掉帧；中文字形与数字对齐正常；系统静音开关行为符合预期。

验收：`npm run verify` 全绿，加上真机记录。不以构建通过代替真机验收，不声称未实测机型的帧率。

### 里程碑

M1 真机体验版可完整打一局（HUD 与升级与结算具备，无线电与回放暂缺）。M2 功能对齐 web 端。M3 提审发布。

## 六、体积与预算

当前 37,132 B gzip。Canvas 渲染器与端口层估计新增 30–45 KB 原始代码，gzip 增量约 10–15 KB。web 端在删除 DOM 渲染器后可以丢掉 `style.css` 的 4,859 B gzip。

小游戏包体按原始字节计算：主包预计 180–230 KB，上限 4 MB，占比不足 6%。不需要分包、不需要远程 CDN、不需要引擎插件。

建议给 `check` 增加一条小游戏预算，量级取主包 400 KB 原始字节，留一倍余量，避免后续内容扩张无声吃掉额度。

## 七、验收门槛

不降低任何现有门槛：

- `npm run verify` 全绿，三 seed 模拟与回放校验值不变。`core.ts` 不改，checksum 必须完全一致。
- 新增 `view.ts` 单测：给定 world 与 screen，断言文案、数值、可见性、可点区域集合。
- 新增小游戏端口单测：用假 `wx` 沙箱（画布桩、触点队列、存储映射、音频桩）驱动完整流程，覆盖触摸移动、升级选择、切后台暂停、结算与回放。复用 `test/opening-main.test.mjs` 已有的 vm 沙箱写法。
- 新增静态检查：小游戏产物禁用浏览器全局。
- 真机记录：iOS 与 Android 各一台，含回放一致性结论。

## 八、资质与发布流程

以下顺序不要调换，行政环节通常在关键路径上。

1. **主体**。小游戏正式发布需要企业或个体工商户主体，个人主体无法开通正式发布与支付能力。先确认主体，否则后面全部落空。
2. **账号与认证**。微信公众平台注册小程序，服务类目选游戏，完成微信认证。
3. **软著**。计算机软件著作权登记证书是小游戏审核的基础材料，著作权人须与账号主体一致。办理以周计，建议立项时就启动。
4. **备案**。小程序备案由平台代报通信管理局，未备案不能发布。
5. **游戏自审自查报告**。按官方模板填写，说明内容合规、无违规玩法。
6. **版号**。仅当开通虚拟支付时需要。本项目当前无内购设计，走免费或广告变现（IAA）路线可以不申请版号；一旦加入内购，版号与网络游戏出版物号核发单成为必须。
7. **隐私协议**。后台需配置有效链接，首屏需有合规提示。本项目不收集个人信息、不申请敏感权限，这一项成本很低。
8. **提审与发布**。类目按实际玩法选择三级类目，截图与描述如实。先出体验版自测，再提交审核，通过后发布。

内容层面需要提前留意：像素化的射击与敌人击毁表现一般可通过，但"击破""装甲耗尽"这类表述与血条、枪口特效在审核中属于常见关注点。建议保留像素化风格、避免写实血液与断肢，文案沿用现有非暴力表述。

## 九、风险与回退

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| ES 模块在小游戏内解析异常 | 构建失败，无法启动 | P0 验证；退化为自写拼接构建，改动局限在构建脚本 |
| WebAudio 与浏览器实现有差异 | 音乐节奏漂移、音效丢失、iOS 静音开关行为不同 | 音频端口可整体降级为静音并保留玩法；先保证无音频可玩 |
| Canvas 文字排版与 DOM 不一致 | 文案溢出、可点区域错位 | 换行基于 `measureText`，布局用常量而非估算；逐屏截图对照 |
| 半分辨率贴图导致画面发糊或性能下降 | 视觉与帧率双输 | 上屏画布全分辨率、游戏层半分辨率；必要时提供整屏 1× 绘制开关 |
| 真机帧率不足 | 掉帧影响判定手感 | 现有 60 Hz 固定步长与 8 步上限已具备；降级项为特效段数与阴影 |
| 审核被拒 | 上线延期 | 像素化、非写实、文案中立；预留两轮提审时间 |
| 无障碍能力丢失 | 小游戏端无屏幕阅读器语义 | 平台限制，需产品明确接受；web 端保留现值 |

回退路径：所有新增代码位于新文件与两个端口实现中，`main.ts` 改为启动器后仍可直接切回 DOM 渲染器。若小游戏路线中止，删除 `platform/minigame.ts`、`minigame/` 与 Canvas 渲染器即可回到当前状态，`core.ts` 与现有测试不受影响。

## 十、需要决策的事项

1. 是否采用"视图模型 + 双渲染器"（方案 B），而不是把 web 端也改成 Canvas 单渲染。
2. 屏幕方向默认竖屏。现有摇杆与冲刺按钮的布局适合竖屏，横屏需要重新排布 HUD。
3. 小游戏端不接受无障碍语义，是否确认。
4. 商业模式：免费或广告变现（无需版号），还是内购（需要版号，周期与不确定性显著增加）。
5. 是否顺带接入 `progress-storage.ts`。该模块已具备端口注入，但 `main.ts` 目前没有使用，小游戏端若不接入就没有跨局进度。
6. 当前工作区有未提交改动。按团队协议一 Issue 一 owner 一 worktree，建议先提交或暂存，再从干净基线开分支。

## 附：不动的部分

`src/core.ts`、`src/stage-contract.ts`、`src/stage-rules.ts`、`src/progress.ts`、`content/desert-base.story.json` 以及全部现有测试的断言值。接入属于平台层与表现层改造，验证码与模拟结果必须逐字节保持一致。
