# 生成计划与积分预算（generation-plan）

> 配合 `pipeline/prompts/cn-ancient.md` 的提示词模板使用。
> 计费基准（Tripo P1）：文生 3D 无贴图 **30** / 标准贴图 **40** / 高清 **50**；图生 40/50/60。
> 纪律：`-n 2` 出候选择优；不满意用 `tripo redo @last` 换 seed，**不改提示词重跑**；生成前 `tripo balance`。

## 费用总览

| 波次 | 内容 | 件数 | 单价 | 小计（积分） |
|---|---|---|---|---|
| Wave 0 | Blender 手工 primitive + 共享材质 | 14 | 0 | **0** |
| Wave 1 | 街景 MVP（构件为主） | 30 | 30-40 | **950** |
| Wave 2 | 商业/院落 + 道具植被扩展 | 24 | 30-40 | **810** |
| Wave 3 | 英雄件 + 园林 + 修仙特色 | 14 | 40-60 | **700** |
| 合计 | | 82 | | **2460** |

对比：同等覆盖度若每栋建筑单独生成（约需 60+ 栋 × 40 积分）≈ 2400+ 积分且风格漂移；本方案 2460 积分得到的是**可无限拼装的构件库 + 82 件入库资产**，后续新建筑 0 积分。

---

## Wave 0：0 积分打底（Blender 手工 / 程序化）✅ 已完成（2026-09-02）

几何简单件用 Tripo 生成纯属浪费，直接在 Blender 建模 + 挂共享材质：

| 资产 | 分类 | 说明 |
|---|---|---|
| base-stone-flat-a/b | base | 石台基，高 0.5m / 1m ✅（程序化生成，平底方盒，倒角留待后续需要时加） |
| base-xumizuo-a | base | 须弥座 ✅（4 层方盒分层） |
| stairs-front-3/5 | base | 三级/五级踏跺 ✅ |
| ramp-stone-a | base | 坡道 ✅ |
| wall-solid-a | wall | 实墙 2×3m ✅ |
| wall-half-a | wall | 半墙 2×1m ✅ |
| pillar-round-a | pillar | 木圆柱 h3m + 柱础 ✅ |
| pillar-square-a | pillar | 方柱 h3m ✅ |
| ground-slab-a/b | ground-tile | 青石板 / 方砖 2×2m ✅ |
| ground-dirt-a | ground-tile | 夯土 2×2m ✅ |
| 共享材质 × 18 种 | materials | 瓦 4 + 木 4 + 墙 4 + 石 3 + 金属 3（见 DESIGN §4.6） ✅（2026-09-02 由 `pipeline/scripts/gen-materials.js` 生成，含 .tres + index.json；琉璃瓦带 clearcoat 釉面） |

产出：`kits/cn-ancient/materials/` + 上述 primitive 入库。此波完成后即可拼"毛坯建筑"。

> 注：本机无 Blender，13 件 primitive 全部改由 `pipeline/scripts/gen-primitives.js` 程序化参数生成（盒体/圆柱/三棱柱网格构建器，轴心底部中心、米制、法线+UV 齐全），每件仅 4~5KB、12~60 面，远超预算要求。generator 记为 `procedural-gen`。

## Wave 1：街景 MVP（约 950 积分）

目标：拼出一条完整古风街道（民居 + 店铺 + 街道道具）。

### 构件（文生，无贴图 30 积分 × 22 = 660）

| # | id | 提示词方向 | 模数 |
|---|---|---|---|
| 1 | roof-xuanshan-single-a | 悬山顶单檐，民居级别，青瓦，两端出际 | 宽 6m | ✅（2026-09-02 入库为 `cn-ancient.roof.xuanshan-single-a`，混元3D 带纹理版，4.06万面超预算待后续 LOD/手工减面，模型尺寸 0.99m 需在引擎内缩放） |
| 2 | roof-yingshan-single-a | 硬山顶单檐，民居，马头墙端 | 宽 6m |
| 3 | roof-xieshan-single-a | 歇山顶单檐，店铺级别 | 宽 6m |
| 4 | roof-juanshan-a | 卷棚顶，游廊/小店用 | 宽 4m |
| 5 | roof-ridge-zheng-a | 正脊，素脊 | 长 2m |
| 6 | roof-ridge-chiwen-a | 鸱吻一对，屋脊端饰 | 配件 |
| 7 | roof-eave-corner-a | 飞檐翘角单件 | 配件 |
| 8 | wall-lattice-a | 花格木窗墙，上窗下板 | 2×3m |
| 9 | wall-door-shop-a | 店铺排门墙（可拆卸门板） | 2×3m |
| 10 | wall-window-a | 带槛窗墙 | 2×3m |
| 11 | door-geshan-a | 隔扇门，四扇 | 宽 2m |
| 12 | door-plank-a | 板门，民居木门带门环 | 宽 2m |
| 13 | window-lattice-a | 槛窗单件，步步锦棂格 | 宽 2m |
| 14 | railing-stone-a | 寻杖石栏杆，望柱头 | 宽 2m |
| 15 | railing-wood-a | 木栏杆 | 宽 2m |
| 16 | pillar-dragon-a | 盘龙石柱（殿宇门面） | h4m |
| 17 | lantern-palace-a | 六角宫灯，悬挂式 | 道具 |
| 18 | lantern-hanging-a | 圆红灯笼 | 道具 |
| 19 | stall-market-a | 集市货摊，布棚木架 | 道具 |
| 20 | signboard-a | 店铺幌子，布面酒旗 | 道具 |
| 21 | tree-pine-a | 迎客松，造型苍劲 | 植被 |
| 22 | tree-bamboo-a | 竹丛一簇 | 植被 |

### 整栋远景（文生，标准贴图 40 积分 × 6 = 240）

| # | id | 提示词方向 |
|---|---|---|
| 23 | bld-minju-small-a | 中式小青瓦民居，一进，白墙木窗 |
| 24 | bld-minju-small-b | 夯土墙民居，悬山顶，带柴门 |
| 25 | bld-shop-street-a | 临街二层店铺，下店上居，排门 |
| 26 | bld-inn-a | 两层客栈，出檐阳台，挑灯笼杆 |
| 27 | bld-paifang-a | 三间四柱石牌坊，街道入口地标 |
| 28 | bld-well-a | 石井栏水井，带辘轳架 |

### 材质/贴图补充（50 积分）

| # | 内容 | 说明 |
|---|---|---|
| 29 | 石板路贴图 / 街面杂物补件 | 视 Wave 0 效果决定是否生成，预留 50 |

**Wave 1 验收**：用构件拼出 3 栋不同立面建筑 + 摆好 20m 街道，与整栋远景混放，截图验收风格统一性。

## Wave 2：商业/院落扩展（约 810 积分）

### 构件（无贴图 30 × 15 = 450）

| # | id | 提示词方向 |
|---|---|---|
| 1-2 | roof-wudian-single-a / roof-cuanjian-a | 庑殿顶（殿宇）/ 攒尖顶（亭子） |
| 3 | roof-xieshan-double-a | 歇山重檐（英雄件候选屋顶） |
| 4 | wall-window-moon-a | 月洞门墙，园林隔断 |
| 5 | door-arch-a | 拱券门，城门/桥洞 |
| 6 | window-leak-a | 漏窗，园林花窗 |
| 7 | pillar-stone-a | 石方柱 h4m |
| 8 | bracket-simple-a | 简易斗拱一攒 |
| 9 | stairs-yunbu-a | 云步踏跺，园林自然石阶 |
| 10 | furniture-table-a | 八仙桌 |
| 11 | furniture-chair-a | 太师椅 |
| 12 | furniture-screen-a | 落地屏风，山水绢面 |
| 13 | tree-willow-a | 垂柳 |
| 14 | tree-peach-a | 开花桃树 |
| 15 | rock-garden-a | 太湖石假山石 |

### 整栋/道具（标准贴图 40 × 9 = 360）

| # | id | 提示词方向 |
|---|---|---|
| 1 | bld-restaurant-a | 三层酒楼，飞檐挑台，金字招牌 |
| 2 | bld-teahouse-a | 临水茶肆，美人靠外廊 |
| 3 | bld-ting-square-a | 四角方亭，攒尖顶 |
| 4 | bld-lang-a | 游廊一段 4m，卷棚顶（可与构件衔接） |
| 5 | bld-bridge-arch-a | 单孔石拱桥，带栏杆 |
| 6 | prop-shishi-a | 守门石狮一对 |
| 7 | prop-xianglu-a | 三足铜香炉 |
| 8 | prop-stele-a | 赑屃驮石碑 |
| 9 | prop-boat-a | 乌篷船 |

## Wave 3：英雄件 + 修仙特色（约 700 积分）

英雄件走"概念图 → 图生 3D"流程（tbg-3d 工位一规则），全场景 ≤ 5 个。

| # | id | 模式 | 积分 |
|---|---|---|---|
| 1 | bld-dian-hall-hero | 图生高清 60：重檐庑殿大殿，须弥座台基，斗拱层叠 | 60 |
| 2 | bld-shanmen-hero | 图生高清 60：宗门山门，三间五楼，盘龙柱 | 60 |
| 3 | bld-pagoda-a | 文生标准 40：七层宝塔，密檐式 | 40 |
| 4 | bld-ge-cangjing-a | 文生标准 40：藏经阁，两层楼阁 | 40 |
| 5 | bld-city-gate-a | 文生高清 50：城门楼，拱券门洞+双层城楼 | 50 |
| 6 | prop-ding-hero | 图生标准 50：青铜巨鼎，广场礼器 | 50 |
| 7 | prop-danlu-a | 文生标准 40：八卦丹炉，修仙丹房核心 | 40 |
| 8 | prop-jianjia-a | 文生无贴图 30：兵器剑架 | 30 |
| 9 | prop-bell-a | 文生标准 40：铜钟+钟架 | 40 |
| 10 | tree-ginkgo-a | 文生无贴图 30：古银杏 | 30 |
| 11 | rock-mountain-a | 文生标准 40：大型假山叠石 | 40 |
| 12 | cliff-module-a/b | 文生无贴图 30×2：崖壁模块 | 60 |
| 13 | water-dock-a | 文生无贴图 30：临水码头 | 30 |
| 14 | bracket-ornate-a | 文生标准 40：华丽斗拱（英雄件补细节） | 40 |
| — | 重 roll / 翻车预留 | — | 120 |

## 执行检查单（每波次）

- [ ] `tripo balance` 额度 ≥ 本波预算 × 1.2
- [ ] 提示词从 `prompts/cn-ancient.md` 模板复制，只改主体部分
- [ ] `-n 2` 候选，选中后 seed/task id 记入该资产的 `source.json`
- [ ] 走 tbg-3d 三工位：精修（缩放归一、轴心底部中心）→ 入库目录
- [ ] 无贴图件挂共享材质并截图确认
- [ ] `asset.json` 通过 schema 校验，preview.png 已生成
- [ ] 更新本文件的完成状态（在表格行尾打 ✅）
