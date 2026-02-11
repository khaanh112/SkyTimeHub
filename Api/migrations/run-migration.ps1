# Run migration script for SkyTimeHub PostgreSQL database
# This script connects to PostgreSQL and executes a migration file

param(
    [Parameter(Mandatory=$false)]
    [string]$MigrationFile = "add_pending_status_to_user_status_enum.sql"
)

# Database connection parameters
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "sky_hr"
$DB_USER = "sky"
$DB_PASSWORD = "sky123"

$MigrationPath = Join-Path $PSScriptRoot $MigrationFile

# Check if migration file exists
if (-not (Test-Path $MigrationPath)) {
    Write-Host "Error: Migration file not found: $MigrationPath" -ForegroundColor Red
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SkyTimeHub Database Migration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Migration file: $MigrationFile" -ForegroundColor Yellow
Write-Host "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}" -ForegroundColor Yellow
Write-Host ""

# Set PGPASSWORD environment variable
$env:PGPASSWORD = $DB_PASSWORD

try {
    Write-Host "Running migration..." -ForegroundColor Green
    
    # Run migration using psql
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $MigrationPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Migration completed successfully!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "Migration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "Error running migration:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "1. PostgreSQL client (psql) is installed and in PATH" -ForegroundColor Yellow
    Write-Host "2. Docker PostgreSQL container is running: docker-compose up -d" -ForegroundColor Yellow
    Write-Host "3. Database connection parameters are correct" -ForegroundColor Yellow
    
    exit 1
} finally {
    # Clear PGPASSWORD
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
