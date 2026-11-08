# 沙漠基地剧情画资源

本资源对应 Issue #23 的 `story.desert.scene-assets`。三幅原创代码像素画与独立预览已完成作者检查，尚未接入战斗。当前月面游戏没有变成沙漠关卡，没有增加剧情跳过、战役解锁或地图碰撞。

`drawDesertScene(ctx, scene)` 只接收 Canvas 2D 上下文与 `opening | victory | defeat`，固定逻辑尺寸 320×180。它不读取 World、时钟、随机数、存档或音频。整数色块与逐行扫描多边形避免斜线插值，保存并恢复调用者的绘制状态。复用现有蓝黑、钢灰、青色与暖橙视觉语言，增加沙地明暗层次。图中太阳只是地球沙漠背景，不提前揭示月球入侵源。

三幅画共用沙丘、破损机库和中继阵列的位置。开场以工程兵足迹引向失联基地。胜利以阵列青色回执、倒下的收割机与前进到阵列旁的工程兵表达求援发出。失败以暗色天空、断裂线路和熄灭阵列表达此次任务中断，工程兵仍站立，不表达永久死亡或解锁回退。

独立预览的正文只通过正常 HTTP 读取既有 `content/desert-base.story.json`，使用 `desert-base.opening/victory/defeat`。没有复制权威正文，也没有改变它。界面明确标为剧情画预览，控件与主游戏分开，不把开发者预览条幅接入产品流程。

## 参考与实现边界

本次搜索并读取了 [Dome Keeper 官方 Steam 页](https://store.steampowered.com/app/1637320/Dome_Keeper/)、[Raw Fury 官方页](https://rawfury.com/games/dome-keeper/)与 [Ninja Gaiden Ragebound 官方 Steam 页](https://store.steampowered.com/app/2542120/NINJA_GAIDEN_Ragebound/)。借鉴目标是横幅叙事画与下方独立文字、明确的前中远景层次，不复制任何素材。官方 CDN 图片抓取 cache miss、公开媒体目录读取超时，Chrome 官方商店页也未完成加载，所以本轮没有把官方实机图标为已观察或已比较。实际构图以既有项目视觉和沙漠剧本为依据，所有图形由本仓库代码原创绘制。

已读取 imagegen skill。它明确不适用于更适合 Canvas 的确定性代码原生视觉，因此本单元未调用生图，也未引入生成或下载的位图。未改动角色动画、音效和音乐，没有相应新增验收声明。

## 复验

```sh
npm ci
npm run verify
node scripts/desert-audition.mjs
```

正常打开 `http://127.0.0.1:4187`，切换开场、胜利、失败和中英文。在 1280×720 与 390×693 分别检查画面、正文和控件。桌面实际画布为 640×360 的 2 倍整数缩放，窄屏为 320×180 原尺寸，均使用 `image-rendering: pixelated`。两个尺寸都保留全部正文，无横向滚动。390px 验证是响应式预览，不是实体触屏验收。

作者实际通过 Chrome 正常按钮完成 12 个组合，原始截图、DOM、控制台记录见 [frames.json](evidence/desert23/frames.json) 与 [browser-record.json](evidence/desert23/browser-record.json)。最终 Warn/Error 为空，预览 alert 为空。场景按钮实际只有三个；Canvas 没有 `aria-pressed`，fallback 为空。此前宽桌面按 3 倍放大导致正文下折，已通过同时按可用高度选择整数倍修正；截图只封存修正后的版本。

两项 Node 测试使用仅支持整数填色和状态栈的最小光栅记录器，检查覆盖边界、重复输入输出一致、三态输出不同及调用者状态恢复。它不模拟完整浏览器，也不替代真实画面验收。

作者完整 `npm run verify` 通过 58 项，0 失败，gzip 27,185 / 153,600 字节。新 `desert-scene.js` 已包含在统一 dist 包体检查，预算未提高。既有 11 个运行文件与 main 基线逐字节相同，标准 checksum 保持 `d1326dd8`、`c8b73f95`、`22cc59b2`。预览页、预览 JS、JSON 是开发者独立服务资源，不由现有游戏入口下载；其大小单独记录在 [runtime.json](evidence/desert23/runtime.json)，不把它们冒充已接入主游戏的下载量。

截图运行时代码提交见 runtime.json。后续只追加本证据文档。当前 PR head 的非作者领域验收和 CI 由主协调安排，作者记录不替代独立通过。本任务没有测量浏览器 FPS，没有试玩沙漠战斗或证明六关可玩。
