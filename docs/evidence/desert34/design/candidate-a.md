# Issue 34 design A

目标是把已运行的战斗冻结为唯一的 `desert-base / desert-base-1`，统一真实入场、重试与回放的规则来源，交付精确六字段的 `lunar-2` 终局录制。该方案不改变战斗数值、随机调用次序、存储、地图或解锁。父任务已明确允许把原规则绑定到首版沙漠，本设计不再把这个绑定留作人类决策。

## Overview

现有 `core.ts` 将 180 秒、1500 边界和 140 秒 Boss 写为全局常量；World 没有关卡身份。纯 `replay()` 检查版本，浏览器 `startReplay()` 绕过它。终局 checksum 另放在 `main.ts` 的可变变量。方案 A 让 World 显式携带目录解析出的规范、冻结规则对象。模拟直接读取它，渲染可只读它；没有 WeakMap、闭包映射或隐式上下文关联。

## Usage

三个调用场景先固定下来。以下为签名草图，不是提交代码，也没有代码注释。

```ts
const seed = crypto.getRandomValues(new Uint32Array(1))[0];
const candidate = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed });
world = candidate;
recordedActions = [];

const terminal = finishRecording(world, recordedActions);
lastRecording = terminal;

const candidateReplay = openReplay(lastRecording);
world = candidateReplay.world;
replaySession = candidateReplay;

const verifiedWorld = replay(JSON.parse(json));
```

`begin()` 同时服务开始与失败重试，每次调用 crypto 路径，新世界清空全部构筑。`openReplay()` 完整验证输入和上下文后才返回候选世界，调用者拿到候选前不能 reset synth、切 screen 或覆盖 world。动画播放每次只执行 session 中的动作，播放完调用 `verifyReplay(session, replayIndex)`；纯 `replay()` 复用同一个 open 与 verify，没有第二套校验条件。

诊断脚本使用单独前缀入口，不把未终局轨迹伪装成录制。

```ts
const prefix = parseActionPrefix(fixture);
const traceWorld = createWorld(prefix.context);
for (const action of prefix.actions) dispatch(traceWorld, action);
```

## Key Concepts

1. `ResolvedRules` 是唯一生产规则实体。只存在一条目录记录，嵌套结构逐层冻结。`World.rules` 为 readonly，指向这条对象；不复制任意传入配置，不从 StageDefinition 样例造生产规则。
2. `BattleState` 是现有 World 的战斗字段，保持字段顺序。World 在它之外追加 rules；`checksum()` 明确只取 BattleState 并把 events 清为空，继续原 JSON 与 FNV 算法。上下文由第二层固定数组哈希绑定。
3. `Recording` 只代表真实终局的完整六字段。局中动作数组和诊断前缀都不是 Recording。`finishRecording()` 拒绝 running、paused、upgrading，复制动作以隔离后续清空或改写。
4. 可用关卡和已知关卡是不同集合。STAGE_ORDER 有六关，生产目录只有 desert-base；其余明确报 unavailable，不回退为月面世界。

## Shape

```ts
type ResolvedRules = Readonly<{
  stageId: 'desert-base';
  rulesVersion: 'desert-base-1';
  mapId: 'desert-base';
  durationTicks: 10800;
  arenaSize: 1500;
  bossSpawnTick: 8400;
  spawnKind: 'existing-random-stream';
  victoryKind: 'boss-killed-at-time-limit';
}>;
type World = BattleState & { readonly rules: ResolvedRules };
type WorldRequest = Readonly<{ stageId: string; rulesVersion: string; seed: number }>;
type Recording = Readonly<{
  version: 'lunar-2';
  stageId: 'desert-base';
  rulesVersion: 'desert-base-1';
  seed: number;
  actions: readonly Action[];
  finalChecksum: string;
}>;
type ReplaySession = Readonly<{
  world: World;
  recording: Recording;
}>;
function createWorld(request: WorldRequest): World;
function finishRecording(world: World, actions: readonly Action[]): Recording;
function openReplay(input: unknown): ReplaySession;
function verifyReplay(session: ReplaySession, consumedActions: number): void;
function replay(input: unknown): World;
function checksum(world: World): string;
```

`WorldRequest` 故意接受边界字符串，运行时必须拒绝未知与未实现关卡、错误规则和非法 uint32 种子，不能仅依赖 TypeScript 字面量让 JavaScript 调用方绕过校验。规则目录解析函数留模块内部，不导出可绕过目录的 `createWorldWithRules()`。

`openReplay()` 的结构校验要求普通对象与精确六键；版本必须 lunar-2，finalChecksum 必须八位小写十六进制；每种 action 及 input 精确字段、有限 x/y、布尔 dash、合法 upgrade，拒绝多余字段。x/y 可超过 [-1,1]，继续由现有 normalizeInput 钳制。完整校验后复制动作对象，防止异步播放时外部改写。规范拒绝码至少区分 invalid-data、incompatible-version、unavailable-stage、incompatible-rules、checksum-mismatch、nonterminal-replay。

绑定校验只允许一个实现。

```ts
hash(JSON.stringify(['lunar-2', world.rules.stageId, world.rules.rulesVersion, world.seed, checksum(world)]))
```

`verifyReplay(session, consumedActions)` 同时要求终局、消费数量精确等于 actions.length 和 finalChecksum 相等。浏览器负责动作游标，纯 replay 传入已实际分派的数量。不要仅凭 won/lost 提前停止播放，否则会忽略终局后的已录动作，改变既有动作语义。

## How It Works

1. 受控目录查 stage，再查规则版本，验证 seed 后创建 World，初始玩家中心由 rules.arenaSize 派生。
2. clamp、spawn、Boss tick、终局时限读取 world.rules。其余武器、装甲、升级、敌人、Boss 算法与随机流原样保留，尤其 180 普通敌上限不包含后来额外生成的 Boss。
3. main 持有动作缓冲，按既有 dispatch 顺序录制。真实终局生成唯一 lastRecording；删除 lastChecksum，UI 的终局验证使用录制内 finalChecksum。
4. 回放解析与构造先得到本地候选，成功后再替换页面状态。错误用现有 logger 和双语 notify，Warn 兼容性拒绝，Error 校验失败；core 只抛带稳定 reason 的错误。
5. 原始 checksum 不包含新增 rules 对象。对新旧配对种子逐 tick 比较 BattleState 时直接比较实际字段；不借 checksum 改写掩盖规则变化。
6. 诊断格式继续明确标记 synthetic action prefix。prefix 自己携带 version、stageId、rulesVersion、seed、actions，并有独立 format 标识，绝不增加虚假 finalChecksum。前缀工具可保留 1–90 tick 和更窄输入约束，这属于诊断工具，不倒灌到生产动作校验。

## Where Things Live

| 文件 | 职责 |
|---|---|
| src/core.ts | BattleState/World、唯一规则记录和解析、世界工厂、动作、checksum、终局录制与回放边界。当前只有一条规则，无需新增泛化 registry 模块。 |
| src/main.ts | crypto seed、真实/回放身份、动作缓冲、原子世界替换、播放游标、UI 与日志。HUD 分母读 world.rules.durationTicks。 |
| src/i18n.ts | 按原因区分双语拒绝，并显式标记沙漠模拟已接入而战场美术待接入。 |
| scripts/replay-diagnostic.mjs | 独立前缀验证、快照 rules 字段白名单、环境与构建摘要、差异轨迹。 |
| simulate/armor scripts and tests | 迁移 createWorld 调用和真实终局录制，不保留旧入口。 |

## Gotchas

- 当前终局时限检查要求 running。恰在 10800 tick 进入 upgrading 时，必须沿用既有语义，不以修正时限为名移动判定位置。
- `checksum({ ...world, events: [] })` 会把 rules 加进原始校验，违反已批准的状态取值。显式剥离元数据，同时保留原字段插入顺序。
- 若 rules 可序列化进诊断 World，worldInput 的精确键验证也必须更新；校验时比较内容与规范规则，不用引用相等，因为 trace 是 JSON。
- 固定种子 208907 只服务标题背景，可继续使用受控工厂；不要把它误用于失败重试。
- 不允许通过强制改 phase、空 actions 或缩短规则来生产终局验收录制。真实终局录制和诊断前缀分别验证。

## Rationale and tradeoffs

选择 World 携带规范规则，是为了让单看 spawn、step 或 render 的下一名贡献者能直接找到真实规则，而无需记住关联表。接受 World 多一个只读字段，换取可见的数据依赖。接受 checksum 显式分离 BattleState，换取旧状态哈希语义与上下文包装的清楚边界。

替代方案是 World 只存 stageId/rulesVersion，每次模拟查目录。它让每个消费者参与解析且多处承担已知未实现的拒绝逻辑，公开表面较小但使用知识更多。另一个替代是 WeakMap<World, Rules>，可少改序列化却让 JSON 克隆、诊断与独立工具失去规则，拒绝它。

设计红旗检查通过条件为只导出一个工厂；没有 seed-only 兼容入口；没有可注入任意生产规则的重载；没有重复 stage 身份副本；没有 main 自己实现版本检查；没有隐藏 World 关联。播放游标只归 main，ReplaySession 只携带经校验的 world 与录制，保持一条播放路径。

Synthesis decision 留父任务填写。Implementation reconciliation 尚无实现偏差。

## Verification and next step

父任务已冻结 18 例、141580 动作基线，直接复用该实际基线，再迁移唯一目录与工厂；跑同动作精确对比，特别确认 rng、Boss 和终局不变。随后迁移六字段终局录制、纯/浏览器入口与前缀工具，跑 npm run verify 和真实浏览器回放、拒绝及重试。此设计未实测代码、帧率或体验，不声明沙漠切片完整或性能验收完成。
