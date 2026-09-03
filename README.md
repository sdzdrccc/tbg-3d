# TBG-3D

> **3D 资产生产线** · 一套让 AI 用自然语言把「生成 3D 模型 → Blender 精修 → 打包资产包 → 导入 Godot」跑通的 Skill 套件。

TBG-3D 是面向 AI 编码助手（Codex、Claude Code、Cursor、Windsurf 等）的 **Codex Skill**。装上后，你只要说一句"给出生城做个中式门楼"，助手就能自动调用 **Tripo** 生成低模（或接收混元等外部工具生成的模型文件）→ 在 **Blender** 精修 → 打包成标准**资产包**投递到 [tbg-assets](https://github.com/sdzdrccc/tbg-assets) 资产库，或直接导入 **Godot** 场景。

> **生产/仓储分工（2026-09 重构）**：TBG-3D 是**生产端**（生成 → 分类 → 精修 → 压缩 → 打包），[tbg-assets](https://github.com/sdzdrccc/tbg-assets) 是**仓储端**（校验 → 入库 → 索引 → 展示）。两项目通过「资产包」（model.glb + asset.json + source.json）解耦，schema 权威在 tbg-assets。完整方案见 tbg-assets 的 `docs/RESTRUCTURE-PLAN.md`。
>
> `pipeline/` 目录：轴心规范（origin-rules）、材质映射表（material-map）、提示词模板、生成计划、打包脚本（pack.js）、Blender 精修脚本（refine/refine.py）、混元 FBX 缩放修正（fix-scale.js）等生产工具。

---

## 特性

- **三组件一键打通**：Tripo（AI 生成）+ Blender（精调） + Godot（落地）
- **自动环境安装**：`tbg-3d` 让用户选 Blender/Godot 文件夹，安装并登录 Tripo，配置 blender-mcp / godot-mcp，最后 `verify` 一键检查全绿
- **端口冲突自动规避**：Godot 编辑器桥 9876，Blender 9877，错开互不抢占；Godot-MCP 386 个工具全量可用
- **P1 游戏低模优先**：默认 Tripo P1（48–20,000 面，10–60s，拓扑干净），不为"先高模再减面"浪费积分
- **多模式生成**：文本 / 图片 / 多视图三种输入；支持 LOD、贴图、转格
- **可逆可回退**：所有 Godot 场景改动进原生撤销栈（Ctrl+Z）；配置改动留 `.bak` 备份
- **渐进确认**：生成、精调、导入都"确认一步、走一步"，不让 AI 闷头连续做一堆看不见的动作

---

## 这是什么

| Skill | 作用 |
|---|---|
单个自包含 skill：首次「环境安装」（选文件夹、装 Tripo、配 MCP），平时「资产管线」（Tripo 生成 → Blender 精调 → Godot 导入）。


---

## 依赖

| 组件 | 要求 |
|---|---|
| Node.js | ≥ 20 |
| Blender | 4.x（需启用 blender-mcp addon） |
| Godot | 4.x（.NET/mono 版；需打开项目） |
| Tripo | 一个账号 + 积分（生成模型消耗；cn / ov 区均可） |
| AI 助手 | Codex / Claude Code / Cursor 等（需支持 MCP + Skills） |

---

## 安装（以 Codex 为例）

把两个 skill 放到助手的 skills 目录（Codex：`~/.codex/skills/`）：

```bash
git clone https://github.com/sdzdrccc/tbg-3d
cp -R tbg-3d ~/.codex/skills/tbg-3d

```

> 注：`tbg-3d` 作为环境安装器，首次需要让用户选择 Blender / Godot 文件夹，并安装登录 Tripo。

### 安装环境

```powershell
# 在 Codex 里让 AI 执行：
node "$HOME/.codex/skills/tbg-3d/scripts/install.js"
# 之后随时检查：
node "$HOME/.codex/skills/tbg-3d/scripts/verify.js"
```

> install.js 配置完成后会**自动启动 Blender 与 Godot 编辑器**（可用 `--no-launch` 关闭）。

---

## 使用

在新会话里自然语言触发即可（无需记命令）：

```text
给出生城做一个中式门楼，青瓦飞檐，放进 Godot 场景
用 Tripo 生成一棵松树，导入 Godot 并加碰撞
把 concept.png 变成 3D，保存到 ./assets
基于刚才的模型，再做一个 1500 面的 LOD
```

AI 会按 `tripo-asset-pipeline` 走：

```
提示词/图片
  → Tripo P1 生成（先确认成本，再执行）
  → Blender 打开（截图确认）
  → 精调（缩放/减面/材质/拆件，逐步确认）
  → 导出 GLB
  → Godot 实例化 + 碰撞 + 登记场景
  → 运行截图验收
```

---

## 架构

```
用户自然语言
   │
   ├─ tbg-3d（环境安装）
   │    ├─ 选 Blender / Godot 文件夹
   │    ├─ 安装并登录 tripo-cli（浏览器 OAuth，不落地 Key）
   │    └─ 写 Codex config.toml：blender-mcp + godot-mcp（端口错开 9876/9877）
   │
   └─ tripo-asset-pipeline（资产管线）
        ├─ tripo make "..."（P1 / text·image·multiview）
        ├─ blender-mcp：导入、精调、导出
        └─ godot-mcp：实例化、碰撞、保存 .tscn
```

### 端口方案（方案 A）

| 组件 | 端口 | 配置 |
|---|---|---|
| Godot 编辑器桥 | 9876 | `project.godot` `[godot_mcp] editor_port=9876` |
| Blender | 9877 | addon 默认 9877 + `BLENDER_PORT=9877` |

> 背景：Godot-MCP 客户端写死连 9876。完整三方案对比（A/B/C）与回退见 `docs/18-godot-mcp-port-decision.md`。

---

## 项目结构

```text
tbg-3d/
├── SKILL.md                          # 主技能：/tbg-3d 资产管线全流程（生成→分类→精修→压缩→打包→投递 inbox）
├── config.json                       # 本机环境配置：Blender/Godot 路径、Godot 项目、assets_repo（install.js 写入；已 gitignore 不入库）
├── LICENSE                           # MIT；脚本不含任何 API Key（Tripo 凭证存本地 ~/.tripo）
├── .gitignore                        # 忽略 config.json / .tripo 凭证 / tripo-out / tmp 等本地产物
│
├── cmd/                              # 子命令技能
│   ├── tbg-set/SKILL.md              # /tbg-set：环境安装与配置入口（引导 install.js + verify.js）
│   └── tbg-hub/SKILL.md              # /tbg-hub：启动 tbg-assets 仓储站网页（:8788）预览并确认入库
│
├── scripts/                          # 环境安装（首次使用）
│   ├── install.js                    # 交互式安装器：选 Blender/Godot 文件夹 → 装 tripo-cli → 写 MCP 配置 → 自动启动
│   └── verify.js                     # 环境自检：Node / Blender / Godot / Tripo 登录 / MCP 配置逐项检查
│
├── pipeline/                         # ★ 生产管线（日常资产生产核心）
│   ├── prompts/
│   │   └── cn-ancient.md             # 中式古风提示词模板：全局风格锚 + 构件/整栋/英雄件三类模板 + 尺寸速查
│   ├── generation-plan.md            # 分波次生成计划与积分预算（Wave 0–3 合计约 2460 积分；Wave 0 已完成）
│   ├── building-assets.md            # 修仙小镇建筑资产需求清单：每栋楼的构件 BOM、资产状态、优先级、生成顺序
│   ├── origin-rules.md               # 轴心与朝向规范（1u=1m、底部中心、-Z 朝前）：精修脚本强制执行的标准
│   ├── material-map.json             # 生成材质 → 共享材质映射表：byCategory 默认映射 + byKeyword 材质槽识别
│   ├── refine/                       # Blender 精修脚本（按源模型选路径）
│   │   ├── refine.py                 # 交互精修：导入→单位归一→法线→轴心→材质槽重命名→导出 GLB（blender-mcp 执行）
│   │   ├── render-preview.py         # 无头精修+预览：缩放归一/减面/薄壳加厚 + 渲染 preview.png（blender --background）
│   │   └── bake-lowpoly.py           # 高模→低模烘焙：remesh 熔实体 + 智能展 UV + 烘焙基色/法线（离散小岛细瓦高模专用）
│   └── scripts/                      # 生产端 Node 脚本
│       ├── pack.js                   # 打包资产包（model.glb + asset.json + source.json）投递 tbg-assets/inbox；过 schema 校验才发
│       ├── classify.js               # 文件名关键词分类器（权威版；tbg-assets 网页侧仅持降级副本）
│       ├── gen-primitives.js         # 程序化生成 primitive 构件（台基/台阶/墙/柱/地砖，0 积分，gltf-transform 建模）
│       ├── gen-materials.js          # 从参数表生成共享材质库（18 种 .tres + index.json，直写 tbg-assets 仓库）
│       └── fix-scale.js              # 修混元3D FBX 转 GLB 的 100 倍单位缩水（缩放顶点与节点，重算包围盒）
│
├── docs/                             # 设计决策文档
│   ├── 17-skill-asset-pipeline.md    # 资产管线完整设计方案（三工位流程）
│   ├── 18-godot-mcp-port-decision.md # Godot-MCP 端口三方案（A/B/C）对比与回退决策
│   └── OPTIMIZATION.md               # 生产端优化记录（Windows 兼容修复、schema 单一真源等）
│
└── .github/
    └── workflows/ci.yml              # CI：push/PR 触发 scripts/ 与 pipeline/scripts/ 全部 JS 语法检查
```

---

## 模型与生成模式（速查）

| 模式 | 示例 |
|---|---|
| 文本转 3D | `tripo make "中式门楼"` |
| 图片转 3D | `tripo make concept.png` |
| 多视图转 3D | `tripo make front.png back.png left.png`（最精确） |

**模型选择**：游戏/移动端低模 → `tripo-p1`（48–20k 面，拓扑干净）；精细展示 → `tripo-v3.1`。
P1 成本：文本→3D 无贴图 30 / 标准贴图 40 / 高清 50（图片、多视图 40/50/60）。

---

## 文档

- `docs/17-skill-asset-pipeline.md` — 资产管线完整设计方案
- `docs/18-godot-mcp-port-decision.md` — 端口三方案决策与回退

---

## 版权与许可

MIT License（见 `LICENSE`）。脚本内不含任何 API Key；Tripo 凭证保存在本地 `~/.tripo`，**不会写入仓库**。

---

## 贡献

欢迎提 Issue / PR。请勿在 issue 或 commit 中粘贴任何 API Key、账号凭据。
### 跨平台说明

脚本用 Node.js 编写，跨平台（macOS / Linux / Windows）。调用：

```bash
# macOS / Linux
node "$HOME/.codex/skills/tbg-3d/scripts/install.js"
node "$HOME/.codex/skills/tbg-3d/scripts/verify.js"

# Windows (PowerShell)
node "$env:USERPROFILE\.codex\skills\tbg-3d\scripts\install.js"
node "$env:USERPROFILE\.codex\skills\tbg-3d\scripts\verify.js"
```

> 提示：`install.js` 自带有交互式路径询问；若无 GUI 可用 `--non-interactive`，或用 `--project-dir <路径>` 指定项目。

### Windows 已知问题（已修复）

1. **Godot exe 误配为 `GodotSharp` 目录**：`findGodotExe` 原正则 `/^Godot.*\.exe$|^Godot.*$/i` 会匹配以 `Godot` 开头的**目录**（如 `GodotSharp`），导致 `godot_exe` / `GODOT_PATH` 指向目录而非 `.exe`，自动启动 Godot 时 `ENOENT`。已改为仅匹配 `Godot*.exe` 且 `statSync(...).isFile()`，并优先非 console 版本。
2. **Node 在 Windows 无法直接 spawn npm 全局 `tripo`（`.cmd` 包装）**：`spawnSync('tripo', ...)` 报 `ENOENT`，被误判为“未登录”。已为 install.js / verify.js 的 tripo 调用加 `shell: process.platform === 'win32'`。
