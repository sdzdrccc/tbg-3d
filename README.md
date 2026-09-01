# TBG-3D

> **Tripo + Blender + Godot 3D 资产管线** · 一套让 AI 用自然语言把「生成 3D 模型 → Blender 精调 → 导入 Godot」跑通的 Skill 套件。

TBG-3D 是面向 AI 编码助手（Codex、Claude Code、Cursor、Windsurf 等）的 **Codex Skill**。装上后，你只要说一句"给出生城做个中式门楼"，助手就能自动调用 **Tripo** 生成低模 → 在 **Blender** 打开精调 → 导入 **Godot** 场景，产出可用的游戏资产。

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
