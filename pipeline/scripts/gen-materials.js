#!/usr/bin/env node
/**
 * gen-materials.js — 从统一参数表生成共享材质库
 *
 * 产出（写入 tbg-assets 仓库，路径取自 config.json 的 assets_repo）:
 *   kits/<kit>/materials/<group>/<variant>.tres   Godot StandardMaterial3D
 *   kits/<kit>/materials/index.json               全部材质的参数索引（非 Godot 消费者的真源）
 *
 * 用法: node pipeline/scripts/gen-materials.js [kit]   （默认 cn-ancient）
 * 改色只改本文件的 MATERIALS 表，再跑一遍即可全量重生。
 */

const fs = require("fs");
const path = require("path");

const SKILL_ROOT = path.resolve(__dirname, "../..");
const config = JSON.parse(fs.readFileSync(path.join(SKILL_ROOT, "config.json"), "utf8"));
if (!config.assets_repo) throw new Error("config.json 缺少 assets_repo（tbg-assets 本地路径）");
const ROOT = config.assets_repo;

/**
 * 材质参数表
 * albedo: sRGB 十六进制；roughness/metallic: PBR 参数；glazed: 釉面标记（提示引擎可加清漆层）
 */
const MATERIALS = [
  // 瓦（roof-tile）
  { group: "roof-tile", id: "qingwa",      name: "青瓦",   albedo: "#46545e", roughness: 0.65, metallic: 0.0 },
  { group: "roof-tile", id: "huiwa",       name: "灰瓦",   albedo: "#7d8287", roughness: 0.9,  metallic: 0.0 },
  { group: "roof-tile", id: "liuli-huang", name: "黄琉璃", albedo: "#d9a62e", roughness: 0.25, metallic: 0.0, glazed: true },
  { group: "roof-tile", id: "liuli-lv",    name: "绿琉璃", albedo: "#3e7a52", roughness: 0.25, metallic: 0.0, glazed: true },
  // 木（wood）
  { group: "wood", id: "zhuqi",  name: "朱漆",     albedo: "#9e2b22", roughness: 0.5,  metallic: 0.0 },
  { group: "wood", id: "yuanmu", name: "原木",     albedo: "#a67c52", roughness: 0.8,  metallic: 0.0 },
  { group: "wood", id: "heiqi",  name: "黑漆",     albedo: "#1f1b18", roughness: 0.45, metallic: 0.0 },
  { group: "wood", id: "jiumu",  name: "褪色旧木", albedo: "#8c7b6b", roughness: 0.9,  metallic: 0.0 },
  // 墙（wall）
  { group: "wall", id: "baiqiang",   name: "白墙",     albedo: "#f2eee6", roughness: 0.95, metallic: 0.0 },
  { group: "wall", id: "hangtu",     name: "夯土黄墙", albedo: "#c9a86a", roughness: 1.0,  metallic: 0.0 },
  { group: "wall", id: "qingzhuan",  name: "青砖",     albedo: "#6e7680", roughness: 0.9,  metallic: 0.0 },
  { group: "wall", id: "fenqiang",   name: "粉墙",     albedo: "#ede4da", roughness: 0.95, metallic: 0.0 },
  // 石（stone）
  { group: "stone", id: "qingshi",  name: "青石",   albedo: "#7a8288", roughness: 0.85, metallic: 0.0 },
  { group: "stone", id: "hanbaiyu", name: "汉白玉", albedo: "#e8e6e0", roughness: 0.4,  metallic: 0.0 },
  { group: "stone", id: "mashi",    name: "麻石",   albedo: "#9b968e", roughness: 0.8,  metallic: 0.0 },
  // 金属（metal）
  { group: "metal", id: "tong",   name: "铜",   albedo: "#8c6b3d", roughness: 0.45, metallic: 0.9 },
  { group: "metal", id: "liujin", name: "鎏金", albedo: "#c9a227", roughness: 0.3,  metallic: 1.0 },
  { group: "metal", id: "tie",    name: "铁",   albedo: "#4a4d52", roughness: 0.55, metallic: 0.9 },
];

function hexToSrgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function toTres(m) {
  const [r, g, b] = hexToSrgb(m.albedo);
  const lines = [
    '[gd_resource type="StandardMaterial3D" format=3]',
    "",
    "[resource]",
    `resource_name = "${m.name}"`,
    `albedo_color = Color(${r.toFixed(4)}, ${g.toFixed(4)}, ${b.toFixed(4)}, 1)`,
    `metallic = ${m.metallic}`,
    `roughness = ${m.roughness}`,
  ];
  if (m.glazed) {
    // 釉面：加清漆层模拟琉璃光泽
    lines.push("clearcoat_enabled = true");
    lines.push("clearcoat = 0.6");
    lines.push("clearcoat_roughness = 0.15");
  }
  return lines.join("\n") + "\n";
}

function main() {
  const kit = process.argv[2] || "cn-ancient";
  const matDir = path.join(ROOT, "kits", kit, "materials");
  if (!fs.existsSync(path.join(ROOT, "kits", kit))) {
    console.error(`套件不存在: ${kit}`);
    process.exit(1);
  }

  const index = { kit, version: 1, materials: [] };
  let count = 0;
  for (const m of MATERIALS) {
    const dir = path.join(matDir, m.group);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${m.id}.tres`), toTres(m), "utf8");
    index.materials.push({
      ref: `${m.group}/${m.id}`,
      file: `${m.group}/${m.id}.tres`,
      name: m.name,
      albedo: m.albedo,
      roughness: m.roughness,
      metallic: m.metallic,
      ...(m.glazed ? { glazed: true } : {}),
    });
    count++;
  }
  fs.writeFileSync(path.join(matDir, "index.json"), JSON.stringify(index, null, 2) + "\n", "utf8");
  console.log(`已生成 ${count} 个材质 → kits/${kit}/materials/（含 index.json）`);
}

main();
