# Issue 36 方案 B：斜向运输线与南北设备

本方案只替换真实战斗背景。目标是在现有 1500×1500 无障碍战场中识别沙丘、雷达阵列、塌毁机库，并保持敌人和攻击预警清楚。这里只交付设计，没有实现或视觉验收。未写仓库文件，不改 World、core、audio、input、规则或 HUD。

## 调研与任务状态

- [x] Route through the **how** skill. For motivation questions, also route through the **why** skill.
- [x] Throughput checkpoint stays one line: `throughput checkpoint: n/a, read-only investigation`.
- [x] Produce the `how`-shaped output (Overview / Key Concepts / How It Works / Where Things Live / Gotchas), or a recommendation with a tradeoffs table if the request is a decision between alternatives.
- [x] Apply the **unslop** skill to the reply.

本 agent 是 owner 已分派的只读设计候选，按单次顺序调查完成，未再派发 agent。官方竞品出处、imagegen 概念与评审由 owner 汇合，本文不冒充已完成这些门槛。坐标、颜色和缓存尺寸都是待实机比较的设计建议。

## 当前结构与替换位置

已读 `/private/tmp/lunar-desert36/src/render.ts`。`createRenderer` 创建 256×256 月壤纹理和人物图集，逐帧画月面网格、建筑、中央发光装置，随后画拾取物、敌人、子弹、玩家与特效。标题还单独画地球。这些月面背景代码应整体删除，不留隐藏分支。

已读 `src/stage-rules.ts`。arenaSize 固定为 1500。背景只接收这个数值，不 import World 或读取战斗 RNG。已读 `src/desert-scene.ts`，其剧情画面是 320×180 侧视剪影，不直接铺进俯视战场。共享暖沙、钢蓝、象牙白、青色信号色，可提取一个很小的沙漠调色板常量文件给两处使用。

已读 `docs/desert-base-script.md`。设备间隙是视觉路线，不能新增碰撞、掩体、护塔耐久或失败规则。机库必须以贴地塌毁轮廓表现，雷达不能形成玩家似乎可以躲避弹幕的实体建筑。

## 构图与尺度

地图北为 y 小，西为 x 小。斜向运输痕迹从西南 `(230,1240)` 延伸到东北 `(1240,250)`。两条断续车辙相距 30 世界单位，间歇地被风沙抹平；不画实线道路边框、警戒条或导航箭头。运输线在中心附近轻微折向 `(780,760)`，仍是平面地表。

| 对象 | 世界坐标与尺寸建议 | 可通行表现 |
|---|---|---|
| 中央开阔地 | 中心 `(750,750)`，约 520×440 | 降低纹理频率，仅保留淡车辙，无大型设备或暗色硬边 |
| 主雷达 | 中心 `(850,410)`，128×96 | 倒伏碟面、半埋支架、浅地基，主体深色仅占轮廓少量面积 |
| 副雷达 | 中心 `(1050,300)`，80×64 | 小型倒伏支架，无高墙或封闭边界 |
| 南机库残骸 | 中心 `(650,1040)`，200×112 | 断裂地板、扁平屋面碎片、两端都开放；至少 64 单位宽沙面贯穿 |
| 南东机库碎片 | 中心 `(860,1170)`，96×56 | 少量折断肋骨沿地面摆放，不围成盒子 |
| 设备间空隙 | 主雷达与副雷达间约 96 单位净沙面；机库散件间约 80 单位 | 只组织画面密度，不修改通行性 |
| 沙丘印章 | 160×64 与 112×48 两种，主要在 `(280,390)`、`(1200,850)`、`(310,960)` | 不连续横跨地图；低对比浅坡，不用陨石坑同心椭圆 |

玩家 16 像素帧按 1.7 世界缩放，主体约 27 世界单位。主雷达宽约 4.7 个玩家，机库宽约 7.4 个玩家。窄屏逻辑可见宽约 244 世界单位时，单个机库已接近一屏宽，不能再放大。设备需要局部也能识别，雷达用倾斜碟缘和网格，机库用断开的拱肋与被沙覆盖的地板。两者均不在玩家上层绘制。

标题相机当前约 `(700,660)`，竖屏首视野看不到完整南北构图。中心保留一条稀疏车辙和少量沙纹，让标题即使只见中央也明确是沙漠。不能通过扩大画布或改输入缩放来强行同时展示全部地标。完整构图通过实际移动录制证明。

## 数据与接口草图

新增 `src/desert-battlefield.ts`，只导出创建函数。内部静态坐标和有限绘制函数足够，不建通用 registry、场景树或插件系统。采用 Type System Discipline 原则，让背景入口根本拿不到 World。

```ts
type BattlefieldView = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

type DrawDesertBattlefield = (
  ctx: CanvasRenderingContext2D,
  view: BattlefieldView
) => void;

export function createDesertBattlefield(arenaSize: number): DrawDesertBattlefield;

function createSandTile(): HTMLCanvasElement;
function createDesertEquipmentAtlas(): HTMLCanvasElement;
function drawTransportMarks(ctx: CanvasRenderingContext2D): void;
function drawDuneStamp(ctx: CanvasRenderingContext2D, x: number, y: number, variant: 0 | 1): void;
```

固定设备坐标归一为 arenaSize 的比例或用 `arenaSize / 1500` 在创建阶段一次换算，不在每帧生成布局。设备图集内部切片可直接命名 `radar`, `hangar`，只允许这两个业务名称；没有开放字符串 kind 或数字 kind 分支。

调用端在 `createRenderer` 内懒初始化一次背景闭包，首次 render 从 `stageRules(world.context).arenaSize` 获得尺寸。当前只有 desert-base，无需多关缓存或上下文 registry。

```ts
let drawBattlefield: ReturnType<typeof createDesertBattlefield> | undefined;

const arena = stageRules(world.context).arenaSize;
drawBattlefield ??= createDesertBattlefield(arena);

ctx.save();
ctx.scale(zoom, zoom);
ctx.translate(vw / 2 - cameraX, vh / 2 - cameraY);
drawBattlefield(ctx, {
  left: cameraX - vw / 2,
  top: cameraY - vh / 2,
  width: vw,
  height: vh
});
```

调用后继续现有晶体、敌人、预警、弹幕、玩家和效果绘制，然后按现有方式 restore。实际代码要避免示例中 arena 已声明时的重复声明。背景内 `save` / `restore` 隔离 alpha、dash、transform、composite、fillStyle、strokeStyle、lineWidth 和 smoothing；背景不能清空调用者整张 canvas。

## 缓存与绘制顺序

创建阶段只生成一张 128×128 细沙 tile 和一张不超过 384×256 的透明设备图集。最多另缓存一张 160×64 沙丘印章。上述 RGBA 裸内存约 488 KiB，是设计估算，不是测量。不要逐帧 createElement、getImageData、重建图集或生成 1500×1500 整图。CanvasPattern 在首次实际 ctx 上创建一次并复用，像素纹理锚定世界原点，不能锚定相机而滑动。

1. 填暖色沙底并重复小纹理，覆盖传入可视矩形。
2. 画低对比沙丘印章，按可视矩形做简单 AABB 剔除。
3. 画斜向风化车辙和少量半埋线路，均是低对比贴地痕迹。
4. 画南北设备图集与散件，只画可视范围附近的固定少量对象。
5. 画很小的青色静态信号点，不使用攻击环、扩散波或弹幕同色闪光。
6. 交还原角色和战斗特效顺序。

背景不接收 time 或 tick。雷达状态动画若非本 Issue 必需就省略，避免借表现新增剧情状态。清除月面标题地球，但保留现有遮罩和交互。当前冷黑 vignette 要在实机中检查是否把暖沙压成灰蓝，必要时仅微调其颜色和透明度。

## 避免假碰撞与可读性

设备都是扁平、倒伏或半埋的地面遗迹。不画完整立墙、完整屋顶、立体箱体群、不可穿过的围栏或掩体阴影。不要把运输痕迹夹成只有一条路线的通道。实体与预警总在设备上面，玩家穿过任何设备时不消失。

暖沙避免直接复用敌弹 `#f6b77c` 和预警 `#ffd499` 的高亮面积。深色钢构件少量用作识别边，不大片填黑。若贴地雷达依然被试玩者理解成掩体，应缩短支架、降低边缘反差、增加沙覆盖，而不是追加碰撞。

## 可执行验收建议

这些是 owner 后续要运行的检查，本文未运行实现验收。

- 现有 `npm run verify` 完整通过，不改变模拟 seed、动作或 checksum 预期。
- 新建两个独立 renderer，对同一个深冻结 World、同一个 viewport 和 time 绘图，实际浏览器 `getImageData` 像素一致；世界对象渲染前后序列化相同。不同渲染次数不能改变回放结果。
- 在真实 2D ctx 上预设非默认 transform、globalAlpha、line dash、lineWidth、composite 和 smoothing，直接调用背景闭包，逐项断言原状态恢复。加一笔哨兵线验证 clip 未泄漏。路径状态应由调用方 `beginPath` 管理，不能误称 save/restore 保存当前路径。
- 单独在截图 fixture 中多次调整 canvas 尺寸后绘图，检查缓存可重用、pattern 未漂移、边界无缝隙。路径从地图中心移动到四角，再返回中心，静态背景像素应相同。
- 桌面 1280×720 与窄屏 390×693 各截图中心、雷达、机库，并录制斜向走完整条运输线。预警与敌群覆盖地标时仍可识别角色。不能把本设计图当最终截图。
- 密集战斗的性能记录由 owner 或 balance_performance 按当前设备、分辨率、敌人数测量。缓存尺寸不能当 FPS 证据。控制台无新增错误，构建仍在现有预算内。

## 与 A 的取舍

| 比较项 | 方案 B 判断 |
|---|---|
| 视觉差异 | 斜向运输痕迹和南北设备形成偏纵向探索，避免横向沙丘带和东西两建筑的对称构图 |
| 首屏辨识 | 中央沙地和车辙容易识别地表，两个地标不能同时看见，需移动体验确认 |
| 窄屏 | 南北方向更便于逐个发现地标，但大机库必须控制在约 200 世界单位宽 |
| 性能 | 小 tile 和设备图集创建一次，逐帧少量 blit；实际成本仍需测量 |
| 风险 | 车辙可能被误读为规定路径，设备可能被误读为掩体；用断续痕迹和扁平遗迹缓解 |

设计已完成，到此停止。没有运行后台任务，没有修改仓库，没有实现代码。
