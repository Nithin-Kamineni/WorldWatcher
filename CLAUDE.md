# WorldWatcher

A Dungeon-Master web app: worlds, campaigns, compendium (creatures/spells/magic
items), maps with fog of war, random tables + encounters, notes, and a
session-running "Play" panel.

Single developer, Windows, PowerShell. There is no CI, no test suite, and no
staging environment — verification is type-check, lint, and running the app.

## Showing progress

**Every task prompt starts with a progress list, and that list is kept live.**
This session has no `TodoWrite` tool, so the list is plain markdown in the
reply: post it as soon as the plan is clear (before the first edit), then
re-post the whole list whenever an item finishes, so the checkboxes advance
while the prompt is still running rather than only at the end.

- One line per step, `- [ ]` / `- [x]`, phrased as the work, not as the file.
- Include the verification step (`tsc -b`, `oxlint`, `npm run build`, running
  the app) as its own item - it is part of the task, not an afterthought.
- If a step turns out to be blocked or deliberately skipped, mark it and say
  why in the same line rather than dropping it off the list.

## Stack

- **Client** — React 19 + TypeScript + Vite 8, MUI v9 (`@mui/material`),
  Zustand v5 for state, React Router v7, TipTap v3 for rich text, Konva +
  react-konva for the map canvas. Lint is **oxlint**, not ESLint.
- **Server** — FastAPI, async SQLAlchemy 2.0 (`asyncpg`), Pydantic v2,
  Alembic for migrations, WebSockets for live map/combat updates.
- **Database** — PostgreSQL 16, database name `WorldWatcher_DB`.
- **Importer** — a separate Python project under `Database/Maintainance/` that
  scrapes/normalises 5e source data and seeds the DB. Its own `.venv`.

## Layout

```
Client/src/
  api/            client.ts (fetch wrapper), types.ts (server DTOs),
                  adapters.ts (DTO <-> domain mapping), resources/ (one
                  module per endpoint group, 25 of them)
  components/     dm/ home/ layout/ map/ notes/ play/ settings/ shell/ world/
  pages/          campaign/ world/ + top-level pages
  store/          one Zustand store per domain (use*Store.ts) + sync/
  types/          domain types (distinct from api/types.ts DTOs)
  hooks/ utils/ theme/ routes/
Server/app/
  api/router.py       aggregates every router under /api
  api/routers/        one module per resource (~32)
  models/             SQLAlchemy ORM
  schemas/            Pydantic request/response
  services/ ws/ core/config.py
Database/Maintainance/
  importer/           scrapers + projectors
  scripts/            seed_*.py and migrate_*.py
  sql/001_schema.sql  full schema (idempotent, safe to re-run)
```

`checklist.txt` in the repo root is the backlog. Keep it updated when you
finish or discover work — do not create new `issues*.txt` / `progress*.txt`
files, they were consolidated into it.

It holds **only open work**: finished items were stripped out on 2026-09-03 so
it reads as a to-do list rather than a history, and it now uses just
⚠️ partial / ❌ not done. Three live backlogs, kept apart on purpose:

- **Part E** — the tail of the two big feature efforts (Play panel redesign;
  Random Tables + Encounters), verified against the code.
- **Part I** — the UI-refinement backlog: what the Play-page refinement round
  did not do, plus the same class of problem elsewhere in the app.
- **Parts F–G** — the older map / notes / articles / shell backlog inherited
  from the deleted `Client/` tracking files. *Not* re-verified — check these
  against the code before acting on them.

**Part H** records where the deleted DB-architecture spec's content survives.
Parts A–D keep only their still-open items; C and D were entirely finished
and are gone.

Many source comments still cite requirement numbers like `issues.txt 10.c.3a`
or `Task 4.3.7`. Those files are gone, and so is the text of every *finished*
requirement — look those numbers up in `checklist.txt`'s **git history** (the
commit before the 2026-09-03 strip). Numbers that are still open resolve
against **Part A** (issues.txt numbering) and **Part B** (task numbering).

### Map coordinates — read this before touching MapCanvas

Tokens, AoE shapes and the grid are stored in **raw stage pixels**. That only
means anything relative to a fixed canvas size, so each floor pins the size its
contents were authored against in `MapFloor.authoredStage` (persisted in
`raw_data`). The background's contain-fit is computed from **that**, never from
the live canvas, which makes it a pure function of stored data — a token's
coordinates mean the same thing forever.

Adapting to whatever window is actually open is a single transform on the Konva
**Stage**, so background, tokens, grid, fog and walls all move together.

- This is why a token used to reappear somewhere else after reopening a map at
  a different window size (`FOG13`). Don't reintroduce a fit derived from the
  live canvas; there is no longer any frozen-fit or frozen-pivot ref, because
  those existed only to paper over this.
- A floor with no `authoredStage` adopts the canvas it is first opened at.
- Walls and the fog mask are stored in **image pixels** instead, and convert
  through the fit — see below.

**Run a real session off the production build.** `npm run dev` is ~10× slower
per token move than `npm run build` + `npm run preview` (224 ms vs a 21.8 ms
median), because React's dev build is slow and `main.tsx` wraps the app in
`<StrictMode>`, which double-renders everything. Profile perf complaints
against the production build before believing them. Konva is rarely the
culprit — canvas raster measured at 1% of blocked time; it is React
reconciliation.

### Fog of war (map page)

Built 2026-09-22, closing `G6`. Three layers, each usable without the next:
manual reveal brushes, then walls + line of sight, then OpenCV wall detection.
See `I-FOG` in `checklist.txt`.

- **Two coordinate spaces, and the split is the whole design.** Tokens, AoE
  shapes and the grid live in raw **stage** pixels. Walls (`types/fog.ts`) and
  the fog mask live in **image** pixels. Image space is what makes them survive
  a re-fit — a wall traced onto a boulder has to stay on that boulder. Convert
  with `utils/mapFit.ts` (`imagePointToStage` / `stagePointToImage`).
- **`MapCanvas` owns the background fit** and passes it to
  `MapBackgroundLayer`, `MapFogLayer` and `MapWallsLayer`, so all of them read
  *the same* one. It derives from `authoredStage` (see the section above), not
  from the live canvas, which is what stops any of it drifting.
- `utils/fogMask.ts` — the explored mask is a **bit-packed boolean grid** over
  the image (~120 cells on the long edge), base64'd into `map_floors.raw_data`
  beside initiative. Not a polygon union: a union grows without bound as the
  party walks. `decodeFogGrid` returns an all-hidden grid for any record that
  is missing, malformed, or sized for a different image — a floor saved before
  fog existed must degrade to "nothing explored", not to garbage.
- `utils/visibility.ts` — angular-sweep visibility polygon. Recomputed only
  when a token moves or a wall changes, never per frame. ~3ms against 1300
  segments.
- `MapFogLayer` gets its own Konva layer so `destination-out` erases *fog* and
  nothing else. Explored areas are punched partially (dim), live line-of-sight
  fully (clear); order matters.
- Fog defaults OFF; every token is a sight source at the map default range
  (an explicit `visionRadius` wins, including an explicit 0 = Blind). Vision
  polygons are memoised PER TOKEN so moving one does not re-sweep the rest.
- **There is no player-facing view in this app**, so fog renders translucent
  for the DM, with a "preview as players see it" toggle. Don't assume a player
  route exists.
- Walls persist to `map_floors.walls` — a JSONB column that predated the
  feature by a long way. `doors` and `terrain` are still unused.
- `Server/app/services/wall_detect.py` — OpenCV, server-side because the asset
  file is already on the server's disk. It **appends** candidates for the DM to
  correct, never overwrites. Control output volume by dropping short contours,
  **not** by raising the `approxPolyDP` epsilon: a heavily simplified contour
  straightens into chords that cut across open floor, inventing sight blockers.

**Performance rules this feature is built around** (it was unusable before —
see `FOG9`, and keep these when touching it):

- **Every store write re-renders the whole map page**, so anything that fires
  per token move must not write. Line-of-sight reveals accumulate into a ref
  and the store write is debounced (`FOG_PERSIST_DEBOUNCE_MS`). Nothing visible
  waits on it — the currently-visible tier draws from `visionPolygons` directly.
- **REST writes echo back to the sender over WS** (`manager.broadcast` has no
  sender to exclude on the REST path), so `applyApiFloorMetaPatch` keeps the
  previous `walls` / `fog` references when the content is unchanged. Rebuilding
  them from JSON gives a new identity, which invalidates the LOS memo and
  re-runs the whole sweep for a payload that did not change.
- **`syncFloorContentChange` sends only changed fields.** `walls` on an
  auto-detected map is ~25 kB; it must not ride along on fog-only PATCHes.
- **Prefer one Konva node over many.** The explored mask is painted into a
  90×120 canvas and drawn as a single `Image`, not one `Rect` per cell run.
- **Watch for object literals passed to layers.** `flipPivot` is a prop on
  every layer; as a fresh literal per render it marked all five layers dirty,
  redrawing the full-size background bitmap on any unrelated page change.

### Edit history (World Manager > "Recently edited")

Built 2026-09-22; see `I-HIST` in `checklist.txt`. That view lists **changes**,
not entities - `entity_revisions` holds one row per create/update/delete/restore
of an article, NPC, homebrew creature or faction.

- **One generic table, and `entity_id` is not an FK.** It points at one of three
  tables depending on `entity_type`, and the row must *outlive* its entity: a
  delete whose history row cascaded away with it is the one change that could
  never be undone. Same looseness as `item_usage.item_id`, different reason.
- **`Server/app/services/revisions.py` is the whole engine** - snapshot, diff,
  summary, retention - and it is called explicitly from the three routers that
  own world content, never from an ORM event hook. A hook would also fire for
  the importer seeding ten thousand compendium creatures.
- **Diff by value, not by which keys were sent.** All three client stores PATCH
  a *full* payload on every save, so `exclude_unset` says "all of them" every
  time. Diffing values is also what makes a no-op save record nothing.
- `before_state` is a full column snapshot and is the only thing Restore reads;
  `changes` is display data (long text truncated, HTML stripped) and is the only
  thing the timeline reads. Restore rewinds the **whole** entry to that moment,
  so later edits to it are undone too - and it can recreate a deleted entity at
  its original id, which is why references to it survive.
- **Retention is 6 hours OR 500 rows per world, whichever is larger** - a row
  must fall outside *both* to be dropped. Pruning runs in its own transaction
  *after* the edit commits, so a failure there can never roll back the save.
  `GET /entity-revisions/policy` serves the numbers so the UI cannot state a
  stale rule.
- Campaign-less creatures are the shared compendium library, not one world's
  content, and are not recorded. Notes, maps, encounters and random tables are
  not tracked yet - adding one is a two-line router change plus an entry in
  `_TRACKED` and the router's `MODELS` map.

### The Play page

The most important screen in the app, and the most machinery per pixel. Worth
knowing before touching it:

- `components/play/layout/playLayoutTrees.ts` — the 6 layouts as row/column
  split trees, **presets that seed an editable copy, not fixed shapes**.
  Splitting a pane writes to `usePlayLayoutStore.customTrees[layoutId]`; picking
  the preset again or "Reset this layout" discards it. Read the live tree with
  `getLayoutTree` / `getLayoutSlots` — never `PLAY_LAYOUTS[id].slots`, which
  only describes the unedited preset. `SplitPane.tsx` is the one generic
  renderer, and `LayoutGlyph.tsx` draws each preset's toolbar icon *from the
  same tree*, so a new preset gets a correct icon for free. Don't hand-pick an
  MUI icon for a layout; that is how the old icons came to show the wrong pane
  counts. Slots are `p1`–`p8`; a split allocates the lowest free one.
- **Both Play stores must tolerate older persisted records.**
  `usePlayLayoutStore.resolve` and `usePlayItemsStore`'s `normalizeSlot` fill in
  fields a record saved before a feature existed is missing. Skipping that is
  how a change that merely *reads more* of the stored shape (a loop over all
  sub-window kinds; a flag that now applies to every pane, not just chat ones)
  took the Play page down twice on 2026-09-04. Verify such changes against a
  hand-injected legacy record, not cleared storage.
- `PaneHeader.tsx` owns `PANE_HEADER_HEIGHT` (40px) and every pane's chrome:
  kind switcher, truncating title, actions, close button — and it is the drag
  handle. All three pane bodies render it; none of them draws its own header.
- Closing a pane sets its kind to `'empty'` (a real `PlayWindowKind`), leaving
  a droppable placeholder; "give space back" marks it in `dismissedPanes` and
  `SessionRunnerWorkspace` prunes it out of the tree, which is what makes the
  effective layout change without changing `layoutId`.
- `paneDrag.tsx` + `PaneDropZone.tsx` — native HTML5 drag; dropping one pane
  header on another swaps them. Both stores swap in step: `usePlayLayoutStore`
  for the assignment, `usePlayItemsStore` for the tab sets and pins.
- **Items state is per pane slot, not per campaign** (`usePlayItemsStore`,
  persist version 2). Two Items windows must behave independently; anything you
  add there takes a `slot`. That slot is typed `ItemsSurface = PaneSlot |
  'map'`, not `PaneSlot`: the map page's sidebar has a **Reference** section
  rendering the same `ItemsWindow` on a fifth `'map'` surface, so the Items
  window is no longer Play-only and a change there shows up in two places. It
  is what lets a map token or an initiative row open its creature in the Stats
  sub-window (`MapPage.showCreatureInReference`).
- **Every Items sub-window is ranked by relevance blended with recorded
  usefulness, never alphabetically, and never starts empty.** `tableSearch.ts`
  holds the ranking (`usageScore` is the kind-agnostic half, `rankByUsefulness`
  the generic ranker, `rankTablesByUsefulness` the table-flavoured one) and
  `useItemUsageStore` the signals, keyed per campaign AND per `ItemsTabKind`.
  All five sub-windows record an open on focus and a use on first expand, and
  all five end in the shared `ItemsBrowseSection` (Browse heading, live count
  chip, `BROWSE_PAGE` rows at a time, "Show N more" plus a scroll sentinel).
  Add a sixth sub-window and it inherits all of that.

## Running it

Two independent options — don't mix them.

**Docker (the whole stack, closest to deployed):**

```powershell
./scripts/up.ps1          # docker compose up -d + prints URLs
```

Serves the app at `http://localhost/campaigns`. Images are pulled from Docker
Hub, not built locally. On first run the DB restores from
`Database/WorldWatcher_DB_Backup_v1.sql`; re-seed with `docker compose down -v`.

**Native dev (what you want for iterating):**

```powershell
# backend - supervised and detached; survives the terminal that started it
./scripts/dev-backend.ps1 -Detached
# frontend
cd Client; npm run dev        # http://localhost:5173
```

### Why the backend kept "randomly stopping"

It never crashed. Both old logs (`Server/server.log`, `server_restart.log`) end
mid-request with no traceback and no shutdown line: the process was **killed**,
because uvicorn was a child of whatever shell or agent session started it and
died with it. Nothing brought it back, and `app.main`'s lifespan opens a DB
connection at startup, so if Postgres is not up yet uvicorn *exits* rather than
retrying.

`scripts/dev-backend.ps1` is the answer to all of that. It reads the port from
`Client/.env` (so the two cannot drift), starts uvicorn from the venv, restarts
it whenever it exits with backoff, and logs to `Server/logs/`.

```powershell
./scripts/dev-backend.ps1 -Detached   # start, hand the prompt back
./scripts/dev-backend.ps1 -Status     # listening? answering /health?
./scripts/dev-backend.ps1 -Stop
./scripts/dev-backend.ps1 -Install    # per-user scheduled task: up after every logon
./scripts/dev-backend.ps1 -Uninstall
```

`-Install` is the only thing that makes it survive a reboot or a logoff, since a
scheduled task runs under the Task Scheduler service rather than under any
terminal. Everything else about the script works without it.

### Ports — read this before starting the backend

The backend port has drifted repeatedly because stale processes hold ports open
and cannot be killed on this machine (8000 → 8001 → 8002 → 8003 → 8006). **The
port is whatever `Client/.env` says**, currently `8006`:

```
VITE_API_BASE_URL=http://localhost:8006/api
VITE_WS_BASE_URL=ws://localhost:8006/ws
```

There is no Vite dev proxy, so the client talks to that absolute URL directly.
If you must move the port, change `Client/.env` and restart Vite, otherwise the
UI silently fails every request. `Server/.env` and `core/config.py` now both say
8006 as well (they said 8000 long after the client moved); the README still says
8001 and is stale. `dev-backend.ps1` reads the port out of `Client/.env`, so use
it rather than retyping a `--port` flag.

Always use `Server/.venv/Scripts/python.exe -m uvicorn`, never a bare
`uvicorn`. Backgrounding a bare `uvicorn` here has silently run under the pyenv
global Python instead of the venv, producing confusing import errors.

**The CORS allowlist used to be 5173-only**, so if 5173 was already taken and
Vite fell back to 5174 the app loaded but *every* request failed with a CORS
error and the page sat on a spinner — which looks exactly like a dead backend.
`ww_cors_origins` in `core/config.py` now covers **5173-5180 on both
`localhost` and `127.0.0.1`**, so Vite's whole fallback range works. Note that
`Server/.env` overrides the default, and it was updated to match; a stale
`WW_CORS_ORIGINS` there will reintroduce the symptom. Override per-shell with:

```powershell
$env:WW_CORS_ORIGINS="http://localhost:5173,http://localhost:5174"
```

That fallback is still worth noticing for a second reason: two dev servers means
one of them is serving stale modules. Check which port Vite actually printed.

## Verifying a change

There are no tests. The real gates are:

```powershell
cd Client; npx tsc -b          # type-check — clean, keep it that way
cd Client; npx oxlint src      # lint       — 10 warnings, no errors
cd Client; npm run build       # tsc -b + vite build, and it passes
```

`npm run build` no longer produces one big bundle: every page in `routes.tsx`
is a `React.lazy` import, so the entry chunk is ~197 kB (62 kB gzipped) across
~114 chunks, with Konva in MapPage's chunk and TipTap in a shared editor one.
Vite still warns about a chunk over 500 kB — that is the TipTap chunk, not a
regression.

**Do not use `npx tsc --noEmit` here.** The root `tsconfig.json` is a solution
file — `"files": []` plus two project references — so a bare `tsc --noEmit`
compiles **zero files** and exits 0 no matter what is broken (`tsc --noEmit
--listFilesOnly` prints nothing). It was treated as the type-check gate for a
long time and never checked anything. Use `npx tsc -b`, or
`npx tsc --noEmit -p tsconfig.app.json` for the errors without build info.

`npm run build` used to fail on 18 "pre-existing library-version mismatch"
errors in 11 files. **They are all fixed as of 2026-09-04** and the build is
green. They were never an unfixable mismatch — each was a MUI v9 API removal
with a documented replacement (`<Stack justifyContent=>` → the same value in
`sx`, `primaryTypographyProps` → `slotProps.primary`, `PaperProps` →
`slotProps.paper`, Autocomplete's `params.InputProps` → `params.slotProps`),
plus `JSX.Element` → `ReactElement` for React 19 and one real Konva typing on
`onTap`. See `B0` / `E9` in `checklist.txt`. **A `tsc -b` error is now always
yours.**

For backend changes, hit the endpoint — the API serves interactive docs at
`/docs`. For DB state, connect directly:

```powershell
psql -h localhost -U postgres -d WorldWatcher_DB
```

Credentials come from `Server/.env` (git-ignored). Migrations:

```powershell
cd Server; .venv/Scripts/python.exe -m alembic current
cd Server; .venv/Scripts/python.exe -m alembic upgrade head
```

## Conventions that matter here

- **Reference, never duplicate.** This is the core rule of the data model. Any
  field naming a creature, NPC, spell, magic item, skill, damage type,
  condition or CR must FK to the existing entity, with encounter-specific
  metadata (quantity, role, attitude) living on the join row. Free-text
  restatement of an entity is a bug.
- **Chat messages and note/article bodies are all HTML** and all edited with
  TipTap. `ChatComposer` is the one chat input (compose and edit), a small
  subset of `TipTapArticleEditor`'s toolbar; `utils/bbcode.ts`'s `bbcodeToHtml`
  now only renders *legacy* bodies, converted on open by `toEditorHtml`.
- **Random tables have three orthogonal dimensions**, kept as three separate
  fields and never collapsed: exactly one `category` (a node in a browsable
  tree — what the table is about), many `tags` (faceted: `env:forest`,
  `tier:1`, `theme:horror`), and exactly one `format` (how it rolls). Do not
  add category nodes per environment or tier; that belongs in tags and makes
  the tree explode combinatorially.
- **Server DTO vs domain type.** `Client/src/api/types.ts` holds server shapes,
  `Client/src/types/` holds domain shapes, and `Client/src/api/adapters.ts`
  maps between them. New endpoints get a resource module in
  `Client/src/api/resources/`, not ad-hoc `fetch` calls.
- **One Zustand store per domain**, named `use<Domain>Store.ts`. UI preference
  state (layouts, pins, collapse) persists to `localStorage` through these
  stores — follow `usePlayLayoutStore.ts` as the pattern.
- **Itemized multi-value text fields** (NPC personality, appearance, secrets,
  relationships) are stored as newline-joined Text on the server and edited
  with `ItemListField` on the client. Reuse that pattern rather than inventing
  a new one.
- **One UI scale, applied through the design system.** `theme/uiScale.ts`
  holds `UI_SCALE` (default 0.6, persisted, changed in Settings) and `su(px)`;
  `theme/layout.ts` holds every chrome measurement that scales. A new fixed
  size that is part of the *chrome* goes through `su`. **Do not reach for CSS
  `zoom` or `transform: scale`** - MUI v9 positions overlays through
  `@popperjs/core` v2 and Popover's own rect math, neither of which compensates
  for a scaled ancestor, so a tooltip lands 84px off its anchor and `100vh`
  stops meaning the viewport. Measured; see `I-S` in `checklist.txt`. Map and
  note-canvas geometry is excluded from scaling on purpose.
- **Reuse before adding.** The codebase already has search bars, filter chip
  groups, pinnable rows, split panes and BBCode/TipTap editors. Look for the
  existing component before writing a parallel one.
- Some files are large by intent (`EncounterFormDialog.tsx` ~1600 lines,
  `adapters.ts` ~1400, `MapPage.tsx` ~1200). Match the surrounding style;
  don't opportunistically refactor them as part of an unrelated change.

## Known dead weight

The old random-table subsystems' backend (`models/situational_table.py`, the
`situational_tables.py` and `random_encounter_tables.py` routers and their
schemas) is **gone** — deleted, and unregistered from `api/router.py`. That was
`E5`, and it is done. Don't reintroduce them; random tables are one unified
system now (`models/random_tables.py`).

`components/layout/AppShell.tsx` has **no callers left**. It was the pre-redesign
shell (a bare "WorldWatcher" AppBar); `MapPage` was the last page on it and moved to
`SectionLayout` on 2026-09-22 (`M3` in `checklist.txt`). It is still in the tree, and
two comments in `TutorialOverlay.tsx` / `tutorialSteps.ts` still point at it for the
`data-tour` targets - `TopBar` carries `data-tour="navbar-brand"` now. Deleting it is a
safe, separate cleanup; don't route a new page through it.

`BBCodeEditor.tsx` is **gone** too, along with `utils/bbcode.ts`'s
`BBCODE_TOOLBAR_TAGS` (its only remaining caller). That was `N7`. The rest of
`utils/bbcode.ts` is very much alive: `bbcodeToHtml` renders chat messages and
legacy note bodies, and `buildEntityRefTag` writes chat mentions.
