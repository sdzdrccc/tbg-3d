---
name: tbg-set
description: Configure or update the TBG-3D environment — pick Blender/Godot folders, install Tripo CLI, configure blender-mcp/godot-mcp, auto-launch Blender/Godot. Use when the user wants to set up, install, update, or re-configure TBG-3D.
---

# TBG-3D 环境安装 / 配置（/tbg-set）

这是 TBG-3D 资产管线的**安装 / 配置入口**。生成、精修、打包走生产端，见 `tbg-3d` 技能。

## 定位仓库

TBG-3D 仓库以 `tbg-3d` 技能形式安装（junction 到仓库根），其 `scripts/install.js` 完成交互式安装：

- Windows：`C:\Users\Administrator\.codex\skills\tbg-3d` → `F:\zxc\Project\tbg-3d`
- 用 `<repo>/scripts/install.js` 运行。仓库根可由 `~/.codex/skills/tbg-3d` 解析。

## 执行步骤

1. 安装 / 配置：

   ```bash
   node ~/.codex/skills/tbg-3d/scripts/install.js
   ```

   依次会：
   1. 检测 Node ≥ 20。
   2. 让用户选择 **Blender**（含 `blender.exe`）、**Godot**（含 `Godot*.exe`）、**Godot 项目**（含 `project.godot`）文件夹（自动检测 + 交互输入）。
   3. 写入 `config.json` 记录选择。
   4. 安装并登录 **Tripo**（`npm install -g tripo-cli`；未登录提示 `tripo login --region ov|cn` 浏览器授权）。
   5. 把 **godot-mcp / blender-mcp** 写入 `~/.codex/config.toml`（Godot 9876 / Blender 9877，端口错开）。
   6. 配置完成后自动启动 Blender 与 Godot 编辑器。

   > 非交互：`--non-interactive`；跳过 Tripo：`--skip-tripo`；免自动启动：`--no-launch`；预演：`--dry-run`；指定项目目录：`--project-dir <路径>`。

2. 校验环境：

   ```bash
   node ~/.codex/skills/tbg-3d/scripts/verify.js
   ```

3. 若之前未装过，安装后提示用户重启 Codex / 新开会话，以便加载 MCP 与新技能。

## 分工

- 本技能只做**环境安装 / 配置**。
- 生成 3D 资产、Blender 精修、打包投递 → 使用 `tbg-3d` 技能（`/tbg-3d`）。
