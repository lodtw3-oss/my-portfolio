#!/usr/bin/env pwsh
Write-Host "=============================" -ForegroundColor Cyan
Write-Host " 正在啟動 My Portfolio 應用程式 " -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Cyan

# 檢查是否安裝了 Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "錯誤: 找不到 Node.js。請先安裝 Node.js。" -ForegroundColor Red
    exit 1
}

# 執行 npm start 啟動前後端 (使用 concurrently)
npm start
