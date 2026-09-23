# Nexora IT — development image for the Next.js app (nexora_app).
# Source code is bind-mounted at runtime (see docker-compose.yml); this image only holds Node and node_modules.
# Node 22 matches .nvmrc. Debian slim (glibc) rather than Alpine for smoother native deps (Prisma, sharp).
FROM node:22-bookworm-slim

# openssl: required by Prisma's query engine (Phase 5).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Pre-create the dirs that get Docker volumes so they are owned by "node" (uid 1000 = the WSL user).
RUN mkdir -p /app/node_modules /app/.next && chown -R node:node /app

USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

EXPOSE 3100

# Listen on all interfaces inside the container; the port comes from package.json ("-p 3100").
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
