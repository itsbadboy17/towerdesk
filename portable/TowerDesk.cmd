@echo off
rem TowerDesk portable launcher. Double-click to run — no install, no Node, no internet needed.
rem Layout:  TowerDesk.cmd  node\node.exe  app\(server.js, src, public, node_modules)  app\data\(your data)
setlocal
cd /d "%~dp0"

rem --- Apply a staged self-update, if one was downloaded from Settings last time. The server is
rem --- stopped right now, so its files are free to overwrite. app\data is left untouched. ---
if exist "app\data\updates\staged\package.json" (
  echo Installing downloaded update...
  robocopy "app\data\updates\staged" "app" /E /XD "app\data" /NFL /NDL /NJH /NJS /NC /NS /NP >nul
  rmdir /S /Q "app\data\updates\staged" 2>nul
  if exist "app\data\updates\pending.json" del /Q "app\data\updates\pending.json" 2>nul
  echo Update installed.
)

rem --- Start the dashboard with the bundled Node runtime, then open it in the browser. ---
if not exist "node\node.exe" (
  echo Could not find node\node.exe next to this launcher. The portable build is incomplete.
  pause
  exit /b 1
)
echo TowerDesk is starting at http://localhost:3000  — close this window to stop it.
rem Open the browser a moment after the server comes up (detached so it doesn't block).
start "" /B cmd /c "timeout /t 2 >nul & start "" http://localhost:3000"
rem Run the server in the foreground: closing this window stops TowerDesk cleanly.
"node\node.exe" "app\server.js"
