# 比较固定完整动作的终局

本诊断只为 Issue26 的一个历史完整输入消除 Node 版本混淆。它复用 `test/desert-replay.test.mjs` 的既有逐动作同平台新旧引擎断言。普通 `npm run verify` 不新增 Node pin，也不输出终局记录。

在独立、源码不变的 checkout 中顺序运行以下命令。先确认历史 baseline Git object 可读。

```sh
git cat-file -e bde5936d13d6890a72d24d36bb0039e48e36df44:src/core.ts
npm ci
npm run verify
LUNAR_FULL_TERMINAL=1 node --test --test-reporter=tap --test-name-pattern='^the real desert run matches the frozen engine on this platform at every captured action$' test/desert-replay.test.mjs
```

显式模式只接受 `LUNAR_FULL_TERMINAL=1`，要求实际进程 Node `24.21.0` 和 V8 `13.6.233.17-node.53`。其他已设置的模式值或不同运行版本在完整 fixture 工作前失败。没有覆盖实际版本或摘要的环境变量。

输入是 `docs/evidence/desert34/baseline-actions.json.gz` 的唯一 seed42、skilled、attack case。固定原始 gzip SHA256 为 `d21bf773c29a32bec82ca34af79bae655626f2fea446df7609e97a2805a9caf8`。固定动作 JSON SHA256 为 `ffd6e8dbdccc4aa7d0ad82df3d1ad2147c5d051184c88953025438d41306bef4`。检查 baseline、录制种子、动作声明摘要和 10811 个动作，其中 10800 tick、11 choose。改变动作并重算声明摘要仍然失败。

所有原有严格断言成功后，TAP 输出一条 `lunar.full-terminal-pinned` JSON diagnostic。它不含 World、actions 或 recording payload。序列化后的 UTF-8 JSON 最多 8192 字节。记录包括实际 Node、V8、platform、arch，实际 `dist/core.js`、`dist/stage-rules.js`、`dist/stage-contract.js` 摘要，以及输入身份、当前五字段 buffer 摘要、上下文和终局。三个模块是当前确定性模拟依赖，摘要现场计算，不永久固定正常构建产物。

五字段 buffer 按 `version, stageId, rulesVersion, seed, actions` 构造并经过 `parseActionBuffer`。其摘要不等于旧 fixture recording 摘要。`battleChecksum` 和 `finalChecksum` 分别报告，不把历史 macOS checksum 当作跨平台通过条件。`finishRecording` 自身不证明重放成功。原有完整 verify 继续覆盖后续 replay 测试，精确命名的 CI 重跑只覆盖既有逐动作终局测试。

将当前 commit SHA、原始 macOS TAP、Linux CI run URL 和原始 TAP、各自唯一紧凑记录及独立验收结果放入 PR 或 Issue26 元数据。不要为 CI 结束后的实测记录修改本文，引起新的 SHA。CI 保留原有 verify 和 90-action prefix 比较，只在精确 Node pin 后追加同一条完整命令。

先核对两个成功进程的 Node、V8、三个模块摘要、gzip、actions、buffer、baseline、case、动作计数和上下文。platform 和 arch 是实验变量。身份不同则不可比较。非零退出、记录缺失或重复属于执行失败。身份相同再人工比较终局字段，相同记为 same，不同记为 observed difference。这里没有自动跨平台比较器，也不把可比的终局差异改写为 CI 正确性失败。

私有 guard 测试使用明确标记的合成错误 Node 和 V8，覆盖错误模式、输入变异、声明摘要、唯一性、计数和 UTF-8 上限。独立验收还须通过实际进程的预期 pin 变异或已有不兼容运行时证明顶层 guard 确实连接，不能把合成版本测试称为另一个 Node 的实跑。

本单元不改变玩法、存储、回放或 checksum 语义，不定位首个分歧，也不证明浮点根因、真实浏览器跨设备回放或 FPS。Issue26 保持开放。没有实测的目标设备仍未验收。
