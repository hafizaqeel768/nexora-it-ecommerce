# Nexora IT — Next.js E-Commerce

Full documentation: **[docs/NEXORA-DOCUMENTATION.md](docs/NEXORA-DOCUMENTATION.md)**

Development runs in Docker (see `docs/DOCKERIZATION.md`). First time: `cp .env.example .env` and set a password.

```bash
docker compose up -d          # start nexora_app (Next.js) + nexora_pg (PostgreSQL) + nexora_mailpit
docker compose logs -f app    # follow the Next.js dev server
docker compose stop           # stop everything (data is kept)
```

Open http://localhost:3100. Run project commands inside the app container, e.g. `docker compose exec app npm run lint`.
Don't run `npm run dev` directly in WSL: port 3100 belongs to `nexora_app`.
