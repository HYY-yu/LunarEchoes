# 六关数据契约

此契约为 [Issue #1](https://github.com/HYY-yu/LunarEchoes/issues/1) 提供独立于浏览器的输入边界和可运行样例。当前真实入口仅运行[沙漠战斗测试](desert-simulation.md)，其独立受控规则完整沿用既有原型。本模块没有被 `main.ts`、模拟、渲染或音频导入，也没有实现六关地图或战役流程。

## 使用

```ts
import { parseStageCatalog, parseCompleteCampaign, getStage, STAGE_SAMPLES } from './stage-contract.js';

const catalog = parseStageCatalog(STAGE_SAMPLES);
const desert = getStage(catalog, 'desert-base');
const seconds = desert.durationSeconds;
```

`parseStageCatalog(input: unknown)` 返回深度只读的有序关卡数组，允许为空或部分关卡。`parseCompleteCampaign(input: unknown)` 使用同一解析边界，额外要求六关全部存在。`getStage(catalog, id: unknown)` 拒绝未知 ID 或目录中缺失的关卡，不回退到月面。

`STAGE_ORDER` 是六关 ID 与顺序的唯一运行时来源。`STAGE_SAMPLES` 包含沙漠基地和月面回响两个契约样例。样例里的 180 秒与 300 秒用于验证许可边界，不是已发布的关卡数值，也不宣称地图已经可玩。

## 输入约定

| 字段 | 规则与拥有者 |
|---|---|
| `id` | 六个已确认 ID，目录中不可重复，部分目录仍须遵守战役相对顺序 |
| `durationSeconds` | 有限整数，180 至 300 秒，数值角色负责未来调优 |
| `mapId` | 引用同一组已规划的六个地图 ID，视觉角色实现对应地图；本契约不加载地图资源 |
| `waves` | 按 `atSecond` 非递减排序；时间为 0 至结束前一秒的整数，可同时开始，可为空 |
| `waves[].enemyKind` | 仅现有 `crawler`、`drone`、`sentry`，不以新名字冒充已实现敌人 |
| `waves[].count` | 1 至 180 的整数，沿用当前模拟的普通敌人数量上限作为单波数据上界，不代表各波会同时生成或已有调度器 |
| `boss` | 仅现有 `boss` 类型，`spawnSecond` 是结束前的非负整数，数值角色定义具体出现时机 |
| `story` | 开场、目标、结局、下一关线索均有非空白 `zh` 与 `en` 字符串，剧情角色维护内容 |

所有解析结果都复制被接受的数据并逐层冻结，调用方后续修改原输入不会改变目录。额外字段不会进入结果。解析错误抛出 `StageContractError`，包含稳定 `code`、字段 `path` 和说明。异常交给未来实际加载边界记录 Error 并展示反馈，本纯模块不接入日志、DOM、真实时间或音频。

## 结构选择

pstack 设计探索比较了静态有序目录与分离的 manifest、定义注册表。采用单一有序数组，避免在当前小范围契约里增加第二套索引和引用层。吸收另一方案的引用检查和输入隔离。若未来确有独立可下载地图与内容清单，再在对应任务中验证是否需要 manifest。

本契约最初交付时，既有 `DURATION`、`ARENA`、敌潮时序、`VERSION`、`World`、`Recording` 与 checksum 均保持不变。后续 Issue #34 的运行接入见[沙漠战斗接入](desert-simulation.md)，本样例不提供生产规则。此模块导入的 `EnemyKind` 仅为编译期类型，不让内容解析反向改变模拟。

## 验证

```sh
npm run verify
```

`test/stage-contract.test.mjs` 直接调用导出的解析和查找函数，检查两份样例、六关完整性、相对顺序、未知及重复 ID、时间边界、敌人和地图引用、双语空白、稀疏数组以及输入隔离。现有游戏行为与三个种子模拟继续由原验收覆盖。新增模块产物也计入现有包体预算。

## 后续任务边界

1. 技术 owner 为模拟配置提出接入方案，并确定关卡配置如何与可回放输入对应。任何录制格式、版本或校验语义变化都先建立人类决策 Issue。
2. 视觉与音频角色按地图 ID 交付沙漠布局、代码图集与合成事件；最终以实际游戏画面、动画和音效验收。
3. 数值角色实现明确的波次调度，执行多策略种子比较和真实浏览器性能检查，再交付沙漠基地完整体验。
4. 战役解锁、跨关装备、失败重试、持久存档，以及护塔新耐久或失败条件，在实现前分别提案并取得人类决定。

此契约不提前决定上述产品规则，不以数据样例替代剧情跳过、跨关加载或整关试玩验收。
