# Nexora IT — Rules for Claude Code

## This machine runs multiple projects
This WSL + Docker setup is shared with other projects (e.g. laravel-ecommerce, old magento249 volumes, and others). Their containers, networks, volumes, and ports must NEVER be touched.

## Port rule (always apply)
- Before using ANY port, check it's free: `docker ps -a` (including stopped containers), `ss -tulpn`, and Windows-side listeners.
- If a port is busy or reserved by another project (even a stopped container), DO NOT use it. Pick the next free port, verify it, and use that instead.
- Never stop, remove, or reconfigure another project's container to free a port.
- Record every chosen port in docs/PHASE-0-ENVIRONMENT.md.

## Current agreed ports (from Phase 0)
- Next.js dev server: 3100 (runs in the nexora_app container, not in WSL)
- Postgres (host): 5432 (fallback 5433, also verified free)
- Prisma Studio: 5555
- Mailpit web UI (nexora_mailpit, Phase 10): 8025

## Naming rule
- Everything Docker-related is prefixed `nexora_` (containers nexora_app + nexora_pg + nexora_mailpit, network nexora_network, volumes nexora_postgres_data / nexora_app_node_modules / nexora_app_next, compose project nexora). nexora_pg_data is the pre-rename backup of the DB volume.
- Before creating any name, check it doesn't already exist.

## Scope rule
- Only work inside ~/nextjs-ecommerce.
- One phase at a time. Stop at each checkpoint and wait for my confirmation.
- If anything would affect another project, stop and ask first.