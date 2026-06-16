.DEFAULT_GOAL := help

# ─── Dev ───────────────────────────────────────────────────────────────────────

.PHONY: install dev test test-watch format format-check typecheck

install: ## Install dependencies
	npm install

dev: ## Start development server (http://localhost:3000)
	npm run dev

test: ## Run tests once
	npm test

test-watch: ## Run tests in watch mode
	npm run test:watch

format: ## Format all source files with Prettier
	npm run format

format-check: ## Check formatting without writing
	npm run format:check

typecheck: ## Type-check without emitting
	npx tsc --noEmit

# ─── Build & Production ────────────────────────────────────────────────────────

.PHONY: build start

build: ## Build for production (outputs dist/)
	npm run build

start: build ## Build then start the production server
	npm start

# ─── Docker ────────────────────────────────────────────────────────────────────

.PHONY: docker-up docker-down docker-logs docker-rebuild

docker-up: ## Start container (build if needed)
	docker compose up -d

docker-down: ## Stop and remove container
	docker compose down

docker-logs: ## Tail container logs
	docker compose logs -f

docker-rebuild: ## Force rebuild image and restart
	docker compose up -d --build

# ─── Maintenance ───────────────────────────────────────────────────────────────

.PHONY: reset-state clean

reset-state: ## Delete the persisted distribution state (data/distribution.json)
	@rm -f data/distribution.json && echo "Distribution state reset."

clean: ## Remove build artefacts
	rm -rf dist .output .nitro .tanstack .vinxi

# ─── Help ──────────────────────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
