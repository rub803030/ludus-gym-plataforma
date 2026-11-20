<#
.SYNOPSIS
Crea un commit con rub803030 como autor principal y Alan + Alejandro como coautores.

.EXAMPLE
git add -A
pnpm commit -m "feat: nueva pantalla"
#>
param(
  [Parameter(Mandatory = $true)][string]$Message,
  [switch]$All
)

$ErrorActionPreference = 'Stop'

$trailers = @(
  'Co-authored-by: Alan-2023Dts <alancitomukul@outlook.com>',
  'Co-authored-by: alecanche04-cyber <alecanche328@gmail.com>'
)

if ($All) {
  git add -A
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

git commit -m $Message -m ($trailers -join "`n")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host 'Commit creado: autor principal rub803030; Alan y Alejandro como coautores.' -ForegroundColor Green
