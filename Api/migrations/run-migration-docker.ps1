# Run migration using Docker (no need to install psql locally)
# This script uses docker exec to run migration inside the PostgreSQL container

param(
    [Parameter(Mandatory=$false)]
    [string]$MigrationFile = "add_pending_status_to_user_status_enum.sql"
)

$ContainerName = "sky_postgres"
$DB_NAME = "sky_hr"
$DB_USER = "sky"

$MigrationPath = Join-Path $PSScriptRoot $MigrationFile

# Check if migration file exists
if (-not (Test-Path $MigrationPath)) {
    Write-Host "Error: Migration file not found: $MigrationPath" -ForegroundColor Red
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SkyTimeHub Database Migration (Docker)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Migration file: $MigrationFile" -ForegroundColor Yellow
Write-Host "Container: $ContainerName" -ForegroundColor Yellow
Write-Host "Database: $DB_NAME" -ForegroundColor Yellow
Write-Host ""

# Check if container is running
Write-Host "Checking if PostgreSQL container is running..." -ForegroundColor Yellow
$containerRunning = docker ps --filter "name=$ContainerName" --format "{{.Names}}"

if ($containerRunning -ne $ContainerName) {
    Write-Host "Error: PostgreSQL container '$ContainerName' is not running" -ForegroundColor Red
    Write-Host "Start it with: docker-compose up -d" -ForegroundColor Yellow
    exit 1
}

Write-Host "Container is running ✓" -ForegroundColor Green
Write-Host ""

try {
    Write-Host "Copying migration file to container..." -ForegroundColor Green
    docker cp $MigrationPath "${ContainerName}:/tmp/migration.sql"
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to copy migration file to container"
    }
    
    Write-Host "Executing migration..." -ForegroundColor Green
    docker exec -i $ContainerName psql -U $DB_USER -d $DB_NAME -f /tmp/migration.sql
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Cleaning up..." -ForegroundColor Green
        docker exec -i $ContainerName rm /tmp/migration.sql
        
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
    exit 1
}
