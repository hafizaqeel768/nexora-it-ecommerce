# Nexora IT — Rules for Claude Code

## This machine runs multiple projects
This WSL + Docker setup is shared with other projects (e.g. laravel-ecommerce, old magento249 volumes, and others). Their containers, networks, volumes, and ports must NEVER be touched.

## Port rule (always apply)
- Before using ANY port, check it's free: `docker ps -a` (including stopped containers), `ss -tulpn`, and Windows-side listeners.
- If a port is busy or reserved by another project (even a stopped container), DO NOT use it. Pick the next free port, verify it, and use that instead.
- Never stop, remove, or reconfigure another project's container to free a port.
- Record every chosen port in docs/PHASE-0-ENVIRONMENT.md.

## Current agreed ports (from Phase 0)
- Next.js dev server: 3100
- Postgres (host): 5432 (fallback 5433, also verified free)
- Prisma Studio: 5555
- Spare (e.g. Mailpit): 8025

## Naming rule
- Everything Docker-related is prefixed `nexora_` (container nexora_pg, network nexora_net, volume nexora_pg_data, compose project nexora).
- Before creating any name, check it doesn't already exist.

## Scope rule
- Only work inside ~/nextjs-ecommerce.
- One phase at a time. Stop at each checkpoint and wait for my confirmation.
- If anything would affect another project, stop and ask first.