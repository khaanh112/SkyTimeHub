# Run gender column migration using Docker
# This script uses docker exec to run migration inside the PostgreSQL container

$MigrationFile = "add_gender_column.sql"
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
Write-Host "Adding Gender Column Migration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Migration file: $MigrationFile" -ForegroundColor Yellow
Write-Host "Container: $ContainerName" -ForegroundColor Yellow
Write-Host "Database: $DB_NAME" -ForegroundColor Yellow
Write-Host ""

# Check if container is running
Write-Host "Checking if PostgreSQL container is running..." -ForegroundColor Yellow
$containerStatus = docker ps --filter "name=$ContainerName" --format "{{.Names}}"

if ($containerStatus -ne $ContainerName) {
    Write-Host "Error: Container '$ContainerName' is not running!" -ForegroundColor Red
    Write-Host "Please start it with: docker-compose up -d" -ForegroundColor Yellow
    exit 1
}

Write-Host "Container is running!" -ForegroundColor Green
Write-Host ""

# Copy migration file to container
Write-Host "Copying migration file to container..." -ForegroundColor Yellow
docker cp $MigrationPath "${ContainerName}:/tmp/migration.sql"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to copy migration file to container!" -ForegroundColor Red
    exit 1
}

# Run migration
Write-Host "Running migration..." -ForegroundColor Yellow
docker exec $ContainerName psql -U $DB_USER -d $DB_NAME -f /tmp/migration.sql

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Migration completed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    
    # Cleanup
    docker exec $ContainerName rm /tmp/migration.sql
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "Migration failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}
