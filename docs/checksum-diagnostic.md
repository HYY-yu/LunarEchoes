# 对照同一动作前缀的模拟状态

本工具对应 [Issue #26](https://github.com/HYY-yu/LunarEchoes/issues/26)。既有三种子模拟在 macOS 与 Linux 输出不同的终局 checksum；两平台各自比较 PR #25 前后均不变。但 `scripts/simulate.mjs` 的机器人根据当前状态生成动作，所以各自运行机器人不等于重放同一动作文件。本单元先增加有限诊断，不修改模拟或回放协议。

## 生成和比较记录

使用 Node 24.21.0 构建，然后运行：

```sh
npm ci
npm run build
node scripts/replay-diagnostic.mjs capture /tmp/lunar-local-trace.json 24.21.0
node scripts/replay-diagnostic.mjs compare docs/evidence/armor22/macos-node24.21.0.json /tmp/lunar-local-trace.json
```

`scripts/fixtures/checksum-prefix.json` 是合成的固定输入前缀。seed 为 208907，90 条动作中前 45 条沿 x 轴、后 45 条沿 y 轴，全部不冲刺。输入不依赖 World、机器人或三角函数。它采用既有 `lunar-1` 动作形状，但没有终局，不是用户从游戏导出的完整录制。

`capture` 要求实际 Node 版本与最后一个参数相等，否则非零退出。它使用真实 `createWorld` 与 `dispatch`，保存初始状态及每条动作后的状态，共 91 帧。`actionIndex` 为 0 的帧是初始状态，1 表示执行第一条动作之后。输出包含 Node、V8、平台、架构和实际 `dist/core.js` SHA256。`recordingSha256` 是 `JSON.stringify(recording)` 的 UTF-8 字节摘要，不是原始 fixture 文件字节的摘要。诊断副本将 events 清空，与既有 checksum 的输入一致，不修改 World。文件格式 `checksum-prefix-trace-1` 仅用于诊断，不是游戏的新回放版本。

`compare` 在文件入口校验当前 World 的完整字段结构、有限数值、布尔值、阶段和实体种类，再核对帧数量、逐帧 checksum 和录制摘要。它拒绝不同 core 构建、不同动作录制及不同 Node 版本。结构校验不要求两端数值、实体数量或 tick 与动作索引相等，合法状态分歧仍会报告。发现差异时输出第一条不同动作的索引、两端 tick、checksum、字段路径和值。数值字段还输出两个 Float64 十六进制表示。这些位串属于 trace 中保存并经 JSON 读取的数值，不是对引擎任意内存状态的捕获。JSON 序列化本身的限制仍存在。

`same` 只表示这 90 条合成动作的状态相同。`different` 表示这些可比 trace 出现差异。两者都以退出码 0 表示诊断完成，不等于完整回放成功或游戏检查通过。文件、参数、格式、帧校验或身份错误都会非零退出。工具没有 `continue-on-error`，没有取消或降低已有测试断言。

## 已保存的本机结果

基线 main 为 `d2a680f99b6b2365098c7a600fba7b76b2f97c25`。原始本机 trace 为 [macos-node24.21.0.json](evidence/checksum26/macos-node24.21.0.json)，65,236 字节。实际环境为 Darwin arm64、Node 24.21.0、V8 `13.6.233.17-node.53`。

- core SHA256 为 `2cffc39071185c911954a0cf35c709fb2cddc4de792fce14176a67d03cbccb6c`。
- 固定录制 SHA256 为 `d8faaf768059d481bb7be5e6fca2f839757bd3e3959fe8b894f14d316bc3450b`。
- 最后 tick 为 90，checksum 为 `c55b6ea8`。重复捕获后自比得到 `same`。
- 前缀实际经过第一次敌人生成和射击。它没有覆盖升级、Boss、终局或真实设备之间的录制转移。

六项测试检查真实重放与重复捕获、首个字段差异定位、不同 core/动作/Node 和损坏帧拒绝、CLI 错误非零、完整 World 结构拒绝以及合法数值和实体数量分歧。独立验收曾发现删除 `player` 后重算 checksum 仍被误判 `same`，本次将该文件级反例和其他缺字段、错类型案例加入测试。即使损坏帧的 checksum 已重算，CLI 也须非零退出。字段差异测试在保存的副本上受控修改一个数值并重新计算其帧 checksum，属于验证比较器的变异测试，不是实际跨平台分歧证据。

作者完整 `npm run verify` 通过 64 项测试，本机 gzip 为 27,185 / 153,600 字节，三个标准终局 checksum 仍为 `d1326dd8`、`c8b73f95`、`22cc59b2`。现有 12 个 dist 文件与基线逐字节一致。本单元没有修改 src、依赖、运行资源、预算、回放版本或 checksum 语义，也没有声明 FPS、视觉或听感验收。

## CI 的限定比较

Verify 的原 Node 24、`npm ci` 和 `npm run verify` 保持原样。后面仅复用已有固定 SHA 的 setup-node action 切到 24.21.0，捕获上述固定前缀并与本机 trace 比较。没有新增权限、服务、artifact 上传或第三方依赖。CI 日志会打印实际环境和输入摘要，不能仅凭 workflow 配置声称统一了 Node。

本机与 Linux 的实际配对结果须以当前 head 的成功 CI 日志和独立复核为准。即使短前缀匹配，也不能据此关闭 Issue #26 或解释 180 秒终局差异；若需扩大录制或改变游戏 checksum 语义，应另行提出有证据的后续任务。

## 待人类决定的装甲候选

本分支候选 VERSION 为 `lunar-armor-1`，当前固定前缀只更新版本字段，90 个动作保持原样。当前命令与 CI 使用 `docs/evidence/armor22/macos-node24.21.0.json`，该文件从实际候选 core 完整重新捕获。上文 checksum26 原始 trace 与基线信息保留为 lunar-1 历史，不冒充当前构建；比较器继续拒绝跨 core、录制或 Node 身份。新格子数值与兼容标签未获人类批准，PR 不合并，也不据此宣称解决 Issue26 原终局差异。
