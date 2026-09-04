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

```bash
cd Server && .venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8006
```

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
curl -s -o /dev/null -w "%{http_code}" http://localhost:8006/docs
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
taken — read the actual URL out of its output rather than assuming.

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
cd Client && npx tsc --noEmit     # type-check
cd Client && npx oxlint src       # lint (oxlint, not ESLint)
cd Client && npm run build        # tsc -b + vite build
```

`npx tsc --noEmit` reports roughly a dozen **pre-existing** errors from a
library-version mismatch (map popovers, notes folder tree, world pages),
tracked as `E9` in `checklist.txt`. `npm run build` succeeds regardless. Don't
report those as regressions from your change.

For backend work, exercise the endpoint directly against `/docs` or with
`curl`. For DB state, use `psql` as above.

## Seeing it in the browser

Screenshots and click-through need browser automation, which this project has
not had wired up historically — which is why "manual browser click-through of
every Play layout" is still open as `E12` in `checklist.txt`. If a Playwright
MCP server is available in the session, drive the running client at
`http://localhost:5173` with it. If it is not, bring the stack up, tell the
user which URL to open and what to look at, and do not claim visual
verification you did not perform.
