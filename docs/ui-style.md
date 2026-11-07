# Issue 16 月面终端视觉

现有月面单局采用统一的深蓝灰终端与薄荷色焦点。主菜单纵排出击和回放，战斗界面贴边显示分段装甲与代码像素装备图标，升级采用三条横向选项，结算采用任务报告。中文正文使用本机系统字体，标题、英文和数字采用本机等宽字体。没有新增设置、字体下载、运行时位图、音频或第三方依赖。

## 设计来源与审阅

先读取 Issue 16 原文，再实际查看用户图、HoloCure 作者官方升级实机与 SYNTHETIK 官方实机宣传图，最后生成四屏概念。协调者实际查看概念和参考并明确通过设计后，才开始修改生产文件。

- [用户 Issue 16](https://github.com/HYY-yu/LunarEchoes/issues/16) 及[用户参考图](https://github.com/user-attachments/assets/03499d6c-3eac-4efc-89ec-4ce161abf773)提供四角 HUD、升级层级与焦点边框方向。
- [HoloCure 作者官网](https://kay-yu.itch.io/holocure)的[官方升级实机图](https://img.itch.zone/aW1nLzkyMzAyODMucG5n/original/4zbyc1.png)提供整条选项点击区、标题与说明分层的参考。没有复制人像、字体、图标、雨线或重抽功能。
- [SYNTHETIK 官方网站](https://www.synthetikgame.com/)的[实机宣传图](https://static.wixstatic.com/media/876796_3533a84a621447a0ab9e99b2e9b16b64~mv2.jpg)提供中央战区留白和装备贴边的参考。没有复制武器、美术或营销栏。

概念与参考保存在本地 `/private/tmp/lunar-ui16-design/`。`concept-v1.png` 是内置 imagegen 生成的评审资产，不是实际游戏截图，也没有进入仓库或运行时。概念里的新建筑、人物、护盾装备与样例数值均未采用。实际背景和人物继续由既有 `render.ts` 与 `art.ts` 绘制。

## 展示约定

| 项目 | 约定 |
| --- | --- |
| 颜色 | 底色 `#091b26`，面板 `#102a36`，正文 `#e1eee7`，次要文字 `#a8c1c0`，焦点 `#9be5d4`，数值强调 `#efbf72` |
| 边框 | 2px 实线、像素角标与硬阴影；只在终端、按钮和装备位使用 |
| 字体 | 中文原生 sans-serif，英文与数字本机 monospace；不请求远程字体 |
| 安全区 | 桌面至少 24px，窄屏至少 14px，并考虑 safe-area-inset；导航触区至少 44px |
| 升级 | 当前等级到下一等级直接读取 `world.upgrades[id]`；说明沿用原双语文案，包括真实装甲上限 +25 与修复 45 |
| 装备 | CSS 几何图标对应现有 pulse、orbit、nova，并保留可访问名称、title 和真实等级 |
| 输入 | 原按钮处理器、快捷键、触屏指针事件、录制与固定步长循环保持原样 |

只向 body 显示属性写入当前 screen 与 phase，CSS 据此布局。渲染、音频与模拟模块没有改动，也不从展示层写回战斗状态。

## 当前证据

下列 PNG 来自真实 Chrome 页面。桌面 CSS 视口与 PNG 均为 1280×720，窄屏均为 390×693。图片没有采用概念场景，没有注入 World，也没有通过静态 mock 伪造状态。

| 视图 | 桌面中文 | 窄屏英文 |
| --- | --- | --- |
| 主菜单 | [截图](evidence/ui16/desktop-title.png) | [截图](evidence/ui16/narrow-title.png) |
| 战斗 HUD | [截图](evidence/ui16/desktop-hud.png) | [截图](evidence/ui16/narrow-hud.png) |
| 升级 | [截图](evidence/ui16/desktop-upgrade.png) | [截图](evidence/ui16/narrow-upgrade.png) |
| 失败报告 | [截图](evidence/ui16/desktop-result.png) | [截图](evidence/ui16/narrow-result.png) |

其余中英文对应截图、暂停、回放、本地验证输出与会话日志保存在 `/private/tmp/lunar-ui16-evidence/`。带 `before-fix` 的图片是早期检查记录，不是交付证据。`desktop-zh-hud-final.png` 实际捕获升级层，不用于 HUD 证据。桌面 HUD 与菜单截图早于仅影响窄屏 HUD 垂直位置的 CSS 修正，画面所覆盖的规则没有后续变化。升级、结果和窄屏 HUD 截图来自最终样式。

作者实际启动任务，操作 D、S、A 移动，点击冲刺，拖动摇杆，切换语言和声音，暂停恢复，并通过真实拾取触发升级。快捷键 1 将脉冲步枪从 LV1 装配到 LV2。最终 seed `522104542` 在 01:01 失败，66 击破、等级 2。失败报告保留真实战绩，并启动了该局实际录制的回放。回放终点实际显示校验一致，checksum 为 `a9579683`，返回基地按钮也已实际操作。见[证据摘要](evidence/ui16/summary.json)。

初始系统状态报告 Mac 锁屏。Chrome 扩展仍能截图、点击、拖动及通过 `tab.pressKey` 操作。一次触屏仿真与页面重载工具调用耗时 727 秒，记录为工具环境挂起，不能据此报告产品卡顿或 FPS。原始 CDP 输入与 Playwright body.press 不可用，后续使用成功的真实 tab.pressKey。Page.startScreencast 没有收到帧，因此没有录屏，不声称动画片段已验收。

音频代码及处理器没有改动。声音开关的文本与可操作性已检查，本次没有新增音频听感验收。没有覆盖实体手机、跨浏览器、胜利结算实际试玩或帧率测量。成功与失败使用同一报告布局，成功模拟不能替代胜利实机截图。

## 可执行检查

```sh
npm ci
npm run verify
PORT=4186 npm run dev
```

`npm run verify` 通过 43 项测试，gzip 23,972 字节，预算 153,600 字节。种子 208907、42、101 的 checksum 分别为 `d1326dd8`、`c8b73f95`、`22cc59b2`，与改动前一致。离线模拟没有被用作浏览器 FPS 证据。提交后仍需独立作者以当前 head SHA 验收，不能把作者自测或本文当作合并批准。


## 内联 favicon 修复

稳定复现键为 `ui.resource.default-favicon-404`，继续跟踪于 Issue 16。协调者已通过 HTTP 核对，main `9ad6b6a` 与集成后 UI head `265fcd7` 都对浏览器默认请求 `/favicon.ico` 返回 404。两者的 index.html 和服务脚本一致，因此这是既有资源缺项。

本次只在 HTML head 声明原创像素月牙与中继信号 SVG，采用正确 URL 编码的 `data:image/svg+xml`。没有位图、远程资源、JS 或运行时依赖，图标字节纳入现有 HTML 包体检查。HTML body、全部 JS 和 style.css 不变。

作者重跑 `npm run verify`，51 项测试通过，gzip 24,669/153,600 字节。日志与全部 dist 文件的前后 SHA-256 分别保存于本地 `/private/tmp/lunar-ui16-evidence/favicon-verify.log` 和 `favicon-hash-comparison.json`。只有 index.html 哈希变化，HTML body 相同，SVG 解码后通过 XML 解析。浏览器由独立验收员在新 head 的新页面复核。此前截图与作者的无错误日志不代表本修复已通过浏览器验证。PR 保持 draft，独立视觉验收仍为 INCOMPLETE。
