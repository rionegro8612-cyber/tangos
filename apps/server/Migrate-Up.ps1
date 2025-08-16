# PowerShell: Migrate UP for PostgreSQL
# Usage (set env vars in current session):
#   $env:DB_HOST="localhost"
#   $env:DB_PORT="5432"
#   $env:DB_NAME="tango"
#   $env:DB_USER="postgres"
#   $env:DB_PASSWORD="postgres"
#   $env:DB_SSLMODE="disable"   # or "require"
#   .\Migrate-Up.ps1
$ErrorActionPreference = "Stop"
$env:PGPASSWORD = $env:DB_PASSWORD
$Conn = "host=$($env:DB_HOST) port=$($env:DB_PORT) dbname=$($env:DB_NAME) user=$($env:DB_USER) sslmode=$($env:DB_SSLMODE)"
Push-Location (Join-Path $PSScriptRoot "migrations")
psql $Conn -f 01_extensions_up.sql
psql $Conn -f 02_triggers_up.sql
psql $Conn -f 03_users_up.sql
psql $Conn -f 04_auth_sms_codes_up.sql
psql $Conn -f 05_terms_agreement_logs_up.sql
psql $Conn -f 06_locations_up.sql
psql $Conn -f 07_device_block_list_up.sql
psql $Conn -f 08_signups_delegated_up.sql
psql $Conn -f 09_nickname_blacklist_up.sql
Pop-Location
Write-Host "✅ All UP migrations applied."
