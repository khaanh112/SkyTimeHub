# PowerShell script to run the user_approver constraint fix migration
# This fixes the duplicate key constraint error

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir "fix_user_approver_unique_constraint.sql"

Write-Host "Running user_approver constraint fix migration..." -ForegroundColor Cyan

# Check if running in Docker or local
$env:PGPASSWORD = "root"
$dbHost = "localhost"
$dbPort = "5434"  # Adjust if your Docker PostgreSQL port is different
$dbName = "skytimehub"
$dbUser = "postgres"

# Try to run the migration
try {
    Write-Host "Connecting to database at ${dbHost}:${dbPort}..." -ForegroundColor Yellow
    
    Get-Content $sqlFile | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Migration completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "Migration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host "Error running migration: $_" -ForegroundColor Red
    exit 1
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
