# Issue 36 作者实机记录

源码封板为 `9744c0b4439ce14bbd830e9ba696d1c50f814439`，基线为 `6b3ac0aedc586f87b7975756de2f7718043a6d30`。本记录与媒体随后作为纯 docs 提交。源码和运行文件的 SHA-256 见 [source-runtime-hashes.json](source-runtime-hashes.json)，后续 head 必须重建并核对这些字节，不能直接继承源码 head 的完整验收。

2026-11-08，macOS，使用自己的 `http://127.0.0.1:4186` 正常服务和新建 IAB task tab。服务 HTTP 200 后 Chrome 创建页明确返回 `Browser is not available: chrome`。未操作 Chrome AppAX、DevTools、无关标签或任何锁屏流程。IAB 的 visible:true 在子线程不支持；省略 visibility 后可用。没有把 IAB 称作 Chrome。

请求的 viewport 为 1280×720 和 390×693，但保存的原始 JPEG 分别只有 1164×655 与 355×630。本次未读出 innerWidth，因此这些文件只能证明各自实际截图尺寸，不能冒称已完成目标 390 CSS px 验收。

封板后 reload，再通过真实开始按钮、WASD 和 P 操作。没有注入 World、HP、种子、时钟或私有录制。首局向西自然走位，随后因工具交互间隔停留，00:54 自然失败。通过重新部署按钮开始新局并向东走位，观察倒伏碟面和边界外完整阵列。00:40 自然拾取触发升级，切换英文并选择脉冲步枪，P 暂停和恢复均可操作。

| 原始文件 | 可证明的画面 |
|---|---|
| [desktop-title-zh.jpg](desktop-title-zh.jpg) | 中文标题及剧情、战役待接入状态。 |
| [desktop-defeat-zh.jpg](desktop-defeat-zh.jpg) | 自然失败和西侧地坪，文件不是西侧纯战斗截图。 |
| [desktop-east-zh.jpg](desktop-east-zh.jpg) | 第二局正常向东走位后的沙地与阵列区域。 |
| [desktop-radar-ground-zh.jpg](desktop-radar-ground-zh.jpg) | 倒伏碟面、沙丘和演员上层。截图时尚未到真正边界。 |
| [desktop-boundary-upgrade-zh.jpg](desktop-boundary-upgrade-zh.jpg) | 东侧完整雷达在右侧边缘，真实升级弹窗覆盖中央。 |
| [desktop-upgrade-en.jpg](desktop-upgrade-en.jpg) | 英文升级文本，升级冻结维持 00:40。 |
| [narrow-upgrade-en.jpg](narrow-upgrade-en.jpg) | 355×630 原图中的英文升级布局。 |
| [narrow-paused-en.jpg](narrow-paused-en.jpg) | 英文暂停和继续任务。 |
| [narrow-combat-en.jpg](narrow-combat-en.jpg) | 英文恢复后的战斗，00:41，角色和晶体可见。 |

[author-final-dom.txt](author-final-dom.txt) 是最终主游戏 DOM。[author-console.json](author-console.json) 保存该页捕获的控制台记录，仅 Info，没有捕获到 Warn 或 Error。IAB 将日志对象显示为 Object，不能以此宣称检查到其内部字段或跨设备没有错误。

此后 viewport 已 reset，自己的 task tab 已关闭，4186 服务已停止，CUA completion_summary 已提交。独立 verifier 使用另一个目录和服务，不继承作者的浏览器或焦点。

作者 full verify 见 [author-verify.log](author-verify.log)，104 项通过，gzip 32626 字节，预算 153600 字节。三个自动模拟种子 checksum 依次为 6d37c8d2、ff94b04b、c71d5dc4。它们只证明模拟回归，不是人工胜率、浏览器 FPS 或听感。

[no-comments.md](no-comments.md) 的地图 hash 是最后一次碟面轮廓调整前的工作区。其后只将圆形倒伏碟面改成破碎抛物碟面像素坐标，不新增路径或行为。封板源码的 full verify 重新执行 AST 无注释检查。最终 SHA 仍须由非作者重新检查，不能把旧报告当成新 hash 的审阅。

独立数值 verifier 已报告源码 head 的完整 verify、受保护文件、World、状态恢复和配对回放通过，正式结果由它提交。本作者不把这个转述当作最终 head 已验收。

独立视觉 verifier 在其独立服务 HTTP 200 后，Chrome 与 IAB task 路由均不可用，已记录限制。当前独立视觉为 HOLD。作者媒体不能替代它。尚缺最终 head 的独立真实浏览器通过、明确 390 CSS px、有限自然动态片段和完整密集预警观察。本任务不修改人物动画或音频，不声称音频听感、FPS、B1、剧情播放或六关战役完成。
