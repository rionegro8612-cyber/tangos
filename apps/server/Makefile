.PHONY: dc.up dc.down dc.logs dc.migrate dc.smoke dc.clean

dc.up:
	docker compose up -d db server web

dc.down:
	docker compose down

dc.logs:
	docker compose logs -f --tail=200

dc.migrate:
	docker compose up -d db migrator ; \
	docker compose exec migrator psql -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" ; \
	docker compose exec migrator sh -lc 'set -e; for f in $$(ls -1 /migrations/*.sql | sort); do echo ">> $$f"; psql -v ON_ERROR_STOP=1 -f "$$f"; done; echo "OK: migrations applied"'; \
	docker compose rm -sf migrator

dc.smoke:
	bash scripts/smoke.sh

dc.clean:
	docker compose rm -sf migrator || true ; \
	docker volume prune -f
