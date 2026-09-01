# Godot-MCP / Blender-MCP 端口方案决策记录

> 背景：`godot-mcp`（MCP server）与 `blender-mcp`（Blender addon）**默认都监听 9876**，同机冲突。
> 本文记录三个候选方案、为何选 A，以及各方案的配置与回退。供 skill（`tbg-3d`）复现与日后调整。

---

## 0. 关键事实

- **godot-mcp 客户端（官方 `npx @yanhuifair/godot-mcp`）**：连接 Godot 编辑器插件用的端口在 `editor.js` 里 **写死 `EDITOR_PORT = 9876`**，不可通过 CLI/MCP 配置改。
- Godot 编辑器插件（`addons/godot-mcp/plugin.gd`）**从项目设置 `[godot_mcp] editor_port` 读取监听端口**，默认 9876。
- **blender-mcp**：MCP server（uvx）读环境变量 `BLENDER_PORT`（默认 9876）；Blender addon 读 `scene.blendermcp_port`（默认 9876）。
- godot-mcp 的**文件类工具（~220+）不需要编辑器桥**，直接用 `-p` 解析项目文件；只有**编辑器桥 / 运行时类（~150）**依赖连接 Godot 编辑器。

---

## 1. 三个候选方案

### 方案 A（已采用）：Godot 用 9876，Blender 挪 9877
- 把 Godot 项目设为 `godot_mcp/editor_port=9876`（与官方 server 写死的 9876 一致）。
- 把 Blender addon 默认端口改 9877，并给 `[mcp_servers.blender.env]` 设 `BLENDER_PORT=9877`（server 连 9877）。
- 结果：官方 godot-mcp **386 个工具全量可用**；Blender 走 9877。

**优点**：复用官方 godot-mcp 全部能力（编辑器桥 140 + 运行时 11），无需自写客户端。
**缺点**：要改 blender addon（侵入）+ 改协议环境变量；blender-mcp server 是 Codex 启动时注入 env，**需重启 Codex 才使 `BLENDER_PORT` 生效**。

### 方案 B（备选，未采用）：Godot 用自定义端口 + node 客户端直连
- 把 Godot 项目设为 `godot_mcp/editor_port=9880`，Blender 保持 9876。
- 用**自写的 node 客户端** TCP 直连 Godot 编辑器插件端口，自己做需要的命令。

**优点**：只改 `project.godot` 一处；不重启 Codex；不碰 Blender；主控权在自己手里。
**缺点**：官方 godot-mcp 的**编辑器桥/运行时 ~150 工具不可用**（server 写死连 9876）；需自维护一个 node 客户端，功能只到实现的子集。

### 方案 C（备选，未采用）：只用 godot-mcp 文件类工具
- 不连编辑器桥；导入模型/加碰撞/保存 `.tscn` 全靠 godot-mcp 的**文件类工具**（`read_scene`/`write_scene`/`create_resource` 等，~220+）。
- 端口无所谓（文件类不连编辑器端口）。

**优点**：最省、最稳、最可移植；不依赖编辑器桥、不挪 blender、不重启。
**缺点**：**没有编辑器实时能力**（无法运行游戏截图验收、实时选节点、visual shader、断点）。

---

## 2. 决策与理由

**采用方案 A。** 理由：
- skill 定位是"tripo → blender → godot 资产管线"，需要"把模型实例化进场景、加碰撞、**运行截图验收**"——要用到 godot-mcp 的**编辑器桥类工具**（如 `editor_instantiate_scene`、运行游戏截图），方案 A 能拿到完整 386 工具。
- 用户重视**可控可改**，方案 A 直接复用官方 MCP server，行为稳定、无需自写维护客户端。
- 方案 B / C 作为**备选记录**：若日后不想重启 Codex、或想完全自控，可切 B；若只需文件级导入，可切 C（成本最低）。

---

## 3. 方案 A 配置清单（复现用）

| 位置 | 设置 |
|---|---|
| `godot-client/project.godot` | `[godot_mcp] editor_port = 9876` |
| `blender addon`（`blender_mcp.py`/`addon.py`） | 默认 `scene.blendermcp_port = 9877` |
| `~/.codex/config.toml` | `[mcp_servers.blender.env] BLENDER_PORT = "9877"` |
| Godot 编辑器 | `-e --path <项目>` 打开，插件监听 9876 |
| Blender | 启动后 addon 监听 9877 |

**生效前提**：改完 `config.toml` 的 `BLENDER_PORT` 后，**重启 Codex** 让 blender-mcp server 读到新 env（连 9877）。不改 `config.toml` 时，blender server 仍连 9876（会撞 Godot），需保持两端口错开。

## 4. 回退

- blender addon：已有 `.bak-port` 备份，还原 `default=9877`→`9876` 即可。
- `config.toml`：备份 `.bak-tbg`，去掉 `BLENDER_PORT` 即回 9876。
- `project.godot`：删掉 `[godot_mcp] editor_port` 行 → 插件回默认 9876（与 server 一致）。