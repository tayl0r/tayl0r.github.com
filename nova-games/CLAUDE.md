# Nova Games

Subsystem of `tsteil.com` hosting games built by the Nova Middle School
coding club. Each kid gets an isolated Vite project under `nova-games/<name>/`
and deploys to `https://tsteil.com/nova-games/<name>/`.

This document is the source of truth for the subsystem — anyone (including
AI agents) should be able to work on it using only this file plus the
repo's root `CLAUDE.md`.

---

## Directory layout

```
<repo-root>/
  pnpm-workspace.yaml             declares "nova-games/*" as workspaces
  vite.config.ts                  root Vite config; includes nova-games/index.html as an entry
  package.json                    root scripts: build, build:games, new-game
  scripts/
    build-games.mjs               fault-tolerant per-kid build + copy to dist
  nova-games/
    README.md                     this file
    index.html                    landing page at /nova-games/
    new.mjs                       scaffolding script (backs `pnpm new-game`)
    _template/                    starter kit (Pixi.js v8) — NOT deployed
      package.json                name: "@nova-games/_template"
      vite.config.ts              base: "./", outDir: "dist", port: 5173
      tsconfig.json
      index.html
      src/main.ts
    <kidname>/                    one folder per kid, same shape as _template
      ...
```

Any folder inside `nova-games/` whose name does NOT start with `_` or
`.` is treated as a kid's game. The `_template` folder is excluded from
the deploy output (it still builds as part of the workspace, but is
never copied); dot-prefixed folders (e.g. `.claude/`) are ignored.

---

## System components

### 1. Workspace setup

`/pnpm-workspace.yaml`:

```yaml
packages:
  - "nova-games/*"
```

Every directory under `nova-games/` that contains a `package.json` becomes
a pnpm workspace package. A single `pnpm install` at the repo root
installs all kids' dependencies and deduplicates where possible.

### 2. Root Vite config

`/vite.config.ts` is an MPA with `nova-games/index.html` registered as
an entry:

```ts
"nova-games": resolve(__dirname, "nova-games/index.html"),
```

This builds the landing page into `dist/nova-games/index.html`. Kids'
games are NOT root Vite entries — each has its own Vite config and is
built independently (see build-games.mjs below).

### 3. Scaffolding script — `nova-games/new.mjs`

Exposed via root `package.json` as `pnpm new-game <name>`. Steps:

1. Validates `name` against `/^[a-z][a-z0-9-]*$/` (lowercase alphanumeric
   + hyphens, must start with a letter)
2. Refuses if `nova-games/<name>` already exists
3. `cpSync` copies `_template/` → `<name>/`
4. Rewrites `<name>/package.json` → `"name": "@nova-games/<name>"`
5. Rewrites `<name>/index.html` `<title>` to the new name
6. Runs `pnpm install` at the repo root to register the workspace

### 4. Build orchestrator — `scripts/build-games.mjs`

Exposed via `pnpm build:games`. Behavior:

1. Enumerates `nova-games/*` directories, skipping those starting with `_` or `.`
2. For each, spawns `pnpm run build` in that folder with inherited stdio
3. If build exits non-zero → logs failure, adds to `failed[]`, continues
4. If build succeeds and produces `dist/` → `cpSync` to
   `<repo-root>/dist/nova-games/<name>/`
5. Prints a summary: succeeded count + names, failed count + names
6. **Always exits 0** — a broken kid never blocks the deploy

This script supersedes the simpler `copy-games.mjs` we had initially;
don't look for it.

### 5. Root build pipeline

`package.json` scripts:

```json
"dev": "vite --port 4100",
"build": "tsc && vite build && pnpm run build:games",
"build:games": "node scripts/build-games.mjs",
"new-game": "node nova-games/new.mjs",
"test": "tsc --noEmit && biome check .",
"format": "biome format --write ."
```

Build order:
1. `tsc` — type-check root `src/` (kids' TS is NOT included in the root
   tsconfig; each kid has their own)
2. `vite build` — build main site + flyers + nova-games landing page
3. `pnpm run build:games` → `node scripts/build-games.mjs` — build and
   copy each kid's game

### 6. Lint/format scope

`/biome.json` excludes `**/dist` and `**/node_modules` so kids' built
output and local deps don't get linted. Kids' TypeScript source files
ARE linted by `pnpm test` at the root — they must pass Biome's
recommended ruleset, tab indentation, and pass `tsc --noEmit` in the
root project (note: the root tsconfig only includes `src/`, so kids'
TS errors won't fail root tests unless files are pulled in somehow).

### 7. Deploy pipeline

`.github/workflows/deploy.yml` triggers on push to `main`:

```
pnpm install --frozen-lockfile
pnpm run build
# upload dist/ to GitHub Pages
```

`CNAME` at the repo root pins the Pages site to `tsteil.com`.

---

## Creating a new game

```bash
pnpm new-game <name>
```

Constraints on `<name>`:
- Regex: `^[a-z][a-z0-9-]*$`
- Must not already exist in `nova-games/`
- Should not start with `_` (reserved for internal folders like `_template`)

After the script runs the kid has a fully working Pixi.js hello world
at `nova-games/<name>/` and all deps are installed.

## Developing a game

```bash
cd nova-games/<name>
pnpm dev          # starts Vite on http://localhost:5173
pnpm build        # builds to nova-games/<name>/dist/
pnpm preview      # serves the local build
```

Each kid works entirely inside their own folder. They don't touch the
root, don't touch other kids' code, don't share a dev server.

## Swapping engines

The template is Pixi.js v8 for approachability, but any setup works.
Minimum contract for a kid's folder:

1. Lives at `nova-games/<name>/` (name not starting with `_`)
2. Has a `package.json` with a `build` script
3. That script produces a `dist/` folder containing `index.html`

Examples of alternative stacks a kid could use:
- Three.js / Babylon.js for 3D
- Phaser, Excalibur, Kaboom for 2D game frameworks
- Raw `<canvas>` + vanilla TS/JS
- Any bundler (Vite, esbuild, Parcel) — not just Vite

To add a dep:

```bash
cd nova-games/<name>
pnpm add three
```

## Listing a game on the landing page

`nova-games/index.html` is hand-curated. To add a card, edit the file
inside `.game-grid`:

```html
<a href="./<name>/" class="game-card">
  <span class="game-title">Game Title</span>
  <span class="game-author">by Kid Name</span>
  <span class="game-engine">Pixi.js</span>
</a>
```

(No auto-generation — keeping it manual teaches git/PR workflow.)

## Isolation guarantees

What "isolated" means in this subsystem:

| Dimension           | Isolated? | Mechanism                              |
| ------------------- | --------- | -------------------------------------- |
| Dependencies        | Yes       | Separate `package.json` per kid        |
| TypeScript errors   | Yes       | Separate `tsconfig.json` per kid       |
| Dev server          | Yes       | Each kid runs their own `pnpm dev`     |
| Build failures      | Yes       | `build-games.mjs` wraps each in try/catch |
| Deploy failures     | Yes       | Broken kid doesn't block main site     |
| Output URLs         | Yes       | `/nova-games/<name>/` per kid          |

What is NOT isolated:
- Root `pnpm install` is shared — if a kid's `package.json` is malformed,
  install fails for everyone. (Fix: validate their `package.json` before
  committing.)
- Root Biome checks run over every kid's source. A kid with lint errors
  will fail `pnpm test` at the root.

## Verified behavior

The following has been tested end-to-end and should be preserved on
future changes:

- `pnpm new-game alex` creates a working folder with installed deps
- `pnpm new-game Alex` rejects (uppercase)
- `pnpm new-game alex` a second time rejects (exists)
- `pnpm build` with zero kid folders succeeds (build-games reports
  "No kid games to build")
- `pnpm build` with a syntactically broken kid and a working kid: exits
  0, ships the working kid + main site, logs the broken one
- `pnpm test` passes with a freshly created kid (template is lint-clean)
