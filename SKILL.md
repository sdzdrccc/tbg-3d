---
name: tbg-3d
description: Use when the user types /tbg-3d to generate a 3D asset via Tripo (text/image/multiview) or import an external model file (Hunyuan GLB/FBX), refine in Blender, pack an asset package into tbg-assets inbox, and optionally import into a Godot project. Also trigger on requests to create a building/gate/prop/tree/weapon with Tripo, or to first install TBG-3D. For environment setup/configuration (pick Blender/Godot folders, install Tripo, configure blender-mcp/godot-mcp, auto-launch apps) use the /tbg-set command. Covers low-poly game assets.
---

# TBG-3D — 3D 资产生产线（Tripo/混元 → Blender 精修 → 资产包 → Godot）

## Overview

一个自包含的 Codex/AI 助手 skill，是 **tbg-assets 资产库的生产端**：
把「**AI 生成 3D 模型 → 分类 → Blender 精修 → 压缩 → 打包资产包**」整条链路跑通。

**分工契约（2026-09 重构，详见 tbg-assets/docs/RESTRUCTURE-PLAN.md）**
- tbg-3d = 生产端：生成 → 分类 → 精修 → 压缩 → 打包，输出**资产包**（model.glb + asset.json + source.json）
- tbg-assets = 仓储端：校验 → 入库 → 索引 → 展示（schema 权威方）
- 交接：资产包投递到 `<tbg-assets>/inbox/`，用户在仓储站网页预览确认入库

**核心原则**
1. **积分是硬门槛**：`tripo balance == 0` 时停下引导充值/领积分，绝不静默重试。
2. **逐步确认**：生成、精调、导入都「确认一步、走一步」。
3. **P1 低模优先**：游戏资产直接用 Tripo `tripo-p1`，不要先生成 `v3.1` 再减面（浪费积分）。
4. **Key 不进对话**：全程走 `tripo` CLI 本地凭证（`~/.tripo`）。
5. **生成前先查库**：同类构件若 tbg-assets 已有，优先复用库内资产，不重复生成。

**pipeline/ 目录**
- `origin-rules.md` — 轴心/朝向规范（精修强制执行）
- `material-map.json` — 生成材质 → tbg-assets 共享材质映射表
- `prompts/` — 各品类标准提示词模板
- `generation-plan.md` — 分波次生成计划与积分预算
- `scripts/pack.js` — 打包资产包 + 投递 inbox。category/面数预算优先从 tbg-assets 的 schema 与 kit.json 派生；投递前复用 tbg-assets 的 `lib/schema.js` 过 schema 校验；同 id 覆盖、异 id 报错（不再 rm -rf）
- `scripts/classify.js` — 文件名关键词分类（权威版；tbg-assets 网页侧仅有降级副本）
- `scripts/gen-primitives.js` / `gen-materials.js` — 程序化 primitive 与共享材质生成
- `scripts/fix-scale.js` — 修混元 FBX 转 GLB 的 100 倍单位缩水
- `refine/refine.py` — Blender 端精修脚本（经 blender-mcp 执行）
- `refine/render-preview.py` — Blender 无头精修+预览：缩放归一/轴心底部中心/减面 + 渲染 preview.png（`blender --background --python render-preview.py -- <config.json>`）
- `refine/bake-lowpoly.py` — 高模→低模烘焙：remesh 熔成实体 + 智能展UV + 烘焙基色/法线，适合「离散小岛细瓦高模」得到低模+法线（MMO 友好）

---

## 命令

### `/tbg-set`
配置 / 更新环境。运行 `node scripts/install.js`（交互选文件夹 → 装 tripo → 配 MCP → 自动启动 Blender/Godot）。用户随时可输入 `/tbg-set` 重新配置。

### /tbg-hub
启动 tbg-assets 仓储站网页（node tools/hub/server.js），预览并确认 pack.js 投递到 inbox/ 的资产包。用户输入 /tbg-hub 后启动服务并打开 http://localhost:8788。

### `/tbg-3d`
生成 3D 模型入口。用户输入 `/tbg-3d` 后，展示四个选项：
1. **文本生成 3D**（默认，Tripo）
2. **图像生成 3D**（Tripo）
3. **多视图生成 3D**（Tripo，最精确）
4. **外部模型文件**（混元3D 等网页工具生成后拖入对话；GLB 直接进精修，FBX 先 fix-scale）

用户直接输入编号/关键词，或**回车=默认文本**。前三种按 Tripo 模式走管线：
- 文本：`tripo make "提示词"`

**文本输入要求（官方）**：
- `prompt` 必填，**≤1024 字符**；描述形状/材质/风格/尺寸。
- 空泛描述效果差（如 "一个箱子"）；加入材质+风格能提升 PBR 效果。
- 可选 `negative_prompt`（≤255 字）排除不想要的内容。
- 图像：`tripo make <图片路径>`

**图像输入要求（官方）**：
- `input` 必填；可用本地图 / URL / file_token。
- 主体**清晰、背景干净、遮挡少**；格式 PNG / JPEG / WebP。
- **最大 20 MB**，推荐 **≥256×256px**。
- 可选 `enable_image_autofix` 自动优化低质量图。
- 多视图：`tripo make <前> <后> <左> <右>`（最精确）

**多视图输入要求（官方）**：
- 视角顺序：**正面、左侧、背面、右侧**（front / left / back / right）。服务端规范 [正、左、背、右]。
- **正面不可省略**，其余视角可省，但**至少 2 张**。
- 同一物体、**一致光照**；格式 PNG / JPEG / WebP；推荐 **≥256×256px**。
- 缺的视角传空（`""`）；图片可用本地路径 / 上传后的 URL / file_token。

之后进入「生成 → 分类 → Blender 精修 → 压缩 → 打包投递」流程（逐步确认）。

**混元3D 路线（选项 4）**：
- 用户在混元网页生成（面数默认选 **500k**，简单件 50k；贴图 2K 足够）；
- **优先选带纹理 GLB 导出**；无纹理只有 FBX/STL/USDZ，FBX 有 100 倍缩放坑；
- 用户把文件拖入对话时**附带分类说明**（如"悬山顶单檐，入 components/roof"）——分类元数据在源头写准，不靠文件名猜；
- FBX 处理：FBX2glTF 转 GLB → `node pipeline/scripts/fix-scale.js` 修缩放 → 进精修。

---
## Part 1 — 环境安装（首次）

```bash
# 装到 skills 目录后运行（macOS/Linux 用 $HOME，Windows 用 %USERPROFILE%）
node scripts/install.js        # 交互式：选 Blender/Godot 文件夹 + 项目，装 tripo，写 MCP 配置
node scripts/verify.js         # 检查环境是否就绪
```

`install.js` 会依次：
1. 检测 Node ≥ 20。
2. 让用户选择 **Blender**（含 `blender.exe`）、**Godot**（含 `Godot*.exe`）、**Godot 项目**（含 `project.godot`）文件夹（自动检测 + 交互输入）。
3. 写入 `config.json` 记录选择。
4. 安装并登录 **Tripo**（`npm install -g tripo-cli`，未登录提示 `tripo login --region ov|cn` 浏览器授权）。
5. 把 **godot-mcp / blender-mcp** 写入 `~/.codex/config.toml`（Godot 9876 / Blender 9877，端口错开）。
6. 配置完成后，`install.js` 会**自动启动 Blender 与 Godot 编辑器**（可用 `--no-launch` 关闭）。

命令行参数：`--non-interactive`（不询问，用检测值）、`--project-dir <路径>`、`--skip-tripo`、`--dry-run`。

---

## Part 2 — 资产生成管线（日常使用）

用户说一句，AI 按以下流程执行：

```
提示词/图片/外部模型文件
  → 生成（Tripo P1 或混元，先确认成本再执行）
  → 分类：与用户确认 id / 分类 / tier / 中文名（对话语义直接定）
  → 精修：blender-mcp 执行 pipeline/refine/refine.py
      （轴心/朝向/法线/材质槽映射，按 pipeline/origin-rules.md）
  → 压缩：gltf-transform 减面 + 贴图 ≤1024（primitive 跳过）
  → 打包：node pipeline/scripts/pack.js → 资产包投递 <tbg-assets>/inbox/
  → 提示用户去仓储站网页（node tools/hub/server.js）预览确认入库
  →（可选）Godot 实例化 + 碰撞 + 登记场景 → 运行截图验收
```

**tier 分流**：
- `primitive`（程序化几何）：`gen-primitives.js` 直接打包，免精修免减面
- `component` / `mass`（AI 构件）：走完整管线，refine.py 脚本精修
- `hero`（核心件）：人工 Blender 精修替代脚本，其余相同

### 生成（Tripo）
- 三种模式：文本 `tripo make "中式门楼"`；图片 `tripo make concept.png`；多视图 `tripo make front.png back.png left.png`（最精确）。
- 预设 `--for game-pc|game-mobile|anim|print`；P1 参数 `face_limit`（简单≥150、复杂≥250）、`texture`/`pbr`/`export_uv`。
- **模型 URL 5 分钟过期 → 任务成功立即下载**。

### Blender 精修（保真优先，2026-09 重定）
- **不追求过度压面**：目标面数 = 该 tier 预算，`polycount` 取 **GLB 三角面数**（`REFINE_DONE tris=`）。
- **薄壳先封底**：源是开放壳 / 单面（瓦片壳、薄屋顶等）时设 `solidify_m`（如 0.05m）加厚再减面，避免镂空（`boundary=0`）。
- **tier 按最终三角面选**：对照 `kits/<kit>/kit.json` 的 `budgets`（primitive 5000 / component 20000 / mass 50000 / hero 100000）取 ≤ 预算的最高档，避免误标。
- 规范：单位（米）、轴心底部中心、面向 -Y（Blender 前向，导出后 = glTF -Z）——细则见 `pipeline/origin-rules.md`。
- 无头路径：`render-preview.py`（`blender --background --python render-preview.py -- <config.json>`）——批量自动精修 + 预览 + 贴图 ≤1024。
- 烘焙路径：`bake-lowpoly.py`（`blender --background --python bake-lowpoly.py -- <config.json>`）——源为**几千离散小岛的细瓦高模**时用：低模 remesh 熔成实体 + 烘焙基色/法线，得到**低面数 + 实心 + 瓦纹靠法线**（如 xieshan 屋顶 16000 面/component）。
- 交互路径：`refine.py`（改 CONFIG 后经 blender-mcp execute_code 运行）——hero 件人工精修；材质槽按 `material-map.json` 映射（无映射打 `needs-material-review`）。

### 导入 Godot
- 用 godot-mcp 文件/编辑器工具把 `model.glb` 实例化进目标场景，加碰撞（Box/Capsule/Convex），保存 `.tscn`。
- 登记地图注册表 `sceneId → .tscn`。

---

## 模型与生成模式（速查）

| 模式 | 示例 |
|---|---|
| 文本转 3D | `tripo make "中式门楼"` |
| 图片转 3D | `tripo make concept.png` |
| 多视图转 3D | `tripo make front.png back.png left.png` |

**选择**：游戏/移动端低模 → `tripo-p1`（48–20k 面，拓扑干净）；精细展示 → `tripo-v3.1`。
P1 成本：文本→3D 无贴图 30 / 标准 40 / 高清 50（图片、多视图 40/50/60）。

---

## 端口方案（方案 A）

| 组件 | 端口 | 配置 |
|---|---|---|
| Godot 编辑器桥 | 9876 | `project.godot` `[godot_mcp] editor_port=9876` |
| Blender | 9877 | blender addon 默认 9877 + `BLENDER_PORT=9877` |

> Godot-MCP 客户端写死连 9876，Blender 挪 9877 错开。三方案对比/回退见 `docs/18-godot-mcp-port-decision.md`。

---

## 错误恢复

| 现象 | 处理 |
|---|---|
| `balance=0` | 暂停；`tripo topup` 或领积分；不重试 |
| 生成失败 | 积分退回 → `tripo redo` 换种子 |
| Blender 未连接 | 让 install.js 自动拉起（或手动启动）+ 确认 addon 启用 |
| Godot 未打开 | 让 install.js 自动打开项目；文件工具不受影响 |
| 导入穿模/比例错 | 回 Blender 精调后重新导出 |

---

## 安全

1. 生成扣积分 → 先展示提示词&成本，同意后执行。
2. 不把 `tsk_…` 贴进对话/日志/仓库。
3. 单账号约束：task_id 与账号绑定，流程中不切换账号。
4. 逐步确认，不让 AI 一口气连续做很多看不见的动作。