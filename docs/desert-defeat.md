# 沙漠失败结算

[Issue #40](https://github.com/HYY-yu/LunarEchoes/issues/40) 让玩家在真实沙漠失败后看到既有失败像素画和完整双语原文。同页保留本局统计、重新部署和回放上一局。两个动作都直接离开剧情，没有额外确认或阅读时限。本单元不完成 B1、B2 或 Issue #23。

## 内容与会话边界

`main.ts` 仍独占 screen、World、录制和结算 DOM。只有 `screen === 'game' && world.phase.kind === 'lost'` 展示 `drawDesertScene(context, 'defeat')` 和 `desert-base.defeat`。回放终点继续显示校验结果，胜利继续使用原结算。

`DesertContent` 统一持有 opening、objective、defeat 三条只读双语内容。构建端 `scripts/desert-content.mjs` 的 `embedDesertContent` 从完整校验后的原目录提取内容，嵌入 `desert-content` JSON script。运行端 `parseDesertContent` 验证精确字段、ID 和非空双语，并冻结结果。原私有 opening helper、anchor 和调用者已迁移，没有第二加载器、远程请求或手抄剧情。

失败画布、完整正文、统计和动作按钮只挂载一次。语言与静音刷新原位更新文本和无障碍标签，保留节点与滚动。首次挂载时，焦点在战场或 body 才转到重新部署，并使用 preventScroll；已有 header 焦点保持不变。既有按钮原生 Enter 与 Space 输入规则保持不变。

重新部署直接调用 `begin()`，生成新种子并清空本局构筑。回放直接调用 `startReplay()`，消费完整录制并校验终点。展示、等待、切语言、静音、失焦、隐藏与恢复不派发终局战斗动作。没有修改模拟、规则、RNG、回放协议、存储、解锁、画面资源、音频或依赖，没有新增声音。

## 作者验证与剩余门槛

作者先在精确基线运行 `npm ci` 和 `npm run verify`。改动后的 `npm run verify` 通过 115 项测试，0 失败，AST 禁止注释检查和下载预算检查均通过。实际产物共 35,118 gzip 字节，预算仍为 153,600 字节。三个既有模拟种子仍在 180 秒获胜，checksum 与基线一致。208907 为 `6d37c8d2`，42 为 `ff94b04b`，101 为 `c71d5dc4`。

`test/opening-main.test.mjs` 执行实际编译的 main 和真实模拟，沿标题、开场和自然失败到结算，没有注入 World 或装甲。测试比较完整 canonical 三条中英文、所有 locale 的 script 转义和 replacement token，拒绝缺失或损坏的 defeat。实际画布的 845 条绘制命令与原 defeat 场景一致，并固定其 SHA-256。终局完整 World、录制动作、封存录制、checksum 和种子调用次数在展示交互后保持不变。测试验证节点、焦点和滚动稳定，直接 Replay 校验与终局一致，直接 Retry 得到新种子的完整初始世界。实际输入机器人自然获胜仍走原胜利结算。关闭 live 路由或把绘画改成 victory 的临时反例都使目标测试失败，随后恢复产物。

DOM、RAF 与音频适配不能证明真实布局、原生浏览器事件或听感。作者尝试创建独占 Chrome tab，返回 `Browser is not available: chrome`。浏览器清单为空，IAB fallback 也返回不可用。没有创建 tab 或服务器，没有改动其他会话的预览。没有生成桌面或窄屏截图、DOM 和 Console 媒体证据。

当前 head 的非作者剧情、数值和真实浏览器验收，以及成功 CI 仍为合并前置条件。桌面 1280×720、实际 390 CSS px 的中英文完整图文、统计、动作可达、原生 Enter 与 Space、重新部署及完整回放均待真实浏览器验收。作者未听音，未测 FPS，未测物理触屏设备。
