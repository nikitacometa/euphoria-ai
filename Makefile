-include .env
export

.PHONY: up up-build down clean restart logs db-shell db-ui

up: ## Start bot + MongoDB
	docker compose up -d

up-build: ## Rebuild images and start
	docker compose up -d --build

down: ## Stop all containers
	docker compose down

clean: ## Stop containers and remove volumes (wipes the database)
	docker compose down -v

restart: ## Restart all containers
	docker compose restart

logs: ## Follow bot logs
	docker compose logs -f bot

db-shell: ## Open a mongosh shell inside the MongoDB container
	docker compose exec mongodb mongosh -u "$(MONGODB_USER)" -p "$(MONGODB_PASSWORD)" --authenticationDatabase admin

db-ui: ## Start Mongo Express on http://127.0.0.1:8081
	docker compose --profile tools up -d mongo-express
