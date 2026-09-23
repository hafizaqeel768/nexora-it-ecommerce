# Phase 2 — Docker: Database Only

Date: 2026-09-23 · Ports and names come from [PHASE-0-ENVIRONMENT.md](PHASE-0-ENVIRONMENT.md).

## Pre-checks (run immediately before creating anything)

| Check | Result |
|---|---|
| Running containers | none |
| Port 5432, WSL listeners (`ss`) | 0 |
| Port 5432, Windows listeners | 0 |
| Port 5432/5433 in any container's `HostConfig.PortBindings` (all 15, incl. stopped) | none |
| `nexora` in container / network / volume / compose project names | no matches |
| Baseline snapshot of containers, networks, volumes | saved for the before/after diff |

## What was created

| File | Purpose | In git? |
|---|---|---|
| `docker-compose.yml` | Postgres service only | tracked |
| `.env` | Real credentials (random 32-hex password, `chmod 600`) + `DATABASE_URL` | **ignored** (`.env*`) |
| `.env.example` | Template with `change-me` placeholders | tracked (`!.env.example` added to `.gitignore`) |

| Docker resource | Value |
|---|---|
| Compose project | `nexora` (top-level `name:`) |
| Container | `nexora_pg` |
| Image | `postgres:17-alpine` → PostgreSQL 17.11 |
| Network | `nexora_net` (bridge, explicit name) |
| Volume | `nexora_pg_data` (explicit name, no project prefix) |
| Port | `127.0.0.1:5432 → 5432`, bound to localhost only, not exposed to the LAN |
| Restart policy | `unless-stopped` |
| Healthcheck | `pg_isready` every 5 s |

Design choices:
- **Postgres 17, not 18.** Postgres 18's official image changed the data directory layout (`/var/lib/postgresql/18/docker`), and tooling support is less settled. 17 is a stable major with long support (to Nov 2029).
- **Credentials only in `.env`.** The compose file uses `${VAR:?}`, so it fails loudly if `.env` is missing rather than starting with blank credentials.
- **`DATABASE_URL` uses `127.0.0.1`, not `localhost`.** On Windows, `localhost` tries `::1` first, and that fails (the port is IPv4-only). Using the IP avoids the same problem for Node/Prisma.

## Commands run

```bash
docker compose config --quiet     # valid
docker compose up -d              # pulled postgres:17-alpine; created volume, network, container
```

## Checkpoint results

| Check | Result |
|---|---|
| `docker compose up -d` | ✅ succeeded |
| Health | ✅ `Up (healthy)` |
| Login + query | ✅ `psql` as `nexora` → `PostgreSQL 17.11`, `current_user=nexora`, `current_database=nexora`, 0 tables in `public` |
| Password actually enforced | ✅ Over the network path, a wrong password gives `FATAL: password authentication failed for user "nexora"`. (Connections from `127.0.0.1` *inside* the container are `trust` by the image's default `pg_hba.conf`. That's normal and not reachable from outside.) |
| Host port from WSL | ✅ `nc` connects to `127.0.0.1:5432`, and the Postgres protocol answers (SSLRequest → `N`) |
| Host port from Windows | ✅ `Test-NetConnection 127.0.0.1:5432` → `TcpTestSucceeded: True` (`::1` fails, so use `127.0.0.1` in GUI clients) |
| LAN exposure | ✅ listener is `127.0.0.1:5432` only |
| **No impact on other projects** | ✅ The other 15 containers are identical before/after (IDs, names, states). Networks: only `nexora_net` added. Volumes: only `nexora_pg_data` added. The other 4 compose projects are unchanged. |

## Connecting with a DB client (DBeaver / pgAdmin / TablePlus on Windows)

| Field | Value |
|---|---|
| Host | `127.0.0.1` (not `localhost`) |
| Port | `5432` |
| Database | `nexora` |
| User | `nexora` |
| Password | value of `POSTGRES_PASSWORD` in `~/nextjs-ecommerce/.env` |

From WSL without a GUI: `docker exec -it nexora_pg psql -U nexora -d nexora`

## Day-to-day commands (run from ~/nextjs-ecommerce)

```bash
docker compose up -d       # start
docker compose stop        # stop (data kept)
docker compose ps          # status
docker compose logs -f db  # logs
```

⚠️ `docker compose down -v` **deletes the `nexora_pg_data` volume and all data.** Plain `docker compose down` removes the container and network but keeps the volume.

Note: `restart: unless-stopped` means `nexora_pg` starts automatically whenever Docker Desktop starts, unless you stopped it with `docker compose stop`.
