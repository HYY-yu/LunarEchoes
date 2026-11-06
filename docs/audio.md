# Issue #5 合成音与生命周期

本任务只修改音频表现、调用边界与瞬态敌人命中事件，不改变数值、动作、Recording、VERSION 或 checksum。`enemy-hit` 在子弹、环绕和新星实际扣血处发出。`hit` 仍只表示玩家受伤。敌人事件不参与模拟判断。

采用单 Synth、显式 menu/running/paused/upgrading/terminal 会话和受追踪的音乐、战斗与反馈声音。备选方案是每帧扫描敌人 HP 快照；该方案增加分配与扫描，因此没有采用。音色表集中在 `src/audio.ts`，QA 导出直接复用该图，不使用另一个样本实现。

| 声音 | 触发 |
|---|---|
| shot | 自动开火事件 |
| enemy-hit | 子弹、环绕、新星实际扣血 |
| kill | 击杀事件 |
| hit | 玩家受伤事件 |
| pickup | 拾取事件 |
| dash | 成功冲刺事件 |
| upgrade | 接受升级事件 |
| boss | Boss 出场事件 |
| won / lost | 同批次最高优先级，单会话只一次 |
| ui-confirm | 接受的按钮、语言切换、升级选择 |
| ui-reject | 冲刺冷却时再次按空格或触屏冲刺；升级面板输入无效数字 |

真实模式转换停止所有旧声音，包括已启动与未来安排的音符。之后可以播放有意的 UI 或结果反馈；同模式更新不截断自己的结果音。静音与后台停止全部声音并作废未完成的激活。激活只准备设备，不改变会话。重开与回放重置声音、节拍、冷却与 generation；旧异步激活返回 false，调用方不会继续播放旧确认音。恢复音乐从当前设备时间排程，不追播后台节拍。单次事件去重、短冷却与 24 voice 上限限制密集场景。保留原音乐旋律、低音、底鼓与噪声打击乐。

## 可执行作者验收

在本 worktree 执行以下命令。

```sh
npm ci --offline --cache /private/tmp/lunar-npm-cache
npm run verify
node scripts/audio-differential.mjs 56c6923d381baf40750be08da00a6fa576d6723c
git diff --check
```

差分对三种子记录及三类实际命中路径逐动作比较完整非事件 World、每次 checksum 与旧事件顺序。已运行 31,794 次比较通过；这不是新协议，也不替代真实浏览器试听。

## 浏览器验收夹具

```sh
node scripts/audio-audition.mjs
```

打开 `http://127.0.0.1:4175`。服务器只监听 loopback，只暴露三条白名单路径，不暴露源码目录、Git 或任意路径。该开发夹具与导出 WAV 都不进入 dist 或游戏资源预算。

1. 点击各 cue 按钮，试听全部十二种事件。won/lost 按钮会先重置以便重复试听。
2. 点击 Run music，试听保留的多声部。Pause 应立即停止；Resume 不追播旧音符。继续用 Toggle mute、Toggle hidden、Restart 观察和听取相同行为。
3. 点击 Run lifecycle checks。Results 显示六项 PASS/FAIL 及明确的听感限制。状态区显示 session、hidden、muted、ready、voices 与 generation。
4. 点击 Export all cues WAV。浏览器真实离线音频引擎使用同一 cueGraph，导出单声道 WAV，按 Results 中每 1.6 秒的时间表试听。样本是 QA 产物，不是运行时音频。
5. 切到别的标签页再返回，检查真实 visibilitychange 的停止与恢复。游戏还须实测暂停、升级、重开、回放、终局、声音与语言切换，以及桌面/窄屏截图与控制台。

夹具的声音图所有权检查与假 WebAudio 测试不能证明无可闻泄漏、音色清晰或密集战斗平衡。作者没有浏览器控制权，本任务没有自行声称试听通过。当前 SHA 的浏览器截图、WAV、听感记录与独立领域验收由主协调补齐，缺少其中任一项不合并。
