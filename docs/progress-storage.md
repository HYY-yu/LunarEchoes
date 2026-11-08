# 可注入的进度存储边界

本模块实现 [Issue #32](https://github.com/HYY-yu/LunarEchoes/issues/32) 的同步存储边界，遵循 [Issue #14 已批准方案](https://github.com/HYY-yu/LunarEchoes/issues/14#issuecomment-6684779269)与[协议决定](campaign-protocol-proposal.md)。没有接入主游戏、选关、真实终局或界面提示。当前游戏不会因新增模块读取或写入用户存档，A2 和六关战役尚未完成。

## 接口与调用方责任

`openProgressStorage(port)` 只需要同步 `getItem(key)`、`setItem(key, value)`。模块不引用 `window`，也不在导入时读取浏览器。固定 key 为导出的 `PROGRESS_STORAGE_KEY`，值为 `lunar-relay.campaign-progress`。编解码与关卡排序复用现有 `progress.ts`，没有新增存档字段或格式。

```ts
const session = openProgressStorage({
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value)
});
const opened = session.snapshot();
```

调用方必须立即呈现 `recovery_required` 的原因并请求重置确认。此模块只返回可观察结果，没有实际弹窗或双语反馈。未来接入者还须按协议把成功、降级与异常映射到日志和用户反馈；原异常保留在 `error`，不能静默丢弃，也不能直接把任意异常或整个存档内容传入日志。拒绝结果不包含原始坏存档字符串。

只有真实游玩首次从未终局进入胜利时，未来游戏入口才可调用既有 `applyStageResult`，并将其 `advanced` 结果交给存储边界。类型和判别字段不认证胜利，也不阻止可信调用者伪造结果。

```ts
const transition = applyStageResult({
  progress: session.snapshot().progress,
  stageId: completedStageId,
  source: runSource,
  outcome: runOutcome
});
if (transition.kind === 'advanced') session.saveAdvanced(transition);
session.reset(confirmed ? 'confirmed' : 'cancelled');
```

`snapshot()` 返回冻结的进度、持续的保护状态与最近操作结果。会话由闭包独占，调用方无法传入旧 session 解除保护。保存时复制两字段进度，不保留调用方可变对象；异常对象保留身份，不深度冻结外部异常。

## 保存与恢复结果

| 事件 | 结果 | 会话和存储 |
|---|---|---|
| 首次无 key | `loaded/missing` | 第1关，不创建存档 |
| 首次合法存档 | `loaded/valid` | 恢复最高解锁边界 |
| 启动或保存前读到拒绝数据 | `recovery_required` | 原文不改，保护状态，返回具体原因 |
| 启动或保存前读取抛错 | `not_saved` | 保护状态，保留会话和原异常 |
| 新的更高 advanced | 先提升会话 | 保护中不做 I/O；正常状态先重读，合并较高有效存档，再写和核对 |
| 同一或更旧 advanced | `unchanged` | 不读、不写，不重试失败结果 |
| 写入抛错 | `not_saved` | 会话不回退，不删除或回滚，保留原保存资格 |
| 写后读取抛错或原串不等 | `uncertain` | 会话不回退，不承诺旧字节仍在，不盲目回滚 |
| 写入与核对原串一致 | `saved` | 才能宣称本次保存已确认 |

`load`、`save_read`、`save_write`、`save_verify` 区分实际失败阶段。写前读取异常进入保护；正常写入异常或核对未知状态保持 `ready`，只有未来真正新的、更高 `advanced` 才可重试完整会话进度。重复传入相同结果不会再次写入。保护中仍保留新会话解锁，但不读写存储。

写后核对只比较本次期望的完整字符串。即使重排字段或增加空白后的 JSON 语义相同，也属于 `uncertain/mismatch`。核对阶段不再次解码或推定新的恢复状态；下一次合法的新解锁仍必须先重读并解析，仍然损坏的值会在写入之前进入保护。

## 显式重置

`reset('cancelled')` 零 I/O，不改变会话或原保护状态。有效进度下取消不禁止以后的正常保存。非法 JS 决定值会在 I/O 前抛出 `TypeError`，不会被当作确认。

`reset('confirmed')` 先重读 key。正常返回的任何字符串或 null 都不阻止这次已经确认的覆写，包括坏数据、未知版本和更高进度。重读异常则 `not_saved/reset_read`，零写入，保持原会话及原保护状态。随后写第1关并严格核对，只有成功后才重置会话并解除保护。重置不做自动保存的较高边界合并，也不调用 `removeItem`。

`reset_write` 异常与 `reset_verify` 的抛错或不一致分别返回 `not_saved` 和 `uncertain`，始终保留原会话、原保护状态。核对失败时旧数据可能已替换，不能报告旧字节保留或重置成功。核对只作串比较，不把一个不一致的重置结果扩成额外产品状态。

## 设计选择与验证

两个独立设计分别比较闭包单一所有权和调用方持有的不可变 session，独立 cross-judge 推荐闭包。采用闭包以避免调用者忘记接收新 session 或把旧 session 传回；借用不可变方案的明确错误阶段。保留严格串核对，不采用解析后语义相等作为保存成功。没有 effect runner、通用存储框架、锁、依赖、定时写入或外部传输。确认重置同样先重读，正常坏数据不阻止获准覆写；此解释与重置失败原状态保留在协调审阅后统一。

运行 `npm run verify` 覆盖注入存储的行为测试、预算和原模拟。测试检查真实调用顺序、原异常身份、保护与失败重试、取消和确认重置、严格核对、顺序会话较高进度与冻结快照。它们不认证真实通关，不替代浏览器 localStorage 或主游戏体验验收。

```sh
npm run build
node scripts/progress-storage-audition.mjs
```

打开 `http://127.0.0.1:4190/`，点击检查按钮。页面只从该独立 origin 导入模块，使用实际 localStorage 检查首次不写、新会话恢复、较高旧值、坏原文与未知版本保护、取消及确认重置，并输出逐项结果。结束时恢复该 origin 原 key，不触及主游戏端口的存档。端口已有服务时换一个专用 `PORT`，不能借用主游戏 origin。模块抛错分支依靠可注入存储测试，不冒充浏览器原生拒绝操作。

localStorage 没有原子比较写入。本模块保证顺序重读合并，不承诺并发标签页同步、安全认证、云端同步或永久留存。没有 UI、美术、音频、真实游戏刷新、FPS 或实体手机验收主张。
