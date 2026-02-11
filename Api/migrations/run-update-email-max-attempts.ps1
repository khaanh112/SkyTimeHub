# PowerShell script to update email_queue max_attempts
# This migration increases retry attempts for better email delivery reliability

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir "update_email_queue_max_attempts.sql"

Write-Host "Updating email_queue max_attempts configuration..." -ForegroundColor Cyan

try {
    Write-Host "Connecting to PostgreSQL via Docker..." -ForegroundColor Yellow
    
    Get-Content $sqlFile | docker exec -i sky_postgres psql -U sky -d sky_hr
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Migration completed successfully!" -ForegroundColor Green
        Write-Host "Email queue now allows up to 5 retry attempts (previously 3)" -ForegroundColor Green
    } else {
        Write-Host "Migration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host "Error running migration: $_" -ForegroundColor Red
    exit 1
}
