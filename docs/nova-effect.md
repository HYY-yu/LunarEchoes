# 电磁新星像素电弧

Issue [17](https://github.com/HYY-yu/LunarEchoes/issues/17) 只改变既有电磁新星的展示。新星先点火并扩张，随后电弧断裂、消失。中心留空，青色电弧搭配少量白色接点，所有小矩形的四角均处于 `Fx.size` 内。

`src/render.ts` 继续读取 `Fx` 的 `x`、`y`、`life`、`size`。每两次模拟 tick 选取一帧，以固定64段、每段最多4个像素块绘制。点火接点仅在最初3个可见 tick 加亮。渲染不创建独立状态、不读取真实时间、不调用随机数，也不修改 `World`。模拟的即时伤害、半径、冷却和30 tick效果寿命保持原样。暂停、升级和终局停止模拟，因此电弧也停止变化。

## 参考与设计

已查看用户的[12格参考](https://github.com/user-attachments/assets/0a8bed68-892e-407c-92a0-10c8fc43dc33)及[12帧GIF参考](https://github.com/user-attachments/assets/a6daf3b2-fb13-40b9-a4b5-e91e01be80fb)。借鉴短点火、扩散、碎裂和消失的运动顺序，未复制参考像素。

已查看 [HoloCure 官方商店](https://store.steampowered.com/app/2420510/HoloCure__Save_the_Fans/)的[实机截图](https://shared.st.dl.eccdnx.com/store_item_assets/steam/apps/2420510/ss_f678c4dd81fd2c42b0682cba66317e6914bde75b.1920x1080.jpg)。生命和装备位于上左，计时上中，等级上右，中央用于走位。此次借鉴中央留白和效果与敌人的颜色区分，未修改本游戏操作布局。参考未取得复制授权，仅供分析。

内置 imagegen 生成了环形电弧与六向放射的对照概念。协调审阅后选取环形方案，放射方案容易暗示六方向攻击。概念的中心十字过大，代码仅用短暂环上接点点火。生成图只保存在本地设计目录，运行时未引入位图、音频、远程资源或依赖。

## 作者验证

执行 `npm ci && npm run verify`。54项测试通过，gzip总量25073字节，预算153600字节。三个180秒模拟均胜利，种子208907、42、101的checksum分别为 `d1326dd8`、`c8b73f95`、`22cc59b2`，与基线一致。

`test/nova-render.test.mjs` 验证像素轮廓随life扩张和消散、所有角点不越既有半径、同一life不受真实时间参数影响、渲染不写World、模拟冻结和重新会话一致，以及原有敌人危险预警保留。统一检查还验证无代码注释及包体预算。

作者在 macOS Chrome 的新任务页自然试玩，未注入种子、World、生命值或时钟。种子3798850216，首次选择引力采集器，下一次自然选项获得电磁新星。桌面视口1280×1177，00:34捕获LV1新星扩张与消散。暂停和继续正常切换。将视口设为390×844后，下一次自然升级取得LV2，01:04捕获窄屏扩张与消散。截图中角色、拾取物和HUD清晰。结束后恢复原视口。Console警告和错误查询返回空列表。

[原始帧与时间记录](evidence/nova17/capture.md)是实际游戏截图。概念图未充作最终证据。

## 独立验收与证据范围

以下独立结论针对源运行时 `9a3521dda5b559dbacffb842ccbeafd3ad9e7ae4`。证据归档提交只改 docs，新 head 仍须由非作者复核全部 11 个运行时资源同一性、完整 verify 和 CI；作者不将旧结论写成新 head 的独立 PASS。

独立数值验收完整 verify 为 54 项测试通过，gzip 25073 / 153600 字节。两项测试缺口通过真实故障注入验证：删除 hit 绘制触发断言失败，破坏全新会话一致性触发重开断言失败。原始验证和预期失败日志见[数值证据](evidence/nova17/independent-9a/README.md)，原字节、来源与 SHA-256 见[索引](evidence/nova17/independent-9a/index.json)。十种子单机器人配对结果和先前构建比较是明确标注的转录，不是原始 stdout，也不代表人工胜率或浏览器性能。

第一位非作者 Terra 的[原报告](evidence/nova17/independent-visual/notes.md)保持 INCOMPLETE。第二位非作者 Astra 的[定向原报告](evidence/nova17/targeted-visual/targeted-verdict.md)仅对三个缺项给出 PASS。主协调核看冻结两图和密集代表帧，并运行本地 `check-evidence.py`，187 张原图的摘要、连续事件和冻结 ROI 检查通过。下表汇合两次独立观察，不改写原报告。

| 覆盖项 | 独立观察与边界 |
|---|---|
| 桌面与窄屏 | Terra 在 Chrome 1280×720 自然种子 3165727511 取得 Nova。390×693 是同一自然局的真实回放，非实体手机或触控验收。另一个自然种子 3690896236 记录周围敌群。精选[桌面扩散](evidence/nova17/independent-visual/desktop-15.jpg)、[碎裂](evidence/nova17/independent-visual/desktop-21.jpg)、[淡出](evidence/nova17/independent-visual/desktop-28.jpg)和[窄屏碎裂](evidence/nova17/independent-visual/narrow-replay-16.jpg)。精确采样时刻 unknown，不将不等间隔样帧称为录屏。 |
| 失败与回放 | Terra 观察自然局 00:58 失败，回放校验一致 `lunar-1 · 38332144`。 |
| 新星暂停与恢复 | Astra 自然种子 1336822959，Mac Chrome 1280×1177。暂停时 [freeze-0000](evidence/nova17/targeted-visual/freeze-0000.jpg) 与 [freeze-0001](evidence/nova17/targeted-visual/freeze-0001.jpg) 相隔 20.006 秒，HUD 同为 00:40，面板上下可见电弧 ROI 逐像素相同。[恢复片段](evidence/nova17/targeted-visual/thaw.mp4)显示继续碎裂并消失。 |
| 密集敌群与危险预警 | Astra 同一自然局 01:06 的[原始代表帧](evidence/nova17/targeted-visual/dense-burst-0030.jpg)可见约 12 个完整或部分敌人、2 处橙色预警及弹丸，角色、HUD 和新星可辨。数目来自截图人工计数。[连续上下文](evidence/nova17/targeted-visual/dense-burst.mp4)保留该场景。 |
| 实际动态 | Astra 使用真实 CDP screencast 连续事件，记录 timestamp 与 monotonicTimestamp。[完整脉冲查看副本](evidence/nova17/targeted-visual/full-burst.mp4)及密集片段显示点火、扩张、碎裂、消失。独立验收在 Chrome 确认原速播放、无播放器错误；没有可见卡死或突兀截断。 |
| 控制台 | 两次独立验收的 warn/error 查询均为空。 |

Terra [完整索引](evidence/nova17/independent-visual/summary.json)列出本地 215 帧，仓库只保存其中四张原图。Astra [原始清单](evidence/nova17/targeted-visual/raw-manifest.json)列出本地 187 张原图，仓库只保存精选 11 张。两份清单均包含未入仓库的本地图，不能将完整清单当作全部原图已归档。复制文件的实际尺寸、来源、字节数和 SHA-256 分别见 [Terra 归档索引](evidence/nova17/independent-visual/archive-index.json)与 [Astra 归档索引](evidence/nova17/targeted-visual/archive-index.json)。所有原 JPG 均按原字节复制。

三个 MP4 是原时间戳 VFR 查看副本，不是原始 JPG。时间量化为 1 毫秒，无插帧、无变速，底部补 1 像素以兼容 H.264，输出 1280×1178。它们仅用于 docs 验收，不进入 dist 或运行时资源预算。未复制暂停面板遮挡电弧的辅助片。原报告中的 `check-evidence.py` 和 `make-video.py` 命令只适用于 `/private/tmp/nova17-targeted-evidence` 的完整本地证据集；仓库精选集不包含这些脚本或全部原帧。完整连续子段与冻结检查由独立报告及主协调本地复核记录证明。

## 交付限制

本次没有浏览器设备 FPS 或帧时间性能测量。截图或视频编码帧率不等于设备性能。没有实体手机、真实触控或新增音频听感 PASS。音频代码未改。最终 docs-only head 的独立运行时同一性、verify 与 CI 由主协调另行验收，满足门槛前保持 draft，不合并。
