#!/usr/bin/env node
/**
 * fix-scale.js — 修正 GLB 的单位缩放（如混元3D FBX 转出的 100 倍缩水）
 *
 * 用法:
 *   NODE_PATH=<managed-node-workspace>/node_modules node fix-scale.js --in a.glb --out b.glb --scale 100
 *   （不指定 --out 则原地覆盖；--scale 为乘数，如 100 表示放大 100 倍）
 *
 * 依赖 @gltf-transform/core（装在 WorkBuddy managed node workspace）。
 * 仅处理静态网格：缩放所有 POSITION 顶点与节点 translation，重算包围盒。
 */

const path = require("path");
const { NodeIO } = require("@gltf-transform/core");
const { KHRONOS_EXTENSIONS } = require("@gltf-transform/extensions");

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, "")] = argv[i + 1];
  }
  if (!args.in || !args.scale) {
    console.error("用法: node fix-scale.js --in a.glb [--out b.glb] --scale 100");
    process.exit(1);
  }
  args.out = args.out || args.in;
  args.scale = parseFloat(args.scale);
  if (!Number.isFinite(args.scale) || args.scale <= 0) {
    console.error("--scale 必须是正数");
    process.exit(1);
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
  const doc = await io.read(path.resolve(args.in));
  const root = doc.getRoot();

  // 1. 缩放所有 POSITION 顶点，并重算 accessor 的 min/max
  let meshCount = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      const arr = pos.getArray();
      for (let i = 0; i < arr.length; i++) arr[i] *= args.scale;
      pos.setArray(arr); // v4 的 min/max 由 getMin/getMax 即时计算，写出时自动正确
      meshCount++;
    }
  }

  // 2. 缩放节点平移（保持层级结构位置正确），并把节点缩放归一
  //    （相当于 Blender 的 Apply Scale：缩放已烘进顶点，节点 scale 必须重置，
  //      否则像 FBX 转出的 scale=100 节点会让模型再放大 100 倍）
  for (const node of root.listNodes()) {
    const t = node.getTranslation();
    node.setTranslation([t[0] * args.scale, t[1] * args.scale, t[2] * args.scale]);
    const s = node.getScale();
    if (s[0] !== 1 || s[1] !== 1 || s[2] !== 1) {
      node.setScale([1, 1, 1]);
    }
  }

  await io.write(path.resolve(args.out), doc);

  // 输出缩放后的整体尺寸
  let gmin = [Infinity, Infinity, Infinity];
  let gmax = [-Infinity, -Infinity, -Infinity];
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      const mn = pos.getMin([]);
      const mx = pos.getMax([]);
      for (let c = 0; c < 3; c++) {
        gmin[c] = Math.min(gmin[c], mn[c]);
        gmax[c] = Math.max(gmax[c], mx[c]);
      }
    }
  }
  const dims = gmax.map((v, i) => (v - gmin[i]).toFixed(2));
  console.log(`完成: ${meshCount} 个图元 ×${args.scale} → ${args.out}`);
  console.log(`缩放后尺寸: ${dims.join(" × ")} m`);
}

main().catch((e) => {
  console.error("失败:", e.message);
  process.exit(1);
});
