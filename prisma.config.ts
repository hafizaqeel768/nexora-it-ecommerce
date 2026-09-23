// Prisma 7 config. DATABASE_URL comes from the environment: inside nexora_app, docker-compose.yml
// sets it to postgresql://…@nexora_pg:5432/… (Prisma 7 does not read .env by itself).
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
