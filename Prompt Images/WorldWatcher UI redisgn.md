# WorldWatcher — UI Redesign & Information Architecture

A blueprint for a full UI overhaul that holds your current features *and* the
World-Anvil-style features you plan to add, without forcing another overhaul later.

**Your stack (for the implementation notes):** React 19 + TypeScript, Vite, MUI,
Zustand, Konva (map canvas) · FastAPI + SQLAlchemy + Alembic · PostgreSQL · 5etools SRD
importer. Current entry point is `/campaigns` (campaign-first).

---

## 0. The five decisions (read this first)

1. **One data model: typed Entries + Views.** Everything that isn't live combat is an
   *Entry* of a *type* (Character, Settlement, Faction, Item, Plot, Spell…). Every feature
   — NPC table, faction graph, quest board, timeline, map-with-pins, tech tree — is just a
   *View* (a lens) over those entries. Build this once and future features are additive.
2. **Two scopes: World → Campaign.** A World is the setting (wiki, atlas, timeline,
   lore). A Campaign is a play-through inside a World (sessions, plots, quests, party,
   encounters). This is exactly how World Anvil separates worlds and campaigns, and it is
   what makes your planned features fit.
3. **A three-pane app shell** shared by every screen: icon rail → context sidebar → main
   → optional right panel, under a global top bar.
4. **A command palette (⌘K) + customizable shortcuts** are the backbone of "access
   everything fast," not deep menus.
5. **Prep vs Run.** Managing/authoring is one interface; running live combat is a
   dedicated focused *Session Runner* you launch from an encounter or session.

---

## 1. The core mental model (this is the future-proofing)

Think in two layers.

**Data layer — Entries.** An Entry is one atomic thing in your world. It has:

- a **type** (Character, Settlement, Faction, Item, Spell, Creature, Plot, Event, …),
  which selects a **template** of structured sections/fields,
- a **folder** (user-defined tree) and **tags**,
- **structured fields** (from the template) + free **body sections**,
- **links** to other entries (bidirectional backlinks),
- **images**,
- **visibility**: `GM-only` / `Player-visible` / `Published`.

**Presentation layer — Views (lenses over entries):**

| View        | What it's good for                         | Replaces / powers                     |
|-------------|--------------------------------------------|---------------------------------------|
| Page        | Read/edit one entry                        | Article page, NPC sheet               |
| Table       | Scan/filter many entries of a type         | NPC table, quest table, faction table |
| Board       | Kanban by a field (status, act, tier)      | Quest tracker, plot stages            |
| Graph       | Relationships between entries              | Faction diplomacy graph               |
| Map         | Entries placed geographically              | Atlas / world map pins                |
| Timeline    | Entries placed in time                     | Chronicle, history, session log       |
| Tree        | Parent/child hierarchies                   | Tech / magic / ancestry trees         |
| Table-roll  | A table you roll dice against              | Random encounters, loot tables        |

**How your existing features map onto it:**

| Current feature      | Entry type(s)                       | Primary view(s)             |
|----------------------|-------------------------------------|-----------------------------|
| NPCs                 | Character                           | Table, Page                 |
| Factions             | Faction/Organization                | Graph + Table (both edit same data) |
| Quests               | Quest/Plot (nested objectives)      | Board + Table               |
| Creatures/Compendium | Creature, Spell, Item (SRD + custom)| Library (search), Page      |
| Encounters           | Encounter (roster of creatures)     | Builder + Table-roll        |
| Bastions             | Facility (catalog) + Bastion (party)| Catalog + per-character Table |
| Battle Maps          | *live-play object*, not an entry    | Map canvas + Run            |

> **Payoff:** "Add a Timeline / Content Tree / Random Table" stops being "build a new
> silo" and becomes "add a type + reuse a view." Your UI shell never has to change.

---

## 2. Scope hierarchy: Account → World → Campaign

```
Account (you)
 └─ World  ── the setting: reusable across campaigns
     ├─ World Manager (all Entries + folders)
     ├─ Atlas (world maps + pins)
     ├─ Timeline + Calendar
     ├─ Compendium (creatures / spells / items; SRD + custom)
     ├─ Content Trees
     └─ Campaign  ── a play-through inside the world (1..N per world)
         ├─ Plots / Module planner
         ├─ Sessions + Session Reports
         ├─ Quests (active for this party)
         ├─ Encounters (prepped + run)
         ├─ Battle Maps + Initiative  → Session Runner
         ├─ Party (PCs) + Bastions
         └─ Player-facing / publishing
```

**What lives where (your current data is mostly campaign-scoped today; recommended split):**

| Thing                         | Level     | Why                                              |
|-------------------------------|-----------|--------------------------------------------------|
| Articles / lore, NPCs, deities| World     | The setting; may outlive one campaign            |
| Factions                      | World     | Powers exist in the world (campaign can *track* their state) |
| Atlas / world maps            | World     | Geography is the setting                          |
| Timeline + calendar           | World     | World history                                     |
| Compendium (SRD + custom)     | World (SRD shared/global) | Reference library                    |
| Content trees                 | World     | Tech/magic/ancestry are setting-level             |
| Plots / campaign module       | Campaign  | Belongs to the specific run                        |
| Sessions / session reports    | Campaign  | Per play-through                                   |
| Quests (active)               | Campaign  | This party's objectives                            |
| Encounters (prepared/run)     | Campaign  | This run                                            |
| Battle maps + initiative      | Campaign/Session | Live play                                    |
| Party (PCs) + bastions        | Campaign  | This party                                          |

**Don't over-burden beginners.** Creating a Campaign auto-creates (or attaches) a World;
a solo DM with one setting never has to think about the distinction. Advanced users get
the payoff when they run a second campaign in the same world.

> **Migration note:** you're campaign-first today. Least-disruptive path — treat each
> current campaign as `World + default Campaign`, then progressively move setting-level
> data (lore/NPCs/factions/atlas) up to the World.

---

## 3. The app shell (frame shared by every screen)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR                                                                        │
│ [🌐 Athena ▸ Rise of the Dragon ▾] [ 🔍 Search / jump…  ⌘K ] [+ New] [▶ Run] [◕]│
├───┬──────────────┬──────────────────────────────────────────┬─────────────────┤
│ I │ CONTEXT      │ MAIN                                       │ RIGHT PANEL     │
│ C │ SIDEBAR      │  Athena / People / NPCs        (breadcrumb)│ (contextual,    │
│ O │ (per-section │  ── Title ──          [Table|Board|Graph]  │  collapsible)   │
│ N │  tree/list/  │                                            │  · metadata     │
│   │  layers)     │  ┌──────────────────────────────────────┐  │  · visibility   │
│ R │              │  │  content: table / page / map / graph │  │  · links /      │
│ A │  + Saved     │  │                                      │  │    backlinks    │
│ I │  views       │  └──────────────────────────────────────┘  │  (Run: initiative)│
│ L │              │                                            │                 │
├───┴──────────────┴──────────────────────────────────────────┴─────────────────┤
│  (Run mode replaces this whole body with the Session Runner)                   │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Region responsibilities**

- **Top bar (persistent):** World▸Campaign switcher (left), command-palette search
  (center), **+ New** and **Run** actions + account menu (right). Never scrolls away.
- **Icon rail (~56–64px):** primary sections, grouped `WORLD` / `CAMPAIGN`, Settings
  pinned bottom. Hover to reveal labels, or pin-to-expand into a labeled drawer.
- **Context sidebar (~260px, collapsible):** section-specific navigation — folder tree
  (World Manager), map+layer list (Atlas), era list (Timeline), library categories
  (Compendium). Holds **Saved Views**.
- **Main:** breadcrumbs + title + **view switcher** + primary actions, then content.
- **Right panel (~320px, collapsible):** metadata / links / visibility for the current
  entry; becomes the **initiative tracker** in Run mode. Toggle with a shortcut.

**Responsive collapse order (wide → narrow):** right panel → context sidebar → icon rail
(to a hamburger). On tablet in Run mode, keep map + initiative only.

---

## 4. Navigation system in detail

### 4.1 Icon rail contents

```
WORLD                     CAMPAIGN                 (bottom)
· Home / Dashboard        · Plots / Module         · Settings
· World Manager           · Quests                 · Account
· Atlas (world maps)      · Encounters ▸ Run
· Timeline + Calendar     · Party + Bastions
· Compendium
· Content Trees ┐
· Whiteboard    ├─ or fold into a "Tools" flyout
· Tables/Rolls  ┘
```

Keep ~8–11 visible items. Push Whiteboard, Tables, Content Trees into a **Tools** flyout
if the rail gets crowded — they're lower-frequency.

### 4.2 Context sidebar per section

| Section        | Sidebar shows                                             |
|----------------|-----------------------------------------------------------|
| World Manager  | Folder tree (drag-drop) + type filters + Saved Views      |
| Atlas          | Map list + marker-group layers (toggle visibility)        |
| Timeline       | Eras/chronicles list + event-type filters + calendar link |
| Compendium     | Creatures / Spells / Items categories + source filter     |
| Plots          | Act/chapter outline (the module structure)                |
| Quests         | Status groups (active/completed) + giver filters          |
| Party          | Character list + Bastions tab                              |

### 4.3 Top bar

- **World▸Campaign switcher** — the answer to "where do I choose the campaign." Two-part
  breadcrumb dropdown. Selecting a world shows its campaigns; selecting a campaign enters
  play context. "Setting-only" mode (no campaign) is valid for pure worldbuilding.
- **Command palette / search** — see 4.5.
- **+ New** — create any entry type, map, event, plot… from anywhere.
- **Run** — enters the Session Runner for the active/last session.
- **Account** — settings, keyboard shortcuts, theme, publish/share.

### 4.4 Breadcrumbs — yes, and where

Put them at the **top of the main area**, above the title. Format:
`World / Folder / Subfolder / Entry`, each segment clickable, last segment = current page.

- **Use them** anywhere content nests: World Manager, article pages, atlas sub-maps,
  plot → chapter → scene.
- **Skip them** on flat top-level screens (Dashboard, a bare Table root) — a page title is
  enough there.
- The breadcrumb's **World / Campaign** root segments mirror the top-bar switcher, so users
  have two consistent ways to move up.

### 4.5 Command palette + search (⌘K / Ctrl-K)

The single biggest "access everything quicker" win.

- **Jump:** type any entry name → go straight to it (fuzzy).
- **Create:** `> new settlement`, `> new plot`.
- **Act:** `> start session`, `> add timeline event`, `> roll loot table`.
- **Global search** (full-text across entries, later maps/tables) lives in the same box; a
  dedicated results page handles filter-by-type/tag/folder for heavy searches.

### 4.6 Keyboard shortcuts (customizable)

Ship sensible defaults; expose a remap table in Settings (store as a user-scoped JSON
map). Suggested defaults:

```
⌘K  palette      ⌘.  toggle right panel   G then W  go World Manager
N   new entry     /  focus search          G then A  go Atlas
E   edit page     R  run session           G then T  go Timeline
[   prev entry    ]  next entry            ⌘S  save
Run mode:  Space next turn · ↑/↓ reorder · +/- HP · D roll · A add combatant
```

`G then <key>` "go-to" navigation and the Run-mode combat keys are where you deliver the
"improved initiative with fewer clicks" goal.

---

## 5. Sitemap

```
/                         Landing / auth
/dashboard                Worlds + campaigns overview, resume session, recents

WORLD  /w/:worldId/
  home                    World dashboard (stats, recent edits, pinned)
  manager                 Entry database (folder tree + views)   ← categorization
    manager/:folder
    entry/:entryId        Article/entry page (template-driven, editable)
    entry/new?type=       Type picker → templated create
  atlas                   Map list
    atlas/:mapId          Interactive map (pins, marker groups, layers)
  timeline                Chronicle / eras / events
    timeline/calendar     Custom calendar manager (months, days, moons, weeks)
  compendium              Library: creatures / spells / items
    compendium/:id        Stat block / spell / item page
  trees                   Content trees list
    trees/:treeId         Tech / magic / ancestry tree editor
  tables                  Databases, lists, rollable tables
    tables/:tableId       Table editor + roll
  whiteboard              Freeform brainstorm canvases
    whiteboard/:boardId
  settings                World settings, members, publishing defaults

CAMPAIGN  /w/:worldId/c/:campaignId/
  home                    Campaign dashboard (next session, threads, party)
  plots                   Module planner (acts → chapters → scenes/plot threads)
    plots/:plotId
  sessions                Session list
    sessions/:sessionId   Session prep + Session Report (player-facing)
  quests                  Quest tracker (board/table)
    quests/:questId
  encounters              Encounter list + builder
    encounters/:id
  maps                    Battle maps (tactical)
    maps/:mapId           Map editor (Konva)
    maps/:mapId/run       SESSION RUNNER (map + initiative + quick ref)
  party                   PCs + Bastions
  publish                 What players can see / player portal
  settings                Campaign settings, players, invites

ACCOUNT  /account/
  profile · shortcuts · appearance · billing · integrations
```

---

## 6. Navigation map (how screens connect)

```
                         ┌───────────── TOP BAR (everywhere) ─────────────┐
                         │ World▸Campaign switcher · ⌘K palette · +New ·  │
                         │ Run · Account                                   │
                         └─────────────────────────────────────────────────┘
   Dashboard ──pick world──► World Home ──pick campaign──► Campaign Home
      │                          │                              │
      │                 ┌────────┼───────────┐          ┌───────┼─────────┐
      ▼                 ▼        ▼           ▼          ▼       ▼         ▼
  (resume run) ─► Manager   Atlas   Timeline/Cal   Plots   Quests    Encounters
                    │  ▲       │        │             │       │          │
                    │  └links──┼────────┼─────────────┼───────┘          │
                    ▼          ▼        ▼             ▼                   ▼
                 Entry pages  Pins →  Events →     Chapters/         Encounter
                 (any type) ◄─ Entry  Entry        scenes → Entry    builder
                                                                        │
   Everything cross-links via [[entry]] links and the right panel.     ▼
   Palette (⌘K) jumps to ANY node from ANY node.               Session Runner
```

Two guarantees make this navigable: **(a)** any entry links to any entry (right-panel
"linked" + inline `[[mentions]]`), and **(b)** ⌘K reaches every node directly, so users are
never more than one shortcut from anywhere.

---

## 7. Key user flows

**Flow A — Pick / switch the campaign to play**
1. Log in → **Dashboard** lists Worlds, each expandable to its Campaigns; a **Resume last
   session** card sits on top.
2. Click a campaign → Campaign Home. Or click **Resume** → straight into the Session Runner.
3. Change later anytime via the **top-bar switcher** (world segment → world; campaign
   segment → campaign) — no need to return to Dashboard.

**Flow B — Author a templated article (the #2 requested feature)**
1. **+ New** (or ⌘K `> new`) → **type picker** (grid like World Anvil's: Character,
   Settlement, Faction, Item, Deity…).
2. Pick "Settlement" → editor opens with the **Settlement template**: prefilled collapsible
   sections (Overview, Demographics, Government, Defenses, Economy, Currency, Districts…).
3. Fill only what you want; empty sections hide on the reader view. Toggle extra sections
   on/off. Set folder, tags, and **visibility**.
4. Link as you type (`@`/`[[` to reference other entries); backlinks auto-populate on both
   sides. Save (⌘S).

**Flow C — Plan a plot / campaign module (the #3 requested feature)**
1. Campaign → **Plots** → **New plot** (template: Premise, Hooks, Acts, Beats, Stakes,
   Rewards, Involved NPCs/Factions/Locations).
2. Break into Acts → Chapters → Scenes (context sidebar = the outline; drag to reorder).
3. Link scenes to Locations, NPCs, Encounters, Quests. Set each node GM-only until ready.
4. When a session hits a scene, **publish** the relevant bits to players.

**Flow D — Build then run an encounter (fewer clicks)**
1. Campaign → **Encounters** → **Builder**: add creatures (drag from Compendium), set party
   size/level → live **CR / difficulty** readout. Save; optionally add to a **random table**.
2. Attach the encounter to a **Battle Map**.
3. Hit **Run** → **Session Runner**: initiative auto-rolls, map + tokens load.
4. Combat via keys: `Space` next turn, `+/-` HP, `D` roll, `A` add combatant, `↑/↓` reorder.

**Flow E — Drop a map pin linked to an article**
1. Atlas → open map → **Add pin** (or drag an existing entry onto the map).
2. Pin → choose/assign a **marker group** (cities, dungeons, quests…) that toggles as a layer.
3. Link the pin to an Entry → the entry's page shows "appears on Map X"; the pin opens a
   preview card → full article.

**Flow F — Roll on a random table**
1. Tools → **Tables** → new table (columns: weight, result, → optional link to another
   table or entry).
2. **Roll** button (or ⌘K `> roll <table>`) → result; chained tables cascade
   (loot → item → rarity).
3. Embed the table in any article or the Session Runner side rail.

**Flow G — Publish to players**
1. On any entry/plot/session, set visibility `Player-visible` → **Publish**.
2. Players see only published content via the **Player portal** (`/publish`), organized by
   your same folders but filtered to what's shared.

---

## 8. Page-by-page layout (where the buttons go)

Notation: `[SB]` context sidebar · `[MAIN]` · `[RP]` right panel · `[TB]` top bar.

**8.1 Dashboard / Launcher**
```
[MAIN]  ▸ "Resume: Rise of the Dragon — Session 12"  [▶ Continue]
        ▸ Worlds (cards):  Athena  |  + New World
             └ campaigns as chips under each world card
        ▸ Recent entries · Recent maps · Upcoming session
```
Primary buttons: **Resume** (top-left, biggest), **New World / New Campaign** (top-right).

**8.2 World Manager (entry database)** — *your categorization home*
```
[SB]  folder tree (drag-drop) · type filters · Saved Views · [+ folder]
[MAIN] breadcrumb · title · [Table|Board|Gallery] · [Filter][Sort][+ New]
       table/gallery of entries; bulk-select → move/tag/visibility
[RP]  (when a row is selected) quick metadata + open
```
Buttons: **+ New** (main, top-right) · **+ folder** (sidebar) · view switcher (main header).

**8.3 Entry / Article page**
```
[SB]  in-page section outline (jump links) — Overview, Government, Economy…
[MAIN] breadcrumb · cover image · Title · [type badge] · [Edit][⋯][👁 visibility]
       structured sections (collapsible) + free body
[RP]  Details (type, folder, tags) · Visibility · Linked/Backlinks · Images · History
```
Buttons: **Edit** toggle (top-right), **visibility** selector (header), **+ add section**
(inline, edit mode), **link** (`[[`) inline.

**8.4 Atlas / interactive map**
```
[SB]  map list · marker-group layers (checkbox toggles) · [+ map][+ group]
[MAIN] map canvas (pan/zoom) · toolbar: [Pin][Area][Measure][Layer]
       click pin → preview card → open entry
[RP]  selected pin: linked entry, group, notes, coords
```
Buttons: **Add pin / area** (canvas toolbar), **+ map/group** (sidebar), **layer toggles**
(sidebar).

**8.5 Timeline + Calendar**
```
[SB]  eras / chronicles · event-type filters · [Calendar settings]
[MAIN] horizontal timeline (zoomable) OR event list · [+ Event][zoom][filter]
       event → linked entries
[Calendar tab] define months, days/month, weekdays, moons, leap rules; live preview
```
Buttons: **+ Event** (main), **Calendar settings** (sidebar → dedicated editor).

**8.6 Compendium**
```
[SB]  Creatures | Spells | Items · source filter (SRD/custom) · CR/level/school filters
[MAIN] search-first list/table · [+ Custom]
[detail] stat block / spell / item · [Add to encounter][Duplicate & edit]
```

**8.7 Encounters + builder**
```
[SB]  encounter list · random tables
[MAIN builder] party (size/level) | monsters (drag from compendium) | CR meter
       [Save][Attach map][▶ Run][Add to random table]
```

**8.8 Session Runner (GM screen — Run mode)** — *replaces the normal body*
```
┌ TB (slim): session name · round/turn · [End session] ─────────────────────────┐
│ [MAIN] battle map (Konva): tokens, fog, measure, shapes                        │
│ [RP]  INITIATIVE: ordered combatants · HP ±  · conditions · [+ add] · [next ▶] │
│ [bottom drawer] tabs: Notes/Session Report · Quick lookup · Dice · Encounters  │
└────────────────────────────────────────────────────────────────────────────────┘
Keys: Space=next · ↑/↓ reorder · +/- HP · C condition · D dice · A add · F fog
```
This is the "improved initiative, fewer clicks" surface: everything is one keypress.

**8.9 Plots / module planner**
```
[SB]  Acts → Chapters → Scenes outline (drag to reorder)
[MAIN] selected node: template fields (goal, hooks, beats, stakes) + linked entities
[RP]  links (NPCs/locations/encounters/quests) · visibility/publish
```

**8.10 Factions graph**
```
[SB]  faction list (same data as graph) · relation-type legend
[MAIN] [Graph|Table] · node-link diplomacy graph; drag nodes; edit edge = relation
[RP]  selected faction: members, goals, links (edits sync to table instantly)
```

**8.11 Content tree**
```
[SB]  trees list (tech / magic / ancestry)
[MAIN] node tree editor (add child, connect, collapse); node → linked entry
```

**8.12 Whiteboard**
```
[MAIN] infinite canvas: sticky notes, shapes, connectors, embedded entry cards
[TB]   [add note][shape][connector][link entry]
```

**8.13 Databases / tables (rollable)**
```
[SB]  tables list
[MAIN] spreadsheet-like editor: columns (weight, result, link) · [Roll][Embed]
       chained rolls cascade to linked tables
```

**8.14 Settings / shortcuts**
```
[MAIN tabs] Profile · Appearance(theme) · Keyboard shortcuts(remap table) ·
            Publishing · Players/Invites · World/Campaign settings · Integrations
```

---

## 9. Where every feature lands (future-proofing map)

| Feature (current + planned)     | Scope    | Section        | View / surface        | Entry type        |
|---------------------------------|----------|----------------|-----------------------|-------------------|
| Battle maps + initiative        | Campaign | Maps → Run     | Map canvas + Runner   | (play object)     |
| Compendium (creatures/spells/items) | World| Compendium     | Library + Page        | Creature/Spell/Item|
| Encounters + random tables      | Campaign | Encounters     | Builder + Table-roll  | Encounter         |
| NPCs                            | World    | World Manager  | Table + Page          | Character         |
| Factions                        | World    | World Manager  | Graph + Table         | Faction           |
| Quest tracker                   | Campaign | Quests         | Board + Table         | Quest/Plot        |
| Bastions                        | Campaign | Party          | Catalog + Table       | Facility/Bastion  |
| Categorization / folders (#2)   | World    | World Manager  | Folder tree           | (all)             |
| Templated detail articles (#4)  | World    | World Manager  | Page (templates)      | (all types)       |
| Campaign module / plots (#6)    | Campaign | Plots          | Outline + Page        | Plot/Scene        |
| Timeline / chronicle (#8)       | World    | Timeline       | Timeline              | Event             |
| Calendar manager (#9)           | World    | Timeline → Cal | Calendar editor       | (config)          |
| Interactive maps + pins (#10)   | World    | Atlas          | Map                   | (pins → entries)  |
| Content trees (#11)             | World    | Trees          | Tree                  | (tree nodes)      |
| Whiteboard (#12)                | World    | Whiteboard     | Canvas                | (board)           |
| Rollable tables/databases (#12) | World    | Tables         | Table-roll            | Table             |
| Articles/world manager (#13)    | World    | World Manager  | all                   | (all)             |
| Improved initiative (#14)       | Campaign | Runner         | keys/shortcuts        | —                 |
| Search (#15)                    | Global   | Palette/⌘K     | palette + results     | —                 |
| Custom shortcuts (#16)          | Account  | Settings       | remap table           | —                 |

Every new row you'll ever add slots into an existing Section + View. That's the test the
design must pass, and it does.

---

## 10. Recommended build order (phased, maps to your GitHub issues)

**Phase 0 — Foundation (do before features).**
- Introduce the **World → Campaign** scope + top-bar switcher.
- Build the **Entry model** (type, template, folder, tags, links, visibility) and the
  **app shell** (rail + context sidebar + main + right panel + breadcrumbs).
- Ship **⌘K palette** early — it de-risks nav while sections are incomplete.
- Migrate NPCs/Factions/Quests to be **Entries** behind their existing Table/Graph views.

**Phase 1 — Categorization + articles (highest user value; friend's #1 & #2).**
- World Manager (folder tree, saved views), type picker, ~6 starter templates
  (Character, Settlement, Faction, Item, Deity, Organization). Bidirectional links.

**Phase 2 — Campaign features (friend's #3).**
- Plots/module planner, Sessions + Session Reports, publish/visibility, Player portal.

**Phase 3 — World depth.**
- Atlas pins + marker groups (Konva) → link to entries.
- Timeline + Calendar manager.

**Phase 4 — Live-play polish.**
- Session Runner refactor + full combat shortcut keys (fewer clicks).

**Phase 5 — Power tools.**
- Rollable tables (+ chaining), Content trees, Whiteboard, custom shortcut remapping,
  full-text search results page.

---

## 11. Implementation notes (tailored to your stack)

- **Shell:** MUI — persistent `AppBar` (top bar), a mini `Drawer` (icon rail) + a second
  `Drawer` (context sidebar), main `Box`, and a right `Drawer` (metadata/initiative).
  MUI `Breadcrumbs` in the main header.
- **State:** Zustand slices — `session` (active world/campaign + Run state), `ui` (panel
  toggles, theme), `shortcuts` (user keymap). A tiny `useHotkeys` layer reads the keymap so
  remapping is data, not code.
- **Command palette:** `kbar` or `cmdk` wired to a registry of {jump, create, action}
  commands; each Section registers its own commands so it stays additive.
- **Entry templates:** store templates as JSON schema per type (server-side, versioned via
  Alembic). The Page view renders sections from the schema — new types need no new UI.
- **Links/backlinks:** an `entry_link(source_id, target_id, kind)` table gives you graph,
  backlinks, and "appears on map" for free.
- **Maps/Runner:** keep Konva; the Runner is a route-level layout swap, not a new app.
- **Visibility/publish:** one `visibility` enum on entries + a published-content query
  powers the Player portal without a parallel data model.
- **Search:** start with Postgres full-text (`tsvector`) over entries; the palette hits the
  same endpoint.

---

### One-line summary
Build **typed Entries + reusable Views** inside a **World → Campaign** scope, wrap them in
a **three-pane shell with a top-bar switcher, breadcrumbs, and a ⌘K palette**, and keep
**live play as a dedicated Runner** — then every future feature is a new type or view, not
a new UI.