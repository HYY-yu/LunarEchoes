# Issue 22 第 2 项独立证据归档

归档日期为 2026-11-08。证据对应候选 `cb82545471ea75181ce07dde37d5e36dbd42ea5b`，不是后续文档提交的独立通过声明。当前候选的汇总领域结论为限定范围 PASS。PR 24 只关联 Issue 22 第 2 项，不关闭整个 Issue 22。

## 数值原始输出与复跑边界

[numeric](numeric/) 中的 `verify.log`、`npm-ci.log`、`paired.log`、`manifest.txt`、`diff.patch`、`revisions.txt`、`mutation-missing.log` 和 `mutation-mutable.log` 均逐字节复制自 `/private/tmp/equipment22-balance-evidence/`。原始记录使用 Node v24.21.0。`manifest.txt` 是当时的差异清单，不是本归档的文件清单。

`verify.log` 记录 56 个测试通过，gzip 25,104 字节，预算 153,600 字节。`paired.log` 记录三个种子的 33 次候选抽选与基线一致，checksum 分别为 `d1326dd8`、`c8b73f95`、`22cc59b2`。这不是浏览器帧率测试。两个 mutation 日志保留移除 magnet 和取消冻结后的真实断言失败，不能与作者缺少公共导出导致的模块加载失败混淆。

`equipment22-balance-compare.mjs` 原样复制自 `/private/tmp/equipment22-balance-compare.mjs`。`baseline-summary.json` 是本次从 `/private/tmp/equipment22-balance-baseline.json` 提取的 seed、offerCount、checksum 和 actions 摘要，不是原始完整基线。完整基线没有归档。

原脚本的本地复跑调用格式为 `node /private/tmp/equipment22-balance-compare.mjs <已构建的候选checkout绝对路径>`。这里说明脚本参数，不声称恢复了原调用的完整 shell 历史。脚本固定读取 `/private/tmp/equipment22-balance-baseline.json`，并加载参数目录的 `scripts/simulate.mjs` 和 `dist/core.js`。这些临时路径及完整基线必须仍存在。这份原脚本不能声明为仓库内独立可运行的验收命令。仓库内常规验收命令仍是 `npm ci && npm run verify`。

## 第一位独立浏览器验收

[desktop-narrow/ledger.md](desktop-narrow/ledger.md) 原样复制独立 verifier 的过程与 INCOMPLETE 结论。`runtime.json`、`frames.json`、`dom.json`、`dom-assertions.json` 也原样复制自 `/private/tmp/equipment22-independent-evidence/`。六张 JPG 只按原 `frames.json` 中实际存在的文件复制。

[archive-check.json](desktop-narrow/archive-check.json) 是归档时生成的检查结果。六张图片与来源逐字节相同，字节数及 SHA256 与原索引一致，macOS `sips` 读出的尺寸也一致。四张为 1280×720，两张为 390×693。没有重新编码、拼图或复制提取工具。

独立 verifier 自然游玩两局，覆盖六类升级、同项 LV 1 至 LV 2、重开零级隐藏和失败回放 `bc761b70`。四组中英文 DOM 记录包含 title、aria-label、LV 与矩形。含阴影的装备区宽度桌面 329px、窄屏 265px，没有与已有状态区相叠。最终页面级 Warn 和 Error 日志为空。截图时间见原 `frames.json`，没有补写未知的时间或设备信息。

普通 viewport 只调整尺寸，没有激活 coarse pointer，触屏区域尺寸为零。因此第一位 verifier 整体结论仍为 INCOMPLETE。原 ledger 保留读取整个 Chrome App 被自动审批拒绝，以及后续 DevTools 快捷键被判为绕过而拒绝的记录。没有继续扩大读取或绕过审批，DevTools 开闭状态未知。

## 第二位独立触屏补项

[touch/single-dash-result.md](touch/single-dash-result.md) 记录最终限定范围 PASS。`result.md`、`recovery.md`、`supplement.md` 按时间保留初次超时 INCOMPLETE、一次恢复和此前冲刺未完成的状态，不修改历史结论。它们与 `runtime.json`、`observations.json`、`frames.json` 均原样复制自 `/private/tmp/equipment22-touch-evidence/`。九张原 JPG 按索引复制，字节及 SHA256 与原记录一致，尺寸另用 `sips` 读取，结果见 [touch/archive-check.json](touch/archive-check.json)。不复制依赖本机会话的 extract 工具。原日志提到的提取命令需要原机器、原会话及原工具，不能作为仓库独立复跑命令。

自然取得六类装备时，装备含阴影区域与实际摇杆和冲刺区域不重叠。原生指针拖动摇杆使场景移动。最后一次普通原子点击在按住 D 的同时点击冲刺，再立即暂停，真实 DOM 冲刺冷却为 `2.4`。原图 [frame-line492.jpg](touch/frame-line492.jpg) SHA256 为 `993fb27253bd786eebec3693fda262ec26fa89c4db4c945804dc45920381af85`。

汇总 PASS 只覆盖桌面 Chrome 触屏仿真及键盘辅助指针冲刺，不覆盖实体手机或实体双指。最终 coarse 为 true，maxTouchPoints 为 1，视口为 390×693，页面 Warn 和 Error 查询为空，仿真已清理、任务页已关闭。原始记录保留不支持 raw CDP 输入的返回，没有用替代传输重试。第一位 verifier 没有新增动画或音频验收声明。

这些领域证据仍绑定候选 `cb82545471ea75181ce07dde37d5e36dbd42ea5b`。后续只改文档的新 head 仍需非作者核对 11 个运行时资源字节一致，并完成 verify 和当前 head CI。

## 文档发布前检查

作者归档收尾重新运行 `npm run verify`，原始输出见 [archive-verify.log](archive-verify.log)。56 个测试通过，gzip 仍为 25,104 字节。作者检查构建出的 11 个运行时文件与原候选哈希一致，见 [archive-runtime-check.json](archive-runtime-check.json)。这不代替非作者对最终 sealed head 的独立桥接。最终文档 head 的独立验证与 CI 状态仍为 pending。
