---
name: tbg-hub
description: Start the tbg-assets warehousing station (hub) preview server to review asset packages that tbg-3d dropped into inbox/ and confirm intake. Use when the user wants to preview, browse, or confirm incoming assets.
---

# TBG-3D 仓储站预览 / 入库（/tbg-hub）

启动 tbg-assets 仓储站网页，预览并确认 **tbg-3d**（pack.js）投递到 `inbox/` 的资产包。

## 定位仓库
- 仓储端仓库：读取 `F:\zxc\Project\tbg-3d\config.json` 的 `assets_repo`（通常 `F:\zxc\Project\tbg-assets`）。
- 用 `<assets_repo>/tools/hub/server.js` 启动。

## 启动
```powershell
# 读取 assets_repo
$cfg = Get-Content F:\zxc\Project\tbg-3d\config.json -Raw | ConvertFrom-Json
$repo = $cfg.assets_repo
# 后台启动（隐藏窗口）
Start-Process -FilePath "node" -ArgumentList "tools/hub/server.js" -WorkingDirectory $repo -WindowStyle Hidden
# 打开浏览器
Start-Process "http://localhost:8788"
```
- 默认端口 **8788**；可 `node tools/hub/server.js <port>`。
- 若 8788 已占用（`EADDRINUSE`），说明服务已在运行，直接用 `http://localhost:8788`。

## 确认入库（主通道）
1. 首页自动列出 `inbox/` 下 tbg-3d 投递的资产包（每包 = model.glb + asset.json + source.json + preview.png）。
2. 用户逐包预览（3D + preview.png + 元数据）。
3. 确认后点「入库」→ 后端 `intakePackage`：schema 校验 → 拷入 `kits/<kit>/...` → 清空 inbox 包目录。
4. 也可用 API：
   - `GET /api/packages` 看 inbox 资产包；
   - `POST /api/intake-package {"dir":"inbox/<name>"}` 入库。

## 校验
入库后跑：
```powershell
cd <assets_repo>; node pipeline/scripts/validate.js
```
应 0 错误 0 警告（validate.js 现校验每件库内资产目录的 preview.png）。

## 停止服务
后台进程常驻；如需停止，先查 8788 端口 PID 再结束（勿 `Stop-Process -Name node` 全局杀）。
```powershell
Get-NetTCPConnection -LocalPort 8788 -State Listen | Select-Object -Expand OwningProcess
```
