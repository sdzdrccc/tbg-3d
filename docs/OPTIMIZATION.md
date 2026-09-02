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

- [ ] 资产包 LOD / preview.png 自动化（`gltf-transform` 减面 + 无头 Blender 渲染预览），当前 `roof-xuanshan-single-a` 40608 面超预算。
- [ ] tbg-3d 侧也接入 CI（至少 `node --check` 全部脚本）。
- [ ] 新风格套件（`kits/tang` 等）化：材质参数表、分类映射收进每个 kit，脚本按 kit 读取。
- [ ] `verify.js` 增强：检测 `assets_repo` 可写、`inbox` 存在。
