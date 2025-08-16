#!/usr/bin/env bash
set -euo pipefail
# Danger: this will DROP tables created by the migrations.
export PGPASSWORD="${DB_PASSWORD:-}"
CONN="host=${DB_HOST:-localhost} port=${DB_PORT:-5432} dbname=${DB_NAME:-tango} user=${DB_USER:-postgres} sslmode=${DB_SSLMODE:-disable}"
cd "$(dirname "$0")/migrations"
psql "$CONN" -f 09_nickname_blacklist_down.sql
psql "$CONN" -f 08_signups_delegated_down.sql
psql "$CONN" -f 07_device_block_list_down.sql
psql "$CONN" -f 06_locations_down.sql
psql "$CONN" -f 05_terms_agreement_logs_down.sql
psql "$CONN" -f 04_auth_sms_codes_down.sql
psql "$CONN" -f 03_users_down.sql
psql "$CONN" -f 02_triggers_down.sql
psql "$CONN" -f 01_extensions_down.sql
echo "✅ All DOWN migrations applied (tables dropped)."
