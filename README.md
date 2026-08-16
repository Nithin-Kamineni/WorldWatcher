# WorldWatcher

WorldWatcher is a D&D virtual tabletop and campaign-management app for Dungeon Masters.
It combines a battle-map/token editor with a full DM panel for tracking encounters,
creatures, factions, quests, and player bastions - backed by a real database, not
scattered notes.

## Features

- **Maps** - upload battle maps, organize them into floors, and run combat on them with
  draggable tokens, drawn shapes, and initiative tracking.
- **Encounters** - build fixed-roster or random-table encounters, and group several into
  a **random encounter table** the DM can roll a die against from the map toolbar.
- **Creatures** - a searchable catalog of monsters, NPCs, spells, and magic items.
- **Factions** - track every power in your world in a table, and see how they relate to
  each other in an interactive **diplomacy graph** (same data as the table - edit either
  view and the other updates immediately, and a relation between two factions is always
  the same from both sides).
- **Quests** - track objectives (with nested sub-objectives), rewards, and which
  factions/NPCs are involved.
- **Bastions** - a reference catalog of the D&D 2024 Bastion facilities plus a
  per-character tracker for what each player has built.
- **Guided tour** - click the **?** icon in the navbar for a spotlight walkthrough of
  the app's main tools.

## Tech stack

- **Client**: React 19 + TypeScript, Vite, MUI, Zustand, Konva (for the map canvas)
- **Server**: FastAPI + SQLAlchemy (async) + Alembic, Python 3.9+
- **Database**: PostgreSQL
- **Data**: an importer pipeline (`Database/Maintainance/importer/`) that loads 5etools'
  open-source SRD/rules data (monsters, spells, items, bastions, etc.) into Postgres

## Project structure

```
Client/     React/TypeScript frontend (Vite)
Server/     FastAPI backend + Alembic migrations
Database/   Hand-maintained schema (Maintainance/sql), the 5etools data importer, and
            external source data (not part of this repo - see below)
```

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Python](https://www.python.org/) 3.9+
- [PostgreSQL](https://www.postgresql.org/) 16+ running locally (or use
  `Server/docker-compose.yml` to run one in a container)

## Setup

### 1. Database

Create an empty database (defaults below match `Server/.env.example`):

```bash
createdb WorldWatcher_DB
```

### 2. Backend

```bash
cd Server
python -m venv .venv
.venv/Scripts/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env          # then edit WW_DB_* to match your local Postgres
alembic upgrade head          # creates all tables

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API is now served at `http://localhost:8000` (interactive docs at `/docs`).

The database starts empty. To populate it with SRD reference content (monsters,
spells, items, bastion facilities, etc.), point `Database/Maintainance/importer/cli.py`
at a local copy of the [5etools](https://github.com/5etools-mirror-3) data - see that
folder's own docs for the exact pipeline stages. This step is optional for just running
the app; campaigns, maps, factions, quests, and bastions all work without it.

### 3. Frontend

```bash
cd Client
npm install
npm run dev
```

Open the printed local URL (defaults to `http://localhost:5173`).

## Screenshots

_Add screenshots to `docs/screenshots/` and reference them here - see
`docs/screenshots/README.md` for the exact list of shots to capture._

```markdown
![Campaigns list](docs/screenshots/campaigns.png)
![DM Panel - Maps](docs/screenshots/dm-panel-maps.png)
![Map & token editor](docs/screenshots/map-editor.png)
![Factions table](docs/screenshots/factions-table.png)
![Factions diplomacy graph](docs/screenshots/factions-graph.png)
![Quests](docs/screenshots/quests.png)
![Bastions](docs/screenshots/bastions.png)
![Guided tour](docs/screenshots/tutorial.png)
```

## License

See [LICENSE](LICENSE).
