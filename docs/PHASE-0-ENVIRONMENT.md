# Phase 0 — Environment Check

Date: 2026-09-23 (revised same day after checkpoint review) · Read-only audit. Nothing was created, started, stopped, installed, or modified.

## 1. Environment summary

| Item | Value |
|---|---|
| WSL distro | Ubuntu 24.04.4 LTS (noble), WSL version 2 (`wsl.exe -l -v`: `Ubuntu` Running v2, `docker-desktop` Running v2) |
| Kernel | 6.18.33.2-microsoft-standard-WSL2 |
| Project path | `/home/dell/nextjs-ecommerce` on ext4 (`/dev/sdf`), Linux filesystem, **not** `/mnt/c` |
| Project contents | `design/nexora-full-with-admin.html` (790 KB), `docs/PROJECT-PLAN.md`, `media/` (with `products/`, `category/`, 5 top-level `.webp` images) |
| nvm | 0.40.1 (`~/.nvm`) |
| Node (active) | v20.20.2, `nvm` default alias `20`, path `/home/dell/.nvm/versions/node/v20.20.2/bin/node`. **Project will use Node 22 via `.nvmrc`** (see §4) |
| npm | 10.8.2 |
| Other Node on PATH | `/usr/bin/node` v18.19.1 (apt package `nodejs`), shadowed by nvm when nvm is loaded |
| Docker client | 29.7.2 (`/usr/bin/docker` → `/mnt/wsl/docker-desktop/cli-tools/usr/bin/docker`) |
| Docker server | Docker Desktop 4.90.0, Engine 29.7.2, containerd v2.3.3 |
| `docker info` OS | Docker Desktop (name `docker-desktop`) |
| Docker context | `default *` → `unix:///var/run/docker.sock` (also `desktop-linux` context present) |
| Docker Compose | v5.5.1 |
| Integration status | **Docker Desktop WSL integration.** No `dockerd` process in this distro, `systemctl is-active docker` = inactive, no docker/containerd apt packages installed, CLI is provided by Docker Desktop's mount. |

## 2. Existing Docker resources and ports (as found)

### Containers (all currently stopped)

| Name | Image | Status | Compose project | Host port bindings |
|---|---|---|---|---|
| magento_react_frontend | magento-react-frontend | Exited (0) | magento-react | 3002→3000 |
| magento_react_db | mysql:8.4 | Exited (0) | magento-react | none |
| magento_react_app | magento-react-app | Exited (0) | magento-react | none |
| magento_react_nginx | nginx:1.30-alpine | Exited (0) | magento-react | 8085→80 |
| magento_react_redis | redis:7-alpine | Exited (0) | magento-react | none |
| magento_react_opensearch | opensearchproject/opensearch:3 | Exited (143) | magento-react | none |
| ha_portfolio | ha-portfolio-nextjs | Exited (255) | ha-portfolio | 3001→3000 |
| nextjs_frontend | node:20-alpine | Exited (255) | laravel-ecommerce | **3000→3000** |
| laravel_nginx | nginx:stable-alpine | Exited (255) | laravel-ecommerce | 8081→80 |
| laravel_app | laravel-ecommerce-app | Exited (255) | laravel-ecommerce | none |
| laravel_mysql | mysql:8.0 | Exited (137) | laravel-ecommerce | 3307→3306 |
| magento_app | webdevops/php-nginx:8.3 | Exited (137) | magento2 | 80→80 |
| magento_redis | redis:7 | Exited (0) | magento2 | 6379→6379 |
| magento_db | mysql:8.0 | Exited (137) | magento2 | 3306→3306 |
| magento_search | opensearchproject/opensearch:2.5.0 | Exited (137) | magento2 | 9200→9200 |

Host ports reserved by stopped containers (in use again once they start): **80, 3000, 3001, 3002, 3306, 3307, 6379, 8081, 8085, 9200**.

### Networks
`bridge`, `host`, `none`, `ha-portfolio_default`, `laravel_ecommerce_net`, `magento2_default`, `magento-react-network`

### Volumes
Named: `laravel-ecommerce_laravel_dbdata`, `magento2_dbdata`, `magento249_appdata`, `magento249_dbdata`, `magento249_rabbitmqdata`, `magento249_sockdata`, `magento249_ssldata`, `magento_react_dbdata`, `magento_react_frontend_node_modules`, `magento_react_redisdata`, `magento_react_searchdata`
Plus 12 anonymous (hash-named) volumes.

### Compose projects (`docker compose ls -a`)

| Project | Status | Config |
|---|---|---|
| ha-portfolio | exited(1) | /home/dell/projects/ha-portfolio/docker-compose.yml |
| laravel-ecommerce | exited(4) | /home/dell/laravel-ecommerce/docker-compose.yml |
| magento-react | exited(6) | /home/dell/magento-react/docker-compose.yml |
| magento2 | exited(4) | /home/dell/magento2/docker-compose.yml |

The `magento249_*` volumes have no containers attached and no compose project listed.

### Listening ports right now

WSL (`ss -tulpn`): TCP 53 (systemd-resolved / WSL DNS), 13011, 42971, 45265 (127.0.0.1 only, "MainThread" processes); UDP 53, 323.

Windows (`Get-NetTCPConnection -State Listen`): 135, 139, 445, 5040, 13011, 42050, 42971, 44950, 44960, 45265, 49664–49670, 49677, 54242, 55354, 55364, 63066, 64321, 64322.

## 3. SAFE TO USE

Each port was checked against:
- WSL listeners (`ss -tulpn`)
- Windows listeners (`Get-NetTCPConnection`)
- `HostConfig.PortBindings` for all 15 containers, including stopped ones (`docker ps -aq | xargs -r docker inspect ...`)
- Declared `ports:` in every compose project on the machine:
  - `/home/dell/laravel-ecommerce/docker-compose.yml` (plus `backend/.env`, `backend/.env.example`, `frontend/.env.local`, `frontend/package.json`)
  - `/home/dell/projects/ha-portfolio/docker-compose.yml`
  - `/home/dell/magento-react/docker-compose.yml`
  - `/home/dell/magento2/docker-compose.yml`

No source mentions 3100, 5432, 5433, 5555, 1025 or 8025.

Names were checked for exact and substring (`nexora`) matches across containers, networks, volumes and compose projects.

| Purpose | Value | Status |
|---|---|---|
| Next.js dev server | **3100** | ✅ Verified free. (3000 rejected: bound by stopped `nextjs_frontend`, laravel-ecommerce) |
| Postgres (host side) | **5432** | ✅ Verified free. No listener, binding or compose declaration (fallback 5433 also verified free) |
| Prisma Studio | **5555** | ✅ Verified free |
| Mailpit web UI | **8025** | ✅ In use since Phase 10 by `nexora_mailpit` (published on 127.0.0.1 only). Re-verified free on 2026-09-23 before use: no Docker container (running or stopped), no WSL listener, no Windows listener (`netstat.exe -ano`) |
| Mailpit SMTP | **1025** | Not published: the app sends through Mailpit's HTTP API inside `nexora_network`, so 1025 stays free on the host |
| Compose project name | `nexora` | ✅ Verified unused |
| Postgres container | `nexora_pg` | ✅ Verified unused |
| Mail catcher container | `nexora_mailpit` | ✅ Verified unused on 2026-09-23 (no container or volume with "mailpit" in its name); image `axllent/mailpit:v1.31.2` |
| Docker network | `nexora_net` | ✅ Verified unused |
| Postgres volume | `nexora_pg_data` | ✅ Verified unused |
| Database name / user | `nexora` / `nexora` | ✅ New container, no collision possible |
| Node runtime | **22 (LTS) via project `.nvmrc`** | Installed by the user (see §4) |

8080 is not in the table: nothing binds it now, but the `magento249_*` volumes belong to a project whose compose file isn't registered with Docker, and the images on this machine include `linuxserver/phpmyadmin`, which often runs on 8080. If an Adminer port is needed later, re-check at that point.

## 4. Blockers and warnings

No blockers.

1. **Node version: decision is Node 22 via project-local `.nvmrc`.** Found v20.20.2 as the nvm default. It works, but it's upstream EOL (2026-04-30). The user will run these themselves:
   ```
   nvm install 22
   echo "22" > ~/nextjs-ecommerce/.nvmrc
   cd ~/nextjs-ecommerce && nvm use
   ```
   The global nvm default stays at 20 so other projects are unaffected. Run `nvm use` in each new shell in this project (or use an auto-switch hook).
2. **System Node v18.19.1 at `/usr/bin/node`** (apt). Shadowed when nvm is loaded. Non-interactive scripts that don't load nvm could fall back to it. Leave it in place; another project may rely on it.
3. **Port 3000 is reserved** by the stopped `nextjs_frontend` container (laravel-ecommerce, `"3000:3000"` in its compose file). Run the dev server with `next dev -p 3100`.
