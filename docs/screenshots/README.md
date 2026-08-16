# Screenshots to capture

The main `README.md` links to images in this folder that don't exist yet - there's no
browser-automation tool available in the environment these were written in, so they need
to be captured by hand. Run both dev servers (`Server`: `uvicorn app.main:app --reload`,
`Client`: `npm run dev`), open a campaign, and grab these, saved with these exact
filenames so the README's links resolve:

| Filename | What to capture |
| --- | --- |
| `campaigns.png` | The campaigns list page (`/campaigns`) |
| `dm-panel-maps.png` | A campaign's DM Panel, Maps tab, with at least one map listed |
| `map-editor.png` | The map/token editor open on a floor, with a few tokens placed |
| `factions-table.png` | DM Panel → Factions, table view |
| `factions-graph.png` | DM Panel → Factions, diplomacy graph view, with a faction selected so the detail panel with comparison bars is visible |
| `quests.png` | DM Panel → Quests, with a quest or two and their objectives visible |
| `bastions.png` | DM Panel → Bastions |
| `tutorial.png` | The guided tour overlay mid-tour (click the **?** icon in the navbar), showing the spotlight + step card |

PNG, ~1280px wide is plenty - no need for full-resolution captures.
