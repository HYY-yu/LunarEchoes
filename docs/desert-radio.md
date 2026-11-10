# 沙漠战斗无线电

战斗中的首次击杀展示 `desert-base.radio.first-contact` 的完整中英文原文。第一条显示后经玩家关闭，战斗达到关卡时长中点时展示 `desert-base.radio.telemetry`。当前沙漠时长为 10800 tick，中点为 5400 tick，即 90 战斗秒。内容来自既有剧情目录，经同一 builder 和严格七字段 parser 嵌入。没有新的战斗事件、动作、资源、音频或存档字段。

main 独占每局呈现状态 `inactive | waiting | active | dismissed | disabled`。active 和 dismissed 带有当前 `firstContact | telemetry` 身份。新任务及 Retry 成功准备后恢复 waiting，首次 live kill 转 active(firstContact)，同 tick 终局优先清理。first-contact 未出现或未关闭时，遥测不能抢占。关闭只结束当前条；下一次正常 act 在 running、页面可见且达到中点时才激活遥测，包含返回 running 的 resume 或 choose。关闭、语言切换和纯重绘均不调度下一条。遥测关闭后本局不再重复。

暂停页可以在首次击杀之前或之后关闭本局无线电，禁用同时抑制两条，新任务恢复。暂停、升级和后台隐藏 active，恢复战斗后显示同一条。标题、终局、成功 Replay 和 Home 清空；Replay 不播放无线电，准备失败保留当前会话和错误提示。

正文和关闭按钮是 overlay 外的稳定节点。切换语言原位更新，完整正文不裁剪。无线电没有计时器，关闭及禁用不改变模拟、录制、输入、音频或原有 Boss／错误通知的 3500ms 生命周期。隐藏关闭控件时若它持有焦点，焦点返回战场。started 和 ended 日志记录真实条目身份，禁用日志表示本局禁用，不替未展示条目记录结束。

紧凑条使用既有像素界面配色，关闭控件至少 44×44 CSS 像素。窄屏位置在装备栏下方。条幅会覆盖少量外围战场，中央玩家、预警、HUD、关键通知和触控区仍需真实浏览器验收。参考为 [Nintendo 官方 Hades 页面](https://www.nintendo.com/au/games/nintendo-switch/hades/)截图中的外围 HUD 空间组织；没有将参考素材纳入运行时。其他无线电仍待接入。

`npm run verify` 检查完整模拟、下载预算及实际 main 的内容边界、状态、焦点、提示期限、原生按钮、配对会话和回放。边界测试在 VM 设置 5399／5400 等状态；另用正常种子动作完整游玩超过中点，观察遥测正文后比较控件操作与对照的完整会话、终局录制及真实回放。两类测试均不代替实机。

[PR #53](https://github.com/HYY-yu/LunarEchoes/pull/53) 已合并。非作者验收为 PASS+NOTES，用户提供中文 first-contact 和英文遥测的桌面实机图，并反馈触屏正常、明确授权合并。触屏没有截图，本轮也没有新增精确视口或 44 CSS 像素尺寸测量，未提供暂停恢复录像，详见[验收记录](https://github.com/HYY-yu/LunarEchoes/pull/53#issuecomment-6765776816)。测试、HTTP 文件一致和桌面静图各自只支持其覆盖范围，不代替未取得的实机证据。
