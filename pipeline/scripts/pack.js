#!/usr/bin/env node
/**
 * pack.js — 把一件精修合格的模型打包成「资产包」并投递到 tbg-assets inbox
 *
 * 资产包 = model.glb + asset.json + source.json（两项目唯一契约，
 * schema 权威：tbg-assets/pipeline/schemas/asset.schema.json）。
 *
 * 用法：
 *   node pipeline/scripts/pack.js \
 *     --glb <模型路径> --id cn-ancient.roof.xuanshan-single-a \
 *     --name "悬山顶·单檐 A" --tier component --dims 8,3,6 --polycount 40600 \
 *     [--category components/roof] [--tags 悬山,单檐] [--materials roof-tile/qingwa] \
 *     [--generator hunyuan] [--mode text] [--prompt ...] [--credits 0] [--preview <preview.png>] \
 *     [--collision box] [--out <覆盖投递目录>]
 *
 * 投递目录默认：<config.json 的 assets_repo>/inbox/<id 末段>/。
 * 入库由 tbg-assets 仓储站扫描确认完成，本脚本只负责产出合规资产包。
 *
 * 优化（2026-09-02）：
 *   - category 枚举、面数预算优先从 tbg-assets 的 schema / kit.json 派生，避免两次硬编码漂移；
 *   - 若 config.assets_repo 可访问，则对生成的 asset.json 复用 tbg-assets 的
 *     pipeline/scripts/lib/schema.js 做 schema 校验，不通过即拒发；
 *   - 投递目录改为「同 id 覆盖、异 id 报错」，不再用 rm -rf 静默删除已有目录。
 */

const fs = require("fs");
const path = require("path");

const SKILL_ROOT = path.resolve(__dirname, "..", "..");
const TIERS = ["primitive", "component", "mass", "hero"];
const COLLISIONS = ["box", "convex", "none"];
const BUDGET = { primitive: 10000, component: 20000, mass: 50000, hero: 100000 };

/** 与 asset.schema.json 对应的 category 白名单（schema 不可用时才用此回退） */
const CATEGORIES = [
  "components/roof", "components/wall", "components/pillar", "components/base",
  "components/door-window", "components/railing", "components/bracket",
  "buildings/residential", "buildings/commercial", "buildings/palace",
  "buildings/garden", "buildings/religious", "buildings/infrastructure",
  "props/lighting", "props/street", "props/ritual", "props/furniture", "props/cultivation",
  "nature/tree", "nature/rock", "nature/plant",
  "terrain/ground-tile", "terrain/cliff", "terrain/water",
];

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(SKILL_ROOT, "config.json"), "utf8"));
  } catch {
    return {};
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, "")] = argv[i + 1];
  }
  return args;
}

/**
 * 依据 config.assets_repo 构建「契约上下文」：
 *  - categories：优先取 asset.schema.json 的 category enum，否则用内置回退表；
 *  - budgets：优先取 kits/<kit>/kit.json 的 budgets，否则用内置 BUDGET；
 *  - validate：若 tbg-assets 存在 lib/schema.js 则返回其 validateAssetJson，否则 null。
 * @param {object} config readConfig() 结果
 * @param {string} kit 资产所属 kit id（用于读 kit.json 预算）
 * @returns {{categories: string[], budgets: object, validate: function|null, schemaPath: string|null, notes: string[]}}
 */
function buildCtx(config, kit) {
  const notes = [];
  let categories = CATEGORIES;
  let budgets = BUDGET;
  let validate = null;
  let schemaPath = null;
  const repo = config.assets_repo;

  if (repo) {
    const repoRoot = path.resolve(repo);
    const schemaFile = path.join(repoRoot, "pipeline", "schemas", "asset.schema.json");
    if (fs.existsSync(schemaFile)) {
      try {
        const schema = JSON.parse(fs.readFileSync(schemaFile, "utf8"));
        const catEnum = schema && schema.properties && schema.properties.category && schema.properties.category.enum;
        if (Array.isArray(catEnum) && catEnum.length) {
          categories = catEnum;
          notes.push(`category 枚举来自 schema（${catEnum.length} 项）`);
        }
        schemaPath = schemaFile;
      } catch (e) {
        notes.push(`读取 schema 失败，使用内置 category 表：${e.message}`);
      }
    } else {
      notes.push("未找到 tbg-assets schema，使用内置 category 表");
    }

    const kitFile = path.join(repoRoot, "kits", kit, "kit.json");
    if (fs.existsSync(kitFile)) {
      try {
        const kb = JSON.parse(fs.readFileSync(kitFile, "utf8")).budgets;
        if (kb && Object.keys(kb).length) { budgets = kb; notes.push(`面数预算来自 kits/${kit}/kit.json`); }
      } catch (e) { notes.push(`读取 kit.json 预算失败，使用内置 BUDGET：${e.message}`); }
    }

    const schemaLib = path.join(repoRoot, "pipeline", "scripts", "lib", "schema.js");
    if (fs.existsSync(schemaLib)) {
      try { validate = require(schemaLib).validateAssetJson; notes.push("已启用 asset.schema.json 校验"); }
      catch (e) { notes.push(`启用 schema 校验失败：${e.message}`); }
    }
  }

  return { categories, budgets, validate, schemaPath, notes };
}

/**
 * 打包一件资产。可被其他脚本（如 gen-primitives.js）require 复用。
 * @param {object} opts 同 CLI 参数（glb/id/name/tier/dims/polycount 必填）
 * @param {string} outRoot 投递根目录（通常是 tbg-assets/inbox）
 * @param {object} [ctx] buildCtx() 结果（可选，缺省时用内置默认）
 * @returns {{ pkgDir: string, warnings: string[] }}
 */
function packAsset(opts, outRoot, ctx) {
  const warnings = [];
  const c = ctx || { categories: CATEGORIES, budgets: BUDGET, validate: null, notes: [] };

  for (const k of ["glb", "id", "name", "tier", "dims", "polycount", "category"]) {
    if (opts[k] === undefined || opts[k] === null || opts[k] === "") {
      throw new Error(`缺少必填字段 ${k}`);
    }
  }

  if (!/^[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+$/.test(opts.id)) {
    throw new Error("id 格式应为 <kit>.<子分类>.<名称>，如 cn-ancient.roof.xuanshan-single-a");
  }
  const [kit] = opts.id.split(".");
  if (!TIERS.includes(opts.tier)) throw new Error(`tier 必须是 ${TIERS.join("/")}`);
  if (!c.categories.includes(opts.category)) {
    throw new Error(`category 必须是 schema 白名单之一，收到：${opts.category}（可选：${c.categories.join(", ")}）`);
  }
  const dims = (Array.isArray(opts.dims) ? opts.dims : String(opts.dims).split(",")).map(Number);
  if (dims.length !== 3 || dims.some(isNaN)) throw new Error("dims 格式：宽,高,深（米）");
  const polycount = Number(opts.polycount);
  if (isNaN(polycount) || polycount <= 0) throw new Error("polycount 必须为正整数");
  if (!fs.existsSync(opts.glb)) throw new Error(`找不到 glb 文件：${opts.glb}`);

  const budget = c.budgets[opts.tier];
  if (polycount > budget) {
    warnings.push(`面数 ${polycount} 超出 ${opts.tier} 预算 ${budget}，建议先减面`);
  }

  const shortName = opts.id.split(".")[2];
  const pkgDir = path.join(outRoot, shortName);

  // 防撞名：目录已被「不同 id」占用时直接报错，不再 rm -rf 静默覆盖
  if (fs.existsSync(pkgDir)) {
    const existingFile = path.join(pkgDir, "asset.json");
    if (fs.existsSync(existingFile)) {
      let existingId = null;
      try { existingId = JSON.parse(fs.readFileSync(existingFile, "utf8")).id; } catch {}
      if (existingId && existingId !== opts.id) {
        throw new Error(`投递目录已被不同资产「${existingId}」占用：${pkgDir}。请更换 id 或先清理 inbox。`);
      }
    }
  }
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.copyFileSync(opts.glb, path.join(pkgDir, "model.glb"));

  const asset = {
    id: opts.id,
    name: opts.name,
    kit,
    category: opts.category,
    tier: opts.tier,
    tags: opts.tags || [],
    dimensions_m: dims,
    polycount,
    pivot: "bottom-center",
    lods: { lod0: "model.glb" },
    collision: COLLISIONS.includes(opts.collision) ? opts.collision : "box",
    sockets: opts.sockets || [],
    materials: opts.materials || [],
    variants: opts.variants || [],
    license: "CC0-1.0",
    author: opts.author || "sdzdrccc",
  };

  // schema 权威校验（复用 tbg-assets 的 lib/schema.js）
  if (typeof c.validate === "function") {
    const errs = c.validate(asset);
    if (errs.length) throw new Error("asset.json 未通过 schema 校验：\n" + errs.join("\n"));
  }

  fs.writeFileSync(path.join(pkgDir, "asset.json"), JSON.stringify(asset, null, 2) + "\n");

  const source = {
    generator: opts.generator || "tripo-p1",
    mode: opts.mode || "text",
    prompt: opts.prompt || "",
    seed: opts.seed || null,
    task_id: opts.task_id || null,
    credits: opts.credits != null ? Number(opts.credits) : null,
    generated_at: new Date().toISOString().slice(0, 10),
    raw_file: path.basename(opts.glb),
    refinement: opts.refinement || "待填写：Blender 精修记录",
  };
  fs.writeFileSync(path.join(pkgDir, "source.json"), JSON.stringify(source, null, 2) + "\n");

  // 可选 preview.png：入库后 validate.js 会校验该文件存在
  if (opts.preview && fs.existsSync(opts.preview)) {
    fs.copyFileSync(opts.preview, path.join(pkgDir, "preview.png"));
  }

  return { pkgDir, warnings };
}

module.exports = { packAsset, CATEGORIES, TIERS, BUDGET, buildCtx };

// ---- CLI ----
if (require.main === module) {
  const args = parseArgs(process.argv);
  const config = readConfig();
  const outRoot =
    args.out ||
    (config.assets_repo ? path.join(config.assets_repo, "inbox") : null);
  if (!outRoot) {
    console.error("错误：config.json 缺少 assets_repo，且未用 --out 指定投递目录");
    process.exit(1);
  }
  try {
    const [kit] = String(args.id || "").split(".");
    const ctx = buildCtx(config, kit);
    ctx.notes.forEach((n) => console.log("[ctx] " + n));
    const { pkgDir, warnings } = packAsset(
      {
        glb: args.glb,
        id: args.id,
        name: args.name,
        tier: args.tier,
        dims: args.dims,
        polycount: args.polycount,
        category: args.category,
        tags: args.tags ? args.tags.split(",").map((t) => t.trim()) : [],
        materials: args.materials ? args.materials.split(",").map((m) => m.trim()) : [],
        credits: args.credits,
        prompt: args.prompt,
        seed: args.seed,
        task_id: args["task-id"],
        mode: args.mode,
        generator: args.generator,
        collision: args.collision,
        author: args.author,
        refinement: args.refinement,
        preview: args.preview,
      },
      outRoot,
      ctx
    );
    warnings.forEach((w) => console.warn("警告：" + w));
    console.log("资产包已投递：" + pkgDir);
    console.log("下一步：打开 tbg-assets 仓储站（node tools/hub/server.js）预览确认入库");
  } catch (e) {
    console.error("错误：" + e.message);
    process.exit(1);
  }
}
