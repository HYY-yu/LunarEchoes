# Issue 17 独立视觉验收

结论：INCOMPLETE。候选 `9a3521dda5b559dbacffb842ccbeafd3ad9e7ae4`。浏览器实测原始运行时来自 `35c1c01631ebe49fc5e0f3ff52b09f9742f05e2c`。独立构建两版后 `diff -qr` 比较全部 dist 无差异；协调者另核对 4174 服务的 11 个资源与 9a 构建 SHA256 一致，证据为 `/private/tmp/lunar-heartbeat-20261108-0102/served-runtime-4174.json`。

Chrome 桌面 1280×720，自然种子 3165727511 于 00:20 升级选择新星。`desktop-00.jpg` 至 `desktop-34.jpg` 采样游戏时间 00:35–00:36。窄屏 390×693 为该真实局的回放，`narrow-replay-00.jpg` 至 `narrow-replay-79.jpg` 采样游戏时间 00:31–00:33。第二个自然种子 3690896236 的 `active-crowd-00.jpg` 至 `active-crowd-99.jpg` 采样游戏时间 01:10–01:12，有新星、拾取和周边敌人。另一现场截图见多名敌人及橙色预警，但未捕获密集敌群、预警和新星同时出现。

该自然局 00:58 失败，回放显示校验一致 `lunar-1 · 38332144`。升级选择界面观察到游戏时间停留 00:25；暂停和恢复操作正常。没有捕获新星存续时暂停的画面，不能证明该瞬间冻结。Chrome 开发日志的 warn/error 查询为空。未完成真实触屏、音频听感和动态流畅性验收。

原始帧推荐归档：`desktop-15.jpg` 为扩散，`desktop-21.jpg` 为碎裂，`desktop-28.jpg` 为淡出末期，`narrow-replay-16.jpg` 为窄屏碎裂。帧内容已逐张查看；它们未经重绘。`summary.json` 列出全部 215 帧的实际尺寸、格式和 SHA256。原始采样精确时刻未记录，标为 unknown；所列游戏时间为本组观察范围，并非每帧精确时间。这些截图为不等间隔样帧，不是连续录屏或帧率测量。
