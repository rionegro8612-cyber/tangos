# PowerShell: Migrate DOWN (DANGER: drops tables)
$ErrorActionPreference = "Stop"
$env:PGPASSWORD = $env:DB_PASSWORD
$Conn = "host=$($env:DB_HOST) port=$($env:DB_PORT) dbname=$($env:DB_NAME) user=$($env:DB_USER) sslmode=$($env:DB_SSLMODE)"
Push-Location (Join-Path $PSScriptRoot "migrations")
psql $Conn -f 09_nickname_blacklist_down.sql
psql $Conn -f 08_signups_delegated_down.sql
psql $Conn -f 07_device_block_list_down.sql
psql $Conn -f 06_locations_down.sql
psql $Conn -f 05_terms_agreement_logs_down.sql
psql $Conn -f 04_auth_sms_codes_down.sql
psql $Conn -f 03_users_down.sql
psql $Conn -f 02_triggers_down.sql
psql $Conn -f 01_extensions_down.sql
Pop-Location
Write-Host "✅ All DOWN migrations applied (tables dropped)."
