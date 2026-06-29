#!/usr/bin/env pwsh
# Сборка Docker-образа на ПК и загрузка на сервер (когда на VPS нет исходящего интернета).
# Usage:
#   .\deploy\scripts\deploy-from-pc.ps1
#   .\deploy\scripts\deploy-from-pc.ps1 -Server root@5.129.250.215 -RemotePath /opt/Auto-crm

param(
  [string]$Server = "root@5.129.250.215",
  [string]$RemotePath = "/opt/Auto-crm",
  [string]$ImageTag = "deploy-app:latest",
  [string]$TarName = "auto-crm-app.tar"
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $Root

Write-Host "==> Проверка Docker..." -ForegroundColor Cyan
docker version | Out-Null

Write-Host "==> Сборка образа $ImageTag ..." -ForegroundColor Cyan
docker build -t $ImageTag .

Write-Host "==> Сохранение образа в $TarName ..." -ForegroundColor Cyan
docker save $ImageTag -o $TarName

Write-Host "==> Архив исходников (src, prisma, Dockerfile) ..." -ForegroundColor Cyan
$SrcTar = "auto-crm-src.tar.gz"
if (Get-Command tar -ErrorAction SilentlyContinue) {
  tar -czf $SrcTar --exclude=node_modules --exclude=.next src prisma Dockerfile docker package.json package-lock.json 2>$null
  if (-not (Test-Path $SrcTar)) {
    tar -czf $SrcTar src prisma Dockerfile docker package.json
  }
} else {
  Write-Warn "tar не найден — загрузите только образ; код обновите вручную"
  $SrcTar = $null
}

Write-Host "==> Загрузка на сервер $Server ..." -ForegroundColor Cyan
scp $TarName "${Server}:/opt/"
if ($SrcTar -and (Test-Path $SrcTar)) {
  scp $SrcTar "${Server}:/opt/"
}

Write-Host ""
Write-Host "==> На сервере выполните:" -ForegroundColor Green
Write-Host @"
  docker load -i /opt/$TarName
  cd $RemotePath
  tar -xzf /opt/$SrcTar -C . 2>/dev/null || true
  docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --no-build app
  docker logs auto-crm-app --tail 30
"@

Write-Host "Готово." -ForegroundColor Green
