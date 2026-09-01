---
name: tbg-3d
description: Use when the user types /tbg-set to configure or update the TBG-3D environment (pick Blender/Godot folders, install Tripo, configure blender-mcp/godot-mcp, auto-launch apps). Use when the user types /tbg-3d to generate a 3D asset via Tripo (text/image/multiview), refine in Blender, and import into a Godot project. Also trigger on requests to create a building/gate/prop/tree/weapon with Tripo, or to first install TBG-3D. Covers low-poly game assets.
---

# TBG-3D — Tripo + Blender + Godot 3D 资产管线

## Overview

一个自包含的 Codex/AI 助手 skill，把「**AI 生成 3D 模型 → Blender 精调 → 导入 Godot 场景**」整条链路跑通。

**核心原则**
1. **积分是硬门槛**：`tripo balance == 0` 时停下引导充值/领积分，绝不静默重试。
2. **逐步确认**：生成、精调、导入都「确认一步、走一步」。
3. **P1 低模优先**：游戏资产直接用 Tripo `tripo-p1`，不要先生成 `v3.1` 再减面（浪费积分）。
4. **Key 不进对话**：全程走 `tripo` CLI 本地凭证（`~/.tripo`）。

---

## 命令

### `/tbg-set`
配置 / 更新环境。运行 `node scripts/install.js`（交互选文件夹 → 装 tripo → 配 MCP → 自动启动 Blender/Godot）。用户随时可输入 `/tbg-set` 重新配置。

### `/tbg-3d`
生成 3D 模型入口。用户输入 `/tbg-3d` 后，展示三个选项：
1. **文本生成 3D**（默认）
2. **图像生成 3D**
3. **多视图生成 3D**
用户直接输入编号/关键词，或**回车=默认文本**。然后按对应模式走管线：
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

之后进入「Tripo 生成 → Blender 精调 → Godot 导入」流程（逐步确认）。

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
提示词/图片
  → P1 生成（tripo make…，先确认成本再执行）
  → Blender 打开（截图确认）
  → 精调（缩放/减面/材质/拆件，逐步确认）
  → 导出 GLB
  → Godot 实例化 + 碰撞 + 登记场景
  → 运行截图验收
```

### 生成（Tripo）
- 三种模式：文本 `tripo make "中式门楼"`；图片 `tripo make concept.png`；多视图 `tripo make front.png back.png left.png`（最精确）。
- 预设 `--for game-pc|game-mobile|anim|print`；P1 参数 `face_limit`（简单≥150、复杂≥250）、`texture`/`pbr`/`export_uv`。
- **模型 URL 5 分钟过期 → 任务成功立即下载**。

### Blender 精调
- 缩放/旋转/位移、减面（decimate）、补洞/合并（bmesh）、换材质（set_texture）、拆件。
- 先把模型放世界原点、单位（米）、面向 -Y（Godot 前向）。

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