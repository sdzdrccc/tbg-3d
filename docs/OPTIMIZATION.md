# tbg-3d 优化记录（2026-09-02）

> 生产端优化。仓储端改动见 tbg-assets 的 `docs/OPTIMIZATION.md`。
> 本文件记录**评审发现的问题**与**已实施的优化**。

## 一、排查到的问题（生产端视角）

### 1. category 白名单硬编码、与 schema 漂移
`pipeline/scripts/pack.js` 硬编码 `CATEGORIES` 数组，并注明“与 asset.schema.json 对应，schema 变更时需同步”。
一旦 tbg-assets 侧更新 schema 分类，生产端不会自动跟随，导致合法新分类被误拒。

### 2. 投递目录 `rm -rf` 静默覆盖
`pack.js` 写包前执行 `fs.rmSync(pkgDir, { recursive: true, force: true })`：
- 只按 id 末段作目录名（`inbox/<shortName>`），两个不同 id 的同名末段会互相覆盖；
- 无条件删除已有目录，换 id 重跑时会误删数据。

### 3. 未真正走 schema 校验
`pack.js` 只做手写字段校验，错误信息没引用 `asset.schema.json`。生产端“产出合规资产包”缺少权威闸门（权威校验只在仓储端，且此前仓储端也没真正调用 schema）。

### 4. 面数预算双轨
`pack.js` 的 `BUDGET`（primitive 10000）与 `kits/<kit>/kit.json`（primitive 5000）不一致，脚本和 kit 配置各写一份。

### 5. `config.json` 被纳入版本管理
仓库 `.gitignore` 已有 `config.json`，但该文件仍被 git 跟踪（里面含本机 Blender / Godot / assets_repo 路径）。
一旦全量 `git add -A` 会把本机路径提交上去，泄露环境/凭证信息。

### 6. 跨项目残留（tbg-assets 侧）
- `kit.json` 木头材质 `jiu-mu` 与 `material-map.json` / `jiumu` 不一致；
- `add-asset.js` 仍指向 `tools/intake/server.js`（已改名 `tools/hub/server.js`）。

---

## 二、已实施的优化

### A. `pack.js` — category / 预算从契约派生
新增 `buildCtx(config, kit)`：
- 从 `config.assets_repo/pipeline/schemas/asset.schema.json` 读取 `category` 枚举（共 24 项），覆盖内置回退表；
- 从 `kits/<kit>/kit.json` 读取 `budgets`，缺失时回退内置 `BUDGET`；
- 运行时打印 `[ctx]` 日志说明实际来源。

### B. `pack.js` — 投递前真正过 schema 校验
若 `assets_repo` 下存在 tbg-assets 的 `pipeline/scripts/lib/schema.js`，`packAsset` 会对生成的 `asset.json` 调用其 `validateAssetJson`，不通过即抛错拒发。
（校验器单一真源在仓储端，生产端复用，避免两套校验逻辑漂移。）

### C. `pack.js` — 去掉 `rm -rf`，改为防撞名
- 投递目录已存在且 `asset.json` 的 id 与本次不同 → 直接报错（不再静默覆盖）；
- 同 id 重新打包 → 仅覆盖三个文件；
- 不再递归删除目录。

### D. `config.json` 移出版本管理
`git rm --cached config.json`：本机配置不再进 git，符合 `.gitignore` 意图。

### E. 跨项目修复（tbg-assets 侧）
- `kit.json` 木头材质 `jiu-mu` → `jiumu`；
- `add-asset.js` 路径 `tools/intake/server.js` → `tools/hub/server.js`。

---

## 三、待办 / 下一步

- [x] 资产包 LOD / preview.png 自动化已完成：新增 `pipeline/refine/render-preview.py`（Blender 无头）。
  - `roof-xuanshan-single-a` 已精修：40608 → 15000 面、缩放归一为 6m 宽、轴心底部中心、生成 preview.png。
  - 全库 14 件资产均已生成 preview.png，`validate.js` 0 错误 0 警告。
- [x] tbg-3d 侧也接入 CI（`.github/workflows/ci.yml`，`node --check` 全部脚本，共 7 个文件通过）。
- [ ] 新风格套件（`kits/tang` 等）化：材质参数表、分类映射收进每个 kit，脚本按 kit 读取。
- [x] `verify.js` 增强：检测 `assets_repo` 可写、`inbox` 存在（已加入 `[Assets]` 检查）。


---

## 四、轮次 2（slash command / CI / verify 增强）

### 1. 排查到的问题

- **`/tbg-set` 没有独立的斜杠命令**：技能 `tbg-3d` 的 `name: tbg-3d` 只注册了 `/tbg-3d`；`/tbg-set` 仅存在于 description 作为触发短语，从未被注册为可选项。用户输入 `/tbg` 时下拉框只有 `/tbg-3d`，看不到 `tbg-set`。
  - 根因：Codex 以「技能目录名 / 前端 `name`」作为斜杠命令；自定义 prompt（`.codex/prompts`）走 `/prompts:name` 命名空间，不会出现裸 `/name`。
- **tbg-3d 无 CI**：所有 `scripts/**`、`pipeline/scripts/**` 没有语法检查 / PR 校验，改坏脚本只能在本地发现。
- **`verify.js` 不校验仓储端**：只查 Node / Tripo / Blender / Godot / project，未查 `assets_repo` 是否可达、可写，`inbox` 是否存在。

### 2. 已实施的优化

- **新增独立技能 `tbg-set`（`cmd/tbg-set/SKILL.md`）**，`name: tbg-set`：
  - 作为「配置 / 更新环境」入口，运行时调用 `scripts/install.js` + `scripts/verify.js`。
  - 已用 junction 装入 `~/.codex/skills/tbg-set` → `cmd/tbg-set`，与 `tbg-3d` 同仓库，随 git 版本化。
  - 同步把 `tbg-3d` 的 description 里对 `/tbg-set` 的“认领”改为“路由到 /tbg-set”，避免一短语触发两技能。
- **新增 CI `.github/workflows/ci.yml`**：push / PR 命中 `scripts/**`、`pipeline/scripts/**` 时对全部 `.js` 跑 `node --check`（共 7 个文件通过）。
- **`verify.js` 增强**：新增 `[Assets]` 检查 —— 检测 `assets_repo` 是否配置 / 存在 / 可写，`inbox` 是否已存在（缺失时提示“首次打包将自动创建”，非硬失败）。

> 提示：装好 `tbg-set` 技能后需重启 Codex 或新开会话，前端才会把 `/tbg-set` 加入斜杠菜单。


---

## 五、轮次 3（外部文件入库链路 + 贴图 / preview 打包）

### 1. 排查到的问题

- **资产包不含 preview.png**：`pack.js` 只写 `model.glb / asset.json / source.json`，而 `validate.js` 校验每件库内资产目录必须有 `preview.png`。新资产经 `intakePackage` 入库后必然缺预览 → 触发校验警告。
- **`render-preview.py` 不压贴图**：若导入模型带 2K/4K 贴图，导出 GLB 会非常大；游戏资产贴图应 ≤1024。
- （新资产）外部模型 `xieshan-roof.glb` 约 498k 面，未按库内标准精修。

### 2. 已实施的优化

- **`render-preview.py` 新增 `downscale_textures(max_texture)`**：把内嵌贴图缩放到最大边 ≤ `max_texture`（默认 1024），导出前调用（不足 1024 的自动跳过）。
- **`pack.js` 支持 `--preview <preview.png>`**：把预览图一并放入资产包（可选；供 `validate.js` 校验）。
- **处理外部模型** `xieshan-roof.glb` → 精修 `cn-ancient.roof.xieshan-single-a`（歇山顶·单檐 A）：
  - 498156 → **15000 面**、缩放归一为 **6.0m 宽**、轴心底部中心；
  - 贴图已校验 ≤1024（源已是 1024）、生成 300×300 `preview.png`；
  - 已投递 `tbg-assets/inbox/xieshan-single-a`（schema 校验通过，含 preview.png）。

