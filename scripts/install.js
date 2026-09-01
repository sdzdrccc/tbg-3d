#!/usr/bin/env node
/* tbg-3d installer (Node.js, cross-platform) */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync, spawn } = require('child_process');
const readline = require('readline');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const getVal = (l) => { const i = args.indexOf(l); return i >= 0 && args[i+1] ? args[i+1] : null; };
const DRY = has('--dry-run');
const NONINT = has('--non-interactive');
const SKIPT = has('--skip-tripo');
const PROJECT_ARG = getVal('--project-dir') || process.env.TBG_PROJECT_DIR || '';

const home = os.homedir();
const configPath = path.join(__dirname, '..', 'config.json');
const codexCfg = process.env.CODEX_CONFIG || path.join(home, '.codex', 'config.toml');
const PROXY = 'http://127.0.0.1:7890';

function log(s){ console.log(s); }
function which(cmd){
  try {
    const r = process.platform === 'win32'
      ? execSync(`where ${cmd}`, { stdio: ['ignore','pipe','ignore'] }).toString().trim().split(/\r?\n/)[0]
      : execSync(`which ${cmd}`, { stdio: ['ignore','pipe','ignore'] }).toString().trim();
    return r || null;
  } catch { return null; }
}
function lsDirs(p){ try { return fs.readdirSync(p).filter(n => { try { return fs.statSync(path.join(p,n)).isDirectory(); } catch { return false; } }); } catch { return []; } }

function findBlender(){
  const w = which('blender'); if (w) return path.dirname(w);
  const bases = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean);
  for (const b of bases) {
    const bf = path.join(b, 'Blender Foundation');
    if (fs.existsSync(bf)) {
      for (const d of lsDirs(bf)) {
        const exe = path.join(bf, d, 'blender.exe');
        if (fs.existsSync(exe)) return path.dirname(exe);
      }
    }
  }
  return null;
}
function findGodot(){
  const roots = [home, path.join(home,'Desktop'), path.join(home,'Downloads'), process.env.ProgramFiles].filter(Boolean);
  for (const r of roots) { if (!fs.existsSync(r)) continue; for (const d of lsDirs(r)) if (/^Godot/i.test(d)) return path.join(r,d); }
  return null;
}
function findGodotExe(dir){
  if (!dir || !fs.existsSync(dir)) return null;
  const exes = lsDirs(dir).length ? [] : []; // directories only for godot folders normally
  try {
    const files = fs.readdirSync(dir).filter(f => /^Godot.*\.exe$|^Godot.*$/i.test(f));
    const gui = files.filter(f => !/console/i.test(f));
    const pick = gui[0] || files[0];
    return pick ? path.join(dir, pick) : null;
  } catch { return null; }
}
function ask(q, def){
  return new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${q}${def ? ` [${def}]` : ''}: `, a => { rl.close(); res(a.trim() || def || ''); });
  });
}
function removeSection(text, name){
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  const re = new RegExp('^\\s*\\[' + name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '(\\]|\\.env\\])');
  while (i < lines.length) {
    if (re.test(lines[i])) { i++; while (i < lines.length && !/^\s*\[[^\]]+\]/.test(lines[i])) i++; continue; }
    out.push(lines[i]); i++;
  }
  return out.join('\n');
}

(async () => {
  log('== tbg-3d 安装器 (Node) ==');
  const v = process.version;
  log(`Node: ${v}`);
  if (parseInt(v.replace('v','').split('.')[0]) < 20) { log('⚠️ 需要 Node ≥ 20'); process.exit(1); }

  let blenderDir = findBlender();
  let godotDir = findGodot();
  let projectDir = PROJECT_ARG;
  let cfg = {};
  if (fs.existsSync(configPath)) { try { cfg = JSON.parse(fs.readFileSync(configPath,'utf8')); } catch {} }
  if (!projectDir && cfg.project_dir) projectDir = cfg.project_dir;

  log(`Blender: ${blenderDir || '(未检测到)'}`);
  log(`Godot dir: ${godotDir || '(未检测到)'}`);
  log(`Project: ${projectDir || '(未指定)'}`);

  if (!DRY && !NONINT) {
    blenderDir = (await ask('Blender 安装文件夹(含 blender.exe)', blenderDir)) || blenderDir;
    godotDir = (await ask('Godot 文件夹(含 Godot*.exe)', godotDir)) || godotDir;
    projectDir = (await ask('Godot 项目目录(含 project.godot)', projectDir)) || projectDir;
  }
  const godotExe = findGodotExe(godotDir) || (godotDir ? null : null);

  if (DRY) { log('\n[DRY-RUN] 未做任何修改。'); return; }

  // 写 config.json
  const out = { blender_dir: blenderDir, godot_dir: godotDir, godot_exe: godotExe, project_dir: projectDir, tripo_ok: false, updated: new Date().toISOString() };
  fs.writeFileSync(configPath, JSON.stringify(out, null, 2));

  // Tripo
  let tripo_ok = false;
  if (!SKIPT) {
    if (!which('tripo')) { log('安装 tripo-cli ...'); execSync('npm install -g tripo-cli', { stdio: 'inherit', env: { ...process.env, HTTP_PROXY: PROXY, HTTPS_PROXY: PROXY } }); }
    const w = spawnSync('tripo', ['whoami','--json'], { env: { ...process.env, HTTP_PROXY: PROXY, HTTPS_PROXY: PROXY }, encoding:'utf8' });
    tripo_ok = w.status === 0;
    if (tripo_ok) log('Tripo 已登录 ✅'); else log('Tripo 未登录 → 运行:  tripo login --region ov|cn  （浏览器授权）');
    out.tripo_ok = tripo_ok; fs.writeFileSync(configPath, JSON.stringify(out, null, 2));
  }

  // 写 Codex config.toml
  let text = '';
  try { text = fs.readFileSync(codexCfg, 'utf8'); } catch {}
  text = removeSection(text, 'mcp_servers.godot-mcp');
  text = removeSection(text, 'mcp_servers.blender');
  const godotBlock = `[mcp_servers.godot-mcp]\ncommand = "npx"\nargs = ["-y", "@yanhuifair/godot-mcp", "-p", '${projectDir}']\nstartup_timeout_sec = 60\n\n[mcp_servers.godot-mcp.env]\nGODOT_PATH = '${godotExe || ''}'\n`;
  const blenderBlock = `[mcp_servers.blender]\ncommand = "uvx"\nargs = ["--python", "3.11", "blender-mcp"]\nstartup_timeout_sec = 120\n\n[mcp_servers.blender.env]\nUV_PYTHON_PREFERENCE = "only-managed"\nDISABLE_TELEMETRY = "true"\nBLENDER_PORT = "9877"\n`;
  const final = (text.trimEnd() + '\n\n' + godotBlock.trim() + '\n\n' + blenderBlock.trim() + '\n');
  try { fs.copyFileSync(codexCfg, codexCfg + '.bak-tbg'); } catch {}
  fs.writeFileSync(codexCfg, final);

  log('\nconfig.toml 已更新（godot-mcp 9876 / blender 9877）✅');
  // 自动启动 Blender / Godot（检测到路径即拉起）
if (!has('--no-launch')) {
  const bExe = (blenderDir && process.platform === 'win32') ? path.join(blenderDir,'blender.exe')
             : (blenderDir ? path.join(blenderDir,'blender') : null);
  if (bExe && fs.existsSync(bExe)) {
    try { spawn(bExe, [], { detached: true, stdio: 'ignore' }).unref(); log('已自动启动 Blender: ' + bExe); } catch(e){}
  } else log('(未检测到 Blender 可执行，请手动启动)');
  if (godotExe && projectDir) {
    try { spawn(godotExe, ['-e','--path', projectDir], { detached: true, stdio: 'ignore' }).unref(); log('已自动打开 Godot 编辑器: ' + projectDir); } catch(e){}
  } else log('(未检测到 Godot exe/项目，请手动打开)');
}
log('\n完成。接下来：确认 tripo 余额 > 0，即可用自然语言生成资产。');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });