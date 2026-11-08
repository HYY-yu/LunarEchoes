# PR 35 的同平台基线修复

提交 dda6971 的 Linux CI 在 100 项测试中失败 1 项。真实 Linux 终局 checksum 是 c060a01a，原 Mac 捕获值是 ff94b04b。失败位置为 desert-replay.test.mjs 的历史 checksum 断言。原动作本身仍可用，错误是把历史 Mac 观测当成跨平台结果合同。本次不修复 Issue #26，也不承诺跨平台浮点结果一致。

测试现在从固定 Git 提交 bde5936d13d6890a72d24d36bb0039e48e36df44 加载真实旧 core，与当前 core 在同一进程执行完全相同的已捕获动作。初始状态和每个动作后都严格比较全部旧 World 字段、含 events 的 JSON 字节、events 置为空数组后的 JSON 字节和裸 checksum。保留 180 秒胜局、140 秒 Boss 一次、终局和全部旧协议反例。新增负控分别改变位置、装甲、rng、events、tick 和字段顺序，六项全部必须被检测。

独立 differential 同样以当前平台实跑的旧引擎为基线。输出将 capturedObservation 与 actualBaseline 分开，明确当前 Node、平台和架构。摘要的胜负读取当前运行结果。原 Mac checksum、phase、ticks 和其他观测仍保留在原压缩动作文件及历史结果中，没有覆盖，也没有新增 Linux golden。

GitHub checkout 保留原 pinned action，深度设为 2。当前 PR synthetic merge 能直接取得父提交基线。为避免后续 main 远离基线后确定失败，CI 先用 cat-file 检查固定源码对象，缺失时只从原仓库 fetch 该 SHA，使用 --no-tags --depth=1。fetch 失败仍使 step 非零退出。npm test 本身不联网，没有额外权限、服务或全历史拉取。

作者实际验证了以下场景。

- 当前本机完整 verify 通过，101 项、0 失败，gzip 31050 / 153600 字节。
- 合成 PR merge 的真实 depth 2 浅仓库包含固定基线，完整 verify 通过。depth 1 对照缺少该对象，cat-file 返回 128。
- 构造额外四次提交后的 future head，再做 depth 2 浅克隆。未 fetch 时真实 desert-replay 测试返回 1。随后从 GitHub 原仓库仅 fetch 固定 SHA，重新完整 verify 通过，仓库仍保持 shallow。
- 将另一个缺对象的浅仓库 origin 指向不存在路径，运行相同 guard，fetch 返回 128，未吞掉失败。
- 生产 src、index.html、style.css 未变，重新构建的 14 个运行文件与 dda6971 逐字节相同。没有操作或中断独立浏览器测试。

[浅仓库证据](ci-fix-shallow.json)和[运行文件清单](ci-fix-runtime.json)保存具体对象与摘要。源代码和历史动作未改。新 head 仍须通过独立复核和实际 CI，不能沿用旧提交的 PASS。

复跑同平台测试使用 npm run verify。完整同动作矩阵使用 node scripts/desert-differential.mjs /tmp/desert-paired-results.json。浅克隆若缺基线，先执行工作流中明确的固定 SHA fetch，不在测试内自动下载。历史 Mac 动作重新捕获与压缩文件逐字节 cmp 仅适用于原捕获环境；跨平台使用已保存动作执行同平台旧新引擎对照。
