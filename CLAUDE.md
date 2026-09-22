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
# backend
cd Server; .venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8006
# frontend
cd Client; npm run dev        # http://localhost:5173
```

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
UI silently fails every request. `Server/.env` still says `WW_PORT=8000` and the
README still says 8001 — both are stale; the `--port` flag is what matters.

Always use `Server/.venv/Scripts/python.exe -m uvicorn`, never a bare
`uvicorn`. Backgrounding a bare `uvicorn` here has silently run under the pyenv
global Python instead of the venv, producing confusing import errors.

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
