# Phase 1 — Fresh Next.js Install

Date: 2026-09-23 · Ports and names come from [PHASE-0-ENVIRONMENT.md](PHASE-0-ENVIRONMENT.md). No Docker commands were run in this phase.

## Preconditions

| Check | Result |
|---|---|
| `node -v` | v22.23.2 (after `nvm use`) |
| `which node` | `/home/dell/.nvm/versions/node/v22.23.2/bin/node` |
| npm | 10.9.8 |
| `.nvmrc` | exists, contains `22` |
| Existing `.git` / `package.json` in root | neither present, OK to proceed |
| Port 3100 | 0 listeners in WSL (`ss`) and on Windows (`Get-NetTCPConnection`). Container bindings were taken from the Phase 0 `docker inspect` because Docker commands were not allowed in this phase |

Note: the global nvm default is still 20. Every new shell in this project needs `nvm use`, or an auto-switch hook, to pick up 22.

## Installed versions

| Package | package.json | Installed |
|---|---|---|
| next | 15.5.26 | 15.5.26 |
| react / react-dom | 19.1.0 | 19.1.0 |
| typescript | ^5 | 5.9.3 |
| tailwindcss | ^4 | 4.3.3 |
| @tailwindcss/postcss | ^4 | 4.3.3 |
| eslint | ^9 | 9.39.5 |
| eslint-config-next | 15.5.26 | 15.5.26 |
| @types/node | ^20 | (as scaffolded) |

## Tailwind note: v4 installed

**Tailwind CSS v4** was installed. There is **no `tailwind.config.ts`**. Configuration is CSS-based:
- `src/app/globals.css` starts with `@import "tailwindcss";` and defines tokens in an `@theme inline { ... }` block.
- PostCSS uses `@tailwindcss/postcss` (`postcss.config.mjs`).

**Impact on Phase 3:** the plan says "extract colors, type scale, spacing … into `tailwind.config.ts`". With v4, the tokens go into `@theme` in `globals.css` (e.g. `--color-brand-red: #…;` → `bg-brand-red`). The plan wording should be adjusted before Phase 3.

## Commands run

```bash
nvm use                                   # → v22.23.2
npx --yes create-next-app@15 app-tmp --ts --tailwind --eslint --app --src-dir \
    --import-alias "@/*" --use-npm --turbopack
mv -n app-tmp/{*,.[!.]*} .                # incl. .git and .gitignore; no name conflicts found
rmdir app-tmp
rm -rf node_modules package-lock.json
npm install                               # fresh install at root: 330 packages
npm pkg set name=nexora scripts.dev="next dev --turbopack -p 3100" \
    scripts.start="next start -p 3100" engines.node=">=22"
npm run lint
npx tsc --noEmit
npm run dev   → curl -I http://localhost:3100 → stopped
```

Merge details:
- The root had no `.git`, so the scaffolded repo was kept. It has one commit, `9db165c Initial commit from Create Next App`. `design/`, `docs/`, `media/`, `.nvmrc` and `CLAUDE.md` are currently **untracked**. Nothing else has been committed.
- The root had no `README.md`, so the Next.js one was kept.
- The package name was `app-tmp` (from the temp folder) and was renamed to `nexora` in `package.json` and `package-lock.json`.

Final `package.json` scripts / engines:
```json
"scripts": {
  "dev": "next dev --turbopack -p 3100",
  "build": "next build --turbopack",
  "start": "next start -p 3100",
  "lint": "eslint"
},
"engines": { "node": ">=22" }
```

## Checkpoint results

| Check | Result |
|---|---|
| `npm run lint` | ✅ exit 0, no warnings |
| `npx tsc --noEmit` | ✅ exit 0 |
| Dev server | ✅ `Next.js 15.5.26 (Turbopack)`, `Local: http://localhost:3100`, ready in 1.1 s |
| Listener | ✅ `*:3100` owned by `next-server (v15.5.26)` |
| `curl -I http://localhost:3100` | ✅ `HTTP/1.1 200 OK`, page title "Create Next App" |
| Server stopped | ✅ 0 listeners on 3100 afterwards, no `next` processes left |
| `design/`, `docs/`, `media/` intact | ✅ md5 of all 11 files identical before/after (docs/ now also has this report) |

## Warnings

1. **`npm audit`: 2 vulnerabilities (1 moderate, 1 high)** in the `postcss` copy bundled inside `next` (`node_modules/next/node_modules/postcss`, GHSA-qx2v-qp2m-jg93 and related). The only fix npm offers is `npm audit fix --force`, which installs **next@16**. That breaks the Next.js 15 pin, so it was **not applied**. Re-check when a patched 15.5.x is released.
2. `eslint@9.39.5` prints an npm "no longer supported" deprecation warning. Lint works. Left as installed by create-next-app.
3. `@types/node` is `^20` while the runtime is Node 22. This is harmless for now and can be bumped to `^22` later if Node 22-only APIs are used.
4. `tsc --noEmit` writes `tsconfig.tsbuildinfo` (incremental build cache). It is git-ignored (`*.tsbuildinfo`).

## Final tree (depth 2, excluding node_modules, .next, .git)

```
.
├── design/nexora-full-with-admin.html
├── docs/{PHASE-0-ENVIRONMENT.md, PHASE-1-INSTALL.md, PROJECT-PLAN.md}
├── media/{category/, products/, 5 × .webp}
├── public/{file,globe,next,vercel,window}.svg
├── src/app/{favicon.ico, globals.css, layout.tsx, page.tsx}
├── .gitignore  .nvmrc  CLAUDE.md  README.md
├── eslint.config.mjs  next-env.d.ts  next.config.ts  postcss.config.mjs
├── package.json  package-lock.json  tsconfig.json  tsconfig.tsbuildinfo
```
