#!/usr/bin/env node
/**
 * gen-primitives.js — 程序化生成 Wave 0 primitive 构件并打包投递
 *
 * 几何简单件（台基/台阶/实墙/柱/地砖）不值得花积分，也不依赖 Blender：
 * 本脚本用参数化网格直接写出 GLB，再经 pack.js 打包成资产包投递到
 * tbg-assets/inbox（tier=primitive, 0 积分），由仓储站确认入库。
 *
 * 用法:
 *   NODE_PATH=<managed-node>/node_modules node pipeline/scripts/gen-primitives.js [--kit cn-ancient] [--dry-run]
 *
 * 网格规范（pipeline/origin-rules.md）：1 unit = 1m、+Y 向上、轴心底部中心。
 */

const fs = require("fs");
const path = require("path");
const { Document, NodeIO } = require("@gltf-transform/core");
const { KHRONOS_EXTENSIONS } = require("@gltf-transform/extensions");
const { packAsset } = require("./pack");

const SKILL_ROOT = path.resolve(__dirname, "../..");
const config = JSON.parse(fs.readFileSync(path.join(SKILL_ROOT, "config.json"), "utf8"));
if (!config.assets_repo) throw new Error("config.json 缺少 assets_repo（tbg-assets 本地路径）");
const INBOX = path.join(config.assets_repo, "inbox");

// ---------------- 网格构建器（合并到单一 vertex/index 缓冲） ----------------

function createBuilder() {
  return { pos: [], nrm: [], uv: [], idx: [], vertCount: 0 };
}

function pushQuad(b, corners, normal, uvs) {
  // corners: 4 个 [x,y,z]，逆时针（从法线侧看）
  const base = b.vertCount;
  const uv = uvs || [
    [0, 0], [1, 0], [1, 1], [0, 1],
  ];
  for (let i = 0; i < 4; i++) {
    b.pos.push(...corners[i]);
    b.nrm.push(...normal);
    b.uv.push(...uv[i]);
  }
  b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  b.vertCount += 4;
}

/** 轴对齐盒体。cx/cz 为中心，y0 为底面高度。 */
function addBox(b, w, h, d, cx = 0, y0 = 0, cz = 0) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const y1 = y0 + h;
  const z0 = cz - d / 2, z1 = cz + d / 2;
  // +Y 顶面（从上看逆时针 → glTF 正面）
  pushQuad(b, [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0]);
  // -Y 底面
  pushQuad(b, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]);
  // +X
  pushQuad(b, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0]);
  // -X
  pushQuad(b, [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], [-1, 0, 0]);
  // +Z
  pushQuad(b, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
  // -Z
  pushQuad(b, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1]);
}

/** 圆柱（柱身）。底部在 y0，半径 r，seg 段。 */
function addCylinder(b, r, h, seg = 12, cx = 0, y0 = 0, cz = 0) {
  const y1 = y0 + h;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    const [x0, z0] = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r];
    const [x1, z1] = [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r];
    const n0 = [Math.cos(a0), 0, Math.sin(a0)];
    const n1 = [Math.cos(a1), 0, Math.sin(a1)];
    const base = b.vertCount;
    b.pos.push(x0, y0, z0, x1, y0, z1, x1, y1, z1, x0, y1, z0);
    b.nrm.push(...n0, ...n1, ...n1, ...n0);
    b.uv.push(i / seg, 0, (i + 1) / seg, 0, (i + 1) / seg, 1, i / seg, 1);
    b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    b.vertCount += 4;
  }
  // 顶盖扇面
  const capBase = b.vertCount;
  b.pos.push(cx, y1, cz);
  b.nrm.push(0, 1, 0);
  b.uv.push(0.5, 0.5);
  b.vertCount += 1;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    b.pos.push(cx + Math.cos(a) * r, y1, cz + Math.sin(a) * r);
    b.nrm.push(0, 1, 0);
    b.uv.push(0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2);
    b.vertCount += 1;
    if (i > 0) b.idx.push(capBase, capBase + i, capBase + i + 1);
  }
}

/** 坡道（直角三棱柱）：宽 w，高 h，长 d。低端在 -Z 前缘，高端在 +Z 后缘，底部 y0。 */
function addWedge(b, w, h, d, cx = 0, y0 = 0, cz = 0) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const z0 = cz - d / 2, z1 = cz + d / 2;
  const y1 = y0 + h;
  // 斜面（从 -Z 底升到 +Z 顶）。法线朝斜上方
  const len = Math.hypot(h, d);
  const nSlope = [0, d / len, h / len];
  pushQuad(b, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z1], [x0, y1, z1]], nSlope);
  // 背面（+Z 竖直面）
  pushQuad(b, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
  // 底面
  pushQuad(b, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]);
  // 两个三角侧面
  const tri = (sign) => {
    const x = sign > 0 ? x1 : x0;
    const base = b.vertCount;
    b.pos.push(x, y0, z0, x, y0, z1, x, y1, z1);
    for (let k = 0; k < 3; k++) b.nrm.push(sign, 0, 0);
    b.uv.push(0, 0, 1, 0, 1, 1);
    if (sign > 0) b.idx.push(base, base + 1, base + 2);
    else b.idx.push(base, base + 2, base + 1);
    b.vertCount += 3;
  };
  tri(1);
  tri(-1);
}

// ---------------- GLB 写出 ----------------

async function buildGlb(b, outPath) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(b.pos)).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(b.nrm)).setBuffer(buffer))
    .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array(b.uv)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(b.idx)).setBuffer(buffer));
  const mesh = doc.createMesh("primitive").addPrimitive(prim);
  const node = doc.createNode("root").setMesh(mesh);
  doc.createScene("scene").addChild(node);
  const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
  await io.write(outPath, doc);
}

// ---------------- 资产定义 ----------------

/** 每件: id 后缀、中文名、分类、尺寸[宽,高,深]、共享材质、构建函数、tags */
const PRIMS = [
  {
    sub: "base/stone-flat-a", name: "石台基·平顶 A", cat: "components/base",
    dims: [4, 0.5, 4], materials: ["stone/qingshi"], tags: ["台基", "石作"],
    build: (b) => addBox(b, 4, 0.5, 4),
  },
  {
    sub: "base/stone-flat-b", name: "石台基·平顶 B", cat: "components/base",
    dims: [4, 1, 4], materials: ["stone/qingshi"], tags: ["台基", "石作"],
    build: (b) => addBox(b, 4, 1, 4),
  },
  {
    sub: "base/xumizuo-a", name: "须弥座 A", cat: "components/base",
    dims: [4.6, 1.2, 4.6], materials: ["stone/qingshi"], tags: ["须弥座", "台基", "石作"],
    build: (b) => {
      addBox(b, 4.6, 0.3, 4.6, 0, 0, 0);   // 下枋
      addBox(b, 4.2, 0.3, 4.2, 0, 0.3, 0); // 束腰下
      addBox(b, 3.8, 0.3, 3.8, 0, 0.6, 0); // 束腰
      addBox(b, 4.2, 0.3, 4.2, 0, 0.9, 0); // 上枋
    },
  },
  {
    sub: "base/stairs-front-3", name: "踏跺·三级", cat: "components/base",
    dims: [2, 0.45, 0.9], materials: ["stone/qingshi"], tags: ["台阶", "踏跺"],
    build: (b) => {
      // 每级退 0.3m：第 i 级 cz = 0.15*i（前缘 -0.45+i*0.3，后缘与台基齐平 +0.45）
      for (let i = 0; i < 3; i++) addBox(b, 2, 0.15, 0.3 * (3 - i), 0, i * 0.15, 0.15 * i);
    },
  },
  {
    sub: "base/stairs-front-5", name: "踏跺·五级", cat: "components/base",
    dims: [2, 0.75, 1.5], materials: ["stone/qingshi"], tags: ["台阶", "踏跺"],
    build: (b) => {
      for (let i = 0; i < 5; i++) addBox(b, 2, 0.15, 0.3 * (5 - i), 0, i * 0.15, 0.15 * i);
    },
  },
  {
    sub: "base/ramp-stone-a", name: "石坡道 A", cat: "components/base",
    dims: [2, 0.75, 3], materials: ["stone/qingshi"], tags: ["坡道", "辇道"],
    build: (b) => addWedge(b, 2, 0.75, 3),
  },
  {
    sub: "wall/solid-a", name: "实墙 A", cat: "components/wall",
    dims: [2, 3, 0.24], materials: ["wall/baiqiang"], tags: ["实墙", "模数墙"],
    build: (b) => addBox(b, 2, 3, 0.24),
  },
  {
    sub: "wall/half-a", name: "半墙 A", cat: "components/wall",
    dims: [2, 1, 0.24], materials: ["wall/baiqiang"], tags: ["半墙", "栏杆墙"],
    build: (b) => addBox(b, 2, 1, 0.24),
  },
  {
    sub: "pillar/round-a", name: "木圆柱 A（含柱础）", cat: "components/pillar",
    dims: [0.4, 3.2, 0.4], materials: ["wood/zhuqi", "stone/qingshi"], tags: ["圆柱", "柱础"],
    build: (b) => {
      addBox(b, 0.4, 0.2, 0.4, 0, 0, 0);        // 柱础（石）
      addCylinder(b, 0.15, 3, 12, 0, 0.2, 0);   // 柱身（木）
    },
  },
  {
    sub: "pillar/square-a", name: "方柱 A", cat: "components/pillar",
    dims: [0.3, 3, 0.3], materials: ["wood/zhuqi"], tags: ["方柱"],
    build: (b) => addBox(b, 0.3, 3, 0.3),
  },
  {
    sub: "ground-tile/slab-a", name: "青石板 2×2", cat: "terrain/ground-tile",
    dims: [2, 0.08, 2], materials: ["stone/qingshi"], tags: ["石板", "铺地"],
    build: (b) => addBox(b, 2, 0.08, 2),
  },
  {
    sub: "ground-tile/slab-b", name: "方砖 2×2", cat: "terrain/ground-tile",
    dims: [2, 0.06, 2], materials: ["stone/mashi"], tags: ["方砖", "铺地"],
    build: (b) => addBox(b, 2, 0.06, 2),
  },
  {
    sub: "ground-tile/dirt-a", name: "夯土地面 2×2", cat: "terrain/ground-tile",
    dims: [2, 0.05, 2], materials: ["wall/hangtu"], tags: ["夯土", "铺地"],
    build: (b) => addBox(b, 2, 0.05, 2),
  },
];

// ---------------- 主流程 ----------------

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const kitIdx = process.argv.indexOf("--kit");
  const kit = kitIdx > 0 ? process.argv[kitIdx + 1] : "cn-ancient";
  const outDir = path.join(SKILL_ROOT, ".tmp-prims");
  fs.mkdirSync(outDir, { recursive: true });

  let ok = 0;
  for (const p of PRIMS) {
    const id = `${kit}.${p.sub.replace("/", ".")}`;
    const fileName = p.sub.split("/")[1] + ".glb";
    const glbPath = path.join(outDir, fileName);

    const b = createBuilder();
    p.build(b);
    const tris = b.idx.length / 3;

    if (dryRun) {
      console.log(`[dry-run] ${id}  ${tris} 面`);
      continue;
    }

    await buildGlb(b, glbPath);
    try {
      packAsset(
        {
          glb: glbPath,
          id,
          name: p.name,
          tier: "primitive",
          dims: p.dims,
          polycount: tris,
          category: p.cat,
          tags: p.tags,
          materials: p.materials,
          credits: 0,
          generator: "procedural-gen",
          prompt: `程序化参数生成（pipeline/scripts/gen-primitives.js），几何由代码构建，无需 AI 生成`,
        },
        INBOX
      );
      console.log(`OK ${id}  ${tris} 面`);
      ok++;
    } catch (e) {
      console.error(`FAIL ${id}: ${e.message}`);
    }
  }
  fs.rmSync(outDir, { recursive: true, force: true });
  console.log(dryRun ? `\n[dry-run] 共 ${PRIMS.length} 件` : `\n完成 ${ok}/${PRIMS.length} 件投递到 inbox`);
}

main().catch((e) => {
  console.error("失败:", e);
  process.exit(1);
});
