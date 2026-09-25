---
name: run
description: Launch the WorldWatcher stack (Postgres + FastAPI + Vite client) for local development, or bring up the full Docker stack. Use when asked to run, start, restart, or screenshot the app, or to confirm a change works in the real app rather than only in a type-check.
---

# Running WorldWatcher

Two independent paths. Pick one; never half of each.

## Path A — native dev (default; use this for iterating)

This is what you want when verifying a code change, because Vite HMR picks up
client edits and `--reload` picks up server edits.

### 1. Postgres must be reachable

The DB is expected at `localhost:5432`, database `WorldWatcher_DB`, user
`postgres`. Check before starting anything else:

```bash
psql -h localhost -U postgres -d WorldWatcher_DB -c "SELECT 1"
```

If that fails, either the local Postgres service is stopped or you want Path B.
Do not start a second Postgres — the docker `db` service also binds 5432 and
will collide with a local install.

### 2. Backend

```powershell
./scripts/dev-backend.ps1 -Detached
```

That supervises uvicorn: it reads the port from `Client/.env`, starts the venv's
Python, restarts the server whenever it exits (with backoff), and logs to
`Server/logs/`. Use it instead of running uvicorn by hand - a bare

```bash
cd Server && .venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8006
```

is a child of your shell and dies with the session, which is why the backend
kept "randomly stopping". `./scripts/dev-backend.ps1 -Status` says whether it is
up; `-Install` registers a per-user scheduled task so it comes back at logon.

Two rules that have burned this project before:

- **Always `.venv/Scripts/python.exe -m uvicorn`, never a bare `uvicorn`.**
  Backgrounding a bare `uvicorn` here has silently run under the pyenv global
  Python instead of the venv, producing confusing import errors.
- **The port must match `Client/.env`**, currently `8006`. Ports have drifted
  repeatedly (8000 → 8001 → 8002 → 8003 → 8006) because stale processes hold
  them open and cannot be killed on this machine. `Server/.env` says
  `WW_PORT=8000` and the README says 8001 — both are stale. The `--port` flag
  wins.

Confirm it is actually up before moving on:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8006/health
```

If the port is already taken, do **not** pick a new port silently. Bump both
sides together — the `--port` flag and `Client/.env` — and say so, otherwise
the UI silently fails every request (there is no Vite dev proxy; the client
calls the absolute `VITE_API_BASE_URL`).

### 3. Frontend

```bash
cd Client && npm run dev
```

Serves `http://localhost:5173`. Vite will pick the next free port if 5173 is
taken — read the actual URL out of its output rather than assuming. The CORS
allowlist covers 5173-5180 now, so a fallback port works; but a fallback also
means a second dev server is already running and one of them is serving stale
modules, so it is still worth checking.

## Path B — full Docker stack

For checking something closest to how it is deployed, or when the local
Postgres is unavailable.

```powershell
./scripts/up.ps1
```

That runs `docker compose up -d`, prints `docker compose ps`, and prints the
URLs. The app is served at `http://localhost/campaigns` (the script also prints
a LAN URL for testing on a phone). Client and server images are **pulled from
Docker Hub**, not built from this working tree — so Path B will not show your
local code changes. Use Path A for that.

On first run the DB restores from `Database/WorldWatcher_DB_Backup_v1.sql`. To
re-seed from scratch: `docker compose down -v`, then up again.

## Verifying a change

There is no test suite. In rough order of cost:

```bash
cd Client && npx tsc -b           # type-check
cd Client && npx oxlint src       # lint (oxlint, not ESLint)
cd Client && npm run build        # tsc -b + vite build
```

**Not `npx tsc --noEmit`.** The root tsconfig.json is a solution file with
`"files": []`, so that command compiles zero files and always exits 0 — it has
never been a gate. Use `npx tsc -b`.

Both `tsc -b` and `npm run build` are clean as of 2026-09-04 (the 18
"pre-existing library-version mismatch" errors were all real MUI v9 API
removals and are fixed — see `B0`/`E9` in `checklist.txt`). oxlint reports 10
warnings and no errors. Any new error is yours.

For backend work, exercise the endpoint directly against `/docs` or with
`curl`. For DB state, use `psql` as above.

## Seeing it in the browser

If a Playwright MCP server is available in the session, drive the running
client at `http://localhost:5173` with it — it works, and it closed `E12` (the
Play-layout click-through) on 2026-09-04, real-mouse divider drags included.
Two things learned the hard way:

- The browser runs at an odd viewport scale. **Assert on the DOM**
  (`getBoundingClientRect`, store contents in `localStorage`), not on
  screenshots.
- When probing an element by computed `cursor`, remember `cursor` is an
  inherited CSS property and overlapping hit zones are real — a click at the
  centre of a split-pane divider can land on the crossing divider instead.

If Playwright is not available, bring the stack up, tell the user which URL to
open and what to look at, and do not claim visual verification you did not
perform.
