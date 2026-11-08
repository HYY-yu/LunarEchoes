# 解锁进度编解码与纯规则

本模块实现 [Issue #19](https://github.com/HYY-yu/LunarEchoes/issues/19) 的数据边界和 [Issue #28](https://github.com/HYY-yu/LunarEchoes/issues/28) 的纯解锁计算。协议与规则来源为已批准的 [本机存档决定](campaign-protocol-proposal.md) 和[战役进度决定](campaign-progression-proposal.md)。没有存储适配或游戏入口；六个 ID 可计算和编解码不代表六关可进入，战斗 180–300 秒和剧情单独计时的规则不变。

## 接口与设计

调用方将原始字符串或 `null` 交给 `decodeProgress(raw: string | null): ProgressDecodeResult`。只有原始 `null` 返回 `{ kind: 'missing' }`。有效结果是 `{ kind: 'valid', progress: CampaignProgress }`。拒绝结果是 `{ kind: 'rejected', reason: ProgressRejectionReason, raw: string }`，逐字保留原始字符串，不能当作默认有效进度。

`CampaignProgress` 是只读的 `{ version: 1, highestUnlockedStageId: StageId }`，其中 `StageId` 与合法值复用 `stage-contract.ts` 的 `STAGE_ORDER`。`encodeProgress(progress: CampaignProgress): string` 接受已经验证的类型，只构造这两个字段，按 version、highestUnlockedStageId 顺序输出紧凑 JSON。编码成功不能表示写入或核对成功。JavaScript 调用方应先解码不可信数据，不将强制类型转换当作验证。

选择带 `kind` 的联合类型，避免异常或可选字段让调用方混淆缺失和拒绝。相比抛出解析错误，返回拒绝值能同时携带诊断原因和需保留的原文。相比让编解码器拥有存储状态，此接口只接收值，调用方负责后续恢复和持久化。有效数据构建为独立冻结对象；不保留未知字段。

实现顺序是先定义结果和数据类型，再实现解析分类、显式两字段序列化，最后通过真实 JSON 输入输出测试。一个 owner 在独占 worktree 写三个文件，避免共享写入；测试和模块共同描述一个契约，不拆分作者。阻塞步骤为核对 Issue 与批准协议，独立领域验收交给非作者。没有可并行写入的独立工作流，也没有共享可变状态。

## 纯解锁计算

`createInitialProgress(): CampaignProgress` 返回仅开放 `STAGE_ORDER[0]` 的冻结快照。它不读取存储或创建存档。调用方只有在解码结果是 `missing` 时才可明确选择初始值；`rejected` 仍须保留原文并进入批准的恢复流程，不能自动当作首次进入。

`isStageUnlocked({ progress, stageId }): boolean` 只查询关卡是否位于已解锁前缀。参数使用已验证的 `CampaignProgress` 与 `StageId`，未知原文仍先交给现有解码器或关卡查找边界。解锁不表示关卡已实现，函数不证明关卡可玩，也不执行入场或回放播放检查。

`applyStageResult({ progress, stageId, source, outcome }): ProgressTransition` 要求显式 `source: 'live' | 'replay'` 与 `outcome: 'won' | 'lost'`。JavaScript 调用方遗漏或传入未知来源、结果时抛出 `TypeError`，不默认成真实胜利。所有合法来源和结果先检查关卡是否已解锁，锁定关的结果返回 `locked`；其余只有显式 `live` 且 `won` 才可能推进，回放和失败保持不变。

| 结果 | 内容与调用方行为 |
|---|---|
| `locked` | 拒绝本次结果计算，不携带进度。它不是回放播放的准入决定。 |
| `unchanged` | 保留原会话值，不携带新的保存候选。包括失败、回放、重复胜利、旧关胜利和最终关封顶。 |
| `advanced` | 仅此结果携带 `progress`。它是新建且冻结的两字段快照，最多提升至本次完成关卡的紧邻下一关。 |

函数不修改或冻结传入对象，不新增已通关列表、结果次数或结局字段。重复派发沙漠胜利不会在雨林之后继续解锁南极，因为候选来自已完成关卡，而非当前最高关卡。所有顺序与 ID 都复用 `STAGE_ORDER`，没有第二份关卡列表。

`source` 只是调用方的明确声明，不是认证令牌。未来会话入口须固定真实游玩或回放来源，并识别同一真实局从非终局转为 `won` 的边沿，不能从单独 `world.won` 推导胜利授权。只有 `advanced` 提供新的会话进度候选；真实保存、保存核对、保护状态与错误反馈仍由后续存储边界实现。本函数不打印日志或执行副作用。

设计比较了单入口结果计算与提议后合并的两阶段接口。采用单入口和判别联合，使调用方只在 `advanced` 分支取到新快照；两阶段接口会把来源过滤与授予规则分散给调用者。本任务没有增加通用 reducer 框架、公共中间提议或无消费者的原因码。

## 拒绝优先顺序

混合错误只返回最先命中的原因。

1. JSON 解析失败返回 `invalid_json`，空串和空白串也属于此类。
2. 根值不是非 null、非数组对象，返回 `invalid_type`。
3. version 缺失或不是整数 number，返回 `invalid_version`。
4. 整数 version 不为 1，返回 `unknown_version`，不再要求任何 v1 字段。
5. v1 对象缺少或多出协议字段，返回 `invalid_fields`。
6. highestUnlockedStageId 不是 string，返回 `invalid_type`。
7. string 不在 STAGE_ORDER 中，返回 `unknown_stage`，不裁剪、不补缺、不回退。

JSON 使用原生 JSON.parse 语义；字段顺序和空白不影响有效性，重复键按 JSON.parse 的末值处理。本模块不记录原文日志。原因码供未来调用边界选择 Warn 与中英文反馈。

## 可复跑验证

运行 `npm ci && npm run verify`，或构建后运行 `node --test test/progress.test.mjs test/progress-rules.test.mjs`。原编解码测试覆盖六关 ID 往返、精确两字段输出、缺失与空值、JSON 类型、字段和版本错误、混合错误优先顺序及原文保留，未更改这些测试。

新增纯规则测试实际调用接口，覆盖初始首关、六个前缀、六种当前边界与六种结果关卡乘以两种来源和两种胜败的 144 组合、完整顺序推进、重复与旧关胜利、锁定伪结果、回放和失败不推进、终关封顶、输入不变和新快照冻结。未知来源与结果必须抛错；坏原文在规则调用前后仍原样拒绝。

完整 verify 继续执行既有预算、模拟和回放检查。纯规则没有接入真实存档、选关界面或战斗终局；Node 契约验证不替代产品 UI 或 A2 整体集成验收，也不证明六关已经可玩。

本次作者在 Darwin arm64、Node 24.21.0 执行完整 verify，70 项测试通过，0 失败。gzip 为 27,440 / 153,600 字节，预算未提高；与基线 `c1ebb65907f7ba58a063610a1b7d4f434d19d91c` 比较，只有 `dist/progress.js` 改变，其余 11 个运行文件逐字节相同。三个同机标准 checksum 保持 `d1326dd8`、`c8b73f95`、`22cc59b2`。当前 PR head 仍须非作者独立验收和成功 CI，作者检查不代替该关口。
