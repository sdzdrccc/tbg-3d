# 修仙小镇建筑资产需求清单（building-assets）

> 配套文档：`pipeline/generation-plan.md`（按波次的生成计划与积分预算）、`pipeline/prompts/cn-ancient.md`（提示词模板）、tbg-assets `docs/DESIGN.md`（分类体系与模数标准）。
> 分工：generation-plan 回答"这一波生成什么"，本文档回答"**搭起某栋建筑，需要哪些资产、现在有没有、还差多少积分**"。

---

## 0. 使用说明

### 0.1 状态标记

| 标记 | 含义 | 积分成本 |
|---|---|---|
| [已入库] | tbg-assets `kits/cn-ancient/` 已有 model.glb，直接复用 | 0 |
| [W1] [W2] [W3] | generation-plan 已排期、尚未生成 | 按波次计划（30–60/件） |
| [新增] | 本文档建议追加生成，需合入 generation-plan | 30–40/件 |
| [程序化] | 几何简单件，走 `gen-primitives.js` 参数化生成 | 0 |

优先级分三档：P0 开张必需（缺了业态不成立）、P1 完整业态（玩家进店能看）、P2 氛围锦上添花。

### 0.2 一栋建筑的资产分四层

1. **建筑本体**——台基 + 柱 + 墙 + 门窗 + 屋顶的构件拼装，决定形制与等级（歇山 = 店铺级，悬山 = 民居/工坊级，庑殿 = 殿宇级）
2. **门面识别物**——幌子、灯笼、招牌、门口摊位，让玩家隔着一条街认出"这是卖什么的"
3. **室内功能件**——柜台、货架、专业道具，玩家走进店看到的东西，也是业态辨识度的第二落点
4. **氛围件**——植被、石景、地面铺装，把建筑融进街道

### 0.3 全局纪律

沿用现有约定，这里只列影响本文档决策的四条：

- 室内道具与构件一律**无贴图生成（30 积分）**，入库挂 `materials/` 共享材质；只有业态焦点道具（百子柜、丹炉、锻造炉）用标准贴图（40）
- 模数：墙/门窗宽 2m，层高 3m（民居）/ 4m（殿宇），网格吸附 0.5m
- **文字一律引擎内实现**（Godot Label3D / Decal）：提示词负面约束禁止文字招牌，模型只出无字布幌，"灵草""丹"等字号幌子全部后期贴
- 生成纪律：提示词从 `prompts/cn-ancient.md` 复制只改主体、`-n 2` 出候选、生成前 `tripo balance`

---

## 1. 共用资产池

### 1.1 已入库（16 件模型 + 18 种材质，零成本）

| 分类 | 资产 | 小镇用途 |
|---|---|---|
| base | stone-flat-a/b、xumizuo-a、stairs-front-3/5、ramp-stone-a | 全部建筑的台基与台阶 |
| pillar | round-a、square-a | 民居/商铺用圆柱，工坊用方柱 |
| roof | xuanshan-single-a（悬山）、xieshan-single-a（歇山）、wudian-single-a（庑殿） | 工坊级 / 店铺级 / 殿宇级各一 |
| wall | solid-a、half-a | 实墙与半墙（柜台矮墙可代用） |
| ground-tile | slab-a/b、dirt-a | 街面、店内、后院 |
| materials | 瓦 4 + 木 4 + 墙 4 + 石 3 + 金属 3 | 换材质 = 免费变体（青瓦铺 ↔ 琉璃丹阁） |

### 1.2 计划中的跨建筑复用件

| 资产 | 波次 | 积分 | 哪些建筑在等它 |
|---|---|---|---|
| wall-door-shop-a 店铺排门墙 | W1 | 30 | 灵草铺、灵食斋、符箓阁、万宝楼全部临街立面 |
| wall-lattice-a 花格木窗墙 | W1 | 30 | 上述四栋的山墙与二层 |
| signboard-a 无字布幌 | W1 | 30 | 全街（引擎贴字区分业态） |
| lantern-hanging-a / lantern-palace-a | W1 | 30×2 | 全街夜间门面 |
| stall-market-a 集市货摊 | W1 | 30 | 灵草铺门口药摊、灵食斋外卖档 |
| door-plank-a 板门 | W1 | 30 | 炼器坊、仓库类 |
| railing-wood-a 木栏杆 | W1 | 30 | 灵食斋二层回廊 |
| pillar-dragon-a 盘龙石柱 | W1 | 30 | 丹阁、万宝楼门面 |
| furniture-table-a / chair-a / screen-a | W2 | 30×3 | 全街室内通用（八仙桌、太师椅、屏风） |
| roof-xieshan-double-a 歇山重檐 | W2 | 30 | 丹阁、万宝楼 |
| prop-xianglu-a 三足铜香炉 | W2 | 40 | 丹阁门前、宗门广场 |
| tree-pine-a / bamboo-a / willow-a / ginkgo-a | W1/W1/W2/W3 | 30×4 | 各建筑门前氛围 |
| rock-garden-a 太湖石 | W2 | 30 | 丹阁、万宝楼庭院 |
| prop-danlu-a 八卦丹炉 | W3 | 40 | 丹阁核心 |
| prop-jianjia-a 兵器剑架 | W3 | 30 | 炼器坊门口展示 |

---

## 2. 重点建筑

### 2.1 灵草铺（药材铺）

一层临街店面，歇山顶（店铺级形制）。玩家最先光顾的功能商铺，识别度三件套：无字布幌（贴"灵草"）、门口药摊、檐角大葫芦。

拼装公式：

```
台基   stone-flat-a（高0.5m）+ stairs-front-3
柱列   pillar-round-a × 4（檐柱，间距 2m）
立面   wall-door-shop-a × 3（正面临街）+ wall-lattice-a × 2（两侧山墙）
屋顶   roof-xieshan-single-a
地面   ground-slab-a（店内）
```

| 层 | 资产 | 状态 | 优先级 | 积分 |
|---|---|---|---|---|
| 门面 | signboard-a 布幌 + 引擎贴字"灵草" | [W1] | P0 | 30 |
| 门面 | stall-market-a 门口药摊（摆灵草盆栽） | [W1] | P0 | 30 |
| 门面 | lantern-hanging-a 檐下红灯笼 ×2 | [W1] | P1 | 30 |
| 室内 | counter-shop-a 掌柜长条柜台 | [程序化] | P0 | 0 |
| 室内 | prop-yaogui-a 百子药柜（整墙药斗，业态焦点） | [新增] | P0 | 40 |
| 室内 | prop-yaojia-a 百草药架 | [新增] | P1 | 30 |
| 室内 | prop-yaoguan-a 药罐瓷瓶组 | [新增] | P1 | 30 |
| 室内 | prop-liangyao-a 晾药竹匾架 | [程序化] | P1 | 0 |
| 室内 | prop-yaojiu-a 药臼 + 药碾 | [新增] | P1 | 30 |
| 门面 | prop-hulu-a 悬挂大葫芦（修仙卖药标志） | [新增] | P1 | 30 |
| 室内 | furniture-table-a + chair-a（掌柜座） | [W2] | P1 | — |
| 氛围 | plant-lingcao-a/b/c 灵草盆栽 ×3 | [新增] | P0 | 30×3 |
| 氛围 | plant-yaocao-a 药草丛（墙根） | [新增] | P2 | 30 |
| 氛围 | tree-pine-a 门前迎客松 | [W1] | P2 | 30 |

新增小计 **280 积分**（含 3 盆灵草 + 1 草丛）；本体拼装件已入库或属 W1。

零成本变体：药柜挂朱漆/黑漆两套木材质，屋顶青瓦 ↔ 绿琉璃，即可区分平价草药店与高级灵药堂。

### 2.2 灵食斋（灵膳餐馆）

两层临街酒楼，玩家聚餐、接任务的社交场景。本体优先走整栋铺量，拼装作为备选。

| 层 | 资产 | 状态 | 优先级 | 积分 |
|---|---|---|---|---|
| 本体 | bld-restaurant-a 三层酒楼整栋 | [W2] | P0 | 40 |
| 本体（备选） | 拼装：stone-flat-a + pillar-round-a + wall-door-shop-a ×3 + wall-lattice-a 二层 + railing-wood-a 回廊 + roof-xieshan-single-a | [已入库]/[W1] | — | 0 |
| 门面 | signboard-a 布幌 + 引擎贴字"灵食斋" | [W1] | P0 | 30 |
| 门面 | lantern-palace-a 檐角宫灯 + lantern-hanging-a 一层串灯 | [W1] | P0 | 60 |
| 门面 | stall-market-a 门口外卖档 | [W1] | P2 | 30 |
| 室内 | furniture-table-a 八仙桌 ×4 + chair-a 太师椅 ×8 | [W2] | P0 | 60 |
| 室内 | furniture-screen-a 落地屏风（隔包间） | [W2] | P1 | 30 |
| 室内 | prop-zao-a 后厨灶台（业态焦点，配引擎火光） | [新增] | P0 | 40 |
| 室内 | prop-zhelong-a 蒸笼食盒组 | [新增] | P1 | 30 |
| 室内 | prop-jiutan-a 酒坛堆 | [新增] | P1 | 30 |
| 室内 | prop-lingguo-a 灵果摆盘（桌面点缀） | [新增] | P2 | 30 |
| 氛围 | tree-willow-a 门外垂柳 | [W2] | P2 | 30 |

新增小计 **130 积分**；本体依赖 W2 的 bld-restaurant-a（或改用已入库件拼装，0 新增）。

### 2.3 丹阁（丹药店 / 炼丹房）

两层楼阁、重檐歇山的**功能核心建筑**，玩家会反复进出（买丹、炼丹任务线）。全楼气质要"仙"：须弥座台基、盘龙柱、门前铜香炉、院里古银杏。丹炉是全楼焦点道具。

拼装公式：

```
台基   xumizuo-a（须弥座）+ stairs-front-5
柱列   pillar-dragon-a × 2（正门两侧）+ pillar-round-a × 4
立面   wall-lattice-a × 3（一层）+ wall-window-a × 3（二层）
屋顶   roof-xieshan-double-a（重檐歇山）
地面   ground-slab-b + rock-garden-a 庭院点缀
```

| 层 | 资产 | 状态 | 优先级 | 积分 |
|---|---|---|---|---|
| 门面 | prop-xianglu-a 三足铜香炉（门前，常燃香烟） | [W2] | P0 | 40 |
| 门面 | signboard-a 布幌 + 引擎贴字"丹" | [W1] | P0 | 30 |
| 门面 | lantern-palace-a 檐下宫灯 ×2 | [W1] | P1 | 30 |
| 室内 | prop-danlu-a 八卦丹炉（**全楼焦点**，配引擎粒子） | [W3] | P0 | 40 |
| 室内 | prop-yaogui-a 百子药柜（一层售丹柜，复用灵草铺件） | [新增] | P0 | — |
| 室内 | prop-putuan-a 蒲团（炉前打坐位） | [新增] | P1 | 30 |
| 室内 | prop-lingshideng-a 灵石灯（照明道具，冷光） | [新增] | P1 | 30 |
| 室内 | furniture-screen-a 屏风（隔出静室） | [W2] | P2 | 30 |
| 氛围 | rock-garden-a 太湖石庭院 | [W2] | P1 | 30 |
| 氛围 | tree-ginkgo-a 古银杏 | [W3] | P2 | 30 |

新增小计仅 **60 积分**（蒲团 + 灵石灯）——本楼大头是计划件：重檐屋顶（W2）、香炉（W2）、丹炉（W3）。售丹柜复用灵草铺的百子柜，这也是**灵草铺要先生成**的原因之一。

本体备选：W3 的 bld-ge-cangjing-a（两层楼阁）换材质直接当丹阁，省去拼装；适合快速出远景。

### 2.4 炼器坊（法器锻造）

铁匠铺的修仙版，一层硬朗工坊，悬山顶（已入库）。氛围要点：门口兵器剑架当招牌、锻炉火光（引擎点光）、锤击声。室内是"作坊"不是"商店"——工作台、铁砧、矿石堆取代柜台货架。

拼装公式：

```
台基   stone-flat-a（高0.5m）+ ramp-stone-a（进料坡道）
柱列   pillar-square-a × 4（方柱，工坊气质）
立面   wall-solid-a × 2（两侧）+ door-plank-a（正面板门）+ wall-lattice-a × 1（采光窗）
屋顶   roof-xuanshan-single-a（悬山，朴实民居级）
地面   ground-dirt-a（炉渣地）
```

| 层 | 资产 | 状态 | 优先级 | 积分 |
|---|---|---|---|---|
| 门面 | prop-jianjia-a 兵器剑架（门口，当招牌用） | [W3] | P0 | 30 |
| 门面 | signboard-a 布幌 + 引擎贴字"炼器" | [W1] | P0 | 30 |
| 室内 | prop-duanzao-a 锻造炉（**业态焦点**，配引擎火光） | [新增] | P0 | 40 |
| 室内 | prop-tiezhen-a 铁砧 | [新增] | P0 | 30 |
| 室内 | workbench-a 长工作台 | [程序化] | P0 | 0 |
| 室内 | 淬火水槽 | [程序化] | P1 | 0 |
| 室内 | prop-kuangshi-a 矿石原料堆 | [新增] | P1 | 30 |
| 室内 | 挂坯剑横梁（复用剑架拆件） | [程序化] | P2 | 0 |
| 氛围 | tree-bamboo-a 侧墙竹丛（柔化工坊硬感） | [W1] | P2 | 30 |

新增小计 **100 积分**。注意：拼装公式里 `roof-xuanshan-single-a` 曾有 0.99m 尺寸问题，现已精修归一（6m 宽、15000 面、轴心底部中心），可直接用。

---

## 3. 扩展建筑

四栋次优先建筑，本体全部复用已有方案，只列新增差异件。

| 建筑 | 本体方案 | 新增差异件 | 新增积分 |
|---|---|---|---|
| 符箓阁（符纸店） | 灵草铺同款拼装（歇山 + 排门墙） | 晾符架 30、笔砚组 30；符纸图案引擎贴花 | 60 |
| 灵兽坊（灵兽商行） | 硬山 + solid-a 高墙 + door-plank-a | 兽笼 40、拴兽桩 30；饲料槽程序化 0 | 70 |
| 云来客栈 | bld-inn-a 整栋 [W1] + 幌子灯笼 | 无（大堂桌椅走 W2 家具） | 0 |
| 万宝楼（拍卖行） | 重檐歇山拼装（同丹阁）或 bld-ge-cangjing-a 改材质；门前 prop-shishi-a 石狮 [W2] | 宝匣玉盒 30；展示台程序化 0 | 30 |

灵兽本体（活物）属于角色/生物管线，**不归本资产库**，坊内只做笼、桩、槽等静态件。万宝楼若定位为小镇地标，可升级为 hero 件走"概念图 → 图生 3D"流程（50–60 积分）。

---

## 4. 新增资产汇总与总账

### 4.1 本文建议追加的资产（合入 generation-plan 后生效）

| id | 分类 | 提示词方向 | 积分 | 服务建筑 |
|---|---|---|---|---|
| prop-yaogui-a | props/furniture | 中式百子药柜，整墙小抽屉格，宽2米高2.4米，深色木 | 40 | 灵草铺、丹阁 |
| prop-yaojia-a | props/furniture | 中式药架，多层搁板摆药罐，宽2米 | 30 | 灵草铺 |
| prop-yaoguan-a | props/furniture | 中式瓷药罐药瓶一组，单体孤立物件 | 30 | 灵草铺 |
| prop-yaojiu-a | props/cultivation | 中式药臼与药碾一组，铜石材质 | 30 | 灵草铺 |
| prop-hulu-a | props/cultivation | 大葫芦，束腰悬绳，单体孤立物件 | 30 | 灵草铺 |
| plant-lingcao-a/b/c | nature/plant | 发光灵草盆栽，矮瓷盆，叶色各异（三件） | 30×3 | 灵草铺、丹阁 |
| plant-yaocao-a | nature/plant | 药草丛一簇，低矮 | 30 | 灵草铺 |
| counter-shop-a | props/furniture | （程序化：长条木柜台 2×1×1m） | 0 | 全街商铺 |
| prop-liangyao-a | props/furniture | （程序化：竹匾晾药架） | 0 | 灵草铺 |
| prop-zao-a | props/furniture | 中式双眼灶台，砖砌灶体铁锅 | 40 | 灵食斋 |
| prop-zhelong-a | props/furniture | 竹蒸笼食盒堆叠一组 | 30 | 灵食斋 |
| prop-jiutan-a | props/street | 陶制酒坛堆垛一组 | 30 | 灵食斋 |
| prop-lingguo-a | props/furniture | 果盘与灵果一组 | 30 | 灵食斋 |
| prop-putuan-a | props/cultivation | 圆形蒲团坐垫，编织纹 | 30 | 丹阁 |
| prop-lingshideng-a | props/cultivation | 灵石灯，石座嵌发光晶体 | 30 | 丹阁 |
| prop-duanzao-a | props/cultivation | 中式锻造炉，砖石炉体，一侧风箱 | 40 | 炼器坊 |
| prop-tiezhen-a | props/cultivation | 铁砧，单体孤立物件 | 30 | 炼器坊 |
| prop-kuangshi-a | nature/rock | 矿石原石堆一簇 | 30 | 炼器坊 |
| workbench-a | props/furniture | （程序化：厚木工作台） | 0 | 炼器坊 |
| 淬火水槽 | props/cultivation | （程序化：石槽 + 木架） | 0 | 炼器坊 |
| prop-fujia-a | props/furniture | 晾符架，多层木格悬垂黄纸（纸面留白） | 30 | 符箓阁 |
| prop-biyan-a | props/furniture | 毛笔笔架与砚台一组 | 30 | 符箓阁 |
| prop-shulong-a | props/street | 木栅兽笼，一人高 | 40 | 灵兽坊 |
| prop-shuazhuang-a | props/street | 拴兽石桩，铁环 | 30 | 灵兽坊 |
| prop-baohe-a | props/ritual | 宝匣玉盒一组，开合陈设 | 30 | 万宝楼 |

### 4.2 积分总账

| 建筑 | 新增积分 | 主要计划件依赖 |
|---|---|---|
| 灵草铺 | 280 | W1 排门墙/幌子/货摊（约 180） |
| 灵食斋 | 130 | W2 酒楼整栋 40 + 家具 60；W1 灯笼幌子 |
| 丹阁 | 60 | W2 重檐 30 + 香炉 40；W3 丹炉 40 |
| 炼器坊 | 100 | W1 板门 30；W3 剑架 30 |
| 符箓阁 | 60 | 复用 W1 立面件 |
| 灵兽坊 | 70 | 复用已入库墙柱 |
| 云来客栈 | 0 | W1 客栈整栋 40 |
| 万宝楼 | 30 | W2 石狮 40；重檐或 W3 楼阁 |
| **合计** | **730** | 计划件已计入 generation-plan 的 2460 总预算 |

---

## 5. 生成顺序

依赖关系决定顺序，先后次序如下：

1. **W1 街面共用件**（排门墙、花格墙、幌子、灯笼、货摊、板门）——所有商铺立面的地基，一件解锁四栋楼
2. **灵草铺新增件**（药柜、药架、灵草盆栽等 280 积分）——第一栋示范店；百子柜定型后丹阁直接复用
3. **炼器坊 + 灵食斋新增件**（240 积分）——锻造炉、灶台等业态焦点
4. **W2 家具批**（八仙桌、太师椅、屏风）——全街室内一次性补齐
5. **丹阁新增件 + W3 焦点道具**（蒲团、灵石灯、丹炉、剑架）——重檐屋顶（W2）到位后拼楼
6. **扩展四栋**——本体全复用，只出差异件（190 积分）

按此顺序，第 2 步结束即可截第一张"灵草铺开业"验收图；第 4 步结束四栋重点建筑全部成型。

---

## 6. 每栋建筑的验收

在 generation-plan 执行检查单（余额、模板提示词、`-n 2`、三工位精修、schema 校验、preview.png）之外，建筑级加验四条：

- [ ] **远观识别**：立面截图缩到 25%，不看文字仍能认出业态（灵草铺看药摊葫芦、炼器坊看剑架）
- [ ] **室内动线**：入口 → 柜台 → 货架 → 焦点道具，走查一遍无穿模、无悬浮
- [ ] **材质核对**：无贴图件全部挂共享材质，全街木色/瓦色一致
- [ ] **文字贴花**：幌子文字全部引擎内 Label3D / Decal 实现，模型本身无字
