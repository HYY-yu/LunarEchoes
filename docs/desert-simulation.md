# 沙漠战斗接入

[Issue #34](https://github.com/HYY-yu/LunarEchoes/issues/34) 将已运行的战斗接入首关身份。唯一可建世界的组合为 `desert-base` 与 `desert-base-1`。其他五个已知 ID、未知 ID、错误规则均拒绝。PR35 验收时使用临时月面美术，界面标记地图与剧情待接入；后续 Issue #36 将其替换为代码像素沙漠战场，见[沙漠基地战场地图](desert-map.md)。剧情与战役仍待接入。本任务不完成 B1、B2 或 Issue #23。

## 规则与世界

`src/stage-rules.ts` 持有唯一冻结上下文和运行规则。World.context 和 seed 在运行时不可替换。创建中心、移动及敌人出生边界、Boss 时机、终局时限都读取该上下文解析的规则，不使用 StageDefinition 样例。

本版冻结基线 `bde5936d13d6890a72d24d36bb0039e48e36df44` 的 60 Hz、180 秒、1500 正方形、140 秒 Boss。连续随机敌流、随机调用顺序、普通敌上限 180、Boss 可额外生成、武器、升级、装甲、胜负顺序均保持原样。原有时限判定只在 running 生效，恰在时限升级时沿用原行为。

主协调在 Issue 范围内把原规则绑定首关视为例行接入。这不是声称人类另行批准了新数字。若独立审查发现新玩法或新协议，PR 继续保持 Draft。

## 录制与回放

调用方式如下。

```ts
const world = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed });
const buffer = startRecording(world);
buffer.actions.push(action);
dispatch(world, action);
const recording = finishRecording(world, buffer.actions);
const candidate = prepareReplay(recording);
const verified = replay(recording);
```

`ActionBuffer` 只有 version、stageId、rulesVersion、seed、actions。`Recording` 必须再有 finalChecksum，而且只在真实终局生成。解析拒绝额外字段、非法 uint32 seed、稀疏或错误动作、非有限向量、旧 lunar-1 和 lunar-armor-1。有限且超出 [-1,1] 的向量保留原 normalizeInput 语义。解析和封存复制并冻结动作，外部修改不污染播放。

`prepareReplay` 完整验证后才创建候选世界。浏览器在成功返回后替换当前 World、清输入及重置音频。纯 replay 使用同一函数和最终 verifyReplay。最后必须消费全部动作、处于终局、上下文与种子相同且 finalChecksum 匹配。失败有双语反馈和稳定原因码。浏览器真实 Begin 与 Retry 都调用 crypto 生成新的种子并重新构筑。回放入口身份固定，没有存档、解锁或真实胜利派发。

裸 checksum 显式去掉新增 context，再执行旧的 `JSON.stringify({ ...battle, events: [] })`。旧战斗字段全部保留，events 键保留原位置，只清空临时事件内容。按 Issue #14 的“沿用现有状态取值”解释，新增身份只进入批准的固定数组 `[version, stageId, rulesVersion, seed, checksum(world)]`，然后使用相同 32 位哈希。没有把新规则对象重复加入旧战斗哈希。

`finishRecording` 接受可信调用方持有的 World 与动作数组，并不声称类型本身能证明两者因果关系。真实动作对照和重放检验这个关系。校验用于发现偏离，不是防篡改安全证明。

## 设计选择

两名只读设计员分别提出 World 持有规则对象与 World 持有唯一上下文两个结构。独立第三模型各评 9/10，选择后者，保留更小的序列化形状。吸收前者的完整动作消费、Boss 上限和时限升级边界。没有 WeakMap、任意规则注入或第二套世界工厂。

裁决指出 checksum 的文字歧义。主协调明确采用保留全部旧战斗字段和 events 空数组的解释。`scripts/desert-differential.mjs` 对每个已捕获动作比较完整战斗对象、JSON 字节、events 空数组投影 JSON 字节及裸 checksum。只排除新增 context。通过这些检查后才接受该解释，没有更新旧 golden 值。候选及原始裁决见 [设计记录](evidence/desert34/design/crossjudge.md)。最终接口使用 prepareReplay 和 verifyReplay，不增加候选的 advanceReplay 包装。

Model the Domain 原则用于区分局中缓冲和完整终局录制。Type System Discipline 用于只读上下文及未知输入边界。单一 owner 迁移耦合 API 和所有消费者，独立领域验收由其他角色执行。

## 诊断与历史证据

90 动作 fixture 是非终局前缀。它走 parseActionBuffer 和同一世界工厂，不具有 finalChecksum，不能作为完整 Recording 播放。其动作逐字保持原 fixture，只新增 lunar-2 与精确上下文。

诊断 trace 结构升级为 `checksum-prefix-trace-2`，World 验证增加 context，并核对每帧种子与前缀一致。原 core、输入与 Node 身份拒绝保留，额外加入 rules 构建摘要。损坏 World 不能靠重算 checksum 通过。新版 trace 从实际运行重捕到新路径，历史 armor22 证据不覆盖。CI 只更新 expected trace 路径，Node pin 和原 verify 命令保留。

原 600 tick 和 40 秒测试改为显式前缀分派，保留确定性、装甲与旧版拒绝断言。新增真实终局重放测试。upgrade catalog golden 不变。audio-differential 默认改为本次冻结基线并完整比较现有 events；crawler-differential 仍要求 core 与 stage-rules 源码不变，仅支持新的模块依赖和工厂。两个工具通过 load-core-revision 读取 Git 版本，未放宽其断言。

## 复跑

在原 Mac 捕获环境中可构建原始基线并重捕动作。跨平台不要求重捕文件或历史终局 checksum 相同，应使用已保存动作执行同平台旧新引擎对照。浅仓库取固定基线与 CI 修复见[同平台基线说明](evidence/desert34/ci-fix.md)。

```sh
mkdir -p /tmp/lunar-desert-baseline
git archive bde5936d13d6890a72d24d36bb0039e48e36df44 | tar -x -C /tmp/lunar-desert-baseline
npm --prefix /tmp/lunar-desert-baseline ci
npm --prefix /tmp/lunar-desert-baseline run build
node scripts/desert-baseline.mjs /tmp/lunar-desert-baseline /tmp/baseline-actions.json.gz
cmp docs/evidence/desert34/baseline-actions.json.gz /tmp/baseline-actions.json.gz
npm run verify
node scripts/desert-differential.mjs /tmp/desert-paired-results.json
node scripts/armor-balance.mjs --core dist/core.js --out /tmp/desert-balance.json
node scripts/replay-diagnostic.mjs capture /tmp/desert-trace.json 24.21.0
node scripts/replay-diagnostic.mjs compare docs/evidence/desert34/macos-node24.21.0.json /tmp/desert-trace.json
node scripts/audio-differential.mjs
node scripts/crawler-differential.mjs "$(git rev-parse HEAD)"
```

以下统计是原 Mac 捕获及其同平台验证观测，不是跨平台结果承诺。基线捕获为 3 seeds × stationary/novice/skilled × attack/hull，18 例与 141580 动作。配对 6 胜、12 负，全部胜局 180 秒，失败未过滤。静止两种偏好没有升级，因此动作重复。每例终局纯重放两次，总计 36 次。这是行为保持证据，不是玩家胜率目标或六关平衡证明。

证据中 sourceDirty 明确标记作者工作树运行。独立验收必须读取 PR 当前 head，不能用作者日志替代。没有测量浏览器 FPS、帧时间、掉帧或内存，目标设备性能未验收。没有改动音频，不声明新听感。
