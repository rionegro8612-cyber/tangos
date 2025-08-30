# Docker 설치 스크립트 (관리자 권한으로 실행)
Write-Host "🐳 Docker Desktop 설치를 시작합니다..." -ForegroundColor Green

# Chocolatey 설치
Write-Host "1. Chocolatey 설치 중..." -ForegroundColor Yellow
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Docker Desktop 설치
Write-Host "2. Docker Desktop 설치 중..." -ForegroundColor Yellow
choco install docker-desktop -y

Write-Host "✅ Docker Desktop 설치가 완료되었습니다!" -ForegroundColor Green
Write-Host "🔄 시스템을 재시작한 후 Docker Desktop을 실행하세요." -ForegroundColor Cyan
Write-Host "📖 설치 후 확인: docker --version" -ForegroundColor Cyan

# 설치 확인
try {
    $dockerVersion = docker --version 2>$null
    if ($dockerVersion) {
        Write-Host "🎉 Docker가 정상적으로 설치되었습니다: $dockerVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️ Docker 설치 확인 중 오류가 발생했습니다." -ForegroundColor Yellow
}









