#!/usr/bin/env bash
set -euo pipefail
# Usage:
#   export DB_HOST=localhost
#   export DB_PORT=5432
#   export DB_NAME=tango
#   export DB_USER=postgres
#   export DB_PASSWORD=postgres
#   export DB_SSLMODE=disable   # or require
#   ./migrate-up.sh
export PGPASSWORD="${DB_PASSWORD:-}"
CONN="host=${DB_HOST:-localhost} port=${DB_PORT:-5432} dbname=${DB_NAME:-tango} user=${DB_USER:-postgres} sslmode=${DB_SSLMODE:-disable}"
cd "$(dirname "$0")/migrations"
psql "$CONN" -f 01_extensions_up.sql
psql "$CONN" -f 02_triggers_up.sql
psql "$CONN" -f 03_users_up.sql
psql "$CONN" -f 04_auth_sms_codes_up.sql
psql "$CONN" -f 05_terms_agreement_logs_up.sql
psql "$CONN" -f 06_locations_up.sql
psql "$CONN" -f 07_device_block_list_up.sql
psql "$CONN" -f 08_signups_delegated_up.sql
psql "$CONN" -f 09_nickname_blacklist_up.sql
echo "✅ All UP migrations applied."
