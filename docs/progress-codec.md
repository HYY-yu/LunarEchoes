# 解锁进度纯编解码

本模块只实现 [Issue #19](https://github.com/HYY-yu/LunarEchoes/issues/19) 的数据边界。协议来源为已批准的 [本机存档决定](campaign-protocol-proposal.md)。没有存储适配、默认进度、解锁计算或游戏入口；六个 ID 可编解码不代表六关可进入，战斗 180–300 秒和剧情单独计时的规则不变。

## 接口与设计

调用方将原始字符串或 `null` 交给 `decodeProgress(raw: string | null): ProgressDecodeResult`。只有原始 `null` 返回 `{ kind: 'missing' }`。有效结果是 `{ kind: 'valid', progress: CampaignProgress }`。拒绝结果是 `{ kind: 'rejected', reason: ProgressRejectionReason, raw: string }`，逐字保留原始字符串，不能当作默认有效进度。

`CampaignProgress` 是只读的 `{ version: 1, highestUnlockedStageId: StageId }`，其中 `StageId` 与合法值复用 `stage-contract.ts` 的 `STAGE_ORDER`。`encodeProgress(progress: CampaignProgress): string` 接受已经验证的类型，只构造这两个字段，按 version、highestUnlockedStageId 顺序输出紧凑 JSON。编码成功不能表示写入或核对成功。JavaScript 调用方应先解码不可信数据，不将强制类型转换当作验证。

选择带 `kind` 的联合类型，避免异常或可选字段让调用方混淆缺失和拒绝。相比抛出解析错误，返回拒绝值能同时携带诊断原因和需保留的原文。相比让编解码器拥有存储状态，此接口只接收值，调用方负责后续恢复和持久化。有效数据构建为独立冻结对象；不保留未知字段。

实现顺序是先定义结果和数据类型，再实现解析分类、显式两字段序列化，最后通过真实 JSON 输入输出测试。一个 owner 在独占 worktree 写三个文件，避免共享写入；测试和模块共同描述一个契约，不拆分作者。阻塞步骤为核对 Issue 与批准协议，独立领域验收交给非作者。没有可并行写入的独立工作流，也没有共享可变状态。

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

运行 `npm ci && npm run verify`，或构建后运行 `node --test test/progress.test.mjs`。覆盖六关 ID 往返、精确两字段输出、缺失与空值、JSON 类型、字段和版本错误、混合错误优先顺序及原文保留。完整 verify 继续执行既有预算、模拟和回放检查；Node 契约验证不替代产品 UI 或 A2 集成验收。
