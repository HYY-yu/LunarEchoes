# 沙漠胜利结算

[Issue #42](https://github.com/HYY-yu/LunarEchoes/issues/42) 让玩家在真实沙漠胜利后看到既有胜利像素画，以及完整双语胜利原文和雨林回应线索。同页保留统计、重新部署和回放上一局；两个动作直接离开剧情，无需额外确认或阅读等待。雨林回应只是叙事，不解锁或提供可玩关卡。本单元不完成 B1、B2 或 Issue #23。

## 内容与会话边界

`main.ts` 仍独占 screen、World、录制和结算 DOM。只有 `screen === 'game' && world.phase.kind === 'won'` 展示原 `drawDesertScene(context, 'victory')`，按顺序显示 `desert-base.victory` 和 `desert-base.next-clue` 全文。失败继续走既有分支，失败代码与原样式逐字保持；回放终点继续显示校验结果。

唯一私有 `DesertContent` 持有 opening、objective、defeat、victory、nextClue 五条冻结的双语内容。构建端从完整校验后的 canonical 目录投影 id、zh、en，运行端严格验证五字段、各 literal ID 与非空双语，并冻结条目。没有复制正文到 i18n，没有第二加载器或 nextStageId。

胜利画布、两段正文、统计和动作按钮只挂载一次。语言、静音和可见性刷新原位更新文本及无障碍标签，保留节点与滚动。首次挂载时焦点在战场或 body 才使用 preventScroll 转到重新部署；已有 header 焦点保持不变。按钮保留原生 Enter 与 Space 规则。

重新部署直接调用 `begin()`，生成新随机种子与完整初始 World；回放直接调用 `startReplay()`，消费本局完整录制。终局展示、等待、切语言、静音、失焦、隐藏、恢复和无效战斗输入不改 World、RNG、动作、封存录制或 checksum。没有修改模拟、规则、装甲、时长、回放协议、存储、解锁、画面资源、音频、依赖、CI 或预算。

## 作者验证与剩余门槛

精确基线 `322efda4eeec7a6c044380301832efb574c6db08` 的 `npm ci` 与 `npm run verify` 通过。候选 `npm run verify` 通过 118 项测试，0 失败，无跳过。AST 禁止注释和下载预算检查通过，产物 35,809 gzip 字节，预算仍为 153,600 字节。三个既有输入机器人种子仍在 180 秒获胜，本机 checksum 与基线一致：208907 为 `6d37c8d2`，42 为 `ff94b04b`，101 为 `c71d5dc4`；这些是同平台观测，不作跨平台 oracle。

编译后的实际 main 沿标题、开场、正常输入和升级自然到达 won，没有注入 World、HP 或 phase。基线归档实际构建与候选构建在同一宿主驱动相同输入，完整终局 World（含 RNG）、动作和封存录制逐字相同。永久测试以同平台完整 core replay 比较实际 main 的全 World 与 checksum，随后确认展示交互不改变完整快照，避免将本机数值锁为跨平台标准。

五条 canonical 中英文、所有 locale 的 script 转义和 replacement token 已覆盖。victory 与 nextClue 的缺项、错误 ID、空值、错误类型和多余字段均拒绝并反馈错误。胜利画布的全部 816 条命令与原场景相同，SHA-256 为 `98f2ed7fec6239a2a78f0f25cd8da6e8a787a2d29b1f245545b8511974001203`。测试验证两段全文、顺序与 ID、节点身份、条件焦点与 preventScroll、滚动、直接 fresh Retry 和完整 Replay。失败、标题、开场、运行、升级、暂停、回放及回放终点均无胜利图文。原失败断言保留。关闭胜利路由、误用失败图、漏掉线索和向回放泄漏胜利的四个临时反例都使相应测试失败，产物随后还原。

作者在独占 Chrome 页面以正常 crypto 随机种子 `646012740`、真实时钟、可见 WASD 矩形走位与可见升级，完成 180 秒真胜利：等级 12、437 击破、10 格装甲。未修改 seed、World、HP、phase 或 RAF，也未读取隐藏 World 驾驶。1280×720 和实际 390×720 CSS px 的中文及英文完整原图、两段全文、统计和动作已检查并保存截图。额外在 390×600 下检查非零滚动，切语言后滚动仍为 57，语言按钮保持焦点；静音后滚动仍为 57，声音按钮保持焦点。

作者从胜利页用原生 Tab 定位回放，再用 Space 直接启动完整录制。等待真实时间至 replay-end，页面显示“回放校验一致”与 `lunar-2 · 1552623e`，没有胜利或失败剧情。未从胜利页实际执行原生 Enter 的 fresh Retry，此项仅有编译 main 自动验证，仍须非作者真实浏览器验收。Console 工具记录没有 error，但对象日志仅传回 `Object`，无法据此声称已读取 session.finished 的结构字段。证据保存于本机 `/private/tmp/victory42-browser/`。作者已恢复临时 viewport、关闭自己的 tab 并停止 localhost:43342 服务。

当前 head 的非作者剧情、数值与真实浏览器验收，以及成功 CI 仍为合并前置条件。作者证据不能替代独立领域验收。没有听感、FPS、物理触屏或真手机验证。
