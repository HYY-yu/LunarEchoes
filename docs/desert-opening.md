# 沙漠开场接入

[Issue #38](https://github.com/HYY-yu/LunarEchoes/issues/38) 让玩家在部署前看到既有沙漠像素画、失联背景和操作目标。首次启动任务先展示开场，部署和跳过才创建新局。暂停页保留完整目标。此单元不完成 B1、B2 或 Issue #23，也不接入无线电、结局、线索、解锁、存档或其他地图。

## 会话与内容

`main.ts` 的 `Screen` 增加 `opening`，仍独占世界、录制、输入和声音会话。开场使用既有 `drawDesertScene(context, 'opening')`，320×180 等比像素画布。开场和标题映射既有 menu 音乐，不新增声音。

标题按钮调用 `showOpening()`，只切屏和清理输入与帧时间。`finishOpening(reason)` 仅在开场有效，记录稳定 ID 和 continue 或 skip，再调用唯一的新局入口 `begin()`。Retry 直接调用 `begin()`，Replay 直接调用 `startReplay()`。开场等待、语言、静音、失焦、隐藏和恢复均不派发战斗动作，不生成新局种子。

构建通过现有 `validateDesertStory` 校验完整原目录，只提取 `desert-base.opening` 与 `desert-base.objective` 的 ID 和完整中英文。内容嵌入 inert application/json script，转义小于号，没有请求、加载状态、手抄剧情或依赖。main 在边界解析 unknown，验证两个 ID 和非空语言；错误使用现有 Error 日志与双语通知，不能进入战斗。

语言和静音刷新原位更新开场 DOM，保留动作按钮、焦点和滚动位置。部署后焦点转到游戏画布。按键释放始终清理；开场不收集战斗按键，跨屏自动重复不会补入已清空按键集。原生按钮 Enter 与 Space 保留浏览器激活。运行中 header 按钮获得焦点后，WASD、暂停和数字升级仍有效；文本输入不接收战斗快捷键。这是协调者指出的局部输入合同修正，没有增加玩法。

清理边界同时释放当前摇杆 pointer capture 并复位摇杆。触控输入仅在 game/running 有效。暂停和重开同时重置累计时间与上一帧，避免补入展示时间。

## 可重复的作者验证

运行 `npm ci` 和 `npm run verify`。新增 `test/opening-main.test.mjs` 执行 dist 中实际编译的 main 及真实 core、rules、i18n、scene 模块，使用依赖零的 DOM、RAF、crypto 适配和 renderer、Synth 替身；测试没有复制会话逻辑。观察实际 World、RNG、录制动作、screen 和 checksum。该适配不能证明真实布局、原生浏览器派发或听感，因此另有浏览器作者自检与待独立验收。

七项新增测试覆盖构建的完整原文与关闭 script 转义 round-trip；开场冻结、双语与焦点滚动；pointer、Enter、Space 完成；不同等待、跳过和切语言后的同种子动作与 checksum；捕获释放与暂停目标；真实终局回放校验及直接 Retry 新种子；坏内容拒绝；header 焦点下移动、暂停和实际升级选择。初次 header 升级样例自然死亡，作者将输入改为通过真实摇杆追逐掉落晶体，先断言确实进入升级，再断言数字选择恢复战斗。没有跳过断言或修改模拟。

作者 `npm run verify` 通过 111 项测试，0 失败，AST 无注释检查与下载预算均通过。产物共 34,329 gzip 字节。`git diff --check` 和类型检查抑制搜索均通过。源码冻结 SHA 见 PR 验证记录。三个既有模拟种子仍均在 180 秒获胜，checksum 分别为 208907=`6d37c8d2`、42=`ff94b04b`、101=`c71d5dc4`，与修改前基线相同。预算保持 153,600 gzip 字节。

## 真实浏览器作者自检

2026-11-08，独占 localhost 预览，Chrome extension 任务 tab `1375938504`，1280×720 与 390×693，中文和英文。IAB 不可用，使用新建任务 tab；未访问其他 tab、原生 Chrome 应用或 DevTools。作者在未提交工作树上运行，不属于独立领域验收。

实际观察开场原图与完整双语原文、语言切换、Enter 启动与部署、原生 Space 跳过、进入战斗与 Pause 查阅目标。390×693 英文 `scrollWidth=390`，面板宽 350、高 530，图文与两按钮完整可达。桌面使用面板内滚动，页顶语言与声音按钮保持可达。截图在 `/private/tmp/opening38-*.png`，包含 desktop zh/en、mobile zh opening、mobile en opening 与 zh/en pause。已操作移动和冲刺，观察自动开火与自然失败终局；真实回放到 00:58 显示“回放校验一致”，`lunar-2 · 1c28d665`，种子 `3469251556`。截图 `/private/tmp/opening38-browser-replay.png`。

未实测真实触摸设备、真实浏览器升级拾取路径或目标手机性能。声音控件与 menu 生命周期有源码和自动化证据，作者没有听音，不声明听感合格。当前 head 的独立剧情、视觉音频、数值性能验收与成功 CI 是合并前置条件；作者截图和测试不能替代这些门槛。
