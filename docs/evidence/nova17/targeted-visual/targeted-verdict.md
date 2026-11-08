# Issue 17 独立定向补充验收

结论 PASS，仅覆盖下列三个此前未完成的视觉项。候选精确 head 为 `9a3521dda5b559dbacffb842ccbeafd3ad9e7ae4`，基线为 `a9d10e6e65c91f539a840366e0a3b9cf00af9a06`。本验收员不是实现作者，没有修改作者源码、PR 或模拟状态。原 Terra INCOMPLETE 报告保留，其缺项由本次独立实测补齐。

| 补充项 | 结论 | 实际证据 |
|---|---|---|
| 新星存在时暂停冻结并恢复 | PASS | `freeze-0000.jpg` 与 `freeze-0001.jpg`，UTC 01:31:19.790 与 01:31:39.796，相隔 20.006 秒，HUD 均为 00:40；暂停面板上下可见电弧区域逐像素相同。`thaw-0000.jpg` 至 `thaw-0029.jpg` 连续事件证明恢复后继续碎裂并消失。 |
| 密集敌群、橙色预警和新星同屏可读性 | PASS | `dense-burst-0030.jpg` 代表自然局 01:06。约 12 个可见或部分可见敌人、2 处橙色预警、多枚橙色弹丸与新星同屏；角色轮廓、HUD、危险信号可辨。数目为截图人工计数，不是读取 World。`dense-burst-0005.jpg` 至 `dense-burst-0064.jpg` 保存连续上下文。 |
| 实际动态过程 | PASS | 官方 CUA CDP `Page.startScreencast`、`readEvents` 和逐事件 `Page.screencastFrameAck`，保存真实连续画面与原始 timestamp/monotonicTimestamp。完整自然脉冲 `full-burst` 55 帧，密集片段 `dense-burst` 60 帧，均实际看到无新星、点火、扩张、碎裂、消失。无突兀截断或可见卡死。原时间戳 VFR 查看副本在 Chrome 中播放，`paused=false`、`playbackRate=1`、`error=null`。 |

设备范围为本机 macOS 27.0、Google Chrome、游戏实机画面 1280×1177。没有设置临时 viewport override，无需恢复。CPU 型号读取遭 sandbox 拒绝，Browser.getVersion 在 raw CDP 不受支持，未绕过；不据此生成性能比较。窄屏、回放、输入与声音的既有证据不由本次重复验收。没有真实手机、触控或新增音频听感 PASS，也没有设备 FPS 或帧时间性能承诺。

自然种子 1336822959。首次升级取得 Nova LV1，后续选推进器与两次复合装甲，使用 D/S/A/W 方形走位。未注入种子、World、生命值、时钟，未加调试入口。最后游戏暂停在 01:13，79/150 装甲，控制台 warn/error 查询为空。CUA 已提交 completion_summary 并释放控制，未接触其他用户页面。

旧 4174 服务打开时报 ERR_CONNECTION_REFUSED，只记录不可达，不推断进程退出原因或产品崩溃。独立 clone 在 `/private/tmp/lunar-nova17-targeted`，执行 `npm ci && npm run build` 后于 127.0.0.1:4176 提供游戏，exec session 66634。`runtime-manifest.json` 保存构建清单；协调者另核对实际 HTTP 11 资源与独立 9a 构建一致。GitHub connector 在本次开始时确认 PR21 仍为该 head、open、draft。

`raw-manifest.json` 保存 187 张原始 JPG 的 SHA256、尺寸、原始事件序号和时间戳。`extract.py` 只读本验收员的精确 Codex session 日志并解码原始 image_url 字节，不缩放、改绘或压缩 JPG。原始完整捕获分别为 524、74、594 个事件，归档的是明确列出的连续子段；其余事件仅在 CUA 内存中，没有声称全部已归档。连续子段的事件序号逐一连续。

`full-burst.mp4`、`dense-burst.mp4`、`thaw.mp4`、`resume.mp4` 是方便复核的查看副本。按原始时间差编码，时间量化为 1 毫秒，无插帧和变速，底部补 1 像素以兼容 H.264，输出 1280×1178。录制和编码参数不等于设备 FPS。播放器已分别确认完整自然脉冲和密集片段原速播放。`resume` 记录先前暂停面板遮挡电弧的尝试，仅作辅助，冻结 PASS 依据后来可见电弧的 `freeze` 与 `thaw`。

复核命令在本证据目录执行。

```sh
python3 check-evidence.py
python3 make-video.py
python3 -m http.server 4177 --bind 127.0.0.1
```

打开 `http://127.0.0.1:4177` 播放密集片段。复现游戏时在独立 clone 执行 `npm ci && npm run build` 与 `PORT=4176 node scripts/serve.mjs`，自然升级选择 Nova；种子随正常新局变化，截图序列用于复核本次精确场景。

本次应用 Prove It Works，结论依据实机原始画面和连续事件；测试与 CI 不代替视觉验收。采用 benchmark-checklist 的证据边界，不把截图调用频率、screencast 事件数或视频帧率当作设备性能。
