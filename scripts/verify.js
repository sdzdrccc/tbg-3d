#!/usr/bin/env node
/* tbg-3d verify (Node.js, cross-platform) */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const configPath = path.join(__dirname, '..', 'config.json');
const PROXY = 'http://127.0.0.1:7890';
let ok = true;
console.log('=== tbg-3d 环境检查 ===');
const v = process.version;
console.log(`[Node] ${v}`);
if (parseInt(v.replace('v','').split('.')[0]) < 20) { console.log('       ⚠️ 需 Node ≥ 20'); ok = false; }
try {
  const w = spawnSync('tripo', ['whoami','--json'], { env: { ...process.env, HTTP_PROXY: PROXY, HTTPS_PROXY: PROXY }, encoding: 'utf8' });
  if (w.status === 0) {
    const who = JSON.parse(w.stdout);
    const bj = spawnSync('tripo', ['balance','--json'], { env: { ...process.env, HTTP_PROXY: PROXY, HTTPS_PROXY: PROXY }, encoding:'utf8' }).stdout || '{}';
    const b = JSON.parse(bj);
    console.log(`[Tripo] region=${who.region}  balance=${b.balance}`);
    if ((b.balance||0) <= 0) console.log('       ⚠️ 余额 0，需充值/领积分');
  } else { console.log('[Tripo] 未安装或未登录'); ok = false; }
} catch { console.log('[Tripo] 未安装或未登录'); ok = false; }
let cfg = {};
if (fs.existsSync(configPath)) { try { cfg = JSON.parse(fs.readFileSync(configPath,'utf8')); } catch {} }
if (cfg.blender_dir && fs.existsSync(cfg.blender_dir)) console.log(`[Blender] ${cfg.blender_dir}`);
else { console.log('[Blender] 未配置/未找到 — 运行 install.js'); ok = false; }
if (cfg.godot_dir && fs.existsSync(cfg.godot_dir)) {
  console.log(`[Godot] ${cfg.godot_dir}`);
  if (cfg.godot_exe && fs.existsSync(cfg.godot_exe)) console.log(`[Godot] exe: ${cfg.godot_exe}`);
} else { console.log('[Godot] 未配置/未找到 — 运行 install.js'); ok = false; }
if (cfg.project_dir && fs.existsSync(path.join(cfg.project_dir, 'project.godot'))) console.log(`[Project] ${cfg.project_dir}`);
else { console.log('[Project] 未配置/project.godot 不存在'); ok = false; }
console.log('=== 结论 ===');
console.log(ok ? '基本环境就绪：启动 Blender(addon)、打开 Godot、确认 tripo 余额即可使用。'
               : '仍有缺失，请运行 install.js 补齐。');