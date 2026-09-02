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
 *     [--generator hunyuan] [--mode text] [--prompt ...] [--credits 0] \
 *     [--collision box] [--out <覆盖投递目录>]
 *
 * 投递目录默认：<config.json 的 assets_repo>/inbox/<id 末段>/。
 * 入库由 tbg-assets 仓储站扫描确认完成，本脚本只负责产出合规资产包。
 */

const fs = require("fs");
const path = require("path");

const SKILL_ROOT = path.resolve(__dirname, "..", "..");
const TIERS = ["primitive", "component", "mass", "hero"];
const COLLISIONS = ["box", "convex", "none"];
const BUDGET = { primitive: 10000, component: 20000, mass: 50000, hero: 100000 };

/** 与 asset.schema.json 对应的 category 白名单（schema 变更时需同步） */
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
 * 打包一件资产。可被其他脚本（如 gen-primitives.js）require 复用。
 * @param {object} opts 同 CLI 参数（glb/id/name/tier/dims/polycount 必填）
 * @param {string} outRoot 投递根目录（通常是 tbg-assets/inbox）
 * @returns {{ pkgDir: string, warnings: string[] }}
 */
function packAsset(opts, outRoot) {
  const warnings = [];

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
  if (!CATEGORIES.includes(opts.category)) {
    throw new Error(`category 必须是 schema 白名单之一，收到：${opts.category}`);
  }
  const dims = (Array.isArray(opts.dims) ? opts.dims : String(opts.dims).split(",")).map(Number);
  if (dims.length !== 3 || dims.some(isNaN)) throw new Error("dims 格式：宽,高,深（米）");
  const polycount = Number(opts.polycount);
  if (isNaN(polycount) || polycount <= 0) throw new Error("polycount 必须为正整数");
  if (!fs.existsSync(opts.glb)) throw new Error(`找不到 glb 文件：${opts.glb}`);

  if (polycount > BUDGET[opts.tier]) {
    warnings.push(`面数 ${polycount} 超出 ${opts.tier} 预算 ${BUDGET[opts.tier]}，建议先减面`);
  }

  const shortName = opts.id.split(".")[2];
  const pkgDir = path.join(outRoot, shortName);
  if (fs.existsSync(pkgDir)) fs.rmSync(pkgDir, { recursive: true, force: true });
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

  return { pkgDir, warnings };
}

module.exports = { packAsset, CATEGORIES, TIERS, BUDGET };

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
      },
      outRoot
    );
    warnings.forEach((w) => console.warn("警告：" + w));
    console.log("资产包已投递：" + pkgDir);
    console.log("下一步：打开 tbg-assets 仓储站（node tools/hub/server.js）预览确认入库");
  } catch (e) {
    console.error("错误：" + e.message);
    process.exit(1);
  }
}
