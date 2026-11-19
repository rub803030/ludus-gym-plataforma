$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

try {
  if (Test-Path "$root\.env.local") {
    Get-Content "$root\.env.local" | ForEach-Object {
      if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $key = $Matches[1].Trim()
        $value = $Matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($key, $value, 'Process')
      }
    }
  }

  Write-Host 'Starting Ludus GYM API on :4000 and Web on :3000' -ForegroundColor Green
  Write-Host 'Press Ctrl+C to stop both.' -ForegroundColor DarkGray

  $api = Start-Process -FilePath 'pnpm' -ArgumentList '--filter', '@ludus/api', 'dev' -WorkingDirectory $root -PassThru
  $web = Start-Process -FilePath 'pnpm' -ArgumentList '--filter', '@ludus/web', 'dev' -WorkingDirectory $root -PassThru

  try {
    Wait-Process -Id $api.Id, $web.Id -ErrorAction SilentlyContinue
  } finally {
    Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $web.Id -Force -ErrorAction SilentlyContinue
  }
} finally {
  Pop-Location
}
