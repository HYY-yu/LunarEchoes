# Issue 22 已获得升级的 HUD

Issue 22 第 2 项修复已获得的推进器、装甲与采集器未显示的问题。HUD 遍历模拟已有的六类升级目录，只显示正等级。槽位顺序为步枪、无人机、新星、推进器、装甲、采集器。重复升级更新同一类的等级。

## 设计与范围

本次继承 [Issue 16 已批准视觉](ui-style.md) 的贴边装备栏、六类既有 CSS 像素图标、双语名称、title 与可访问名称。沿用其中 HoloCure 官方升级实机的整行点击区和 SYNTHETIK 官方实机的中央战区留白。没有新增美术方向，因此不生成新的概念图，不引入下载位图、音频或依赖。动画和音频代码没有改动，本次没有动画或听感验收声明。

源码只替换 `core.ts` 的原目录声明和抽选引用，以及 `main.ts` 的导入和装备遍历。`UPGRADE_ORDER` 是冻结的只读数组，抽选仍复制数组后使用原顺序和 RNG。装甲伤害、治疗、胜败、时间、录制、关卡、渲染、音频和进度逻辑保持原行为。Issue 22 第 1 项与 Issue 23 不在本次范围内。

## 自动验证

执行 `npm ci && npm run verify`。作者运行得到 56 个测试通过，0 个失败，gzip 为 25,104 字节，预算为 153,600 字节。三个真实输入机器人种子均在 180 秒获胜，回放校验一致。完整输出见 [verify.log](evidence/equipment22/verify.log)。这些离线结果不代表浏览器帧率。

`test/upgrade-catalog.test.mjs` 新增两个测试。第一个检查目录、World 升级键、顺序与唯一性。第二个检查外部修改被拒绝、候选抽选不修改目录，以及三个固定种子各八轮候选、RNG 和 checksum 与修改前记录一致。[基线](evidence/equipment22/baseline.json) 使用 Node 测试夹具触发阈值，不是浏览器自然升级。

[先红输出](evidence/equipment22/catalog-before.log) 是新公共导出不存在造成的模块加载失败，不是目录行为断言失败，也不证明 HUD 漏项。HUD 的原始缺陷由真实启动 seed 1707196613、自然选择推进器后仍只有步枪槽的 [修改前截图](evidence/equipment22/before-boots-missing.jpg) 证明。

## 作者浏览器记录

实机为本机 macOS Chrome，本地独立分支服务 `http://127.0.0.1:4182`。只通过真实按钮和 WASD 操作，不注入 World、种子、HP 或时间。截图是实际渲染，不是概念图。

[初始截图](evidence/equipment22/initial-pulse-only.jpg) 在 1280×720 显示步枪 LV 1，其余零级隐藏。自然局 seed 4142556147 依次选择装甲、推进器、采集器、装甲、新星、新星。[重复升级前](evidence/equipment22/four-slots-before-repeat.jpg) 和 [升级后](evidence/equipment22/four-slots-hull-level2.jpg) 显示四槽保持原顺序，装甲从 LV 1 更新到 LV 2。

该局在 01:37 自然失败，117 击破、等级 7。实际 [终局](evidence/equipment22/first-run-terminal-five-types.jpg) 只有五类，不作为六类布局证据。随后真实回放显示 [校验一致](evidence/equipment22/first-run-replay-verified.jpg)，checksum 为 `d11d19cf`。返回基地再次启动，seed 2742612319 的 [重开截图](evidence/equipment22/restart-clears-upgrades.jpg) 只保留步枪 LV 1。

第二局 seed 2742612319 通过自然拾取依次装配新星、采集器、无人机、装甲、推进器，在 01:05 获得六类。实际操作采用按钮选择和 WASD 矩形走位，没有模拟状态注入。

| 视口 | 中文 | 英文 |
| --- | --- | --- |
| 1280×720 | [运行中](evidence/equipment22/all-six-desktop-zh-running.jpg) | [运行中](evidence/equipment22/all-six-desktop-en-running.jpg) |
| 390×693 | [运行中](evidence/equipment22/all-six-narrow-zh-running.jpg) | [暂停](evidence/equipment22/all-six-narrow-en-paused.jpg) |

六槽实际范围在桌面为 x=24 至 353，共 329px；窄屏为 x=14 至 279，共 265px。图标和 LV 1 完整可读，没有覆盖装甲、时钟或击破数，无需修改 CSS。两种语言的六个 title 和 aria-label 均与既有翻译一致，切换语言不改变槽数、顺序和等级。重复等级实测到 LV 2，没有声称实测两位数等级。

本次未强录动画。一次追加窄屏英文运行图的调用在后续操作出现 stale AX 错误，其日志只有图片 metadata 而没有图片原字节，因此没有作为截图证据。成功的窄屏英文暂停截图仍覆盖该语言和尺寸。最终开发者日志读取没有 Warn 或 Error，见 [browser-record.json](evidence/equipment22/browser-record.json)。该 API 将 Info 对象显示为 `Object`，因此没有把它当作详细事件内容。

第二局保留在 Chrome tab `1375938227`，01:06 暂停、六类 LV 1、125/125 装甲、68 击破，并调用 `markHandoff` 供独立 verifier 检查现场。临时 viewport 已 reset。第一局已完成的录制仍由正常应用流程保留，第二局尚未终局。作者没有读取应用私有录制变量。

源码提交为 `97f1e10f8ab616d6a18030b9a02cf81a4332f72c`，后续提交只记录文档和证据，运行时文件保持一致。截图原始字节、尺寸、DOM 读出和 SHA256 见 [frames.json](evidence/equipment22/frames.json)。构建和源码哈希见 [runtime.json](evidence/equipment22/runtime.json)。本次截图按原始输出字节保存，没有重新编码或拼图。

作者自验不代替当前 PR head 的独立领域验收和成功 CI。真实手机设备、帧率、改动范围外的完整动画和音频生命周期没有在本次验收。

## 独立验收归档状态

候选 `cb82545471ea75181ce07dde37d5e36dbd42ea5b` 的独立数值原始输出、第一位非作者的六张实机图与 DOM 记录见[独立证据来源索引](evidence/equipment22/independent/README.md)。归档逐字节保留原文件，并核对截图 SHA256、字节数和尺寸。数值配对覆盖三个种子的 33 次候选抽选，结果与基线一致。

第一位非作者已自然完成六类升级、重复升级、重开隐藏与真实失败回放，并检查桌面和窄屏的中英文布局。其原始整体结论保留为 INCOMPLETE。第二位非作者随后完成独立触屏补项，当前候选的汇总领域结论为限定范围 PASS。六类装备与实际触屏区域不重叠，摇杆拖动使场景移动，按住 D 的原子指针冲刺后立即暂停，真实 DOM 冷却为 `2.4`。这覆盖桌面 Chrome 触屏仿真和键盘辅助指针，不覆盖实体手机或实体双指。初次超时、审批拒绝和未完成历史均保留。新增文档提交后的运行时字节核对、verify 与 CI 仍需重新完成。
