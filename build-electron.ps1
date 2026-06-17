#!/usr/bin/env pwsh
# One-click build & package script for SLDAgent Electron app.
# Builds all workspaces and then runs electron-builder.
# Packaged artifacts land in ./dist and are NOT committed.
# If PowerShell execution policy blocks this script, run:
#   powershell -ExecutionPolicy Bypass -File .\build-electron.ps1

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Write-Step([string] $message) {
    Write-Host "`n==> $message" -ForegroundColor Cyan
}

function Remove-IfExists([string] $path) {
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path
    }
}

# Some environments default dev=false, which makes electron-builder's nested
# npm install prune dev dependencies such as 7zip-bin. Force include=dev via a
# temporary .npmrc and restore the original file (if any) at the end.
$npmrcPath = [System.IO.Path]::Combine($root, '.npmrc')
$npmrcBackup = $null
if (Test-Path $npmrcPath) {
    $npmrcBackup = Get-Content $npmrcPath -Raw -ErrorAction SilentlyContinue
}
Set-Content -Path $npmrcPath -Value "include=dev`n" -NoNewline

try {
    Write-Step 'Installing dependencies (clean install from lockfile)...'
    npm ci

    Write-Step 'Cleaning previous build artifacts...'
    Remove-IfExists ([System.IO.Path]::Combine($root, 'dist'))
    Remove-IfExists ([System.IO.Path]::Combine($root, 'SourceCode', 'frontend', 'dist'))
    Remove-IfExists ([System.IO.Path]::Combine($root, 'SourceCode', 'backend', 'dist'))
    Remove-IfExists ([System.IO.Path]::Combine($root, 'SourceCode', 'electron', 'dist'))
    Remove-IfExists ([System.IO.Path]::Combine($root, 'SourceCode', 'core', 'dist'))
    Get-ChildItem -Path ([System.IO.Path]::Combine($root, 'SourceCode')) -Recurse -Filter 'tsconfig.tsbuildinfo' -ErrorAction SilentlyContinue | Remove-Item -Force

    Write-Step 'Building all workspaces...'
    npm run build

    Write-Step 'Packaging Electron app...'
    Set-Location ([System.IO.Path]::Combine($root, 'SourceCode', 'electron'))
    $electronVersion = (Get-Content ([System.IO.Path]::Combine($root, 'node_modules', 'electron', 'package.json')) | ConvertFrom-Json).version
    npm exec -- electron-builder --config.electronVersion=$electronVersion
    Set-Location $root

    Write-Step 'Done. Packaged artifacts are in ./dist'
}
finally {
    if ($npmrcBackup -ne $null) {
        Set-Content -Path $npmrcPath -Value $npmrcBackup -NoNewline
    }
    elseif (Test-Path $npmrcPath) {
        Remove-Item $npmrcPath -Force
    }
}
