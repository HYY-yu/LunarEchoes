# 沙漠基地战场地图

Issue #36 将真实沙漠战斗中的灰色月壤、方格和完整场内建筑替换为原创 Canvas 代码像素地图。当前只有沙漠战斗测试，剧情播放、跨关战役和其他五张地图仍待接入。

## 构图与绘制边界

`createDesertMap()` 返回 `drawDesertMap(ctx, arenaSize, view)`。地图拿不到 World、战斗 RNG、时钟或音频。`render.ts` 继续管理相机，先画地图，再按原顺序画拾取物、敌人预警、敌人、弹幕、玩家与特效。

地图使用横向风积沙丘、西侧机库地坪、东侧倒伏碟面与风化车辙建立基地关系。中央保留低对比开阔沙地。真正有体积的机库和阵列分别位于 x 小于 0 与 x 大于 arenaSize 的不可进入地带。场内只有被沙覆盖的地坪、板材和倒伏构件，没有完整墙、屋顶、围栏、掩体投影或耐久目标。

地图创建时缓存 128×128 沙纹、512×256 设备图集和 256×80 沙丘印章。坐标纹理固定，图集不逐帧生成。CanvasPattern 按绘图上下文缓存，窗口改变后仍锚定世界坐标。背景调用用 save 和 restore 恢复样式、变换、透明度、复合模式及虚线。原来的 36 单位实际活动边界不变。

本次无需导出或修改 art.ts 调色板。钢蓝、青色、琥珀色直接采用现有 desert-scene.ts 同值颜色，沙地降低亮度和饱和度，给白色角色、青色拾取物和琥珀弹幕留出对比。

## 参考与原创范围

2026-11-08 查看两个竞品官方实机来源。仅研究构图、读图和操作布局，未复制素材。原始下载只保留在临时研究目录，不进入本仓库或 dist。

| 官方来源 | 实际观察与采用 | 不采用 |
|---|---|---|
| [Dome Keeper，Raw Fury 品牌经理在 Xbox Wire 的官方实机文章](https://news.xbox.com/en-us/2025/12/09/a-deep-dive-into-dome-keeper/)与[战斗原图](https://xboxwire.thesourcemediaassets.com/sites/2/2025/12/Screenshot1_DK_XSX-3ee189a5f86b775182c6.png) | 大块低频地形衬托高亮攻击，资源在左下，操作提示在底边。采用地形低对比与战斗高对比的层次。 | 不复制穹顶、怪物、紫色洞穴或素材。现有游戏 HUD 布局不改。 |
| [HoloCure，Kay Yu 作者页](https://kay-yu.itch.io/holocure)与[战斗原图](https://img.itch.zone/aW1nLzkyMzAyODEucG5n/original/I%2BSvGN.png) | 顶部状态和计时，场地平面纹理，主要操作区域留给人物、敌群和攻击。采用平面地标与中央留白。 | 不复制人物、草地、边栏、技能或音画资产。 |

上述图片版权属于各自权利人，不是可再分发的游戏素材。

[概念图](evidence/desert36/concept-only.png)由内置 imagegen 生成，属于 stylized-concept，仅供本次方向参考。生成请求要求俯视沙漠生存战场、宽缓沙丘、中央留白、西机库东阵列、钢蓝与青色琥珀设备、像素簇和少量角色比例参考。明确禁止 UI、文字、实心场内障碍和月坑。未调用收费 CLI 或 API，生成图不被运行时加载。

两套设计见[方案 A](evidence/desert36/design-a.md)、[方案 B](evidence/desert36/design-b.md)。[独立 judge](evidence/desert36/design-judge.md)选择 B 的小缓存实现，并融合 A 的横向沙丘与东西地标构图。拒绝 A 的整场大画布缓存。概念图中的封闭青色边线、场内完整屋顶和直立雷达也被拒绝。最终画面必须通过真实游戏另验。

## 复跑

运行 `npm ci` 和 `npm run verify`，再运行 `PORT=4186 npm run dev`，打开 `http://127.0.0.1:4186`。通过启动任务进入真实战场，向西走到地坪、向东走到倒伏阵列及真实边缘。可用 WASD、方向键、空格冲刺和 P 暂停，不需要注入种子、HP、时钟或 World。

`node --test test/desert-map.test.mjs` 在构建后检查确定性绘图、小缓存复用、调用状态恢复、东西场景区分和实际 renderer 不修改完整 World 与 checksum。它不证明美术质量或帧率。独立验收仍须检查当前 head 的主游戏、桌面与 390px、中英文、自然敌群、升级、暂停、重开与控制台。

音频、人物与怪物图集、攻击动画、模拟、输入、录制和规则未修改。本任务不声称新增动画或音频听感验收，不声称 FPS 或手机性能通过，也不代表 B1 或六关战役完成。
