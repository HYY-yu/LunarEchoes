# Issue 34 设计 B：World 的不可变上下文是唯一规则来源

目标是把既有战斗精确绑定到 desert-base / desert-base-1，并完成 lunar-2 终局录制和统一回放入口。本设计不改变战斗节奏、随机序列、存储、画面或声音。父任务已明确允许沿用现有规则，grounding 文件最后的等待批准建议因此不适用。

工作流：已读 AGENTS.md、team-workflow、campaign-plan、协议决定、poteto-mode、architect 和 runner/red-flags；本文件只承担候选 Sketch。Ground 由现有 grounding 加源码确认完成；Agree/Implement/Scrap 由 owner 综合两个候选决定。throughput checkpoint: n/a，单个只读设计产物。

## 先看调用方式

真实开始和失败重试复用同一 begin。crypto 留在浏览器，不进入 core。

```ts
function begin() {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const next = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed });
  world = next;
  pendingActions = [];
  mode = 'live';
}

function finishLive() {
  lastRecording = finishRecording(world, pendingActions);
}

function startReplay(input: unknown) {
  const next = openReplay(input);
  world = next.world;
  replayRun = next;
  mode = 'replay';
}
```

`openReplay` 先完整验证六字段、所有动作和受控上下文，再创建世界并返回。同一函数供纯 replay 使用，浏览器不会手写第二套版本校验。开局前所有副作用，包括 synth.reset、清键、切 screen，均放在 openReplay 成功之后。

```ts
const run = openReplay(JSON.parse(json));
while (advanceReplay(run)) render(run.world);
const result = verifyReplay(run);
const endWorld = replay(JSON.parse(json));
const duration = rulesFor(world.context).durationTicks;
```

`advanceReplay` 每次消费一个动作；浏览器可在一个帧预算内消费前置非 tick 动作，然后至多一个 tick。纯 replay 循环至耗尽。两者最终调用同一 verifyReplay，要求动作耗尽、世界真实终局且绑定 checksum 相同。纯接口失败抛带稳定 reason 的错误，浏览器捕获后显示双语反馈。

## 类型与接口

```ts
type StageContext = Readonly<{
  stageId: 'desert-base';
  rulesVersion: 'desert-base-1';
}>;

type World = {
  readonly context: StageContext;
  readonly seed: number;
  rng: number;
  tick: number;
  phase: Phase;
};

type WorldRequest = {
  stageId: string;
  rulesVersion: string;
  seed: number;
};

type StageRules = Readonly<{
  durationTicks: number;
  arenaSize: number;
  bossSpawnTick: number;
}>;

type Recording = Readonly<{
  version: 'lunar-2';
  stageId: 'desert-base';
  rulesVersion: 'desert-base-1';
  seed: number;
  actions: readonly Action[];
  finalChecksum: string;
}>;

type ReplayRun = {
  readonly world: World;
  readonly recording: Recording;
  cursor: number;
};

function createWorld(request: WorldRequest): World;
function rulesFor(context: StageContext): StageRules;
function finishRecording(world: World, actions: readonly Action[]): Recording;
function openReplay(input: unknown): ReplayRun;
function advanceReplay(run: ReplayRun): boolean;
function verifyReplay(run: ReplayRun): { checksum: string; outcome: 'won' | 'lost' };
function replay(input: unknown): World;
function checksum(world: World): string;
```

World sketch省略原有可变战斗字段，全部保持原样。Recording 是终局传输类型，仅 finish/open 边界生产；main 的 pendingActions 只是动作缓冲，不构造半份 Recording。公开 Recording 用于已有模拟脚本输出 JSON，不提供 raw parse 后绕过 openReplay 的入口。

## 模块与不变量

建议只增加 `src/stage-rules.ts`，它拥有一个冻结上下文常量及其冻结规则值。resolveContext 接受关卡和规则字符串，先检查唯一受支持关卡，再核对精确规则版本。其内部可以用 switch，不为六关建立假实现。`rulesFor` 只从固定上下文取内部规则，不接收配置、不接收回调、不支持测试注册。无需 WeakMap。world.context 是可见、可 JSON 序列化的值；规则不存入 World，也不另存 session.rules。

运行时不可变不只依靠 TypeScript：context 使用 Object.freeze，World 的 context 和 seed 通过不可写不可配置属性固定。可枚举属性便于诊断。不要 freeze 整个 World，战斗与 events 必须可更新。创建前验证 uint32 seed，不能继续用 >>> 0 静默修复非法输入。内部随机源初始仍是 seed || 1。

core.ts 继续拥有模拟及录制行为。创建位置、移动夹制、敌人出生边界、Boss tick 和胜负时限均消费 rulesFor(world.context)。现有 HZ、武器、装甲、升级、敌人随机选择算法保持固定实现，与 desert-base-1 一起冻结。只引出原有 duration/arena/boss 数字，不把所有字面量改成配置系统。不得把 StageDefinition.waves 样例接入运行流。

完整绑定为 180 秒、1500 边界、140 秒 Boss、既有连续随机生成、现有初始构筑、现有胜负和所有随机调用顺序。模拟与规则无 DOM、真实时间、crypto、audio。HUD 和 render 边界从同一个上下文读规则，删除全局 DURATION/ARENA 的生产调用，避免两个来源。

## checksum 的精确处理

保留 FNV 风格现有哈希循环、JSON 序列化顺序和 `events: []` 语义。新增 context 是模拟标识，不属于旧战斗投影：显式从 World 解构去掉 context，再以 `{ ...battleState, events: [] }` 序列化。其余旧字段顺序不变，因此同种子同动作的裸 checksum 应逐帧与旧版一致。不要依赖不可枚举 context、隐式 toJSON 或 WeakMap 隐藏它。需要 owner 明确在最终设计记录这条投影约定，不能默默更换哈希语义。

终局 checksum 单独计算 hash(JSON.stringify(['lunar-2', world.context.stageId, world.context.rulesVersion, world.seed, checksum(world)]))。只有固定数组参与绑定，不串接任意对象键。对上下文替换的敏感性通过对该固定数组哈希的测试证明，无需注册伪关卡。events 清空与否均不影响裸 checksum 及终局绑定。

finishRecording 仅接受 won/lost，复制每个 Action 和 tick.input，避免之后调用方修改缓冲污染已录制数据。解析同样重建和冻结输入，不持有调用方可变数组引用。严格六个字段，所有 action/input 严格键集合，有限 x/y、布尔 dash、有效 Upgrade、uint32 seed、八位小写十六进制 checksum。x/y 不额外限制 [-1,1]，保留 normalizeInput 的原有语义。终局前的合法暂停和无效 choose 沿用 dispatch 语义，不增加新的动作规则。

校验 old lunar-1、lunar-armor-1、未知格式、额外字段、未知/未实现关卡、错误规则及全部动作结构必须发生在 createWorld 之前。合法录制但动作被篡改导致终局不匹配，只能播放结束判失败；不要把这种事伪称为加载前可检测。回放永远没有进度写入或胜利授权。

## diagnostics 和调用方迁移

诊断前缀改成独立输入格式，例如 `format: 'lunar-action-prefix-1'`、stageId、rulesVersion、seed、actions。它不叫 Recording，不带 finalChecksum，不能传入 openReplay。诊断器保留 1–90 个 tick 的既有专用限制，独立验证后调用同一 createWorld。无需为了短前缀放宽终局回放。

trace worldInput 精确字段集合新增 context，并验证两个文字值。快照序列化保留 context，checksum 内部显式只投影旧战斗状态。traceInput 还须比较每帧 context 和 seed 与前缀输入一致，避免诊断报告自洽但不属于该录制。fixture 与 trace format 可升版本，历史 evidence 不改写。

simulate、armor-balance、core 测试等全部 migrate createWorld(request)。原来用 replay(prefix) 做部分模拟的测试，改成 createWorld + dispatch；真实完整回放测试必须 finishRecording。去掉旧 overload 和 lastChecksum 可变平行状态。浏览器初始/title 世界也走同一 factory 固定沙漠上下文，但标题仍清晰说明战场美术待接入，不能宣称完整沙漠体验。

## 与完整 Session 所有权方案的比较

完整 Session 类可以私有化 World、动作缓冲、模式、游标和终局记录，用 session.dispatch 自动录制，避免漏记和伪造 world/actions 配对。它的优势明确，未来进度授权时也更稳。但当前 render、音效读取 events、测试与机器人都直接使用 World；现在把所有读取迁到只读视图，或保留 mutable world 逃生口，会扩大范围或让所有权只是表象。

本候选选择 World 上可见不可变 context，原因是本 Issue 的关键不变量是规则身份与实际模拟一致。它保留现有 dispatch/world 模型，新增规则读取不会与 session 缓存漂移。若综合方案选择 Session，建议 graft 本设计的 World.context 和单源 rulesFor，而不是把 context 藏于 session 外部映射。Session 若只是 public world + public actions 的袋子，没有深度，反而不如本候选。

本设计的限制是 finishRecording 无法仅从签名证明 actions 确实产生当前 World。现有 owner 调用是可信代码，端到端回放验收能发现漏记；若要求 API 层绝对防误配，应选完整 Session 所有权，不能增加 WeakMap 或昂贵隐式重放补洞。

## 验证与红旗筛查

配对旧新三个固定种子及完全相同动作，逐 tick 对比旧战斗投影、rng、Boss 和终局。至少一份真实终局动作流导出六字段并纯回放两次；浏览器同一录制播放一次。错误输入必须不改变现有 World 引用、screen、输入与声音生命周期。begin/retry 证明每次 crypto 调用和构筑清空。短前缀保持专用诊断语义。运行完整 npm run verify，真实浏览器证据由 owner/独立 verifier 提供。本设计未运行性能、胜率或浏览器测试。

红旗已筛查：无配置注入；无 WeakMap；无世界/会话双份规则；无六关 fallback；无旧版本兼容入口；无 prefix 假 terminal；无新增运行时依赖。剩余显性取舍是 trusted mutable World/动作缓冲关系，由上节说明，供候选综合时判断。

来源：本次读取的 src/core.ts、src/main.ts、scripts/replay-diagnostic.mjs 与 docs/campaign-protocol-proposal.md。memory 仅提示当前 SHA 独立验证门槛，未用历史状态推断当前实现。
