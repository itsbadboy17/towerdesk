<#
Builds a portable, click-to-run TowerDesk for Windows into dist\TowerDesk.

  powershell -ExecutionPolicy Bypass -File scripts\make-portable.ps1 [-NodeExe <path>] [-OutDir <dir>] [-Zip]

It copies the app (never your data\ or test files), bundles a Node runtime so the end
user installs nothing, and drops the launchers in. With -Zip it also produces
dist\TowerDesk-portable.zip ready to hand to someone.

-NodeExe defaults to the node.exe on PATH. Point it at any node.exe >= 22.5 (the version
that ships the built-in SQLite used for history) to control which runtime is bundled.
#>
param(
  [string]$NodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source,
  [string]$OutDir = (Join-Path $PSScriptRoot '..\dist'),
  [switch]$Zip
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dest = Join-Path $OutDir 'TowerDesk'
$app  = Join-Path $dest 'app'

if (-not $NodeExe -or -not (Test-Path $NodeExe)) {
  throw "No node.exe found. Pass -NodeExe <path to node.exe> (>= 22.5)."
}

Write-Host "Building portable TowerDesk" -ForegroundColor Cyan
Write-Host "  app source : $root"
Write-Host "  node       : $NodeExe"
Write-Host "  output     : $dest"

# Clean output.
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Force -Path $app | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dest 'node') | Out-Null

# Copy the application, excluding the operator's data, tests, build output and VCS.
# robocopy exit codes 0-7 mean success; 8+ is a real error.
$exclDirs = @(
  (Join-Path $root 'data'),
  (Join-Path $root 'dist'),
  (Join-Path $root 'test'),
  (Join-Path $root 'tests'),
  (Join-Path $root 'portable'),
  (Join-Path $root 'playwright-report'),
  (Join-Path $root 'test-results'),
  (Join-Path $root '.git')
)
$rcArgs = @($root, $app, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/XD') + $exclDirs + @('/XF', '*.log')
& robocopy @rcArgs | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed copying the app (code $LASTEXITCODE)." }
$global:LASTEXITCODE = 0

# Bundle the Node runtime.
Copy-Item $NodeExe (Join-Path $dest 'node\node.exe') -Force

# Drop in the launchers + readme (from portable\).
Copy-Item (Join-Path $root 'portable\*') $dest -Force

# A fresh, empty data dir is created by the app on first run; make sure none is shipped.
if (Test-Path (Join-Path $app 'data')) { Remove-Item (Join-Path $app 'data') -Recurse -Force }

$size = [math]::Round(((Get-ChildItem $dest -Recurse | Measure-Object Length -Sum).Sum / 1MB), 1)
Write-Host "Done. $size MB at $dest" -ForegroundColor Green

if ($Zip) {
  $zipPath = Join-Path $OutDir 'TowerDesk-portable.zip'
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Compress-Archive -Path $dest -DestinationPath $zipPath
  Write-Host "Zipped: $zipPath" -ForegroundColor Green
}
