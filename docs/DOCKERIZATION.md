# Dockerization — Docker-first Development

Date: 2026-09-23 · Phases 0–4 were committed first as a restore point (`178ddb5` on branch `develop`).

## Before → after

```text
Before:  Browser → localhost:3100 → WSL `npm run dev` (Node 22)
                                    Docker: nexora_pg (unused by the app yet)

After:   Browser → 127.0.0.1:3100
                       │
            Docker compose project "nexora" — network nexora_network
             ├── nexora_app   Node 22 · next dev (Turbopack) · source bind-mounted from ~/nextjs-ecommerce
             │       │  DATABASE_URL → nexora_pg:5432
             │       ▼
             └── nexora_pg    PostgreSQL 17 (same container config, data preserved)
```

One app container handles frontend, server components, API routes and (later) Prisma/Auth.js. No separate frontend/backend containers.

## Files

| File | Purpose |
|---|---|
| `Dockerfile` | Dev image: `node:22-bookworm-slim` + `openssl` (for Prisma), `npm ci`, runs as `node` (uid 1000 = WSL user `dell`), `CMD npm run dev -- --hostname 0.0.0.0` |
| `.dockerignore` | Keeps `node_modules`, `.next`, `.git`, `.env*`, `media`, `design`, `docs` out of the build context (source comes via bind mount) |
| `docker-compose.yml` | Adds service `app` (container `nexora_app`); service `db` (container `nexora_pg`) unchanged except the network/volume names |
| `.env.example` | Documents both DB URLs (placeholders only) |

### nexora_app service

| Setting | Value | Why |
|---|---|---|
| Image | `nexora_app:dev` (1.55 GB) | Built from `Dockerfile` |
| Port | `127.0.0.1:3100:3100` | Localhost only, same URL as before |
| Bind mount | `.:/app` | Edit in VS Code/WSL → hot reload in the container |
| Volume `nexora_app_node_modules` → `/app/node_modules` | Linux deps stay in Docker; your WSL `node_modules` (used by VS Code) is not touched |
| Volume `nexora_app_next` → `/app/.next` | Build cache stays separate from WSL |
| `DATABASE_URL` | `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@nexora_pg:5432/${POSTGRES_DB}` | Built from `.env` at start; no password in any tracked file. Overrides the `127.0.0.1` URL in `.env` inside the container. |
| `depends_on` | `db` healthy | App starts after Postgres is ready |
| Restart | `unless-stopped` | Same as the database |

Service keys `app` and `db` are scoped to the `nexora` compose project (only used in `docker compose` commands). Every Docker-level name is prefixed `nexora_`.

## Network/volume rename (user decision)

The user chose `nexora_network` / `nexora_postgres_data` over the Phase 2 names `nexora_net` / `nexora_pg_data`. Steps taken:

1. `docker compose stop db`: clean shutdown (exit 0)
2. Renamed both in `docker-compose.yml`
3. `docker compose up --no-start db`: created the new network and volume, recreated `nexora_pg` **without starting it** (so Postgres couldn't initialize an empty database)
4. Copied the data with a temporary `postgres:17-alpine --rm` container (`cp -a`): **1,271 files, `diff -r` identical**, owner 70:70, mode 700
5. `docker compose up -d db`: log shows *"Database directory appears to contain a database; Skipping initialization"*. Healthy, same databases, and the password from `.env` works.
6. Removed the old `nexora_net` (no containers attached)

**`nexora_pg_data` is kept as a backup.** Delete it only when you're sure: `docker volume rm nexora_pg_data`.

## Verification (checkpoint)

| Check | Result |
|---|---|
| Next.js runs inside `nexora_app` | ✅ `next dev --turbopack -p 3100 --hostname 0.0.0.0`, Node v22.23.2, ready in 1.5 s |
| PostgreSQL runs inside `nexora_pg` | ✅ healthy |
| Both on a Nexora network | ✅ `nexora_network`: nexora_pg 172.23.0.2, nexora_app 172.23.0.3 |
| `http://localhost:3100` | ✅ 200 from WSL **and from Windows** (`Invoke-WebRequest`). Requests appear in the container log; no WSL process listens on 3100. |
| Phase 3 UI | ✅ Title, top bar, search, cart, ALL CATEGORIES, PROMOTION, footer. No default Next.js page. |
| Phase 4 images | ✅ About, banners, category photos, a product photo and a `next/image` optimized image all 200 |
| Hot reload | ✅ Temporary edit to `about-section.tsx` served in ~1 s (`✓ Compiled in 154ms`), then reverted (file identical to commit). **No polling needed**: file events from the WSL ext4 filesystem reach the container. |
| App → DB connectivity | ✅ From inside `nexora_app` with a zero-dependency Node script: DNS `nexora_pg` → 172.23.0.2, TCP OK, **SCRAM-SHA-256 login OK**, read-only query → user `nexora`, db `nexora`, PostgreSQL 17.11 |
| PostgreSQL data preserved | ✅ Byte-identical copy (see above). The database has 0 app tables so far. |
| Other projects untouched | ✅ 15 containers, 7 networks, 23 volumes identical to the snapshot taken before any change |
| No secrets committed | ✅ Password not in any tracked or new file; `.env` still git-ignored |
| `docker compose up -d` reproduces | ✅ Second run: both "Running", no containers recreated |
| `nexora_pg` untouched by adding the app | ✅ Compose config hash of `db` identical before/after the edit; same container ID |
| Lint / typecheck in container | ✅ `docker compose exec app npm run lint`, `npx tsc --noEmit` → exit 0 |
| File ownership | ✅ No root-owned files created in the project |

Also run: one throwaway `docker run --rm node:20-alpine id node` during inspection (existing image, auto-removed) to read the `node` user's uid.

## Daily use

```bash
docker compose up -d                    # start app + db
docker compose logs -f app              # Next.js output
docker compose stop                     # stop both, keep data
docker compose exec app npm run lint    # any npm/npx command runs inside the container
docker compose exec app npm install <pkg>   # add a dependency (updates package.json + the container's node_modules)
docker compose build app && docker compose up -d   # after changing the Dockerfile
```

- **Don't** run `npm run dev` in WSL: port 3100 belongs to `nexora_app`.
- **Never** `docker compose down -v`: it deletes `nexora_postgres_data` (the database). Plain `down` is safe.
- After someone else changes `package.json`/`package-lock.json` (e.g. `git pull`): `docker compose exec app npm ci`.
- Your WSL `node_modules` is only for the editor (VS Code IntelliSense/ESLint). Refresh it with `npm ci` in WSL if needed.

## Notes for Phase 5

- Prisma CLI runs in the container (`docker compose exec app npx prisma …`) and uses `nexora_pg` automatically.
- **Prisma Studio** (port 5555): done in Phase 5 via port mapping + `scripts/studio.mjs` forwarder (Studio itself only binds 127.0.0.1). Run `docker compose exec app npm run db:studio`.
