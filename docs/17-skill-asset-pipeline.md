# Skill 设计方案：Tripo → Blender → Godot 3D 资产管线

> 定位：让用户在 Codex 里用一句自然语言，就能把「生成 3D 模型 → 打开精调 → 导入 Godot 场景」整条链路跑通。
> 本文只做方案与流程设计，不含实现代码。落成真正的 Skill 见文末「实施建议」。

---

## 0. 一句话目标

**用户说一句话**（例如"给出生城做一个中式门楼"）→ Skill 自动调用 **Tripo** 生成模型 → 在 **Blender** 里打开并精调 → 导入 **Godot** 项目，成为可用场景节点。

配套三大组件（当前已就绪情况见第 2 节）：
- **Tripo**（AI 生成模型）：`tripo` CLI，已登录 cn 区，`tripo make` 出 GLB。
- **Blender MCP**：`mcp__blender__*` 工具，负责「打开、可视化、精调、导出」。
- **Godot MCP**：`mcp__godot_mcp__*` 工具，负责把 GLB 做成场景节点、加碰撞、接进主流程。

---

## 1. Skill 元信息（frontmatter 建议）

```yaml
---
name: tripo-asset-pipeline
description: >-
  Generate a 3D asset from a text/image prompt using Tripo, open and refine it in Blender, then
  import it into the Godot project as a usable scene node. Use when the user wants a new 3D model
  (building, prop, tree, weapon, character prop) created and dropped into the xiuxian-mmo Godot
  scene. Supports prompt→model, refine→export→import. Check Tripo balance and Blender/Godot
  connectivity first.
---
```

> 说明：`description` 用英文，便于 Codex 调度器根据用户意图自动匹配；正文可用中文。

---

## 2. 前置条件检查（Skill 一进入就做；一项不过即停下引导）

| 组件 | 检查命令/工具 | 通过标准 | 失败处理 |
|---|---|---|---|
| Node | `node -v` | ≥ 20 | 引导装 LTS |
| Tripo 登录 | `tripo whoami` | `region=cn` | `tripo login --region cn` |
| **Tripo 积分** | `tripo balance` | `balance > 0` | `tripo topup` 或领免费积分；**余额 0 直接暂停，不扣费** |
| Blender | `mcp__blender__get_scene_info` | 能返回场景 | 提示启动 Blender + 启用 `blender-mcp` addon |
| Godot | `mcp__godot_mcp__get_status` | 编辑器桥 or 文件工具可用 | 提示打开 Godot 项目；文件工具无需编辑器 |

**关键安全点**：只要 `tripo balance == 0`，Skill 应停在检查阶段并输出充值引导，**绝不静默重试**。

---

## 3. 总流程（5 阶段）

```
用户提示词
  │
  ▼
Phase 1  Tripo 生成      tripo make "…" / --for game-pc / --then texture,convert:glb
  │
  ▼
Phase 2  Blender 打开    import .glb → 截图给用户确认
  │
  ▼
Phase 3  精调            缩放/减面/材质/拆件（进度截图对比）
  │
  ▼
Phase 4  导出            导出 GLB/GLTF，校验尺寸/单位/面数
  │
  ▼
Phase 5  导入 Godot      建 MeshInstance + 碰撞 + 挂到目标场景
  │
  ▼
Phase 6  验收            运行截图：无穿模、比例对、性能可接受
```

---

## 4. 分阶段详细流程 + 工具映射

### Phase 1 — Tripo 生成
- **入口工具**：`tripo make "<提示词>"`（文字）；`tripo make <tupian1> <tupian2>`（图片/多视图）；`tripo make <hero.glb> --then texture,rig`（已有模型继续做）。
- **生成模式（三种输入）**：文本 `tripo make "提示词"`；图片 `tripo make concept.png`；多视图 `tripo make front.png back.png left.png`（最精确）。
- **文本输入要求**：`prompt` ≤1024 字；描述形状/材质/风格/尺寸；空泛描述效果差；可选 `negative_prompt`（≤255 字）。
- **图像输入要求**：`input` 必填（本地图/URL/file_token）；主体清晰、背景干净、遮挡少；PNG/JPEG/WebP；**≤20MB、≥256×256px**；可选 `enable_image_autofix`。
- **多视图输入要求**：顺序 正/左/背/右；**正面必给**、至少 2 张；同一物体、一致光照；PNG/JPEG/WebP、**≥256×256px**；缺视角传空。
- **模型选择（默认 tripo-p1）**：游戏/移动端低模**直接 `tripo-p1`**，不要先用 `tripo-v3.1` 再减面（浪费积分）；仅「精细/贴脸展示」才用 `tripo-v3.1`。
- **预设 / 参数**：`--for game-pc | game-mobile | anim | print`；P1 可配 `face_limit`（简单≥150、复杂≥250）、`texture`、`pbr`、`export_uv`；**模型 URL 5 分钟过期，任务成功立即下载**。
- **成本预估（并入下方确认点）**：P1 文本→3D 无贴图 30 / 标准贴图 40 / 高清贴图 50（图片、多视图 40/50/60）。
- **输出**：默认落在 `tripo-out/<task>/`，含 `model.glb`、`preview.png`、`task.json`。
- **资产归置**：复制到 `godot-client/assets/generated/<category>/<name>/`。
- **用户确认点（必停）**：生成会消耗积分 —— 先展示提示词 & 预估成本，**用户同意后再执行**；一次要多个模型时逐项确认。
- **等待**：`tripo task get/watch`（阻塞命令，等进程结束，不要自写轮询）；`preview.png` 给用户查看。

### Phase 2 — Blender 打开
- 前置：确认 `mcp__blender__get_scene_info` 可连；未连则提示启动 Blender 并启用 addon。
- 导入：用 blender-mcp（`import` 或 `execute_blender_code` 执行 `bpy.ops.import_scene.gltf(filepath=...)`）。
- 校验：`get_scene_info` 确认模型进入；`get_viewport_screenshot` 截图给用户。
- **用户确认点**：模型进来了、方向/大小是否可接受。

### Phase 3 — 精调（按用户要求，逐步确认）
常见需求 → 工具映射：
| 需求 | blender-mcp 工具 |
|---|---|
| 缩放/旋转/位移 | `execute_blender_code`（transform） |
| 减面/优化 | `execute_blender_code`（decimate / planar decimate） |
| 补洞/合并/修法线 | `execute_blender_code`（bmesh） |
| 换/贴材质 | `set_texture` / material（Polyhaven 纹理） |
| 拆分成多个部件 | `execute_blender_code`（分离） |
| 查看对比 | `get_viewport_screenshot` |

- 每做一步就截图对比一次；**用户确认目标**（改比例？材质？拆哪个部件？）。
- 建议先在 Blender 里把模型摆到世界原点、统一单位（米）、面向 -Y（Godot 前向）。

### Phase 4 — 导出 / 转换
- blender-mcp 导出：`bpy.ops.export_scene.gltf(filepath=..., export_format='GLB')`。
- 或走 tripo 转换：`tripo make @last --then convert:fbx|obj|stl`。
- **校验**：导出后的尺寸、单位、三角面数、是否应用了变换。

### Phase 5 — 导入 Godot
- **方式 A（标准）**：用 godot-mcp 文件工具，把 `model.glb` 放进 `godot-client/assets/generated/<name>/`，Godot 自动导入为 `PackedScene`；再用 `editor_instantiate_scene`/`create_resource` 把它实例化到目标场景（如 `ProtoSpawnCity.tscn`）。
- 加碰撞：`create_collision_polygon` / `set_collision_shape`（Box/Capsule/Convex）。
- 挂材质、调整位置朝向。
- **对接主流程**：在 `scripts/WolrdScene.cs`/`Main.cs` 地图注册表里登记 `sceneId → .tscn`，让出生新城用这套资产。

### Phase 6 — 验收
- `editor_get_open_scene` + 编辑器截图（`editor_take_screenshot`）或运行游戏截图。
- 验收点：不穿模、比例与主流 MMO 观感、性能（面数/材质数）可接受。

---

## 5. 错误恢复表

| 现象 | 处理 |
|---|---|
| `balance=0` | 暂停；`tripo topup` 或领免费积分；**不要重试** |
| Tripo 生成失败 | 积分自动退回 → `tripo redo` 换种子 |
| `tripo task` 超时/网络错 | 确认代理 `http://127.0.0.1:7890`，重跑同命令 |
| Blender 未连接 | 启动 Blender + 启用 `blender-mcp` addon |
| Godot 未打开 | 打开项目；文件工具不受影响 |
| 导入穿模/比例错 | 回 Phase 3 精调后重新导出 |
| 中文提示词乱码 | Windows Terminal；`chcp 65001`；PowerShell 下 `@last`、逗号加引号 |
| 要多个模型 | 一次一个，逐项确认成本后再做 |

---

## 6. 资产路径与命名约定

```
godot-client/
  assets/generated/
    building/<name>/model.glb
    prop/<name>/model.glb
    nature/<name>/model.glb
    ...
```

- `<name>` 用 `snake_case`；同一物件做 LOD 时加后缀 `<name>_lod1.glb`。
- 每个模型一份 `task.json` 记录生成参数，便于回溯/重做。
- Godot 侧物件抽象进 `scenes/props/`，再用地图注册表登记 `sceneId → .tscn`。

---

## 7. 边界与安全

1. **扣积分必须确认**：生成前展示提示词&成本，获同意才执行；失败积分自动退。
2. **Key 不进对话/日志/截图**：整条链路走 `tripo` CLI 的本地凭证（`~/.tripo`），不把 `tsk_…` 贴进聊天。
3. **单账号约束**：task_id 与账号绑定，换 key 后旧任务失效；不要在流程中切换账号。
4. **逐步确认**：精调、导入、生成都是「确认一步、走一步」，不让 Skill 一口气连续做很多看不见的动作。

---

## 8. 验收标准（每阶段 exit）

| 阶段 | 可验证产出 |
|---|---|
| P1 生成 | `task.json` + `model.glb` + `preview.png` 存在；面数在预算内 |
| P2 打开 | Blender 场景中已出现模型，截图可见 |
| P3 精调 | 用户对截图确认 |
| P4 导出 | 导出 GLB 成功；尺寸/单位/朝向正确 |
| P5 导入 | Godot 场景出现 `MeshInstance3D`，可运行、有碰撞 |
| P6 验收 | 运行截图无穿模/比例问题 |

---

## 9. 实施建议（把本设计做成真正 SKILL.md）

1. 目录：`C:/Users/Administrator/.codex/skills/tripo-asset-pipeline/SKILL.md`
2. 规范：参考已装的 `writing-skills` / `writing-for-agents` 约束 frontmatter 与结构。
3. 推荐脚本：`scripts/ensure_env.ps1`（三组件就绪检查）、`scripts/gen_tripo.ps1`（封装 `tripo make` + 资产归置）、`scripts/import_godot.ps1`（拷贝 GLB + 生成 .tscn 引用）。
4. 先在 `godot-client/scenes/props/` 抽好 `Prop` 基类与地图注册表，再让 Skill 直接往里面放，减少重复。
5. 第一个端到端试点建议：**出生城（ProtoSpawnCity）的门楼** —— 规模小、价值高、便于验证全链路。
---

## 附录 A：Tripo 模型与三种生成模式速查

### 三种生成模式（按输入方式）

| 模式 | CLI 命令示例 | 适用场景 |
|---|---|---|
| 文本转 3D | `tripo make "中式门楼，青瓦飞檐"` | 凭描述凭空造，最快 |
| 图片转 3D | `tripo make concept.png` | 有指定造型/风格参考 |
| 多视图转 3D | `tripo make front.png back.png left.png` | 多角度拼合，最精确 |

> 三种模式对应 API 端点：`text-to-model` / `image-to-model` / `multiview-to-model`。

### 模型选择（游戏资产管线关键决策）

| 模型 | 面数 | 耗时 | 定位 | 备注 |
|---|---|---|---|---|
| **tripo-p1** | 48–20,000 | ~10s 无贴图 / ~60s 带贴图 | **游戏/移动端低模首选** | 拓扑极干净；不支持 `quad`/`smart_low_poly`/`generate_parts` |
| **tripo-v3.1** | 高 | 10–120s | 精细高质量、近看物体 | 默认；积分更贵 |

**决策原则（重要）**：
- 目标 = **游戏资产 / 低模 / 实时** → 直接 `tripo-p1`，**不要**先生成 `v3.1` 再减面——那是浪费积分。
- 目标 = **精细展示 / 贴脸看 / 高质量** → `tripo-v3.1`。
- 成本由「模型 + 贴图」决定：P1 文本→3D 无贴图 **30** / 标准贴图 **40** / 高清贴图 **50**（图片、多视图为 40/50/60）积分。

### P1 关键参数
- `face_limit`：建议简单物 ≥150、复杂物 ≥250，上限 20000。
- `texture`（默认 true）、`pbr`（默认 true）、`export_uv`（UV 展开）。
- **并发限制**：P 系列 3 个并行任务。
- **模型 URL 5 分钟过期** → 任务成功后**立即下载**。