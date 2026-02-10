# Quick script to run the pending status migration
# This adds 'pending' status to user_status enum

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Adding PENDING status to user_status enum" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

& "$PSScriptRoot\run-migration.ps1" -MigrationFile "add_pending_status_to_user_status_enum.sql"
